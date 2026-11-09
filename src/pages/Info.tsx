import { useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BackLink, ErrorBox, Icon, Logo, useAction } from '../components/ui'
import { sendFeedback, type FeedbackKind } from '../lib/api'
import { useAuth } from '../lib/auth'

const UPDATED = '9 novembre 2026'

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card">
      <strong className="h2">{title}</strong>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.5, fontSize: 15 }}>{children}</div>
    </section>
  )
}

/* ------------------------------ Centre d'aide ------------------------------ */

const FAQ: [string, string][] = [
  ['Comment créer un cours ?', "Va dans l'onglet Cours. Tu peux écrire ou dicter ton texte, ou importer un PDF, une photo ou un audio. Memoa en fait un cours organisé."],
  ['Où retrouver mes cours ?', "Dans le Sac à dos : c'est l'étagère de tous tes cours. Ouvre un cours pour lire ses notes, les télécharger en PDF ou les écouter."],
  ['Comment fonctionne l\'Assistant ?', "Choisis un cours : l'Assistant s'appuie sur tes notes pour répondre. Tu peux lui parler avec le micro ou lui envoyer une photo."],
  ["C'est quoi l'Assistant TP ?", "Il t'aide à préparer un travail pratique ou un exposé : un plan, la rédaction, puis un PDF avec page de garde."],
  ["J'ai oublié mon mot de passe", "Sur la page de connexion, touche « Mot de passe oublié ? », entre ton email et ouvre le lien reçu. Regarde aussi dans les courriers indésirables."],
  ["Comment installer Memoa sur mon téléphone ?", "Android : ouvre Memoa dans Chrome, puis le menu ⋮ et « Installer l'application ». iPhone : ouvre Memoa dans Safari, touche Partager, puis « Sur l'écran d'accueil »."],
  ["Mes données sont-elles gardées si je change de téléphone ?", "Oui. Tes cours et notes sont liés à ton compte : connecte-toi avec le même email et le même mot de passe."],
  ['Premium, ça sert à quoi ?', "Premium débloque une utilisation plus généreuse de l'IA. Le paiement se fait par Mobile Money depuis l'écran Abonnement."],
  ["L'IA s'est trompée, que faire ?", "L'IA peut faire des erreurs : vérifie toujours les définitions, les chiffres et les références importantes. Tu peux nous signaler le problème depuis les paramètres."]
]

export function Help() {
  return (
    <main className="page">
      <BackLink to="/parametres" title="Centre d'aide" />
      <section className="card" style={{ gap: 0 }}>
        {FAQ.map(([q, a]) => (
          <details key={q} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, lineHeight: 1.4, minHeight: 28 }}>{q}</summary>
            <p style={{ margin: '8px 0 0', lineHeight: 1.5, fontSize: 15 }} className="muted">{a}</p>
          </details>
        ))}
      </section>
      <section className="card">
        <strong className="h2">Tu ne trouves pas ta réponse ?</strong>
        <span className="muted">Écris-nous directement, on lit tous les messages.</span>
        <Link to="/signaler" className="btn primary-light">Signaler un problème</Link>
      </section>
    </main>
  )
}

/* --------------------------- Signaler / Noter --------------------------- */

const KINDS: [FeedbackKind, string][] = [['bug', 'Un bug'], ['idea', 'Une idée'], ['other', 'Autre']]

export function Feedback({ mode }: { mode: 'report' | 'rating' }) {
  const { user } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [kind, setKind] = useState<FeedbackKind>('bug')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)
  const isRating = mode === 'rating'

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (isRating && rating === 0) return setError('Choisis une note de 1 à 5 étoiles.')
    if (!isRating && message.trim().length < 5) return setError('Décris le problème en quelques mots.')
    const ok = await run(async () => {
      await sendFeedback(user.id, isRating ? 'rating' : kind, message, isRating ? rating : undefined)
      return true
    })
    if (ok) setDone(true)
  }

  return (
    <main className="page">
      <BackLink to="/parametres" title={isRating ? "Noter l'application" : 'Signaler un problème'} />
      {done ? (
        <section className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
          <Logo size={48} />
          <strong className="h2">Merci !</strong>
          <span className="muted">{isRating ? 'Ta note nous aide à améliorer Memoa.' : "Ton message est bien arrivé. On s'en occupe."}</span>
          <Link to="/parametres" className="btn primary-light">Retour aux paramètres</Link>
        </section>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }} noValidate>
          {isRating ? (
            <div className="field">
              <span className="muted">Ton avis sur Memoa</span>
              <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Note">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} className="icon-btn" style={{ width: 52, height: 52 }} onClick={() => setRating(n)}>
                    <Icon name="star" size={32} color={n <= rating ? '#f2a33a' : 'currentColor'} stroke={n <= rating ? 2.4 : 1.6} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chips" role="radiogroup" aria-label="Type de message">
              {KINDS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={'pill' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
            </div>
          )}
          <div className="field">
            <label htmlFor="msg">{isRating ? 'Un commentaire (facultatif)' : 'Que s\'est-il passé ?'}</label>
            <textarea id="msg" className="textarea" maxLength={2000} placeholder={isRating ? "Ce que tu aimes, ce qu'on peut améliorer…" : 'Sur quel écran ? Qu\'as-tu fait juste avant ?'} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {!isRating && <span className="muted">Le type de téléphone et de navigateur est joint automatiquement pour nous aider à trouver le bug.</span>}
          <ErrorBox message={error} />
          <button className="btn primary-light" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button>
        </form>
      )}
    </main>
  )
}

