-- 0035 : Programme partenaire (affiliation).
-- À exécuter UNE fois dans Supabase > SQL Editor (après avoir fait une sauvegarde). Ré-exécutable sans danger.
--
-- Ce que cette migration fait :
--   1) 5 tables : partners, referrals, partner_earnings, partner_payouts (+ partner_attach_attempts, simple compteur anti-abus) ;
--   2) RLS strict : un partenaire LIT seulement ses lignes ; AUCUNE écriture directe depuis l'application ;
--   3) fonctions SECURITY DEFINER pour tout ce que fait l'étudiant (demande, code parrain, retrait) ;
--   4) fonctions réservées à l'administrateur (approuver, refuser, marquer payé) ;
--   5) le gain de 1 USD ajouté, de façon additive, dans apply_chariow_payment (même transaction que l'activation du paiement).
-- Les règles chiffrées (commission, délai, seuil…) sont TOUTES dans partner_config() ci-dessous.

-- =====================================================================================================
-- 0) CONFIGURATION UNIQUE : pour changer un chiffre, modifie-le ici puis ré-exécute cette fonction seule.
-- =====================================================================================================
create or replace function public.partner_config()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'commission_usd', 1,          -- COMMISSION_USD : gain fixe par filleul (1er paiement seulement)
    'hold_days', 7,               -- délai avant qu'un gain soit « disponible » (litiges / remboursements)
    'min_payout_usd', 10,         -- seuil de retrait minimum
    'referral_window_days', 7,    -- un code parrain n'est accepté que les 7 premiers jours du compte
    'attach_max_per_hour', 5      -- tentatives de code parrain par heure et par étudiant
  );
$$;
revoke all on function public.partner_config() from public, anon, authenticated;

-- =====================================================================================================
-- 1) TABLES
-- =====================================================================================================

-- Un partenaire = un étudiant normal + un statut partenaire.
-- user_id : « on delete set null » (et non cascade) pour garder l'historique comptable si l'étudiant supprime son compte
-- (voir le déclencheur partners_on_user_deleted plus bas : le partenaire est alors anonymisé).
create table if not exists public.partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users (id) on delete set null,
  type text not null check (type in ('cp', 'influenceur')),
  status text not null default 'pending' check (status in ('pending', 'active', 'rejected', 'suspended')),
  code text unique,
  full_name text check (full_name is null or char_length(full_name) between 2 and 100),
  payout_phone text check (payout_phone is null or payout_phone ~ '^\+?[0-9]{9,15}$'),
  payout_operator text check (payout_operator is null or payout_operator in ('mpesa', 'airtel', 'orange')),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  admin_notified_at timestamptz   -- l'administrateur a été prévenu de cette demande (fonction partner-alerts)
);
create index if not exists partners_status_idx on public.partners (status);

