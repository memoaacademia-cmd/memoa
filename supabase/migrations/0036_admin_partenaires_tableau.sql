-- 0036 : Programme partenaire dans le tableau de bord administrateur (public/app-admin.html).
-- Deux fonctions réservées aux administrateurs (app_admins) : une pour LIRE, une pour AGIR.
-- Les fonctions d'origine (approve_partner, mark_payout_paid...) restent réservées au service_role : on ne les ouvre pas.
-- Idempotent : peut être relancé sans risque.

-- ---------------------------------------------------------------- 1. Lecture : demandes, retraits à payer, partenaires
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
          select po.id as payout_id, pa.full_name, pa.code, po.operator, po.phone, po.amount_usd, po.requested_at
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

-- ---------------------------------------------------------------- 2. Action : approuver, refuser, suspendre, payer, refuser un retrait
create or replace function public.admin_partner_action(p_action text, p_id uuid, p_text text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    return public.approve_partner(p_id);
  elsif p_action = 'reject' then
    return public.reject_partner(p_id);
  elsif p_action = 'suspend' then
    return public.suspend_partner(p_id);
  elsif p_action = 'pay' then
    return public.mark_payout_paid(p_id, p_text);
  elsif p_action = 'reject_payout' then
    return public.reject_payout(p_id, p_text);
  end if;

  raise exception 'bad action' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------- 3. Droits : administrateurs connectés seulement (le test is_admin() ci-dessus est la vraie barrière)
revoke all on function public.admin_partner_overview() from public, anon;
revoke all on function public.admin_partner_action(text, uuid, text) from public, anon;
grant execute on function public.admin_partner_overview() to authenticated;
grant execute on function public.admin_partner_action(text, uuid, text) to authenticated;
