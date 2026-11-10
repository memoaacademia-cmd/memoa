-- Mémoire des taquineries en lingala de Memo : sert à ne jamais répéter une phrase trop tôt (délai de repos par phrase).
-- Seul le serveur (ai-gateway) lit et écrit cette table : aucune règle d'accès pour les étudiants, volontairement.
create table if not exists public.lingala_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  phrase_id text not null check (phrase_id ~ '^L[0-9]{3}$'),
  used_at timestamptz not null default now()
);
create index if not exists lingala_uses_idx on public.lingala_uses (user_id, phrase_id, used_at desc);
alter table public.lingala_uses enable row level security;
