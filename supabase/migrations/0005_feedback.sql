-- Avis (note) et signalements de problèmes envoyés depuis l'application.
-- L'étudiant peut seulement écrire (pas relire) ; Memoa lit dans le tableau de bord Supabase.
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea', 'other', 'rating')),
  rating smallint check (rating between 1 and 5),
  message text not null default '' check (char_length(message) <= 2000),
  user_agent text check (char_length(user_agent) <= 300),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on public.feedback (created_at desc);
alter table public.feedback enable row level security;
create policy "retours : envoi par soi" on public.feedback for insert with check (user_id = auth.uid());
create policy "retours : lecture admin" on public.feedback for select using (public.is_admin());
