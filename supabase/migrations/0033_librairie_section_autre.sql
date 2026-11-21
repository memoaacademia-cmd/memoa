-- 0033 : Librairie — nouvelle section « Autre » (livres, compositions personnelles, textes qui ne sont pas un cours d'une promotion).
-- À exécuter UNE fois dans Supabase > SQL Editor (après la 0032), AVANT d'utiliser le bouton « Autre » de l'application. Ré-exécutable sans erreur.
--
-- Ce que ça change, et rien d'autre :
--  1) Une colonne « section » : 'academique' (valeur par défaut : tous les documents actuels) ou 'autre'.
--  2) Un document de la section « Autre » n'a pas besoin de faculté ni de promotion (avant, la base les exigeait pour tout document).
--  3) Deux nouveaux genres de document : « Livre » et « Composition ».
-- Les documents existants ne bougent pas. Aucune règle de sécurité (RLS) n'est modifiée.

alter table public.library_documents
  add column if not exists section text not null default 'academique';

-- On retire les anciennes vérifications sur faculté, promotion, genre et section (quel que soit leur nom), puis on les recrée.
do $$
declare c record;
begin
  for c in
    select conname
      from pg_constraint
     where conrelid = 'public.library_documents'::regclass
       and contype = 'c'
       and (   pg_get_constraintdef(oid) ilike '%promotion%'
            or pg_get_constraintdef(oid) ilike '%faculty%'
            or pg_get_constraintdef(oid) ilike '%doc_type%'
            or pg_get_constraintdef(oid) ilike '%section%')
  loop
    execute format('alter table public.library_documents drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.library_documents
  add constraint library_documents_section_check
    check (section in ('academique', 'autre')),
  add constraint library_documents_doc_type_check
    check (doc_type in ('Cours', 'TP', 'Examen', 'Résumé', 'Livre', 'Composition', 'Autre')),
  add constraint library_documents_faculty_check
    check (char_length(faculty) <= 160 and (section = 'autre' or char_length(faculty) >= 1)),
  add constraint library_documents_promotion_check
    check (section = 'autre' or promotion in ('L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat'));

create index if not exists library_section_idx
  on public.library_documents (section, created_at desc)
  where status = 'published' and deleted_at is null;

-- Vérification :
-- select section, count(*) from public.library_documents group by section;
