-- Règles d'accès : essai de 5 jours calendaires lié au numéro de téléphone.
-- Le serveur (ai-gateway) est le seul à lire et écrire cette table : aucune règle d'accès pour les étudiants.
create table if not exists public.trial_phones (
  phone text primary key check (phone ~ '^[0-9]{9,15}$'),
  started_at timestamptz not null default now()
);
alter table public.trial_phones enable row level security;
-- Pas de policy volontairement : seul le service_role (ai-gateway) y accède.
