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
