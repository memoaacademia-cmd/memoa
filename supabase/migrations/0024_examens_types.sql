-- 0024 : type d'échéance (examen, interrogation, remise de TP). Réexécutable sans erreur.
alter table public.exams add column if not exists kind text not null default 'exam';
alter table public.exams drop constraint if exists exams_kind_check;
alter table public.exams add constraint exams_kind_check check (kind in ('exam', 'interro', 'tp'));
