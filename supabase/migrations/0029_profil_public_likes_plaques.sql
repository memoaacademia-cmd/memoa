-- 0029 : profil public de l'auteur (Librairie), bio, likes sur les documents, plaques.
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0028). Ré-exécutable sans erreur.
--
-- Ce fichier AJOUTE seulement : deux nouvelles tables et trois fonctions.
-- Aucune table existante (profiles, library_documents…) n'est modifiée, aucune règle existante n'est changée.
-- Les fonctions ne renvoient QUE des infos publiques choisies : photo, nom du Memo, université, faculté, promotion, bio, likes.
-- Le nom affiché est le « nom public » que l'étudiant choisit lui-même (sinon le nom de son Memo). Le vrai nom, le téléphone et l'e-mail ne sortent jamais.

-- ------------------------------------------------------------------ bio
create table if not exists public.profile_bios (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  bio text not null default '' check (char_length(bio) <= 160),
  updated_at timestamptz not null default now()
);
-- Nom public : le nom que l'étudiant veut montrer sur la Librairie (facultatif).
alter table public.profile_bios add column if not exists public_name text not null default '' check (char_length(public_name) <= 40);
alter table public.profile_bios enable row level security;
drop policy if exists "bio : lecture de la sienne" on public.profile_bios;
create policy "bio : lecture de la sienne" on public.profile_bios for select using (user_id = auth.uid());
drop policy if exists "bio : création de la sienne" on public.profile_bios;
create policy "bio : création de la sienne" on public.profile_bios for insert with check (user_id = auth.uid());
drop policy if exists "bio : modification de la sienne" on public.profile_bios;
create policy "bio : modification de la sienne" on public.profile_bios for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ----------------------------------------------------------------- likes
create table if not exists public.library_likes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  document_id uuid not null references public.library_documents (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, document_id)
);
create index if not exists library_likes_doc_idx on public.library_likes (document_id);
alter table public.library_likes enable row level security;
drop policy if exists "likes : lecture des siens" on public.library_likes;
create policy "likes : lecture des siens" on public.library_likes for select using (user_id = auth.uid());
-- On ne peut liker qu'un document publié (le sien compris).
drop policy if exists "likes : ajout" on public.library_likes;
create policy "likes : ajout" on public.library_likes for insert
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.library_documents d where d.id = document_id and d.status = 'published' and d.deleted_at is null)
  );
drop policy if exists "likes : retrait" on public.library_likes;
create policy "likes : retrait" on public.library_likes for delete using (user_id = auth.uid());

-- --------------------------------------------- likes d'une liste de documents
create or replace function public.library_social(doc_ids uuid[])
returns table (document_id uuid, like_count integer, liked_by_me boolean)
language sql stable security definer set search_path = public as $$
  select d.id,
         (select count(*)::int from public.library_likes l where l.document_id = d.id),
         exists (select 1 from public.library_likes l where l.document_id = d.id and l.user_id = auth.uid())
    from public.library_documents d
   where d.id = any (doc_ids) and d.status = 'published' and d.deleted_at is null
$$;
revoke all on function public.library_social(uuid[]) from public;
revoke all on function public.library_social(uuid[]) from anon;
grant execute on function public.library_social(uuid[]) to authenticated;

-- ------------------------------------ profil public des auteurs de documents
-- Seuls les étudiants qui ont au moins un document publié apparaissent.
-- (supprimée d'abord : sa liste de colonnes a changé ; ré-exécuter ce fichier en entier est sans risque)
drop function if exists public.library_authors(uuid[]);
create or replace function public.library_authors(owner_ids uuid[])
returns table (
  user_id uuid, public_name text, memo_name text, avatar_url text, university text, faculty text, promotion text,
  bio text, doc_count integer, total_likes integer, best_likes integer
)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(b.public_name, ''),
         coalesce(nullif(p.memo_name, ''), 'Memo'),
         p.avatar_url, p.university, p.faculty, p.promotion,
         coalesce(b.bio, ''),
         s.docs, s.total, s.best
    from public.profiles p
    left join public.profile_bios b on b.user_id = p.id
    join lateral (
      select count(*)::int as docs,
             coalesce(sum(c.n), 0)::int as total,
             coalesce(max(c.n), 0)::int as best
        from public.library_documents d
        left join lateral (select count(*)::int as n from public.library_likes l where l.document_id = d.id) c on true
       where d.owner_id = p.id and d.status = 'published' and d.deleted_at is null
    ) s on s.docs > 0
   where p.id = any (owner_ids)
$$;
revoke all on function public.library_authors(uuid[]) from public;
revoke all on function public.library_authors(uuid[]) from anon;
grant execute on function public.library_authors(uuid[]) to authenticated;

-- Vérifications (une par une) :
-- select * from public.library_authors(array[(select owner_id from public.library_documents where status = 'published' limit 1)]);
-- select policyname, cmd from pg_policies where tablename in ('library_likes', 'profile_bios');   -- 3 + 3 lignes
