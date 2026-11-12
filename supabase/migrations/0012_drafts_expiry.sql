-- Brouillons : le téléphone garde le TEXTE (jamais envoyé au serveur) ; ici on ne garde que l'heure à laquelle chaque brouillon disparaît,
-- pour envoyer une notification 5 h avant. Chaque étudiant ne voit et ne modifie que ses propres lignes.
create table if not exists public.drafts_expiry (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  draft_id text not null check (char_length(draft_id) between 8 and 64),
  device_id text not null check (char_length(device_id) between 1 and 64),
  expires_at timestamptz not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, draft_id)
);
create index if not exists drafts_expiry_due_idx on public.drafts_expiry (expires_at) where notified_at is null;
alter table public.drafts_expiry enable row level security;
create policy "brouillons : lecture des siens" on public.drafts_expiry for select using (user_id = auth.uid());
create policy "brouillons : ajout par soi" on public.drafts_expiry for insert with check (user_id = auth.uid());
create policy "brouillons : mise à jour des siens" on public.drafts_expiry for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "brouillons : retrait par soi" on public.drafts_expiry for delete using (user_id = auth.uid());
