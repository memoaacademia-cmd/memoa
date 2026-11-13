import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import RichText from '../components/RichText'
import DictateButton from '../components/Dictate'
import { WEB_SEARCH_ENABLED } from '../lib/features'
import { BackLink, BottomSheet, Empty, ErrorBox, Icon, PageHead, PillButton, PillInput, Row, RowGroup, Spinner, useAction, useLoad, WebToggle } from '../components/ui'
import { AddDocSheet, EditorBar, EditorScreen, RecordingSheet, useRecorder } from '../components/Editor'
import { addNote, askAI, createCourse, getCourse, listCourses, listNotes, renameCourse, updateNote, LimitError, listTrashedCourses, setCourseTrashed, transcribeAudio, TRASH_DAYS } from '../lib/api'
import { useAuth } from '../lib/auth'
import { DraftsSection } from '../components/Drafts'
import { deleteDraft, getDraft, saveDraft, useDrafts } from '../lib/drafts'
import { isOnline, OFFLINE_MSG, useOnline } from '../lib/online'
import { OfflineSaveSheet, PendingAudioChip } from '../components/OfflineSave'
import { logoUrlFor, universityLabel } from '../data/academic'
import { buildCoursePdf, buildTpPdfDetailed, stripAiNoise, splitTpTitle, COVER_ORDER, COVER_TEMPLATES, effectiveTemplate, type CoverTemplate } from '../lib/pdf'
import { isPremiumNow, usePremium } from '../lib/premium'
import { usePref } from '../lib/prefs'
import { cleanTpText } from '../lib/tpclean'
import { readPhotoText } from '../lib/ocr'
import { adjustLength, assemble, loadProgress, parsePlan, partIsComplete, saveProgress } from '../lib/tpwrite'
import { extractPdfText } from '../lib/pdfimport'
import { startTpJob, takeTpResult, dismissTpError, useTpJob } from '../lib/tpjob'
import { canDictate, canSpeak, speak, startDictation, stopSpeaking, useVoice, type Dictation } from '../lib/speech'
import type { Note } from '../lib/types'

// « Ajouter une note » propose toutes les méthodes : on y ajoute l'enregistrement direct et la vidéo (réduite à sa voix par la transcription).
const NOTE_SOURCES = [
  { id: 'texte', label: 'Texte', icon: 'text' },
  { id: 'voix', label: 'Dictée', icon: 'mic' },
  { id: 'enreg', label: 'Enregistrer', icon: 'mic' },
  { id: 'audio', label: 'Audio', icon: 'audio' },
  { id: 'video', label: 'Vidéo', icon: 'video' },
  { id: 'pdf', label: 'PDF', icon: 'pdf' },
  { id: 'photo', label: 'Photo', icon: 'photo' }
]
const MAX_MEDIA_MB = 20
const asFile = (b: Blob): File => (b instanceof File ? b : new File([b], 'enregistrement.webm', { type: b.type || 'audio/webm' }))

