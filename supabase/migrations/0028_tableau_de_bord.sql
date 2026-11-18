-- 0028 : tableau de bord de l'application (lecture seule, réservée aux administrateurs de l'app).
-- Ne modifie AUCUNE règle de sécurité existante : ajoute seulement une fonction de lecture, qui refuse tout compte absent de public.app_admins
-- (la même liste que public.is_admin(), déjà utilisée par la migration 0001). Réexécutable sans erreur.

create or replace function public.app_stats(days int default 30)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d int := least(greatest(coalesce(days, 30), 1), 365);
  since timestamptz := now() - make_interval(days => d);
  today date := (now() at time zone 'Africa/Kinshasa')::date;
  res jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'days', d,
    'generated_at', now(),

    'totals', jsonb_build_object(
      'students', (select count(*) from public.profiles),
      'signups', (select count(*) from public.profiles where created_at >= since),
      'active', (select count(distinct user_id) from public.app_events where name = 'app_open' and created_at >= since),
      'active_today', (select count(distinct user_id) from public.app_events where name = 'app_open' and (created_at at time zone 'Africa/Kinshasa')::date = today),
      'premium', (select count(*) from public.subscriptions where expires_at > now()),
      'paid', (select count(*) from public.payments where status = 'paid' and created_at >= since),
      'errors', (select count(*) from public.app_errors where created_at >= since)
    ),

    'revenue', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.currency, 'n', q.total) order by q.total desc)
      from (select currency, sum(amount) as total from public.payments where status = 'paid' and created_at >= since group by 1) q
    ), '[]'::jsonb),

    -- une ligne par jour (même sans activité), jours de Kinshasa
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(g.day, 'YYYY-MM-DD'), 'signups', coalesce(s.n, 0), 'active', coalesce(a.n, 0)) order by g.day)
      from (select generate_series(today - (d - 1), today, interval '1 day')::date as day) g
      left join (select (created_at at time zone 'Africa/Kinshasa')::date as day, count(*) as n from public.profiles group by 1) s on s.day = g.day
      left join (select (created_at at time zone 'Africa/Kinshasa')::date as day, count(distinct user_id) as n from public.app_events where name = 'app_open' group by 1) a on a.day = g.day
    ), '[]'::jsonb),

    -- retour aux jours 1, 3 et 5 : seulement les inscrits de la période dont le jour J+k est déjà arrivé
    'retention', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.k, 'eligible', x.eligible, 'returned', x.returned) order by x.k)
      from (
        select k,
          (select count(*) from public.profiles p
             where p.created_at >= since and (p.created_at at time zone 'Africa/Kinshasa')::date + k <= today) as eligible,
          (select count(*) from public.profiles p
             where p.created_at >= since and (p.created_at at time zone 'Africa/Kinshasa')::date + k <= today
               and exists (select 1 from public.app_events e
                           where e.user_id = p.id and e.name = 'app_open'
                             and (e.created_at at time zone 'Africa/Kinshasa')::date = (p.created_at at time zone 'Africa/Kinshasa')::date + k)) as returned
        from unnest(array[1, 3, 5]) as k
      ) x
    ), '[]'::jsonb),

    -- parcours (toutes dates) : étudiants distincts à chaque étape
    'funnel', jsonb_build_object(
      'signed_up', (select count(*) from public.profiles where university <> ''),
      'memo', (select count(*) from public.profiles where memo_animal is not null),
      'course', (select count(distinct user_id) from public.courses),
      'asked_ai', (select count(distinct user_id) from public.ai_usage where task = 'chat'),
      'payment_started', (select count(distinct user_id) from public.app_events where name = 'payment_started'),
      'paid', (select count(distinct user_id) from public.payments where status = 'paid')
    ),

    'features', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.name, 'n', q.n, 'users', q.u) order by q.n desc)
      from (select name, count(*) as n, count(distinct user_id) as u from public.app_events
            where name <> 'app_open' and created_at >= since group by 1 order by 2 desc limit 15) q
    ), '[]'::jsonb),

    'ai_tasks', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.task, 'n', q.n, 'users', q.u) order by q.n desc)
      from (select task, count(*) as n, count(distinct user_id) as u from public.ai_usage
            where created_at >= since group by 1 order by 2 desc limit 10) q
    ), '[]'::jsonb),

    'ai_models', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.m, 'ok', q.ok, 'fail', q.fail) order by q.ok + q.fail desc)
      from (
        select m, sum(ok)::int as ok, sum(fail)::int as fail from (
          select coalesce(nullif(model, ''), '(inconnu)') as m, 1 as ok, 0 as fail from public.ai_usage where created_at >= since and model <> ''
          union all
          select coalesce(nullif(model, ''), '(inconnu)'), 0, 1 from public.ai_log where kind = 'ai_fail' and created_at >= since
        ) t group by m order by sum(ok) + sum(fail) desc limit 12
      ) q
    ), '[]'::jsonb),

    'ai_events', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.kind, 'n', q.n) order by q.n desc)
      from (select kind, count(*) as n from public.ai_log where created_at >= since group by 1 order by 2 desc limit 12) q
    ), '[]'::jsonb),

    'errors_top', coalesce((
      select jsonb_agg(jsonb_build_object('label', q.msg, 'n', q.n, 'users', q.u) order by q.n desc)
      from (select left(message, 140) as msg, count(*) as n, count(distinct user_id) as u from public.app_errors
            where created_at >= since group by 1 order by 2 desc limit 10) q
    ), '[]'::jsonb)
  ) into res;

  return res;
end;
$$;

revoke all on function public.app_stats(int) from public, anon;
grant execute on function public.app_stats(int) to authenticated;

-- ===================== SI TON COMPTE N'EST PAS ENCORE ADMINISTRATEUR DE L'APP =====================
-- (à lancer SEUL, avec l'e-mail de ton compte étudiant Memoa ; sans effet si tu y es déjà)
--   insert into public.app_admins (user_id) select id from auth.users where lower(email) = lower('TON_EMAIL') on conflict do nothing;
