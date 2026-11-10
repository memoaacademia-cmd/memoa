// Passe à true quand le secret SEARCH_API_KEY (Tavily) est enregistré dans Supabase : le bouton web réapparaît partout.
export const WEB_SEARCH_ENABLED = true

// Clé PUBLIQUE des notifications (VAPID) : elle peut rester dans le dépôt. La clé privée, elle, vit uniquement dans les secrets Supabase.
// Tant que cette valeur est vide, les notifications sont cachées partout dans l'application.
export const VAPID_PUBLIC_KEY =
  'BKEwywdGG-Xrulany_C1IdB4BG6TZJ7eKZGy3qH6wwZ1KCY98FpDU2B6y5LASnPFAX9ynEmWRca5S0WFNzTijzo'
