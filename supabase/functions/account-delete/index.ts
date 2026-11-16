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

/** Empreinte NON réversible d'un numéro (HMAC-SHA256 avec le secret serveur PHONE_HASH_SECRET), en hexadécimal.
 *  Sert à retenir « essai déjà utilisé » après la suppression d'un compte, sans garder le numéro.
 *  Renvoie null si le secret n'est pas configuré (on ne fabrique jamais une empreinte faible : un numéro a trop peu de combinaisons). */
export async function phoneHash(phoneDigits: string): Promise<string | null> {
  const secret = Deno.env.get('PHONE_HASH_SECRET')
  if (!secret || secret.length < 16 || !phoneDigits) return null
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(phoneDigits))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ======================= account-delete =======================
// Supprime le compte de l'étudiant CONNECTÉ (jamais celui d'un autre : l'identité vient du jeton, pas du corps de la requête).
// Sert aussi à supprimer proprement les comptes de test : on se connecte avec le compte de test, on lance « Supprimer mon compte ».
//
// Ce qui est fait, dans l'ordre :
//  1. garde l'empreinte NON réversible du numéro (HMAC) marquée « essai déjà utilisé », pour qu'un nouveau compte ne retrouve pas 5 jours ;
//  2. efface les fichiers (avatar, PDF non publiés ou à la corbeille, PDF orphelins) ;
//  3. documents publiés de la Librairie : conservés mais rendus ANONYMES (owner_id = NULL) ;
//  4. paiements : lignes gardées pour la comptabilité (montant, date, statut, référence), détachées de la personne (user_id, e-mail et détail brut vidés) ;
//  5. supprime le compte : les cascades effacent profil, cours, notes, conversations, usage IA, abonnement, notifications, brouillons (rappels), flammes, événements, erreurs…
//  6. efface le numéro en clair de trial_phones (il ne reste que l'empreinte) et vérifie qu'aucune ligne ne traîne.
// Variables d'environnement : PHONE_HASH_SECRET (obligatoire, 16 caractères minimum, jamais changé ensuite), plus celles déjà présentes (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).

const natPhone = (raw: unknown): string => { let d = String(raw ?? '').replace(/\D/g, ''); if (d.length > 9 && d.startsWith('243')) d = d.slice(3); if (d.startsWith('0')) d = d.slice(1); return d }
const WORD = 'SUPPRIMER'
type Admin = ReturnType<typeof adminClient>

/** Supprime tous les fichiers d'un dossier « <uid>/ » d'un bucket, sauf ceux de `keep`. Renvoie le nombre de fichiers retirés. */
async function purgeFolder(admin: Admin, bucket: string, uid: string, keep: Set<string> = new Set()): Promise<number> {
  let removed = 0
  for (let guard = 0; guard < 50; guard++) {
    const { data, error } = await admin.storage.from(bucket).list(uid, { limit: 100 })
    if (error) throw new Error(`Liste des fichiers (${bucket}) impossible : ${error.message}`)
    const paths = (data ?? []).filter((f) => f.name && f.id !== null).map((f) => `${uid}/${f.name}`).filter((p) => !keep.has(p))
    if (!paths.length) break
    const { error: rmErr } = await admin.storage.from(bucket).remove(paths)
    if (rmErr) throw new Error(`Suppression des fichiers (${bucket}) impossible : ${rmErr.message}`)
    removed += paths.length
    if ((data ?? []).length < 100) break
  }
  return removed
}

