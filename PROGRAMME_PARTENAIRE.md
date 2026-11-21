# Programme partenaire — mode d'emploi

> **Mises à jour (version complète)** : ce paquet contient aussi
> - `supabase/migrations/0036_admin_partenaires_tableau.sql` : à exécuter dans le SQL Editor (en plus de 0035). Il active la carte « Programme partenaire » du tableau de bord (`public/app-admin.html`) : demandes à valider, retraits à payer, partenaires.
> - `src/pages/Partner.tsx` : le programme partenaire est une page à part, ouverte par la ligne « Programme partenaire » de l'onglet Moi (au lieu d'une carte dépliée).
> - Page d'installation partenaire : code mis en avant + bouton « Copier mon code » + flèche des trois points sur iPhone ; champ « Coller mon code » plus visible.
> - `supabase/admin_reset_compte_test.sql` : remise à zéro d'un compte de TEST (garde la connexion, efface les données).


## 1. Fichiers du paquet (chemins depuis la racine du dépôt)

**Nouveaux**
- `supabase/migrations/0035_partner_program.sql` — tables, règles de sécurité, fonctions, gain de 1 $ (inclut la nouvelle version de `apply_chariow_payment`)
- `supabase/admin_partenaires.sql` — tes requêtes d'administration (approuver, payer, refuser…)
- `supabase/functions/partner-alerts/index.ts` — alerte sur ton téléphone (demande de partenaire, retrait)
- `supabase/cron_partner_alerts.sql` — planification de cette alerte (toutes les 5 min)
- `src/lib/referral.ts`, `src/lib/partner.ts`
- `src/components/PartnerSection.tsx`, `ReferralAttach.tsx`, `ReferralCodeField.tsx`
- `src/pages/PartnerLanding.tsx`

**Modifiés (fichiers complets, à remplacer)**
- `src/App.tsx`, `src/main.tsx`, `src/pages/Auth.tsx`, `src/pages/Me.tsx`, `src/lib/features.ts`, `src/styles.css`, `supabase/config.toml`

**Non modifiés volontairement** : `payments-webhook`, `payments-initiate`, `payments-reconcile`, `account-delete`, `manifest.webmanifest`, `sw.js`, `index.html`. Le gain se crée dans la base (dans `apply_chariow_payment`), donc la fonction webhook n'a pas besoin d'être redéployée.

## 2. Étapes, dans l'ordre

1. **Sauvegarde** : Supabase → Database → Backups (ou *Settings → Database → Backups*), fais une sauvegarde manuelle. Note l'heure.
2. **SQL** : Supabase → *SQL Editor* → *New query* → colle TOUT le contenu de `0035_partner_program.sql` → *Run*. Attendu : « Success. No rows returned ». Si une erreur rouge apparaît, ne continue pas : copie-la-moi.
3. **Site** : décompresse le zip, ouvre ton dépôt sur GitHub → *Add file → Upload files* → glisse les dossiers `src` et `supabase` ET le fichier `PROGRAMME_PARTENAIRE.md` → *Commit changes*. GitHub Actions republie le site (onglet *Actions*, attends la coche verte). Ensuite, ferme puis rouvre l'application sur ton téléphone.
4. **Alerte admin (facultatif mais recommandé)** : Supabase → *Edge Functions* → *Deploy a new function* (éditeur) → nom `partner-alerts` → colle `supabase/functions/partner-alerts/index.ts` → désactive **Verify JWT** → Deploy. Note l'adresse réelle de la fonction (comme pour tes autres cron). Puis ouvre `supabase/cron_partner_alerts.sql`, remplace `<<ADRESSE_DU_PROJET>>` et `<<CODE_SECRET_CRON>>` par les mêmes valeurs que pour `cron_expiry_push.sql`, et exécute-le dans le SQL Editor. Ton compte doit être dans `app_admins` et avoir activé les notifications dans Réglages.
5. **Premier partenaire** : crée ton propre compte partenaire (Moi → Devenir partenaire), puis approuve-le avec `supabase/admin_partenaires.sql` (requêtes 1 et 2).

## 3. Pourquoi cette alerte admin

Solution la plus simple : une petite fonction planifiée (même modèle que tes rappels existants) qui envoie un push à tes comptes `app_admins` quand une demande ou un retrait attend. Pas d'interface admin à construire ; les listes SQL (requêtes 1 et 4) restent la référence si le push n'arrive pas. Le push aux partenaires (« Nouvelle personne inscrite », « +1 $ ») existe aussi, éteint par défaut : `PARTNER_PUSH_ENABLED = false` dans la fonction.

## 4. Diff exact de `apply_chariow_payment`

Signature, validation du paiement, verrou, idempotence : **inchangés**. Un seul bloc est ajouté, juste avant le dernier `return query select 'applied'…` :

```sql
  -- ===== AJOUT : Programme partenaire (commission au PREMIER paiement du filleul, même transaction) =====
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
```

Webhook rejoué : la fonction s'arrête plus haut (`duplicate`), rien n'est créé. Et même sans cela, `payment_id` UNIQUE et `referred_user_id` UNIQUE bloquent un second gain.

## 5. Test de 15 minutes : le code survit-il à l'installation ?

Prépare un partenaire actif (ex. code `JOEL-K7X2`) et le lien `https://TON-SITE/?ref=JOEL-K7X2`. Pas de compte encore créé sur le téléphone de test.

