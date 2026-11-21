// INTERRUPTEURS DES FONCTIONS DE MEMOA
// true = la fonction est active, false = elle est cachée / désactivée dans l'application.
// Pour allumer ou éteindre une fonction : change true/false ci-dessous, puis republie le site. Rien d'autre à toucher.
// (Les valeurs actuelles reproduisent exactement l'état de l'appli avant l'ajout des interrupteurs.)

/** Recherche web de Memo (bouton globe). Exige le secret SEARCH_API_KEY (Tavily) dans Supabase. */
export const WEB_SEARCH_ENABLED = true

/** Notifications (« Le savais-tu ? », brouillons, cartes de révision). Exige aussi la clé VAPID ci-dessous. */
export const NOTIFICATIONS_ENABLED = true

/** Dictée vocale (micro) dans les éditeurs. */
export const DICTATION_ENABLED = true

/** Librairie (onglet de partage de documents entre étudiants). */
export const LIBRARY_ENABLED = true

/** Assistant TP (plan et rédaction d'un travail pratique) dans la page d'un cours. */
export const TP_ASSISTANT_ENABLED = true

/** Préparation automatique des cartes de révision à l'ouverture de l'appli. */
export const AUTO_CARDS_ENABLED = true

/** Paiement Premium (bouton « S'abonner » dans Moi › Premium). */
export const PAYMENT_ENABLED = true

/** Programme partenaire (affiliation) : section dans Moi, champ « Code partenaire » dans Réglages et à l'inscription, écran d'accueil des liens ?ref=. false = tout est caché. Le serveur (migration 0035) reste en place. */
export const PARTNER_PROGRAM_ENABLED = true

/** Création d'images par Memo (Premium). Éteint : Memo répond qu'il ne sait pas créer d'images. Même s'il est allumé ici, le serveur doit avoir IMAGE_MODEL configuré. */
export const IMAGE_GENERATION_ENABLED = false

// Clé PUBLIQUE des notifications (VAPID) : elle peut rester dans le dépôt. La clé privée, elle, vit uniquement dans les secrets Supabase.
// Tant que cette valeur est vide, les notifications sont cachées partout dans l'application.
export const VAPID_PUBLIC_KEY =
  'BFSlSc6xPsaWeTvtbl7chIzW2mlhTSyEa1Z1XCkoC3Zx-QveBK_ygbfEZGWQKDgSt01GYbQ5Tbp2zah7E-eaZhs'
