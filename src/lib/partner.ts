// Programme partenaire : appels au serveur. Aucune écriture directe dans les tables : tout passe par des fonctions SECURITY DEFINER
// qui prennent l'identité du jeton de connexion (auth.uid()), jamais celle envoyée par le navigateur.
import { PARTNER_PROGRAM_ENABLED } from './features'
import { supabase } from './supabase'
import type { RefSource } from './referral'

// L'interrupteur vit dans features.ts (comme les autres). On le re-exporte ici pour les écrans du programme.
export { PARTNER_PROGRAM_ENABLED }

export type PartnerType = 'cp' | 'influenceur'
export type Operator = 'mpesa' | 'airtel' | 'orange'

export const OPERATORS: { id: Operator; name: string }[] = [
  { id: 'mpesa', name: 'M-Pesa' },
  { id: 'airtel', name: 'Airtel Money' },
  { id: 'orange', name: 'Orange Money' }
]

export interface PayoutRow {
  id: string
  amount_usd: number
  operator: Operator
  status: 'requested' | 'paid' | 'rejected'
  reference: string | null
  reject_reason: string | null
  requested_at: string
  processed_at: string | null
}

export type PartnerDashboard =
  | { status: 'none'; min_payout_usd?: number }
  | { status: 'pending' | 'rejected' | 'suspended'; type: PartnerType; full_name: string | null; min_payout_usd?: number }
  | {
      status: 'active'
      type: PartnerType
      full_name: string | null
      code: string
      signups: number
      payers: number
      pending_usd: number
      available_usd: number
      requested_usd: number
      paid_usd: number
      total_usd: number
      withdrawable_usd: number
      next_available_at: string | null
      hold_days: number
      min_payout_usd: number
      payout_phone: string | null
      payout_operator: Operator | null
      payout_account_name?: string | null
      has_open_payout: boolean
      payouts: PayoutRow[]
    }

const sb = () => {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

/** Les nombres numériques de Postgres peuvent arriver en texte : on les ramène en nombres. */
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

export async function getPartnerDashboard(): Promise<PartnerDashboard> {
  const { data, error } = await sb().rpc('get_partner_dashboard')
  if (error) throw error
  const d = (data ?? { status: 'none' }) as Record<string, unknown>
  if (d.status === 'active') {
    return {
      ...(d as object),
      signups: num(d.signups), payers: num(d.payers),
      pending_usd: num(d.pending_usd), available_usd: num(d.available_usd), requested_usd: num(d.requested_usd), paid_usd: num(d.paid_usd),
      total_usd: num(d.total_usd), withdrawable_usd: num(d.withdrawable_usd), hold_days: num(d.hold_days) || 7, min_payout_usd: num(d.min_payout_usd) || 10,
      payouts: ((d.payouts as PayoutRow[] | undefined) ?? []).map((p) => ({ ...p, amount_usd: num(p.amount_usd) }))
    } as PartnerDashboard
  }
  return d as unknown as PartnerDashboard
}

export async function requestPartner(type: PartnerType, fullName: string): Promise<string> {
  const { data, error } = await sb().rpc('request_partner', { p_type: type, p_full_name: fullName })
  if (error) throw error
  return String((data as { result?: string } | null)?.result ?? '')
}

export async function requestPayout(phone: string, operator: Operator, accountName: string): Promise<{ result: string; amount_usd?: number; min_payout_usd?: number }> {
  const { data, error } = await sb().rpc('request_payout', { p_phone: phone, p_operator: operator, p_account_name: accountName })
  if (error) throw error
  const d = (data ?? {}) as { result?: string; amount_usd?: unknown; min_payout_usd?: unknown }
  return { result: String(d.result ?? ''), amount_usd: d.amount_usd == null ? undefined : num(d.amount_usd), min_payout_usd: d.min_payout_usd == null ? undefined : num(d.min_payout_usd) }
}

export type AttachResult = 'ok' | 'code_invalide' | 'deja_parraine' | 'trop_tard' | 'auto_parrainage' | 'trop_de_tentatives' | 'non_connecte' | 'erreur_reseau'

/** Rattache l'étudiant connecté à un parrain. Ne lève jamais d'erreur : « erreur_reseau » veut dire « garde le code et réessaie plus tard ». */
export async function attachReferral(code: string, source: RefSource): Promise<AttachResult> {
  try {
    const { data, error } = await sb().rpc('attach_referral', { p_code: code, p_source: source })
    if (error) return 'erreur_reseau'
    return String((data as { result?: string } | null)?.result ?? 'code_invalide') as AttachResult
  } catch {
    return 'erreur_reseau'
  }
}

/** Le champ « Code partenaire » des Réglages doit-il s'afficher ? (pas de parrain, pas de paiement, moins de 7 jours) */
export async function getReferralStatus(): Promise<{ sponsored: boolean; eligible: boolean }> {
  const { data, error } = await sb().rpc('referral_status')
  if (error) throw error
  const d = (data ?? {}) as { sponsored?: boolean; eligible?: boolean }
  return { sponsored: !!d.sponsored, eligible: !!d.eligible }
}

/** Message court en français pour un résultat de attach_referral. */
export function attachMessage(r: AttachResult): string {
  switch (r) {
    case 'ok': return 'Code partenaire enregistré. Merci !'
    case 'deja_parraine': return 'Tu as déjà un parrain : il ne peut plus être changé.'
    case 'trop_tard': return 'Ce code ne peut plus être ajouté : il faut le saisir dans les 7 premiers jours, avant un premier paiement.'
    case 'auto_parrainage': return 'Tu ne peux pas utiliser ton propre code.'
    case 'trop_de_tentatives': return 'Trop d’essais. Réessaie dans une heure.'
    case 'erreur_reseau': return 'Connexion instable : réessaie dans un instant.'
    default: return 'Code non reconnu. Vérifie les lettres et les chiffres.'
  }
}

/** Montant en dollars à la française : « 1,00 $ ». */
export const usd = (n: number) => n.toFixed(2).replace('.', ',') + ' $'

/** Nombre de jours (arrondi au-dessus) avant une date ; au moins 1. */
export const daysUntil = (iso: string | null) => (iso ? Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000)) : 0)
