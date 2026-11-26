-- 09: Бўлиб тўлаш — битта чек бир нечта тўлов турида (нақд + карта, карта + қарз ...).
-- docs.pays = [{pay, amount, kind}], docs.paytype — ёрлиқ («Нақд + Карта»). Эски чекларда pays бўш.

alter table apteka.docs add column if not exists pays jsonb;

create or replace view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note, rd.no as ref_no,
       d.paytype, d.discount, d.discount_note, coalesce(ou.phone, '') as op_phone, d.pays
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
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

create or replace function apteka.pays_text(pays jsonb, paytype text) returns text
language sql immutable set search_path = pg_catalog as $$
  select case when pays is not null and jsonb_array_length(pays) > 1
    then (select string_agg((p->>'pay') || ' ' || (p->>'amount'), ' + ' order by o) from jsonb_array_elements(pays) with ordinality t(p, o))
    else coalesce(paytype, '') end
$$;

create or replace function apteka.do_sale(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r jsonb; bid int; raw jsonb; items jsonb := '[]'; d docs; x jsonb;
  client text := apteka.clean(req->>'client', 120);
  doctor text := apteka.clean(req->>'doctor', 120);
  pay text := apteka.clean(req->>'pay', 60);
  pk text; total numeric := 0; disc numeric := 0; net numeric;
  dnote text := apteka.clean(req->>'discountNote', 300);
  debt_note text := apteka.clean(req->>'debtNote', 300);
  due date; v_pays jsonb := '[]'; psum numeric := 0; debt_amt numeric := 0; pn text; pkd text; amt numeric; seen text[] := '{}'; plabel text;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  if client = '' then perform apteka.fail('Мижоз Ф.И.Ш ни ёзинг'); end if;
  if pay = '' then pay := apteka.cash_pay(); end if;  -- эски версиядаги иловалар учун
  select kind into pk from pay_types where name = pay and active;
  if pk is null then perform apteka.fail('Тўлов турини танланг'); end if;
  raw := apteka.norm_items(req->'items', true);
  for x in select value from jsonb_array_elements(raw) loop
    -- сотувда нарх ўзгармайди: ҳамма (админ ҳам) Созламалардаги нархда сотади
    if coalesce((x->>'lp')::numeric, 0) <= 0 then
      perform apteka.fail('«' || (x->>'name') || '»: нархи қўйилмаган — Созламалар → Маҳсулотларда нарх қўйинг');
    end if;
    x := x || jsonb_build_object('price', (x->>'lp')::numeric);
    x := x || jsonb_build_object('sum', (x->>'price')::numeric * (x->>'qty')::int);
    items := items || jsonb_build_array(x);
    total := total + (x->>'sum')::numeric;
  end loop;

  if coalesce(req->>'discount', '') not in ('', '0') then
    if (req->>'discount') !~ '^\d{1,14}$' then perform apteka.fail('Чегирма суммаси нотўғри'); end if;
    disc := (req->>'discount')::numeric;
  end if;
  if disc > 0 then
    if disc > total then perform apteka.fail('Чегирма сотув суммасидан (' || total || ') катта бўлмасин'); end if;
    if dnote = '' then perform apteka.fail('Чегирма сабабини ёзинг'); end if;
  else
    dnote := '';
  end if;
  net := total - disc;

  -- бўлиб тўлаш: v_pays = [{pay, amount}], йиғиндиси чек суммасига тенг
  if jsonb_typeof(req->'pays') = 'array' and jsonb_array_length(req->'pays') > 0 then
    for x in select value from jsonb_array_elements(req->'pays') loop
      pn := apteka.clean(x->>'pay', 60);
      if coalesce(x->>'amount', '') !~ '^\d{1,14}$' then perform apteka.fail('«' || pn || '»: сумма нотўғри'); end if;
      amt := (x->>'amount')::numeric;
      if amt = 0 then continue; end if;
      select kind into pkd from pay_types where name = pn and active;
      if pkd is null then perform apteka.fail('Тўлов тури топилмади: ' || pn); end if;
      if pn = any(seen) then perform apteka.fail('«' || pn || '» икки марта ёзилган'); end if;
      seen := seen || pn;
      v_pays := v_pays || jsonb_build_array(jsonb_build_object('pay', pn, 'amount', amt, 'kind', pkd));
      psum := psum + amt;
    end loop;
    if psum <> net then
      perform apteka.fail('Тўловлар йиғиндиси (' || psum || ') чек суммасига (' || net || ') тенг бўлсин');
    end if;
  elsif net > 0 then
    v_pays := jsonb_build_array(jsonb_build_object('pay', pay, 'amount', net, 'kind', pk));
  end if;
  select coalesce(sum((p->>'amount')::numeric), 0) into debt_amt from jsonb_array_elements(v_pays) p where p->>'kind' = 'debt';
  select coalesce(string_agg(p->>'pay', ' + ' order by o), pay) into plabel from jsonb_array_elements(v_pays) with ordinality t(p, o);

  if debt_amt > 0 then
    if debt_note = '' then perform apteka.fail('Қарз учун изоҳ ёзинг (масалан: телефони, қачон тўлайди)'); end if;
    if coalesce(req->>'due', '') <> '' then
      if (req->>'due') !~ '^\d{4}-\d{2}-\d{2}$' then perform apteka.fail('Тўлаш санаси нотўғри'); end if;
      due := (req->>'due')::date;
      if due < apteka.today() then perform apteka.fail('Тўлаш санаси бугундан олдин бўлмасин'); end if;
    end if;
  elsif pk = 'debt' and jsonb_array_length(v_pays) = 0 then
    perform apteka.fail('Қарзга сотиш учун сумма 0 дан катта бўлсин');
  end if;

  perform apteka.check_avail(bid, items);
  d := apteka.new_doc(u, 'Расход', bid, null, client, doctor, req, items);
  update docs set paytype = plabel, pays = case when jsonb_array_length(v_pays) > 0 then v_pays end,
                  discount = disc, discount_note = dnote where id = d.id;
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, -(x->>'qty')::int);
  end loop;
  if debt_amt > 0 then
    insert into debts(doc_id, branch_id, client, amount, due, note) values (d.id, bid, client, debt_amt, due, debt_note);
  end if;
  for x in select value from jsonb_array_elements(v_pays) loop
    if x->>'kind' <> 'debt' then
      perform apteka.fin_add(u, bid, 'in', 'Сотув', '', x->>'pay', (x->>'amount')::numeric, client || ' · ' || d.no, d.id, null, null);
    end if;
  end loop;
  if doctor <> '' and not exists (select 1 from doctors where apteka.norm(name) = apteka.norm(doctor)) then
    insert into doctors(name, note) values (doctor, 'сотувдан қўшилди') on conflict do nothing;
  end if;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'total', net, 'gross', total, 'discount', disc, 'debt', debt_amt > 0,
                            'debtAmount', debt_amt, 'pays', v_pays)
         || apteka.state(u);
