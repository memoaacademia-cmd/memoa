-- 0017 : verrou de la date d'inscription (profiles.created_at)
-- Empêche un étudiant de modifier sa date d'inscription pour refaire son essai gratuit.
-- Déjà exécutée dans Supabase le 14 nov 2026 ; ce fichier sert de trace dans le dépôt.
-- Ré-exécutable sans danger.

create or replace function public.profiles_lock_created_at()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();          -- à la création : toujours l'heure du serveur
  else
    new.created_at := old.created_at; -- ensuite : jamais modifiable
  end if;
  return new;
end $function$;

drop trigger if exists profiles_lock_created on public.profiles;
create trigger profiles_lock_created
  before insert or update on public.profiles
  for each row execute function public.profiles_lock_created_at();
