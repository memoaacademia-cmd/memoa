-- 0025 : rappels de révision par notification (cartes neuves et cartes à réviser).
-- Une ligne par étudiant garde « quand on l'a prévenu » et « combien de rappels d'affilée sans qu'il révise », pour ne jamais l'harceler.
-- Aucune règle d'accès : seul le serveur (service_role) lit et écrit ici. Réexécutable sans erreur.

create table if not exists public.card_push_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_sent_at timestamptz,
  ignored int not null default 0 check (ignored >= 0)
);
alter table public.card_push_state enable row level security;

-- Pour chaque étudiant qui a des cartes à réviser aujourd'hui (jour de Kinshasa) : combien, combien de neuves, dans quel cours,
-- quand on l'a prévenu pour la dernière fois, et s'il a révisé depuis. Les cours dans la corbeille sont ignorés.
create or replace function public.cards_reminder_candidates()
returns table (uid uuid, due_n int, fresh_n int, fresh_courses int, top_title text, sent_at timestamptz, ignored_n int, reviewed_since boolean)
language sql stable security definer set search_path = public
as $$
  with today as (select (now() at time zone 'Africa/Kinshasa')::date as d),
  per_course as (
    select rc.user_id as u, rc.course_id, c.title as title,
      count(*)::int as due,
      count(*) filter (
        where rc.last_review is null
          and rc.created_at < now() - interval '1 hour'
          and rc.created_at > coalesce(s.last_sent_at, '-infinity'::timestamptz)
      )::int as fresh
    from public.review_cards rc
    join public.courses c on c.id = rc.course_id and c.deleted_at is null
    left join public.card_push_state s on s.user_id = rc.user_id
    cross join today
    where rc.due_date <= today.d
    group by rc.user_id, rc.course_id, c.title, s.last_sent_at
  )
  select p.u,
    sum(p.due)::int,
    sum(p.fresh)::int,
    (count(*) filter (where p.fresh > 0))::int,
    (array_agg(p.title order by p.fresh desc, p.due desc))[1],
    s.last_sent_at,
    coalesce(s.ignored, 0),
    coalesce(
      (select max(r.last_review) from public.review_cards r where r.user_id = p.u) >= (s.last_sent_at at time zone 'Africa/Kinshasa')::date,
      false
    )
  from per_course p
  left join public.card_push_state s on s.user_id = p.u
  group by p.u, s.last_sent_at, s.ignored
$$;
revoke all on function public.cards_reminder_candidates() from public, anon, authenticated;
grant execute on function public.cards_reminder_candidates() to service_role;
