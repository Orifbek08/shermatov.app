-- Қайтариш (мижоз олиб кетган маҳсулотни тўлиқ ёки қисман қайтариши) + ҳисобот филтрлари + Excel учун экспорт
-- Фақат қўшимча: мавжуд маълумот ўзгармайди.

alter table apteka.docs drop constraint if exists docs_type_check;
alter table apteka.docs add constraint docs_type_check check (type in ('Приход', 'Расход', 'Ўтказма', 'Қайтариш'));
alter table apteka.docs add column if not exists ref_doc_id bigint references apteka.docs(id);
alter table apteka.doc_lines add column if not exists ref_line_id bigint references apteka.doc_lines(id);
create index if not exists docs_ref_doc_id_idx on apteka.docs(ref_doc_id) where ref_doc_id is not null;
create index if not exists doc_lines_ref_line_id_idx on apteka.doc_lines(ref_line_id) where ref_line_id is not null;
create index if not exists docs_type_day_idx on apteka.docs(type, day);

create or replace view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note, rd.no as ref_no
from apteka.docs d
join apteka.doc_lines l on l.doc_id = d.id
join apteka.products p on p.id = l.product_id
join apteka.branches b on b.id = d.branch_id
left join apteka.branches tb on tb.id = d.to_branch_id
left join apteka.docs rd on rd.id = d.ref_doc_id;

create or replace function apteka.rowj(r apteka.v_rows) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'doc', r.doc, 'date', to_char(r.day, 'YYYY-MM-DD'), 'time', r.tm, 'type', r.type,
    'branch', r.branch, 'product', r.product, 'qty', r.qty, 'price', r.price, 'sum', r.sum,
    'client', r.client, 'doctor', r.doctor, 'to', coalesce(r.to_name, ''), 'status', r.status, 'op', r.op_name,
    'ref', coalesce(r.ref_no, ''),
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

