// Passe à true quand le secret SEARCH_API_KEY (Tavily) est enregistré dans Supabase : le bouton web réapparaît partout.
export const WEB_SEARCH_ENABLED = true

// Clé PUBLIQUE des notifications (VAPID) : elle peut rester dans le dépôt. La clé privée, elle, vit uniquement dans les secrets Supabase.
// Tant que cette valeur est vide, les notifications sont cachées partout dans l'application.
export const VAPID_PUBLIC_KEY =
  'BKl2WtUyFam9--2v2Iz4SzI5XfMs9jizNUlaHoIMtDlP9IGLbpissir7_cRn-_rBy5swg7tZP3nE0CYxE9ZrjQ0'
