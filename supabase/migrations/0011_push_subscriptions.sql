-- Abonnements aux notifications « Le savais-tu ? » : un par téléphone (adresse d'envoi + clés fournies par le navigateur).
-- L'étudiant gère les siens (ajout, retrait) ; l'envoi se fait côté serveur avec le service_role.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy "push : lecture des siens" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push : ajout par soi" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push : mise à jour des siens" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push : retrait par soi" on public.push_subscriptions for delete using (user_id = auth.uid());

-- Enregistrement d'un téléphone : si le même téléphone était déjà lié à un autre compte (téléphone partagé), il passe au compte courant.
create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Connexion requise';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;
revoke all on function public.register_push(text, text, text) from public, anon;
grant execute on function public.register_push(text, text, text) to authenticated;
