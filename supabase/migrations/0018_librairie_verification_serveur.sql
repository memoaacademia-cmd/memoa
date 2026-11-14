-- 0018 : Librairie — vérification faite par le SERVEUR, et signalements plus difficiles à truquer.
--
-- 1) Un document déposé est d'abord « pending » (invisible des autres). C'est la passerelle (tâche review_doc,
--    qui lit elle-même le fichier PDF) qui le passe en « published », ou en « rejected » s'il est clairement n'importe quoi.
--    Avant, le document était publié tout de suite et la vérification dépendait du téléphone (texte envoyé par lui, appel facultatif).
-- 2) Signalements : seuls comptent ceux de comptes de plus de 7 jours ; on ne peut pas signaler son propre document ;
--    5 signalements par jour au maximum par étudiant. Trois faux comptes tout neufs ne peuvent donc plus masquer un document.
-- Ré-exécutable sans danger.

alter table public.library_documents alter column status set default 'pending';
drop policy if exists "librairie : dépôt (publié tout de suite)" on public.library_documents;
drop policy if exists "librairie : dépôt (toujours en attente)" on public.library_documents;
create policy "librairie : dépôt (toujours en attente)" on public.library_documents for insert
  with check (owner_id = auth.uid() and status = 'pending');

-- Signalement : pas son propre document, pas plus de 5 par jour.
create or replace function public.library_report_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.library_documents d where d.id = new.document_id and d.owner_id = new.user_id) then
    raise exception 'Tu ne peux pas signaler ton propre document.';
  end if;
  if (select count(*) from public.library_reports r where r.user_id = new.user_id and r.created_at > now() - interval '1 day') >= 5 then
    raise exception 'Trop de signalements aujourd''hui. Réessaie demain.';
  end if;
  return new;
end $$;
drop trigger if exists library_reports_guard on public.library_reports;
create trigger library_reports_guard before insert on public.library_reports
  for each row execute function public.library_report_guard();

-- Retrait automatique : au moins 3 signalements de comptes de plus de 7 jours.
create or replace function public.library_hide_if_reported() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.library_reports r
        join public.profiles p on p.id = r.user_id
       where r.document_id = new.document_id
         and p.created_at < now() - interval '7 days') >= 3 then
    update public.library_documents set status = 'rejected' where id = new.document_id and status = 'published';
  end if;
  return new;
end $$;
