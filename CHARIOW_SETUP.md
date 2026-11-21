# Paiement Chariow — mise en place, tests, mise en production

Modèle : **1 paiement = 30 jours de Premium**. Chariow n'a pas d'abonnement automatique (rien dans la doc) : chaque mois l'étudiant repaie, les rappels d'expiration (7 j, 2 j, fin) existent déjà.

## Parcours étudiant
Bouton « S'abonner · 4,05 USD » → page de paiement Chariow (email, nom et numéro déjà transmis depuis son compte) → retour automatique dans l'app → « Activation en cours… » → Premium actif.
Si l'étudiant ferme l'onglet : le webhook active quand même, sinon le bouton « J'ai payé · Vérifier mon paiement », sinon le cron (≤ 10 min).

## Sécurité (ce qui est appliqué)
- `user_id` = JWT, jamais le navigateur ; le montant n'est jamais envoyé par le navigateur.
- Webhook : signature HMAC-SHA256 du corps brut (`x-chariow-signature`), comparaison en temps constant, 401 sinon.
- Le contenu du webhook n'est PAS cru : la vente est relue chez Chariow (statut `completed`/`settled`, bon produit, 4,05 USD) avant toute activation.
- Activation atomique et idempotente en SQL (`apply_chariow_payment`) : un rejeu ne prolonge jamais deux fois ; réservée au `service_role`.
- Tout événement est journalisé dans `payment_events` ; la vente complète dans `payments.raw`.
- 2xx pour doublons/tests/refus définitifs ; 5xx seulement pour panne temporaire (Chariow réessaie : +10 s, +100 s, +17 min, +2 h47, puis **désactive le Pulse** → le cron de rattrapage est indispensable).

## 1. Chariow (dashboard)
1. **Produit** : Products › Add product › **Licenses**. Nom « Memoa Premium (30 jours) », prix unique **4,05 USD**, génération automatique de clés, validité 30 jours (indicatif : l'app ne s'en sert pas). **Publier** le produit (non publié = erreur 404). Noter son **ID public** (`prd_…`).
   - Il faut un produit *Licence* : les autres types (téléchargeable, cours) refusent un 2ᵉ achat tant que l'accès est actif, donc pas de renouvellement.
2. **Clé API** : Settings › Developer › API Keys › Create. Permissions : création de checkout **et** lecture des ventes. Copier la clé `sk_…` (affichée une seule fois).
3. **Pulse** (webhook) : créer un Pulse, URL = `https://<REF-PROJET>.supabase.co/functions/v1/<ADRESSE-DE-payments-webhook>`, événement **successful sale**, limité à ce produit. Copier le secret `whsec_…` (onglet Overview du Pulse). Pas de `?token=` : la signature HMAC suffit et est documentée.
4. Pas d'URL de succès à régler dans le produit : l'app la fournit à chaque paiement (`redirect_url`).

## 2. Supabase
1. SQL Editor : exécuter `supabase/migrations/0019_chariow.sql`.
2. Secrets (Edge Functions › Secrets) : `CHARIOW_API_KEY`, `CHARIOW_PRODUCT_ID`, `CHARIOW_WEBHOOK_SECRET`, `APP_URL` (ex. `https://TON-COMPTE.github.io/memoa/`), `PAYMENT_PROVIDER_ENABLED=true`. `CRON_SECRET` existe déjà. Supprimer `OPTGATEWAY_*`.
3. Fonctions (coller le fichier entier) :
   - `payments-initiate/index.ts` → dans la fonction **swift-worker** (c'est elle que l'app appelle).
   - `payments-webhook/index.ts` → dans la fonction du webhook, **Verify JWT désactivé**.
   - `payments-reconcile/index.ts` → NOUVELLE fonction, **Verify JWT désactivé**.
