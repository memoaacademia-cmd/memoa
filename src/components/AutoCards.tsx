import { useEffect } from 'react'
import { listCourses } from '../lib/api'
import { useAuth } from '../lib/auth'
import { cachedCards, generateCards, kinToday } from '../lib/review'

const MAX_PER_OPEN = 2 // cours traités à chaque ouverture (les autres seront faits aux ouvertures suivantes)
const SEEN = (u: string) => `memoa-cards-auto-seen:${u}` // { [coursId]: nombre de notes déjà prises en compte }
const TRIED = (u: string, c: string) => `memoa-cards-auto-day:${u}:${c}` // un seul essai par cours et par jour, réussi ou non

function readSeen(u: string): Record<string, number> {
  try { const v = JSON.parse(localStorage.getItem(SEEN(u)) ?? '{}'); return v && typeof v === 'object' ? v : {} } catch { return {} }
}

/** À l'ouverture de l'appli : si un cours a de nouvelles notes depuis la dernière préparation, Memo prépare les cartes tout seul
 *  (gratuit, une fois par cours et par jour : le serveur applique la limite). Silencieux en cas d'échec ; une petite bande prévient en cas de succès.
 *  À placer une fois dans l'écran connecté. */
export default function AutoCards() {
  const { user, profile } = useAuth()
  const uid = user?.id
  const memo = profile?.memo_name || 'Memo'
  useEffect(() => {
    if (!uid) return
    let alive = true
    const run = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return
      try {
        const courses = await listCourses(uid)
        if (!alive) return
        const seen = readSeen(uid)
        const cards = cachedCards(uid)
        // Cours jamais traité mais qui a déjà des cartes : on prend son nombre de notes actuel comme point de départ (pas de génération inutile).
        const todo = courses.filter((c) => c.notes_count > 0 && (seen[c.id] ?? (cards.some((k) => k.course_id === c.id) ? c.notes_count : 0)) < c.notes_count && localStorage.getItem(TRIED(uid, c.id)) !== kinToday())
        for (const c of todo.slice(0, MAX_PER_OPEN)) {
          if (!alive) return
          try { localStorage.setItem(TRIED(uid, c.id), kinToday()) } catch { /* sans importance */ }
          try {
            const n = await generateCards(uid, c.id, memo, { auto: true })
            seen[c.id] = c.notes_count
            localStorage.setItem(SEEN(uid), JSON.stringify(seen))
            window.dispatchEvent(new CustomEvent('memoa-notice', { detail: `${memo} a préparé ${n} ${n > 1 ? 'cartes' : 'carte'} de révision pour « ${c.title} ».` }))
          } catch { /* IA occupée, limite du jour, rien de nouveau à créer : on réessaiera demain */ }
        }
      } catch { /* liste des cours indisponible : pas grave */ }
    }
    const t = window.setTimeout(() => void run(), 2500) // après l'affichage de l'accueil
    const vis = () => { if (document.visibilityState === 'visible') window.setTimeout(() => void run(), 1500) }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; window.clearTimeout(t); document.removeEventListener('visibilitychange', vis) }
  }, [uid, memo])
  return null
}
