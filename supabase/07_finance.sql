-- 07: Тўлов турлари, чегирма, қарз тизими ва молия (кирим/чиқим) — ҳар филиал алоҳида.
-- Фақат қўшимча: мавжуд ҳужжатлар ўзгармайди (эски сотувларда тўлов тури бўш қолади).

/* ───────── жадваллар ───────── */

create table if not exists apteka.pay_types (
  id serial primary key,
  name text not null unique,
  kind text not null check (kind in ('cash', 'card', 'transfer', 'debt')),
  sort int not null default 0,
  active boolean not null default true
);
insert into apteka.pay_types(name, kind, sort) values
  ('Нақд', 'cash', 1), ('Карта', 'card', 2), ('Қарз', 'debt', 3), ('ЯТТ', 'transfer', 4), ('МЧЖ', 'transfer', 5)
on conflict (name) do nothing;

-- Чиқим тоифалари: exp = аптека харажати, cash = кассадан пул ечиш
create table if not exists apteka.fin_cats (
  id serial primary key,
  grp text not null check (grp in ('exp', 'cash')),
  name text not null,
  sort int not null default 0,
  active boolean not null default true,
  unique (grp, name)
);
insert into apteka.fin_cats(grp, name, sort) values
  ('exp', 'Ижара', 1), ('exp', 'Коммунал тўловлар', 2), ('exp', 'Иш ҳақи', 3),
  ('exp', 'Хўжалик харажатлари', 4), ('exp', 'Транспорт', 5), ('exp', 'Бошқа харажат', 6),
  ('cash', 'Раҳбарга топширилди', 1), ('cash', 'Банкка топширилди', 2), ('cash', 'Бошқа', 3)
on conflict (grp, name) do nothing;

alter table apteka.docs add column if not exists paytype text not null default '';
alter table apteka.docs add column if not exists discount numeric(16,0) not null default 0;
alter table apteka.docs add column if not exists discount_note text not null default '';
alter table apteka.docs add column if not exists debt_cut numeric(16,0) not null default 0;
alter table apteka.docs drop constraint if exists docs_money_chk;
alter table apteka.docs add constraint docs_money_chk check (discount >= 0 and debt_cut >= 0);

create table if not exists apteka.debts (
  id bigserial primary key,
  doc_id bigint not null unique references apteka.docs(id),
  branch_id int not null references apteka.branches(id),
  client text not null,
  amount numeric(16,0) not null check (amount > 0),
  due date,
  note text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists debts_branch_idx on apteka.debts(branch_id);

create sequence if not exists apteka.fin_seq;
create table if not exists apteka.fin (
  id bigserial primary key,
  no text not null unique,
  day date not null,
  created_at timestamptz not null default now(),
  branch_id int not null references apteka.branches(id),
  dir text not null check (dir in ('in', 'out')),
  cat text not null,
  sub text not null default '',
  paytype text not null,
  amount numeric(16,0) not null check (amount > 0),
  note text not null default '',
  doc_id bigint references apteka.docs(id),
  debt_id bigint references apteka.debts(id),
  status text not null default 'Фаол' check (status in ('Фаол', 'Бекор')),
  cancel_note text not null default '',
  op_name text not null default '',
  user_id int references apteka.users(id) on delete set null,
  rid text unique
);
create index if not exists fin_branch_day_idx on apteka.fin(branch_id, day);
create index if not exists fin_doc_idx on apteka.fin(doc_id) where doc_id is not null;
create index if not exists fin_debt_idx on apteka.fin(debt_id) where debt_id is not null;

alter table apteka.pay_types enable row level security;
alter table apteka.fin_cats enable row level security;
alter table apteka.debts enable row level security;
alter table apteka.fin enable row level security;

create or replace view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note, rd.no as ref_no,
       d.paytype, d.discount, d.discount_note
from apteka.docs d
join apteka.doc_lines l on l.doc_id = d.id
join apteka.products p on p.id = l.product_id
join apteka.branches b on b.id = d.branch_id
left join apteka.branches tb on tb.id = d.to_branch_id
left join apteka.docs rd on rd.id = d.ref_doc_id;

-- Қарзлар: тўланган (молиядаги «Қарз тўлови»), қайтаришда айрилган ва қолган сумма
create or replace view apteka.v_debts with (security_invoker = true) as
select db.id, db.doc_id, db.branch_id, b.name as branch, db.client, db.amount, db.due, db.note, db.created_at,
       d.no as doc, d.day, d.doctor, d.op_name, d.status as doc_status,
       coalesce(p.paid, 0) as paid, coalesce(c.cut, 0) as cut,
       db.amount - coalesce(p.paid, 0) - coalesce(c.cut, 0) as left_amt, p.last_pay
from apteka.debts db
join apteka.docs d on d.id = db.doc_id
join apteka.branches b on b.id = db.branch_id
left join lateral (select sum(f.amount) as paid, max(f.created_at) as last_pay from apteka.fin f
                   where f.debt_id = db.id and f.status = 'Фаол' and f.cat = 'Қарз тўлови') p on true
left join lateral (select sum(r.debt_cut) as cut from apteka.docs r
                   where r.ref_doc_id = db.doc_id and r.type = 'Қайтариш' and r.status = 'Фаол') c on true;

/* ───────── ёрдамчилар ───────── */

create or replace function apteka.rowj(r apteka.v_rows) returns jsonb
language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'doc', r.doc, 'date', to_char(r.day, 'YYYY-MM-DD'), 'time', r.tm, 'type', r.type,
    'branch', r.branch, 'product', r.product, 'qty', r.qty, 'price', r.price, 'sum', r.sum,
    'client', r.client, 'doctor', r.doctor, 'to', coalesce(r.to_name, ''), 'status', r.status, 'op', r.op_name,
    'ref', coalesce(r.ref_no, ''), 'pay', r.paytype, 'disc', r.discount, 'discNote', r.discount_note,
    'note', case when r.cancel_note <> '' then case when r.note <> '' then r.note || ' · ' || r.cancel_note else r.cancel_note end else r.note end)