4. SQL Editor : `supabase/cron_payments_reconcile.sql` (remplacer les 2 valeurs `<< >>`).
5. Pousser le code sur GitHub (déploiement de l'interface).

## 3. Plan de test (dans cet ordre)
| # | Test | Résultat attendu |
|---|---|---|
| 1 | Bouton « Test » du Pulse dans Chariow | 200 ; ligne `payment_events` avec `outcome = test` ; aucune activation |
| 2 | Achat réel de 4,05 USD avec TON compte | retour dans l'app, « Activation en cours… », puis Premium actif ~30 jours ; `payments.status = paid`, `raw` rempli |
| 3 | Dans Chariow, **rejouer** la livraison du Pulse | 200 ; `payment_events.outcome = duplicate` ; date de fin inchangée |
| 4 | Payer avec un autre email que celui du compte (modifier l'email sur la page de paiement) | activé quand même (lien par l'identifiant de vente) |
| 5 | Payer puis fermer l'onglet avant le retour | activé par le webhook ; sinon « Vérifier mon paiement » |
| 6 | Désactiver le Pulse, payer | activé par le cron en ≤ 10 min (`payment_events.event = reconcile`) |
| 7 | Payer 2 fois de suite | fin = ancienne fin + 30 jours (pas depuis aujourd'hui) |
| 8 | `update subscriptions set expires_at = now() - interval '1 day' where user_id = '<id>';` | bannière « terminé » + bouton « S'abonner » |
| 9 | Abandonner un paiement (ne pas payer) | rien d'activé ; ligne `pending` ignorée |
| 10 | Appel du webhook avec une mauvaise signature (curl) | 401 |

## 4. HYPOTHÈSES À VALIDER avec le tout premier paiement (regarder `payments.raw` et `payment_events`)
- `GET /v1/sales/{id}` renvoie bien `status = completed`, `product.id`, `amount.value` (4.05 et non 405) et `amount.currency = USD`. Sinon le paiement est refusé avec `outcome = rejected:…` — le texte indique quoi corriger dans `judgeSale()`.
- Un **code promo** ou une conversion de devise change le montant → refus volontaire (`rejected:montant`). À assouplir si vous voulez des promotions.
- L'ID produit du payload (`product.id`) est celui de `CHARIOW_PRODUCT_ID`.
- La clé API a les bonnes permissions (sinon 403 dans les logs de `swift-worker`).
- Le retour `?paiement=retour#/premium` est accepté comme `redirect_url`.
- **Surtout : quels moyens de paiement Chariow affiche pour un client en RDC (Orange / Airtel / M-Pesa ? carte ?)** — la doc ne le dit pas. À regarder sur la vraie page de paiement avant de communiquer.
- « Pas de plafond » chez Chariow : non documenté, à confirmer auprès d'eux (plafond par transaction, par jour, par retrait).

## 5. Mise en production — checklist
- [ ] Aucune clé (`sk_`, `whsec_`, service_role) dans le dépôt Git ni dans `.env`
- [ ] Les 5 secrets Supabase posés ; anciens secrets OPTGateway supprimés
- [ ] Migration 0019 exécutée ; cron `memoa-payments-reconcile` actif (`select * from cron.job;`)
- [ ] Verify JWT désactivé sur webhook + reconcile, activé sur swift-worker
- [ ] Tests 1 à 10 passés avec un vrai paiement
- [ ] Surveillance (SQL Editor) :
  - orphelins : `select * from payment_events where outcome not in ('applied','duplicate','ignored','test') order by created_at desc;`
  - bloqués : `select * from payments where provider='chariow' and status='pending' and created_at < now() - interval '1 hour';`
  - Pulse désactivé (email de Chariow) : le réactiver dans Chariow puis « rejouer » les livraisons.
- [ ] Support : un paiement « orphelin » (`unmatched`) = l'étudiant a payé hors de l'app avec un email inconnu → l'activer à la main :
  `insert into subscriptions(user_id, expires_at) values ('<id>', now() + interval '30 days') on conflict (user_id) do update set expires_at = greatest(subscriptions.expires_at, now()) + interval '30 days';`
