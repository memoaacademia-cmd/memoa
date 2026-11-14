// VERSION EN UN SEUL FICHIER pour l'éditeur du tableau de bord Supabase (pas de dossier _shared).
// Copie tout ce fichier dans la fonction « payments-webhook ».
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

// ======================= payments-webhook =======================
// payments-webhook — appelé PAR OPTGateway pour confirmer un paiement.
// Sécurité : en-tête OPTGateway-Signature = « t=HORODATAGE,v1=SIGNATURE ». La signature est un HMAC-SHA256 (hex)
// du texte « HORODATAGE.CORPS » (corps brut, tel que reçu), avec le secret de webhook (whsec_…). Message de plus de 5 min refusé.
//
// Secret Supabase attendu : OPTGATEWAY_WEBHOOK_SECRET (généré dans l'espace marchand OPTGateway, page Webhooks).
// Cette fonction est publique (verify_jwt = false dans config.toml) : seule la signature la protège.

const DAYS_PER_PAYMENT = 30
const TOLERANCE_SECONDS = 300
const OK_EVENTS = ['payment.succeeded', 'checkout.session.completed']
const FAIL_EVENTS = ['payment.failed', 'payment.expired', 'payment.cancelled']

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0 // comparaison en temps constant
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function validSignature(raw: string, header: string, secret: string): Promise<boolean> {
  let t = ''
  const sigs: string[] = []
  for (const part of header.split(',')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 't') t = v
    if (k === 'v1') sigs.push(v)
  }
  if (!t || !sigs.length || !/^[0-9]+$/.test(t)) return false
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`))))
  return sigs.some((s) => sameText(expected, s))
}

function parse(raw: string): { type: string; reference: string; amount: number | null; currency: string | null } | null {
  try {
    const j = JSON.parse(raw)
    const d = j?.data ?? {}
    if (typeof j?.type !== 'string' || typeof d.reference !== 'string') return null
    const amount = d.amount !== undefined && d.amount !== null && !Number.isNaN(Number(d.amount)) ? Number(d.amount) : null
    return { type: j.type, reference: d.reference, amount, currency: typeof d.currency === 'string' ? d.currency : null }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const secret = Deno.env.get('OPTGATEWAY_WEBHOOK_SECRET')
  if (!secret) return new Response('Not configured', { status: 503 })

  const raw = await req.text()
  if (!(await validSignature(raw, req.headers.get('optgateway-signature') ?? '', secret))) {
    console.error('payments-webhook : signature invalide (secret différent, ou en-tête absent)')
    return new Response('Invalid signature', { status: 400 })
  }

  const event = parse(raw)
  if (!event) {
    // Signature valide mais pas un événement de paiement (par exemple le test du tableau de bord) : on répond OK sans rien faire.
    console.log('payments-webhook : message signé sans paiement, ignoré')
    return new Response('ignored', { status: 200 })
  }
  const success = OK_EVENTS.includes(event.type)
  if (!success && !FAIL_EVENTS.includes(event.type)) return new Response('ignored', { status: 200 }) // autres événements : rien à faire

  const admin = adminClient()
  const { data: payment } = await admin.from('payments').select('id,user_id,status,amount,currency').eq('provider_ref', event.reference).maybeSingle()
  if (!payment) return new Response('Unknown reference', { status: 200 }) // pas à nous : inutile de faire réessayer
  if (payment.status !== 'pending') return new Response('Already processed', { status: 200 }) // idempotent : un rejeu ne prolonge pas deux fois

  if (!success) {
    await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending')
    return new Response('ok', { status: 200 })
  }

  // On contrôle le montant et la devise annoncés avant d'activer Premium.
  if ((event.amount !== null && Math.abs(event.amount - Number(payment.amount)) > 0.001) || (event.currency !== null && event.currency !== payment.currency)) {
    console.error('payments-webhook : montant ou devise différent', event.reference)
    return new Response('Mismatch', { status: 200 })
  }

  // Marque payé seulement si encore « pending » (protège contre deux appels simultanés).
  const { data: updated } = await admin.from('payments').update({ status: 'paid' }).eq('id', payment.id).eq('status', 'pending').select('id')
  if (!updated?.length) return new Response('Already processed', { status: 200 })

  const { data: sub } = await admin.from('subscriptions').select('expires_at').eq('user_id', payment.user_id).maybeSingle()
  const base = sub && new Date(sub.expires_at) > new Date() ? new Date(sub.expires_at) : new Date()
  const expires = new Date(base.getTime() + DAYS_PER_PAYMENT * 864e5)
  await admin.from('subscriptions').upsert({ user_id: payment.user_id, expires_at: expires.toISOString() })
  return new Response('ok', { status: 200 })
})
