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
npm run dev        # nécessite .env.local avec VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm run build      # vérifie aussi les types TypeScript
```

Il n'y a plus de mode démo : sans les deux clés Supabase, l'appli affiche un écran « Configuration manquante ».

## Interrupteurs, lecture des photos et tableau de bord administrateur

- **Interrupteurs** : `src/lib/features.ts` (true = actif, false = caché). Recherche web, notifications, dictée, Librairie, Assistant TP, cartes automatiques, paiement Premium actifs ; création d'images éteinte.
- **Lecture des photos de cahier** : l'IA « vision » du serveur lit maintenant la photo (écriture manuscrite, tableaux recopiés en `| a | b |`). Tâche `read_photo` dans `ai-gateway` (à redéployer, ET à recopier dans la fonction `bright-worker` si c'est elle que l'appli appelle). Modèle : secret `VISION_MODEL` (un modèle qui lit les images), sinon `AI_MODEL_STRONG`. Si l'IA ne répond pas, l'appli retombe sur l'ancienne lecture du téléphone (texte imprimé seulement).
- **Tableau de bord administrateur** : c'est la page séparée `public/app-admin.html` (adresse du site + `/app-admin.html`), PAS une page de l'appli. Elle se connecte avec ton compte administrateur (`app_admins`) et montre : chiffres clés, inscriptions, parcours, IA, erreurs, la liste des étudiants (dernière connexion, dernière activité, cours, notes, cartes, Premium, essai) et les tables paiements, abonnements, essais, avis, erreurs, journal IA, demandes IA, Librairie (publier / refuser), notifications. À exécuter dans Supabase : `0028_tableau_de_bord.sql` (chiffres) puis `0032_admin_tableau_complet.sql` (listes ; peut être rejouée sans risque).
- Plus de mode démo ni de paiement en fenêtre intégrée.

## Visites guidées

Chaque page principale (Accueil, Mes cours, Un cours, Créer un cours, Librairie, Assistant, Moi) a sa petite visite, lancée à la première arrivée de l’étudiant puis relançable depuis **Moi › Visites guidées** (`/visites`) ou le Centre d’aide.

- Parcours et textes : `src/lib/tours.ts` · affichage (voile, projecteur, bulle de Memo, flèche) : `src/components/Tour.tsx` · liste et relance : `src/pages/Tours.tsx`.
- Un élément est visé par l’attribut `data-tour="…"` posé dans les pages ; s’il est absent, l’étape est sautée.
- Progression : copie locale par compte + métadonnées du compte (`user_metadata.tours`) — aucune migration SQL.
- Banc d’essai : `tools/tour-tests/` (voir son README).

## Profil public, likes et plaques (Librairie)

- Sous chaque document : photo + nom public (ou nom du Memo si l'étudiant n'en a pas choisi ; jamais le vrai nom) + promotion de l'auteur (touche la photo pour sa fiche : nom du Memo, faculté, université, bio, nombre de documents et de likes) et un cœur pour liker (on peut liker le sien).
- Plaques selon les likes d'un document : Bronze 100 · Or 500 · Diamant 1000 · Émeraude 1500 · Rubis 2000. Paliers et couleurs : `src/lib/plaque.ts`. Affichage : `src/components/AuthorBadge.tsx`.
- Nom public (40 car.) et bio (160 car.), facultatifs : **Moi › Mon profil › Modifier** seulement, jamais demandés à l'inscription.
- Base de données : **exécuter `supabase/migrations/0029_profil_public_likes_plaques.sql`** (ajoute seulement 2 tables et 3 fonctions ; ne modifie aucune table existante). Tant qu'elle n'est pas exécutée, la Librairie marche mais sans likes ni profils.
- Le guide de l'assistant (`supabase/functions/_shared/appGuide.ts`) en parle : redéployer `ai-gateway` après modification (`supabase functions deploy ai-gateway`).

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
# Paiement : NE PAS déployer « payments-initiate » en ligne de commande. L'application appelle la fonction « swift-worker » (nom donné par Supabase).
# Copie le contenu de supabase/functions/payments-initiate/index.ts dans swift-worker, depuis l'éditeur du tableau de bord (voir CHARIOW_SETUP.md).
supabase functions deploy payments-webhook --no-verify-jwt
supabase functions deploy payments-reconcile --no-verify-jwt
```

- `ai-gateway` : toutes les tâches IA (chat, notes structurées, quiz, plan et rédaction de TP). Quotas par minute et par jour (`AI_LIMIT_PER_MINUTE`, `AI_FREE_PER_DAY`, `AI_PREMIUM_PER_DAY`), modèle choisi selon la tâche, historique et consommation enregistrés. Pour changer de fournisseur d'IA, on ne modifie que la fonction `callModel`.
- `payments-initiate` (installée dans la fonction Supabase nommée `swift-worker`) / `payments-webhook` / `payments-reconcile` : paiement **Chariow** (1 paiement = 30 jours de Premium). Mise en place complète : voir `CHARIOW_SETUP.md`. Le montant est toujours fixé et revérifié côté serveur.

## Hébergement GitHub Pages

Dépôt GitHub → Settings → Pages → Source : *GitHub Actions*. Ajoute les secrets `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (Settings → Secrets and variables → Actions). Chaque push sur `main` publie le site (`.github/workflows/deploy.yml`). Le routage utilise `#` pour fonctionner sur GitHub Pages.

## Points à décider ou vérifier

- Paiement : Chariow retenu (OPTGateway abandonné). Moyens de paiement réellement proposés en RDC à confirmer sur la page de paiement.
- Limites gratuites de l'IA (`AI_FREE_PER_DAY` = 10 par défaut, valeur provisoire) et prix (4,05 USD / 9 000 FC) : à valider avec de vrais étudiants et le coût réel par utilisateur.
- Email de confirmation après Google : Google vérifie déjà l'adresse ; un email de confirmation supplémentaire demande un envoi d'email personnalisé (non fait).
- Sources Voix, Audio, Vidéo, PDF, Photo : affichées « Bientôt » ; seul le texte est actif. Prévoir un traitement asynchrone (et l'enregistreur basse consommation).
- Photos des animaux : illustrations vectorielles provisoires.
- Suppression de compte, signalement d'un document, antivirus sur les PDF : à ajouter.
