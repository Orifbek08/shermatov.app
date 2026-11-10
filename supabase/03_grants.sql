-- Сайт (anon калит) фақат шу функцияни чақира олади
revoke all on function public.app(jsonb) from public;
grant execute on function public.app(jsonb) to anon, authenticated;
