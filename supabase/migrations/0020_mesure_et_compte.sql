-- 0020 : mesure d'usage (app_events), rapport d'erreurs (app_errors) et suppression de compte.
-- À exécuter UNE fois dans Supabase > SQL Editor. Ré-exécutable sans erreur. Ne modifie aucune ancienne migration.
--
-- 1) app_events / app_errors : l'étudiant peut seulement INSÉRER ses lignes (jamais lire ni modifier).
--    Tu lis tout depuis le tableau de bord Supabase (ou supabase/stats.sql).
-- 2) trial_phone_hashes : empreinte NON réversible d'un numéro dont le compte a été supprimé (« essai déjà utilisé »).
-- 3) Suppression de compte : les documents publiés dans la Librairie et les paiements survivent au compte,
--    détachés de la personne (owner_id / user_id deviennent NULL au lieu de bloquer ou de tout effacer).

-- ------------------------------------------------------------ événements d'usage
create table if not exists public.app_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_]{1,59}$'),
  props jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and octet_length(props::text) <= 1500),
  created_at timestamptz not null default now()
);
create index if not exists app_events_name_idx on public.app_events (name, created_at desc);
create index if not exists app_events_user_idx on public.app_events (user_id, created_at desc);
alter table public.app_events enable row level security;
drop policy if exists "événements : envoi par soi" on public.app_events;
create policy "événements : envoi par soi" on public.app_events for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "événements : lecture admin" on public.app_events;
create policy "événements : lecture admin" on public.app_events for select to authenticated using (public.is_admin());

-- Anti-spam : au-delà de 600 événements par heure et par étudiant, les suivants sont ignorés SANS erreur (le lot ne échoue pas).
create or replace function public.app_events_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.app_events e where e.user_id = new.user_id and e.created_at > now() - interval '1 hour') >= 600 then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists app_events_throttle on public.app_events;
create trigger app_events_throttle before insert on public.app_events for each row execute function public.app_events_throttle();

-- ------------------------------------------------------------ rapport d'erreurs
create table if not exists public.app_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  message text not null check (char_length(message) between 1 and 600),
  stack text check (stack is null or char_length(stack) <= 4000),
  route text check (route is null or char_length(route) <= 200),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
alter table public.app_errors enable row level security;
-- Une erreur peut survenir avant la connexion : alors user_id reste vide.
drop policy if exists "erreurs : envoi" on public.app_errors;
create policy "erreurs : envoi" on public.app_errors for insert to anon, authenticated with check (user_id is null or user_id = auth.uid());
drop policy if exists "erreurs : lecture admin" on public.app_errors;
create policy "erreurs : lecture admin" on public.app_errors for select to authenticated using (public.is_admin());

-- ------------------------------------------------------------ essai déjà utilisé (numéros supprimés)
-- hash = HMAC-SHA256(numéro en chiffres, secret serveur PHONE_HASH_SECRET), en hexadécimal. Le numéro lui-même n'est PAS conservé.
-- Seul le serveur (service_role) lit et écrit cette table : aucune règle d'accès pour les étudiants, volontairement.
create table if not exists public.trial_phone_hashes (
  phone_hash text primary key check (phone_hash ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.trial_phone_hashes enable row level security;

-- ------------------------------------------------------------ données qui survivent au compte (anonymisées)
-- Librairie : un document publié reste disponible, sans auteur.
alter table public.library_documents alter column owner_id drop not null;
alter table public.library_documents drop constraint if exists library_documents_owner_id_fkey;
alter table public.library_documents add constraint library_documents_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

-- Paiements : on garde montant, date, statut et référence de transaction pour la comptabilité, sans lien avec la personne.
alter table public.payments alter column user_id drop not null;
alter table public.payments drop constraint if exists payments_user_id_fkey;
alter table public.payments add constraint payments_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete set null;

-- ------------------------------------------------------------ suppression de compte : fichiers de la Librairie qui restent
-- Les PDF d'une Librairie publiée restent après la suppression de leur auteur. Pour que la suppression du compte ne soit pas bloquée
-- par un « propriétaire » de fichier, on détache le propriétaire. Appelée seulement par la fonction serveur (service_role).
create or replace function public.release_storage_owner(p_user uuid) returns void
language plpgsql security definer set search_path = public, storage as $$
begin
  begin
    update storage.objects set owner_id = null where bucket_id = 'library' and owner_id = p_user::text;
  exception when undefined_column then null;
  end;
  begin
    update storage.objects set owner = null where bucket_id = 'library' and owner = p_user;
  exception when undefined_column then null;
  end;
end $$;
revoke all on function public.release_storage_owner(uuid) from public, anon, authenticated;
grant execute on function public.release_storage_owner(uuid) to service_role;
