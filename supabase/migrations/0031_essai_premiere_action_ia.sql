-- 0031 : l'essai de 5 jours démarre à la PREMIÈRE ACTION IA (plus à l'inscription, plus lié au numéro de téléphone).
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0030), AVANT de redéployer la fonction ai-gateway. Ré-exécutable sans erreur.
--
-- Une ligne par étudiant : la date de sa première action IA. Pas de ligne = l'essai n'a pas encore commencé.
-- Seule la fonction serveur (clé service) écrit dans cette table ; l'étudiant n'a aucun accès direct.

create table if not exists public.trial_starts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);
alter table public.trial_starts enable row level security;
-- Aucune règle d'accès : seule la clé de service (fonction ai-gateway) peut lire et écrire.

-- Comptes existants qui ont DÉJÀ utilisé l'IA : leur essai garde sa date d'avant (celle de l'inscription), rien ne change pour eux.
-- Les comptes qui n'ont jamais utilisé l'IA n'ont pas de ligne : leur essai de 5 jours commencera à leur première action IA.
insert into public.trial_starts (user_id, started_at)
select p.id, p.created_at
  from public.profiles p
 where exists (select 1 from public.ai_usage u where u.user_id = p.id)
on conflict (user_id) do nothing;

-- Vérification :
-- select count(*) from public.trial_starts;
