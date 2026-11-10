-- Librairie : suppression par l'auteur, avec corbeille de 30 jours.
-- Un document supprimé est masqué pour tous (deleted_at rempli), restaurable par son auteur pendant 30 jours,
-- puis effacé pour de bon (fichier compris) à l'ouverture de la Librairie par son auteur.
alter table public.library_documents add column if not exists deleted_at timestamptz;
create index if not exists library_deleted_idx on public.library_documents (owner_id, deleted_at);

-- Les autres étudiants ne voient plus un document à la corbeille ; son auteur et l'équipe, oui.
drop policy if exists "librairie : lecture publiée, ses documents, ou admin" on public.library_documents;
create policy "librairie : lecture publiée, ses documents, ou admin" on public.library_documents for select
  using ((status = 'published' and deleted_at is null) or owner_id = auth.uid() or public.is_admin());

-- Même règle pour le fichier PDF lui-même.
drop policy if exists "librairie : lecture d'un fichier publié, ou le sien" on storage.objects;
create policy "librairie : lecture d'un fichier publié, ou le sien" on storage.objects for select to authenticated
  using (
    bucket_id = 'library' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
      or exists (select 1 from public.library_documents d where d.file_path = name and d.status = 'published' and d.deleted_at is null)
    )
  );

-- Mise à la corbeille / restauration : par une fonction qui ne touche QUE deleted_at
-- (un auteur ne peut donc pas modifier le statut de son document ni le republier s'il a été refusé).
create or replace function public.library_trash(doc_id uuid, trashed boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.library_documents
     set deleted_at = case when trashed then now() else null end
   where id = doc_id and owner_id = auth.uid();
  if not found then raise exception 'Document introuvable.'; end if;
end $$;
revoke all on function public.library_trash(uuid, boolean) from public;
grant execute on function public.library_trash(uuid, boolean) to authenticated;
-- La suppression définitive utilise les règles existantes : « suppression des siens » (ligne) et « suppression de ses fichiers » (PDF).
