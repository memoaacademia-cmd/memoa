import type { CSSProperties } from 'react'
import { BottomSheet } from './ui'
import { universityLabel } from '../data/academic'
import { useAvatar } from '../lib/avatar'
import { officialName } from '../lib/names'
import { nextPlaque, plaqueFor, type Plaque } from '../lib/plaque'
import type { LibAuthor } from '../lib/types'

/** Petite pierre précieuse posée sur l'anneau (même forme pour tous les paliers, la couleur change). */
function Gem({ plaque, size }: { plaque: Plaque; size: number }) {
  return (
    <svg className="plq-gem" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12,2 21,9 12,22 3,9" fill={plaque.gem} stroke="var(--surface)" strokeWidth="1.6" strokeLinejoin="round" />
      <polygon points="12,2 16.5,9 12,22 7.5,9" fill="#ffffff" fillOpacity=".28" />
      <path d="M3 9 H21" stroke="#ffffff" strokeOpacity=".55" strokeWidth="1" />
    </svg>
  )
}

/** Photo d'un étudiant, avec sa plaque (anneau doré, émeraude…) quand il en a une. Sans plaque : une simple photo, sans anneau. */
export function PlaqueAvatar({ src, name, size = 44, plaque, onClick, tour }: {
  src: string | null | undefined
  name: string
  size?: number
  plaque: Plaque | null
  onClick?: () => void
  tour?: string
}) {
  const photo = useAvatar(src)
  const ring = plaque ? Math.max(2.5, Math.round(size / 14)) : 0
  const inner = (
    <span className="plq-photo" style={{ width: size, height: size }}>
      {photo ? <img src={photo} alt="" /> : <span style={{ fontSize: Math.round(size * 0.42) }}>{(name.trim()[0] ?? 'M').toUpperCase()}</span>}
    </span>
  )
  const style = plaque
    ? ({ padding: ring, ['--plq-a' as string]: plaque.ring[0], ['--plq-b' as string]: plaque.ring[1], ['--plq-c' as string]: plaque.ring[2], ['--plq-glow' as string]: plaque.gem } as CSSProperties)
    : undefined
  const cls = 'plq' + (plaque ? ' on ' + plaque.id : '')
  const gem = plaque ? <Gem plaque={plaque} size={Math.max(14, Math.round(size * 0.36))} /> : null
  if (onClick) {
    return (
      <button type="button" className={cls} style={style} onClick={onClick} aria-label={`Voir le profil de ${name}${plaque ? ` (plaque ${plaque.label})` : ''}`} data-tour={tour}>
        {inner}{gem}
      </button>
    )
  }
  return <span className={cls} style={style} data-tour={tour}>{inner}{gem}</span>
}

/** Fiche de profil d'un auteur : ce que tout le monde peut voir en touchant sa photo dans la Librairie. */
export function AuthorSheet({ author, onClose }: { author: LibAuthor | null; onClose: () => void }) {
  const plaque = author ? plaqueFor(author.best_likes) : null
  const next = author ? nextPlaque(author.best_likes) : null
  const prevMin = plaque?.min ?? 0
  const pct = author && next ? Math.min(100, Math.max(4, Math.round(((author.best_likes - prevMin) / (next.min - prevMin)) * 100))) : 100
  const style = plaque ? ({ ['--plq-glow' as string]: plaque.gem } as CSSProperties) : undefined
  const realName = author ? officialName(author) || author.memo_name : ''
  const uni = author?.university ? universityLabel(author.university) : ''
  return (
    <BottomSheet open={!!author} onClose={onClose} title={author ? `Profil de ${realName}` : undefined}>
      {author && (
        <div className="aut" style={style}>
          <div className={'aut-hero' + (plaque ? ' ' + plaque.id : '')}>
            <PlaqueAvatar src={author.avatar_url} name={realName} size={96} plaque={plaque} />
            <strong className="aut-name">{realName}</strong>
            <span className="muted">Memo : {author.memo_name}</span>
            <span className={'aut-tag' + (plaque ? ' on' : '')}>{plaque ? `Plaque ${plaque.label}` : 'Pas encore de plaque'}</span>
          </div>
          {author.bio && <p className="aut-bio">{author.bio}</p>}
          <div className="aut-chips">
            {author.promotion && <span className="badge">{author.promotion}</span>}
            {author.faculty && <span className="badge">{author.faculty}</span>}
            {uni && <span className="badge">{uni}</span>}
          </div>
          <div className="aut-stats">
            <div><b>{author.doc_count}</b><span>{author.doc_count > 1 ? 'documents' : 'document'}</span></div>
            <i aria-hidden="true" />
            <div><b>{author.total_likes}</b><span>{author.total_likes > 1 ? 'likes' : 'like'}</span></div>
          </div>
          {next ? (
            <div className="aut-next">
              <div className="aut-bar" aria-hidden="true"><span style={{ width: pct + '%' }} /></div>
              <span className="muted">Encore {next.min - author.best_likes} {next.min - author.best_likes > 1 ? 'likes' : 'like'} sur son meilleur document pour la plaque {next.label}.</span>
            </div>
          ) : (
            <span className="muted" style={{ textAlign: 'center' }}>La plus haute plaque : Rubis.</span>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

/** Cœur du bouton « like ». */
export function Heart({ on, size = 18 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20.5 C5 15.2 3 12 3 8.8 A4.6 4.6 0 0 1 12 7 A4.6 4.6 0 0 1 21 8.8 C21 12 19 15.2 12 20.5 Z" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  )
}
