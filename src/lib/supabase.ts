import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Sans clés Supabase, l'app tourne en « mode démo » (données dans le navigateur). */
export const isConfigured = Boolean(url && key)

// PKCE : le retour de Google / du lien email arrive par ?code=… (et non par #access_token),
// ce qui est compatible avec le routeur à base de « # » utilisé pour l'hébergement GitHub Pages.
export const supabase = isConfigured
  ? createClient(url as string, key as string, { auth: { flowType: 'pkce', detectSessionInUrl: true } })
  : null
