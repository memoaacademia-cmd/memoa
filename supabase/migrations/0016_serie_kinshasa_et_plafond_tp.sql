-- Correctifs d'audit (14 nov) : série (flammes) en jour de Kinshasa, et plafond de parties par session de TP (80 -> 50).
-- À exécuter UNE fois dans Supabase > SQL Editor.
drop policy if exists "activité : aujourd'hui seulement" on public.activity_days;
create policy "activité : aujourd'hui seulement" on public.activity_days for insert
  with check (user_id = auth.uid() and day between (now() at time zone 'Africa/Kinshasa')::date - 1 and (now() at time zone 'Africa/Kinshasa')::date + 1);

create or replace function public.use_tp_session(p_user uuid, p_session uuid, p_kind text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_kind = 'tp_plan' then
    update public.tp_sessions set plans = plans + 1 where id = p_session and user_id = p_user and expires_at > now() and plans < 3;
  elsif p_kind = 'tp_revise' then
    update public.tp_sessions set revises = revises + 1 where id = p_session and user_id = p_user and expires_at > now() and revises < 10;
  elsif p_kind = 'tp_write' then
    update public.tp_sessions set writes = writes + 1 where id = p_session and user_id = p_user and expires_at > now() and writes < 3;
  elsif p_kind = 'tp_section' then
    update public.tp_sessions set sections = sections + 1 where id = p_session and user_id = p_user and expires_at > now() and sections < 50;
  else
    return false;
  end if;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.use_tp_session(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.use_tp_session(uuid, uuid, text) to service_role;