const LEFTOVER_TABLES: [string, string][] = [
  ['profiles', 'id'], ['courses', 'user_id'], ['notes', 'user_id'], ['activity_days', 'user_id'], ['ai_conversations', 'user_id'], ['ai_messages', 'user_id'],
  ['ai_usage', 'user_id'], ['ai_log', 'user_id'], ['review_cards', 'user_id'], ['exams', 'user_id'], ['exam_prefs', 'user_id'], ['subscriptions', 'user_id'], ['feedback', 'user_id'], ['push_subscriptions', 'user_id'], ['drafts_expiry', 'user_id'],
  ['expiry_notices', 'user_id'], ['lingala_uses', 'user_id'], ['tp_sessions', 'user_id'], ['library_favorites', 'user_id'], ['library_reports', 'user_id'],
  ['app_events', 'user_id'], ['app_errors', 'user_id'], ['payments', 'user_id'], ['library_documents', 'owner_id']
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Méthode non autorisée.' })
  const user = await requireUser(req)
  if (!user) return json(req, 401, { error: 'Connexion requise.' })
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide */ }
  if (String(body.confirm ?? '').trim() !== WORD) return json(req, 400, { error: `Pour confirmer, écris le mot ${WORD}.` })

  const admin = adminClient()
  const uid = user.id
  const report: Record<string, unknown> = {}
  try {
    // Un compte d'équipe ne se supprime pas d'un geste (évite de perdre l'accès d'administration par erreur).
    const { data: adm } = await admin.from('app_admins').select('user_id').eq('user_id', uid).maybeSingle()
    if (adm) return json(req, 403, { error: "Ce compte est un compte d'équipe : il ne peut pas être supprimé depuis l'application." })

    const { data: prof } = await admin.from('profiles').select('phone,created_at').eq('id', uid).maybeSingle()
    const rawDigits = String(prof?.phone ?? '').replace(/\D/g, '')
    const phone = natPhone(prof?.phone)
    const hasPhone = phone.length >= 9

    // 1) Empreinte du numéro : « essai déjà utilisé ». Sans secret, on refuse plutôt que d'oublier ou de garder le numéro.
    let hash: string | null = null
    if (hasPhone) {
      hash = await phoneHash(phone)
      if (!hash) {
        console.error('account-delete : PHONE_HASH_SECRET absent ou trop court')
        return json(req, 503, { error: "La suppression n'est pas encore disponible. Réessaie un peu plus tard." })
      }
      const own = prof?.created_at ? new Date(prof.created_at).getTime() : Date.now()
      const { data: tp } = await admin.from('trial_phones').select('started_at').eq('phone', phone).maybeSingle()
      const { data: old } = await admin.from('trial_phone_hashes').select('started_at').eq('phone_hash', hash).maybeSingle()
      const times = [own, tp?.started_at ? new Date(tp.started_at).getTime() : own, old?.started_at ? new Date(old.started_at).getTime() : own]
      const { error } = await admin.from('trial_phone_hashes').upsert({ phone_hash: hash, started_at: new Date(Math.min(...times)).toISOString() }, { onConflict: 'phone_hash' })
      if (error) throw new Error(`Empreinte du numéro : ${error.message}`)
      report.trialMarked = true
    }

    // 2) Avatar.
    report.avatarsRemoved = await purgeFolder(admin, 'avatars', uid)
    // Images créées par Memo (Premium) : dossier <uid>/ du bucket « ai-images » (migration 0021). Bucket absent = rien à effacer.
    try { report.aiImagesRemoved = await purgeFolder(admin, 'ai-images', uid) } catch (e) { if (!/bucket not found/i.test((e as Error).message)) throw e; report.aiImagesRemoved = 0 }

    // 3) Librairie : les documents publiés restent (anonymes) ; le reste est effacé avec son fichier.
    const { data: docs, error: docErr } = await admin.from('library_documents').select('id,file_path,status,deleted_at').eq('owner_id', uid)
    if (docErr) throw new Error(`Librairie : ${docErr.message}`)
    const kept = (docs ?? []).filter((d) => d.status === 'published' && !d.deleted_at)
    const dropped = (docs ?? []).filter((d) => !(d.status === 'published' && !d.deleted_at))
    if (kept.length) {
      const { error } = await admin.from('library_documents').update({ owner_id: null }).in('id', kept.map((d) => d.id))
      if (error) throw new Error(`Anonymisation de la Librairie : ${error.message}`)
    }
    if (dropped.length) {
      const files = dropped.map((d) => d.file_path).filter((p): p is string => !!p)
      if (files.length) await admin.storage.from('library').remove(files)
      const { error } = await admin.from('library_documents').delete().in('id', dropped.map((d) => d.id))
      if (error) throw new Error(`Suppression des documents : ${error.message}`)
    }
    const keepFiles = new Set(kept.map((d) => d.file_path).filter((p): p is string => !!p))
    report.libraryKeptAnonymous = kept.length
    report.libraryDeleted = dropped.length
    report.libraryFilesRemoved = await purgeFolder(admin, 'library', uid, keepFiles)
    await admin.rpc('release_storage_owner', { p_user: uid }) // sans effet bloquant si la base n'a pas cette colonne

    // 4) Paiements : on garde le nécessaire à la comptabilité, sans donnée personnelle.
    const { data: pays, error: payErr } = await admin.from('payments').select('id,provider_ref').eq('user_id', uid)
    if (payErr) throw new Error(`Paiements : ${payErr.message}`)
    if (pays?.length) {
      const { error } = await admin.from('payments').update({ user_id: null, email: null, raw: null }).eq('user_id', uid)
      if (error) throw new Error(`Anonymisation des paiements : ${error.message}`)
      const refs = pays.map((p) => p.provider_ref).filter((r): r is string => !!r)
      if (refs.length) await admin.from('payment_events').update({ raw: null }).in('sale_id', refs)
    }
    report.paymentsAnonymized = pays?.length ?? 0

    // 5) Le compte lui-même (les cascades font le reste).
    const del = await admin.auth.admin.deleteUser(uid)
    if (del.error) throw new Error(`Suppression du compte : ${del.error.message}`)

    // 6) Numéro en clair effacé (il ne reste que l'empreinte), puis contrôle : plus aucune ligne au nom de ce compte.
    if (hasPhone) await admin.from('trial_phones').delete().in('phone', [...new Set([phone, rawDigits])])
    const leftovers: Record<string, number> = {}
    for (const [table, col] of LEFTOVER_TABLES) {
      const { count } = await admin.from(table).select('*', { count: 'exact', head: true }).eq(col, uid)
      if (count) leftovers[table] = count
    }
    report.leftovers = leftovers
    console.log('account-delete OK', JSON.stringify({ ...report, uid: undefined }))
    return json(req, 200, { ok: true, report })
  } catch (e) {
    console.error('account-delete :', (e as Error).message, JSON.stringify(report))
    return json(req, 500, { error: "La suppression n'a pas pu aller jusqu'au bout. Rien n'est perdu : réessaie, et si ça recommence, contacte-nous depuis « Signaler un problème ».", detail: (e as Error).message })
  }
})