$$;

create or replace function apteka.cfg() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object(
    'name', coalesce((select value from settings where key = 'name'), 'Др. Шерматов дорихоналари'),
    'currency', coalesce((select value from settings where key = 'currency'), 'сўм'),
    'products', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'price', price, 'unit', unit, 'min', min_qty, 'note', note) order by sort, id) from products where active), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'addr', addr, 'phone', phone) order by sort, id) from branches where active), '[]'),
    'doctors', coalesce((select jsonb_agg(name order by name) from doctors where active), '[]'),
    'payTypes', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'kind', kind) order by sort, id) from pay_types where active), '[]'),
    'finCats', jsonb_build_object(
      'exp', coalesce((select jsonb_agg(name order by sort, id) from fin_cats where grp = 'exp' and active), '[]'),
      'cash', coalesce((select jsonb_agg(name order by sort, id) from fin_cats where grp = 'cash' and active), '[]')))
$$;

-- нарх рўйхатдаги нарх ('lp') ҳам қайтади — сотувчи нархни ўзгартира олмаслиги учун
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
      sm := pr * q;
      out := out || jsonb_build_array(jsonb_build_object('pid', pid, 'name', nm, 'qty', q, 'price', pr, 'sum', sm, 'lp', pprice));
    else
      out := out || jsonb_build_array(jsonb_build_object('pid', pid, 'name', nm, 'qty', q));
    end if;
  end loop;
  return out;
end $$;

create or replace function apteka.dup(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r text := apteka.clean(req->>'rid', 80); d docs;
begin
  if r = '' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('rid:' || r));
  select * into d from docs where rid = r;
  if d.id is null then return null; end if;
  return jsonb_build_object('ok', true, 'dup', true, 'doc', d.no,
    'total', coalesce((select sum(sum) from doc_lines where doc_id = d.id), 0) - d.discount) || apteka.state(u);
end $$;

create or replace function apteka.fin_add(u apteka.users, bid int, dir text, cat text, sub text, pay text, amount numeric,
                                          note text, doc bigint, debt bigint, rid text)
returns apteka.fin language plpgsql set search_path = apteka, pg_catalog as $$
declare f fin;
begin
  insert into fin(no, day, branch_id, dir, cat, sub, paytype, amount, note, doc_id, debt_id, op_name, user_id, rid)
  values ('М-' || nextval('apteka.fin_seq'), apteka.today(), bid, dir, cat, coalesce(sub, ''), pay, amount,
          coalesce(note, ''), doc, debt, u.name, u.id, nullif(rid, ''))
  returning * into f;
  return f;
