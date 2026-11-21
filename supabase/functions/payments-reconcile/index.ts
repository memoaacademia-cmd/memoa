// VERSION EN UN SEUL FICHIER pour l'éditeur du tableau de bord Supabase (pas de dossier _shared).
// Copie tout ce fichier dans une NOUVELLE fonction « payments-reconcile » (désactive « Verify JWT » : lancée par la planification).
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

// ---------- Outils Chariow (dupliqués dans les 3 fonctions de paiement : l'éditeur du tableau de bord n'a pas de dossier partagé) ----------
const CHARIOW_API = 'https://api.chariow.com/v1'
const PRICE_USD = 4.05 // prix du produit Chariow, en USD (9 000 FC). Doit être identique au prix configuré dans Chariow.
const PRICE_CDF = 9000 // même prix si Chariow renvoie la vente dans la devise locale

/** Lit une vente chez Chariow. null = vente inconnue (404). Lève une erreur si Chariow est injoignable (→ réessai plus tard). */
async function getSale(id: string): Promise<Record<string, any> | null> {
  const key = Deno.env.get('CHARIOW_API_KEY')
  if (!key) throw new Error('CHARIOW_API_KEY manquante')
  const res = await fetch(`${CHARIOW_API}/sales/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000)
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Chariow HTTP ${res.status}`)
  const j = await res.json()
  return (j?.data ?? j) as Record<string, any>
}

/** Une vente ne compte QUE si Chariow dit « payée », pour NOTRE produit, au BON montant. Rien du webhook n'est cru sur parole. */
function judgeSale(s: Record<string, any>): { ok: true; amount: number; currency: string } | { ok: false; reason: string } {
  const status = String(s.status ?? '')
  if (!['completed', 'settled'].includes(status)) return { ok: false, reason: `statut:${status}` }
  const wantedProduct = Deno.env.get('CHARIOW_PRODUCT_ID')
  const productId = String(s.product?.id ?? '')
  if (!wantedProduct || !productId || productId !== wantedProduct) return { ok: false, reason: `produit:${productId}` }
  // amount = prix du produit (dans la devise du produit), même si le client paie dans une autre devise.
  const amount = Number(s.amount?.value ?? s.amount)
  const currency = String(s.amount?.currency ?? '')
  const okUsd = currency === 'USD' && Math.abs(amount - PRICE_USD) <= 0.011
  const okCdf = currency === 'CDF' && Math.abs(amount - PRICE_CDF) <= 1
  if (!Number.isFinite(amount) || !(okUsd || okCdf)) return { ok: false, reason: `montant:${amount} ${currency}` }
  return { ok: true, amount, currency }
}

/** Vérifie une vente chez Chariow puis la passe à la fonction SQL atomique. Renvoie le résultat (applied | duplicate | …). */
async function verifyAndApply(admin: SupabaseClient, saleId: string, hintUser?: string): Promise<{ outcome: string; expires_at?: string }> {
  const sale = await getSale(saleId)
  if (!sale) return { outcome: 'unknown_sale' }
  const verdict = judgeSale(sale)
  if (!verdict.ok) return { outcome: 'rejected:' + verdict.reason }
  const { data, error } = await admin.rpc('apply_chariow_payment', {
    p_sale_id: saleId,
    p_amount: verdict.amount,
    p_currency: verdict.currency,
    p_email: String(sale.customer?.email ?? ''),
    p_user_hint: hintUser ?? (sale.custom_metadata?.user_id ? String(sale.custom_metadata.user_id) : null),
    p_raw: sale
  })
  if (error) throw new Error('apply_chariow_payment : ' + error.message)
  const row = Array.isArray(data) ? data[0] : data
  return { outcome: String(row?.o_outcome ?? 'unknown'), expires_at: row?.o_expires_at ?? undefined }
}

// ======================= payments-reconcile =======================
// Filet de sécurité : toutes les 10 minutes (cron), relit chez Chariow chaque paiement resté « en attente » (3 derniers jours)
// et applique ceux qui sont payés. Rattrape un webhook perdu, ou un Pulse désactivé après 5 échecs. Idempotent.
// Protégée par l'en-tête x-cron-secret (secret CRON_SECRET, le même que les autres tâches planifiées).

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  const recu = (req.headers.get('x-cron-secret') ?? '').trim()
  if (!secret || !sameText(recu, secret.trim())) return new Response('Non autorisé', { status: 401 })

  const admin = adminClient()
  const { data: rows, error } = await admin.from('payments').select('provider_ref,user_id').eq('provider', 'chariow').eq('status', 'pending')
    .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).lte('created_at', new Date(Date.now() - 2 * 60_000).toISOString())
    .order('created_at', { ascending: false }).limit(60)
  if (error) { console.error('payments-reconcile lecture :', error.message); return new Response('Erreur de lecture', { status: 500 }) }

  const out: Record<string, number> = {}
  for (const r of rows ?? []) {
    try {
      const res = await verifyAndApply(admin, String(r.provider_ref), String(r.user_id))
      const k = res.outcome.split(':')[0]
      out[k] = (out[k] ?? 0) + 1
      if (res.outcome === 'applied') await admin.from('payment_events').insert({ event: 'reconcile', sale_id: r.provider_ref, outcome: 'applied' })
    } catch (e) {
      out.error = (out.error ?? 0) + 1
      console.error('payments-reconcile', r.provider_ref, (e as Error).message)
    }
  }
  return new Response(JSON.stringify({ checked: rows?.length ?? 0, ...out }), { headers: { 'Content-Type': 'application/json' } })
})

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0 // comparaison en temps constant
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
