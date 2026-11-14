import { useState, type FormEvent } from 'react'
import { ErrorBox, Icon, Logo, PageHead, PillButton, Row, RowGroup, useAction } from '../components/ui'
import { sendFeedback, type FeedbackKind } from '../lib/api'
import { useAuth } from '../lib/auth'

const UPDATED = '9 novembre 2026'

/* ------------------------- Page de document (modèle commun) ------------------------- */

type Sec = { title: string; paras: string[] }

function scrollToSection(id: string) {
  // HashRouter : un lien « #ancre » casserait la navigation, on fait défiler la page à la main.
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function DocPage({ label, title, intro, sections, showDate = true, hero }: { label: string; title: string; intro: string; sections: Sec[]; showDate?: boolean; hero?: boolean }) {
  return (
    <main className="page" style={{ gap: 20 }}>
      <PageHead to="/parametres" />
      <header style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {hero && <Logo size={56} />}
        <span className="doc-label">{label}</span>
        <h1 className="doc-title">{title}</h1>
        {showDate && <span className="doc-date">Mise à jour le {UPDATED}</span>}
        <p className="doc-intro">{intro}</p>
      </header>

      {sections.length > 1 && (
        <RowGroup label="Sur cette page">
          {sections.map((sec, i) => <Row key={sec.title} title={`${i + 1}. ${sec.title}`} onClick={() => scrollToSection(`sec-${i + 1}`)} />)}
        </RowGroup>
      )}

      {sections.map((sec, i) => (
        <section key={sec.title} id={`sec-${i + 1}`} className="doc-sec">
          <h2>{i + 1}. {sec.title}</h2>
          {sec.paras.map((t) => <p key={t}>{t}</p>)}
        </section>
      ))}

      <PillButton size="lg" to="/signaler">Contacter le support</PillButton>
    </main>
  )
}

/* ------------------------------ Centre d'aide ------------------------------ */

const FAQ: { theme: string; items: [string, string][] }[] = [
  {
    theme: 'Cours et notes',
    items: [
      ['Comment créer un cours ?', "Va dans l'onglet Cours. Tu peux écrire ou dicter ton texte, ou importer un PDF, une photo ou un audio. Memoa en fait un cours organisé."],
      ['Où retrouver mes cours ?', "Dans le Sac à dos : c'est l'étagère de tous tes cours. Ouvre un cours pour lire ses notes, les télécharger en PDF ou les écouter."]
    ]
  },
  {
    theme: 'Assistant et TP',
    items: [
      ['Comment fonctionne l\'Assistant ?', "Choisis un cours : l'Assistant s'appuie sur tes notes pour répondre. Tu peux lui parler avec le micro ou lui envoyer une photo."],
      ["C'est quoi l'Assistant TP ?", "Il t'aide à préparer un travail pratique ou un exposé : un plan, la rédaction, puis un PDF avec page de garde."],
      ["L'IA s'est trompée, que faire ?", "L'IA peut faire des erreurs : vérifie toujours les définitions, les chiffres et les références importantes. Tu peux nous signaler le problème depuis les paramètres."]
    ]
  },
  {
    theme: 'Compte et téléphone',
    items: [
      ["J'ai oublié mon mot de passe", "Sur la page de connexion, touche « Mot de passe oublié ? », entre ton email et ouvre le lien reçu. Regarde aussi dans les courriers indésirables."],
      ["Comment installer Memoa sur mon téléphone ?", "Android : ouvre Memoa dans Chrome, puis le menu ⋮ et « Installer l'application ». iPhone : ouvre Memoa dans Safari, touche Partager, puis « Sur l'écran d'accueil »."],
      ["Mes données sont-elles gardées si je change de téléphone ?", "Oui. Tes cours et notes sont liés à ton compte : connecte-toi avec le même email et le même mot de passe."]
    ]
  },
  {
    theme: 'Premium',
    items: [
      ['Premium, ça sert à quoi ?', "Premium débloque une utilisation plus généreuse de l'IA. Le paiement se fait par Mobile Money depuis l'écran Abonnement."]
    ]
  }
]

export function Help() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const term = q.trim().toLowerCase()
  const groups = FAQ
    .map((g) => ({ ...g, items: g.items.filter(([a, b]) => !term || a.toLowerCase().includes(term) || b.toLowerCase().includes(term)) }))
    .filter((g) => g.items.length > 0)

  return (
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/parametres" title="Centre d'aide" size={26} />
      <div className="hm-search" role="search">
        <span className="ico" style={{ top: 15 }}><Icon name="search" size={20} /></span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans l'aide" aria-label="Chercher dans l'aide" style={{ height: 54, borderRadius: 27 }} />
      </div>

      {!term && (
        <RowGroup label="Découvrir Memoa">
          <Row icon="sparkle" title="Visites guidées" sub="Revoir les explications de chaque page" to="/visites" />
        </RowGroup>
      )}

      {groups.length === 0 && <div className="muted" role="status" style={{ textAlign: 'center', padding: '12px 0' }}>Aucune question ne correspond.</div>}

      {groups.map((g) => (
        <RowGroup key={g.theme} label={g.theme}>
          {g.items.map(([question, answer]) => {
            const isOpen = open === question
            return (
              <div key={question} className="rg-item">
                <button type="button" className={'rg-row' + (isOpen ? ' open' : '')} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : question)}>
                  <span className="rg-body"><span className="rg-title" style={{ lineHeight: 1.4 }}>{question}</span></span>
                  <span className="acc-chev" style={{ display: 'inline-flex' }}><Icon name="chevdown" size={20} color="var(--text-3)" /></span>
                </button>
                {isOpen && <div className="acc-body">{answer}</div>}
              </div>
            )
          })}
        </RowGroup>
      ))}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', textAlign: 'center', paddingTop: 8 }}>
        <strong className="h2">Tu ne trouves pas ta réponse ?</strong>
        <span className="muted">Écris-nous directement, on lit tous les messages.</span>
        <PillButton size="lg" to="/signaler">Signaler un problème</PillButton>
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
    <main className="page" style={{ gap: 18 }}>
      <PageHead to="/parametres" title={isRating ? "Noter l'application" : 'Signaler un problème'} size={26} />
      {done ? (
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 12, paddingTop: 24 }}>
          <Logo size={56} />
          <strong className="h2" style={{ fontSize: 22 }}>Merci !</strong>
          <span className="muted">{isRating ? 'Ta note nous aide à améliorer Memoa.' : "Ton message est bien arrivé. On s'en occupe."}</span>
          <div style={{ width: '100%', marginTop: 12 }}><PillButton size="lg" to="/parametres">Retour aux paramètres</PillButton></div>
        </section>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
          {isRating ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <span className="lead">Ton avis sur Memoa</span>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }} role="radiogroup" aria-label="Note">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} className="icon-btn round" style={{ width: 56, height: 56, border: 0 }} onClick={() => setRating(n)}>
                    <Icon name="star" size={40} color={n <= rating ? '#f2a33a' : 'currentColor'} stroke={n <= rating ? 2.4 : 1.6} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="chips" role="radiogroup" aria-label="Type de message">
              {KINDS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={kind === k} className={'pill' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>)}
            </div>
          )}
          <textarea id="msg" className="pill-area" maxLength={2000} aria-label={isRating ? 'Un commentaire (facultatif)' : "Que s'est-il passé ?"} placeholder={isRating ? "Un commentaire (facultatif) : ce que tu aimes, ce qu'on peut améliorer…" : "Que s'est-il passé ? Sur quel écran ? Qu'as-tu fait juste avant ?"} value={message} onChange={(e) => setMessage(e.target.value)} />
          {!isRating && <span className="muted">Le type de téléphone et de navigateur est joint automatiquement pour nous aider à trouver le bug.</span>}
          <ErrorBox message={error} />
          <PillButton type="submit" size="lg" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</PillButton>
        </form>
      )}
    </main>
  )
}