end $$;

create or replace function apteka.do_return(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  r jsonb; bid int; od docs; d docs; it jsonb; ol doc_lines; pname text;
  ret int; q int; sm numeric; maxsm numeric; i int := 0; otot numeric;
  reason text := apteka.clean(req->>'reason', 300);
  lines jsonb := '[]'; seen bigint[] := '{}'; total numeric := 0;
  dbt_id bigint; dleft numeric; cut numeric := 0; refund numeric; rpay text;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  select * into od from docs where no = apteka.clean(req->>'ref', 40) for update;
  if od.id is null or od.type <> 'Расход' then perform apteka.fail('Сотув ҳужжати топилмади'); end if;
  bid := od.branch_id;
  if u.role <> 'admin' and u.branch_id <> bid then
    perform apteka.fail('Бу сотув «' || (select name from branches where id = bid) || '»да қилинган — қайтариш ўша филиалда қилинади');
  end if;
  if od.status <> 'Фаол' then perform apteka.fail('Бу сотув бекор қилинган — қайтариб бўлмайди'); end if;
  if reason = '' then perform apteka.fail('Қайтариш сабабини ёзинг'); end if;
  if req->'items' is null or jsonb_typeof(req->'items') <> 'array' then perform apteka.fail('Қайтариладиган маҳсулотни танланг'); end if;
  select coalesce(sum(sum), 0) into otot from doc_lines where doc_id = od.id;
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
    -- чегирма бўлса, қатор улушига қараб камаяди
    maxsm := case when otot > 0 then round(coalesce(ol.sum, 0) * (otot - od.discount) / otot * q / ol.qty) else 0 end;
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

  -- қарзга сотилган бўлса: аввал қолган қарз камаяди
  select id into dbt_id from debts where doc_id = od.id for update;
  if dbt_id is not null then
    select greatest(left_amt, 0) into dleft from v_debts where id = dbt_id;
    cut := least(total, coalesce(dleft, 0));
  end if;
  refund := total - cut;
  -- пулни қайси турда қайтариш: аввал нақд қисм, кейин бошқа (қарз эмас) қисм, эски чекларда — чекнинг тўлов тури
  rpay := coalesce(
    (select p->>'pay' from jsonb_array_elements(coalesce(od.pays, '[]')) with ordinality t(p, o)
     left join pay_types pt on pt.name = p->>'pay'
     where coalesce(pt.kind, '') <> 'debt' order by (pt.kind = 'cash') desc, o limit 1),
    case when od.pays is null and od.paytype <> '' and coalesce((select kind from pay_types where name = od.paytype), '') not in ('', 'debt')
         then od.paytype end,
    apteka.cash_pay());

  insert into docs(no, type, branch_id, client, doctor, note, op_name, user_id, day, rid, ref_doc_id, paytype, debt_cut)
  values ('Қ-' || nextval('apteka.doc_seq'), 'Қайтариш', bid, od.client, od.doctor, reason, u.name, u.id,
          apteka.today(), nullif(apteka.clean(req->>'rid', 80), ''), od.id,
          case when refund > 0 then rpay else od.paytype end, cut)
  returning * into d;
  insert into doc_lines(doc_id, product_id, qty, price, sum, ref_line_id)
  select d.id, (x->>'pid')::int, (x->>'qty')::int, (x->>'price')::numeric, (x->>'sum')::numeric, (x->>'ref')::bigint
  from jsonb_array_elements(lines) with ordinality t(x, n) order by n;
  for it in select value from jsonb_array_elements(lines) loop
    perform apteka.add_stock(bid, (it->>'pid')::int, (it->>'qty')::int);
  end loop;
  if refund > 0 then
    perform apteka.fin_add(u, bid, 'out', 'Қайтариш', '', rpay, refund, od.client || ' · ' || od.no || ' → ' || d.no, d.id, null, null);
  end if;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'total', total, 'debtCut', cut, 'refund', refund, 'refundPay', rpay)
         || apteka.state(u);
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
      left join (select to_branch_id bid2, sum(qty) q from a where type = 'Ўтказма' group by 1) ti on ti.bid2 = b.id
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
      coalesce(v.ref_no, ''), apteka.pays_text(v.pays, v.paytype),
      case when v.ln = 1 and v.discount > 0 then v.discount end,
      case when v.ln = 1 then v.discount_note else '' end)
    order by v.doc_id, v.line_id) filter (where v.rn <= 100000), '[]')
  into cnt, res
  from (
    select x.*, row_number() over (order by x.doc_id, x.line_id) rn,
           row_number() over (partition by x.doc_id order by x.line_id) ln
    from v_rows x
    where x.day <@ p
      and (bid is null or x.branch_id = bid or x.to_branch_id = bid)
      and (dr = '' or x.doctor = dr)
      and (typ = '' or x.type = typ)
  ) v;
  return jsonb_build_object('ok', true, 'rows', res, 'total', cnt);
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
          nullif(v.note, ''),
          nullif(v.cancel_note, '')))
      order by v.doc_id, v.line_id) from v_rows v), '[]'));
