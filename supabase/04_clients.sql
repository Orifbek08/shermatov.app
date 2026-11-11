-- Мижоз қидируви (Ф.И.Ш ёзилганда таклиф): ҳамма филиаллар бўйича, лотин/кирилл фарқисиз

create or replace function apteka.skel(t text) returns text
language sql immutable set search_path = pg_catalog as $$
  select translate(
    replace(replace(replace(replace(replace(replace(replace(replace(apteka.norm(t),
      'ш', 'sh'), 'щ', 'sh'), 'ч', 'ch'), 'ю', 'yu'), 'я', 'ya'), 'ё', 'yo'), 'ц', 'ts'), 'ж', 'j'),
    'абвгғдеизйкқлмнопрстуўфхҳыэъь', 'abvggdeizykqlmnoprstuofxhie')
$$;

create or replace function apteka.clients(req jsonb) returns jsonb
language plpgsql set search_path = apteka, pg_catalog as $$
declare q text := apteka.skel(req->>'q');
begin
  if length(q) < 2 then return jsonb_build_object('ok', true, 'rows', '[]'::jsonb); end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(jsonb_build_object('name', x.name, 'visits', x.visits, 'last', x.last, 'doctor', x.doctor, 'branch', x.branch)
                     order by x.rnk, x.last desc, x.name)
    from (
      select (array_agg(d.client order by d.created_at desc))[1] as name,
             count(*) as visits,
             max(d.day) as last,
             (array_agg(d.doctor order by d.created_at desc) filter (where d.doctor <> ''))[1] as doctor,
             (array_agg(b.name order by d.created_at desc))[1] as branch,
             min(case when apteka.skel(d.client) like q || '%' then 0 else 1 end) as rnk
      from docs d join branches b on b.id = d.branch_id
      where d.type = 'Расход' and d.status = 'Фаол' and d.client <> ''
        and position(q in apteka.skel(d.client)) > 0
      group by apteka.skel(d.client)
      order by rnk, max(d.day) desc
      limit 8
    ) x), '[]'::jsonb));
end $$;