**Android (Chrome)** — 7 min
1. Ouvre le lien dans Chrome : l'écran « Installe Memoa » doit afficher « Ton code partenaire : JOEL-K7X2 ».
2. Touche « Installer Memoa » → confirme. Retour : message « Ton code est copié… ».
3. Ouvre Memoa depuis l'icône de l'écran d'accueil → « Créer un compte ».
4. Regarde le champ « Code partenaire » : **rempli tout seul ?** (A = l'adresse a voyagé.) Sinon, vide ? Touche « Coller mon code » : **rempli ?** (B = le presse-papiers a voyagé.) Sinon, tape-le (C).
5. Note A / B / C.

**iPhone (Safari)** — 8 min : mêmes étapes, avec Partager → « Sur l'écran d'accueil ». Sur iPhone, l'application installée garde un stockage SÉPARÉ de Safari : attends-toi à B ou C, et note si Safari demande l'autorisation de coller (« Autoriser le collage »).

Dis-moi les résultats (A/B/C par téléphone) : on saura quel filet fonctionne chez tes étudiants.

## 6. Plan de test (12 contrôles)

1. Demande : compte A → Moi → Devenir partenaire (CP) → « On examine ta demande ».
2. Alerte : tu reçois le push « 1 demande de partenaire à valider » (≤ 5 min), ou la liste SQL 1 montre la demande.
3. Approbation : requête 2 → A voit son code (ex. `PRENOM-K7X2`) et son lien.
4. Inscription avec code : compte B s'inscrit avec le code de A → A voit « Inscrits via ton lien : 1 ».
5. Auto-parrainage : A saisit son propre code (Réglages, ou nouveau compte avec son code) → refusé.
6. Code invalide : compte C avec `ABCD-ZZZZ` → message « Code non reconnu… », l'inscription réussit quand même.
7. 2e parrain : B (déjà parrainé) tente un autre code → refusé (« déjà un parrain »). Le champ disparaît des Réglages.
8. Paiement test de B (Premium) → A voit « En attente 1,00 $ (disponibles dans 7 jours) » et « Abonnés payants : 1 ».
9. Webhook rejoué (renvoie la même vente depuis Chariow ou `payments-reconcile`) → toujours 1,00 $, jamais 2.
10. Retrait sous 10 $ : bouton « Réclamer mes gains » grisé, « Encore X $ pour retirer ».
11. Retrait accepté : pour tester sans attendre 10 filleuls, dans le SQL Editor mets temporairement `'min_payout_usd', 1` et `'hold_days', 0` dans `partner_config()`, refais le paiement test → demande de retrait → liste SQL 4 → requête 5 (marquer payé) → A voit « Payé ». **Puis remets 10 et 7.**
12. Code qui voyage : test du §5 sur un vrai iPhone et un vrai Android.

## 7. Hypothèses et points à vérifier

- **Domaine** : introuvable dans le projet (le README donne `https://TON-COMPTE.github.io/memoa/`). Le lien est donc construit avec l'adresse réelle du site au moment où le partenaire ouvre l'app (`origin + chemin`) : rien à configurer.
- **Compte supprimé** — filleul : sa ligne de parrainage disparaît, mais ses gains déjà créés ou payés restent (clés en « set null »). Partenaire : sa ligne reste anonymisée (nom et numéro effacés, statut « suspendu », code gardé), ses gains non retirés sont annulés ; un retrait déjà demandé reste à payer (le numéro est gardé dans la ligne du retrait). Choix : garder l'historique comptable et ne jamais faire disparaître un montant dû. `account-delete` n'a pas été modifié ; il passe tel quel. Écart avec ta consigne : `partners.user_id` est « on delete set null » et non « cascade », pour cette raison.
- **Remboursement** : le projet n'en gère aucun. Si tu rembourses un abonné, lance la requête 8 (annule le gain tant qu'il n'est ni demandé ni payé).
- **Table en plus** : `partner_attach_attempts` (compteur 5 essais/heure), indispensable à la limite de débit.
- **Fonction en plus** : `referral_status()` (dit à Réglages s'il faut afficher le champ) et `suspend_partner`, `void_earning_for_user`.
- **Code mal formé à l'inscription** (ex. « JOEL » sans suffixe) : l'inscription est bloquée par un message tant que le champ n'est pas corrigé ou vidé. Un code bien formé mais inexistant ne bloque jamais.
- **Partenaire suspendu après un gain** : le gain en cours reste ; il ne peut plus demander de retrait (statut non actif). À toi de réactiver ou de régler à la main.
- **Premier paiement uniquement** : si le partenaire était suspendu au 1er paiement du filleul, il ne gagne rien sur les paiements suivants (jamais de commission sur un renouvellement).
- **Chiffres en dur** : tous dans `partner_config()` (commission 1 $, délai 7 j, seuil 10 $, fenêtre 7 j, 5 essais/h). Le prix Premium reste celui de Chariow (4,05 $).
- **Taux de change** : tout est en USD ; le paiement en FC est déjà converti côté Chariow, la commission reste 1 $.
- **Manifeste dynamique** : à l'arrivée par lien, l'app remplace le manifeste par une copie dont `start_url` garde `?ref=`. Chrome peut l'ignorer ; iPhone n'en tient pas toujours compte. Le presse-papiers est le filet principal ; c'est ce que mesure le test §5.
- **Pas de devinette par IP** (comme demandé).
- **Vérifications non faites ici** : je n'ai pas pu exécuter le SQL sur un vrai PostgreSQL ni compiler le projet (pas de réseau pour installer les dépendances). Le SQL est relu à la main ; le site se compile à la publication GitHub : si l'onglet *Actions* affiche une croix rouge, copie-moi l'erreur.
- **À décider plus tard** : paiement de retraits en lot, plafond de gains par partenaire, anti-fraude (un partenaire qui crée de faux comptes payants avec son propre argent ne gagne rien : le paiement est réel), page de conditions du programme.
- **V2** : tableau de bord admin visuel, push partenaire activé par défaut.
