-- 0021 : journal serveur de l'IA (tâche 6 du bloc 2).
-- Sert à : (1) compter les recherches web par étudiant et par jour (plafonds), (2) voir quels modèles répondent ou tombent,
-- (3) compter les images générées par jour (tâche 9), (4) garder une trace des refus « IA coupée » / « IA saturée ».
-- Écriture : uniquement la fonction serveur (service role). Aucun étudiant ne peut lire ni écrire ; l'équipe (admin) peut lire.
-- Réexécutable sans erreur.

create table if not exists public.ai_log (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  -- ai_fail (échec d'un modèle) | ai_off (IA coupée) | web_search (une recherche web faite) | web_off | web_limit | image_ok | image_fail | image_denied | image_limit (tâche 9)
  kind text not null,
  task text,
  model text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists ai_log_kind_idx on public.ai_log (kind, created_at desc);
create index if not exists ai_log_user_idx on public.ai_log (user_id, kind, created_at desc);

alter table public.ai_log enable row level security;

drop policy if exists "journal ia : lecture admin" on public.ai_log;
create policy "journal ia : lecture admin" on public.ai_log for select to authenticated using (public.is_admin());
-- Aucune politique d'insertion / modification / suppression : seul le service role (fonction serveur) écrit.

-- Vue pratique pour le tableau de bord Supabase (lecture par l'équipe, dans l'éditeur SQL) : par jour de Kinshasa et par modèle,
-- combien de réponses réussies (table ai_usage, où le modèle qui a répondu est enregistré) et combien d'échecs (table ai_log).
drop view if exists public.ai_model_health;
create view public.ai_model_health as
select jour, modele, sum(reussites)::int as reussites, sum(echecs)::int as echecs
from (
  select (created_at at time zone 'Africa/Kinshasa')::date as jour, coalesce(nullif(model, ''), '(inconnu)') as modele, 1 as reussites, 0 as echecs
  from public.ai_usage where model <> ''
  union all
  select (created_at at time zone 'Africa/Kinshasa')::date, coalesce(nullif(model, ''), '(inconnu)'), 0, 1
  from public.ai_log where kind = 'ai_fail'
) t
group by jour, modele
order by jour desc, modele;

revoke all on public.ai_model_health from anon, authenticated;

-- ---------------------------------------------------------------- images générées par Memo (tâche 9, Premium)
-- Bucket privé « ai-images » : <uid>/<fichier>.png. Seule la fonction serveur (service role) dépose les images ;
-- l'étudiant peut seulement LIRE les siennes (adresse signée temporaire). Les fichiers sont effacés avec le compte (account-delete).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('ai-images', 'ai-images', false, 8388608, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "images ia : lecture dans son dossier" on storage.objects;
create policy "images ia : lecture dans son dossier" on storage.objects for select to authenticated
  using (bucket_id = 'ai-images' and (storage.foldername(name))[1] = auth.uid()::text);