/* ------------------------------ Confidentialité ------------------------------ */

export function Privacy() {
  return (
    <main className="page">
      <BackLink to="/parametres" title="Confidentialité" />
      <span className="muted">Dernière mise à jour : {UPDATED}</span>
      <Block title="Ce que nous gardons">
        <span>Ton email, ton numéro de téléphone, ton nom, ton université, ta faculté, ton département, ta promotion, ta photo de profil (facultative), le nom et l'animal de ton Memo.</span>
        <span>Tes cours, tes notes et tes conversations avec l'Assistant, pour te les montrer sur tous tes appareils.</span>
        <span>Les jours où tu as utilisé Memoa, pour compter tes flammes.</span>
        <span>Si tu nous écris : ton message, ta note, et le type de téléphone et de navigateur utilisé.</span>
      </Block>
      <Block title="À quoi ça sert">
        <span>À faire fonctionner ton compte, à te proposer tes cours et à générer les réponses de l'IA. Tes données servent aussi à protéger Memoa contre les abus (par exemple, un essai gratuit par numéro).</span>
      </Block>
      <Block title="L'intelligence artificielle">
        <span>Quand tu utilises l'IA (cours, notes, Assistant, TP, transcription audio), le texte ou l'audio concerné est envoyé à un fournisseur d'IA pour produire la réponse. La photo qu'on lit pour en extraire le texte est analysée sur ton téléphone.</span>
        <span>La dictée vocale utilise le service de reconnaissance de ton navigateur, qui peut avoir ses propres règles.</span>
      </Block>
      <Block title="Qui voit tes données">
        <span>Tes cours et notes sont privés : les autres étudiants ne les voient pas. Ce que tu déposes dans la Librairie est partagé avec ta promotion après validation.</span>
        <span>Ta photo de profil est stockée de façon publique : toute personne qui possède son adresse exacte peut la voir.</span>
        <span>Nous ne vendons pas tes données. Elles sont hébergées chez nos prestataires techniques (base de données, hébergement du site, fournisseur d'IA).</span>
      </Block>
      <Block title="Tes choix">
        <span>Tu peux modifier ton parcours et ta photo depuis l'onglet Moi. Pour supprimer ton compte et tes données, écris-nous depuis « Signaler un problème ».</span>
      </Block>
    </main>
  )
}

/* -------------------------------- Conditions -------------------------------- */

export function Terms() {
  return (
    <main className="page">
      <BackLink to="/parametres" title="Conditions d'utilisation" />
      <span className="muted">Dernière mise à jour : {UPDATED}</span>
      <Block title="Ce qu'est Memoa">
        <span>Memoa est un compagnon d'étude : il t'aide à organiser tes cours et à réviser. Ce n'est pas un substitut à tes enseignants ni à tes supports officiels.</span>
      </Block>
      <Block title="L'IA peut se tromper">
        <span>Les réponses de l'IA peuvent contenir des erreurs. Vérifie toujours les informations importantes avant de les utiliser dans un travail, un exposé ou un examen. Tu restes responsable de ce que tu rends.</span>
      </Block>
      <Block title="Ton compte">
        <span>Garde ton mot de passe pour toi. Un compte est personnel : ne le partage pas.</span>
      </Block>
      <Block title="Ce qui est interdit">
        <span>Déposer des contenus illégaux, violents ou qui portent atteinte à d'autres personnes ; publier dans la Librairie un document dont tu n'as pas le droit de partager ; chercher à contourner les limites ou la sécurité de l'application.</span>
        <span>Nous pouvons retirer un contenu ou suspendre un compte en cas d'abus.</span>
      </Block>
      <Block title="Abonnement">
        <span>Premium se paie par Mobile Money. Le prix affiché dans l'application au moment du paiement fait foi.</span>
      </Block>
      <Block title="Changements">
        <span>Ces conditions peuvent évoluer avec l'application. La date de mise à jour est indiquée en haut de cette page.</span>
      </Block>
    </main>
  )
}

/* --------------------------------- À propos --------------------------------- */

export function About() {
  return (
    <main className="page">
      <BackLink to="/parametres" title="À propos" />
      <section className="card" style={{ alignItems: 'center', textAlign: 'center', gap: 12 }}>
        <Logo size={64} />
        <strong className="h2">Memoa</strong>
        <span className="muted">Étudiez plus intelligemment.</span>
      </section>
      <Block title="Pourquoi Memoa">
        <span>Memoa est un compagnon académique pensé pour les étudiants d'Afrique, en commençant par la RDC. Il réunit tes cours, tes notes, ta progression et l'IA au même endroit.</span>
      </Block>
    </main>
  )
}
