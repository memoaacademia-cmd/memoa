-- Librairie ouverte : un document est publié tout de suite. Il est retiré s'il est refusé par la vérification
-- automatique (ai-gateway, tâche review_doc) ou signalé par au moins 3 étudiants différents.
alter table public.library_documents alter column status set default 'published';
drop policy if exists "librairie : dépôt (toujours en attente)" on public.library_documents;
drop policy if exists "librairie : dépôt (publié tout de suite)" on public.library_documents;
create policy "librairie : dépôt (publié tout de suite)" on public.library_documents for insert
  with check (owner_id = auth.uid() and status = 'published');
-- Les documents déjà déposés et en attente sont publiés.
update public.library_documents set status = 'published' where status = 'pending';

create table if not exists public.library_reports (
  document_id uuid not null references public.library_documents (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reason text not null check (reason in ('inapproprie', 'pas_un_cours', 'droit_auteur', 'autre')),
  created_at timestamptz not null default now(),
  primary key (document_id, user_id)
);
alter table public.library_reports enable row level security;
drop policy if exists "signalements : envoi par soi" on public.library_reports;
create policy "signalements : envoi par soi" on public.library_reports for insert with check (user_id = auth.uid());
drop policy if exists "signalements : lecture admin" on public.library_reports;
create policy "signalements : lecture admin" on public.library_reports for select using (public.is_admin());

create or replace function public.library_hide_if_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.library_reports where document_id = new.document_id) >= 3 then
    update public.library_documents set status = 'rejected' where id = new.document_id and status = 'published';
  end if;
  return new;
end $$;
drop trigger if exists library_reports_hide on public.library_reports;
create trigger library_reports_hide after insert on public.library_reports
  for each row execute function public.library_hide_if_reported();
