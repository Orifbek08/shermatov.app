-- Др. Шерматов — дорихоналар тармоғи · Supabase (Postgres) база
-- Ҳамма жадваллар «apteka» схемасида (API орқали тўғридан-тўғри очилмайди).
-- Сайт фақат битта функцияни чақиради: public.app(req jsonb).

create extension if not exists pgcrypto with schema extensions;
create schema if not exists apteka;
revoke all on schema apteka from public, anon, authenticated;

create table apteka.settings (
  key text primary key,
  value text not null default ''
);

create table apteka.branches (
  id serial primary key,
  name text not null unique,
  addr text not null default '',
  phone text not null default '',
  sort int not null default 0,
  active boolean not null default true
);

create table apteka.products (
  id serial primary key,
  name text not null unique,
  price numeric(14,0) not null default 0 check (price >= 0),
  unit text not null default 'дона',
  min_qty int not null default 3 check (min_qty >= 0),
  note text not null default '',
  sort int not null default 0,
  active boolean not null default true
);

create table apteka.doctors (
  id serial primary key,
  name text not null unique,
  note text not null default '',
  active boolean not null default true
);

create table apteka.users (
  id serial primary key,
  name text not null unique,
  pin_hash text not null,
  role text not null check (role in ('admin', 'seller')),
  branch_id int references apteka.branches(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table apteka.sessions (
  token text primary key,
  user_id int not null references apteka.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index on apteka.sessions(user_id);

create sequence apteka.doc_seq;

create table apteka.docs (
  id bigserial primary key,
  no text not null unique,
  type text not null check (type in ('Приход', 'Расход', 'Ўтказма')),
  branch_id int not null references apteka.branches(id),
  to_branch_id int references apteka.branches(id),
  client text not null default '',
  doctor text not null default '',
  note text not null default '',
  status text not null default 'Фаол' check (status in ('Фаол', 'Бекор')),
  cancel_note text not null default '',
  op_name text not null default '',
  user_id int references apteka.users(id) on delete set null,
  day date not null,
  created_at timestamptz not null default now(),
  rid text unique
);
create index on apteka.docs(day);
create index on apteka.docs(branch_id, day);
create index on apteka.docs(to_branch_id) where to_branch_id is not null;

create table apteka.doc_lines (
  id bigserial primary key,
  doc_id bigint not null references apteka.docs(id) on delete cascade,
  product_id int not null references apteka.products(id),
  qty int not null check (qty > 0),
  price numeric(14,0),
  sum numeric(16,0)
);
create index on apteka.doc_lines(doc_id);
create index on apteka.doc_lines(product_id);

create table apteka.stock (
  branch_id int not null references apteka.branches(id) on delete cascade,
  product_id int not null references apteka.products(id) on delete cascade,
  qty int not null default 0,
  primary key (branch_id, product_id)
);
create index on apteka.stock(product_id);

create table apteka.meta (
  id int primary key default 1 check (id = 1),
  ver bigint not null default 0
);
insert into apteka.meta values (1, 0);

alter table apteka.settings enable row level security;
alter table apteka.branches enable row level security;
alter table apteka.products enable row level security;
alter table apteka.doctors enable row level security;
alter table apteka.users enable row level security;
alter table apteka.sessions enable row level security;
alter table apteka.docs enable row level security;
alter table apteka.doc_lines enable row level security;
alter table apteka.stock enable row level security;
alter table apteka.meta enable row level security;

create view apteka.v_rows with (security_invoker = true) as
select d.id as doc_id, l.id as line_id, d.no as doc, d.day,
       to_char(d.created_at at time zone 'Asia/Tashkent', 'HH24:MI') as tm,
       d.type, b.name as branch, d.branch_id, tb.name as to_name, d.to_branch_id,
       p.name as product, l.qty, l.price, l.sum, d.client, d.doctor, d.status,
       d.op_name, d.note, d.cancel_note
from apteka.docs d
join apteka.doc_lines l on l.doc_id = d.id
join apteka.products p on p.id = l.product_id
join apteka.branches b on b.id = d.branch_id
left join apteka.branches tb on tb.id = d.to_branch_id;