/* Қайтариш учун сотувни топиш: чек рақами (С-12 ёки 12) ёки мижоз исми бўйича, ҳамма филиаллардан */
create or replace function apteka.sale_lookup(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  q text := apteka.clean(req->>'q', 120);
  dn text := '';
  sk text;
  res jsonb;
begin
  if length(q) < 1 then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  if q ~ '^\s*[CcСс]?\s*-?\s*\d+\s*$' then dn := regexp_replace(q, '\D', '', 'g'); end if;
  if dn = '' and length(q) < 2 then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  sk := apteka.skel(q);
  select coalesce(jsonb_agg(x.j order by x.id desc), '[]') into res from (
    select d.id, jsonb_build_object(
      'doc', d.no, 'date', to_char(d.day, 'YYYY-MM-DD'),
      'time', to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI'),
      'branch', b.name, 'client', d.client, 'doctor', d.doctor, 'op', d.op_name,
      'lines', (select jsonb_agg(jsonb_build_object(
          'id', l.id, 'product', p.name, 'qty', l.qty, 'price', l.price, 'sum', l.sum,
          'returned', coalesce((select sum(rl.qty) from doc_lines rl join docs rd on rd.id = rl.doc_id
                                where rl.ref_line_id = l.id and rd.status = 'Фаол'), 0)) order by l.id)
        from doc_lines l join products p on p.id = l.product_id where l.doc_id = d.id)) as j
    from docs d join branches b on b.id = d.branch_id
    where d.type = 'Расход' and d.status = 'Фаол' and d.day >= apteka.today() - 365
      and ((dn <> '' and d.no = 'С-' || dn) or (dn = '' and position(sk in apteka.skel(d.client)) > 0))
    order by d.id desc
    limit 20
  ) x;
  return jsonb_build_object('ok', true, 'rows', res);
end $$;

/* Қайтаришни расмийлаштириш: қолдиқ қабул қилган филиалга қўшилади */
create or replace function apteka.do_return(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  r jsonb; bid int; od docs; d docs; it jsonb; ol doc_lines; pname text;
  ret int; q int; sm numeric; maxsm numeric; i int := 0;
  reason text := apteka.clean(req->>'reason', 300);
  lines jsonb := '[]'; seen bigint[] := '{}'; total numeric := 0;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  select * into od from docs where no = apteka.clean(req->>'ref', 40) for update;
  if od.id is null or od.type <> 'Расход' then perform apteka.fail('Сотув ҳужжати топилмади'); end if;
  if od.status <> 'Фаол' then perform apteka.fail('Бу сотув бекор қилинган — қайтариб бўлмайди'); end if;
  if reason = '' then perform apteka.fail('Қайтариш сабабини ёзинг'); end if;
  if req->'items' is null or jsonb_typeof(req->'items') <> 'array' then perform apteka.fail('Қайтариладиган маҳсулотни танланг'); end if;
  for it in select value from jsonb_array_elements(req->'items') loop
    i := i + 1;
    if coalesce(it->>'qty', '') !~ '^\d{1,7}$' then perform apteka.fail(i || '-қатор: сони нотўғри'); end if;
    q := (it->>'qty')::int;
    if q = 0 then continue; end if;
    if coalesce(it->>'line', '') !~ '^\d{1,18}$' then perform apteka.fail(i || '-қатор: қатор кўрсатилмаган'); end if;
    select * into ol from doc_lines where id = (it->>'line')::bigint and doc_id = od.id;
    if ol.id is null then perform apteka.fail(i || '-қатор: бу сотувда йўқ'); end if;
    if ol.id = any(seen) then perform apteka.fail(i || '-қатор: такрорланган'); end if;
    seen := seen || ol.id;
    select name into pname from products where id = ol.product_id;
    select coalesce(sum(rl.qty), 0) into ret from doc_lines rl join docs rd on rd.id = rl.doc_id
    where rl.ref_line_id = ol.id and rd.status = 'Фаол';
    if q > ol.qty - ret then
      perform apteka.fail('«' || pname || '»: кўпи билан ' || (ol.qty - ret) || ' дона қайтариш мумкин');
    end if;
    maxsm := round(coalesce(ol.sum, 0) * q / ol.qty);
    if coalesce(it->>'sum', '') = '' then sm := maxsm;
    elsif (it->>'sum') ~ '^\d{1,14}(\.\d+)?$' then sm := round((it->>'sum')::numeric);
    else perform apteka.fail('«' || pname || '»: сумма нотўғри'); end if;
    if sm > maxsm then
      perform apteka.fail('«' || pname || '»: қайтариладиган сумма ' || maxsm || ' дан ошмасин');
    end if;
    lines := lines || jsonb_build_array(jsonb_build_object('pid', ol.product_id, 'qty', q, 'price', ol.price, 'sum', sm, 'ref', ol.id));
    total := total + sm;
  end loop;
  if jsonb_array_length(lines) = 0 then perform apteka.fail('Қайтариладиган маҳсулот сонини ёзинг'); end if;

  insert into docs(no, type, branch_id, client, doctor, note, op_name, user_id, day, rid, ref_doc_id)
  values ('Қ-' || nextval('apteka.doc_seq'), 'Қайтариш', bid, od.client, od.doctor, reason, u.name, u.id,
          apteka.today(), nullif(apteka.clean(req->>'rid', 80), ''), od.id)
  returning * into d;
  insert into doc_lines(doc_id, product_id, qty, price, sum, ref_line_id)
  select d.id, (x->>'pid')::int, (x->>'qty')::int, (x->>'price')::numeric, (x->>'sum')::numeric, (x->>'ref')::bigint
  from jsonb_array_elements(lines) with ordinality t(x, n) order by n;
  for it in select value from jsonb_array_elements(lines) loop
    perform apteka.add_stock(bid, (it->>'pid')::int, (it->>'qty')::int);
  end loop;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'total', total) || apteka.state(u);
end $$;

/* Бекор қилиш: қайтаришни ҳам; қайтариш қилинган сотувни аввал қайтаришсиз бекор қилиб бўлмайди */
create or replace function apteka.do_cancel(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; reason text := apteka.clean(req->>'reason', 300); rec record; have int; bname text; pname text; rets text;
begin
  select * into d from docs where no = apteka.clean(req->>'doc', 40) for update;
  if d.id is null then perform apteka.fail('Ҳужжат топилмади: ' || coalesce(req->>'doc', '')); end if;
  if reason = '' then perform apteka.fail('Бекор қилиш сабабини ёзинг'); end if;
  if d.status = 'Бекор' then perform apteka.fail('Бу ҳужжат аллақачон бекор қилинган'); end if;
  if u.role <> 'admin' then
    if d.branch_id <> u.branch_id then
      perform apteka.fail('Бу ҳужжатни фақат «' || (select name from branches where id = d.branch_id) || '» ёки админ бекор қила олади');
    end if;
    if d.day <> apteka.today() then perform apteka.fail('Фақат бугунги ҳужжатни бекор қилиш мумкин — админга мурожаат қилинг'); end if;
  end if;
  if d.type = 'Расход' then
    select string_agg(no, ', ' order by id) into rets from docs where ref_doc_id = d.id and status = 'Фаол';
    if rets is not null then
      perform apteka.fail('Бу сотувга қайтариш қилинган (' || rets || '). Аввал қайтаришни бекор қилинг');
    end if;
  end if;
  for rec in
    select bid, pid, sum(delta)::int as delta from (
      select d.branch_id as bid, l.product_id as pid,
             case d.type when 'Приход' then -l.qty when 'Қайтариш' then -l.qty else l.qty end as delta
      from doc_lines l where l.doc_id = d.id
      union all
      select d.to_branch_id, l.product_id, -l.qty from doc_lines l where l.doc_id = d.id and d.type = 'Ўтказма'
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
  update docs set status = 'Бекор',
    cancel_note = 'Бекор: ' || reason || ' (' || u.name || ', ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ')'
  where id = d.id;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'cancelled', true) || apteka.state(u);
end $$;

/* Ҳисобот: филиал ва врач филтри, қайтариш айрилган соф тушум */
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
  sr as (
    select branch, branch_id, product, doctor, day, doc_id, qty, sum, 1 as sg from s
    union all
    select branch, branch_id, product, doctor, day, doc_id, -qty, -sum, -1 from rt
  )
  select jsonb_build_object('ok', true, 'from', lower(p), 'to', upper(p) - 1,
    'filter', jsonb_build_object('branch', coalesce((select name from branches where id = bid), ''), 'doctor', dr),
    'tot', jsonb_build_object(
      'gross', coalesce((select sum(sum) from s), 0),
      'retSum', coalesce((select sum(sum) from rt), 0),
      'sum', coalesce((select sum(sum) from sr), 0),
      'qty', coalesce((select sum(qty) from sr), 0),
      'soldQty', coalesce((select sum(qty) from s), 0),
      'retQty', coalesce((select sum(qty) from rt), 0),
      'docs', (select count(distinct doc_id) from s),
      'retDocs', (select count(distinct doc_id) from rt),
      'clients', (select count(distinct apteka.norm(client)) from s),
      'inQty', coalesce((select sum(qty) from a where type = 'Приход'), 0),
      'trQty', coalesce((select sum(qty) from a where type = 'Ўтказма'), 0),
      'cancelled', (select count(distinct doc_id) from r where status = 'Бекор')),
    'byBranch', (select coalesce(jsonb_object_agg(b.name, jsonb_build_object(
        'sum', coalesce(x.sm, 0), 'qty', coalesce(x.q, 0), 'docs', coalesce(x.dc, 0),
        'gross', coalesce(g.sm, 0), 'retSum', coalesce(rr.sm, 0), 'retQty', coalesce(rr.q, 0),
        'inQty', coalesce(i.q, 0), 'trIn', coalesce(ti.q, 0), 'trOut', coalesce(tou.q, 0))), '{}')
      from branches b
      left join (select branch_id, sum(sum) sm, sum(qty) q, count(distinct doc_id) filter (where sg > 0) dc from sr group by 1) x on x.branch_id = b.id
      left join (select branch_id, sum(sum) sm from s group by 1) g on g.branch_id = b.id
      left join (select branch_id, sum(sum) sm, sum(qty) q from rt group by 1) rr on rr.branch_id = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Приход' group by 1) i on i.branch_id = b.id
      left join (select to_branch_id bid2, sum(qty) q from a where type = 'Ўтказма' group by 1) ti on ti.bid2 = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Ўтказма' group by 1) tou on tou.branch_id = b.id
      where (bid is null or b.id = bid)
        and (b.active or x.branch_id is not null or i.branch_id is not null or ti.bid2 is not null or tou.branch_id is not null)),
    'byProduct', (select coalesce(jsonb_object_agg(product, jsonb_build_object('qty', q, 'sum', sm, 'ret', rq)), '{}')
      from (select product, sum(qty) q, sum(sum) sm, sum(case when sg < 0 then -qty else 0 end) rq from sr group by 1) z),
    'byDoctor', (select coalesce(jsonb_object_agg(dn, jsonb_build_object('sum', sm, 'qty', q, 'docs', dc)), '{}')
      from (select coalesce(nullif(doctor, ''), '— (врачсиз)') dn, sum(sum) sm, sum(qty) q,
                   count(distinct doc_id) filter (where sg > 0) dc from sr group by 1) z),
    'byDay', (select coalesce(jsonb_object_agg(to_char(day, 'YYYY-MM-DD'), jsonb_build_object('sum', sm, 'docs', dc, 'qty', q)), '{}')
      from (select day, sum(sum) sm, count(distinct doc_id) filter (where sg > 0) dc, sum(qty) q from sr group by 1) z),
    'matrix', (select coalesce(jsonb_object_agg(product, m), '{}')
      from (select product, jsonb_object_agg(branch, q) m from (select product, branch, sum(qty) q from sr group by 1, 2) y group by 1) z))
  into res;
  return res;
end $$;

/* Excel учун батафсил қаторлар (админ): давр, филиал, врач, тур филтрлари */
create or replace function apteka.export_rows(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare p daterange := apteka.period(req, 400); bid int; dr text := apteka.clean(req->>'doctor', 120); typ text := apteka.clean(req->>'type');
  cnt int; res jsonb;
begin
  if apteka.clean(req->>'branch') <> '' then
    select id into bid from branches where name = apteka.clean(req->>'branch');
    if bid is null then perform apteka.fail('Филиал топилмади'); end if;
  end if;
  select count(*), coalesce(jsonb_agg(jsonb_build_array(
      to_char(v.day, 'YYYY-MM-DD'), v.tm, v.doc, v.type, v.branch, coalesce(v.to_name, ''), v.product,
      v.qty, v.price, v.sum, v.client, v.doctor, v.status, v.op_name,
      case when v.cancel_note <> '' then case when v.note <> '' then v.note || ' · ' || v.cancel_note else v.cancel_note end else v.note end,
      coalesce(v.ref_no, ''))
    order by v.doc_id, v.line_id) filter (where v.rn <= 100000), '[]')
  into cnt, res
  from (
    select x.*, row_number() over (order by x.doc_id, x.line_id) rn from v_rows x
    where x.day <@ p
      and (bid is null or x.branch_id = bid or x.to_branch_id = bid)
      and (dr = '' or x.doctor = dr)
      and (typ = '' or x.type = typ)
  ) v;
  return jsonb_build_object('ok', true, 'rows', res, 'total', cnt);
end $$;

/* Google Sheets нусхаси: қайтаришда асос ҳужжат изоҳга ёзилади */
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
          case when v.ref_no is not null then 'Асос: ' || v.ref_no end,
          nullif(v.note, ''),
          nullif(v.cancel_note, '')))
      order by v.doc_id, v.line_id) from v_rows v), '[]'));