/* ------------------------------ Confidentialité ------------------------------ */

const PRIVACY: Sec[] = [
  {
    title: 'Ce que nous gardons',
    paras: [
      "Ton email, ton numéro de téléphone, ton nom, ton université, ta faculté, ton département, ta promotion, ta photo de profil (facultative), le nom et l'animal de ton Memo.",
      "Tes cours, tes notes et tes conversations avec l'Assistant, pour te les montrer sur tous tes appareils.",
      "Les jours où tu as utilisé Memoa, pour compter tes flammes.",
      "Si tu nous écris : ton message, ta note, et le type de téléphone et de navigateur utilisé."
    ]
  },
  {
    title: 'Ce qui reste sur ton téléphone',
    paras: [
      "Pour que tu puisses lire et écouter tes cours sans connexion, Memoa garde une copie de tes cours et de tes notes déjà ouverts sur ton téléphone. Cette copie n'est envoyée à personne et elle est effacée quand tu te déconnectes.",
      "Tes brouillons, tes notes écrites sans réseau, tes enregistrements en attente et l'avancement d'un TP en cours de rédaction sont aussi gardés sur ton téléphone, pour une durée limitée (72 h pour les brouillons, 24 h pour un TP).",
      "Pendant la rédaction d'un TP, Memoa peut garder l'écran allumé et, si tu l'autorises, t'envoyer une notification quand il est prêt. Tu peux refuser ou retirer cette autorisation dans les réglages de ton téléphone."
    ]
  },
  {
    title: 'À quoi ça sert',
    paras: ["À faire fonctionner ton compte, à te proposer tes cours et à générer les réponses de l'IA. Tes données servent aussi à protéger Memoa contre les abus (par exemple, un essai gratuit par numéro)."]
  },
  {
    title: "L'intelligence artificielle",
    paras: [
      "Quand tu utilises l'IA (cours, notes, Assistant, TP, transcription audio), le texte ou l'audio concerné est envoyé à un fournisseur d'IA pour produire la réponse. La photo qu'on lit pour en extraire le texte est analysée sur ton téléphone.",
      "La dictée vocale utilise le service de reconnaissance de ton navigateur, qui peut avoir ses propres règles."
    ]
  },
  {
    title: 'Qui voit tes données',
    paras: [
      "Tes cours et notes sont privés : les autres étudiants ne les voient pas. Ce que tu déposes dans la Librairie est partagé avec ta promotion après validation.",
      "Ta photo de profil est stockée de façon publique : toute personne qui possède son adresse exacte peut la voir.",
      "Nous ne vendons pas tes données. Elles sont hébergées chez nos prestataires techniques (base de données, hébergement du site, fournisseur d'IA)."
    ]
  },
  {
    title: 'Tes choix',
    paras: ["Tu peux modifier ton parcours et ta photo depuis l'onglet Moi. Pour supprimer ton compte et tes données, écris-nous depuis « Signaler un problème »."]
  }
]