/* Onglet « Cours » : sert uniquement à créer un cours. Même écran d'écriture que « Ajouter une note ». Une fois créé, le cours est rangé dans le sac à dos. */
export function NewCourse() {
  const nav = useNavigate()
  const { user } = useAuth()
  const { busy, error, setError, run } = useAction()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [consignes, setConsignes] = useState('')
  const [web, setWeb] = useState(false) // éteinte par défaut
  const [step, setStep] = useState('')
  const [source, setSource] = useState('texte')
  const [listening, setListening] = useState(false)
  const [docSheet, setDocSheet] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [pendingAudio, setPendingAudio] = useState<File | null>(null)
  const [offlineSheet, setOfflineSheet] = useState(false)
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const dict = useRef<Dictation | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const audioInput = useRef<HTMLInputElement>(null)
  const videoInput = useRef<HTMLInputElement>(null)
  const rec = useRecorder({ maxBytes: MAX_MEDIA_MB * 1024 * 1024, onFile: (f) => void transcribeFile(f, 'audio'), onError: (m) => setError(m) })
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

  useEffect(() => () => { dict.current?.stop() }, [])

  // Ouverture d'un brouillon (depuis « Brouillons en attente ») : on remet le titre, le texte et les consignes.
  const bid = params.get('brouillon')
  useEffect(() => {
    if (!bid || !user) return
    let alive = true
    void getDraft(bid).then((d) => {
      if (!alive) return
      if (d && d.userId === user.id && d.kind === 'course') {
        setTitle(d.title); setContent(d.body); setConsignes(d.guide); setSource(d.source || 'texte'); setDraftId(d.id)
        if (d.audio) void transcribeFile(asFile(d.audio), 'audio')
      } else setError('Ce brouillon a disparu (72 h écoulées) ou n’existe plus sur ce téléphone.')
      setParams({}, { replace: true })
    }).catch(() => { if (alive) setParams({}, { replace: true }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, user?.id])

  // Le réseau revient : l'enregistrement gardé est transcrit automatiquement.
  useEffect(() => {
    if (online && pendingAudio && !step) void transcribeFile(pendingAudio, 'audio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  function appendText(t: string) { setContent((c) => (c ? c + '\n\n' : '') + t.slice(0, 60000)) }

  /** « Brouillon » : garde le cours en cours d'écriture sur le téléphone (72 h), puis retourne à la liste. */
  async function keepDraft(force = false) {
    if (!user) return
    if (!title.trim() && !content.trim() && !consignes.trim() && !pendingAudio) return setError('Écris quelque chose avant de le garder en brouillon.')
    dict.current?.stop()
    // Sans réseau, « Brouillon » propose : nouveau cours ou ajout à un cours existant (envoi automatique au retour du réseau).
    if (!force && !isOnline() && (content.trim() || pendingAudio)) { if (!title.trim()) return setError('Donne un nom à ta note.'); return setOfflineSheet(true) }
    const d = await run(() => saveDraft({ id: draftId, userId: user.id, kind: 'course', title, body: content, guide: consignes, source, audio: pendingAudio }))
    if (d) nav('/sac')
  }

  function toggleDictation() {
    if (listening) { dict.current?.stop(); return }
    setError(null)
    // Sans réseau, la dictée du téléphone ne marche pas : on enregistre la voix, elle sera transcrite au retour du réseau.
    if (!isOnline()) { if (pendingAudio) return setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); setRecOpen(true); void rec.start(); return }
    const d = startDictation(
      (t) => setContent((c) => (c ? c + ' ' : '') + t),
      (err) => {
        setListening(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') setError("Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.")
        else if (err === 'network') setError('La dictée a besoin du réseau sur ce téléphone. Écris ta note à la main, ou réessaie quand le réseau revient.')
      }
    )
    if (!d) return setError("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    dict.current = d
    setListening(true)
    setSource('voix')
  }

  async function pickPdf(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return setError('Ce PDF est trop lourd (15 Mo maximum).')
    setStep('Lecture du PDF…')
    const text = await run(() => extractPdfText(f))
    setStep('')
    if (text === undefined) return
    if (text.length < 20) return setError("Ce PDF ne contient pas de texte lisible (il est peut-être scanné). Essaie un autre PDF ou colle le texte.")
    appendText(text)
    setSource('pdf')
    setTitle((t) => t.trim() ? t : f.name.replace(/\.pdf$/i, '').slice(0, 80))
  }

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    if (!isOnline()) return setError('La lecture d’une photo a besoin du réseau. Réessaie quand il revient.')
    const text = await run(() => readPhotoText(f, setStep))
    setStep('')
    if (text === undefined) return
    if (text.length < 15) return setError("Je n'arrive pas à lire de texte sur cette photo. Prends-la bien droite, avec de la lumière, ou choisis un texte imprimé.")
    appendText(text)
    setSource('photo')
  }

  async function transcribeFile(f: File, kind: 'audio' | 'video') {
    if (f.size > MAX_MEDIA_MB * 1024 * 1024) return setError(`Ce fichier est trop lourd (${MAX_MEDIA_MB} Mo maximum). ${kind === 'video' ? 'Essaie une vidéo plus courte.' : 'Coupe-le en plusieurs parties.'}`)
    // Sans réseau : l'enregistrement (ou le fichier) est gardé et sera transcrit tout seul au retour du réseau.
    if (!isOnline()) { if (pendingAudio) { setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); return } setPendingAudio(f); setError(null); return }
    setPendingAudio(null)
    setStep('Transcription en cours… cela peut prendre une minute.')
    const text = await run(() => transcribeAudio(f))
    setStep('')
    if (text === undefined) { setPendingAudio(f); return }
    appendText(text)
    setSource('audio')
    setTitle((t) => t.trim() ? t : f.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  function leave() {
    if ((title.trim() || content.trim() || consignes.trim()) && !window.confirm('Fermer sans créer ? Ce que tu as écrit sera perdu. (Touche « Brouillon » pour le garder 72 h.)')) return
    dict.current?.stop()
    nav('/')
  }

  async function submit() {
    if (!user) return
    dict.current?.stop()
    if (!title.trim()) return setError('Donne un nom à ton cours.')
    if (!isOnline()) {
      // Sans réseau : l'IA n'est pas joignable, mais la note peut être gardée (nouveau cours OU ajout à un cours existant) et envoyée plus tard.
      if (!content.trim() && !pendingAudio) return setError(consignes.trim() ? 'Sans réseau, Memo ne peut pas rédiger ton cours. Écris ta note toi-même, ou garde-la en brouillon.' : 'Écris ta note pour pouvoir la garder.')
      return setOfflineSheet(true)
    }
    if (pendingAudio) return setError("Ton enregistrement n'est pas encore transcrit. Attends la fin de la transcription, ou garde-le en brouillon.")
    const id = await run(async () => {
      // L'IA passe d'abord : si les points sont épuisés, rien n'est créé et « Passer en Premium » s'affiche.
      let structured = content.trim()
      const instr = consignes.trim()
      if (!structured && instr) {
        // Pas de notes : seulement des consignes. L'IA rédige le cours à partir de ses connaissances (et du web si coché).
        setStep('Rédaction de ton cours par Memo…')
        const r = await askAI({ task: 'enrich_note', purpose: 'course', web: WEB_SEARCH_ENABLED && web, prompt: `Consignes de l'étudiant : ${instr}\n\nTexte déjà écrit par l'étudiant :\n(aucun)` })
        structured = stripAiNoise(r.reply).trim()
        if (!structured) throw new Error("Memo n'a pas réussi à rédiger le cours. Reformule tes consignes et réessaie.")
      } else if (structured) {
        setStep('Mise en forme de tes notes…')
        try {
          if (structured.length > 7500) throw new Error('trop long pour la mise en forme IA')
          const r = await askAI({ task: 'structure_notes', purpose: 'course', prompt: instr ? `Consignes de l'étudiant pour la mise en forme (applique-les, ne les recopie pas dans les notes) : ${instr}\n\nTexte à mettre en forme :\n${structured}` : structured })
          if (r.reply.trim()) structured = r.reply.trim()
        } catch (e) {
          if (e instanceof LimitError) throw e
          /* l'IA est facultative ici : on garde le texte tel quel plutôt que de perdre la note */
        }
      }
      setStep('Création du cours…')
      const course = await createCourse(user.id, title)
      // Le contenu du cours est rangé sous le nom du cours. Les consignes ne sont pas gardées : elles ne servent qu'à guider l'IA.
      if (structured) {
        await addNote(user.id, course.id, title.trim(), structured.slice(0, 60000), content.trim() ? (source === 'pdf' ? 'pdf' : source === 'voix' ? 'voix' : source === 'photo' ? 'photo' : source === 'audio' ? 'audio' : 'texte') : 'texte')
      }
      if (draftId) await deleteDraft(draftId).catch(() => {})
      return course.id
    })
    setStep('')
    if (id) nav(`/sac/${id}${draftId ? '?pdf=1' : ''}`)
  }

  return (
    <main className="page">
      {/* Sélecteurs de fichiers : toujours présents, ouverts par les boutons de la barre du bas. */}
      <input ref={pdfInput} type="file" accept="application/pdf" hidden onChange={(e) => { void pickPdf(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={audioInput} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'audio'); e.target.value = '' }} />
      <input ref={videoInput} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'video'); e.target.value = '' }} />

      <EditorScreen
        backLabel="Nouveau cours"
        onBack={leave}
        doneLabel={busy ? 'Un instant…' : draftId && online ? 'Générer le PDF' : 'Créer'}
        onDone={() => void submit()}
        doneDisabled={busy || rec.state !== 'idle'}
        onDraft={() => void keepDraft()}
        draftDisabled={busy}
        title={title}
        onTitle={setTitle}
        titlePlaceholder="Titre du cours"
        dateText={today}
        body={content}
        onBody={setContent}
        bodyPlaceholder="Écris ou colle ton cours ici. Tu peux aussi le créer vide et ajouter des notes plus tard."
        hint={!online ? 'Sans connexion : tu peux écrire, dicter ou enregistrer ta voix (la dictée devient un enregistrement, transcrit automatiquement quand tu auras du réseau). Touche « Créer » pour garder ta note (nouveau cours ou cours existant) : elle sera envoyée toute seule au retour du réseau. Ou touche « Brouillon » pour tout garder 72 h.' : undefined}
        banner={<>{pendingAudio && <PendingAudioChip file={pendingAudio} onRemove={() => setPendingAudio(null)} />}{step && <span className="muted" role="status">{step}</span>}<ErrorBox message={error} /></>}
        guide={consignes}
        onGuide={setConsignes}
        guideHelp="Avec des notes : Memo les met en forme selon tes consignes. Sans notes : écris seulement les consignes et Memo rédige le cours à ta place. Créer un cours avec Memo coûte 15 points. Il s’en sert quand tu touches « Créer »."
        guideExtra={
          <div className="ed-tools-row">
            <DictateButton onText={(t) => setConsignes((b) => (b ? b + ' ' : '') + t)} label="Dicter les consignes" />
            {WEB_SEARCH_ENABLED && <WebToggle on={web} set={setWeb} />}
          </div>
        }
        bar={<EditorBar onPhoto={() => photoInput.current?.click()} onDictate={toggleDictation} dictating={listening} onRecord={() => { if (!isOnline() && pendingAudio) return setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); setRecOpen(true); void rec.start() }} recordDisabled={!!step} onPlus={() => setDocSheet(true)} />}
      />

      <AddDocSheet open={docSheet} onClose={() => setDocSheet(false)} maxMb={MAX_MEDIA_MB} onPdf={() => pdfInput.current?.click()} onAudio={() => audioInput.current?.click()} onVideo={() => videoInput.current?.click()} />
      <RecordingSheet open={recOpen} onClose={() => setRecOpen(false)} rec={rec} maxMb={MAX_MEDIA_MB} />
      {user && (
        <OfflineSaveSheet
          open={offlineSheet} onClose={() => setOfflineSheet(false)} userId={user.id}
          title={title} content={content} audio={pendingAudio} source={source === 'pdf' ? 'pdf' : source === 'voix' ? 'voix' : source === 'photo' ? 'photo' : source === 'audio' ? 'audio' : 'texte'}
          onDraftOnly={() => { setOfflineSheet(false); void keepDraft(true) }}
          onQueued={() => { if (draftId) void deleteDraft(draftId).catch(() => {}); setOfflineSheet(false); nav('/') }}
        />
      )}
    </main>
  )
}

/* Sac à dos : liste de lignes, un bouton « Nouveau cours », corbeille repliable de 30 jours. */
export function Backpack() {
  const { user } = useAuth()
  const { data, loading, error, reload } = useLoad(() => listCourses(user?.id ?? ''), [user?.id])
  const trash = useLoad(listTrashedCourses, [])
  const { busy, error: actionError, run } = useAction()
  const { drafts, now, reload: reloadDrafts } = useDrafts(user?.id)
  const [showTrash, setShowTrash] = useState(false)
  const trashed = trash.data ?? []

  async function restore(id: string) {
    const ok = await run(async () => { await setCourseTrashed(id, false); return true })
    if (ok) { trash.reload(); reload() }
  }
  const daysLeft = (d?: string | null) => Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(d ?? Date.now()).getTime()) / 86400000))

  const all = data ?? []
  const [qc, setQc] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const shown = all.filter((c) => c.title.toLowerCase().includes(qc.trim().toLowerCase()))
  const totalNotes = all.reduce((n, c) => n + c.notes_count, 0)

  return (
    <main className="page" style={{ gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <h1 className="h1 big" style={{ margin: 0 }}>Mes cours</h1>
          <span className="muted">{all.length} {all.length > 1 ? 'cours' : 'cours'} · {totalNotes} {totalNotes > 1 ? 'notes' : 'note'}</span>
        </div>
        <button type="button" className={'round-search' + (searchOpen ? ' on' : '')} aria-label="Chercher un cours" aria-expanded={searchOpen} onClick={() => { if (searchOpen) setQc(''); setSearchOpen((v) => !v) }}>
          <Icon name="search" size={22} />
        </button>
      </div>
      <PillButton size="lg" to="/cours"><Icon name="plus" size={22} stroke={2.4} />Nouveau cours</PillButton>
      {searchOpen && (
        <div className="cs-bar" role="search">
          <Icon name="search" size={20} color="var(--text-3)" />
          <input autoFocus type="search" value={qc} onChange={(e) => setQc(e.target.value)} placeholder="Chercher un cours" aria-label="Chercher un cours" />
          <button type="button" className="cs-x" aria-label="Fermer la recherche" onClick={() => { setQc(''); setSearchOpen(false) }}><Icon name="close" size={18} stroke={2.2} /></button>
        </div>
      )}
      <ErrorBox message={error || actionError} />
      <DraftsSection drafts={drafts} now={now} onDelete={(d) => void deleteDraft(d.id).then(reloadDrafts)} />
      {loading ? <Spinner /> : error && !all.length ? null : !all.length ? (
        <Empty title="Ton sac à dos est vide" text="Crée ton premier cours : il sera rangé ici." />
      ) : (
        <>
          <RowGroup>
            {shown.length ? shown.map((c) => (
              <Row key={c.id} icon="book" title={c.title} sub={`${c.notes_count} ${c.notes_count > 1 ? 'notes' : 'note'}`} to={`/sac/${c.id}`} />
            )) : <div className="rg-empty">Aucun cours ne correspond.</div>}
          </RowGroup>
        </>
      )}
      {trashed.length > 0 && (
        <>
          <PillButton variant="outline" onClick={() => setShowTrash((v) => !v)}>
            <Icon name="trash" size={20} />Corbeille ({trashed.length}) · {showTrash ? 'Masquer' : 'Voir'}
          </PillButton>
          {showTrash && (
            <RowGroup label={`Supprimés · ${TRASH_DAYS} jours`}>
              {trashed.map((c) => (
                <div key={c.id} className="rg-row" style={{ cursor: 'default' }}>
                  <span className="rg-body">
                    <span className="rg-title">{c.title}</span>
                    <span className="rg-sub">{daysLeft(c.deleted_at)} j restants</span>
                  </span>
                  <PillButton variant="outline" size="sm" disabled={busy} onClick={() => void restore(c.id)}>Restaurer</PillButton>
                </div>
              ))}
            </RowGroup>
          )}
        </>
      )}
    </main>
  )
}

function fileName(name: string) {
  return (name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'cours') + '.pdf'
}
function saveBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName(name)
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/* Un cours du sac à dos : un grand bouton « Ajouter une note », la liste des outils, puis les notes. */
/* ------------------------------ Quiz ------------------------------ */
interface QuizQ { q: string; opts: string[]; ans: number; why: string }

const QUIZ_PROMPT = `Fais-moi un quiz de 5 questions à choix multiples (4 choix chacune) sur ce cours. Réponds UNIQUEMENT dans ce format exact, sans introduction, sans conclusion, sans astérisques, avec une ligne vide entre les questions :
QUESTION: la question
A) premier choix
B) deuxième choix
C) troisième choix
D) quatrième choix
REPONSE: la lettre de la bonne réponse
EXPLICATION: une phrase courte tirée de mes notes`

/** Découpe la réponse de l'IA en questions. Si le format n'est pas respecté, la liste est vide et on affiche le texte tel quel. */
function parseQuiz(text: string): QuizQ[] {
  const clean = text.replace(/\*\*/g, '').replace(/\r/g, '')
  const blocks = clean.split(/(?:^|\n)\s*(?:QUESTION|Question)\s*\d*\s*[:.)-]/).slice(1)
  const out: QuizQ[] = []
  for (const b of blocks) {
    const first = b.search(/^\s*A\s*[).:-]/m)
    if (first < 0) continue
    const q = b.slice(0, first).trim()
    const head = b.slice(first).split(/R[ÉE]PONSE/i)[0]
    const opts: string[] = []
    // Un choix peut tenir sur plusieurs lignes : les lignes qui suivent « B) … » en font partie, jusqu'au choix suivant.
    let cur = -1
    for (const line of head.split('\n')) {
      const m = /^\s*([A-D])\s*[).:-]\s*(.*)$/.exec(line)
      if (m) { cur = m[1].charCodeAt(0) - 65; opts[cur] = m[2].trim() }
      else if (cur >= 0 && line.trim()) opts[cur] = (opts[cur] + ' ' + line.trim()).trim()
    }
    const dense = opts.filter(Boolean)
    if (!q || dense.length < 2 || dense.length !== opts.length) continue
    const am = /R[ÉE]PONSE\s*:?\s*\(?([A-D])/i.exec(b)
    if (!am) continue
    const ans = am[1].toUpperCase().charCodeAt(0) - 65
    if (ans >= dense.length) continue
    const why = (/EXPLICATION\s*:?\s*([\s\S]*)$/i.exec(b)?.[1] ?? '').trim()
    out.push({ q, opts: dense, ans, why })
  }
  return out
}

