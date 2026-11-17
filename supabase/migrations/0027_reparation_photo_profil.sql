-- 0027 : répare l'envoi de la photo de profil (erreur « The database schema is invalid or incompatible »).
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0026). Ré-exécutable sans erreur.
--
-- CAUSE : la règle « librairie : dépôt dans son dossier » de la 0026 contenait une sous-requête sur storage.objects,
-- c'est-à-dire sur la table même qu'elle protège. PostgreSQL refuse ce genre de règle (« infinite recursion detected in policy »)
-- et, comme toutes les règles d'un même type sont évaluées ensemble, CHAQUE dépôt de fichier échouait, photo de profil comprise.
-- CORRECTIF : on retire la sous-requête sur storage.objects. Le plafond de 30 documents par étudiant (déclencheur library_docs_cap)
-- reste en place ; la protection contre l'échange de fichier (H2) aussi (chemin déjà lié à un document = dépôt refusé).

drop policy if exists "librairie : dépôt dans son dossier" on storage.objects;
create policy "librairie : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.library_documents d where d.file_path = name)
  );

-- Les règles des photos de profil sont remises à l'identique de la 0001 (au cas où elles auraient été touchées) :
drop policy if exists "avatars : dépôt dans son dossier" on storage.objects;
create policy "avatars : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars : remplacement dans son dossier" on storage.objects;
create policy "avatars : remplacement dans son dossier" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars : suppression dans son dossier" on storage.objects;
create policy "avatars : suppression dans son dossier" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars : lecture dans son dossier" on storage.objects;
create policy "avatars : lecture dans son dossier" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Vérifications (à lancer ensuite, une par une) :
-- select policyname, cmd, with_check from pg_policies where schemaname = 'storage' and policyname like 'librairie : dépôt%';  -- le texte ne doit PAS contenir « storage.objects »
-- select policyname, cmd from pg_policies where schemaname = 'storage' and policyname like 'avatars%';                         -- 4 lignes : INSERT, UPDATE, DELETE, SELECT
-- select id, public, allowed_mime_types from storage.buckets where id = 'avatars';                                             -- 1 ligne, public = true
