-- 0023 : examens (étapes 2 et 3) — date d'examen par cours, jours de rappel choisis par l'étudiant, journal anti-doublon des rappels.
-- RLS : chaque étudiant ne voit et ne modifie que SES examens. Réexécutable sans erreur.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Cours lié (facultatif : un examen venu de l'horaire peut ne correspondre à aucun cours de l'étudiant).
  course_id uuid references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  exam_date date not null,
  exam_time text check (exam_time is null or exam_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  room text check (room is null or char_length(room) <= 80),
  source text not null default 'manual' check (source in ('manual', 'schedule')),
  created_at timestamptz not null default now()
);
create index if not exists exams_user_date_idx on public.exams (user_id, exam_date);
create index if not exists exams_course_idx on public.exams (course_id);

alter table public.exams enable row level security;
drop policy if exists "examens : lecture des siens" on public.exams;
create policy "examens : lecture des siens" on public.exams for select to authenticated using (user_id = auth.uid());
drop policy if exists "examens : création" on public.exams;
create policy "examens : création" on public.exams for insert to authenticated
  with check (user_id = auth.uid() and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())));
drop policy if exists "examens : modification des siens" on public.exams;
create policy "examens : modification des siens" on public.exams for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (course_id is null or exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid())));
drop policy if exists "examens : suppression des siens" on public.exams;
create policy "examens : suppression des siens" on public.exams for delete to authenticated using (user_id = auth.uid());

-- Plafond anti-abus : 300 examens par étudiant.
create or replace function public.exams_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.exams where user_id = new.user_id) >= 300 then
    raise exception 'Limite de 300 examens atteinte. Supprime d''anciens examens.';
  end if;
  return new;
end $$;
drop trigger if exists exams_cap_trg on public.exams;
create trigger exams_cap_trg before insert on public.exams for each row execute function public.exams_cap();

-- Jours de rappel choisis (nombre de jours AVANT l'examen ; 0 = le jour même). Par défaut : 7, 3, la veille, le jour même.
create table if not exists public.exam_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  days int[] not null default '{7,3,1,0}' check (cardinality(days) between 0 and 6),
  updated_at timestamptz not null default now()
);
alter table public.exam_prefs enable row level security;
drop policy if exists "rappels examens : lecture des siens" on public.exam_prefs;
create policy "rappels examens : lecture des siens" on public.exam_prefs for select to authenticated using (user_id = auth.uid());
drop policy if exists "rappels examens : création" on public.exam_prefs;
create policy "rappels examens : création" on public.exam_prefs for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "rappels examens : modification" on public.exam_prefs;
create policy "rappels examens : modification" on public.exam_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Rappels déjà envoyés (un rappel par examen et par jour de rappel). Aucune politique : seule la fonction serveur écrit et lit.
create table if not exists public.exam_reminders (
  exam_id uuid not null references public.exams (id) on delete cascade,
  days_before int not null,
  sent_at timestamptz not null default now(),
  primary key (exam_id, days_before)
);
alter table public.exam_reminders enable row level security;
