// Magasin local pour le « mode démo » (aucune clé Supabase). Ne JAMAIS utiliser en production :
// les mots de passe ci-dessous sont stockés en clair dans le navigateur, uniquement pour explorer l'interface.
import type { Conversation, Course, LibDoc, Message, Note, Payment, Profile } from './types'

export interface DemoUser {
  id: string
  email: string
  password: string
  phone: string | null
}

export interface DemoDb {
  users: DemoUser[]
  session: string | null
  profiles: Profile[]
  courses: Omit<Course, 'notes_count'>[]
  notes: Note[]
  docs: LibDoc[]
  favs: string[]
  activity: string[]
  convs: Conversation[]
  msgs: (Message & { conversation_id: string })[]
  payments: Payment[]
}

const KEY = 'memoa-demo-v1'

const empty = (): DemoDb => ({
  users: [],
  session: null,
  profiles: [],
  courses: [],
  notes: [],
  docs: [],
  favs: [],
  activity: [],
  convs: [],
  msgs: [],
  payments: []
})

export function loadDemo(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty()
  } catch {
    return empty()
  }
}

export function saveDemo(db: DemoDb) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db))
  } catch {
    /* stockage plein ou bloqué : le mode démo reste utilisable le temps de la session */
  }
}

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()))
