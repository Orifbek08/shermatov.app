-- 10: Ўтказмани қабул қилувчи филиал тасдиқлайди.
-- Юборилганда товар юборувчидан чиқади ва «йўлда» туради (tr_state = 'pending').
-- Қабул қилинса — қабул қилувчи қолдиғига тушади; рад этилса — юборувчига қайтади (ҳужжат бекор бўлади).

alter table apteka.docs add column if not exists tr_state text;
alter table apteka.docs drop constraint if exists docs_tr_state_chk;
alter table apteka.docs add constraint docs_tr_state_chk check (tr_state in ('pending', 'accepted', 'rejected'));
alter table apteka.docs add column if not exists tr_by text not null default '';
alter table apteka.docs add column if not exists tr_at timestamptz;
alter table apteka.docs add column if not exists tr_note text not null default '';
-- аввалги ўтказмалар дарҳол ўтган — уларни «қабул қилинган» деб белгилаймиз
update apteka.docs set tr_state = 'accepted' where type = 'Ўтказма' and tr_state is null;
create index if not exists docs_tr_pending_idx on apteka.docs(to_branch_id) where tr_state = 'pending';

create or replace view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note, rd.no as ref_no,
       d.paytype, d.discount, d.discount_note, coalesce(ou.phone, '') as op_phone, d.pays,
       d.tr_state, d.tr_by, d.tr_at, d.tr_note
from apteka.docs d
join apteka.doc_lines l on l.doc_id = d.id
join apteka.products p on p.id = l.product_id
join apteka.branches b on b.id = d.branch_id
left join apteka.branches tb on tb.id = d.to_branch_id
left join apteka.docs rd on rd.id = d.ref_doc_id
left join apteka.users ou on ou.id = d.user_id;

create or replace function apteka.rowj(r apteka.v_rows) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'doc', r.doc, 'date', to_char(r.day, 'YYYY-MM-DD'), 'time', r.tm, 'type', r.type,
    'branch', r.branch, 'product', r.product, 'qty', r.qty, 'price', r.price, 'sum', r.sum,
    'client', r.client, 'doctor', r.doctor, 'to', coalesce(r.to_name, ''), 'status', r.status, 'op', r.op_name,
    'ref', coalesce(r.ref_no, ''), 'pay', r.paytype, 'disc', r.discount, 'discNote', r.discount_note, 'opPhone', r.op_phone, 'pays', coalesce(r.pays, '[]'::jsonb),
    'tr', coalesce(r.tr_state, ''), 'trBy', r.tr_by, 'trAt', coalesce(to_char(r.tr_at at time zone 'Asia/Tashkent', 'DD.MM HH24:MI'), ''), 'trNote', r.tr_note,
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

