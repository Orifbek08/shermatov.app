-- Server mantig'i (Code.gs ўрнига). Ҳар амал битта транзакцияда.

create or replace function apteka.fail(msg text) returns void
language plpgsql set search_path = pg_catalog as $$
begin
  raise exception using errcode = 'P0001', message = msg;
end $$;

create or replace function apteka.today() returns date
language sql stable set search_path = pg_catalog as $$ select (now() at time zone 'Asia/Tashkent')::date $$;

create or replace function apteka.norm(t text) returns text
language sql immutable set search_path = pg_catalog as $$ select lower(translate(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), 'ʻʼ''`‘’', '')) $$;

create or replace function apteka.clean(t text, maxlen int default 200) returns text
language sql immutable set search_path = pg_catalog as $$ select left(btrim(regexp_replace(coalesce(t, ''), '\s+', ' ', 'g')), maxlen) $$;

create or replace function apteka.bump() returns bigint
language sql set search_path = pg_catalog as $$ update apteka.meta set ver = ver + 1 where id = 1 returning ver $$;

create or replace function apteka.cfg() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object(
    'name', coalesce((select value from settings where key = 'name'), 'Др. Шерматов дорихоналари'),
    'currency', coalesce((select value from settings where key = 'currency'), 'сўм'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'price', price, 'unit', unit, 'min', min_qty, 'note', note) order by sort, id) from products where active), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'addr', addr, 'phone', phone) order by sort, id) from branches where active), '[]'),
    'doctors', coalesce((select jsonb_agg(name order by name) from doctors where active), '[]'))
$$;

create or replace function apteka.stock_json() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select coalesce(jsonb_object_agg(b.name, x.obj), '{}')
  from branches b
  cross join lateral (
    select coalesce(jsonb_object_agg(p.name, coalesce(s.qty, 0)), '{}') as obj
    from products p left join stock s on s.branch_id = b.id and s.product_id = p.id
    where p.active
  ) x
  where b.active
$$;

create or replace function apteka.rowj(r apteka.v_rows) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'doc', r.doc, 'date', to_char(r.day, 'YYYY-MM-DD'), 'time', r.tm, 'type', r.type,
    'branch', r.branch, 'product', r.product, 'qty', r.qty, 'price', r.price, 'sum', r.sum,
    'client', r.client, 'doctor', r.doctor, 'to', coalesce(r.to_name, ''), 'status', r.status, 'op', r.op_name,
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

