-- 0037 : le retrait partenaire demande aussi le NOM DU COMPTE Mobile Money (en plus du numéro et de l'opérateur).
-- Le numéro de retrait n'est pas toujours celui de l'inscription : l'administrateur voit désormais « nom + numéro + opérateur »
-- pour vérifier qu'il envoie l'argent au bon compte.
-- Idempotent : peut être relancé sans risque. À lancer dans l'éditeur SQL de Supabase, APRÈS 0035 et 0036.

-- 1) Colonnes -------------------------------------------------------------------------------------------------------
alter table public.partner_payouts add column if not exists account_name text;       -- nom du compte, figé au moment de la demande
alter table public.partners        add column if not exists payout_account_name text; -- dernier nom utilisé (pré-rempli la fois suivante)
do $$ begin
  alter table public.partners add constraint partners_payout_account_name_len check (payout_account_name is null or char_length(payout_account_name) between 2 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.partner_payouts add constraint partner_payouts_account_name_len check (account_name is null or char_length(account_name) between 2 and 100);
exception when duplicate_object then null; end $$;

-- 2) Compte supprimé : on efface aussi le nom du compte (le retrait déjà demandé garde le sien le temps d'être payé) ------
create or replace function public.partners_on_user_deleted()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.full_name := null;
    new.payout_phone := null;
    new.payout_operator := null;
    new.payout_account_name := null;
    new.status := 'suspended';
    update public.partner_earnings set status = 'void' where partner_id = new.id and status in ('pending', 'available');
  end if;
  return new;
end;
$$;

-- 3) Demande de retrait : un 3e paramètre, le nom du compte ------------------------------------------------------------
-- Résultats : ok | non_partenaire | deja_demande | sous_seuil | coordonnees_manquantes | numero_invalide | operateur_invalide | nom_invalide | non_connecte
drop function if exists public.request_payout(text, text);
create or replace function public.request_payout(p_phone text default null, p_operator text default null, p_account_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.partner_config();
  v_min numeric := (v_cfg->>'min_payout_usd')::numeric;
  v_p public.partners%rowtype;
  v_phone text;
  v_name text;
  v_total numeric;
  v_pid uuid;
begin
  if v_uid is null then return jsonb_build_object('result', 'non_connecte'); end if;

  select * into v_p from public.partners where user_id = v_uid for update;
  if not found or v_p.status <> 'active' then return jsonb_build_object('result', 'non_partenaire'); end if;
  if exists (select 1 from public.partner_payouts where partner_id = v_p.id and status = 'requested') then
    return jsonb_build_object('result', 'deja_demande');
  end if;

  if p_phone is not null and btrim(p_phone) <> '' then
    v_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
    if v_phone !~ '^\+?[0-9]{9,15}$' then return jsonb_build_object('result', 'numero_invalide'); end if;
    v_p.payout_phone := v_phone;
  end if;
  if p_operator is not null and btrim(p_operator) <> '' then
    if p_operator not in ('mpesa', 'airtel', 'orange') then return jsonb_build_object('result', 'operateur_invalide'); end if;
    v_p.payout_operator := p_operator;
  end if;
  if p_account_name is not null and btrim(p_account_name) <> '' then
    v_name := btrim(regexp_replace(p_account_name, '\s+', ' ', 'g'));
    if char_length(v_name) < 2 or char_length(v_name) > 100 then return jsonb_build_object('result', 'nom_invalide'); end if;
    v_p.payout_account_name := v_name;
  end if;
  if v_p.payout_phone is null or v_p.payout_operator is null then return jsonb_build_object('result', 'coordonnees_manquantes'); end if;
  if v_p.payout_account_name is null then return jsonb_build_object('result', 'nom_invalide'); end if;

  update public.partner_earnings set status = 'available' where partner_id = v_p.id and status = 'pending' and available_at <= now();

  select coalesce(sum(amount_usd), 0) into v_total
  from (select amount_usd from public.partner_earnings where partner_id = v_p.id and status = 'available' for update) s;

  if v_total < v_min then
    return jsonb_build_object('result', 'sous_seuil', 'available_usd', v_total, 'min_payout_usd', v_min);
  end if;

  update public.partners
     set payout_phone = v_p.payout_phone, payout_operator = v_p.payout_operator, payout_account_name = v_p.payout_account_name
   where id = v_p.id;
  insert into public.partner_payouts (partner_id, amount_usd, phone, operator, account_name)
  values (v_p.id, v_total, v_p.payout_phone, v_p.payout_operator, v_p.payout_account_name)
  returning id into v_pid;
  update public.partner_earnings set status = 'requested', payout_id = v_pid where partner_id = v_p.id and status = 'available';

  return jsonb_build_object('result', 'ok', 'payout_id', v_pid, 'amount_usd', v_total);
end;
$$;
revoke all on function public.request_payout(text, text, text) from public, anon;
grant execute on function public.request_payout(text, text, text) to authenticated;

-- 4) Tableau du partenaire : renvoie aussi le dernier nom de compte utilisé (pour pré-remplir) -------------------------
create or replace function public.get_partner_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.partner_config();
  v_p public.partners%rowtype;
  v_signups int;
  v_payers int;
  v_pending numeric;
  v_available numeric;
  v_requested numeric;
  v_paid numeric;
  v_next timestamptz;
  v_payouts jsonb;