create or replace function apteka.pending_json(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select coalesce(jsonb_agg(z.j order by z.id), '[]') from (
    select d.id, jsonb_build_object(
      'doc', d.no, 'date', to_char(d.day, 'YYYY-MM-DD'),
      'time', to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI'),
      'from', b.name, 'to', tb.name, 'op', d.op_name, 'note', d.note,
      'qty', (select sum(l.qty) from doc_lines l where l.doc_id = d.id),
      'lines', (select jsonb_agg(jsonb_build_object('product', p.name, 'qty', l.qty) order by l.id)
                from doc_lines l join products p on p.id = l.product_id where l.doc_id = d.id)) as j
    from docs d join branches b on b.id = d.branch_id join branches tb on tb.id = d.to_branch_id
    where d.type = 'Ўтказма' and d.status = 'Фаол' and d.tr_state = 'pending'
      and (u.role = 'admin' or d.branch_id = u.branch_id or d.to_branch_id = u.branch_id)
  ) z
$$;

create or replace function apteka.state(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('ver', (select ver from meta where id = 1), 'cfgHash', md5(apteka.cfg()::text),
    'stock', apteka.stock_json(), 'today', apteka.today_rows(u), 'pending', apteka.pending_json(u))
$$;

create or replace function apteka.do_transfer(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r jsonb; bid int; tid int; items jsonb; d docs; x jsonb; tname text := apteka.clean(req->>'to');
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  select id into tid from branches where name = tname and active;
  if tid is null then perform apteka.fail('Қайси филиалга ўтказилишини танланг'); end if;
  if tid = bid then perform apteka.fail('Ўша филиалнинг ўзига ўтказиб бўлмайди'); end if;
  items := apteka.norm_items(req->'items', false);
  perform apteka.check_avail(bid, items);
  d := apteka.new_doc(u, 'Ўтказма', bid, tid, '', '', req, items);
  update docs set tr_state = 'pending' where id = d.id;
  -- товар юборувчидан чиқади; қабул қилувчига фақат тасдиқлангач тушади
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, -(x->>'qty')::int);
  end loop;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'pending', true) || apteka.state(u);
end $$;

create or replace function apteka.tr_get(u apteka.users, req jsonb) returns apteka.docs
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs;
begin
  select * into d from docs where no = apteka.clean(req->>'doc', 40) for update;
  if d.id is null or d.type <> 'Ўтказма' then perform apteka.fail('Ўтказма топилмади'); end if;
  if d.status = 'Бекор' then perform apteka.fail('Бу ўтказма бекор қилинган'); end if;
  if coalesce(d.tr_state, 'accepted') <> 'pending' then
    perform apteka.fail('Бу ўтказма аллақачон ' || case d.tr_state when 'rejected' then 'рад этилган' else 'қабул қилинган' end);
  end if;
  if u.role <> 'admin' and u.branch_id <> d.to_branch_id then
    perform apteka.fail('Бу ўтказмани фақат «' || (select name from branches where id = d.to_branch_id) || '» тасдиқлай олади');
  end if;
  return d;
end $$;

create or replace function apteka.tr_accept(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; x record;
begin
  d := apteka.tr_get(u, req);
  for x in select product_id, qty from doc_lines where doc_id = d.id loop
    perform apteka.add_stock(d.to_branch_id, x.product_id, x.qty);
  end loop;
  update docs set tr_state = 'accepted', tr_by = u.name, tr_at = now() where id = d.id;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'accepted', true) || apteka.state(u);
end $$;

create or replace function apteka.tr_reject(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; x record; reason text := apteka.clean(req->>'reason', 300);
begin
  d := apteka.tr_get(u, req);
  if reason = '' then perform apteka.fail('Рад этиш сабабини ёзинг'); end if;
  for x in select product_id, qty from doc_lines where doc_id = d.id loop
    perform apteka.add_stock(d.branch_id, x.product_id, x.qty);
  end loop;
  update docs set tr_state = 'rejected', tr_by = u.name, tr_at = now(), tr_note = reason, status = 'Бекор',
    cancel_note = 'Рад этилди: ' || reason || ' (' || u.name || ', ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ')'
  where id = d.id;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'rejected', true) || apteka.state(u);
end $$;

create or replace function apteka.do_cancel(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; reason text := apteka.clean(req->>'reason', 300); rec record; have int; bname text; pname text; rets text; pays text; cn text;
begin
  select * into d from docs where no = apteka.clean(req->>'doc', 40) for update;
  if d.id is null then perform apteka.fail('Ҳужжат топилмади: ' || coalesce(req->>'doc', '')); end if;
  if reason = '' then perform apteka.fail('Бекор қилиш сабабини ёзинг'); end if;
  if d.status = 'Бекор' then perform apteka.fail('Бу ҳужжат аллақачон бекор қилинган'); end if;
  if u.role <> 'admin' then
    if d.branch_id <> u.branch_id then
      perform apteka.fail('Бу ҳужжатни фақат «' || (select name from branches where id = d.branch_id) || '» ёки админ бекор қила олади');
    end if;
    -- тасдиқ кутаётган ўтказмани юборган филиал исталган куни қайтариб олиши мумкин
    if d.day <> apteka.today() and not (d.type = 'Ўтказма' and d.tr_state = 'pending') then
      perform apteka.fail('Фақат бугунги ҳужжатни бекор қилиш мумкин — админга мурожаат қилинг');
    end if;
  end if;
  if d.type = 'Расход' then
    select string_agg(no, ', ' order by id) into rets from docs where ref_doc_id = d.id and status = 'Фаол';
    if rets is not null then
      perform apteka.fail('Бу сотувга қайтариш қилинган (' || rets || '). Аввал қайтаришни бекор қилинг');
    end if;
    select string_agg(f.no, ', ' order by f.id) into pays from fin f join debts db on db.id = f.debt_id
    where db.doc_id = d.id and f.status = 'Фаол';
    if pays is not null then
      perform apteka.fail('Бу қарзга тўлов қилинган (' || pays || '). Аввал тўловни Молия бўлимида бекор қилинг');
    end if;
  end if;
  for rec in
    select bid, pid, sum(delta)::int as delta from (
      select d.branch_id as bid, l.product_id as pid,
             case d.type when 'Приход' then -l.qty when 'Қайтариш' then -l.qty else l.qty end as delta
      from doc_lines l where l.doc_id = d.id
      union all
      select d.to_branch_id, l.product_id, -l.qty from doc_lines l
      where l.doc_id = d.id and d.type = 'Ўтказма' and coalesce(d.tr_state, 'accepted') = 'accepted'
    ) z group by 1, 2 order by 1, 2
  loop
    insert into stock(branch_id, product_id, qty) values (rec.bid, rec.pid, 0) on conflict do nothing;
    select qty into have from stock where branch_id = rec.bid and product_id = rec.pid for update;
    if have + rec.delta < 0 then
      select name into bname from branches where id = rec.bid;
      select name into pname from products where id = rec.pid;
      perform apteka.fail('Бекор қилиб бўлмайди: «' || bname || '»да «' || pname || '» қолдиғи манфий бўлиб қолади (сотилиб кетган)');
    end if;
    update stock set qty = qty + rec.delta where branch_id = rec.bid and product_id = rec.pid;
  end loop;
  cn := 'Бекор: ' || reason || ' (' || u.name || ', ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ')';
  update docs set status = 'Бекор', cancel_note = cn where id = d.id;
  update fin set status = 'Бекор', cancel_note = cn || ' — ' || d.no where doc_id = d.id and status = 'Фаол';
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'cancelled', true) || apteka.state(u);
end $$;

