-- 0037 : e-mails automatiques d'inscription.
--   « incomplete » : rappel UNIQUE, 1 h après la création du compte, si l'inscription n'est pas finie (e-mail pas confirmé, ou « Présente-toi » pas rempli) ;
--   « welcome »    : e-mail de bienvenue UNIQUE, quand l'inscription est terminée (profil rempli).
-- Les e-mails sont envoyés par la fonction « lifecycle-emails » (planifiée toutes les 10 minutes). Cette table retient qui a déjà reçu quoi : personne ne reçoit deux fois le même e-mail.
-- Les comptes qui EXISTENT déjà à l'exécution de ce script sont marqués « déjà traités » : aucun ancien étudiant ne reçoit de message.

create table if not exists public.lifecycle_emails (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('incomplete', 'welcome')),
  sent_at timestamptz not null default now(),
  note text,
  primary key (user_id, kind)
);
alter table public.lifecycle_emails enable row level security;
revoke all on public.lifecycle_emails from anon, authenticated;
-- Pas de policy volontairement : seul le service_role (la fonction) y accède.

insert into public.lifecycle_emails (user_id, kind, note)
select u.id, k.kind, 'déjà inscrit avant 0037'
  from auth.users u cross join (values ('incomplete'), ('welcome')) as k(kind)
on conflict do nothing;

-- Étudiants à qui il faut envoyer l'e-mail « p_kind » (jamais plus de p_limit à la fois).
create or replace function public.lifecycle_candidates(p_kind text, p_limit int default 30)
returns table (user_id uuid, email text, first_name text, confirmed boolean)
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id, u.email::text, nullif(btrim(coalesce(p.first_name, '')), ''), (u.email_confirmed_at is not null)
    from auth.users u
    left join public.profiles p on p.id = u.id
   where u.email is not null
     and not exists (select 1 from public.lifecycle_emails l where l.user_id = u.id and l.kind = p_kind)
     and (
       (p_kind = 'incomplete'
         and u.created_at < now() - interval '1 hour'
         and u.created_at > now() - interval '7 days'
         and coalesce(p.university, '') = '')
       or
       (p_kind = 'welcome'
         and coalesce(p.university, '') <> ''
         and p.memo_animal is not null)
     )
   order by u.created_at
   limit greatest(1, least(p_limit, 100));
$$;
revoke all on function public.lifecycle_candidates(text, int) from public, anon, authenticated;
grant execute on function public.lifecycle_candidates(text, int) to service_role;
