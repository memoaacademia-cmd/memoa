-- Librairie : département (facultatif) pour pouvoir rechercher par faculté ou département.
alter table public.library_documents
  add column if not exists department text not null default '' check (char_length(department) <= 160);
