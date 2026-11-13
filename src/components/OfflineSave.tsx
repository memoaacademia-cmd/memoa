import { useEffect, useRef, useState } from 'react'
import { BottomSheet, ErrorBox, Icon, PillButton, PillInput, Row, RowGroup } from './ui'
import { useAuth } from '../lib/auth'
import { enqueueNote, offlineCourses, pendingCount, syncOutboxLocked, type CachedCourse, type OutboxItem } from '../lib/outbox'

/** Proposé quand l'étudiant appuie sur « Créer » SANS réseau : (a) nouveau cours à partir de la note, (b) ajout à un cours existant. Les deux marchent hors connexion. */
export function OfflineSaveSheet({ open, onClose, userId, title, content, source, audio, currentCourse, onQueued, onDraftOnly }: {
  open: boolean; onClose: () => void; userId: string; title: string; content: string; source: string
  /** Enregistrement vocal pas encore transcrit. */
  audio?: File | null
  /** Écran d'un cours : ce cours est proposé en premier. */
  currentCourse?: { id: string; title: string }
  onQueued: (item: OutboxItem) => void
  /** Garder seulement en brouillon de 72 h (comportement habituel, sans choix de cours). */
  onDraftOnly?: () => void
}) {
  const [mode, setMode] = useState<'choose' | 'new' | 'existing'>('choose')
  const [name, setName] = useState('')
  const [courses, setCourses] = useState<CachedCourse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lock = useRef(false) // un seul envoi à la fois, même avec plusieurs appuis rapides

  useEffect(() => {
    if (!open) return
    setMode('choose'); setName(title.trim()); setError(null); lock.current = false; setBusy(false)
    void offlineCourses(userId).then((l) => setCourses(currentCourse ? [currentCourse, ...l.filter((c) => c.id !== currentCourse.id)] : l))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function queue(kind: 'new_course' | 'add_note', course?: CachedCourse) {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(null)
    try {
      const item = await enqueueNote({ userId, kind, courseId: course?.id, courseTitle: kind === 'new_course' ? name : (course?.title ?? ''), title, content, source, audio })
      onQueued(item) // le parent ferme l'écran ; on laisse le verrou en place
    } catch (e) {
      lock.current = false; setBusy(false)
      setError(e instanceof Error ? e.message : 'Impossible de garder la note.')
    }
  }

  return (
    <BottomSheet open={open} onClose={() => { if (!busy) onClose() }} title="Que faire de cette note ?">
      <p className="muted" style={{ margin: '0 0 12px' }}>Tu n’as pas de réseau. Ta note est gardée sur ton téléphone et envoyée toute seule dès que le réseau revient.{audio ? ' Ton enregistrement sera transcrit à ce moment-là (3 points).' : ''}</p>
      <ErrorBox message={error} />
      {mode === 'choose' && (
        <RowGroup>
          <Row icon="plus" title="Créer un nouveau cours à partir de la note" sub="La note devient le premier contenu du cours" onClick={() => setMode('new')} />
          <Row icon="book" title="Ajouter à un cours existant" sub={courses.length ? 'Choisis le cours dans ta liste' : 'Aucun cours enregistré sur ce téléphone'} onClick={() => setMode('existing')} />
          {onDraftOnly && <Row icon="text" title="Garder en brouillon seulement" sub="Brouillon de 72 h, tu choisiras plus tard" onClick={onDraftOnly} />}
        </RowGroup>
      )}
      {mode === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <PillInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du cours" aria-label="Nom du cours" maxLength={80} />
          <PillButton size="lg" disabled={busy || !name.trim()} onClick={() => void queue('new_course')}>{busy ? 'Un instant…' : 'Créer le cours'}</PillButton>
          <PillButton variant="outline" disabled={busy} onClick={() => setMode('choose')}>Retour</PillButton>
        </div>
      )}
      {mode === 'existing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '55vh', overflowY: 'auto' }}>
          {courses.length === 0 && <span className="muted">Ta liste de cours s’enregistre sur le téléphone quand tu ouvres l’appli avec du réseau. Crée un nouveau cours pour cette fois.</span>}
          <RowGroup>
            {courses.map((c) => <Row key={c.id} icon="book" title={c.title} onClick={() => void queue('add_note', c)} disabled={busy} />)}
          </RowGroup>
          <PillButton variant="outline" disabled={busy} onClick={() => setMode('choose')}>Retour</PillButton>
        </div>
      )}
    </BottomSheet>
  )
}

/** Envoie les notes en attente au retour du réseau (et à l'ouverture de l'appli), et affiche leur état. À placer une fois, dans l'écran connecté. */
export function OutboxSync() {
  const { user } = useAuth()
  const uid = user?.id
  const [left, setLeft] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    let alive = true
    const refresh = async () => { const n = await pendingCount(uid); if (alive) setLeft(n) }
    const go = async () => {
      const r = await syncOutboxLocked(uid).catch(() => null)
      if (!alive) return
      if (r) {
        const parts: string[] = []
        if (r.sent > 0) parts.push(r.sent === 1 ? 'Ta note créée sans réseau a été envoyée.' : `${r.sent} notes créées sans réseau ont été envoyées.`)
        parts.push(...r.notices)
        if (parts.length) { setMsg(parts.join(' ')); window.dispatchEvent(new Event('memoa-drafts')) }
      }
      void refresh()
    }
    void refresh(); void go()
    const onChange = () => void refresh()
    window.addEventListener('online', go)
    window.addEventListener('memoa-outbox', onChange)
    const vis = () => { if (document.visibilityState === 'visible') void go() }
    document.addEventListener('visibilitychange', vis)
    const t = window.setInterval(go, 45_000)
    return () => { alive = false; window.removeEventListener('online', go); window.removeEventListener('memoa-outbox', onChange); document.removeEventListener('visibilitychange', vis); window.clearInterval(t) }
  }, [uid])

  if (!uid || (!left && !msg)) return null
  return (
    <div className="demo-banner" role="status" onClick={() => setMsg(null)}>
      {msg ?? (left === 1 ? '1 note en attente : elle sera envoyée dès que le réseau revient.' : `${left} notes en attente : elles seront envoyées dès que le réseau revient.`)}
    </div>
  )
}

/** Aperçu d'un enregistrement vocal gardé sur le téléphone (sans réseau) : l'étudiant voit qu'il est bien là et qu'il sera transcrit tout seul. */
export function PendingAudioChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])
  const mo = file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(file.size / 1024))} Ko`
  return (
    <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 14, border: '1.5px solid var(--line-strong, #cfd8d5)', background: 'var(--surface, #fff)', maxWidth: '100%', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <span aria-hidden="true" style={{ flex: 'none', width: 40, height: 40, borderRadius: '50%', background: '#0B5D54', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="mic" size={20} /></span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <strong style={{ overflowWrap: 'anywhere' }}>Enregistrement vocal gardé · {mo}</strong>
          <span className="muted" style={{ fontSize: 13 }}>Il est bien enregistré sur ton téléphone et ne disparaîtra pas. Dès que tu auras du réseau, il sera transcrit automatiquement en texte.</span>
        </span>
      </div>
      {url && <audio controls src={url} style={{ width: '100%', maxWidth: '100%' }} />}
      <button type="button" className="link" style={{ alignSelf: 'flex-start', textDecoration: 'none' }} onClick={() => { if (window.confirm('Retirer cet enregistrement ? Il sera perdu.')) onRemove() }}>Retirer l’enregistrement</button>
    </div>
  )
}