end $$;

create or replace function apteka.sale_lookup(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  q text := apteka.clean(req->>'q', 120);
  dn text := '';
  sk text;
  res jsonb;
  bid int;
begin
  -- сотувчи фақат ўз филиали сотувларини кўради; админ — танланган филиални (танламаса ҳаммасини)
  if u.role <> 'admin' then bid := u.branch_id;
  elsif apteka.clean(req->>'branch') <> '' then select id into bid from branches where name = apteka.clean(req->>'branch');
  end if;
  if length(q) < 1 then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  if q ~ '^\s*[CcСс]?\s*-?\s*\d+\s*$' then dn := regexp_replace(q, '\D', '', 'g'); end if;
  if dn = '' and length(q) < 2 then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  sk := apteka.skel(q);
  select coalesce(jsonb_agg(x.j order by x.id desc), '[]') into res from (
    select d.id, jsonb_build_object(
      'doc', d.no, 'date', to_char(d.day, 'YYYY-MM-DD'),
      'time', to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI'),
      'branch', b.name, 'client', d.client, 'doctor', d.doctor, 'op', d.op_name,
      'pay', d.paytype, 'pays', coalesce(d.pays, '[]'::jsonb), 'discount', d.discount,
      'lines', (select jsonb_agg(jsonb_build_object(
          'id', l.id, 'product', p.name, 'qty', l.qty, 'price', l.price, 'sum', l.sum,
          'returned', coalesce((select sum(rl.qty) from doc_lines rl join docs rd on rd.id = rl.doc_id
                                where rl.ref_line_id = l.id and rd.status = 'Фаол'), 0)) order by l.id)
        from doc_lines l join products p on p.id = l.product_id where l.doc_id = d.id)) as j
    from docs d join branches b on b.id = d.branch_id
    where d.type = 'Расход' and d.status = 'Фаол' and (bid is null or d.branch_id = bid) and d.day >= apteka.today() - 365
      and ((dn <> '' and d.no = 'С-' || dn) or (dn = '' and position(sk in apteka.skel(d.client)) > 0))
    order by d.id desc
    limit 20
  ) x;
  return jsonb_build_object('ok', true, 'rows', res);
end $$;
