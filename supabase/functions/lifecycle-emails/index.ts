// lifecycle-emails : e-mails automatiques d'inscription.
//  1) « incomplete » : UN seul rappel, 1 h après la création du compte, si l'inscription n'est pas finie (e-mail pas confirmé, ou « Présente-toi » pas rempli). Envoyé de 7 h à 21 h (heure de Kinshasa).
//  2) « welcome »    : UN seul e-mail de bienvenue quand l'inscription est terminée.
// Appelée toutes les 10 minutes par la planification (cron) de Supabase, jamais par le navigateur : elle exige l'en-tête x-cron-secret.
// Fichier autonome (à coller tel quel dans l'éditeur du tableau de bord Supabase ; désactive « Verify JWT »).
// Prérequis : migration 0037_emails_automatiques.sql exécutée.
// Secrets : CRON_SECRET (déjà présent), RESEND_API_KEY, RESEND_FROM (ex. Memoa <contact@ton-domaine.com>), SITE_URL (adresse du site, avec https://).
// Aucune donnée personnelle dans les journaux : seulement des nombres et des codes de statut.
import { createClient } from 'npm:@supabase/supabase-js@2'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const MAX_PER_KIND = 30

type Kind = 'incomplete' | 'welcome'
interface Cand { user_id: string; email: string; first_name: string | null; confirmed: boolean }

/** Cadre commun : texte, bouton, pied de page. */
function layout(hello: string, paras: string[], steps: string[], cta: { label: string; url: string }, foot: string) {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0e1a2b;max-width:520px">
<p>${esc(hello)}</p>
${paras.map((p) => `<p>${esc(p)}</p>`).join('\n')}
${steps.length ? `<ol style="margin:0 0 16px;padding-left:20px">${steps.map((s) => `<li style="margin:4px 0">${esc(s)}</li>`).join('')}</ol>` : ''}
<p style="margin:22px 0"><a href="${esc(cta.url)}" style="background:#0b5d54;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p>
<p style="color:#5b6b66;font-size:14px">${esc(foot)}</p>
<p>L’équipe Memoa</p>
</div>`
  const text = [hello, '', ...paras.flatMap((p) => [p, '']), ...steps.map((s, i) => `${i + 1}. ${s}`), steps.length ? '' : '', `${cta.label} : ${cta.url}`, '', foot, 'L’équipe Memoa'].join('\n')
  return { html, text }
}

function build(kind: Kind, c: Cand, base: string) {
  const hello = c.first_name ? `Bonjour ${c.first_name},` : 'Bonjour,'
  if (kind === 'welcome') {
    const m = layout(hello,
      ['Bienvenue sur Memoa ! Ton compte est prêt. Memoa est ton compagnon d’étude : tu écris tes cours, Memo les met en forme, les résume, te pose des quiz et te les lit à voix haute.', 'Pour bien commencer :'],
      ['Ouvre l’onglet « Cours » et crée ton premier cours.', 'Demande à Memo un résumé ou un quiz sur ce cours.', 'Installe Memoa sur ton écran d’accueil pour l’ouvrir comme une vraie application.'],
      { label: 'Ouvrir Memoa', url: base },
      'Tu reçois ce message parce que tu viens de créer un compte Memoa.')
    return { subject: 'Bienvenue sur Memoa', ...m }
  }
  if (!c.confirmed) {
    const m = layout(hello,
      ['Tu as commencé à créer ton compte Memoa, mais ton adresse email n’est pas encore confirmée. Il te reste une minute pour continuer là où tu t’es arrêté :'],
      ['Ouvre Memoa avec le bouton ci-dessous.', 'Touche « Créer un compte » et recommence avec la même adresse email : un nouveau code à 6 chiffres t’est envoyé.', 'Tape le code (regarde aussi dans les courriers indésirables), puis remplis « Présente-toi ».'],
      { label: 'Continuer mon inscription', url: base },
      'Tu reçois ce message une seule fois, parce que quelqu’un a commencé à créer un compte Memoa avec cette adresse. Si ce n’est pas toi, ignore-le.')
    return { subject: 'Ton compte Memoa t’attend', ...m }
  }
  const m = layout(hello,
    ['Ton compte Memoa est créé, il manque seulement ta présentation : ton nom, ton université et ta faculté. Ça prend une minute, et Memoa adapte ensuite tes cours à ton parcours.'],
    ['Ouvre Memoa avec le bouton ci-dessous et connecte-toi.', 'Remplis « Présente-toi » : tu arrives directement sur ton accueil.'],
    { label: 'Continuer mon inscription', url: base },
    'Tu reçois ce message une seule fois, parce que ton inscription n’est pas terminée.')
  return { subject: 'Il te reste une étape pour commencer sur Memoa', ...m }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 })
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || (req.headers.get('x-cron-secret') ?? '').trim() !== secret.trim()) return new Response('Non autorisé', { status: 401 })

  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  const site = (Deno.env.get('SITE_URL') ?? '').trim()
  if (!key || !from || !/^https?:\/\//i.test(site)) return json({ error: 'RESEND_API_KEY, RESEND_FROM ou SITE_URL manquant (SITE_URL doit commencer par https://)' }, 503)
  const base = site.split('#')[0]

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const stats = { welcome: 0, incomplete: 0, skipped: 0, failed: 0 }
  // Heure de Kinshasa (UTC+1) : le rappel ne part que de 7 h à 21 h (sinon il attend le matin).
  const hourKin = (new Date().getUTCHours() + 1) % 24
  const kinds: Kind[] = hourKin >= 7 && hourKin < 21 ? ['welcome', 'incomplete'] : ['welcome']

  try {
    for (const kind of kinds) {
      const { data: list, error } = await admin.rpc('lifecycle_candidates', { p_kind: kind, p_limit: MAX_PER_KIND })
      if (error) { console.error('lifecycle-emails : lecture impossible', error.code); return json({ error: 'lecture impossible (migration 0037 exécutée ?)' }, 500) }
      for (const c of (list ?? []) as Cand[]) {
        // On « réserve » d'abord : si deux exécutions se chevauchent, une seule envoie.
        const { data: claimed, error: ce } = await admin.from('lifecycle_emails').upsert({ user_id: c.user_id, kind }, { onConflict: 'user_id,kind', ignoreDuplicates: true }).select('user_id')
        if (ce || !claimed?.length) { stats.skipped++; continue }
        const mail = build(kind, c, base)
        let ok = false
        try {
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from, to: [c.email], subject: mail.subject, html: mail.html, text: mail.text })
          })
          ok = r.ok
          if (!ok) console.error('lifecycle-emails : Resend HTTP', r.status)
        } catch { console.error('lifecycle-emails : Resend injoignable') }
        if (ok) { stats[kind]++; continue }
        // Échec : on libère la réservation (nouvel essai à la prochaine exécution) et on s'arrête là, pour ne pas marteler Resend si la configuration est mauvaise.
        await admin.from('lifecycle_emails').delete().eq('user_id', c.user_id).eq('kind', kind)
        stats.failed++
        return json({ ...stats, stopped: true }, 200)
      }
    }
  } catch {
    console.error('lifecycle-emails : erreur inattendue')
    return json({ ...stats, error: true }, 500)
  }
  return json(stats)
})