begin
  if v_uid is null then return jsonb_build_object('status', 'none'); end if;
  select * into v_p from public.partners where user_id = v_uid;
  if not found then
    return jsonb_build_object('status', 'none', 'min_payout_usd', (v_cfg->>'min_payout_usd')::numeric);
  end if;
  if v_p.status <> 'active' then
    return jsonb_build_object('status', v_p.status, 'type', v_p.type, 'full_name', v_p.full_name, 'min_payout_usd', (v_cfg->>'min_payout_usd')::numeric);
  end if;

  select count(*) into v_signups from public.referrals where partner_id = v_p.id;
  select count(*) into v_payers from public.partner_earnings where partner_id = v_p.id and status <> 'void';
  select
    coalesce(sum(amount_usd) filter (where status = 'pending' and available_at > now()), 0),
    coalesce(sum(amount_usd) filter (where status = 'available' or (status = 'pending' and available_at <= now())), 0),
    coalesce(sum(amount_usd) filter (where status = 'requested'), 0),
    coalesce(sum(amount_usd) filter (where status = 'paid'), 0),
    min(available_at) filter (where status = 'pending' and available_at > now())
  into v_pending, v_available, v_requested, v_paid, v_next
  from public.partner_earnings where partner_id = v_p.id;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'amount_usd', x.amount_usd, 'operator', x.operator, 'status', x.status,
      'reference', x.reference, 'reject_reason', x.reject_reason, 'requested_at', x.requested_at, 'processed_at', x.processed_at
    ) order by x.requested_at desc), '[]'::jsonb)
  into v_payouts
  from (select * from public.partner_payouts where partner_id = v_p.id order by requested_at desc limit 20) x;

  return jsonb_build_object(
    'status', 'active',
    'type', v_p.type,
    'full_name', v_p.full_name,
    'code', v_p.code,
    'signups', v_signups,
    'payers', v_payers,
    'pending_usd', v_pending,
    'available_usd', v_available,
    'requested_usd', v_requested,
    'paid_usd', v_paid,
    'total_usd', v_pending + v_available + v_requested + v_paid,
    'withdrawable_usd', v_available,
    'next_available_at', v_next,
    'hold_days', (v_cfg->>'hold_days')::int,
    'min_payout_usd', (v_cfg->>'min_payout_usd')::numeric,
    'payout_phone', v_p.payout_phone,
    'payout_operator', v_p.payout_operator,
    'payout_account_name', v_p.payout_account_name,
    'has_open_payout', exists (select 1 from public.partner_payouts where partner_id = v_p.id and status = 'requested'),
    'payouts', v_payouts
  );
end;
$$;
revoke all on function public.get_partner_dashboard() from public, anon;
grant execute on function public.get_partner_dashboard() to authenticated;

-- 5) Tableau de bord administrateur : « retraits à payer » avec le nom du compte ---------------------------------------
create or replace function public.admin_partner_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at)
        from (
          select pa.id as partner_id, pa.full_name, pa.type, u.email, pa.created_at
            from public.partners pa
            left join auth.users u on u.id = pa.user_id
           where pa.status = 'pending'
        ) x
    ), '[]'::jsonb),
    'payouts', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.requested_at)
        from (
          select po.id as payout_id, pa.full_name, pa.code, po.operator, po.phone, po.account_name, po.amount_usd, po.requested_at
            from public.partner_payouts po
            join public.partners pa on pa.id = po.partner_id
           where po.status = 'requested'
        ) x
    ), '[]'::jsonb),
    'partners', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.created_at desc)
        from (
          select pa.id as partner_id, pa.full_name, pa.type, pa.status, pa.code, pa.created_at,
                 (select count(*) from public.referrals r where r.partner_id = pa.id) as inscrits,
                 (select count(*) from public.partner_earnings e where e.partner_id = pa.id and e.status <> 'void') as payants,
                 (select coalesce(sum(e.amount_usd), 0) from public.partner_earnings e where e.partner_id = pa.id and e.status in ('pending', 'available', 'requested')) as a_venir_usd,
                 (select coalesce(sum(e.amount_usd), 0) from public.partner_earnings e where e.partner_id = pa.id and e.status = 'paid') as paye_usd
            from public.partners pa
        ) x
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_partner_overview() from public, anon;
grant execute on function public.admin_partner_overview() to authenticated;

-- 6) Vue pour l'éditeur SQL (consultation directe) -----------------------------------------------------------------------
-- create or replace view ne peut qu'ajouter des colonnes à la fin : on la recrée proprement.
drop view if exists public.admin_payouts_to_pay;
create view public.admin_payouts_to_pay as
  select po.id as payout_id, pa.full_name, pa.code, po.operator, po.phone, po.account_name, po.amount_usd, po.requested_at
    from public.partner_payouts po
    join public.partners pa on pa.id = po.partner_id
   where po.status = 'requested'
   order by po.requested_at;
revoke all on public.admin_payouts_to_pay from public, anon, authenticated;
