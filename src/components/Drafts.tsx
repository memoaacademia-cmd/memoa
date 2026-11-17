import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, RowGroup } from './ui'
import { excerpt, isUrgent, purgeExpired, syncDraftExpiry, timeLeft, useDrafts, type Draft } from '../lib/drafts'
import { useAuth } from '../lib/auth'
import { describeSync, hasNews, syncOfflineDraftsLocked } from '../lib/draftsync'

/** Chemin qui rouvre un brouillon dans le bon éditeur. */
export function draftPath(d: Draft): string {
  return d.kind === 'course' || !d.courseId ? `/cours?brouillon=${d.id}` : `/sac/${d.courseId}?brouillon=${d.id}`
}

const kindLabel = (d: Draft) => (d.kind === 'course' ? 'Nouveau cours' : d.kind === 'edit' ? 'Modification' : 'Note')

/** Gardé sans réseau : dit ce qui va se passer à la reconnexion (ou pourquoi ça n'a pas eu lieu). */
function pendingNotice(d: Draft): string | null {
  if (d.kind === 'edit') return null
  if (d.failed === 'credit') return d.kind === 'course' ? 'Pas créé faute de crédit : il reste ici.' : 'Pas ajoutée faute de crédit : elle reste ici.'
  if (d.failed === 'error') return d.kind === 'course' ? 'Création impossible pour l’instant : il reste ici.' : 'Ajout impossible pour l’instant : elle reste ici.'
  if (!d.offline) return null
  return d.kind === 'course' ? 'Sera créé dès que tu seras connecté.' : 'Sera ajoutée à ton cours dès que tu seras connecté.'
}

/** Section « Brouillons en attente » : titre, extrait et compte à rebours. Rien ne s'affiche s'il n'y a pas de brouillon. */
export function DraftsSection({ drafts, now, onDelete, label = 'Brouillons en attente' }: { drafts: Draft[]; now: number; onDelete: (d: Draft) => void; label?: string }) {
  const nav = useNavigate()
  if (!drafts.length) return null
  return (
    <RowGroup label={label}>
      {drafts.map((d) => (
        <div key={d.id} className="dr-row">
          <button type="button" className="rg-row" onClick={() => nav(draftPath(d))}>
            <span className="rg-ico"><Icon name="pencil" size={22} /></span>
            <span className="rg-body">
              <span className="rg-title">{d.title.trim() || 'Sans titre'}</span>
              <span className="rg-sub">{kindLabel(d)} · {d.audio && !d.body.trim() ? 'Enregistrement audio à transcrire' : excerpt(d.body, 70)}</span>
              {pendingNotice(d) && <span className={'rg-sub' + (d.failed ? ' dr-urgent' : ' dr-auto')}>{pendingNotice(d)}</span>}
              <span className={'rg-sub' + (isUrgent(d, now) ? ' dr-urgent' : '')}>Disparaît dans {timeLeft(d.expiresAt, now)}</span>
            </span>
          </button>
          <button type="button" className="dr-del" aria-label={`Supprimer le brouillon ${d.title || ''}`} onClick={() => { if (window.confirm('Supprimer ce brouillon ? Il sera perdu.')) onDelete(d) }}>
            <Icon name="trash" size={20} />
          </button>
        </div>
      ))}
    </RowGroup>
  )
}

/**
 * Posé une fois dans l'appli : nettoie les brouillons expirés au lancement, prévient le serveur au retour du réseau,
 * et affiche le bandeau quand il reste 5 h ou moins.
 */
export function DraftWatcher() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { drafts, now } = useDrafts(user?.id)
  const uid = user?.id
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    if (!uid) return
    let alive = true
    void purgeExpired(uid)
    void syncDraftExpiry(uid)
    // Brouillons gardés sans réseau : créés / ajoutés tout seuls dès que la connexion revient.
    const send = async () => {
      const r = await syncOfflineDraftsLocked(uid).catch(() => null)
      if (alive && r && hasNews(r)) setMsg(describeSync(r))
    }
    void send()
    const on = () => { void purgeExpired(uid); void syncDraftExpiry(uid); void send() }
    const vis = () => { if (document.visibilityState === 'visible') void send() }
    window.addEventListener('online', on)
    document.addEventListener('visibilitychange', vis)
    const t = window.setInterval(() => void send(), 45_000)
    return () => { alive = false; window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); window.clearInterval(t) }
  }, [uid])
  const urgent = drafts.filter((d) => isUrgent(d, now))
  const first = urgent[0]
  if (!urgent.length && !msg) return null
  return (
    <>
      {msg && <div className="demo-banner" role="status" onClick={() => setMsg(null)}>{msg}</div>}
      {urgent.length > 0 && (
        <div style={{ padding: '10px 16px 0' }} className="no-print">
          <button type="button" className="dr-banner" onClick={() => nav(draftPath(first))}>
            <Icon name="clock" size={20} color="var(--braise)" />
            <span>
              <b>Tes notes disparaissent dans {timeLeft(first.expiresAt, now)}</b>
              {' '}: génère ton PDF maintenant, sinon tu les perdras.
              {urgent.length > 1 ? ` (${urgent.length} brouillons)` : ''}
            </span>
          </button>
        </div>
      )}
    </>
  )
}
