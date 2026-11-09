// payments-webhook — appelé PAR l'opérateur / l'agrégateur pour confirmer un paiement.
// Sécurité : on ne fait confiance à l'appel que si la signature HMAC est valide.
//
// ÉTAT : squelette. Le nom de l'en-tête de signature, l'algorithme et le format du corps dépendent de l'agrégateur
// qui sera choisi ; adapte `parse()` à sa documentation. Ne jamais activer sans tester avec un paiement réel de petit montant.
import { adminClient } from '../_shared/common.ts'

const DAYS_PER_PAYMENT = 30

async function validSignature(raw: string, signatureHex: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)))
  const expected = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  if (expected.length !== signatureHex.length) return false
  let diff = 0 // comparaison en temps constant
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHex.charCodeAt(i)
  return diff === 0
}

// À adapter à l'agrégateur : extraire la référence Memoa et le résultat.
function parse(raw: string): { reference: string; paid: boolean } | null {
  try {
    const j = JSON.parse(raw)
    if (typeof j.reference !== 'string') return null
    return { reference: j.reference, paid: j.status === 'success' }
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 })
  const secret = Deno.env.get('PAYMENT_WEBHOOK_SECRET')
  if (!secret) return new Response('Not configured', { status: 503 })

  const raw = await req.text()
  const signature = req.headers.get('x-signature') ?? ''
  if (!(await validSignature(raw, signature, secret))) return new Response('Invalid signature', { status: 401 })

  const event = parse(raw)
  if (!event) return new Response('Bad payload', { status: 400 })

  const admin = adminClient()
  const { data: payment } = await admin.from('payments').select('id,user_id,status').eq('provider_ref', event.reference).maybeSingle()
  if (!payment) return new Response('Unknown reference', { status: 404 })
  if (payment.status !== 'pending') return new Response('Already processed', { status: 200 }) // idempotent : un rejeu ne prolonge pas deux fois

  if (!event.paid) {
    await admin.from('payments').update({ status: 'failed' }).eq('id', payment.id).eq('status', 'pending')
    return new Response('ok', { status: 200 })
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