end $$;

create or replace function apteka.cash_pay() returns text
language sql stable set search_path = apteka, pg_catalog as $$
  select coalesce((select name from pay_types where kind = 'cash' and active order by sort, id limit 1), 'Нақд')
$$;

/* ───────── сотув: тўлов тури, чегирма, қарз ───────── */

create or replace function apteka.do_sale(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare r jsonb; bid int; raw jsonb; items jsonb := '[]'; d docs; x jsonb;
  client text := apteka.clean(req->>'client', 120);
  doctor text := apteka.clean(req->>'doctor', 120);
  pay text := apteka.clean(req->>'pay', 60);
  pk text; total numeric := 0; disc numeric := 0; net numeric;
  dnote text := apteka.clean(req->>'discountNote', 300);
  debt_note text := apteka.clean(req->>'debtNote', 300);
  due date;
begin
  r := apteka.dup(u, req); if r is not null then return r; end if;
  bid := apteka.op_branch(u, req->>'branch');
  if client = '' then perform apteka.fail('Мижоз Ф.И.Ш ни ёзинг'); end if;
  if pay = '' then pay := apteka.cash_pay(); end if;  -- эски версиядаги иловалар учун
  select kind into pk from pay_types where name = pay and active;
  if pk is null then perform apteka.fail('Тўлов турини танланг'); end if;
  raw := apteka.norm_items(req->'items', true);
  for x in select value from jsonb_array_elements(raw) loop
    -- оддий фойдаланувчи фақат админ қўйган нархда сотади
    if u.role <> 'admin' then
      if coalesce((x->>'lp')::numeric, 0) <= 0 then
        perform apteka.fail('«' || (x->>'name') || '»: нархи қўйилмаган — админга айтинг');
      end if;
      x := x || jsonb_build_object('price', (x->>'lp')::numeric);
    end if;
    if coalesce((x->>'price')::numeric, 0) <= 0 then perform apteka.fail('«' || (x->>'name') || '»: нархини ёзинг'); end if;
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

  if pk = 'debt' then
    if debt_note = '' then perform apteka.fail('Қарз учун изоҳ ёзинг (масалан: телефони, қачон тўлайди)'); end if;
    if coalesce(req->>'due', '') <> '' then
      if (req->>'due') !~ '^\d{4}-\d{2}-\d{2}$' then perform apteka.fail('Тўлаш санаси нотўғри'); end if;
      due := (req->>'due')::date;
      if due < apteka.today() then perform apteka.fail('Тўлаш санаси бугундан олдин бўлмасин'); end if;
    end if;
    if net <= 0 then perform apteka.fail('Қарзга сотиш учун сумма 0 дан катта бўлсин'); end if;
  end if;

  perform apteka.check_avail(bid, items);
  d := apteka.new_doc(u, 'Расход', bid, null, client, doctor, req, items);
  update docs set paytype = pay, discount = disc, discount_note = dnote where id = d.id;
  for x in select value from jsonb_array_elements(items) loop
    perform apteka.add_stock(bid, (x->>'pid')::int, -(x->>'qty')::int);
  end loop;
  if pk = 'debt' then
    insert into debts(doc_id, branch_id, client, amount, due, note) values (d.id, bid, client, net, due, debt_note);
  elsif net > 0 then
    perform apteka.fin_add(u, bid, 'in', 'Сотув', '', pay, net, client || ' · ' || d.no, d.id, null, null);
  end if;
  if doctor <> '' and not exists (select 1 from doctors where apteka.norm(name) = apteka.norm(doctor)) then
    insert into doctors(name, note) values (doctor, 'сотувдан қўшилди') on conflict do nothing;
  end if;
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'total', net, 'gross', total, 'discount', disc, 'debt', pk = 'debt')
         || apteka.state(u);
end $$;

/* ───────── қайтариш: чегирма ҳисобга олинади, қарз аввал камаяди, қолгани пул қилиб қайтарилади ───────── */

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
  rpay := case when od.paytype <> '' and coalesce((select kind from pay_types where name = od.paytype), '') <> 'debt'
               then od.paytype else apteka.cash_pay() end;

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

