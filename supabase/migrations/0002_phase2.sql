-- Phase 2 : inscription et profil.
-- À exécuter UNE fois dans Supabase : SQL Editor > New query > coller > Run.
-- Peut être relancé sans danger (chaque ligne vérifie d'abord si elle est déjà faite).

-- 1) Trois cases pour le nom : nom, post-nom, prénom.
alter table public.profiles add column if not exists last_name text not null default '' check (char_length(last_name) <= 50);
alter table public.profiles add column if not exists post_name text not null default '' check (char_length(post_name) <= 50);
alter table public.profiles add column if not exists first_name text not null default '' check (char_length(first_name) <= 50);

-- 2) Animaux : on accepte tout identifiant en minuscules (lettres, 2 à 20),
--    pour ajouter des animaux ou des illustrations plus tard sans retoucher la base.
alter table public.profiles drop constraint if exists profiles_memo_animal_check;
alter table public.profiles add constraint profiles_memo_animal_check
  check (memo_animal is null or memo_animal ~ '^[a-z]{2,20}$');

-- 3) Vacation facultative : la valeur vide est autorisée.
alter table public.profiles drop constraint if exists profiles_vacation_check;
alter table public.profiles add constraint profiles_vacation_check
  check (vacation in ('', 'Vacation jour', 'Vacation soir', 'Vacation A', 'Vacation B', 'Vacation C'));
alter table public.profiles alter column vacation set default '';
