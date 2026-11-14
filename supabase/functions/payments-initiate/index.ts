// VERSION EN UN SEUL FICHIER pour l'éditeur du tableau de bord Supabase (pas de dossier _shared).
// Copie tout ce fichier dans la fonction de paiement (celle que l'application appelle : « swift-worker »).
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
const PRICE_USD = 4.99 // prix du produit Chariow, en USD. Doit être identique au prix configuré dans Chariow.

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
  if (!Number.isFinite(amount) || Math.abs(amount - PRICE_USD) > 0.011 || currency !== 'USD') return { ok: false, reason: `montant:${amount} ${currency}` }
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

// ======================= payments-initiate (Chariow) =======================
// Deux actions, appelées par l'étudiant CONNECTÉ (JWT obligatoire — c'est lui qui donne le user_id, jamais le navigateur) :
//   { action: 'start' } : crée la vente chez Chariow et renvoie l'adresse de la page de paiement { url }.
//   { action: 'check' } : « J'ai payé » → revérifie ses paiements en attente directement chez Chariow (sans attendre le webhook)
//                         et renvoie { active, expires_at }.
// Le MONTANT n'est jamais fourni par le navigateur : le prix est celui du produit Chariow (4,99 USD), revérifié à la confirmation.
//
// Secrets Supabase attendus (jamais dans le code) :
//   CHARIOW_API_KEY           clé secrète Chariow (sk_…)
//   CHARIOW_PRODUCT_ID        identifiant public du produit Licence (prd_…)
//   APP_URL                   adresse publique de l'app, ex. https://TON-COMPTE.github.io/memoa/
//   PAYMENT_PROVIDER_ENABLED  "true" pour ouvrir le paiement

/** « Jean Mukendi Kabila » → prénom « Jean », nom « Mukendi Kabila ». Chariow exige les deux (max 50 caractères). */
function splitName(full: string, email: string | undefined): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return { first: parts[0].slice(0, 50), last: parts.slice(1).join(' ').slice(0, 50) }
  if (parts.length === 1) return { first: parts[0].slice(0, 50), last: 'Memoa' }
  return { first: (email?.split('@')[0] ?? 'Etudiant').slice(0, 50), last: 'Memoa' }
}

/** Numéro de profil → numéro national RDC (chiffres seulement, sans +243 ni 0 initial). null si inutilisable. */
function nationalPhone(raw: string | null | undefined): string | null {
  let d = (raw ?? '').replace(/\D/g, '')
  if (d.startsWith('243')) d = d.slice(3)
  if (d.startsWith('0')) d = d.slice(1)
  return /^[0-9]{9}$/.test(d) ? d : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Méthode non autorisée.' })

  const user = await requireUser(req)
  if (!user) return json(req, 401, { error: 'Connecte-toi pour payer.' })

  if (Deno.env.get('PAYMENT_PROVIDER_ENABLED') !== 'true') {
    return json(req, 503, { error: "Le paiement n'est pas encore activé. Il arrive bientôt." })
  }

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide accepté : action « start » par défaut */ }
  const admin = adminClient()

  // ------------------------------------------------------------ « J'ai payé » : revérification directe
  if (body.action === 'check') {
    const { data: pend } = await admin.from('payments').select('provider_ref').eq('user_id', user.id).eq('provider', 'chariow').eq('status', 'pending')
      .gte('created_at', new Date(Date.now() - 3 * 86_400_000).toISOString()).order('created_at', { ascending: false }).limit(5)
    for (const p of pend ?? []) {
      try { if (p.provider_ref) await verifyAndApply(admin, p.provider_ref, user.id) } catch (e) { console.error('check', p.provider_ref, (e as Error).message) }
    }
    const { data: sub } = await admin.from('subscriptions').select('expires_at').eq('user_id', user.id).maybeSingle()
    const active = !!sub && new Date(sub.expires_at) > new Date()
    return json(req, 200, { active, expires_at: sub?.expires_at ?? null })
  }

  // ------------------------------------------------------------ « S'abonner » : création de la vente
  // Anti-abus : au plus 5 paiements « en attente » en 30 min, et 10 tentatives par 24 h.
  const { count } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending').gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString())
  if ((count ?? 0) >= 5) return json(req, 429, { error: 'Tu as déjà plusieurs paiements en attente. Termine-les ou patiente quelques minutes.' })
  const { count: dayCount } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 24 * 3600_000).toISOString())
  if ((dayCount ?? 0) >= 10) return json(req, 429, { error: 'Trop de tentatives aujourd’hui. Réessaie demain ou contacte-nous.' })

  const key = Deno.env.get('CHARIOW_API_KEY')
  const productId = Deno.env.get('CHARIOW_PRODUCT_ID')
  const appUrl = Deno.env.get('APP_URL')
  if (!key || !productId || !appUrl) { console.error('payments-initiate : secret manquant (CHARIOW_API_KEY / CHARIOW_PRODUCT_ID / APP_URL)'); return json(req, 503, { error: "Le paiement n'est pas encore configuré." }) }
  if (!user.email) return json(req, 400, { error: 'Ton compte n’a pas d’email : contacte-nous.' })

  const { data: profile } = await admin.from('profiles').select('full_name,phone').eq('id', user.id).maybeSingle()
  const phone = nationalPhone(profile?.phone)
  if (!phone) return json(req, 400, { error: 'Ajoute ton numéro de téléphone dans ton profil (Moi › Modifier) pour payer.' })
  const { first, last } = splitName(profile?.full_name ?? '', user.email)

  // Retour dans l'app après paiement (HashRouter : on met le paramètre AVANT le #).
  const redirect = appUrl.replace(/\/?$/, '/') + '?paiement=retour#/premium'

  let sale: Record<string, any>
  try {
    const res = await fetch(`${CHARIOW_API}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        email: user.email,
        first_name: first,
        last_name: last,
        phone: { number: phone, country_code: 'CD' },
        redirect_url: redirect,
        // Fenêtre intégrée : Chariow n'autorise l'iframe que depuis les origines déclarées ici (HTTPS, sans chemin ni « / » final).
        ...(body.embed === true ? { embed_origins: [new URL(appUrl).origin] } : {}),
        custom_metadata: { user_id: user.id, app: 'memoa' } // trace + contrôle de cohérence côté serveur ; jamais utilisé seul pour activer
      }),
      signal: AbortSignal.timeout(20_000)
    })
    const j = await res.json().catch(() => null)
    if (!res.ok) throw new Error(`Chariow HTTP ${res.status} ${JSON.stringify(j?.errors ?? j?.message ?? '').slice(0, 300)}`) // jamais le numéro dans les logs
    sale = j?.data ?? j
  } catch (e) {
    console.error('payments-initiate', (e as Error).message)
    return json(req, 502, { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." })
  }

  const saleId = String(sale?.purchase?.id ?? '')
  const url = String(sale?.payment?.checkout_url ?? '')
  if (sale?.step !== 'payment' || !saleId || !/^https:\/\//.test(url)) {
    console.error('payments-initiate : réponse inattendue', JSON.stringify({ step: sale?.step, hasId: !!saleId, hasUrl: !!url }))
    return json(req, 502, { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." })
  }

  // On garde le lien vente ↔ étudiant (user_id du JWT) AVANT d'envoyer l'étudiant payer.
  const { error: insertError } = await admin.from('payments').insert({ user_id: user.id, provider: 'chariow', amount: PRICE_USD, currency: 'USD', provider_ref: saleId, email: user.email })
  if (insertError) console.error('payments-initiate : insertion', insertError.message) // non bloquant : le webhook retombera sur l'email
  return json(req, 200, { url })
})
