-- 0030 : les ÉTOILES remplacent les likes dans la Librairie.
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0029). Ré-exécutable sans erreur.
--
-- Un document a autant d'étoiles que d'étudiants qui l'ont mis en favori (table library_favorites, déjà existante).
-- Les plaques (Bronze 100, Or 500, Diamant 1000, Émeraude 1500, Rubis 2000) se calculent donc sur les étoiles.
-- Les noms des colonnes renvoyées ne changent pas (like_count, liked_by_me, total_likes, best_likes) : l'appli les lit comme avant.
-- Rien n'est supprimé : la table library_likes reste en place, simplement n'est plus utilisée.

-- Étoiles d'une liste de documents (nombre + « je l'ai étoilé »).
create or replace function public.library_social(doc_ids uuid[])
returns table (document_id uuid, like_count integer, liked_by_me boolean)
language sql stable security definer set search_path = public as $$
  select d.id,
         (select count(*)::int from public.library_favorites f where f.document_id = d.id),
         exists (select 1 from public.library_favorites f where f.document_id = d.id and f.user_id = auth.uid())
    from public.library_documents d
   where d.id = any (doc_ids) and d.status = 'published' and d.deleted_at is null
$$;
revoke all on function public.library_social(uuid[]) from public;
revoke all on function public.library_social(uuid[]) from anon;
grant execute on function public.library_social(uuid[]) to authenticated;

-- Profil public des auteurs : total et meilleur document, en étoiles.
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
        left join lateral (select count(*)::int as n from public.library_favorites f where f.document_id = d.id) c on true
       where d.owner_id = p.id and d.status = 'published' and d.deleted_at is null
    ) s on s.docs > 0
   where p.id = any (owner_ids)
$$;
revoke all on function public.library_authors(uuid[]) from public;
revoke all on function public.library_authors(uuid[]) from anon;
grant execute on function public.library_authors(uuid[]) to authenticated;

-- Vérification :
-- select * from public.library_social(array[(select id from public.library_documents where status = 'published' limit 1)]);