/* ───────── бекор қилиш: молия ёзувлари ҳам бекор бўлади ───────── */

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
    if d.day <> apteka.today() then perform apteka.fail('Фақат бугунги ҳужжатни бекор қилиш мумкин — админга мурожаат қилинг'); end if;
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
  cn := 'Бекор: ' || reason || ' (' || u.name || ', ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ')';
  update docs set status = 'Бекор', cancel_note = cn where id = d.id;
  update fin set status = 'Бекор', cancel_note = cn || ' — ' || d.no where doc_id = d.id and status = 'Фаол';
  perform apteka.bump();
  return jsonb_build_object('ok', true, 'doc', d.no, 'cancelled', true) || apteka.state(u);
end $$;

/* ───────── қарздорлар ───────── */

create or replace function apteka.scope_branch(u apteka.users, b text) returns int
language plpgsql set search_path = apteka, pg_catalog as $$
declare bid int; nm text := apteka.clean(b);
begin
  if u.role <> 'admin' then return u.branch_id; end if;
  if nm = '' then return null; end if;
  select id into bid from branches where name = nm;
  if bid is null then perform apteka.fail('Филиал топилмади: ' || nm); end if;
  return bid;
end $$;

create or replace function apteka.debts_list(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare scope int := apteka.scope_branch(u, req->>'branch');
  st text := coalesce(nullif(req->>'status', ''), 'open');
  q text := apteka.skel(apteka.clean(req->>'q', 120)); t date := apteka.today(); res jsonb; tot jsonb;
begin
  select jsonb_build_object(
    'count', count(*) filter (where left_amt > 0),
    'left', coalesce(sum(left_amt) filter (where left_amt > 0), 0),
    'overdue', count(*) filter (where left_amt > 0 and due < t),
    'overdueSum', coalesce(sum(left_amt) filter (where left_amt > 0 and due < t), 0),
    'soon', count(*) filter (where left_amt > 0 and due between t and t + 3),
    'soonSum', coalesce(sum(left_amt) filter (where left_amt > 0 and due between t and t + 3), 0),
    'closed', count(*) filter (where left_amt <= 0))
  into tot from v_debts where doc_status = 'Фаол' and (scope is null or branch_id = scope);

  select coalesce(jsonb_agg(z.j order by z.closed, z.due nulls last, z.id desc), '[]') into res from (
    select v.id, (v.left_amt <= 0) as closed, v.due, jsonb_build_object(
      'id', v.id, 'doc', v.doc, 'date', to_char(v.day, 'YYYY-MM-DD'), 'branch', v.branch, 'client', v.client,
      'doctor', v.doctor, 'amount', v.amount, 'paid', v.paid, 'cut', v.cut, 'left', v.left_amt,
      'due', coalesce(to_char(v.due, 'YYYY-MM-DD'), ''), 'note', v.note, 'op', v.op_name,
      'pays', coalesce((select jsonb_agg(jsonb_build_object('no', f.no, 'date', to_char(f.day, 'YYYY-MM-DD'),
            'time', to_char(f.created_at at time zone 'Asia/Tashkent', 'HH24:MI'), 'amount', f.amount,
            'pay', f.paytype, 'op', f.op_name) order by f.id)
          from fin f where f.debt_id = v.id and f.status = 'Фаол' and f.cat = 'Қарз тўлови'), '[]'),
      'rets', coalesce((select jsonb_agg(jsonb_build_object('doc', r.no, 'date', to_char(r.day, 'YYYY-MM-DD'), 'cut', r.debt_cut) order by r.id)
          from docs r where r.ref_doc_id = v.doc_id and r.type = 'Қайтариш' and r.status = 'Фаол' and r.debt_cut > 0), '[]')) as j
    from v_debts v
    where v.doc_status = 'Фаол' and (scope is null or v.branch_id = scope)
      and (st = 'all' or (st = 'open' and v.left_amt > 0) or (st = 'closed' and v.left_amt <= 0))
      and (q = '' or position(q in apteka.skel(v.client || ' ' || v.doc || ' ' || v.note)) > 0)
    order by (v.left_amt <= 0), v.due nulls last, v.id desc
    limit 500
  ) z;
  return jsonb_build_object('ok', true, 'rows', res, 'tot', tot, 'today', t);
end $$;

create or replace function apteka.debt_pay(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare dbt debts; dno text; dst text; amt numeric; v_pay text := apteka.clean(req->>'pay', 60); pk text; lft numeric; f fin;
  v_rid text := apteka.clean(req->>'rid', 80); v_note text := apteka.clean(req->>'note', 300);
begin
  if v_rid <> '' then
    perform pg_advisory_xact_lock(hashtext('rid:' || v_rid));
    select * into f from fin where fin.rid = v_rid;
    if f.id is not null then return jsonb_build_object('ok', true, 'dup', true, 'no', f.no); end if;
  end if;
  if coalesce(req->>'id', '') !~ '^\d{1,18}$' then perform apteka.fail('Қарз танланмаган'); end if;
  select * into dbt from debts where id = (req->>'id')::bigint for update;
  if dbt.id is null then perform apteka.fail('Қарз топилмади'); end if;
  select no, status into dno, dst from docs where id = dbt.doc_id;
  if dst <> 'Фаол' then perform apteka.fail('Бу сотув бекор қилинган'); end if;
  if u.role <> 'admin' and u.branch_id <> dbt.branch_id then
    perform apteka.fail('Бу қарз «' || (select name from branches where id = dbt.branch_id) || '» филиалига тегишли — тўловни ўша филиал қабул қилади');
  end if;
  if coalesce(req->>'amount', '') !~ '^\d{1,14}$' or (req->>'amount')::numeric <= 0 then perform apteka.fail('Тўлов суммасини ёзинг'); end if;
  amt := (req->>'amount')::numeric;
  select kind into pk from pay_types where name = v_pay and active;
  if pk is null or pk = 'debt' then perform apteka.fail('Қандай тўлаганини танланг (Нақд, Карта ...)'); end if;
  select left_amt into lft from v_debts where id = dbt.id;
  if lft <= 0 then perform apteka.fail('Бу қарз тўлиқ ёпилган'); end if;
  if amt > lft then perform apteka.fail('Қолган қарз ' || lft || ' — ундан кўп ёзиб бўлмайди'); end if;
  f := apteka.fin_add(u, dbt.branch_id, 'in', 'Қарз тўлови', '', v_pay, amt,
                      concat_ws(' · ', dbt.client, dno, nullif(v_note, '')), null, dbt.id, v_rid);
  return jsonb_build_object('ok', true, 'no', f.no, 'left', lft - amt);
end $$;

create or replace function apteka.debt_edit(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare dbt debts; v_note text := apteka.clean(req->>'note', 300); v_due date;
begin
  if coalesce(req->>'id', '') !~ '^\d{1,18}$' then perform apteka.fail('Қарз танланмаган'); end if;
  select * into dbt from debts where id = (req->>'id')::bigint for update;
  if dbt.id is null then perform apteka.fail('Қарз топилмади'); end if;
  if u.role <> 'admin' and u.branch_id <> dbt.branch_id then perform apteka.fail('Бу қарз бошқа филиалга тегишли'); end if;
  if v_note = '' then perform apteka.fail('Изоҳни ёзинг'); end if;
  if coalesce(req->>'due', '') <> '' then
    if (req->>'due') !~ '^\d{4}-\d{2}-\d{2}$' then perform apteka.fail('Тўлаш санаси нотўғри'); end if;
    v_due := (req->>'due')::date;
  end if;
  update debts set note = v_note, due = v_due where id = dbt.id;
  return jsonb_build_object('ok', true);
end $$;

/* ───────── молия: қўлда чиқим, бекор қилиш, ҳисобот ───────── */

create or replace function apteka.fin_manual(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare bid int; v_grp text := coalesce(req->>'grp', ''); v_sub text := apteka.clean(req->>'sub', 80);
  v_pay text := apteka.clean(req->>'pay', 60); pk text; amt numeric; f fin;
  v_rid text := apteka.clean(req->>'rid', 80); v_note text := apteka.clean(req->>'note', 300);
begin
  if v_rid <> '' then
    perform pg_advisory_xact_lock(hashtext('rid:' || v_rid));
    select * into f from fin where fin.rid = v_rid;
    if f.id is not null then return jsonb_build_object('ok', true, 'dup', true, 'no', f.no); end if;
  end if;
  if v_grp not in ('exp', 'cash') then perform apteka.fail('Чиқим турини танланг'); end if;
  bid := apteka.op_branch(u, req->>'branch');
  if not exists (select 1 from fin_cats c where c.grp = v_grp and c.name = v_sub and c.active) then
    perform apteka.fail('Тоифани танланг');
  end if;
  if coalesce(req->>'amount', '') !~ '^\d{1,14}$' or (req->>'amount')::numeric <= 0 then perform apteka.fail('Суммани ёзинг'); end if;
  amt := (req->>'amount')::numeric;
  select kind into pk from pay_types where name = v_pay and active;
  if pk is null or pk = 'debt' then perform apteka.fail('Қайси кассадан (Нақд, Карта ...) чиққанини танланг'); end if;
  if v_sub like 'Бошқа%' and v_note = '' then perform apteka.fail('«' || v_sub || '» учун изоҳ ёзинг'); end if;
  f := apteka.fin_add(u, bid, 'out', case v_grp when 'exp' then 'Харажат' else 'Кассадан ечиш' end,
                      v_sub, v_pay, amt, v_note, null, null, v_rid);
  return jsonb_build_object('ok', true, 'no', f.no);
end $$;

create or replace function apteka.fin_cancel(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare f fin; reason text := apteka.clean(req->>'reason', 300);
begin
  select * into f from fin where no = apteka.clean(req->>'no', 40) for update;
  if f.id is null then perform apteka.fail('Ёзув топилмади'); end if;
  if f.status = 'Бекор' then perform apteka.fail('Бу ёзув аллақачон бекор қилинган'); end if;
  if f.cat in ('Сотув', 'Қайтариш') then
    perform apteka.fail('Бу ёзув «' || coalesce((select no from docs where id = f.doc_id), '') || '» ҳужжатидан автоматик тушган — ўша ҳужжатни Тарихда бекор қилинг');
  end if;
  if reason = '' then perform apteka.fail('Бекор қилиш сабабини ёзинг'); end if;
  if u.role <> 'admin' then
    if f.branch_id <> u.branch_id then perform apteka.fail('Бу ёзув бошқа филиалга тегишли'); end if;
    if f.day <> apteka.today() then perform apteka.fail('Фақат бугунги ёзувни бекор қилиш мумкин — админга мурожаат қилинг'); end if;
  end if;
  update fin set status = 'Бекор',
    cancel_note = 'Бекор: ' || reason || ' (' || u.name || ', ' || to_char(now() at time zone 'Asia/Tashkent', 'DD.MM HH24:MI') || ')'
  where id = f.id;
  return jsonb_build_object('ok', true, 'no', f.no);
end $$;

create or replace function apteka.finance(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare p daterange := apteka.period(req, 400); scope int := apteka.scope_branch(u, req->>'branch'); res jsonb;
begin
  with f as (
    select f.*, b.name as bname, coalesce(pt.kind, '') as kind
    from fin f join branches b on b.id = f.branch_id left join pay_types pt on pt.name = f.paytype
    where (scope is null or f.branch_id = scope)),
  a as (select * from f where status = 'Фаол'),
  pa as (select * from a where day <@ p)
  select jsonb_build_object('ok', true, 'from', lower(p), 'to', upper(p) - 1,
    'branch', coalesce((select name from branches where id = scope), ''),
    'tot', jsonb_build_object(
      'in', coalesce((select sum(amount) from pa where dir = 'in'), 0),
      'out', coalesce((select sum(amount) from pa where dir = 'out'), 0),
      'cash', coalesce((select sum(case when dir = 'in' then amount else -amount end) from a where kind = 'cash'), 0),
      'bal', coalesce((select sum(case when dir = 'in' then amount else -amount end) from a), 0),
      'debt', coalesce((select sum(left_amt) from v_debts where doc_status = 'Фаол' and left_amt > 0
                        and (scope is null or branch_id = scope)), 0)),
    'cats', coalesce((select jsonb_agg(jsonb_build_object('dir', dir, 'cat', cat, 'sub', sub, 'sum', s, 'n', n) order by dir, s desc)
        from (select dir, cat, sub, sum(amount) as s, count(*) as n from pa group by 1, 2, 3) z), '[]'),
    'pays', coalesce((select jsonb_agg(jsonb_build_object('pay', z.name, 'kind', z.kind, 'in', z.i, 'out', z.o, 'bal', z.bal) order by z.srt, z.name)
        from (select pt.name, pt.kind, pt.sort as srt,
                coalesce((select sum(amount) from pa where paytype = pt.name and dir = 'in'), 0) as i,
                coalesce((select sum(amount) from pa where paytype = pt.name and dir = 'out'), 0) as o,
                coalesce((select sum(case when dir = 'in' then amount else -amount end) from a where paytype = pt.name), 0) as bal
              from pay_types pt
              where pt.kind <> 'debt' and (pt.active or exists (select 1 from a where paytype = pt.name))) z), '[]'),
    'branches', case when scope is null then coalesce((select jsonb_agg(jsonb_build_object('branch', b.name,
          'in', coalesce((select sum(amount) from pa where branch_id = b.id and dir = 'in'), 0),
          'out', coalesce((select sum(amount) from pa where branch_id = b.id and dir = 'out'), 0),
          'cash', coalesce((select sum(case when dir = 'in' then amount else -amount end) from a where branch_id = b.id and kind = 'cash'), 0),
          'bal', coalesce((select sum(case when dir = 'in' then amount else -amount end) from a where branch_id = b.id), 0),
          'debt', coalesce((select sum(left_amt) from v_debts where doc_status = 'Фаол' and left_amt > 0 and branch_id = b.id), 0))
        order by b.sort, b.id)
        from branches b where b.active or exists (select 1 from a where branch_id = b.id)), '[]') else '[]'::jsonb end,
    'rows', coalesce((select jsonb_agg(jsonb_build_object('no', x.no, 'date', to_char(x.day, 'YYYY-MM-DD'),
          'time', to_char(x.created_at at time zone 'Asia/Tashkent', 'HH24:MI'), 'branch', x.bname, 'dir', x.dir,
          'cat', x.cat, 'sub', x.sub, 'pay', x.paytype, 'amount', x.amount, 'note', x.note, 'status', x.status,
          'cancel', x.cancel_note, 'op', x.op_name, 'doc', coalesce(dd.no, '')) order by x.id desc)
        from (select * from f where day <@ p order by id desc limit 3000) x left join docs dd on dd.id = x.doc_id), '[]'),
    'total', (select count(*) from f where day <@ p))
  into res;
  return res;
end $$;

/* ───────── ҳисобот: чегирма алоҳида, соф тушум = сотув − чегирма − қайтариш ───────── */

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
           max(discount) as discount, min(discount_note) as dnote, sum(sum) as gross
    from s group by doc_id),
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
      from (select coalesce(nullif(paytype, ''), 'Кўрсатилмаган') pn, sum(gross - discount) sm, count(*) dc from sd group by 1) z),
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

/* Excel: тўлов тури ва чегирма устунлари (чегирма ҳужжатнинг биринчи қаторида) */
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
      coalesce(v.ref_no, ''), v.paytype,
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
      and (q = '' or position(q in apteka.norm(concat_ws(' ', v.doc, v.product, v.client, v.doctor, v.branch, v.to_name,
                                                          v.op_name, v.note, v.cancel_note, v.paytype, v.discount_note))) > 0)
  ) x;
  return jsonb_build_object('ok', true, 'rows', res_rows, 'total', cnt, 'from', lower(p), 'to', upper(p) - 1);
end $$;

/* Google Sheets нусхаси: тўлов тури ва чегирма изоҳда (Code.gs ўзгармайди) */
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
          case when v.paytype <> '' then 'Тўлов: ' || v.paytype end,
          case when v.discount > 0 then 'Чегирма (чек бўйича): ' || v.discount || coalesce(' — ' || nullif(v.discount_note, ''), '') end,
          case when v.ref_no is not null then 'Асос: ' || v.ref_no end,
          nullif(v.note, ''),
          nullif(v.cancel_note, '')))
      order by v.doc_id, v.line_id) from v_rows v), '[]'));