create or replace function apteka.pub_user(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('name', u.name, 'role', u.role,
    'branch', case when u.role = 'admin' then '' else coalesce((select name from branches where id = u.branch_id), '') end)
$$;

create or replace function apteka.today_rows(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select coalesce(jsonb_agg(apteka.rowj(v) order by v.doc_id, v.line_id), '[]')
  from v_rows v
  where v.day = apteka.today()
    and (u.role = 'admin' or v.branch_id = u.branch_id or v.to_branch_id = u.branch_id)
$$;

create or replace function apteka.state(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('ver', (select ver from meta where id = 1), 'cfgHash', md5(apteka.cfg()::text),
    'stock', apteka.stock_json(), 'today', apteka.today_rows(u))
$$;

/* ───────── kirish ───────── */

create or replace function apteka.login(req jsonb) returns jsonb
language plpgsql set search_path = apteka, extensions, pg_catalog as $$
declare
  p text := btrim(coalesce(req->>'pin', ''));
  u users;
  tok text;
begin
  if p <> '' then
    select * into u from users where active and pin_hash = crypt(p, pin_hash) order by id limit 1;
  end if;
  if u.id is null then
    perform pg_sleep(0.6);
    return jsonb_build_object('ok', false, 'error', 'PIN нотўғри');
  end if;
  if u.role <> 'admin' and not exists (select 1 from branches where id = u.branch_id and active) then
    return jsonb_build_object('ok', false, 'error', 'Бу фойдаланувчига филиал бириктирилмаган — админга мурожаат қилинг');
  end if;
  tok := encode(gen_random_bytes(24), 'hex');
  insert into sessions(token, user_id, expires_at) values (tok, u.id, now() + interval '30 days');
  delete from sessions where expires_at < now();
  return jsonb_build_object('ok', true, 'token', tok, 'user', apteka.pub_user(u), 'cfg', apteka.cfg()) || apteka.state(u);
end $$;

/* ───────── yozish yordamchilari ───────── */

create or replace function apteka.op_branch(u apteka.users, b text) returns int
language plpgsql set search_path = apteka, pg_catalog as $$
declare bid int; nm text := apteka.clean(b);
begin
  if u.role <> 'admin' then
    if nm <> '' and nm <> (select name from branches where id = u.branch_id) then
      perform apteka.fail('Сиз фақат «' || (select name from branches where id = u.branch_id) || '» учун ёза оласиз');
    end if;
    return u.branch_id;
  end if;
  if nm = '' then perform apteka.fail('Филиални танланг'); end if;
  select id into bid from branches where name = nm and active;
  if bid is null then perform apteka.fail('Филиал топилмади: ' || nm); end if;
  return bid;
end $$;

-- [{pid, name, qty, price, sum}]
create or replace function apteka.norm_items(items jsonb, with_price boolean) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  it jsonb; i int := 0; nm text; pid int; pprice numeric; q int; pr numeric; sm numeric;
  out jsonb := '[]';
begin
  if items is null or jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    perform apteka.fail('Камида битта маҳсулот қўшинг');
  end if;
  if jsonb_array_length(items) > 200 then perform apteka.fail('Битта ҳужжатда кўпи билан 200 қатор'); end if;
  for it in select value from jsonb_array_elements(items) loop
    i := i + 1;
    nm := apteka.clean(it->>'product', 200);
    pid := null;
    select id, price into pid, pprice from products where name = nm and active;
    if pid is null then perform apteka.fail(i || '-қатор: маҳсулот танланмаган ёки топилмади'); end if;
    if coalesce(it->>'qty', '') !~ '^\d{1,7}$' or (it->>'qty')::int <= 0 or (it->>'qty')::int > 1000000 then
      perform apteka.fail('«' || nm || '»: сони нотўғри');
    end if;
    q := (it->>'qty')::int;
    if with_price then
      if coalesce(it->>'price', '') = '' then pr := pprice;
      elsif (it->>'price') ~ '^\d{1,12}(\.\d+)?$' then pr := round((it->>'price')::numeric);
      else perform apteka.fail('«' || nm || '»: нархи нотўғри'); end if;
      if coalesce(it->>'sum', '') = '' then sm := pr * q;
      elsif (it->>'sum') ~ '^\d{1,14}(\.\d+)?$' then sm := round((it->>'sum')::numeric);
      else perform apteka.fail('«' || nm || '»: суммаси нотўғри'); end if;
      out := out || jsonb_build_array(jsonb_build_object('pid', pid, 'name', nm, 'qty', q, 'price', pr, 'sum', sm));
    else
      out := out || jsonb_build_array(jsonb_build_object('pid', pid, 'name', nm, 'qty', q));
    end if;
  end loop;
  return out;
end $$;

-- Qoldiqni qulflab tekshirish (bir vaqtda ikki sotuvchi sotsa ham to'g'ri)
create or replace function apteka.check_avail(bid int, items jsonb) returns void
language plpgsql set search_path = apteka, pg_catalog as $$
declare rec record; have int; bname text := (select name from branches where id = bid);
begin
  for rec in
    select (x->>'pid')::int as pid, max(x->>'name') as nm, sum((x->>'qty')::int) as need
    from jsonb_array_elements(items) x group by 1 order by 1
  loop
    insert into stock(branch_id, product_id, qty) values (bid, rec.pid, 0) on conflict do nothing;
    select qty into have from stock where branch_id = bid and product_id = rec.pid for update;
    if rec.need > have then
      perform apteka.fail('«' || rec.nm || '» — «' || bname || '»да етарли эмас: қолдиқ ' || have || ', керак ' || rec.need);
    end if;
  end loop;
end $$;

create or replace function apteka.add_stock(bid int, pid int, delta int) returns void
language sql set search_path = apteka, pg_catalog as $$
  insert into stock(branch_id, product_id, qty) values (bid, pid, delta)
  on conflict (branch_id, product_id) do update set qty = stock.qty + excluded.qty
$$;

create or replace function apteka.dup(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r text := apteka.clean(req->>'rid', 80); d docs;
begin
  if r = '' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('rid:' || r));
  select * into d from docs where rid = r;
  if d.id is null then return null; end if;
  return jsonb_build_object('ok', true, 'dup', true, 'doc', d.no,
    'total', (select sum(sum) from doc_lines where doc_id = d.id)) || apteka.state(u);
end $$;

create or replace function apteka.new_doc(u apteka.users, typ text, bid int, to_bid int, client text, doctor text, req jsonb, items jsonb)
returns apteka.docs language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; pre text := case typ when 'Приход' then 'П' when 'Расход' then 'С' else 'Ў' end;
begin
  insert into docs(no, type, branch_id, to_branch_id, client, doctor, note, op_name, user_id, day, rid)
  values (pre || '-' || nextval('apteka.doc_seq'), typ, bid, to_bid, client, doctor,
          apteka.clean(req->>'note', 500), u.name, u.id, apteka.today(), nullif(apteka.clean(req->>'rid', 80), ''))
  returning * into d;
  insert into doc_lines(doc_id, product_id, qty, price, sum)
  select d.id, (x->>'pid')::int, (x->>'qty')::int, (x->>'price')::numeric, (x->>'sum')::numeric
  from jsonb_array_elements(items) with ordinality t(x, n) order by n;
  return d;
end $$;

/* ───────── amallar ───────── */

-- Расход = сотув
create or replace function apteka.do_sale(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r jsonb; bid int; items jsonb; d docs; x jsonb;
  client text := apteka.clean(req->>'client', 120);
  doctor text := apteka.clean(req->>'doctor', 120);
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  if client = '' then perform apteka.fail('Мижоз Ф.И.Ш ни ёзинг'); end if;
  items := apteka.norm_items(req->'items', true);
  perform apteka.check_avail(bid, items);
  d := apteka.new_doc(u, 'Расход', bid, null, client, doctor, req, items);
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, -(x->>'qty')::int);
  end loop;
  if doctor <> '' and not exists (select 1 from doctors where apteka.norm(name) = apteka.norm(doctor)) then
    insert into doctors(name, note) values (doctor, 'сотувдан қўшилди') on conflict do nothing;
  end if;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no,
    'total', (select sum((e.value->>'sum')::numeric) from jsonb_array_elements(items) e)) || apteka.state(u);
end $$;

-- Приход: фақат маҳсулот ва сони
create or replace function apteka.do_income(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r jsonb; bid int; items jsonb; d docs; x jsonb;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  items := apteka.norm_items(req->'items', false);
  d := apteka.new_doc(u, 'Приход', bid, null, '', '', req, items);
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, (x->>'qty')::int);
  end loop;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no) || apteka.state(u);
end $$;

-- Филиалдан филиалга
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
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, -(x->>'qty')::int);
    perform apteka.add_stock(tid, (x->>'pid')::int, (x->>'qty')::int);
  end loop;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no) || apteka.state(u);