function QuizScreen({ qs, raw, onClose, onNext, loading, loadError }: { qs: QuizQ[]; raw: string; onClose: () => void; onNext: () => void; loading: boolean; loadError: string | null }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)

  if (!qs.length) {
    return (
      <div className="screen-full" role="dialog" aria-modal="true" aria-label="Révision">
        <div className="sf-top">
          <button type="button" className="icon-btn round" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
          <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>Révision</h1>
        </div>
        <div className="sf-main"><div className="sum-text" style={{ whiteSpace: 'normal' }}><RichText text={raw} /></div></div>
        <div className="sf-foot"><PillButton onClick={onClose}>Fermer</PillButton></div>
      </div>
    )
  }

  const q = qs[i]
  function choose(k: number) {
    if (picked !== null) return
    setPicked(k)
    if (k === q.ans) setScore((x) => x + 1)
  }
  function next() {
    if (i + 1 >= qs.length) setDone(true)
    else { setI(i + 1); setPicked(null) }
  }
  function again() { setI(0); setPicked(null); setScore(0); setDone(false) }

  if (done) {
    return (
      <div className="screen-full" role="dialog" aria-modal="true" aria-label="Score">
        <div className="sf-top">
          <button type="button" className="icon-btn round" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </div>
        <div className="sf-main" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
          <span className="doc-label">Ton score</span>
          <div className="qz-score">{score} / {qs.length}</div>
          <p className="doc-intro">{score === qs.length ? 'Parfait, tu maîtrises ce cours.' : score >= qs.length / 2 ? 'Bien joué. Relis les notes sur les questions ratées.' : 'Pas encore. Relis tes notes et réessaie.'}</p>
        </div>
        {loadError && <div style={{ padding: '0 20px' }}><div className="error" role="alert">{loadError}</div></div>}
        <div className="sf-foot" style={{ flexDirection: 'column' }}>
          <PillButton size="lg" onClick={onNext} disabled={loading}>{loading ? 'Nouvelles questions…' : 'Quiz suivant'}</PillButton>
          <div style={{ display: 'flex', gap: 10 }}>
            <PillButton variant="outline" onClick={again} disabled={loading}>Recommencer</PillButton>
            <PillButton variant="outline" onClick={onClose}>Fermer</PillButton>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-full" role="dialog" aria-modal="true" aria-label="Révision">
      <div className="sf-top">
        <button type="button" className="icon-btn round" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        <div className="qz-bar" role="progressbar" aria-valuemin={0} aria-valuemax={qs.length} aria-valuenow={i + 1}><span className="qz-fill" style={{ width: `${((i + (picked !== null ? 1 : 0)) / qs.length) * 100}%` }} /></div>
        <span className="qz-count">{i + 1} / {qs.length}</span>
      </div>
      <div className="sf-main">
        <h2 className="qz-q">{q.q}</h2>
        {q.opts.map((o, k) => {
          const cls = picked === null ? '' : k === q.ans ? ' right' : k === picked ? ' wrong' : ''
          return (
            <button key={k} type="button" className={'qz-opt' + cls} onClick={() => choose(k)} disabled={picked !== null}>
              <span className="l">{String.fromCharCode(65 + k)}</span>
              <span className="t">{o}</span>
              {picked !== null && k === q.ans && <Icon name="check" size={20} stroke={2.6} />}
              {picked !== null && k === picked && k !== q.ans && <Icon name="close" size={20} stroke={2.6} />}
            </button>
          )
        })}
        {picked !== null && (
          <div className={'qz-fb ' + (picked === q.ans ? 'ok' : 'ko')} role="status">
            <b>{picked === q.ans ? 'Bonne réponse' : 'Pas tout à fait'}</b>
            {picked !== q.ans && <span>La bonne réponse : {String.fromCharCode(65 + q.ans)}) {q.opts[q.ans]}</span>}
            {q.why && <span>{q.why}</span>}
          </div>
        )}
      </div>
      <div className="sf-foot">
        <PillButton size="lg" onClick={next} disabled={picked === null}>{i + 1 >= qs.length ? 'Terminer' : 'Question suivante'}</PillButton>
      </div>
    </div>
  )
}

