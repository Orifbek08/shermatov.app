-- Қайтариш фақат сотилган филиалда: сотувчи бошқа филиал сотувини кўрмайди ва қайтара олмайди,
-- қайтган маҳсулот ҳар доим сотув қилинган филиал қолдиғига қўшилади.

drop function if exists apteka.sale_lookup(jsonb);

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

create or replace function apteka.do_return(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  r jsonb; bid int; od docs; d docs; it jsonb; ol doc_lines; pname text;
  ret int; q int; sm numeric; maxsm numeric; i int := 0;
  reason text := apteka.clean(req->>'reason', 300);
  lines jsonb := '[]'; seen bigint[] := '{}'; total numeric := 0;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  select * into od from docs where no = apteka.clean(req->>'ref', 40) for update;
  if od.id is null or od.type <> 'Расход' then perform apteka.fail('Сотув ҳужжати топилмади'); end if;
  -- қайтариш фақат сотилган филиалда, маҳсулот ўша филиал қолдиғига қайтади
  bid := od.branch_id;
  if u.role <> 'admin' and u.branch_id <> bid then
    perform apteka.fail('Бу сотув «' || (select name from branches where id = bid) || '»да қилинган — қайтариш ўша филиалда қилинади');
  end if;
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
  elsif a = 'saleLookup' then return apteka.sale_lookup(u, req);
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
