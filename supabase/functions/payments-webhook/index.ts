// VERSION EN UN SEUL FICHIER pour l'éditeur du tableau de bord Supabase (pas de dossier _shared).
// Copie tout ce fichier dans la fonction « payments-webhook » (désactive « Verify JWT » : c'est Chariow qui l'appelle).
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
const PRICE_USD = 4.5 // prix du produit Chariow, en USD (11 000 FC). Doit être identique au prix configuré dans Chariow.
const PRICE_CDF = 11000 // même prix si Chariow renvoie la vente dans la devise locale

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

// ======================= payments-webhook (Chariow Pulse) =======================
// Appelée PAR Chariow à chaque événement du « Pulse ». Fonction publique : seule la signature la protège.
// Sécurité, dans l'ordre :
//   1. signature HMAC-SHA256 du corps brut (en-tête x-chariow-signature = « sha256=<hex> »), comparaison en temps constant → sinon 401 ;
//   2. seul « successful.sale » est traité ; les événements de test (identifiants « test_… ») sont ignorés ;
//   3. on NE CROIT PAS le contenu reçu : on relit la vente chez Chariow avec la clé secrète (statut payé, bon produit, bon montant) ;
//   4. activation par la fonction SQL atomique (idempotente : rejeu = « duplicate », jamais deux prolongations).
// Réponses : 2xx = reçu (aussi pour doublons, tests, refus définitifs) ; 5xx UNIQUEMENT pour une panne temporaire → Chariow réessaie
// (5 essais : +10 s, +100 s, +17 min, +2 h 47, puis le Pulse est DÉSACTIVÉ — d'où le cron de rattrapage payments-reconcile).
//
// Secrets : CHARIOW_WEBHOOK_SECRET (whsec_…, onglet Overview du Pulse), CHARIOW_API_KEY, CHARIOW_PRODUCT_ID.

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0 // comparaison en temps constant
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function validSignature(raw: string, header: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const expected = 'sha256=' + hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  return sameText(expected, header.trim())
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const secret = Deno.env.get('CHARIOW_WEBHOOK_SECRET')
  if (!secret) return new Response('Not configured', { status: 503 })

  const raw = await req.text() // corps BRUT : la signature porte sur ces octets exacts
  if (!(await validSignature(raw, req.headers.get('x-chariow-signature') ?? '', secret))) {
    console.error('payments-webhook : signature invalide (mauvais secret whsec_ ou en-tête absent)')
    return new Response('Invalid signature', { status: 401 })
  }

  let payload: Record<string, any> = {}
  try { payload = JSON.parse(raw) } catch { return new Response('Bad JSON', { status: 200 }) } // signé mais illisible : inutile de réessayer
  const event = String(payload.event ?? req.headers.get('x-pulse-event') ?? '')
  const deliveryId = req.headers.get('x-pulse-delivery-id') ?? null
  const saleId = String(payload.sale?.id ?? '')

  const admin = adminClient()
  const log = async (outcome: string) => {
    const { error } = await admin.from('payment_events').insert({ delivery_id: deliveryId, event, sale_id: saleId || null, outcome, raw: payload })
    if (error) console.error('payments-webhook : journal', error.message)
  }

  if (event !== 'successful.sale') { await log('ignored'); return new Response('ignored', { status: 200 }) }
  if (!saleId || saleId.startsWith('test_')) { await log('test'); return new Response('test ignored', { status: 200 }) }

  try {
    const r = await verifyAndApply(admin, saleId)
    await log(r.outcome)
    if (r.outcome === 'applied' || r.outcome === 'duplicate') return new Response('ok', { status: 200 })
    // unmatched / rejected / unknown_sale / user_mismatch : refus définitif → 200 (inutile de réessayer), trace dans payment_events + logs.
    console.error('payments-webhook : vente non appliquée', saleId, r.outcome)
    return new Response(r.outcome, { status: 200 })
  } catch (e) {
    // Panne temporaire (Chariow injoignable, base indisponible) : 503 → Chariow réessaiera.
    console.error('payments-webhook : erreur temporaire', saleId, (e as Error).message)
    await log('error:' + (e as Error).message.slice(0, 120))
    return new Response('Temporary error', { status: 503 })
  }
})
