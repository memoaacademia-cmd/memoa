-- 0032 : tableau de bord administrateur complet (lecture seule, sauf la validation des documents de la Librairie).
-- Ne modifie AUCUNE règle de sécurité existante et AUCUNE table : ajoute seulement 3 fonctions, qui refusent tout compte absent
-- de public.app_admins (même liste que public.is_admin()). Réexécutable sans erreur.
-- Aucun contenu privé n'est exposé : jamais le texte des notes, ni les messages du chat, ni les mots de passe.

-- ------------------------------------------------------------------ 1. Liste des étudiants (avec dernière connexion)
create or replace function public.admin_users(p_search text default '', p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := lower(btrim(coalesce(p_search, '')));
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  with base as (
    select u.id, u.email, u.created_at as signed_up_at, u.last_sign_in_at, u.email_confirmed_at,
           p.first_name, p.last_name, p.post_name, p.full_name,
           coalesce(nullif(p.phone, ''), nullif(u.phone, '')) as phone,
           p.university, p.faculty, p.department, p.promotion, p.memo_name,
           (p.id is not null) as has_profile
    from auth.users u
    left join public.profiles p on p.id = u.id
    where q = ''
       or position(q in lower(coalesce(u.email, ''))) > 0
       or position(q in lower(coalesce(p.full_name, ''))) > 0
       or position(q in lower(coalesce(p.last_name, ''))) > 0
       or position(q in lower(coalesce(p.first_name, ''))) > 0
       or position(q in lower(coalesce(p.phone, u.phone, ''))) > 0
       or position(q in lower(coalesce(p.university, ''))) > 0
  ), seen as (
    select b.*, (select max(e.created_at) from public.app_events e where e.user_id = b.id) as last_activity
    from base b
  ), page as (
    select * from seen
    order by greatest(last_activity, last_sign_in_at) desc nulls last, signed_up_at desc
    limit lim offset off
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'email', g.email,
        'name', nullif(btrim(concat_ws(' ', g.first_name, g.post_name, g.last_name)), ''),
        'full_name', nullif(g.full_name, ''),
        'phone', g.phone,
        'university', nullif(g.university, ''),
        'faculty', nullif(g.faculty, ''),
        'department', nullif(g.department, ''),
        'promotion', g.promotion,
        'memo_name', g.memo_name,
        'email_confirmed', g.email_confirmed_at is not null,
        'signed_up_at', g.signed_up_at,
        'last_sign_in_at', g.last_sign_in_at,
        'last_activity', g.last_activity,
        'courses', (select count(*) from public.courses c where c.user_id = g.id and c.deleted_at is null),
        'notes', (select count(*) from public.notes n where n.user_id = g.id),
        'cards', (select count(*) from public.review_cards r where r.user_id = g.id),
        'ai_requests', (select count(*) from public.ai_usage a where a.user_id = g.id),
        'ai_last', (select max(a.created_at) from public.ai_usage a where a.user_id = g.id),
        'premium_until', (select s.expires_at from public.subscriptions s where s.user_id = g.id),
        'trial_started', (select t.started_at from public.trial_starts t where t.user_id = g.id),
        'paid_total', (select count(*) from public.payments y where y.user_id = g.id and y.status = 'paid'),
        'notifications', (select count(*) from public.push_subscriptions ps where ps.user_id = g.id),
        'is_admin', exists (select 1 from public.app_admins ad where ad.user_id = g.id)
      ) order by greatest(g.last_activity, g.last_sign_in_at) desc nulls last, g.signed_up_at desc)
      from page g
    ), '[]'::jsonb)
  ) into res;

  return res;
end;
$$;

revoke all on function public.admin_users(text, int, int) from public, anon;
grant execute on function public.admin_users(text, int, int) to authenticated;