export function Privacy() {
  return <DocPage label="Légal" title="Confidentialité" intro="Voici ce que Memoa garde, à quoi cela sert et qui peut le voir." sections={PRIVACY} />
}

/* -------------------------------- Conditions -------------------------------- */

const TERMS: Sec[] = [
  { title: "Ce qu'est Memoa", paras: ["Memoa est un compagnon d'étude : il t'aide à organiser tes cours et à réviser. Ce n'est pas un substitut à tes enseignants ni à tes supports officiels."] },
  { title: "L'IA peut se tromper", paras: ["Les réponses de l'IA peuvent contenir des erreurs. Vérifie toujours les informations importantes avant de les utiliser dans un travail, un exposé ou un examen. Tu restes responsable de ce que tu rends."] },
  { title: 'Ton compte', paras: ["Garde ton mot de passe pour toi. Un compte est personnel : ne le partage pas."] },
  {
    title: 'Ce qui est interdit',
    paras: [
      "Déposer des contenus illégaux, violents ou qui portent atteinte à d'autres personnes ; publier dans la Librairie un document dont tu n'as pas le droit de partager ; chercher à contourner les limites ou la sécurité de l'application.",
      "Nous pouvons retirer un contenu ou suspendre un compte en cas d'abus."
    ]
  },
  { title: 'Abonnement', paras: ["Premium se paie par Mobile Money. Le prix affiché dans l'application au moment du paiement fait foi."] },
  { title: 'Changements', paras: ["Ces conditions peuvent évoluer avec l'application. La date de mise à jour est indiquée en haut de cette page."] }
]

export function Terms() {
  return <DocPage label="Légal" title="Conditions d'utilisation" intro="Les règles pour utiliser Memoa. Lis-les une fois : elles sont courtes." sections={TERMS} />
}

/* --------------------------------- À propos --------------------------------- */

const ABOUT: Sec[] = [
  { title: 'Pourquoi Memoa', paras: ["Memoa est un compagnon académique pensé pour les étudiants d'Afrique, en commençant par la RDC. Il réunit tes cours, tes notes, ta progression et l'IA au même endroit."] }
]

export function About() {
  return <DocPage label="À propos" title="Memoa" intro="Étudiez plus intelligemment." sections={ABOUT} showDate={false} hero />
}
