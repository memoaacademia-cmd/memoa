-- 0022 : cartes de révision (tâche 8 du bloc 2) — question / réponse par cours, répétition espacée par boîtes (1 à 5).
-- Chaque étudiant ne voit et ne modifie que SES cartes (RLS). Réexécutable sans erreur.

create table if not exists public.review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  question text not null check (char_length(question) between 3 and 400),
  answer text not null check (char_length(answer) between 1 and 800),
  -- Boîte 1 à 5 : délais 1, 2, 4, 7 et 15 jours (voir src/lib/review.ts). Une carte neuve est en boîte 1, à réviser tout de suite.
  box smallint not null default 1 check (box between 1 and 5),
  due_date date not null default ((now() at time zone 'Africa/Kinshasa')::date),
  last_review date,
  created_at timestamptz not null default now()
);

create index if not exists review_cards_due_idx on public.review_cards (user_id, due_date);
create index if not exists review_cards_course_idx on public.review_cards (course_id);

alter table public.review_cards enable row level security;

drop policy if exists "cartes : lecture des siennes" on public.review_cards;
create policy "cartes : lecture des siennes" on public.review_cards for select to authenticated using (user_id = auth.uid());

-- Création : seulement pour soi, et seulement dans un de SES cours.
drop policy if exists "cartes : création dans ses cours" on public.review_cards;
create policy "cartes : création dans ses cours" on public.review_cards for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));

drop policy if exists "cartes : modification des siennes" on public.review_cards;
create policy "cartes : modification des siennes" on public.review_cards for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "cartes : suppression des siennes" on public.review_cards;
create policy "cartes : suppression des siennes" on public.review_cards for delete to authenticated using (user_id = auth.uid());

-- Plafond anti-abus : 1500 cartes par étudiant.
create or replace function public.review_cards_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.review_cards where user_id = new.user_id) >= 1500 then
    raise exception 'Limite de 1500 cartes atteinte. Supprime d''anciennes cartes ou un cours.';
  end if;
  return new;
end $$;

drop trigger if exists review_cards_cap_trg on public.review_cards;
create trigger review_cards_cap_trg before insert on public.review_cards for each row execute function public.review_cards_cap();
