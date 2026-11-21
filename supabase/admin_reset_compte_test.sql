-- REMISE À ZÉRO D'UN COMPTE DE TEST (usage : tes propres adresses e-mail de test, JAMAIS un vrai étudiant).
-- Efface toutes les données de l'application liées à cet e-mail (profil, cours, notes, abonnement, parrain, historique d'essais de code...),
-- mais GARDE la ligne de connexion : la personne peut se reconnecter avec le même e-mail et le même mot de passe, et refaire l'inscription.
-- Elle remet aussi la date d'inscription à « maintenant » (le parrainage n'est possible que les 7 premiers jours).
-- Les paiements de ce compte sont détachés de lui (comme dans la vraie suppression), et ses sessions sont fermées (il se reconnecte).
-- Refusé par sécurité si l'e-mail est un administrateur ou un partenaire.
-- UTILISATION : remplace l'e-mail à la ligne marquée « <<< ICI », puis Run (une seule fois).

do $$
declare
  v_email text := lower(btrim('REMPLACE@EXEMPLE.COM'));   -- <<< ICI : l'e-mail du compte de test
  v_uid uuid;
  r record;
begin
  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is null then raise exception 'Aucun compte avec cet e-mail.'; end if;
  if exists (select 1 from public.app_admins where user_id = v_uid) then
    raise exception 'Cet e-mail est administrateur : refusé par sécurité.';
  end if;
  if exists (select 1 from public.partners where user_id = v_uid) then
    raise exception 'Cet e-mail est un partenaire : refusé par sécurité. Utilise un autre e-mail de test.';
  end if;

  -- Parrainage : le lien de parrain disparaît ; un gain déjà créé reste chez le partenaire mais n'est plus rattaché à cet étudiant.
  delete from public.referrals where referred_user_id = v_uid;
  update public.partner_earnings set referred_user_id = null where referred_user_id = v_uid;
  delete from public.partner_attach_attempts where user_id = v_uid;

  -- Toutes les autres tables de l'application qui pointent vers ce compte (liste trouvée automatiquement).
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, c.confdeltype as del
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
      join pg_class cl on cl.oid = c.conrelid
      join pg_namespace n on n.oid = cl.relnamespace
     where c.contype = 'f'
       and c.confrelid = 'auth.users'::regclass
       and array_length(c.conkey, 1) = 1
       and n.nspname = 'public'
       and cl.relname not in ('partners', 'referrals', 'partner_earnings', 'partner_attach_attempts', 'app_admins')
  loop
    if r.del = 'c' then            -- « on delete cascade » : on efface les lignes
      execute format('delete from %s where %I = $1', r.tbl, r.col) using v_uid;
    elsif r.del = 'n' then         -- « on delete set null » : on détache les lignes (paiements, documents publiés...)
      execute format('update %s set %I = null where %I = $1', r.tbl, r.col, r.col) using v_uid;
    else
      raise notice 'Table % ignorée (règle de suppression inattendue)', r.tbl;
    end if;
  end loop;

  -- Les paiements détachés perdent aussi les données personnelles (comme la vraie suppression de compte).
  update public.payments set email = null, raw = null where user_id is null and email = v_email;

  -- Compte « neuf » : date d'inscription = maintenant, sessions fermées (reconnexion avec le même e-mail et mot de passe).
  update auth.users set created_at = now() where id = v_uid;
  delete from auth.sessions where user_id = v_uid;
end $$;

-- Contrôle (facultatif) : le compte remis à zéro apparaît en premier, avec « profil = 0 ».
select u.email, u.created_at,
       (select count(*) from public.profiles p where p.id = u.id) as profil
  from auth.users u
 order by u.created_at desc
 limit 3;