export function CourseDetail() {
  const { id = '' } = useParams()
  const { user, profile } = useAuth()
  const profileName = profile?.full_name ?? ''
  const course = useLoad(() => getCourse(id), [id])
  const notes = useLoad(() => listNotes(id), [id])
  const { busy, error, setError, run } = useAction()
  const [sheet, setSheet] = useState(false)
  const [editing, setEditing] = useState(false)
  const [docSheet, setDocSheet] = useState(false)
  const [recOpen, setRecOpen] = useState(false)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteText, setNoteText] = useState('')
  const [noteGuide, setNoteGuide] = useState('')
  const [noteWeb, setNoteWeb] = useState(false) // éteinte par défaut
  const [modify, setModify] = useState(false)
  const [mainId, setMainId] = useState<string | null>(null)
  const [draftId, setDraftId] = useState<string | null>(null)
  const [pendingAudio, setPendingAudio] = useState<File | null>(null)
  const online = useOnline()
  const [params, setParams] = useSearchParams()
  const [pdfPrompt, setPdfPrompt] = useState(params.get('pdf') === '1')
  const { drafts, now, reload: reloadDrafts } = useDrafts(user?.id)
  const [quiz, setQuiz] = useState<{ qs: QuizQ[]; raw: string; n: number; seen: string[] } | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)
  const [quizError, setQuizError] = useState<string | null>(null)
  const reading = useVoice() !== null
  const [listenOpen, setListenOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [summaryScope, setSummaryScope] = useState('')
  const nav = useNavigate()
  const [noteSource, setNoteSource] = useState('texte')
  const [noteStep, setNoteStep] = useState('')
  const [listening, setListening] = useState(false)
  const [offlineSheet, setOfflineSheet] = useState(false)
  const dict = useRef<Dictation | null>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLInputElement>(null)
  const rec = useRecorder({ maxBytes: MAX_MEDIA_MB * 1024 * 1024, onFile: (f) => void transcribeFile(f, 'audio'), onError: (m) => setError(m) })

  useEffect(() => () => { dict.current?.stop() }, [])

  // Arrivée avec ?pdf=1 (après « Générer le PDF » depuis un brouillon) ou ?brouillon=… (réouverture d'un brouillon).
  const bid = params.get('brouillon')
  useEffect(() => {
    if (params.get('pdf') === '1') setParams({}, { replace: true })
    if (!bid || !user) return
    let alive = true
    void getDraft(bid).then((d) => {
      if (!alive) return
      if (d && d.userId === user.id && d.courseId === id && d.kind !== 'course') {
        setNoteTitle(d.title); setNoteText(d.body); setNoteGuide(d.guide); setNoteSource(d.source || 'texte')
        setModify(d.kind === 'edit'); setMainId(d.kind === 'edit' ? d.noteId : null); setDraftId(d.id)
        setError(null); setEditing(true)
        if (d.audio) void transcribeFile(asFile(d.audio), 'audio')
      } else setError('Ce brouillon a disparu (72 h écoulées) ou n’existe plus sur ce téléphone.')
      setParams({}, { replace: true })
    }).catch(() => { if (alive) setParams({}, { replace: true }) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bid, user?.id])

  // Le réseau revient : l'enregistrement gardé est transcrit automatiquement.
  useEffect(() => {
    if (online && pendingAudio && !noteStep) void transcribeFile(pendingAudio, 'audio')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  function appendText(t: string) { setNoteText((x) => (x ? x + '\n\n' : '') + t.slice(0, 60000)) }

  function toggleDictation() {
    if (listening) { dict.current?.stop(); return }
    setError(null)
    if (!isOnline()) { if (pendingAudio) return setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); setRecOpen(true); void rec.start(); return }
    const d = startDictation(
      (t) => setNoteText((x) => (x ? x + ' ' : '') + t),
      (err) => {
        setListening(false)
        if (err === 'not-allowed' || err === 'service-not-allowed') setError("Le micro est bloqué. Autorise-le dans les réglages du navigateur, puis réessaie.")
        else if (err === 'network') setError('La dictée a besoin du réseau sur ce téléphone. Écris ta note à la main, ou réessaie quand le réseau revient.')
      }
    )
    if (!d) return setError("La dictée n'est pas disponible sur ce navigateur. Essaie avec Chrome.")
    dict.current = d
    setListening(true)
  }

  async function transcribeFile(f: File, kind: 'audio' | 'video') {
    if (f.size > MAX_MEDIA_MB * 1024 * 1024) return setError(`Ce fichier est trop lourd (${MAX_MEDIA_MB} Mo maximum). ${kind === 'video' ? 'Essaie une vidéo plus courte.' : 'Coupe-le en plusieurs parties.'}`)
    // Sans réseau : l'enregistrement (ou le fichier) est gardé et sera transcrit tout seul au retour du réseau.
    if (!isOnline()) { if (pendingAudio) { setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); return } setPendingAudio(f); setError(null); return }
    setPendingAudio(null)
    setNoteStep('Transcription en cours… cela peut prendre une minute.')
    const text = await run(() => transcribeAudio(f))
    setNoteStep('')
    if (text === undefined) { setPendingAudio(f); return }
    appendText(text)
    setNoteTitle((t) => t.trim() ? t : f.name.replace(/\.[^.]+$/, '').slice(0, 80))
  }

  async function pickPdf(f: File | undefined) {
    if (!f) return
    if (f.size > 15 * 1024 * 1024) return setError('Ce PDF est trop lourd (15 Mo maximum).')
    setNoteStep('Lecture du PDF…')
    const text = await run(() => extractPdfText(f))
    setNoteStep('')
    if (text === undefined) return
    if (text.length < 20) return setError("Ce PDF ne contient pas de texte lisible (il est peut-être scanné). Essaie un autre PDF ou colle le texte.")
    appendText(text)
    setNoteTitle((t) => t.trim() ? t : f.name.replace(/\.pdf$/i, '').slice(0, 80))
  }

  async function pickPhoto(f: File | undefined) {
    if (!f) return
    if (!isOnline()) return setError('La lecture d’une photo a besoin du réseau. Réessaie quand il revient.')
    const text = await run(() => readPhotoText(f, setNoteStep))
    setNoteStep('')
    if (text === undefined) return
    if (text.length < 15) return setError("Je n'arrive pas à lire de texte sur cette photo. Prends-la bien droite, avec de la lumière, ou choisis un texte imprimé.")
    appendText(text)
  }

  /* Feuille « Comment veux-tu ajouter ta note ? » : on choisit, puis « Continuer » ouvre l'écran d'écriture. */
  function openSheet() {
    setError(null)
    setListenOpen(false)
    setSheet(true)
  }
  function continueFromSheet() {
    setSheet(false)
    setEditing(true)
    setError(null)
    if (noteSource === 'pdf') pdfRef.current?.click()
    else if (noteSource === 'photo') photoRef.current?.click()
    else if (noteSource === 'audio') audioRef.current?.click()
    else if (noteSource === 'video') videoRef.current?.click()
    else if (noteSource === 'voix') toggleDictation()
    else if (noteSource === 'enreg') { if (!isOnline() && pendingAudio) { setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); return } setRecOpen(true); void rec.start() }
  }
  function resetNote() {
    dict.current?.stop()
    setNoteTitle(''); setNoteText(''); setNoteGuide(''); setNoteSource('texte'); setNoteStep(''); setError(null)
    setModify(false); setMainId(null); setDraftId(null); setPendingAudio(null)
    setEditing(false)
  }
  function closeEditor() {
    if ((noteText.trim() || noteGuide.trim() || noteTitle.trim()) && !window.confirm('Fermer sans enregistrer ? Ce que tu as écrit sera perdu. (Touche « Brouillon » pour le garder 72 h.)')) return
    resetNote()
  }

  /** « Brouillon » : garde la note (ou la modification du cours) sur le téléphone pendant 72 h. Le cours n'est pas touché. */
  async function keepDraft(force = false) {
    if (!user) return
    if (!noteTitle.trim() && !noteText.trim() && !noteGuide.trim() && !pendingAudio) return setError('Écris quelque chose avant de le garder en brouillon.')
    dict.current?.stop()
    if (!force && !modify && !isOnline() && (noteText.trim() || pendingAudio)) return setOfflineSheet(true)
    const d = await run(() => saveDraft({ id: draftId, userId: user.id, kind: modify ? 'edit' : 'note', courseId: id, noteId: modify ? mainId : null, title: noteTitle, body: noteText, guide: noteGuide, source: noteSource, audio: pendingAudio }))
    if (d) resetNote()
  }

  async function trashCourse() {
    if (!window.confirm(`Supprimer « ${course.data?.title ?? 'ce cours'} » ? Tu pourras le restaurer pendant ${TRASH_DAYS} jours depuis la corbeille du sac à dos.`)) return
    const ok = await run(async () => { await setCourseTrashed(id, true); return true })
    if (ok) nav('/sac')
  }

  function togglePanel() {
    if (reading) { stopSpeaking(); return }
    if (!listenOpen) { setPicked((notes.data ?? []).map((n) => n.id)) }
    setListenOpen((v) => !v)
  }
  function togglePick(nid: string) {
    setPicked((p) => (p.includes(nid) ? p.filter((x) => x !== nid) : [...p, nid]))
  }
  async function listenChosen(summarize: boolean) {
    const chosen = (notes.data ?? []).filter((n) => picked.includes(n.id))
    if (!chosen.length) return setError('Choisis au moins une note à écouter.')
    const full = chosen.map((n) => n.title + '. ' + n.content).join('\n')
    let text = (course.data?.title ?? '') + '. ' + full
    setSummary(null)
    if (summarize) {
      const r = await run(() => askAI({ task: 'summary', prompt: full.slice(0, 60000) }))
      if (!r) return
      text = stripAiNoise(r.reply)
      setSummary(text)
      setSummaryOpen(true)
      setSummaryScope(chosen.map((n) => n.title).join(', '))
    }
    const ok = speak(text, undefined, { label: 'Lecture en cours', sub: (summarize ? 'Résumé · ' : '') + (course.data?.title ?? '') })
    if (!ok) return setError("La lecture à voix haute n'est pas disponible sur ce navigateur.")
    setListenOpen(false)
  }

  /** « Modifier » : rouvre le cours dans l'écran d'écriture (titre et texte) avant de générer le PDF. */
  function openModify() {
    const main = (notes.data ?? [])[0]
    setNoteTitle(course.data?.title ?? '')
    setNoteText(main?.content ?? '')
    setNoteGuide('')
    setNoteSource('texte')
    setMainId(main?.id ?? null)
    setModify(true)
    setError(null)
    setEditing(true)
  }

  async function save() {
    if (!user) return
    dict.current?.stop()
    const src = noteSource === 'enreg' ? 'audio' : noteSource === 'video' ? 'audio' : noteSource === 'voix' ? 'voix' : noteSource
    const base = noteText.trim()
    const guide = noteGuide.trim()
    if (!base && !guide && !pendingAudio) return setError("Écris ta note, ou donne des consignes à l'IA pour qu'elle la rédige.")
    if (!isOnline()) {
      // Sans réseau : ajout à ce cours, ou à un autre, ou nouveau cours ; envoyé automatiquement plus tard. Les modifications d'un cours existant restent réservées au réseau.
      if (modify || (!base && !pendingAudio)) return setError(OFFLINE_MSG)
      return setOfflineSheet(true)
    }
    if (pendingAudio) return setError("Ton enregistrement n'est pas encore transcrit. Attends la fin de la transcription, ou garde-le en brouillon.")
    let content = base
    if (guide) {
      const r = await run(() => askAI({ task: 'enrich_note', courseId: id, web: WEB_SEARCH_ENABLED && noteWeb, prompt: `Consignes de l'étudiant : ${guide}\n\nTexte déjà écrit par l'étudiant :\n${base || '(aucun)'}` }))
      if (!r) return
      const extra = stripAiNoise(r.reply).trim()
      content = base ? `${base}\n\nComplément de Memo :\n${extra}` : extra
    }
    const title = noteTitle.trim() || (guide ? guide.slice(0, 50) : '')
    const ok = await run(async () => {
      if (modify) {
        if (!title) throw new Error('Donne un nom à ton cours.')
        await renameCourse(id, title)
        if (mainId) await updateNote(mainId, title, content)
        else await addNote(user.id, id, title, content, 'texte')
      } else {
        await addNote(user.id, id, title, content, src)
      }
      return true
    })
    if (ok) {
      if (draftId) { await deleteDraft(draftId).catch(() => {}); setPdfPrompt(true) }
      resetNote()
      notes.reload()
      course.reload()
    }
  }

  /** Champs du profil pour la page de garde + état Premium (revérifié au moment de fabriquer le PDF). */
  async function coverOpts() {
    return {
      premium: await isPremiumNow(user?.id),
      university: profile?.university, faculty: profile?.faculty, department: profile?.department, promotion: profile?.promotion
    }
  }

  async function pdf(mode: 'read' | 'save') {
    if (!course.data || !notes.data?.length) return
    // La fenêtre de lecture s'ouvre tout de suite (sinon le téléphone la bloque), puis reçoit le PDF.
    const w = mode === 'read' ? window.open('', '_blank') : null
    const blob = await run(async () => buildCoursePdf(course.data!.title, profileName, notes.data as Note[], 'NOTES DE COURS', await coverOpts()))
    if (!blob) { w?.close(); return }
    if (w) {
      const url = URL.createObjectURL(blob)
      w.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } else saveBlob(course.data.title, blob)
  }

  async function downloadSummary() {
    if (!course.data || !summary) return
    const scope = summaryScope ? `Portée du résumé : ${summaryScope}.\n\n` : ''
    const note: Note = { id: 'resume', course_id: id, title: 'Résumé', content: scope + summary, source: 'ia', created_at: new Date().toISOString() }
    const blob = await run(async () => buildCoursePdf(`Résumé — ${course.data!.title}`, profileName, [note], 'RÉSUMÉ', await coverOpts()))
    if (blob) saveBlob(`Résumé ${course.data.title}`, blob)
  }

  async function revise() {
    if (!notes.data?.length) return setError("Ajoute d'abord une note pour pouvoir réviser.")
    const r = await run(() => askAI({ task: 'quiz', courseId: id, prompt: QUIZ_PROMPT }))
    if (r) { const qs = parseQuiz(r.reply); setQuiz({ qs, raw: r.reply, n: 1, seen: qs.map((x) => x.q) }) }
  }
  /** Quiz suivant : de nouvelles questions, différentes de celles déjà posées. */
  async function nextQuiz() {
    if (!quiz || quizLoading) return
    setQuizError(null)
    setQuizLoading(true)
    const avoid = quiz.seen.slice(-30).map((q) => `- ${q}`).join('\n')
    const prompt = QUIZ_PROMPT + `\n\nIMPORTANT : ces questions ont déjà été posées, ne les repose pas et ne les reformule pas :\n${avoid}\nPose 5 NOUVELLES questions, sur d'autres parties du cours.`
    try {
      const r = await askAI({ task: 'quiz', courseId: id, prompt })
      const qs = parseQuiz(r.reply)
      if (!qs.length) setQuizError("Je n'ai pas réussi à préparer de nouvelles questions. Réessaie.")
      else setQuiz({ qs, raw: r.reply, n: quiz.n + 1, seen: [...quiz.seen, ...qs.map((x) => x.q)] })
    } catch (e) {
      setQuizError(e instanceof Error ? e.message : 'Impossible de préparer le quiz suivant.')
    } finally {
      setQuizLoading(false)
    }
  }

  if (!course.data) return <main className="page"><BackLink to="/sac" title="Cours introuvable" /><Empty title="Ce cours n'existe pas" text="Il a peut-être été supprimé." /></main>

  const all = notes.data ?? []
  const today = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <main className="page">
      <PageHead to="/sac" title={course.data.title} />

      {pdfPrompt && (
        <PillButton size="lg" onClick={() => { setPdfPrompt(false); void pdf('save') }} disabled={busy || !all.length}>
          <Icon name="download" size={22} />Télécharger le PDF
        </PillButton>
      )}

      <PillButton size="lg" onClick={openSheet}><Icon name="plus" size={22} stroke={2.4} />Ajouter une note</PillButton>

      {!online && <span className="muted" role="status" style={{ padding: '0 4px' }}>Sans connexion : tu peux lire ton cours (« Lire le PDF ») et l’écouter tel quel. Résumé, révision, TP et téléchargement reviennent avec le réseau.</span>}

      <RowGroup label="Outils">
        <Row icon="pencil" title="Modifier" sub="Revoir ton cours avant le PDF" onClick={openModify} disabled={busy} />
        <Row icon="quiz" title={busy && !editing ? 'Un instant…' : 'Réviser'} sub={online ? 'Un quiz sur tes notes' : 'Besoin du réseau'} onClick={() => void revise()} disabled={busy || !online} />
        {canSpeak() && <Row icon="headphones" title={reading ? 'Arrêter la lecture' : 'Écouter'} sub="Lecture à voix haute" onClick={togglePanel} disabled={!all.length} />}
        <Row icon="pdf" title="Lire le PDF" sub="Ouvrir ton cours" onClick={() => void pdf('read')} disabled={!all.length || busy} />
        <Row icon="download" title="Télécharger" sub={online ? 'Enregistrer en PDF' : 'Besoin du réseau'} onClick={() => void pdf('save')} disabled={!all.length || busy || !online} />
        {online
          ? <Row icon="book" title="Assistant TP" sub="Plan et rédaction" to={`/tp/${id}`} />
          : <Row icon="book" title="Assistant TP" sub="Besoin du réseau" onClick={() => setError(OFFLINE_MSG)} disabled />}
      </RowGroup>

      <ErrorBox message={editing || listenOpen ? null : error} />

      {summary && !summaryOpen && (
        <RowGroup label="Résumé">
          <Row icon="text" title="Voir le résumé" sub={summaryScope || 'Notes choisies'} onClick={() => setSummaryOpen(true)} />
        </RowGroup>
      )}

      {user && course.data && (
        <OfflineSaveSheet
          open={offlineSheet} onClose={() => setOfflineSheet(false)} userId={user.id}
          title={noteTitle} content={noteText} audio={pendingAudio} currentCourse={{ id, title: course.data.title }}
          source={noteSource === 'enreg' || noteSource === 'video' ? 'audio' : noteSource}
          onDraftOnly={() => { setOfflineSheet(false); void keepDraft(true) }}
          onQueued={() => { if (draftId) void deleteDraft(draftId).catch(() => {}); setOfflineSheet(false); resetNote() }}
        />
      )}
      <DraftsSection label="Brouillons" drafts={drafts.filter((d) => d.courseId === id)} now={now} onDelete={(d) => void deleteDraft(d.id).then(reloadDrafts)} />

      <button type="button" className="pill-btn outline" style={{ marginTop: 16, color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => void trashCourse()} disabled={busy}><Icon name="trash" size={20} />Supprimer ce cours</button>

      {/* Sélecteurs de fichiers : toujours présents, ouverts par « Continuer » ou par les boutons de l'éditeur. */}
      <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { void pickPdf(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={audioRef} type="file" accept="audio/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'audio'); e.target.value = '' }} />
      <input ref={videoRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void transcribeFile(f, 'video'); e.target.value = '' }} />

      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Comment veux-tu ajouter ta note ?">
        <div className="src-grid">
          {NOTE_SOURCES.map((o) => (
            <button key={o.id} type="button" className="src-tile" aria-pressed={noteSource === o.id} onClick={() => { setNoteSource(o.id); setError(null) }}>
              <Icon name={o.icon} size={24} />
              {o.label}
            </button>
          ))}
        </div>
        <PillButton onClick={continueFromSheet}>Continuer</PillButton>
      </BottomSheet>

      {editing && (
        <EditorScreen
          backLabel={course.data.title}
          onBack={closeEditor}
          status={modify ? 'Modification' : 'Nouvelle note'}
          doneLabel={busy ? 'Un instant…' : draftId && online ? 'Générer le PDF' : 'Terminé'}
          onDone={() => void save()}
          doneDisabled={busy || rec.state !== 'idle'}
          onDraft={() => void keepDraft()}
          draftDisabled={busy}
          title={noteTitle}
          onTitle={setNoteTitle}
          titlePlaceholder={modify ? 'Titre du cours' : 'Titre de la note'}
          dateText={today}
          body={noteText}
          onBody={setNoteText}
          bodyPlaceholder={modify ? 'Le texte de ton cours' : 'Écris ta note ici…'}
          hint={!online ? 'Sans connexion : tu peux écrire, dicter ou enregistrer ta voix (la dictée devient un enregistrement, transcrit automatiquement quand tu auras du réseau). Touche « Brouillon » pour le ranger dans un cours ou le garder 72 h.' : undefined}
          banner={<>{pendingAudio && <PendingAudioChip file={pendingAudio} onRemove={() => setPendingAudio(null)} />}{noteStep && <span className="muted" role="status">{noteStep}</span>}<ErrorBox message={error} /></>}
          guide={noteGuide}
          onGuide={setNoteGuide}
          guideHelp="Tu n’as pas de notes ? Écris seulement les consignes : l’IA rédige la note avec ses connaissances (4 à 20 points selon la longueur). Elle s’en sert quand tu touches « Terminé »."
          guideExtra={
            <div className="ed-tools-row">
              <DictateButton onText={(t) => setNoteGuide((b) => (b ? b + ' ' : '') + t)} label="Dicter les consignes" />
              {WEB_SEARCH_ENABLED && <WebToggle on={noteWeb} set={setNoteWeb} />}
            </div>
          }
          bar={<EditorBar onPhoto={() => photoRef.current?.click()} onDictate={toggleDictation} dictating={listening} onRecord={() => { if (!isOnline() && pendingAudio) return setError("Un enregistrement est déjà gardé sur ce téléphone. Range-le d'abord avec « Brouillon » (ou retire-le), puis fais-en un autre."); setRecOpen(true); void rec.start() }} recordDisabled={!!noteStep} onPlus={() => setDocSheet(true)} />}
        />
      )}

      <BottomSheet open={listenOpen && !reading} onClose={() => setListenOpen(false)} title="Que veux-tu écouter ?">
        {all.length > 3 && (
          <button type="button" className="link" style={{ alignSelf: 'flex-end', textDecoration: 'none', minHeight: 36 }} onClick={() => setPicked(picked.length === all.length ? [] : all.map((n) => n.id))}>
            {picked.length === all.length ? 'Tout décocher' : 'Tout cocher'}
          </button>
        )}
        <div className="chk-list">
          {all.map((n) => {
            const on = picked.includes(n.id)
            return (
              <button key={n.id} type="button" className="chk-row" onClick={() => togglePick(n.id)} aria-pressed={on}>
                <span className={'chk' + (on ? ' on' : '')}>{on && <Icon name="check" size={16} stroke={3} />}</span>
                <span className="grow">{n.title}</span>
              </button>
            )
          })}
        </div>
        <ErrorBox message={error} />
        <div style={{ display: 'flex', gap: 10 }}>
          <PillButton variant="outline" onClick={() => void listenChosen(false)} disabled={busy}>Lire tel quel</PillButton>
          <PillButton onClick={() => void listenChosen(true)} disabled={busy || !online}>{busy ? 'Un instant…' : online ? 'Résumé puis lecture' : 'Résumé : réseau requis'}</PillButton>
        </div>
      </BottomSheet>

      {quiz && <QuizScreen key={quiz.n} qs={quiz.qs} raw={quiz.raw} onClose={() => { setQuiz(null); setQuizError(null) }} onNext={() => void nextQuiz()} loading={quizLoading} loadError={quizError} />}

      {summary && summaryOpen && (
        <div className="screen-full" role="dialog" aria-modal="true" aria-label="Résumé">
          <div className="sf-top">
            <button type="button" className="icon-btn round" onClick={() => setSummaryOpen(false)} aria-label="Fermer le résumé"><Icon name="close" /></button>
            <h1 className="h1" style={{ margin: 0, fontSize: 22 }}>Résumé</h1>
          </div>
          <div className="sf-main">
            <div>
              <div className="rg-label">Notes choisies</div>
              <span className="muted">{summaryScope}</span>
            </div>
            <div className="sum-text">{summary}</div>
            <ErrorBox message={error} />
          </div>
          <div className="sf-foot">
            {canSpeak() && (
              <PillButton onClick={() => { if (!speak(summary, undefined, { label: 'Lecture en cours', sub: 'Résumé · ' + (course.data?.title ?? '') })) setError("La lecture à voix haute n'est pas disponible sur ce navigateur.") }}>
                <Icon name="headphones" size={20} />Écouter le résumé
              </PillButton>
            )}
            <PillButton variant="outline" onClick={() => void downloadSummary()} disabled={busy || !online}><Icon name="download" size={20} />Télécharger le résumé (PDF)</PillButton>
          </div>
        </div>
      )}

      <AddDocSheet open={docSheet} onClose={() => setDocSheet(false)} maxMb={MAX_MEDIA_MB} onPdf={() => pdfRef.current?.click()} onAudio={() => audioRef.current?.click()} onVideo={() => videoRef.current?.click()} />
      <RecordingSheet open={recOpen} onClose={() => setRecOpen(false)} rec={rec} maxMb={MAX_MEDIA_MB} />
    </main>
  )
}

/* Assistant TP : énoncé → plan validé → document complet avec page de garde. */
interface Attach { id: string; name: string; text: string }
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function TpAssistant() {
  const { id = '' } = useParams()
  const { profile, user } = useAuth()
  const course = useLoad(() => getCourse(id), [id])
  const { busy: actionBusy, error, setError, run } = useAction()
  const isPrem = usePremium()
  const [tplPref, setTplPref] = usePref('tp-cover-template', 'classique')
  const wantedTpl = (COVER_ORDER as string[]).includes(tplPref) ? (tplPref as CoverTemplate) : 'classique'
  // Le modèle doré est réservé à Premium : sans abonnement on garde « classique » (le choix reste mémorisé).
  const tpl = effectiveTemplate(wantedTpl, isPrem)
  const look = COVER_TEMPLATES[tpl]
  const [supervisor, setSupervisor] = useState('')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [atts, setAtts] = useState<Attach[]>([])
  const [plan, setPlan] = useState<string | null>(null)
  // Session de TP payée une seule fois (10 points) : le serveur la crée au premier appel et la réutilise pour les ajustements et la rédaction.
  const tpSession = useRef<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [remAtts, setRemAtts] = useState<Attach[]>([])
  const [doc, setDoc] = useState<string | null>(null)
  const [sheetFor, setSheetFor] = useState<'brief' | 'remarks' | null>(null)
  const [target, setTarget] = useState<'brief' | 'remarks'>('brief')
  const [step, setStep] = useState('')
  // Nombre de pages de CONTENU voulu (la page de garde est comptée à part). Vide = longueur naturelle.
  const [pagesWanted, setPagesWanted] = useState('')
  const [notice, setNotice] = useState('')
  const lastTexts = useRef<Record<number, string>>({})
  const docTexts = useRef<Record<number, string>>({})
  // Logo envoyé par l'étudiant : valable pour CE travail seulement, gardé sur le téléphone (rien n'est envoyé au serveur).
  const [myLogo, setMyLogo] = useState<string | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const pdfRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)
  const year = (() => { const y = new Date().getFullYear(), m = new Date().getMonth(); return m >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}` })()
  const defaultLogo = logoUrlFor(profile?.university)
  const logoUrl = myLogo ?? defaultLogo

  // L'énoncé complet = texte écrit + texte lu dans les pièces jointes (limité pour rester sous la limite du serveur).
  const fullBrief = [brief.trim(), ...atts.map((a) => `[${a.name}]\n${a.text}`)].filter(Boolean).join('\n\n').slice(0, 4000)

  async function attach(f: File | undefined, where: 'brief' | 'remarks') {
    if (!f) return
    setError(null)
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    let text: string | undefined
    if (isPdf) {
      if (f.size > 15 * 1024 * 1024) return setError('Ce PDF est trop lourd (15 Mo maximum).')
      setStep('Lecture du PDF…')
      text = await run(() => extractPdfText(f))
    } else {
      setStep('Lecture de la photo…')
      text = await run(() => readPhotoText(f, setStep))
    }
    setStep('')
    if (text === undefined) return
    if (text.length < 10) return setError("Je n'ai pas pu lire de texte dans ce fichier. Essaie une photo plus nette ou un PDF non scanné.")
    const item: Attach = { id: String(Date.now()) + Math.random().toString(36).slice(2, 6), name: f.name || 'photo', text: text.slice(0, 3500) }
    if (where === 'brief') setAtts((x) => [...x, item]); else setRemAtts((x) => [...x, item])
  }

  function pickLogo(f: File | undefined) {
    if (!f) return
    if (!LOGO_TYPES.includes(f.type)) return setError('Le logo doit être une image PNG, JPG ou WEBP.')
    if (f.size > 2 * 1024 * 1024) return setError('Ce logo est trop lourd (2 Mo maximum).')
    const r = new FileReader()
    r.onload = () => setMyLogo(String(r.result))
    r.onerror = () => setError('Je ne peux pas lire ce logo. Essaie une autre image.')
    r.readAsDataURL(f)
  }

  async function makePlan() {
    if (!title.trim() || !fullBrief) return setError("Écris le titre et l'énoncé du TP.")
    const r = await run(() => askAI({ task: 'tp_plan', courseId: id, tpSession: tpSession.current, prompt: `Titre : ${title}\nConsignes : ${fullBrief}` }))
    if (r) { if (r.tpSession) tpSession.current = r.tpSession; const np = cleanTpText(r.reply); setPlan(np); setDoc(null); setTexts({}); persist(np, {}) }
  }
  async function adjustPlan() {
    if (!plan) return
    const extra = remAtts.map((a) => `[${a.name}]\n${a.text}`).join('\n\n')
    if (!remarks.trim() && !extra) return setError('Écris ce que tu veux changer dans le plan (ou dicte-le avec le micro).')
    const asked = `${remarks.trim()}${extra ? '\n\n' + extra : ''}`.slice(0, 2500)
    const r = await run(() => askAI({ task: 'tp_revise', courseId: id, tpSession: tpSession.current, prompt: `Titre : ${title}\nConsignes : ${fullBrief.slice(0, 2500)}\n\nPlan actuel :\n${plan}\n\nModifications demandées par l'étudiant : ${asked}` }))
    if (r) { if (r.tpSession) tpSession.current = r.tpSession; const np = cleanTpText(r.reply); setPlan(np); setTexts({}); setDoc(null); persist(np, {}); setRemarks(''); setRemAtts([]) }
  }
  async function downloadTp() {
    if (!doc || !profile) return
    setNotice('')
    // Abonnement relu au moment du PDF : la mention « Créé avec Memoa » dépend de cet état.
    const premiumNow = await isPremiumNow(user?.id)
    const cover = {
      university: profile.university, faculty: profile.faculty, department: profile.department,
      promotion: profile.promotion, vacation: profile.vacation || undefined, logoUrl,
      title, course: course.data?.title ?? '', student: profile.full_name, year,
      supervisor: supervisor.trim() || undefined, template: effectiveTemplate(wantedTpl, premiumNow), premium: premiumNow
    }
    const wanted = Math.max(1, Math.min(60, Math.round(Number(pagesWanted) || 0))) || null
    const out = await run(async () => {
      let text = doc
      let res = await buildTpPdfDetailed(cover, text, wanted)
      // Le nombre de pages est contrôlé sur le vrai PDF. Si la mise en page seule (dans les limites de lisibilité) ne suffit pas,
      // on demande à l'IA d'étoffer ou de condenser quelques parties précises (jamais de pages vides, jamais de suppression au hasard).
      for (let round = 0; wanted && !res.report.exact && round < 2 && plan && tpSession.current && Object.keys(docTexts.current).length; round++) {
        try {
          const next = await adjustLength({
            courseId: id, title, brief: fullBrief, plan, session: tpSession.current, texts: docTexts.current, gap: res.report.gap * 1.05,
            onProgress: (m) => setStep(m)
          })
          docTexts.current = next
          text = assemble(parsePlan(plan), next)
          res = await buildTpPdfDetailed(cover, text, wanted)
        } catch { break }
      }
      setStep('')
      if (text !== doc) setDoc(text)
      return res
    })
    if (!out) return
    saveBlob(title || 'TP', out.blob)
    const r = out.report
    if (wanted && !r.exact) {
      setNotice(r.status === 'too_short'
        ? `Le PDF compte ${r.contentPages} pages de contenu au lieu de ${wanted}. Le sujet est trop court pour ${wanted} pages sans remplissage : demande des parties en plus dans « Ajuster le plan », puis relance la rédaction.`
        : `Le PDF compte ${r.contentPages} pages de contenu au lieu de ${wanted}. Le texte est trop long pour ${wanted} pages lisibles : retire des parties dans « Ajuster le plan », ou choisis ${r.contentPages} pages.`)
    }
  }
  // Rédaction partie par partie : chaque partie du plan est écrite dans son propre appel, puis le serveur de l'appli vérifie que rien ne manque.
  // Le travail déjà fait est gardé sur le téléphone (24 h) : après une coupure réseau, « Reprendre la rédaction » ne refait que les parties manquantes.
  const [texts, setTexts] = useState<Record<number, string>>({})
  const planParts = plan ? parsePlan(plan) : []
  const doneCount = planParts.filter((p) => partIsComplete(p, texts[p.n], true)).length
  // La rédaction tourne dans un module à part (lib/tpjob) : elle continue si on change de page dans l'appli.
  const job = useTpJob(id)
  const writing = !!job?.running
  const busy = actionBusy || writing
  const stepText = writing ? job?.step ?? '' : step
  useEffect(() => {
    const p = loadProgress(id)
    if (p && p.plan) { setTitle(p.title); setBrief(p.brief); setPlan(p.plan); setTexts(job?.texts && Object.keys(job.texts).length ? job.texts : (p.texts ?? {})); tpSession.current = p.session }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  // L'avancement en direct (si on revient sur la page pendant la rédaction).
  useEffect(() => { if (job?.running || (job && Object.keys(job.texts).length)) setTexts({ ...job.texts }) }, [job?.texts, job?.running])
  // Rédaction terminée (même si on était parti ailleurs) : on récupère le TP.
  useEffect(() => {
    if (job?.result == null) return
    const r = takeTpResult(id)
    if (r) { setDoc(cleanTpText(r.text)); docTexts.current = { ...r.texts }; setTexts({}) }
  }, [job?.result, id])
  useEffect(() => { if (job?.error && !job.running) { setError(job.error); dismissTpError(id) } }, [job?.error, job?.running, id])
  function persist(nextPlan: string | null, t: Record<number, string>) {
    if (nextPlan) saveProgress({ courseId: id, title, brief: fullBrief, plan: nextPlan, session: tpSession.current, texts: t, at: Date.now() })
  }
  async function write() {
    if (!plan || writing) return // protège contre les doubles appuis
    if (!tpSession.current) return setError('Cette session de TP a expiré. Relance « Proposer un plan ».')
    setError(null)
    lastTexts.current = { ...texts }
    const planNow = plan
    startTpJob({
      courseId: id, title, brief: fullBrief, plan: planNow, session: tpSession.current as string, texts,
      onSave: (t) => { lastTexts.current = { ...t }; saveProgress({ courseId: id, title, brief: fullBrief, plan: planNow, session: tpSession.current, texts: t, at: Date.now() }) }
    })
  }

  const LogoCheck = () => (
    logoUrl ? (
      <div className="logo-row">
        <span className="th"><img src={logoUrl} alt="" /></span>
        <span className="tx">
          <b>{myLogo ? 'Ton logo' : 'Logo de la page de garde'}</b>
          <span>{myLogo ? 'Utilisé pour ce travail' : `${profile?.university ? universityLabel(profile.university) : ''} · Ce n’est pas le bon ?`}</span>
        </span>
        {myLogo
          ? <PillButton variant="outline" size="sm" onClick={() => setMyLogo(null)}>Retirer</PillButton>
          : <PillButton variant="outline" size="sm" onClick={() => logoRef.current?.click()}>Ajouter le mien</PillButton>}
      </div>
    ) : (
      <div className="logo-row none">
        <span className="tx">
          <b>Aucun logo trouvé</b>
          <span>Ajoute celui de ton université pour une page de garde complète.</span>
        </span>
        <PillButton size="sm" onClick={() => logoRef.current?.click()}>Ajouter</PillButton>
      </div>
    )
  )

  const chips = (list: Attach[], remove: (aid: string) => void) => list.length > 0 && (
    <div className="tp-att">
      {list.map((a) => (
        <span key={a.id} className="attach-chip"><Icon name={/\.pdf$/i.test(a.name) ? 'pdf' : 'photo'} size={16} /><span>{a.name}</span>
          <button type="button" className="link" style={{ textDecoration: 'none' }} onClick={() => remove(a.id)} aria-label={`Retirer ${a.name}`}><Icon name="close" size={16} /></button>
        </span>
      ))}
    </div>
  )

  return (
    <main className="page">
      <div className="no-print"><PageHead to={`/sac/${id}`} title="Assistant TP" /></div>
      <p className="lead no-print" style={{ margin: 0 }}>Cours : <strong>{course.data?.title ?? '…'}</strong></p>

      {/* Sélecteurs de fichiers : toujours présents, ouverts directement par un appui. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void attach(e.target.files?.[0], target); e.target.value = '' }} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={(e) => { void attach(e.target.files?.[0], target); e.target.value = '' }} />
      <input ref={pdfRef} type="file" accept="application/pdf" hidden onChange={(e) => { void attach(e.target.files?.[0], target); e.target.value = '' }} />
      <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = '' }} />

      <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <PillInput id="tpt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du travail" aria-label="Titre du travail" maxLength={120} />
        <div className="tp-box">
          <textarea value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Énoncé et consignes" aria-label="Énoncé et consignes" />
          {chips(atts, (aid) => setAtts((x) => x.filter((a) => a.id !== aid)))}
          <div className="tp-tools">
            <button type="button" className="round-plus" onClick={() => { setTarget('brief'); setSheetFor('brief') }} aria-label="Ajouter à tes consignes"><Icon name="plus" size={24} stroke={2.4} /></button>
            <DictateButton onText={(t) => setBrief((b) => (b ? b + ' ' : '') + t)} label="Dicter" />
          </div>
        </div>
        {stepText && <span className="muted" role="status">{stepText}</span>}
        <ErrorBox message={error} />
        {!plan && <LogoCheck />}
        {!plan && <PillButton size="lg" onClick={makePlan} disabled={busy}>{busy ? 'Un instant…' : 'Proposer un plan'}</PillButton>}
      </div>

      {plan && (
        <div className="no-print" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div className="rg-label">Plan proposé</div>
            <div className="plan-box">{plan}</div>
          </div>
          <div>
            <div className="rg-label">Un changement à demander ?</div>
            <div className="tp-box">
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Ex. Ajoute une partie sur les exemples, enlève la 3e partie…" aria-label="Changement à demander" style={{ minHeight: 70 }} />
              {chips(remAtts, (aid) => setRemAtts((x) => x.filter((a) => a.id !== aid)))}
              <div className="tp-tools">
                <button type="button" className="round-plus" onClick={() => { setTarget('remarks'); setSheetFor('remarks') }} aria-label="Ajouter une pièce jointe"><Icon name="plus" size={24} stroke={2.4} /></button>
                <DictateButton onText={(t) => setRemarks((b) => (b ? b + ' ' : '') + t)} label="Dicter" />
              </div>
            </div>
          </div>
          <div>
            <div className="rg-label">Nombre de pages du travail (sans la page de garde)</div>
            <input className="pages-input" type="number" inputMode="numeric" min={1} max={60} value={pagesWanted} onChange={(e) => setPagesWanted(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="Laisse vide : longueur naturelle" aria-label="Nombre de pages du travail" />
            <small style={{ opacity: 0.75 }}>Ex. 9 donne un PDF de 10 pages avec la page de garde.</small>
          </div>
          <LogoCheck />
          <PillButton variant="outline" onClick={adjustPlan} disabled={busy}>{busy ? 'Un instant…' : 'Ajuster le plan'}</PillButton>
          <PillButton size="lg" onClick={write} disabled={busy}>{busy ? 'Rédaction en cours…' : doneCount > 0 ? `Reprendre la rédaction (${doneCount}/${planParts.length})` : 'Valider et rédiger le TP'}</PillButton>
        </div>
      )}

      {doc && (
        <>
          <div className="tpl-picker no-print">
            <div className="rg-label">Style de la page de garde</div>
            <div className="tpl-row" role="radiogroup" aria-label="Style de la page de garde">
              {COVER_ORDER.map((k) => {
                const t = COVER_TEMPLATES[k]
                const locked = k === 'premium' && !isPrem
                return (
                  <button key={k} type="button" role="radio" aria-checked={tpl === k} className={`tpl-chip${tpl === k ? ' on' : ''}`}
                    onClick={() => { if (locked) { setNotice('Le style Premium doré est réservé aux abonnés Premium.'); return } setNotice(''); setTplPref(k) }}>
                    <span className="sw" style={{ borderColor: `rgb(${t.main.join(',')})`, background: `rgb(${t.accent.join(',')})` }} />
                    {t.label}{locked ? ' 🔒' : ''}
                  </button>
                )
              })}
            </div>
            {!isPrem && <small style={{ opacity: 0.75 }}>Style doré : <Link to="/premium">avec Premium</Link>.</small>}
          </div>
          <PillInput id="tpsup" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} placeholder="Encadrant (facultatif)" aria-label="Encadrant" maxLength={80} />
          <div className={`cover cv-${look.frame}${look.band === 'filled' ? ' cv-filled' : ''}`} style={{ '--cv-main': `rgb(${look.main.join(',')})`, '--cv-acc': `rgb(${look.accent.join(',')})` } as CSSProperties}>
            <small>République démocratique du Congo</small>
            {profile?.university && <span className="t" style={{ fontSize: 16, color: 'var(--cv-main)' }}>{universityLabel(profile.university)}</span>}
            {logoUrl && <img src={logoUrl} alt="" style={{ height: 72, maxWidth: 140, objectFit: 'contain', margin: '6px 0' }} />}
            {profile?.faculty && <span className="s" style={{ color: 'var(--cv-acc)', fontWeight: 700 }}>{profile.faculty}</span>}
            {profile?.department && <span className="dept">Département : {profile.department}</span>}
            <div className="band">
              {splitTpTitle(title).kind && <small>{splitTpTitle(title).kind}</small>}
              <span className="t">{splitTpTitle(title).title}</span>
            </div>
            {course.data?.title && <span className="s">Cours : {course.data.title}</span>}
            {profile?.full_name && <span className="s">Présenté par : {profile.full_name}</span>}
            {supervisor.trim() && <span className="s">Encadrant : {supervisor.trim()}</span>}
            <span className="s">Année académique {year}</span>
            {!isPrem && <span className="made">Créé avec Memoa</span>}
          </div>
          <div className="doc-out tp-preview">{doc.slice(0, 1500)}{doc.length > 1500 ? '…' : ''}</div>
          <div className="warn-braise no-print">Relis et vérifie le document avant de le remettre. Les sources citées doivent être contrôlées.</div>
          {busy && stepText && <span className="muted" role="status">{stepText}</span>}
          {notice && <div className="warn-braise no-print">{notice}</div>}
          <PillButton size="lg" disabled={busy} onClick={downloadTp}>{busy ? 'Un instant…' : 'Télécharger le PDF du TP'}</PillButton>
        </>
      )}

      <BottomSheet open={sheetFor !== null} onClose={() => setSheetFor(null)} title="Ajouter à tes consignes">
        <RowGroup>
          <Row icon="photo" title="Prendre une photo" sub="L’énoncé écrit au tableau ou sur papier" onClick={() => { setSheetFor(null); cameraRef.current?.click() }} />
          <Row icon="photo" title="Choisir une image" sub="Depuis ta galerie" onClick={() => { setSheetFor(null); galleryRef.current?.click() }} />
          <Row icon="pdf" title="Document PDF" sub="L’énoncé ou des consignes du professeur" onClick={() => { setSheetFor(null); pdfRef.current?.click() }} />
          <Row icon="book" title="Logo de mon université" sub="S’il est faux ou manquant sur la page de garde" onClick={() => { setSheetFor(null); logoRef.current?.click() }} />
        </RowGroup>
      </BottomSheet>
    </main>
  )
}
