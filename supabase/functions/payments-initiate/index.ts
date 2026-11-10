// payments-initiate — démarre un paiement Mobile Money.
// Le MONTANT est fixé ici, côté serveur : le navigateur ne peut pas le choisir ni le modifier.
//
// ÉTAT : squelette sécurisé. L'agrégateur de paiement (Orange Money / Airtel Money / M-Pesa en RDC) n'est pas encore
// choisi : tant que PAYMENT_PROVIDER_ENABLED n'est pas "true", la fonction refuse proprement au lieu de simuler un paiement.
import { adminClient, corsHeaders, json, requireUser } from '../_shared/common.ts'

const PRICES = { USD: 4.99, CDF: 11000 } as const // prix décidés le 10 novembre 2026
const PROVIDERS = ['orange', 'airtel', 'mpesa']

// TODO (quand l'agrégateur est choisi) : envoyer la demande de paiement et récupérer la référence de transaction.
// La documentation de l'agrégateur fixe : URL, authentification, format du numéro, et callback vers payments-webhook.
async function requestMobileMoneyCharge(_p: { provider: string; phone: string; amount: number; currency: string; reference: string }): Promise<void> {
  throw new Error('agrégateur non configuré')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Méthode non autorisée.' })

  const user = await requireUser(req)
  if (!user) return json(req, 401, { error: 'Connecte-toi pour payer.' })

  if (Deno.env.get('PAYMENT_PROVIDER_ENABLED') !== 'true') {
    return json(req, 503, { error: "Le paiement Mobile Money n'est pas encore activé. Il arrive bientôt." })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json(req, 400, { error: 'Requête invalide.' }) }
  const provider = String(body.provider ?? '')
  const currency = body.currency === 'CDF' ? 'CDF' : body.currency === 'USD' ? 'USD' : null
  const phone = String(body.phone ?? '').replace(/\s/g, '')
  if (!PROVIDERS.includes(provider)) return json(req, 400, { error: 'Opérateur inconnu.' })
  if (!currency) return json(req, 400, { error: 'Devise inconnue.' })
  if (!/^[0-9]{9}$/.test(phone)) return json(req, 400, { error: 'Numéro Mobile Money invalide (9 chiffres).' })

  const admin = adminClient()
  // Anti-abus : au plus 3 paiements « en attente » à la fois.
  const { count } = await admin.from('payments').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'pending')
  if ((count ?? 0) >= 3) return json(req, 429, { error: 'Tu as déjà des paiements en attente. Valide-les sur ton téléphone ou patiente.' })

  const reference = 'MEMOA-' + crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()
  const amount = PRICES[currency]
  const { error: insertError } = await admin.from('payments').insert({ user_id: user.id, provider, amount, currency, provider_ref: reference })
  if (insertError) return json(req, 500, { error: 'Impossible de démarrer le paiement.' })

  try {
    await requestMobileMoneyCharge({ provider, phone: '243' + phone, amount, currency, reference })
  } catch (e) {
    console.error('payments-initiate', reference, (e as Error).message)
    await admin.from('payments').update({ status: 'failed' }).eq('provider_ref', reference)
    return json(req, 502, { error: "Le paiement n'a pas pu démarrer. Réessaie dans un instant." })
  }
  return json(req, 200, { message: 'Valide le paiement sur ton téléphone. Ton abonnement s’active dès la confirmation.' })
})
