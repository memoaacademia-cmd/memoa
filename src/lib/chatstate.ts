import { useSyncExternalStore } from 'react'
import type { Message } from './types'
import type { TpDraft } from './chatActions'
import { listConversations, listMessages } from './api'

/** Message du chat : en plus d'un message normal, un message « local » est écrit par l'appli (résultat d'une action, refus d'image) et n'est pas dans l'historique du serveur. */
export type ChatMsg = Message & {
  local?: boolean
  link?: { to: string; label: string }
  /** Texte tapé (sans le nom du fichier joint) et fichier joint : pour pouvoir modifier le message. */
  raw?: string
  att?: { name: string; text: string }
  /** Ce que l'action a fait (une ligne, sans contenu de notes) : renvoyé à Memo pour qu'il s'en souvienne. */
  fact?: string
  /** État du TP après cette action (sert à revenir en arrière quand on modifie un message plus haut). */
  tpSnap?: TpDraft | null
}

/**
 * État du chat gardé HORS de la page : quand l'étudiant change de page, la demande en cours continue
 * et, en revenant sur l'Assistant, il retrouve la conversation et la réponse (ou « Réflexion… » si elle n'est pas finie).
 */
interface ChatState {
  messages: ChatMsg[]
  conversationId: string | null
  courseId: string
  tp: TpDraft | null
  thinking: boolean
  acting: boolean
}
let state: ChatState = { messages: [], conversationId: null, courseId: '', tp: null, thinking: false, acting: false }
const listeners = new Set<() => void>()
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } }

export function setChat(patch: Partial<ChatState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}
export const getChat = () => state

type Setter<T> = (v: T | ((prev: T) => T)) => void
const setters: Partial<Record<keyof ChatState, Setter<never>>> = {}
function setterFor<K extends keyof ChatState>(k: K): Setter<ChatState[K]> {
  if (!setters[k]) {
    setters[k] = ((v: ChatState[K] | ((p: ChatState[K]) => ChatState[K])) => {
      const next = typeof v === 'function' ? (v as (p: ChatState[K]) => ChatState[K])(state[k]) : v
      setChat({ [k]: next } as Partial<ChatState>)
    }) as unknown as Setter<never>
  }
  return setters[k] as unknown as Setter<ChatState[K]>
}

/** Comme useState, mais la valeur vit en dehors de la page (elle survit quand on quitte l'Assistant). */
export function useChat<K extends keyof ChatState>(k: K): [ChatState[K], Setter<ChatState[K]>] {
  const v = useSyncExternalStore(subscribe, () => state[k])
  return [v, setterFor(k)]
}
export const chatSetter = setterFor

/** Compteur : une réponse qui arrive après « stop », une nouvelle conversation ou un autre envoi est ignorée. */
export const chatRun = { gen: 0 }

/* ---- Demande en cours, gardée sur le téléphone : si l'appli est fermée avant la réponse, on la retrouve dans l'historique ---- */
const PENDING_KEY = 'memoa-chat-pending'
const PENDING_MAX_MS = 10 * 60_000
/** count = nombre de messages déjà enregistrés par le serveur avant l'envoi : la réponse est arrivée quand il y en a 2 de plus. */
export interface ChatPending { conversationId: string | null; at: number; count: number }
export function markPending(conversationId: string | null, count: number) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify({ conversationId, at: Date.now(), count } satisfies ChatPending)) } catch { /* stockage indisponible */ }
}
export function clearPending() {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* rien à faire */ }
}
export function readPending(): ChatPending | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as ChatPending | null
    if (!p || typeof p.at !== 'number' || typeof p.count !== 'number' || Date.now() - p.at > PENDING_MAX_MS) { clearPending(); return null }
    return p
  } catch { return null }
}

let recovering = false
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
/**
 * Retrouve dans l'historique la réponse d'une demande envoyée juste avant que l'appli soit fermée ou mise en veille.
 * Le serveur enregistre la réponse même si l'étudiant est parti : on attend (au plus 90 s) qu'elle apparaisse, puis on l'affiche.
 */
export async function recoverChat(onDone?: () => void): Promise<void> {
  if (recovering || state.thinking) return
  const p = readPending()
  if (!p) return
  recovering = true
  const gen = chatRun.gen
  setChat({ thinking: true, acting: false })
  let id = p.conversationId
  const deadline = Date.now() + 90_000
  try {
    while (Date.now() < deadline) {
      if (gen !== chatRun.gen) return // l'étudiant a fait autre chose entre-temps
      try {
        if (!id) {
          const cs = await listConversations()
          id = cs.find((c) => new Date(c.created_at).getTime() >= p.at - 60_000)?.id ?? null
        }
        if (id) {
          const msgs = await listMessages(id)
          if (gen !== chatRun.gen) return
          if (msgs.length >= p.count + 2) {
            setChat({ messages: msgs, conversationId: id, thinking: false, acting: false })
            clearPending()
            onDone?.()
            return
          }
        }
      } catch { /* réseau coupé : on réessaie */ }
      await wait(3000)
    }
    // Temps écoulé : on montre au moins ce que l'historique contient.
    try {
      if (!id) id = (await listConversations())[0]?.id ?? null
      if (id && gen === chatRun.gen) setChat({ messages: await listMessages(id), conversationId: id })
    } catch { /* rien à montrer */ }
    clearPending()
    onDone?.()
  } finally {
    recovering = false
    if (gen === chatRun.gen) setChat({ thinking: false, acting: false })
  }
}