-- Retraits (créé avant les gains, qui y renvoient).
create table if not exists public.partner_payouts (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  amount_usd numeric(10, 2) not null check (amount_usd > 0),
  phone text not null,
  operator text not null check (operator in ('mpesa', 'airtel', 'orange')),
  status text not null default 'requested' check (status in ('requested', 'paid', 'rejected')),
  reference text,                 -- référence de la transaction Mobile Money (remplie par l'administrateur)
  reject_reason text,
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  admin_notified_at timestamptz
);
create index if not exists partner_payouts_partner_idx on public.partner_payouts (partner_id, requested_at desc);
-- Une seule demande « requested » à la fois par partenaire (garde-fou en plus du verrou de ligne).
create unique index if not exists partner_payouts_one_open on public.partner_payouts (partner_id) where status = 'requested';

-- Un seul parrain par étudiant, définitif (clé primaire = l'étudiant parrainé).
-- Supprimer le filleul supprime cette ligne, mais PAS les gains déjà créés (voir partner_earnings).
create table if not exists public.referrals (
  referred_user_id uuid primary key references auth.users (id) on delete cascade,
  partner_id uuid not null references public.partners (id),
  source text not null check (source in ('link', 'clipboard', 'manual')),
  created_at timestamptz not null default now(),
  notified_at timestamptz         -- push « Nouvelle personne inscrite » (option, désactivée par défaut)
);
create index if not exists referrals_partner_idx on public.referrals (partner_id);

-- Gains. referred_user_id UNIQUE = une seule commission par filleul. payment_id UNIQUE = impossible de gagner deux fois sur le même paiement.
-- Les deux clés sont « on delete set null » : supprimer le compte du filleul ne supprime JAMAIS un gain déjà acquis ou payé.
create table if not exists public.partner_earnings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  referred_user_id uuid unique references auth.users (id) on delete set null,
  payment_id uuid unique references public.payments (id) on delete set null,
  amount_usd numeric(10, 2) not null check (amount_usd > 0),   -- copie du montant gagné (historique)
  status text not null default 'pending' check (status in ('pending', 'available', 'requested', 'paid', 'void')),
  created_at timestamptz not null default now(),
  available_at timestamptz not null,
  payout_id uuid references public.partner_payouts (id) on delete set null,
  notified_at timestamptz         -- push « +1 $ » (option, désactivée par défaut)
);
create index if not exists partner_earnings_partner_idx on public.partner_earnings (partner_id, status);
create index if not exists partner_earnings_payout_idx on public.partner_earnings (payout_id);

-- Compteur anti-abus pour attach_referral (5 essais / heure / étudiant). Aucune règle d'accès : seul le serveur y touche.
create table if not exists public.partner_attach_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists partner_attach_attempts_idx on public.partner_attach_attempts (user_id, at desc);

-- Auto-parrainage interdit : un partenaire ne peut pas être son propre parrain (contrôle qui ne peut pas être une simple contrainte CHECK).
create or replace function public.referrals_no_self()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (select 1 from public.partners p where p.id = new.partner_id and p.user_id = new.referred_user_id) then
    raise exception 'auto_parrainage';
  end if;
  return new;
end;
$$;
drop trigger if exists referrals_no_self_trg on public.referrals;
create trigger referrals_no_self_trg before insert or update on public.referrals for each row execute function public.referrals_no_self();

-- Suppression du compte d'un PARTENAIRE : la ligne partenaire reste (historique comptable) mais est anonymisée,
-- suspendue, et ses gains non retirés sont annulés. Les retraits déjà demandés restent à honorer (le numéro y est gardé le temps de payer).
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
    new.status := 'suspended';
    update public.partner_earnings set status = 'void' where partner_id = new.id and status in ('pending', 'available');
  end if;
  return new;
end;
$$;
drop trigger if exists partners_on_user_deleted_trg on public.partners;
create trigger partners_on_user_deleted_trg before update on public.partners for each row execute function public.partners_on_user_deleted();

-- =====================================================================================================
-- 2) RLS : lecture de SES lignes seulement, aucune écriture directe
-- =====================================================================================================
alter table public.partners enable row level security;
alter table public.referrals enable row level security;
alter table public.partner_earnings enable row level security;
alter table public.partner_payouts enable row level security;
alter table public.partner_attach_attempts enable row level security;   -- aucune policy : service_role / fonctions seulement

-- On retire tout, puis on n'accorde que la lecture de colonnes précises (jamais l'identifiant d'un filleul).
revoke all on public.partners, public.referrals, public.partner_earnings, public.partner_payouts, public.partner_attach_attempts from public, anon, authenticated;
grant select (id, type, status, code, full_name, payout_phone, payout_operator, created_at, approved_at) on public.partners to authenticated;
grant select (partner_id, source, created_at) on public.referrals to authenticated;
grant select (id, partner_id, amount_usd, status, created_at, available_at, payout_id) on public.partner_earnings to authenticated;
grant select (id, partner_id, amount_usd, operator, status, reference, reject_reason, requested_at, processed_at) on public.partner_payouts to authenticated;

