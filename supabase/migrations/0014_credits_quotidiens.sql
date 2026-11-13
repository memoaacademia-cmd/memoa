-- Bloc 1 : crédits quotidiens (reset à 00h00 Kinshasa) et « session de TP » payée une seule fois.
-- À exécuter UNE fois dans Supabase > SQL Editor, AVANT de redéployer la fonction ai-gateway.
-- Rien ne change côté paiement. Aucune donnée existante n'est modifiée.

-- 1) Sessions de TP : un TP complet (plan + ajustements + rédaction) = 10 points au total.
--    Une session est créée UNIQUEMENT par le serveur après le paiement des 10 points ; l'étudiant ne peut pas en fabriquer.
create table if not exists public.tp_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  plans int not null default 0,
  revises int not null default 0,
  writes int not null default 0
);
create index if not exists tp_sessions_user_idx on public.tp_sessions (user_id, created_at desc);
-- Aucune règle d'accès : seule la fonction serveur (service_role) lit et écrit cette table.
alter table public.tp_sessions enable row level security;

-- 2) Réservation atomique de points. Le verrou par étudiant empêche de lancer plusieurs demandes en même temps
--    pour dépasser son solde (le solde est vérifié ET débité dans la même opération).
--    p_budget = null : pas de plafond (essai, Premium) ; sinon, solde maximum de la journée.
create or replace function public.reserve_ai_usage(
  p_user uuid, p_task text, p_points int, p_from timestamptz, p_budget int
) returns table (ok boolean, used int, row_id bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_used int := 0;
  v_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if p_budget is not null then
    select coalesce(sum(coalesce(u.points, case u.task
        when 'chat' then 1 when 'quiz' then 3 when 'tp_plan' then 10 when 'tp_write' then 10 when 'tp_revise' then 3
        when 'transcribe' then 3 when 'review_doc' then 0 else 4 end)), 0)
      into v_used
      from public.ai_usage u
     where u.user_id = p_user and u.created_at >= p_from and u.task <> 'review_doc';
    if v_used + p_points > p_budget then
      return query select false, v_used, null::bigint;
      return;
    end if;
  end if;
  insert into public.ai_usage (user_id, task, points) values (p_user, p_task, p_points) returning id into v_id;
  return query select true, v_used + p_points, v_id;
end $$;

-- 3) Utilisation d'une session de TP : atomique, avec des plafonds (1 plan à refaire jusqu'à 3 fois, 10 ajustements, 3 rédactions).
create or replace function public.use_tp_session(p_user uuid, p_session uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_kind = 'tp_plan' then
    update public.tp_sessions set plans = plans + 1 where id = p_session and user_id = p_user and expires_at > now() and plans < 3;
  elsif p_kind = 'tp_revise' then
    update public.tp_sessions set revises = revises + 1 where id = p_session and user_id = p_user and expires_at > now() and revises < 10;
  elsif p_kind = 'tp_write' then
    update public.tp_sessions set writes = writes + 1 where id = p_session and user_id = p_user and expires_at > now() and writes < 3;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Ces fonctions ne sont appelables que par le serveur (clé service_role), jamais depuis le téléphone.
revoke all on function public.reserve_ai_usage(uuid, text, int, timestamptz, int) from public, anon, authenticated;
revoke all on function public.use_tp_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, text, int, timestamptz, int) to service_role;
grant execute on function public.use_tp_session(uuid, uuid, text) to service_role;
