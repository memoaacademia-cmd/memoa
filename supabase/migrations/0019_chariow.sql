-- 0019 : paiement via Chariow (remplace OPTGateway).
-- À exécuter UNE fois dans Supabase > SQL Editor. Ne supprime aucune donnée existante.
--
-- Principe : « 1 paiement = 30 jours de Premium ». Chariow n'a pas d'abonnement automatique :
-- chaque mois, l'étudiant repaie (rappels d'expiration déjà en place).

-- 1) La table payments accepte maintenant le fournisseur « chariow ».
--    provider_ref = identifiant de la vente Chariow (sal_…), unique : c'est la clé d'idempotence.
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('orange', 'airtel', 'mpesa', 'chariow'));
alter table public.payments add column if not exists email text;          -- email saisi côté Chariow (repli de rattachement)
alter table public.payments add column if not exists raw jsonb;           -- vente telle que renvoyée par l'API Chariow (débogage)
alter table public.payments add column if not exists processed_at timestamptz;

-- 2) Journal de tous les événements reçus de Chariow (y compris ignorés, rejetés ou non rattachés).
--    Sert à déboguer et à retrouver un paiement « orphelin ». Aucune règle d'accès : seul le service_role y touche.
create table if not exists public.payment_events (
  id bigint generated always as identity primary key,
  source text not null default 'chariow',
  delivery_id text,
  event text,
  sale_id text,
  outcome text not null,
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_events_sale_idx on public.payment_events (sale_id);
create index if not exists payment_events_created_idx on public.payment_events (created_at desc);
alter table public.payment_events enable row level security;

-- 3) Applique UN paiement confirmé, de façon atomique et idempotente.
--    Appelée uniquement par les fonctions serveur, APRÈS revérification de la vente auprès de l'API Chariow.
--    Rattachement : 1) la ligne créée au démarrage du paiement (user_id vient du JWT), 2) à défaut, l'email du client.
--    Résultats : applied | duplicate | unmatched | user_mismatch
create or replace function public.apply_chariow_payment(
  p_sale_id text,
  p_amount numeric,
  p_currency text,
  p_email text,
  p_user_hint text default null,   -- custom_metadata.user_id renvoyé par Chariow : simple contrôle de cohérence
  p_raw jsonb default null,
  p_days int default 30
) returns table (o_outcome text, o_user_id uuid, o_expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_pay public.payments%rowtype;
  v_uid uuid;
  v_base timestamptz;
  v_exp timestamptz;
begin
  -- Verrou sur la ligne : deux livraisons simultanées (webhook + cron) ne peuvent pas toutes deux prolonger.
  select * into v_pay from public.payments where provider_ref = p_sale_id for update;

  if not found then
    -- Repli : paiement dont on n'a pas la ligne (ex. insertion ratée au démarrage) → on cherche l'étudiant par email.
    select u.id into v_uid from auth.users u where lower(u.email) = lower(coalesce(p_email, '')) limit 1;
    if v_uid is null then
      return query select 'unmatched'::text, null::uuid, null::timestamptz;
      return;
    end if;
    insert into public.payments (user_id, provider, amount, currency, status, provider_ref, email)
    values (v_uid, 'chariow', p_amount, p_currency, 'pending', p_sale_id, p_email)
    on conflict (provider_ref) do nothing;
    select * into v_pay from public.payments where provider_ref = p_sale_id for update;
  end if;

  if v_pay.status = 'paid' then
    return query select 'duplicate'::text, v_pay.user_id, null::timestamptz;
    return;
  end if;

  if p_user_hint is not null and p_user_hint <> '' and p_user_hint <> v_pay.user_id::text then
    return query select 'user_mismatch'::text, v_pay.user_id, null::timestamptz;
    return;
  end if;

  update public.payments
     set status = 'paid', amount = p_amount, currency = p_currency, raw = p_raw, processed_at = now()
   where id = v_pay.id;

  select s.expires_at into v_base from public.subscriptions s where s.user_id = v_pay.user_id for update;
  v_exp := greatest(coalesce(v_base, now()), now()) + make_interval(days => p_days);

  insert into public.subscriptions (user_id, expires_at) values (v_pay.user_id, v_exp)
  on conflict (user_id) do update set expires_at = excluded.expires_at, updated_at = now();

  return query select 'applied'::text, v_pay.user_id, v_exp;
end;
$$;

-- Personne d'autre que le serveur ne doit pouvoir appeler cette fonction (sinon : Premium gratuit).
revoke all on function public.apply_chariow_payment(text, numeric, text, text, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.apply_chariow_payment(text, numeric, text, text, text, jsonb, int) to service_role;
