-- Memoa — schéma initial. À exécuter dans Supabase (SQL Editor) ou via `supabase db push`.
-- Principe : toute autorisation est appliquée ICI (RLS), jamais dans le navigateur.
-- Les écritures sensibles (paiements, abonnements, historique IA) ne sont possibles que par les fonctions
-- serveur (clé service_role), jamais par un étudiant.

-- ------------------------------------------------------------------ outils
create table public.app_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.app_admins enable row level security;
-- Aucune policy : seul le service_role (et l'éditeur SQL) lit/écrit cette table.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- profils
-- Modèle académique : Université → Faculté → Département → Vacation → Promotion.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 100),
  phone text check (phone is null or phone ~ '^\+?[0-9]{9,15}$'),
  university text not null default '' check (char_length(university) <= 120),
  faculty text not null default '' check (char_length(faculty) <= 160),
  department text not null default '' check (char_length(department) <= 160),
  promotion text not null default 'L1' check (promotion in ('L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat')),
  vacation text not null default 'Vacation jour' check (vacation in ('Vacation jour', 'Vacation soir', 'Vacation A', 'Vacation B', 'Vacation C')),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  memo_animal text check (memo_animal is null or memo_animal in ('hibou', 'okapi', 'leopard', 'lion', 'elephant', 'bonobo', 'perroquet', 'tortue')),
  memo_name text check (memo_name is null or char_length(memo_name) between 1 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
alter table public.profiles enable row level security;
create policy "profil : lecture de soi" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profil : création de soi" on public.profiles for insert with check (id = auth.uid());
create policy "profil : modification de soi" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------- cours et notes (sac à dos)
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  created_at timestamptz not null default now()
);
create index courses_user_idx on public.courses (user_id, created_at desc);
alter table public.courses enable row level security;
create policy "cours : lecture des siens" on public.courses for select using (user_id = auth.uid());
create policy "cours : création" on public.courses for insert with check (user_id = auth.uid());
create policy "cours : modification" on public.courses for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "cours : suppression" on public.courses for delete using (user_id = auth.uid());

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Note' check (char_length(title) <= 80),
  content text not null check (char_length(content) between 1 and 60000),
  source text not null default 'texte' check (source in ('texte', 'voix', 'audio', 'video', 'pdf', 'photo')),
  created_at timestamptz not null default now()
);
create index notes_course_idx on public.notes (course_id, created_at desc);
alter table public.notes enable row level security;
create policy "notes : lecture des siennes" on public.notes for select using (user_id = auth.uid());
create policy "notes : création dans un de ses cours" on public.notes for insert
  with check (user_id = auth.uid() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "notes : modification" on public.notes for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "notes : suppression" on public.notes for delete using (user_id = auth.uid());

-- --------------------------------------------------------------- librairie
-- Rangée par PROMOTION (L1 … Doctorat) ; pas de niveau « département » (décision produit).
create table public.library_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  doc_type text not null default 'Cours' check (doc_type in ('Cours', 'TP', 'Examen', 'Résumé', 'Autre')),
  university text not null default '' check (char_length(university) <= 120),
  faculty text not null check (char_length(faculty) between 1 and 160),
  promotion text not null check (promotion in ('L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat')),
  course_title text not null default '' check (char_length(course_title) <= 100),
  file_path text check (file_path is null or file_path like owner_id::text || '/%'),
  -- Un document n'est visible des autres qu'après validation par l'équipe Memoa (droits d'auteur, spam, fichiers dangereux).
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now()
);
create index library_idx on public.library_documents (promotion, faculty, created_at desc) where status = 'published';
alter table public.library_documents enable row level security;
create policy "librairie : lecture publiée, ses documents, ou admin" on public.library_documents for select
  using (status = 'published' or owner_id = auth.uid() or public.is_admin());
create policy "librairie : dépôt (toujours en attente)" on public.library_documents for insert
  with check (owner_id = auth.uid() and status = 'pending');
create policy "librairie : suppression des siens" on public.library_documents for delete using (owner_id = auth.uid() or public.is_admin());
create policy "librairie : validation par un admin" on public.library_documents for update using (public.is_admin()) with check (public.is_admin());

create table public.library_favorites (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.library_documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
alter table public.library_favorites enable row level security;
create policy "favoris : lecture des siens" on public.library_favorites for select using (user_id = auth.uid());
create policy "favoris : ajout" on public.library_favorites for insert with check (user_id = auth.uid());
create policy "favoris : retrait" on public.library_favorites for delete using (user_id = auth.uid());

-- ------------------------------------------------------- flammes (régularité)
create table public.activity_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.activity_days enable row level security;
create policy "activité : lecture des siennes" on public.activity_days for select using (user_id = auth.uid());
-- Empêche de falsifier sa série en inscrivant des jours passés ou lointains.
create policy "activité : aujourd'hui seulement" on public.activity_days for insert
  with check (user_id = auth.uid() and day between current_date - 1 and current_date + 1);

-- ------------------------------------------------------------ assistant IA
-- Lecture par l'étudiant ; ÉCRITURE uniquement par la fonction serveur ai-gateway (service_role).
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 120),
  created_at timestamptz not null default now()
);
create index ai_conv_idx on public.ai_conversations (user_id, created_at desc);
alter table public.ai_conversations enable row level security;
create policy "ia : conversations lisibles par leur auteur" on public.ai_conversations for select using (user_id = auth.uid());
create policy "ia : suppression de ses conversations" on public.ai_conversations for delete using (user_id = auth.uid());

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index ai_msg_idx on public.ai_messages (conversation_id, created_at);
alter table public.ai_messages enable row level security;
create policy "ia : messages lisibles par leur auteur" on public.ai_messages for select using (user_id = auth.uid());

-- Suivi de consommation : base des quotas, du rate limiting et du coût par utilisateur.
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  task text not null,
  model text not null default '',
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_idx on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;
create policy "ia : usage visible par l'admin" on public.ai_usage for select using (public.is_admin());

-- ----------------------------------------------- paiements et abonnements
-- Aucune écriture côté étudiant : seules payments-initiate et payments-webhook (service_role) écrivent.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('orange', 'airtel', 'mpesa')),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null check (currency in ('USD', 'CDF')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  provider_ref text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_user_idx on public.payments (user_id, created_at desc);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();
alter table public.payments enable row level security;
create policy "paiements : lecture des siens ou admin" on public.payments for select using (user_id = auth.uid() or public.is_admin());

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "abonnement : lecture du sien ou admin" on public.subscriptions for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- stockage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']),
  ('library', 'library', false, 20971520, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Le premier dossier d'un chemin est l'identifiant de l'étudiant : <uid>/fichier
create policy "avatars : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars : remplacement dans son dossier" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars : suppression dans son dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "librairie : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "librairie : lecture d'un fichier publié, ou le sien" on storage.objects for select to authenticated
  using (
    bucket_id = 'library' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (select 1 from public.library_documents d where d.file_path = name and d.status = 'published')
    )
  );
create policy "librairie : suppression de ses fichiers" on storage.objects for delete to authenticated
  using (bucket_id = 'library' and (storage.foldername(name))[1] = auth.uid()::text);
