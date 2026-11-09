# Memoa — Étudiez plus intelligemment

Compagnon académique pour les étudiants (RDC d'abord). React + Vite (interface) et Supabase (comptes, base de données, fichiers, fonctions serveur).

> **État** : première version du code, écrite à partir de la maquette validée. Le schéma SQL a été rejoué sur un vrai PostgreSQL 16 (isolation entre étudiants vérifiée). L'interface React n'a **pas encore été compilée** (voir « Premier lancement »).

## Règles produit appliquées

- **Cours** (onglet) : sert uniquement à créer un cours. Le cours créé est rangé dans le **Sac à dos**.
- **Sac à dos** : l'étagère de tous les cours, chacun nommé. Dans un cours : ajouter une note (enrichir), Assistant TP, réviser, télécharger, podcast (bientôt).
- **Librairie** : rangée par **promotion** (L1, L2, L3, Master 1, Master 2, Doctorat), toutes facultés confondues, avec un filtre facultatif par faculté. **Pas de département** dans la Librairie.
- Facultés et départements de l'inscription : tirés des répertoires UPN et UNIKIN 2026-2027 (`src/data/academic.ts`), avec toujours « Autre … (je l'écris moi-même) ».
- « Continuer avec Google » uniquement sur **Créer un compte**. Après Google : mot de passe + téléphone.

## Premier lancement

```bash
npm install
npm run dev        # sans clés Supabase : MODE DÉMO (données dans le navigateur)
npm run build      # vérifie aussi les types TypeScript
```

Le mode démo sert à explorer l'interface. Il ne protège rien (mots de passe en clair dans le navigateur) : jamais en production.

## Brancher Supabase

1. Crée un projet sur supabase.com.
2. SQL Editor → colle et exécute `supabase/migrations/0001_init.sql`.
3. Authentication → Providers : Email (garde « Confirm email » activé) et Google (Client ID / Secret créés dans Google Cloud).
4. Authentication → URL Configuration : **Site URL** = l'adresse du site ; **Redirect URLs** = la même adresse (ex. `https://TON-COMPTE.github.io/memoa/`).
5. Copie `.env.example` en `.env.local` et remplis `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Project Settings → API). La clé *anon* est publique par conception ; la protection vient des règles RLS de la migration.
6. Devenir administrateur Memoa : après ton inscription, dans le SQL Editor :
   `insert into public.app_admins (user_id) select id from auth.users where email = 'ton@email';`
   (un admin valide les documents de la Librairie : `update library_documents set status='published' where id = '…'`).

## Fonctions serveur (IA et paiements)

```bash
npm i -g supabase
supabase login && supabase link --project-ref TON_REF
supabase secrets set GEMINI_API_KEY=...           # clé d'IA : UNIQUEMENT ici, jamais dans le code ni dans .env
supabase secrets set AI_MODEL_FAST=gemini-2.5-flash AI_MODEL_STRONG=gemini-2.5-flash   # vérifie les noms de modèles actuels
supabase functions deploy ai-gateway
supabase functions deploy payments-initiate
supabase functions deploy payments-webhook
```

- `ai-gateway` : toutes les tâches IA (chat, notes structurées, quiz, plan et rédaction de TP). Quotas par minute et par jour (`AI_LIMIT_PER_MINUTE`, `AI_FREE_PER_DAY`, `AI_PREMIUM_PER_DAY`), modèle choisi selon la tâche, historique et consommation enregistrés. Pour changer de fournisseur d'IA, on ne modifie que la fonction `callModel`.
- `payments-initiate` / `payments-webhook` : **squelettes**. Ils refusent tant que l'agrégateur Mobile Money n'est pas choisi et branché (`PAYMENT_PROVIDER_ENABLED`, `PAYMENT_WEBHOOK_SECRET`). Le montant est toujours fixé côté serveur.

## Hébergement GitHub Pages

Dépôt GitHub → Settings → Pages → Source : *GitHub Actions*. Ajoute les secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions). Chaque push sur `main` publie le site (`.github/workflows/deploy.yml`). Le routage utilise `#` pour fonctionner sur GitHub Pages.

## Points à décider ou vérifier

- Agrégateur Mobile Money (Orange, Airtel, M-Pesa) : non choisi.
- Limites gratuites de l'IA (`AI_FREE_PER_DAY` = 10 par défaut, valeur provisoire) et prix (4,50 USD / 10 500 FC) : à valider avec de vrais étudiants et le coût réel par utilisateur.
- Email de confirmation après Google : Google vérifie déjà l'adresse ; un email de confirmation supplémentaire demande un envoi d'email personnalisé (non fait).
- Sources Voix, Audio, Vidéo, PDF, Photo : affichées « Bientôt » ; seul le texte est actif. Prévoir un traitement asynchrone (et l'enregistreur basse consommation).
- Photos des animaux : illustrations vectorielles provisoires.
- Suppression de compte, signalement d'un document, antivirus sur les PDF : à ajouter.
