import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, RowGroup } from './ui'
import { excerpt, isUrgent, purgeExpired, syncDraftExpiry, timeLeft, useDrafts, type Draft } from '../lib/drafts'
import { useAuth } from '../lib/auth'

/** Chemin qui rouvre un brouillon dans le bon éditeur. */
export function draftPath(d: Draft): string {
  return d.kind === 'course' || !d.courseId ? `/cours?brouillon=${d.id}` : `/sac/${d.courseId}?brouillon=${d.id}`
}

const kindLabel = (d: Draft) => (d.kind === 'course' ? 'Nouveau cours' : d.kind === 'edit' ? 'Modification' : 'Note')

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
              <span className="rg-sub">{kindLabel(d)} · {excerpt(d.body, 70)}</span>
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
  useEffect(() => {
    if (!uid) return
    void purgeExpired(uid)
    void syncDraftExpiry(uid)
    const on = () => { void purgeExpired(uid); void syncDraftExpiry(uid) }
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [uid])
  const urgent = drafts.filter((d) => isUrgent(d, now))
  if (!urgent.length) return null
  const first = urgent[0]
  return (
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
  )
}

