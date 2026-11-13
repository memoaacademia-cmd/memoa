import type { Fact } from '../data/facts'

// La banque pèse environ 140 Ko : on ne la charge qu'au moment d'afficher la carte, pas au démarrage de l'application.
let cache: Promise<Fact[]> | null = null
export function loadFacts(): Promise<Fact[]> {
  if (!cache) cache = import('../data/facts').then((m) => m.FACTS)
  return cache
}

const DAY = 86_400_000
const KIN_OFFSET = 3_600_000 // Kinshasa : UTC+1

/** Numéro du jour à Kinshasa : la carte change à minuit, heure de Kinshasa, pour tous les étudiants. */
export function kinshasaDayNumber(now = Date.now()): number {
  return Math.floor((now + KIN_OFFSET) / DAY)
}

function gcd(a: number, b: number): number { return b ? gcd(b, a % b) : a }

/** Position de la carte du jour : on avance par grands pas pour alterner les thèmes, sans jamais répéter avant d'avoir tout vu. */
export function dailyIndex(total: number, day = kinshasaDayNumber()): number {
  if (total <= 1) return 0
  let step = 97
  while (gcd(step, total) !== 1) step++
  return (day * step) % total
}

/** Une autre carte que celle affichée (bouton « Encore une »). */
export function otherIndex(total: number, current: number): number {
  if (total <= 1) return 0
  let next = current
  while (next === current) next = Math.floor(Math.random() * total)
  return next
}

/* ------------------------------------------------------------------ */
/* Cartes personnalisées : chaque compte a sa propre suite de cartes.   */
/* ------------------------------------------------------------------ */

/** Nombre de millisecondes avant le prochain minuit de Kinshasa (la carte du jour change alors). */
export function msUntilKinshasaMidnight(now = Date.now()): number {
  return (kinshasaDayNumber(now) + 1) * DAY - KIN_OFFSET - now
}

/** Empreinte stable d'un texte (identifiant du compte) : sert à décaler la suite de cartes de chaque étudiant. */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Thèmes (catégories) de la banque, dans l'ordre d'apparition. */
export function factCategories(all: Fact[]): string[] {
  return [...new Set(all.map((f) => f.c))]
}

const themesKey = (userId: string) => `memoa-fact-themes:${userId}`
/** Thèmes choisis par CET étudiant sur CE téléphone ([] = aucun choix = tous les thèmes). */
export function getFactThemes(userId: string): string[] {
  try { const v = JSON.parse(localStorage.getItem(themesKey(userId)) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [] } catch { return [] }
}
export function setFactThemes(userId: string, themes: string[]) {
  try { localStorage.setItem(themesKey(userId), JSON.stringify(themes)) } catch { /* stockage indisponible : le choix vaut pour la session */ }
}

/** Carte du jour d'un étudiant : on ne garde que ses thèmes, puis chaque compte avance dans sa propre suite
 *  (départ et pas différents, tirés de son identifiant). Même carte toute la journée de Kinshasa, nouvelle carte à 00h00. Renvoie la position dans `all`. */
export function dailyFactIndex(all: Fact[], userId: string, themes: string[], day = kinshasaDayNumber()): number {
  let pool = themes.length ? all.map((f, i) => ({ f, i })).filter((x) => themes.includes(x.f.c)) : all.map((f, i) => ({ f, i }))
  if (!pool.length) pool = all.map((f, i) => ({ f, i }))
  const n = pool.length
  if (n <= 1) return pool[0]?.i ?? 0
  const h = hash(userId || 'anonyme')
  let step = 7 + (h % 89)
  while (gcd(step, n) !== 1) step++
  return pool[((h >>> 7) % n + day * step) % n].i
}
