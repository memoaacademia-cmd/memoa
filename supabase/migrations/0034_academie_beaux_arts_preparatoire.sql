-- 0034 : nouveau niveau « Préparatoire » (avant la L1) pour les profils et la Librairie.
-- À coller dans Supabase → SQL Editor → Run. Sans danger si on le relance.

do $$
declare c record;
begin
  -- Profils : on retire l'ancienne vérification sur la promotion (quel que soit son nom), puis on la recrée.
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%promotion%'
  loop
    execute format('alter table public.profiles drop constraint %I', c.conname);
  end loop;
  -- Librairie : idem.
  for c in select conname from pg_constraint
           where conrelid = 'public.library_documents'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) ilike '%promotion%'
  loop
    execute format('alter table public.library_documents drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.profiles
  add constraint profiles_promotion_check
    check (promotion in ('Préparatoire', 'L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat'));

alter table public.library_documents
  add constraint library_documents_promotion_check
    check (section = 'autre' or promotion in ('Préparatoire', 'L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat'));

-- Vérification : doit afficher 2 lignes contenant « Préparatoire ».
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as regle
from pg_constraint
where conname in ('profiles_promotion_check', 'library_documents_promotion_check');