end $$;

create or replace function apteka.handle(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare a text := coalesce(req->>'action', ''); u users; v bigint; h text; res jsonb;
begin
  if a = 'login' then return apteka.login(req); end if;
  if a = 'ping' then return jsonb_build_object('ok', true, 'v', 'supabase-2'); end if;
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
    return res || jsonb_build_object('stock', apteka.stock_json(), 'today', apteka.today_rows(u));
  elsif a = 'sale' then return apteka.do_sale(u, req);
  elsif a = 'income' then return apteka.do_income(u, req);
  elsif a = 'transfer' then return apteka.do_transfer(u, req);
  elsif a = 'return' then return apteka.do_return(u, req);
  elsif a = 'cancel' then return apteka.do_cancel(u, req);
  elsif a = 'history' then return apteka.history(u, req);
  elsif a = 'clients' then return apteka.clients(req);
  elsif a = 'saleLookup' then return apteka.sale_lookup(req);
  end if;

  if u.role <> 'admin' then perform apteka.fail('Фақат админ учун'); end if;
  if a = 'report' then return apteka.report(req);
  elsif a = 'exportRows' then return apteka.export_rows(req);
  elsif a = 'settings' then return apteka.settings_json();
  elsif a = 'save' then return apteka.save_settings(u, req);
  end if;
  perform apteka.fail('Номаълум амал: ' || a);
  return null;
end $$;