drop policy if exists "partenaire : lecture du sien" on public.partners;
create policy "partenaire : lecture du sien" on public.partners for select to authenticated using (user_id = auth.uid());

drop policy if exists "filleuls : lecture par le parrain" on public.referrals;
create policy "filleuls : lecture par le parrain" on public.referrals for select to authenticated
  using (partner_id in (select p.id from public.partners p where p.user_id = auth.uid()));

drop policy if exists "gains : lecture des siens" on public.partner_earnings;
create policy "gains : lecture des siens" on public.partner_earnings for select to authenticated
  using (partner_id in (select p.id from public.partners p where p.user_id = auth.uid()));

drop policy if exists "retraits : lecture des siens" on public.partner_payouts;
create policy "retraits : lecture des siens" on public.partner_payouts for select to authenticated
  using (partner_id in (select p.id from public.partners p where p.user_id = auth.uid()));

-- =====================================================================================================
-- 3) GÉNÉRATION DU CODE : PRENOM-K7X2 (4 caractères sans 0/O/1/I), unique
-- =====================================================================================================
create or replace function public.generate_partner_code(p_first_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   -- 32 caractères, sans 0 O 1 I
  v_name text;
  v_suffix text;
  v_code text;
  i int;
  tries int := 0;
begin
  -- Prénom : minuscules, accents retirés, lettres seulement, majuscules, 3 à 6 lettres (sinon « MEMOA »).
  v_name := translate(lower(coalesce(p_first_name, '')), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy');
  v_name := upper(regexp_replace(v_name, '[^a-z]', '', 'g'));
  v_name := left(v_name, 6);
  if char_length(v_name) < 3 then v_name := 'MEMOA'; end if;
  loop
    v_suffix := '';
    for i in 1..4 loop
      v_suffix := v_suffix || substr(v_alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    v_code := v_name || '-' || v_suffix;
    exit when not exists (select 1 from public.partners where code = v_code);
    tries := tries + 1;
    if tries > 60 then raise exception 'generation_du_code_impossible'; end if;
  end loop;
  return v_code;
end;
$$;
revoke all on function public.generate_partner_code(text) from public, anon, authenticated;

-- =====================================================================================================
-- 4) FONCTIONS DE L'ÉTUDIANT (SECURITY DEFINER : l'identité vient de auth.uid(), jamais du navigateur)
-- =====================================================================================================

-- 4.1 Demande pour devenir partenaire. Résultats : pending | deja_actif | suspendu | type_invalide | nom_invalide | non_connecte
create or replace function public.request_partner(p_type text, p_full_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(regexp_replace(coalesce(p_full_name, ''), '\s+', ' ', 'g'));
  v_p public.partners%rowtype;
begin
  if v_uid is null then return jsonb_build_object('result', 'non_connecte'); end if;
  if p_type is null or p_type not in ('cp', 'influenceur') then return jsonb_build_object('result', 'type_invalide'); end if;
  if char_length(v_name) < 2 or char_length(v_name) > 100 then return jsonb_build_object('result', 'nom_invalide'); end if;

  insert into public.partners (user_id, type, status, full_name)
  values (v_uid, p_type, 'pending', v_name)
  on conflict (user_id) do nothing;

  select * into v_p from public.partners where user_id = v_uid for update;
  if v_p.status = 'active' then return jsonb_build_object('result', 'deja_actif'); end if;
  if v_p.status = 'suspended' then return jsonb_build_object('result', 'suspendu'); end if;
  if v_p.status = 'rejected' then
    -- Nouvelle demande après un refus : elle repart en attente et l'administrateur est prévenu de nouveau.
    update public.partners set status = 'pending', type = p_type, full_name = v_name, admin_notified_at = null where id = v_p.id;
  else
    -- Déjà en attente (ou tout juste créée) : une seule demande à la fois, on met seulement à jour le contenu.
    update public.partners set type = p_type, full_name = v_name where id = v_p.id;
  end if;
  return jsonb_build_object('result', 'pending');
end;
$$;

-- 4.2 Tableau de bord du partenaire : statut, compteurs, montants, historique des retraits. Rien d'autre.
-- Les gains « en attente » dont la date est passée comptent déjà comme « disponibles » (calcul à la lecture, pas de cron).
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
    'has_open_payout', exists (select 1 from public.partner_payouts where partner_id = v_p.id and status = 'requested'),
    'payouts', v_payouts
  );
end;
$$;

-- 4.3 Rattacher l'étudiant connecté à un parrain. NE LÈVE JAMAIS d'erreur bloquante pour l'inscription.
-- Résultats : ok | code_invalide | deja_parraine | trop_tard | auto_parrainage | trop_de_tentatives | non_connecte
create or replace function public.attach_referral(p_code text, p_source text default 'manual')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.partner_config();
  v_code text;
  v_src text := case when p_source in ('link', 'clipboard', 'manual') then p_source else 'manual' end;
  v_p public.partners%rowtype;
  v_created timestamptz;
  v_n int;
  v_rows int;
begin
  if v_uid is null then return jsonb_build_object('result', 'non_connecte'); end if;

  -- Un seul appel à la fois par étudiant (évite les doubles envois simultanés).
  perform pg_advisory_xact_lock(hashtext('attach_referral:' || v_uid::text));

  -- Limite de débit : 5 tentatives par heure et par étudiant.
  delete from public.partner_attach_attempts where at < now() - interval '1 day';
  select count(*) into v_n from public.partner_attach_attempts where user_id = v_uid and at > now() - interval '1 hour';
  if v_n >= (v_cfg->>'attach_max_per_hour')::int then return jsonb_build_object('result', 'trop_de_tentatives'); end if;
  insert into public.partner_attach_attempts (user_id) values (v_uid);

  -- Normalisation côté serveur : majuscules, espaces et tirets typographiques ramenés à « - ».
  v_code := upper(btrim(coalesce(p_code, '')));
  v_code := regexp_replace(v_code, '[\s_–—]+', '-', 'g');

  if exists (select 1 from public.referrals where referred_user_id = v_uid) then return jsonb_build_object('result', 'deja_parraine'); end if;
  if v_code !~ '^[A-Z]{3,6}-[A-Z0-9]{4}$' then return jsonb_build_object('result', 'code_invalide'); end if;

  select * into v_p from public.partners where code = v_code and status = 'active';
  if not found then return jsonb_build_object('result', 'code_invalide'); end if;
  if v_p.user_id = v_uid then return jsonb_build_object('result', 'auto_parrainage'); end if;

  select created_at into v_created from auth.users where id = v_uid;
  if v_created is null or v_created < now() - make_interval(days => (v_cfg->>'referral_window_days')::int) then
    return jsonb_build_object('result', 'trop_tard');
  end if;
  if exists (select 1 from public.payments where user_id = v_uid and status = 'paid') then return jsonb_build_object('result', 'trop_tard'); end if;

  insert into public.referrals (referred_user_id, partner_id, source) values (v_uid, v_p.id, v_src)
  on conflict (referred_user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('result', 'deja_parraine'); end if;
  return jsonb_build_object('result', 'ok');
exception
  when others then
    -- Jamais d'erreur bloquante pour l'inscription : on journalise sans donnée personnelle et on répond « code_invalide ».
    raise warning 'attach_referral : %', sqlerrm;
    return jsonb_build_object('result', 'code_invalide');
end;
$$;

-- 4.4 L'étudiant peut-il encore saisir un code ? (affiche ou non le champ dans Réglages)
create or replace function public.referral_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_cfg jsonb := public.partner_config();
  v_created timestamptz;
  v_sponsored boolean;
  v_eligible boolean;
begin
  if v_uid is null then return jsonb_build_object('sponsored', false, 'eligible', false); end if;
  v_sponsored := exists (select 1 from public.referrals where referred_user_id = v_uid);
  select created_at into v_created from auth.users where id = v_uid;
  v_eligible := not v_sponsored
    and v_created is not null
    and v_created >= now() - make_interval(days => (v_cfg->>'referral_window_days')::int)
    and not exists (select 1 from public.payments where user_id = v_uid and status = 'paid');
  return jsonb_build_object('sponsored', v_sponsored, 'eligible', v_eligible);
end;
$$;

-- 4.5 Demande de retrait. Numéro + opérateur facultatifs ici : s'ils sont donnés, ils sont validés puis enregistrés (seul moyen de les modifier).
-- Résultats : ok | non_partenaire | deja_demande | sous_seuil | coordonnees_manquantes | numero_invalide | operateur_invalide | non_connecte
create or replace function public.request_payout(p_phone text default null, p_operator text default null)
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
  v_total numeric;
  v_pid uuid;
begin
  if v_uid is null then return jsonb_build_object('result', 'non_connecte'); end if;

  -- Verrou de la ligne partenaire : deux demandes simultanées sont mises en file, la seconde voit la première.
  select * into v_p from public.partners where user_id = v_uid for update;
  if not found or v_p.status <> 'active' then return jsonb_build_object('result', 'non_partenaire'); end if;
  if exists (select 1 from public.partner_payouts where partner_id = v_p.id and status = 'requested') then
    return jsonb_build_object('result', 'deja_demande');
  end if;

  -- Coordonnées Mobile Money (facultatives dans l'appel).
  if p_phone is not null and btrim(p_phone) <> '' then
    v_phone := regexp_replace(p_phone, '[^0-9+]', '', 'g');
    if v_phone !~ '^\+?[0-9]{9,15}$' then return jsonb_build_object('result', 'numero_invalide'); end if;
    v_p.payout_phone := v_phone;
  end if;
  if p_operator is not null and btrim(p_operator) <> '' then
    if p_operator not in ('mpesa', 'airtel', 'orange') then return jsonb_build_object('result', 'operateur_invalide'); end if;
    v_p.payout_operator := p_operator;
  end if;
  if v_p.payout_phone is null or v_p.payout_operator is null then return jsonb_build_object('result', 'coordonnees_manquantes'); end if;

  -- Les gains « en attente » dont le délai est passé deviennent « disponibles » (calcul à la demande, pas de cron).
  update public.partner_earnings set status = 'available' where partner_id = v_p.id and status = 'pending' and available_at <= now();

  select coalesce(sum(amount_usd), 0) into v_total
  from (select amount_usd from public.partner_earnings where partner_id = v_p.id and status = 'available' for update) s;

  if v_total < v_min then
    return jsonb_build_object('result', 'sous_seuil', 'available_usd', v_total, 'min_payout_usd', v_min);
  end if;

  update public.partners set payout_phone = v_p.payout_phone, payout_operator = v_p.payout_operator where id = v_p.id;
  insert into public.partner_payouts (partner_id, amount_usd, phone, operator)
  values (v_p.id, v_total, v_p.payout_phone, v_p.payout_operator)
  returning id into v_pid;
  update public.partner_earnings set status = 'requested', payout_id = v_pid where partner_id = v_p.id and status = 'available';

  return jsonb_build_object('result', 'ok', 'payout_id', v_pid, 'amount_usd', v_total);
end;
$$;

-- Droits : seuls les étudiants connectés appellent ces fonctions (jamais anon / public).
revoke all on function public.request_partner(text, text) from public, anon;
revoke all on function public.get_partner_dashboard() from public, anon;
revoke all on function public.attach_referral(text, text) from public, anon;
revoke all on function public.referral_status() from public, anon;
revoke all on function public.request_payout(text, text) from public, anon;
grant execute on function public.request_partner(text, text) to authenticated;
grant execute on function public.get_partner_dashboard() to authenticated;
grant execute on function public.attach_referral(text, text) to authenticated;
grant execute on function public.referral_status() to authenticated;
grant execute on function public.request_payout(text, text) to authenticated;

-- =====================================================================================================
-- 5) FONCTIONS ADMINISTRATEUR (service_role / éditeur SQL seulement : aucun étudiant ne peut les appeler)
-- =====================================================================================================

create or replace function public.approve_partner(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.partners%rowtype;
  v_code text;
begin
  select * into v_p from public.partners where id = p_partner_id for update;
  if not found then return jsonb_build_object('result', 'introuvable'); end if;
  if v_p.status = 'active' then return jsonb_build_object('result', 'deja_actif', 'code', v_p.code); end if;
  if v_p.user_id is null then return jsonb_build_object('result', 'compte_supprime'); end if;
  v_code := coalesce(v_p.code, public.generate_partner_code(split_part(coalesce(v_p.full_name, ''), ' ', 1)));
  update public.partners set status = 'active', code = v_code, approved_at = coalesce(approved_at, now()) where id = v_p.id;
  return jsonb_build_object('result', 'ok', 'code', v_code);
end;
$$;

create or replace function public.reject_partner(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partners set status = 'rejected' where id = p_partner_id and status in ('pending', 'active', 'suspended');
  if not found then return jsonb_build_object('result', 'introuvable_ou_deja_refuse'); end if;
  return jsonb_build_object('result', 'ok');
end;
$$;

-- Suspendre un partenaire (le code ne parraine plus, plus de nouveau gain). Pour réactiver : approve_partner.
create or replace function public.suspend_partner(p_partner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partners set status = 'suspended' where id = p_partner_id and status = 'active';
  if not found then return jsonb_build_object('result', 'introuvable_ou_pas_actif'); end if;
  return jsonb_build_object('result', 'ok');
end;
$$;

create or replace function public.mark_payout_paid(p_payout_id uuid, p_reference text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.partner_payouts%rowtype;
begin
  if p_reference is null or btrim(p_reference) = '' then return jsonb_build_object('result', 'reference_obligatoire'); end if;
  select * into v_po from public.partner_payouts where id = p_payout_id for update;
  if not found then return jsonb_build_object('result', 'introuvable'); end if;
  if v_po.status <> 'requested' then return jsonb_build_object('result', 'deja_traite', 'status', v_po.status); end if;
  update public.partner_payouts set status = 'paid', reference = btrim(p_reference), processed_at = now() where id = v_po.id;
  update public.partner_earnings set status = 'paid' where payout_id = v_po.id and status = 'requested';
  return jsonb_build_object('result', 'ok', 'amount_usd', v_po.amount_usd);
end;
$$;

create or replace function public.reject_payout(p_payout_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_po public.partner_payouts%rowtype;
begin
  if p_reason is null or btrim(p_reason) = '' then return jsonb_build_object('result', 'motif_obligatoire'); end if;
  select * into v_po from public.partner_payouts where id = p_payout_id for update;
  if not found then return jsonb_build_object('result', 'introuvable'); end if;
  if v_po.status <> 'requested' then return jsonb_build_object('result', 'deja_traite', 'status', v_po.status); end if;
  update public.partner_payouts set status = 'rejected', reject_reason = btrim(p_reason), processed_at = now() where id = v_po.id;
  -- Les gains reviennent « disponibles » : le partenaire peut refaire une demande.
  update public.partner_earnings set status = 'available', payout_id = null where payout_id = v_po.id and status = 'requested';
  return jsonb_build_object('result', 'ok');
end;
$$;

-- Remboursement d'un paiement : annule le gain du filleul (à lancer à la main, le projet ne gère pas encore les remboursements).
create or replace function public.void_earning_for_user(p_referred_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.partner_earnings set status = 'void' where referred_user_id = p_referred_user_id and status in ('pending', 'available');
  if not found then return jsonb_build_object('result', 'rien_a_annuler_ou_deja_demande'); end if;
  return jsonb_build_object('result', 'ok');
end;
$$;

revoke all on function public.approve_partner(uuid) from public, anon, authenticated;
revoke all on function public.reject_partner(uuid) from public, anon, authenticated;
revoke all on function public.suspend_partner(uuid) from public, anon, authenticated;
revoke all on function public.mark_payout_paid(uuid, text) from public, anon, authenticated;
revoke all on function public.reject_payout(uuid, text) from public, anon, authenticated;
revoke all on function public.void_earning_for_user(uuid) from public, anon, authenticated;
grant execute on function public.approve_partner(uuid) to service_role;
grant execute on function public.reject_partner(uuid) to service_role;
grant execute on function public.suspend_partner(uuid) to service_role;
grant execute on function public.mark_payout_paid(uuid, text) to service_role;
grant execute on function public.reject_payout(uuid, text) to service_role;
grant execute on function public.void_earning_for_user(uuid) to service_role;

-- =====================================================================================================
-- 6) VUES ADMINISTRATEUR (à consulter dans l'éditeur SQL ; aucun accès pour les étudiants)
-- =====================================================================================================
create or replace view public.admin_payouts_to_pay as
  select po.id as payout_id, pa.full_name, pa.code, po.operator, po.phone, po.amount_usd, po.requested_at
    from public.partner_payouts po
    join public.partners pa on pa.id = po.partner_id
   where po.status = 'requested'
   order by po.requested_at;

create or replace view public.admin_pending_partners as
  select pa.id as partner_id, pa.full_name, pa.type, u.email, pa.created_at
    from public.partners pa
    left join auth.users u on u.id = pa.user_id
   where pa.status = 'pending'
   order by pa.created_at;

revoke all on public.admin_payouts_to_pay, public.admin_pending_partners from public, anon, authenticated;

-- =====================================================================================================
-- 7) GAIN AU PREMIER PAIEMENT : ajout ADDITIF dans apply_chariow_payment
--    Même signature, même validation, même atomicité. Seul ajout : le bloc « Programme partenaire » avant le dernier return.
--    Le bloc est protégé (begin … exception) : une erreur de commission ne peut JAMAIS empêcher l'activation du Premium.
-- =====================================================================================================
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

  -- ===== AJOUT : Programme partenaire (commission au PREMIER paiement du filleul, même transaction) =====
  -- Atteint uniquement quand le paiement est appliqué pour la première fois (un rejeu s'arrête plus haut : « duplicate »).
  -- Conditions : le filleul a un parrain, le partenaire est « active », aucun autre paiement réussi avant celui-ci,
  -- et aucun gain existant pour ce filleul / ce paiement (contraintes UNIQUE + on conflict do nothing).
  begin
    insert into public.partner_earnings (partner_id, referred_user_id, payment_id, amount_usd, status, available_at)
    select r.partner_id, v_pay.user_id, v_pay.id,
           (public.partner_config() ->> 'commission_usd')::numeric,
           'pending',
           now() + make_interval(days => (public.partner_config() ->> 'hold_days')::int)
      from public.referrals r
      join public.partners p on p.id = r.partner_id
     where r.referred_user_id = v_pay.user_id
       and p.status = 'active'
       and not exists (
         select 1 from public.payments x
          where x.user_id = v_pay.user_id and x.status = 'paid' and x.id <> v_pay.id
       )
    on conflict do nothing;
  exception when others then
    raise warning 'partner_earnings : gain non créé (%)', sqlerrm;   -- le paiement, lui, reste appliqué
  end;
  -- ===== FIN DE L'AJOUT =====

  return query select 'applied'::text, v_pay.user_id, v_exp;
end;
$$;

-- Personne d'autre que le serveur ne doit pouvoir appeler cette fonction (sinon : Premium gratuit).
revoke all on function public.apply_chariow_payment(text, numeric, text, text, text, jsonb, int) from public, anon, authenticated;
grant execute on function public.apply_chariow_payment(text, numeric, text, text, text, jsonb, int) to service_role;
