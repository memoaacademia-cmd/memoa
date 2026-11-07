// Utilitaires partagés par les fonctions serveur (Deno / Supabase Edge Functions).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '*').split(',').map((s) => s.trim())

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allow = ORIGINS.includes('*') ? '*' : ORIGINS.includes(origin) ? origin : ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  }
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

/** Client « au nom de l'étudiant » : respecte les règles RLS. */
export function userClient(req: Request): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false }
  })
}

/** Client « serveur » : contourne la RLS. À utiliser uniquement pour les écritures contrôlées par le code. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
}

export async function requireUser(req: Request): Promise<{ id: string; email: string | undefined } | null> {
  const { data, error } = await userClient(req).auth.getUser()
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email }
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
