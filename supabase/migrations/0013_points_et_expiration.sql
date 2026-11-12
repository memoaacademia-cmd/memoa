-- Lot 3 : points par tâche (coût selon la longueur) et rappels d'expiration d'abonnement.
-- À exécuter UNE fois dans Supabase > SQL Editor.

-- 1) Coût réel en points de chaque demande à l'IA (les anciennes lignes restent vides : le serveur retombe sur le tarif de la tâche).
alter table public.ai_usage add column if not exists points int;

-- 2) Suivi des rappels envoyés : un seul rappel par palier et par date de fin d'abonnement.
create table if not exists public.expiry_notices (
  user_id uuid not null references auth.users(id) on delete cascade,
  tier text not null check (tier in ('7d', '2d', '0d')),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, tier, expires_at)
);
-- Aucune règle d'accès : seule la fonction serveur (clé service_role) lit et écrit cette table.
alter table public.expiry_notices enable row level security;
