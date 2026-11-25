-- 08: Чек — кассир телефони (фойдаланувчида), ҳужжат қаторида кассир телефони.

alter table apteka.users add column if not exists phone text not null default '';

create or replace view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note, rd.no as ref_no,
       d.paytype, d.discount, d.discount_note, coalesce(ou.phone, '') as op_phone
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
    'ref', coalesce(r.ref_no, ''), 'pay', r.paytype, 'disc', r.discount, 'discNote', r.discount_note, 'opPhone', r.op_phone,
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

create or replace function apteka.pub_user(u apteka.users) returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('name', u.name, 'role', u.role, 'phone', u.phone,
    'branch', case when u.role = 'admin' then '' else coalesce((select name from branches where id = u.branch_id), '') end)
$$;

create or replace function apteka.settings_json() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('ok', true,
    'general', jsonb_build_object('name', coalesce((select value from settings where key = 'name'), ''), 'currency', coalesce((select value from settings where key = 'currency'), 'сўм')),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price, 'unit', unit, 'min', min_qty, 'note', note, 'active', active) order by sort, id) from products), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'addr', addr, 'phone', phone, 'active', active) order by sort, id) from branches), '[]'),
    'doctors', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'note', note, 'active', active) order by name) from doctors), '[]'),
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'branch', coalesce(b.name, ''), 'phone', u.phone, 'active', u.active) order by u.role, u.name) from users u left join branches b on b.id = u.branch_id), '[]'),
    'payTypes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind, 'active', active) order by sort, id) from pay_types), '[]'),
    'finCats', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'grp', grp, 'name', name, 'active', active) order by grp desc, sort, id) from fin_cats), '[]'))
$$;

create or replace function apteka.handle(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare a text := coalesce(req->>'action', ''); u users; v bigint; h text; res jsonb;
begin
  if a = 'login' then return apteka.login(req); end if;
  if a = 'ping' then return jsonb_build_object('ok', true, 'v', 'supabase-4'); end if;
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