end $$;

/* ───────── созламалар: тўлов турлари ва чиқим тоифалари ───────── */

create or replace function apteka.settings_json() returns jsonb
language sql stable set search_path = apteka, pg_catalog as $$
  select jsonb_build_object('ok', true,
    'general', jsonb_build_object('name', coalesce((select value from settings where key = 'name'), ''), 'currency', coalesce((select value from settings where key = 'currency'), 'сўм')),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price, 'unit', unit, 'min', min_qty, 'note', note, 'active', active) order by sort, id) from products), '[]'),
    'branches', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'addr', addr, 'phone', phone, 'active', active) order by sort, id) from branches), '[]'),
    'doctors', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'note', note, 'active', active) order by name) from doctors), '[]'),
    'users', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'name', u.name, 'role', u.role, 'branch', coalesce(b.name, ''), 'active', u.active) order by u.role, u.name) from users u left join branches b on b.id = u.branch_id), '[]'),
    'payTypes', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind, 'active', active) order by sort, id) from pay_types), '[]'),
    'finCats', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'grp', grp, 'name', name, 'active', active) order by grp desc, sort, id) from fin_cats), '[]'))
$$;

create or replace function apteka.save_fin_settings(u apteka.users, req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare
  v_kind text := req->>'kind';
  it jsonb := coalesce(req->'item', '{}');
  id_ int := nullif(it->>'id', '')::int;
  nm text := apteka.clean(it->>'name', 60);
  act boolean := coalesce((it->>'active')::boolean, true);
  op pay_types; oc fin_cats; nk text := coalesce(it->>'kind', ''); ng text := coalesce(it->>'grp', '');
begin
  if v_kind = 'paytype' then
    if nm = '' then perform apteka.fail('Тўлов тури номини ёзинг'); end if;
    if nk not in ('cash', 'card', 'transfer', 'debt') then perform apteka.fail('Турини танланг'); end if;
    if exists (select 1 from pay_types where lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай тўлов тури бор: ' || nm); end if;
    if id_ is null then
      insert into pay_types(name, kind, sort, active) values (nm, nk, coalesce((select max(sort) + 1 from pay_types), 1), act);
    else
      select * into op from pay_types where id = id_ for update;
      if op.id is null then perform apteka.fail('Тўлов тури топилмади'); end if;
      if op.kind <> nk and (op.kind = 'debt' or nk = 'debt')
         and (exists (select 1 from docs where paytype = op.name) or exists (select 1 from fin where paytype = op.name)) then
        perform apteka.fail('«' || op.name || '» ишлатилган — уни қарз турига (ёки қарздан бошқасига) алмаштириб бўлмайди. Янги тур қўшинг');
      end if;
      update pay_types set name = nm, kind = nk, active = act where id = id_;
      if op.name <> nm then
        update docs set paytype = nm where paytype = op.name;
        update fin set paytype = nm where paytype = op.name;
      end if;
    end if;
    if not exists (select 1 from pay_types where active and kind <> 'debt') then
      perform apteka.fail('Камида битта фаол тўлов тури (Нақд, Карта ...) қолиши керак');
    end if;
  elsif v_kind = 'fincat' then
    if nm = '' then perform apteka.fail('Тоифа номини ёзинг'); end if;
    if ng not in ('exp', 'cash') then perform apteka.fail('Гуруҳини танланг'); end if;
    if exists (select 1 from fin_cats where grp = ng and lower(name) = lower(nm) and id is distinct from id_) then perform apteka.fail('Бундай тоифа бор: ' || nm); end if;
    if id_ is null then
      insert into fin_cats(grp, name, sort, active) values (ng, nm, coalesce((select max(sort) + 1 from fin_cats where grp = ng), 1), act);
    else
      select * into oc from fin_cats where id = id_ for update;
      if oc.id is null then perform apteka.fail('Тоифа топилмади'); end if;
      update fin_cats set grp = ng, name = nm, active = act where id = id_;
      update fin set sub = nm, cat = case ng when 'exp' then 'Харажат' else 'Кассадан ечиш' end
      where sub = oc.name and cat = case oc.grp when 'exp' then 'Харажат' else 'Кассадан ечиш' end;
    end if;
  else
    perform apteka.fail('Номаълум созлама');
  end if;
  perform apteka.bump();
  return apteka.settings_json();
end $$;

/* қайтариш учун сотув қидируви: тўлов тури ва чегирма ҳам қайтади */
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
      'pay', d.paytype, 'discount', d.discount,
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

create or replace function apteka.handle(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare a text := coalesce(req->>'action', ''); u users; v bigint; h text; res jsonb;
begin
  if a = 'login' then return apteka.login(req); end if;
  if a = 'ping' then return jsonb_build_object('ok', true, 'v', 'supabase-3'); end if;
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
    return apteka.save_settings(u, req);
  end if;
  perform apteka.fail('Номаълум амал: ' || a);
  return null;
end $$;