-- ------------------------------------------------------------------ 2. Les autres tables importantes (une « vue » à la fois)
-- p_kind : payments | subscriptions | trials | feedback | errors | ai_log | ai_usage | library | push
create or replace function public.admin_list(p_kind text, p_limit int default 50, p_offset int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  off int := greatest(coalesce(p_offset, 0), 0);
  res jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_kind = 'payments' then
    select jsonb_build_object('total', (select count(*) from public.payments), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select y.id, coalesce(u.email, y.email) as email, y.provider, y.amount, y.currency, y.status, y.provider_ref, y.created_at, y.processed_at
          from public.payments y left join auth.users u on u.id = y.user_id
          order by y.created_at desc limit lim offset off) x;
  elsif p_kind = 'subscriptions' then
    select jsonb_build_object('total', (select count(*) from public.subscriptions), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select s.user_id, u.email, s.expires_at, s.updated_at, (s.expires_at > now()) as active
          from public.subscriptions s left join auth.users u on u.id = s.user_id
          order by s.expires_at desc limit lim offset off) x;
  elsif p_kind = 'trials' then
    select jsonb_build_object('total', (select count(*) from public.trial_starts), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select t.user_id, u.email, t.started_at
          from public.trial_starts t left join auth.users u on u.id = t.user_id
          order by t.started_at desc limit lim offset off) x;
  elsif p_kind = 'feedback' then
    select jsonb_build_object('total', (select count(*) from public.feedback), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select f.id, u.email, f.kind, f.rating, f.message, f.user_agent, f.created_at
          from public.feedback f left join auth.users u on u.id = f.user_id
          order by f.created_at desc limit lim offset off) x;
  elsif p_kind = 'errors' then
    select jsonb_build_object('total', (select count(*) from public.app_errors), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select e.id, u.email, e.message, e.route, e.user_agent, left(e.stack, 600) as stack, e.created_at
          from public.app_errors e left join auth.users u on u.id = e.user_id
          order by e.created_at desc limit lim offset off) x;
  elsif p_kind = 'ai_log' then
    select jsonb_build_object('total', (select count(*) from public.ai_log), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select l.id, u.email, l.kind, l.task, l.model, left(l.detail, 300) as detail, l.created_at
          from public.ai_log l left join auth.users u on u.id = l.user_id
          order by l.created_at desc limit lim offset off) x;
  elsif p_kind = 'ai_usage' then
    select jsonb_build_object('total', (select count(*) from public.ai_usage), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select a.id, u.email, a.task, a.model, a.tokens_in, a.tokens_out, a.created_at
          from public.ai_usage a left join auth.users u on u.id = a.user_id
          order by a.created_at desc limit lim offset off) x;
  elsif p_kind = 'library' then
    select jsonb_build_object('total', (select count(*) from public.library_documents), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select d.id, u.email as owner_email, d.title, d.doc_type, d.university, d.faculty, d.promotion, d.course_title, d.status, d.created_at, (d.deleted_at is not null) as deleted
          from public.library_documents d left join auth.users u on u.id = d.owner_id
          order by (d.status = 'pending') desc, d.created_at desc limit lim offset off) x;
  elsif p_kind = 'push' then
    select jsonb_build_object('total', (select count(*) from public.push_subscriptions), 'rows', coalesce(jsonb_agg(x), '[]'::jsonb)) into res
    from (select ps.id, u.email, ps.created_at, ps.last_sent_at
          from public.push_subscriptions ps left join auth.users u on u.id = ps.user_id
          order by ps.created_at desc limit lim offset off) x;
  else
    raise exception 'unknown kind' using errcode = '22023';
  end if;

  return res;
end;
$$;

revoke all on function public.admin_list(text, int, int) from public, anon;
grant execute on function public.admin_list(text, int, int) to authenticated;

-- ------------------------------------------------------------------ 3. Valider / refuser un document de la Librairie (remplace la requête SQL à la main)
create or replace function public.admin_set_doc_status(p_doc uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_status not in ('pending', 'published', 'rejected') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  update public.library_documents set status = p_status where id = p_doc;
end;
$$;

revoke all on function public.admin_set_doc_status(uuid, text) from public, anon;
grant execute on function public.admin_set_doc_status(uuid, text) to authenticated;
