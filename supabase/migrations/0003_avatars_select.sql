-- Lecture des photos de profil dans son propre dossier (existait seulement dans Supabase).
drop policy if exists "avatars : lecture dans son dossier" on storage.objects;
create policy "avatars : lecture dans son dossier" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
