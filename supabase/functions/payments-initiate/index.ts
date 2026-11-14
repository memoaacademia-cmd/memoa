// VERSION EN UN SEUL FICHIER pour l'éditeur du tableau de bord Supabase (pas de dossier _shared).
// Copie tout ce fichier dans la fonction « payments-initiate ».
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

// ======================= payments-initiate =======================
// payments-initiate — démarre un paiement Mobile Money via OPTGateway (API directe, method = mobile_money).
// Le MONTANT est fixé ici, côté serveur : le navigateur ne peut pas le choisir ni le modifier.
//
// Secrets Supabase attendus (jamais dans le code) :
//   OPTGATEWAY_KEY            clé API (sk_test_… en essai, sk_live_… en argent réel : on change seulement ce secret)
//   PAYMENT_PROVIDER_ENABLED  "true" pour ouvrir le paiement
// Garde-fou : tant que la clé est une clé de TEST, seuls les administrateurs peuvent lancer un paiement
// (sinon n'importe qui obtiendrait Premium gratuitement avec les numéros de test).

const PRICES = { USD: 4.99, CDF: 11000 } as const // prix affichés dans l'application
const PROVIDERS = ['orange', 'airtel', 'mpesa']
const API = 'https://pay.optgateway.com/v1/payments'

async function createCharge(p: { phone: string; amount: number; currency: string; reference: string }): Promise<void> {
  const key = Deno.env.get('OPTGATEWAY_KEY')
  if (!key) throw new Error('OPTGATEWAY_KEY manquante')
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'mobile_money',
      amount: String(p.amount),
      currency: p.currency,
      reference: p.reference,
      description: 'Memoa Premium (30 jours)',
      customer: { phone: '+' + p.phone }
    }),
    signal: AbortSignal.timeout(20_000)
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(`OPTGateway HTTP ${res.status} ${data?.error?.code ?? ''}`) // jamais le numéro dans les logs
  const status = String(data?.status ?? '')
  if (['failed', 'expired', 'cancelled'].includes(status)) throw new Error(`OPTGateway statut ${status}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Méthode non autorisée.' })

  const user = await requireUser(req)
  if (!user) return json(req, 401, { error: 'Connecte-toi pour payer.' })

  if (Deno.env.get('PAYMENT_PROVIDER_ENABLED') !== 'true') {
    return json(req, 503, { error: "Le paiement Mobile Money n'est pas encore activé. Il arrive bientôt." })
  }

  const admin = adminClient()
  if ((Deno.env.get('OPTGATEWAY_KEY') ?? '').startsWith('sk_test_')) {
    const { data: isAdmin } = await admin.from('app_admins').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!isAdmin) return json(req, 503, { error: "Le paiement Mobile Money n'est pas encore activé. Il arrive bientôt." })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(req, 400, { error: 'Requête invalide.' }) }
  const provider = String(body.provider ?? '')
  const currency = body.currency === 'CDF' ? 'CDF' : body.currency === 'USD' ? 'USD' : null
  const phone = String(body.phone ?? '').replace(/\s/g, '')
  if (!PROVIDERS.includes(provider)) return json(req, 400, { error: 'Opérateur inconnu.' })
  if (!currency) return json(req, 400, { error: 'Devise inconnue.' })
  if (!/^[0-9]{9}$/.test(phone)) return json(req, 400, { error: 'Numéro Mobile Money invalide (9 chiffres).' })

  // Anti-abus : au plus 3 paiements « en attente » à la fois.
  const { count } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending')
  if ((count ?? 0) >= 3) return json(req, 429, { error: 'Tu as déjà des paiements en attente. Valide-les sur ton téléphone ou patiente.' })

  const reference = 'MEMOA-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  const amount = PRICES[currency]
  const { error: insertError } = await admin.from('payments').insert({ user_id: user.id, provider, amount, currency, provider_ref: reference })
  if (insertError) return json(req, 500, { error: 'Impossible de démarrer le paiement.' })

  try {
    await createCharge({ phone: '243' + phone, amount, currency, reference })
  } catch (e) {
    console.error('payments-initiate', reference, (e as Error).message)
    await admin.from('payments').update({ status: 'failed' }).eq('provider_ref', reference)
    return json(req, 502, { error: "Le paiement n'a pas pu démarrer. Vérifie ton numéro et réessaie dans un instant." })
  }
  return json(req, 200, { message: 'Valide le paiement sur ton téléphone. Ton abonnement s’active dès la confirmation.' })
})