create or replace function apteka.report(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare p daterange := apteka.period(req, 400); bid int; dr text := apteka.clean(req->>'doctor', 120); res jsonb;
begin
  if apteka.clean(req->>'branch') <> '' then
    select id into bid from branches where name = apteka.clean(req->>'branch');
    if bid is null then perform apteka.fail('Филиал топилмади'); end if;
  end if;
  with r as (select * from v_rows where day <@ p and (bid is null or branch_id = bid or to_branch_id = bid)),
  a as (select * from r where status = 'Фаол'),
  s as (select * from a where type = 'Расход' and (dr = '' or doctor = dr)),
  rt as (select * from a where type = 'Қайтариш' and (dr = '' or doctor = dr)),
  sd as (
    select doc_id, min(doc) as doc, min(branch) as branch, min(branch_id) as branch_id, min(doctor) as doctor,
           min(day) as day, min(tm) as tm, min(client) as client, min(paytype) as paytype, min(op_name) as op,
           max(discount) as discount, min(discount_note) as dnote, sum(sum) as gross, (array_agg(pays))[1] as pays
    from s group by doc_id),
  bp as (
    select sd.doc_id, pp->>'pay' as pn, (pp->>'amount')::numeric as amt
    from sd cross join lateral jsonb_array_elements(coalesce(sd.pays,
      jsonb_build_array(jsonb_build_object('pay', coalesce(nullif(sd.paytype, ''), 'Кўрсатилмаган'), 'amount', sd.gross - sd.discount)))) pp),
  sr as (
    select branch, branch_id, product, doctor, day, doc_id, qty, sum, 1 as sg from s
    union all
    select branch, branch_id, product, doctor, day, doc_id, -qty, -sum, -1 from rt
    union all
    select branch, branch_id, null, doctor, day, doc_id, 0, -discount, 0 from sd where discount > 0
  )
  select jsonb_build_object('ok', true, 'from', lower(p), 'to', upper(p) - 1,
    'filter', jsonb_build_object('branch', coalesce((select name from branches where id = bid), ''), 'doctor', dr),
    'tot', jsonb_build_object(
      'gross', coalesce((select sum(sum) from s), 0),
      'discount', coalesce((select sum(discount) from sd), 0),
      'discDocs', (select count(*) from sd where discount > 0),
      'retSum', coalesce((select sum(sum) from rt), 0),
      'sum', coalesce((select sum(sum) from sr), 0),
      'qty', coalesce((select sum(qty) from sr), 0),
      'soldQty', coalesce((select sum(qty) from s), 0),
      'retQty', coalesce((select sum(qty) from rt), 0),
      'docs', (select count(*) from sd),
      'retDocs', (select count(distinct doc_id) from rt),
      'clients', (select count(distinct apteka.norm(client)) from sd),
      'inQty', coalesce((select sum(qty) from a where type = 'Приход'), 0),
      'trQty', coalesce((select sum(qty) from a where type = 'Ўтказма'), 0),
      'cancelled', (select count(distinct doc_id) from r where status = 'Бекор')),
    'byBranch', (select coalesce(jsonb_object_agg(b.name, jsonb_build_object(
        'sum', coalesce(x.sm, 0), 'qty', coalesce(x.q, 0), 'docs', coalesce(x.dc, 0),
        'gross', coalesce(g.sm, 0), 'disc', coalesce(g.ds, 0), 'retSum', coalesce(rr.sm, 0), 'retQty', coalesce(rr.q, 0),
        'inQty', coalesce(i.q, 0), 'trIn', coalesce(ti.q, 0), 'trOut', coalesce(tou.q, 0))), '{}')
      from branches b
      left join (select branch_id, sum(sum) sm, sum(qty) q, count(distinct doc_id) filter (where sg > 0) dc from sr group by 1) x on x.branch_id = b.id
      left join (select branch_id, sum(gross) sm, sum(discount) ds from sd group by 1) g on g.branch_id = b.id
      left join (select branch_id, sum(sum) sm, sum(qty) q from rt group by 1) rr on rr.branch_id = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Приход' group by 1) i on i.branch_id = b.id
      left join (select to_branch_id bid2, sum(qty) q from a where type = 'Ўтказма' and coalesce(tr_state, 'accepted') = 'accepted' group by 1) ti on ti.bid2 = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Ўтказма' group by 1) tou on tou.branch_id = b.id
      where (bid is null or b.id = bid)
        and (b.active or x.branch_id is not null or i.branch_id is not null or ti.bid2 is not null or tou.branch_id is not null)),
    'byProduct', (select coalesce(jsonb_object_agg(product, jsonb_build_object('qty', q, 'sum', sm, 'ret', rq)), '{}')
      from (select product, sum(qty) q, sum(sum) sm, sum(case when sg < 0 then -qty else 0 end) rq from sr where product is not null group by 1) z),
    'byDoctor', (select coalesce(jsonb_object_agg(dn, jsonb_build_object('sum', sm, 'qty', q, 'docs', dc)), '{}')
      from (select coalesce(nullif(doctor, ''), '— (врачсиз)') dn, sum(sum) sm, sum(qty) q,
                   count(distinct doc_id) filter (where sg > 0) dc from sr group by 1) z),
    'byDay', (select coalesce(jsonb_object_agg(to_char(day, 'YYYY-MM-DD'), jsonb_build_object('sum', sm, 'docs', dc, 'qty', q)), '{}')
      from (select day, sum(sum) sm, count(distinct doc_id) filter (where sg > 0) dc, sum(qty) q from sr group by 1) z),
    'matrix', (select coalesce(jsonb_object_agg(product, m), '{}')
      from (select product, jsonb_object_agg(branch, q) m from (select product, branch, sum(qty) q from sr where product is not null group by 1, 2) y group by 1) z),
    'byPay', (select coalesce(jsonb_agg(jsonb_build_object('pay', pn, 'sum', sm, 'docs', dc) order by sm desc), '[]')
      from (select pn, sum(amt) sm, count(distinct doc_id) dc from bp group by 1) z),
    'discounts', (select coalesce(jsonb_agg(jsonb_build_object('doc', doc, 'date', to_char(day, 'YYYY-MM-DD'), 'time', tm,
          'branch', branch, 'client', client, 'op', op, 'gross', gross, 'disc', discount, 'note', dnote) order by day desc, doc_id desc), '[]')
      from (select * from sd where discount > 0 order by day desc, doc_id desc limit 1000) z),
    'debt', jsonb_build_object(
      'open', coalesce((select sum(left_amt) from v_debts where doc_status = 'Фаол' and left_amt > 0 and (bid is null or branch_id = bid)), 0),
      'openCount', (select count(*) from v_debts where doc_status = 'Фаол' and left_amt > 0 and (bid is null or branch_id = bid)),
      'given', coalesce((select sum(amount) from v_debts where doc_status = 'Фаол' and day <@ p and (bid is null or branch_id = bid)
                         and (dr = '' or doctor = dr)), 0),
      'paid', coalesce((select sum(amount) from fin where status = 'Фаол' and cat = 'Қарз тўлови' and day <@ p
                        and (bid is null or branch_id = bid)), 0)))
  into res;
  return res;
end $$;

create or replace function apteka.export(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare k text := coalesce((select value from settings where key = 'export_key'), '');
begin
  if k = '' or coalesce(req->>'key', '') <> k then
    perform pg_sleep(0.6);
    return jsonb_build_object('ok', false, 'error', 'Экспорт калити нотўғри');
  end if;
  return apteka.settings_json() || jsonb_build_object(
    'cfg', apteka.cfg(), 'stock', apteka.stock_json(), 'ver', (select ver from meta where id = 1),
    'at', to_char(now() at time zone 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI'),
    'rows', coalesce((select jsonb_agg(jsonb_build_array(v.doc, to_char(v.day, 'YYYY-MM-DD'), v.tm, v.type, v.branch, v.product, v.qty, v.price, v.sum,
        v.client, v.doctor, coalesce(v.to_name, ''), v.status, v.op_name,
        concat_ws(' · ',
          case when v.paytype <> '' then 'Тўлов: ' || apteka.pays_text(v.pays, v.paytype) end,
          case when v.discount > 0 then 'Чегирма (чек бўйича): ' || v.discount || coalesce(' — ' || nullif(v.discount_note, ''), '') end,
          case when v.ref_no is not null then 'Асос: ' || v.ref_no end,
          case when v.type = 'Ўтказма' then case v.tr_state when 'pending' then 'Тасдиқ кутилмоқда'
            when 'accepted' then nullif('Қабул қилди: ' || v.tr_by, 'Қабул қилди: ')
            when 'rejected' then 'Рад этди: ' || v.tr_by end end,
          nullif(v.note, ''),
          nullif(v.cancel_note, '')))
      order by v.doc_id, v.line_id) from v_rows v), '[]'));
end $$;

create or replace function apteka.handle(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare a text := coalesce(req->>'action', ''); u users; v bigint; h text; res jsonb;
begin
  if a = 'login' then return apteka.login(req); end if;
  if a = 'ping' then return jsonb_build_object('ok', true, 'v', 'supabase-5'); end if;
  if a = 'export' then return apteka.export(req); end if;

  select uu.* into u from sessions s join users uu on uu.id = s.user_id
  where s.token = coalesce(req->>'t', '') and s.expires_at > now() and uu.active;
  if u.id is null or (u.role <> 'admin' and not exists (select 1 from branches where id = u.branch_id and active)) then
    return jsonb_build_object('ok', false, 'auth', true, 'error', 'Сеанс тугади — қайта киринг');
  end if;

  if a = 'boot' then
    return jsonb_build_object('ok', true, 'user', apteka.pub_user(u), 'cfg', apteka.cfg()) || apteka.state(u);
  elsif a = 'sync' then
    v := (select ver from meta where id = 1);
    h := md5(apteka.cfg()::text);
    res := jsonb_build_object('ok', true, 'ver', v, 'cfgHash', h);
    if coalesce(req->>'cfgHash', '') <> h then res := res || jsonb_build_object('cfg', apteka.cfg()); end if;
    if coalesce(req->>'ver', '') = v::text and coalesce(req->>'cfgHash', '') = h then
      return res || '{"same": true}';
    end if;
    return res || jsonb_build_object('stock', apteka.stock_json(), 'today', apteka.today_rows(u), 'pending', apteka.pending_json(u));
  elsif a = 'sale' then return apteka.do_sale(u, req);
  elsif a = 'income' then return apteka.do_income(u, req);
  elsif a = 'transfer' then return apteka.do_transfer(u, req);
  elsif a = 'trAccept' then return apteka.tr_accept(u, req);
  elsif a = 'trReject' then return apteka.tr_reject(u, req);
  elsif a = 'return' then return apteka.do_return(u, req);
  elsif a = 'cancel' then return apteka.do_cancel(u, req);
  elsif a = 'history' then return apteka.history(u, req);
  elsif a = 'clients' then return apteka.clients(req);
  elsif a = 'saleLookup' then return apteka.sale_lookup(u, req);
  elsif a = 'debts' then return apteka.debts_list(u, req);
  elsif a = 'debtPay' then return apteka.debt_pay(u, req);
  elsif a = 'debtEdit' then return apteka.debt_edit(u, req);
  elsif a = 'finAdd' then return apteka.fin_manual(u, req);
  elsif a = 'finCancel' then return apteka.fin_cancel(u, req);
  elsif a = 'finance' then return apteka.finance(u, req);
  end if;

  if u.role <> 'admin' then perform apteka.fail('Фақат админ учун'); end if;
  if a = 'report' then return apteka.report(req);
  elsif a = 'exportRows' then return apteka.export_rows(req);
  elsif a = 'settings' then return apteka.settings_json();
  elsif a = 'save' then
    if req->>'kind' in ('paytype', 'fincat') then return apteka.save_fin_settings(u, req); end if;
    res := apteka.save_settings(u, req);
    if req->>'kind' = 'user' then
      -- кассир телефони (чекда чиқади)
      update users set phone = apteka.clean(req->'item'->>'phone', 40)
      where lower(name) = lower(apteka.clean(req->'item'->>'name', 150));
      res := apteka.settings_json();
    end if;
    return res;
  end if;
  perform apteka.fail('Номаълум амал: ' || a);
  return null;
end $$;
