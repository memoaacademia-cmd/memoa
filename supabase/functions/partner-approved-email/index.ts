// partner-approved-email : e-mail de bienvenue envoyé à un partenaire juste après son approbation dans ton tableau de bord.
// Appelée par public/app-admin.html (bouton « Approuver »), avec ta session d'administrateur : la fonction vérifie elle-même que l'appelant est dans app_admins.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase ; désactive « Verify JWT »).
// Secrets à ajouter (Edge Functions > Secrets) :
//   RESEND_API_KEY : la clé API Resend (la même que celle de l'envoi des e-mails de confirmation)
//   RESEND_FROM    : l'expéditeur, ex. Memoa <contact@ton-domaine.com> (une adresse de TON domaine vérifié dans Resend)
//   SITE_URL       : (déjà présent pour les notifications) adresse du site, ex. https://ton-site.github.io/memoa/ ; sert au lien partenaire dans l'e-mail
// Aucune donnée personnelle dans les journaux : seulement des codes de statut.
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'Méthode non autorisée' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // 1) L'appelant doit être connecté ET administrateur.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json(401, { error: 'Non connecté' })
  const { data: who, error: whoErr } = await admin.auth.getUser(token)
  if (whoErr || !who?.user) return json(401, { error: 'Session expirée' })
  const { data: isAdmin } = await admin.from('app_admins').select('user_id').eq('user_id', who.user.id).maybeSingle()
  if (!isAdmin) return json(403, { error: 'Réservé aux administrateurs' })

  // 2) Le partenaire doit exister et être actif.
  let partnerId = ''
  try { partnerId = String(((await req.json()) as { partner_id?: unknown })?.partner_id ?? '') } catch { /* corps vide */ }
  if (!UUID.test(partnerId)) return json(400, { error: 'Identifiant invalide' })
  const { data: p } = await admin.from('partners').select('id,status,code,full_name,user_id').eq('id', partnerId).maybeSingle()
  if (!p || p.status !== 'active' || !p.code || !p.user_id) return json(200, { sent: false, reason: 'partenaire introuvable ou pas encore actif' })

  // 3) Adresse e-mail du partenaire (compte de connexion).
  const { data: pu } = await admin.auth.admin.getUserById(p.user_id)
  const to = pu?.user?.email
  if (!to) return json(200, { sent: false, reason: 'aucune adresse e-mail pour ce compte' })

  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (!key || !from) return json(200, { sent: false, reason: 'RESEND_API_KEY ou RESEND_FROM manquant dans les secrets' })

  // 4) Le message.
  const first = String(p.full_name ?? '').trim().split(/\s+/)[0] ?? ''
  const hello = first ? `Bonjour ${first},` : 'Bonjour,'
  const site = (Deno.env.get('SITE_URL') ?? '').trim()
  const base = /^https?:\/\//i.test(site) ? site.split('#')[0].split('?')[0] : ''
  const link = base ? `${base}?ref=${encodeURIComponent(p.code)}` : ''

  const text = [
    hello,
    '',
    'Bonne nouvelle : ta demande est validée. Tu es désormais partenaire officiel de Memoa.',
    '',
    `Ton code partenaire : ${p.code}`,
    link ? `Ton lien d’invitation : ${link}` : '',
    '',
    'Pour retrouver et partager ton lien :',
    '1. Ouvre l’application Memoa.',
    '2. Va dans « Moi ».',
    '3. Touche « Programme partenaire », puis copie ton lien (ou ton code).',
    '',
    'Chaque étudiant qui s’inscrit avec ton code puis s’abonne te rapporte une commission, que tu suis dans cette même page.',
    '',
    'Merci de faire connaître Memoa !',
    'L’équipe Memoa'
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#0e1a2b;max-width:520px">
<p>${esc(hello)}</p>
<p><b>Bonne nouvelle : ta demande est validée.</b> Tu es désormais partenaire officiel de Memoa.</p>
<p style="margin:18px 0 6px">Ton code partenaire</p>
<p style="font-size:26px;font-weight:700;letter-spacing:1px;background:#EEF2F0;border-radius:12px;padding:12px 16px;display:inline-block;margin:0">${esc(p.code)}</p>
${link ? `<p style="margin:18px 0 6px">Ton lien d’invitation</p><p style="margin:0"><a href="${esc(link)}" style="color:#0b5d54">${esc(link)}</a></p>` : ''}
<p style="margin:22px 0 6px"><b>Pour retrouver et partager ton lien :</b></p>
<ol style="margin:0;padding-left:20px">
<li>Ouvre l’application Memoa.</li>
<li>Va dans « Moi ».</li>
<li>Touche « Programme partenaire », puis copie ton lien (ou ton code).</li>
</ol>
<p>Chaque étudiant qui s’inscrit avec ton code puis s’abonne te rapporte une commission, que tu suis dans cette même page.</p>
<p>Merci de faire connaître Memoa !<br>L’équipe Memoa</p>
</div>`

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: 'Tu es maintenant partenaire Memoa', html, text })
    })
    if (!r.ok) {
      console.error('partner-approved-email : Resend HTTP', r.status)
      return json(200, { sent: false, reason: `Resend a refusé l’envoi (HTTP ${r.status}) : vérifie RESEND_FROM et la clé` })
    }
    return json(200, { sent: true })
  } catch {
    console.error('partner-approved-email : Resend injoignable')
    return json(200, { sent: false, reason: 'Resend injoignable' })
  }
})