end $$;

-- Бекор қилиш: ёзув ўчмайди, қолдиқ қайтади
create or replace function apteka.do_cancel(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare d docs; reason text := apteka.clean(req->>'reason', 300); rec record; have int; bname text; pname text;
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
  for rec in
    select bid, pid, sum(delta)::int as delta from (
      select d.branch_id as bid, l.product_id as pid,
             case d.type when 'Приход' then -l.qty when 'Расход' then l.qty else l.qty end as delta
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

/* ───────── o'qish ───────── */

create or replace function apteka.period(req jsonb, maxdays int) returns daterange
language plpgsql set search_path = pg_catalog as $$
declare f text := coalesce(req->>'from', ''); t text := coalesce(req->>'to', '');
begin
  if f !~ '^\d{4}-\d{2}-\d{2}$' or t !~ '^\d{4}-\d{2}-\d{2}$' or f::date > t::date then perform apteka.fail('Давр нотўғри'); end if;
  if t::date - f::date > maxdays then perform apteka.fail('Давр ' || maxdays || ' кундан ошмасин'); end if;
  return daterange(f::date, t::date, '[]');
end $$;

create or replace function apteka.history(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare p daterange := apteka.period(req, 400); scope int; typ text := apteka.clean(req->>'type'); q text := apteka.norm(req->>'q');
  cnt int; res_rows jsonb;
begin
  if u.role = 'admin' then
    if apteka.clean(req->>'branch') <> '' then select id into scope from branches where name = apteka.clean(req->>'branch'); end if;
  else
    scope := u.branch_id;
  end if;
  select count(*), coalesce(jsonb_agg(apteka.rowj(x.v) order by (x.v).doc_id desc, (x.v).line_id) filter (where x.rn <= 3000), '[]')
  into cnt, res_rows
  from (
    select v, row_number() over (order by v.doc_id desc, v.line_id) as rn
    from v_rows v
    where v.day <@ p
      and (scope is null or v.branch_id = scope or v.to_branch_id = scope)
      and (typ = '' or v.type = typ)
      and (q = '' or position(q in apteka.norm(concat_ws(' ', v.doc, v.product, v.client, v.doctor, v.branch, v.to_name, v.op_name, v.note, v.cancel_note))) > 0)
  ) x;
  return jsonb_build_object('ok', true, 'rows', res_rows, 'total', cnt, 'from', lower(p), 'to', upper(p) - 1);
end $$;

create or replace function apteka.report(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare p daterange := apteka.period(req, 400); res jsonb;
begin
  with r as (select * from v_rows where day <@ p),
  a as (select * from r where status = 'Фаол'),
  s as (select * from a where type = 'Расход')
  select jsonb_build_object('ok', true, 'from', lower(p), 'to', upper(p) - 1,
    'tot', jsonb_build_object(
      'sum', coalesce((select sum(sum) from s), 0),
      'qty', coalesce((select sum(qty) from s), 0),
      'docs', (select count(distinct doc_id) from s),
      'clients', (select count(distinct apteka.norm(client)) from s),
      'inQty', coalesce((select sum(qty) from a where type = 'Приход'), 0),
      'trQty', coalesce((select sum(qty) from a where type = 'Ўтказма'), 0),
      'cancelled', (select count(distinct doc_id) from r where status = 'Бекор')),
    'byBranch', (select coalesce(jsonb_object_agg(b.name, jsonb_build_object(
        'sum', coalesce(x.sm, 0), 'qty', coalesce(x.q, 0), 'docs', coalesce(x.dc, 0),
        'inQty', coalesce(i.q, 0), 'trIn', coalesce(ti.q, 0), 'trOut', coalesce(tou.q, 0))), '{}')
      from branches b
      left join (select branch_id, sum(sum) sm, sum(qty) q, count(distinct doc_id) dc from s group by 1) x on x.branch_id = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Приход' group by 1) i on i.branch_id = b.id
      left join (select to_branch_id bid, sum(qty) q from a where type = 'Ўтказма' group by 1) ti on ti.bid = b.id
      left join (select branch_id, sum(qty) q from a where type = 'Ўтказма' group by 1) tou on tou.branch_id = b.id
      where b.active or x.branch_id is not null or i.branch_id is not null or ti.bid is not null or tou.branch_id is not null),
    'byProduct', (select coalesce(jsonb_object_agg(product, jsonb_build_object('qty', q, 'sum', sm)), '{}')
      from (select product, sum(qty) q, sum(sum) sm from s group by 1) z),
    'byDoctor', (select coalesce(jsonb_object_agg(dn, jsonb_build_object('sum', sm, 'qty', q, 'docs', dc)), '{}')
      from (select coalesce(nullif(doctor, ''), '— (врачсиз)') dn, sum(sum) sm, sum(qty) q, count(distinct doc_id) dc from s group by 1) z),
    'byDay', (select coalesce(jsonb_object_agg(to_char(day, 'YYYY-MM-DD'), jsonb_build_object('sum', sm, 'docs', dc, 'qty', q)), '{}')
      from (select day, sum(sum) sm, count(distinct doc_id) dc, sum(qty) q from s group by 1) z),
    'matrix', (select coalesce(jsonb_object_agg(product, m), '{}')
      from (select product, jsonb_object_agg(branch, q) m from (select product, branch, sum(qty) q from s group by 1, 2) y group by 1) z))
  into res;
  return res;
end $$;

/* ───────── sozlamalar (admin) ───────── */

create or replace function apteka.settings_json() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('ok', true,
    'general', jsonb_build_object('name', coalesce((select value from settings where key = 'name'), ''), 'currency', coalesce((select value from settings where key = 'currency'), 'сўм')),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price, 'unit', unit, 'min', min_qty, 'note', note, 'active', active) order by sort, id) from products), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'addr', addr, 'phone', phone, 'active', active) order by sort, id) from branches), '[]'),
    'doctors', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'note', note, 'active', active) order by name) from doctors), '[]'),
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'branch', coalesce(b.name, ''), 'active', u.active) order by u.role, u.name) from users u left join branches b on b.id = u.branch_id), '[]'))
$$;

