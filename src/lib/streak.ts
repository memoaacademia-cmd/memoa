const DAY = 864e5
/** Jour calendaire à Kinshasa (UTC+1). */
const iso = (d: Date) => new Date(d.getTime() + 3_600_000).toISOString().slice(0, 10)

/** Série en cours : jours consécutifs jusqu'à aujourd'hui (ou hier, pour ne pas punir une journée pas encore finie). */
export function currentStreak(days: string[]): number {
  const set = new Set(days)
  let cursor = new Date()
  if (!set.has(iso(cursor))) cursor = new Date(cursor.getTime() - DAY)
  let n = 0
  while (set.has(iso(cursor))) {
    n++
    cursor = new Date(cursor.getTime() - DAY)
  }
  return n
}

export function streakTitle(n: number): string {
  if (n >= 30) return 'Légende'
  if (n >= 7) return 'Régulier'
  if (n >= 3) return 'En route'
  return 'Nouveau'
}

/** Les 7 derniers jours (le plus ancien d'abord), avec l'initiale du jour. */
export function lastWeek(days: string[]): { label: string; on: boolean }[] {
  const set = new Set(days)
  const names = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * DAY)
    return { label: names[new Date(d.getTime() + 3_600_000).getUTCDay()], on: set.has(iso(d)) }
  })
}

/** État de Memo, sans culpabilisation : plus l'absence est longue, plus il est calme. */
export function memoMood(days: string[]): { state: 'energique' | 'faible' | 'endormi'; text: string } {
  if (!days.length) return { state: 'energique', text: 'Prêt pour ta première session.' }
  const last = [...days].sort().pop() as string
  const gap = Math.floor((Date.now() + 3_600_000 - new Date(last + 'T00:00:00Z').getTime()) / DAY)
  if (gap <= 1) return { state: 'energique', text: 'En pleine forme.' }
  if (gap <= 3) return { state: 'faible', text: 'Un peu fatigué. Une courte session le réveille.' }
  return { state: 'endormi', text: 'Il dort. Il sera content de te revoir.' }
}

export const FACTS = [
  'Réviser en plusieurs courtes séances espacées aide mieux à retenir qu’une seule longue séance.',
  'Se tester soi-même (quiz, cartes de révision) fixe mieux la mémoire que relire plusieurs fois.',
  'Dormir après avoir appris aide le cerveau à consolider ce que tu as retenu.',
  'Expliquer un cours à voix haute, avec tes propres mots, révèle vite ce que tu n’as pas encore compris.'
]
export const factOfTheDay = () => FACTS[Math.floor(Date.now() / DAY) % FACTS.length]
