-- 0026 : correctifs de l'audit de sécurité du 16 novembre 2026.
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0025). Ré-exécutable sans erreur.
--   1) notifications : l'adresse d'envoi doit être celle d'un vrai service de notification (plus d'URL libre) ;
--   2) app_events / app_errors / feedback : limites anti-spam, et date d'enregistrement fixée par la base ;
--   3) Librairie : un fichier déjà lié à un document ne peut plus être remplacé ni supprimé côté étudiant tant que le document est publié ;
--   4) plafonds : 30 documents et 40 fichiers par étudiant dans la Librairie.

-- ------------------------------------------------------------------ 1) notifications
-- Chrome/Android : fcm.googleapis.com (ou *.google.com) · Firefox : *.push.services.mozilla.com · Edge : *.notify.windows.com · Safari/iPhone : *.push.apple.com
-- Les anciennes lignes qui ne respectent pas cette règle sont retirées (le téléphone se réabonne tout seul à la prochaine ouverture).
delete from public.push_subscriptions
 where endpoint !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.google\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/';
alter table public.push_subscriptions drop constraint if exists push_endpoint_host_check;
alter table public.push_subscriptions add constraint push_endpoint_host_check
  check (endpoint ~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.google\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com|[a-z0-9.-]+\.push\.apple\.com)/');

-- ------------------------------------------------------------------ 2) anti-spam
-- app_events : la date doit être récente (3 jours au plus, jamais dans le futur) sinon c'est l'heure du serveur ;
-- 600 par heure (déjà là) et maintenant 4000 par 3 jours et par étudiant. Les suivants sont ignorés SANS erreur.
create or replace function public.app_events_throttle() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_at is null or new.created_at > now() or new.created_at < now() - interval '3 days' then
    new.created_at := now();
  end if;
  if (select count(*) from public.app_events e where e.user_id = new.user_id and e.created_at > now() - interval '1 hour') >= 600 then
    return null;
  end if;
  if (select count(*) from public.app_events e where e.user_id = new.user_id and e.created_at > now() - interval '3 days') >= 4000 then
    return null;
  end if;
  return new;
end $$;

-- app_errors : 60 erreurs par heure et par étudiant connecté ; 100 par 10 minutes pour tous les envois sans compte. Les suivantes sont ignorées sans erreur.
create index if not exists app_errors_user_idx on public.app_errors (user_id, created_at desc);
create or replace function public.app_errors_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if new.user_id is not null then
    if (select count(*) from public.app_errors e where e.user_id = new.user_id and e.created_at > now() - interval '1 hour') >= 60 then return null; end if;
  else
    if (select count(*) from public.app_errors e where e.user_id is null and e.created_at > now() - interval '10 minutes') >= 100 then return null; end if;
  end if;
  return new;
end $$;
drop trigger if exists app_errors_guard on public.app_errors;
create trigger app_errors_guard before insert on public.app_errors for each row execute function public.app_errors_guard();

-- feedback : 10 envois par jour et par étudiant.
create or replace function public.feedback_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.created_at := now();
  if (select count(*) from public.feedback f where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Trop d''envois aujourd''hui. Réessaie demain.';
  end if;
  return new;
end $$;
drop trigger if exists feedback_guard on public.feedback;
create trigger feedback_guard before insert on public.feedback for each row execute function public.feedback_guard();

-- ------------------------------------------------------------------ 3) Librairie : plus d'échange de fichier après vérification
-- Dépôt : dans son dossier, vers un chemin pas encore lié à un document, et pas plus de 40 fichiers par étudiant.
drop policy if exists "librairie : dépôt dans son dossier" on storage.objects;
create policy "librairie : dépôt dans son dossier" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.library_documents d where d.file_path = name)
    and (select count(*) from storage.objects o where o.bucket_id = 'library' and (storage.foldername(o.name))[1] = auth.uid()::text) < 40
  );

-- Suppression côté étudiant : seulement si le document n'est pas publié (en attente, refusé ou à la corbeille). Un document publié passe d'abord par la corbeille.
drop policy if exists "librairie : suppression de ses fichiers" on storage.objects;
create policy "librairie : suppression de ses fichiers" on storage.objects for delete to authenticated
  using (
    bucket_id = 'library'
    and (storage.foldername(name))[1] = auth.uid()::text
    and not exists (select 1 from public.library_documents d where d.file_path = name and d.status = 'published' and d.deleted_at is null)
  );

-- ------------------------------------------------------------------ 4) plafond de documents
create or replace function public.library_docs_cap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.library_documents d where d.owner_id = new.owner_id and d.deleted_at is null) >= 30 then
    raise exception 'Tu as déjà 30 documents dans la Librairie. Supprime-en un avant d''en ajouter un autre.';
  end if;
  return new;
end $$;
drop trigger if exists library_docs_cap_trg on public.library_documents;
create trigger library_docs_cap_trg before insert on public.library_documents for each row execute function public.library_docs_cap();

-- ------------------------------------------------------------------ vérifications (à lancer après, une par une)
-- select conname from pg_constraint where conname = 'push_endpoint_host_check';                       -- 1 ligne
-- select tgname from pg_trigger where tgname in ('app_errors_guard','feedback_guard','library_docs_cap_trg','app_events_throttle'); -- 4 lignes
-- select policyname, cmd from pg_policies where schemaname = 'storage' and policyname like 'librairie%'; -- dépôt (INSERT) et suppression (DELETE) présents