create or replace function apteka.save_settings(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, extensions, pg_catalog as $$
declare
  kind text := req->>'kind';
  it jsonb := coalesce(req->'item', '{}');
  id_ int := nullif(it->>'id', '')::int;
  nm text := apteka.clean(it->>'name', 150);
  act boolean := coalesce((it->>'active')::boolean, true);
  bid int; pin text; other int;
begin
  if kind = 'general' then
    if apteka.clean(it->>'name') = '' then perform apteka.fail('Тармоқ номини ёзинг'); end if;
    insert into settings values ('name', apteka.clean(it->>'name', 120)) on conflict (key) do update set value = excluded.value;
    insert into settings values ('currency', coalesce(nullif(apteka.clean(it->>'currency', 20), ''), 'сўм')) on conflict (key) do update set value = excluded.value;
  elsif kind = 'product' then
    if nm = '' then perform apteka.fail('Маҳсулот номини ёзинг'); end if;
    if exists (select 1 from products where lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай маҳсулот бор: ' || nm); end if;
    if coalesce(it->>'price', '0') !~ '^\d{1,12}(\.\d+)?$' then perform apteka.fail('Нарх нотўғри'); end if;
    if coalesce(it->>'min', '0') !~ '^\d{1,6}$' then perform apteka.fail('Минимал қолдиқ нотўғри'); end if;
    if id_ is null then
      insert into products(name, price, unit, min_qty, note, sort, active)
      values (nm, round(coalesce(nullif(it->>'price', ''), '0')::numeric), coalesce(nullif(apteka.clean(it->>'unit', 20), ''), 'дона'),
              coalesce(nullif(it->>'min', ''), '3')::int, apteka.clean(it->>'note', 200), coalesce((select max(sort) + 1 from products), 1), act);
    else
      update products set name = nm, price = round(coalesce(nullif(it->>'price', ''), '0')::numeric),
        unit = coalesce(nullif(apteka.clean(it->>'unit', 20), ''), 'дона'), min_qty = coalesce(nullif(it->>'min', ''), '3')::int,
        note = apteka.clean(it->>'note', 200), active = act where id = id_;
      if not found then perform apteka.fail('Маҳсулот топилмади'); end if;
    end if;
  elsif kind = 'branch' then
    if nm = '' then perform apteka.fail('Филиал номини ёзинг'); end if;
    if exists (select 1 from branches where lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай филиал бор: ' || nm); end if;
    if id_ is not null and not act and exists (select 1 from stock where branch_id = id_ and qty > 0) then
      perform apteka.fail('Бу филиалда қолдиқ бор — аввал товарни бошқа филиалга ўтказинг');
    end if;
    if id_ is null then
      insert into branches(name, addr, phone, sort, active) values (nm, apteka.clean(it->>'addr'), apteka.clean(it->>'phone', 40), coalesce((select max(sort) + 1 from branches), 1), act);
    else
      update branches set name = nm, addr = apteka.clean(it->>'addr'), phone = apteka.clean(it->>'phone', 40), active = act where id = id_;
      if not found then perform apteka.fail('Филиал топилмади'); end if;
    end if;
  elsif kind = 'doctor' then
    if nm = '' then perform apteka.fail('Врач исмини ёзинг'); end if;
    if exists (select 1 from doctors where lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай врач бор: ' || nm); end if;
    if id_ is null then
      insert into doctors(name, note, active) values (nm, apteka.clean(it->>'note'), act);
    else
      update doctors set name = nm, note = apteka.clean(it->>'note'), active = act where id = id_;
      if not found then perform apteka.fail('Врач топилмади'); end if;
    end if;
  elsif kind = 'user' then
    if nm = '' then perform apteka.fail('Исмини ёзинг'); end if;
    if exists (select 1 from users where lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай исмли фойдаланувчи бор: ' || nm); end if;
    if coalesce(it->>'role', '') not in ('admin', 'seller') then perform apteka.fail('Ролни танланг'); end if;
    if it->>'role' = 'seller' then
      select id into bid from branches where name = apteka.clean(it->>'branch') and active;
      if bid is null then perform apteka.fail('Сотувчига филиал танланг'); end if;
    end if;
    pin := btrim(coalesce(it->>'pin', ''));
    if pin <> '' and pin !~ '^\d{4,12}$' then perform apteka.fail('PIN 4–12 та рақамдан иборат бўлсин'); end if;
    if id_ is null and pin = '' then perform apteka.fail('Янги фойдаланувчига PIN ёзинг'); end if;
    if pin <> '' then
      select id into other from users where active and pin_hash = crypt(pin, pin_hash) and id is distinct from id_ limit 1;
      if other is not null then perform apteka.fail('Бу PIN бошқа фойдаланувчида бор — бошқасини танланг'); end if;
    end if;
    if id_ is not null and (it->>'role' <> 'admin' or not act)
       and not exists (select 1 from users where role = 'admin' and active and id <> id_) then
      perform apteka.fail('Камида битта фаол админ қолиши керак');
    end if;
    if id_ is null then
      insert into users(name, pin_hash, role, branch_id, active) values (nm, crypt(pin, gen_salt('bf', 8)), it->>'role', bid, act);
    else
      update users set name = nm, role = it->>'role', branch_id = bid, active = act,
        pin_hash = case when pin <> '' then crypt(pin, gen_salt('bf', 8)) else pin_hash end
      where id = id_;
      if not found then perform apteka.fail('Фойдаланувчи топилмади'); end if;
      if pin <> '' or not act then delete from sessions where user_id = id_; end if;
    end if;
  else
    perform apteka.fail('Номаълум созлама');
  end if;
  perform apteka.bump();
  return apteka.settings_json();
end $$;

/* ───────── Google Sheets nusxasi uchun ───────── */

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
        case when v.cancel_note <> '' then case when v.note <> '' then v.note || ' · ' || v.cancel_note else v.cancel_note end else v.note end)
      order by v.doc_id, v.line_id) from v_rows v), '[]'));
end $$;

/* ───────── kirish nuqtasi ───────── */

create or replace function apteka.handle(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare a text := coalesce(req->>'action', ''); u users; v bigint; h text; res jsonb;
begin
  if a = 'login' then return apteka.login(req); end if;
  if a = 'ping' then return jsonb_build_object('ok', true, 'v', 'supabase-1'); end if;
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
  elsif a = 'cancel' then return apteka.do_cancel(u, req);
  elsif a = 'history' then return apteka.history(u, req);
  elsif a = 'clients' then return apteka.clients(req);
  end if;

  if u.role <> 'admin' then perform apteka.fail('Фақат админ учун'); end if;
  if a = 'report' then return apteka.report(req);
  elsif a = 'settings' then return apteka.settings_json();
  elsif a = 'save' then return apteka.save_settings(u, req);
  end if;
  perform apteka.fail('Номаълум амал: ' || a);
  return null;
end $$;

-- Сайт чақирадиган ягона функция
create or replace function public.app(req jsonb) returns jsonb
language plpgsql security definer set search_path = apteka, pg_catalog as $$
begin
  return apteka.handle(req);
exception
  when sqlstate 'P0001' then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  when others then
    return jsonb_build_object('ok', false, 'error', 'Сервер хатоси: ' || sqlerrm);
end $$;

