// Couche d'accès aux données. Chaque fonction a deux implémentations :
//  - Supabase (production) ; toute la sécurité repose sur les règles RLS de supabase/migrations
//  - Démo (localStorage) quand les clés Supabase sont absentes.
// Les pages n'appellent QUE ce fichier : changer de backend ne touche pas à l'interface.
import { isConfigured, supabase } from './supabase'
import { loadDemo, saveDemo, uid } from './demo'
import { shrinkImage } from './image'
import type { AiTask, Conversation, Course, LibDoc, Message, Note, Payment, Profile } from './types'

export interface AuthUser {
  id: string
  email: string
  phone: string | null
  /** Compte créé via Google qui n'a pas encore choisi de mot de passe. */
  needsPassword: boolean
}

const sb = () => {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}
const today = () => new Date().toISOString().slice(0, 10)
const fail = (m: string): never => {
  throw new Error(m)
}

/** Traduit les erreurs Supabase les plus courantes en messages clairs pour l'étudiant. */
export function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  if (/Invalid login credentials/i.test(m)) return 'Email ou mot de passe incorrect.'
  if (/Email not confirmed/i.test(m)) return "Ton email n'est pas encore confirmé. Ouvre le message de confirmation."
  if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet email. Connecte-toi.'
  if (/Password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 8 caractères.'
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifie ton réseau et réessaie.'
  return m
}

/* ------------------------------ AUTH ------------------------------ */

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.id === db.session)
    return u ? { id: u.id, email: u.email, phone: u.phone, needsPassword: u.password === '' } : null
  }
  const { data } = await sb().auth.getSession()
  const u = data.session?.user
  if (!u) return null
  const viaGoogle = u.app_metadata?.provider === 'google'
  return {
    id: u.id,
    email: u.email ?? '',
    phone: (u.user_metadata?.phone as string) ?? null,
    needsPassword: viaGoogle && !u.user_metadata?.password_set
  }
}

export function onAuthChange(cb: (event?: string) => void): () => void {
  if (!isConfigured) {
    const handler = () => cb()
    window.addEventListener('memoa-demo-auth', handler)
    return () => window.removeEventListener('memoa-demo-auth', handler)
  }
  const { data } = sb().auth.onAuthStateChange((event) => cb(event))
  return () => data.subscription.unsubscribe()
}

const pingDemoAuth = () => window.dispatchEvent(new Event('memoa-demo-auth'))

/** Retourne needsConfirmation=true quand un email de confirmation doit être ouvert. */
export async function signUp(email: string, password: string, phone: string): Promise<{ needsConfirmation: boolean }> {
  if (!isConfigured) {
    const db = loadDemo()
    if (db.users.some((u) => u.email === email)) fail('Un compte existe déjà avec cet email. Connecte-toi.')
    const id = uid()
    db.users.push({ id, email, password, phone })
    db.session = id
    saveDemo(db)
    pingDemoAuth()
    return { needsConfirmation: false }
  }
  const { data, error } = await sb().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.origin + window.location.pathname, data: { phone } }
  })
  if (error) throw error
  return { needsConfirmation: !data.session }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.email === email && x.password === password)
    if (!u) fail('Email ou mot de passe incorrect.')
    else {
      db.session = u.id
      saveDemo(db)
      pingDemoAuth()
    }
    return
  }
  const { error } = await sb().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signInWithGoogle(): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const id = uid()
    db.users.push({ id, email: `etudiant+${id.slice(0, 4)}@gmail.com`, password: '', phone: null })
    db.session = id
    saveDemo(db)
    pingDemoAuth()
    return
  }
  const { error } = await sb().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname }
  })
  if (error) throw error
}

export async function resendConfirmation(email: string): Promise<void> {
  if (!isConfigured) return
  const { error } = await sb().auth.resend({ type: 'signup', email })
  if (error) throw error
}

/** Envoie le lien de réinitialisation. Ne révèle pas si l'email a un compte (réponse identique). */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!isConfigured) return
  const { error } = await sb().auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  })
  if (error) throw error
}

/** Après le clic sur le lien reçu par email : choisit le nouveau mot de passe. */
export async function updatePassword(password: string): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.id === db.session)
    if (u) {
      u.password = password
      saveDemo(db)
    }
    return
  }
  const { error } = await sb().auth.updateUser({ password, data: { password_set: true } })
  if (error) throw error
}

/* ------------------------- AVIS ET SIGNALEMENTS ------------------------- */

export type FeedbackKind = 'bug' | 'idea' | 'other' | 'rating'

export async function sendFeedback(userId: string, kind: FeedbackKind, message: string, rating?: number): Promise<void> {
  if (!isConfigured) return
  const { error } = await sb().from('feedback').insert({
    user_id: userId,
    kind,
    rating: rating ?? null,
    message: message.trim().slice(0, 2000),
    user_agent: navigator.userAgent.slice(0, 300)
  })
  if (error) throw error
}

/** Après Google : création du mot de passe + numéro, pour pouvoir se reconnecter avec email + mot de passe. */
export async function setPasswordAndPhone(password: string, phone: string): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.id === db.session)
    if (u) {
      u.password = password
      u.phone = phone
      saveDemo(db)
    }
    return
  }
  const { error } = await sb().auth.updateUser({ password, data: { phone, password_set: true } })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    db.session = null
    saveDemo(db)
    pingDemoAuth()
    return
  }
  await sb().auth.signOut()
}

/* ----------------------------- PROFIL ----------------------------- */

export async function getProfile(userId: string): Promise<Profile | null> {
  if (!isConfigured) return loadDemo().profiles.find((p) => p.id === userId) ?? null
  const { data, error } = await sb().from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? null
}

export async function saveProfile(userId: string, patch: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
  if (!isConfigured) {
    const db = loadDemo()
    let p = db.profiles.find((x) => x.id === userId)
    if (!p) {
      p = {
        id: userId, full_name: '', last_name: '', post_name: '', first_name: '', phone: null, university: '', faculty: '', department: '',
        promotion: 'L1', vacation: '', avatar_url: null, memo_animal: null, memo_name: null
      }
      db.profiles.push(p)
    }
    Object.assign(p, patch)
    saveDemo(db)
    return p
  }
  const { data, error } = await sb().from('profiles').upsert({ id: userId, ...patch }).select().single()
  if (error) throw error
  return data as Profile
}

export async function uploadAvatar(userId: string, original: File): Promise<string> {
  if (!original.type.startsWith('image/')) fail('Choisis une image (JPG, PNG ou WebP).')
  const file = await shrinkImage(original)
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('Ce format n’est pas pris en charge. Choisis une photo JPG, PNG ou WebP.')
  if (file.size > 3 * 1024 * 1024) fail('Cette photo est trop lourde. Choisis-en une autre.')
  if (!isConfigured) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('Lecture impossible'))
      r.readAsDataURL(file)
    })
  }
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${userId}/avatar.${ext}`
  const { error } = await sb().storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return sb().storage.from('avatars').getPublicUrl(path).data.publicUrl + `?v=${Date.now()}`
}

/* ------------------------ COURS / SAC À DOS ------------------------ */

export const TRASH_DAYS = 30

export async function listCourses(userId: string): Promise<Course[]> {
  if (!isConfigured) {
    const db = loadDemo()
    return db.courses
      .filter((c) => !c.deleted_at)
      .map((c) => ({ ...c, notes_count: db.notes.filter((n) => n.course_id === c.id).length }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  void userId
  const { data, error } = await sb()
    .from('courses')
    .select('id,title,created_at,notes(count)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id, title: c.title, created_at: c.created_at, notes_count: c.notes?.[0]?.count ?? 0
  }))
}

/** Cours dans la corbeille (30 jours). Efface d'abord pour de bon ceux dont le délai est passé. */
export async function listTrashedCourses(): Promise<Course[]> {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()
  if (!isConfigured) {
    const db = loadDemo()
    const gone = db.courses.filter((c) => c.deleted_at && c.deleted_at < cutoff).map((c) => c.id)
    if (gone.length) {
      db.courses = db.courses.filter((c) => !gone.includes(c.id))
      db.notes = db.notes.filter((n) => !gone.includes(n.course_id))
      saveDemo(db)
    }
    return db.courses
      .filter((c) => c.deleted_at)
      .map((c) => ({ ...c, notes_count: db.notes.filter((n) => n.course_id === c.id).length }))
  }
  await sb().from('courses').delete().lt('deleted_at', cutoff) // les règles RLS limitent à ses propres cours
  const { data, error } = await sb()
    .from('courses')
    .select('id,title,created_at,deleted_at,notes(count)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id, title: c.title, created_at: c.created_at, deleted_at: c.deleted_at, notes_count: c.notes?.[0]?.count ?? 0
  }))
}

/** Met un cours à la corbeille (restaurable pendant 30 jours) ou le restaure. */
export async function setCourseTrashed(id: string, trashed: boolean): Promise<void> {
  const value = trashed ? new Date().toISOString() : null
  if (!isConfigured) {
    const db = loadDemo()
    const c = db.courses.find((x) => x.id === id)
    if (c) { c.deleted_at = value; saveDemo(db) }
    return
  }
  const { error } = await sb().from('courses').update({ deleted_at: value }).eq('id', id)
  if (error) throw error
}

export async function getCourse(id: string): Promise<Course | null> {
  const all = await listCourses('')
  return all.find((c) => c.id === id) ?? null
}

export async function createCourse(userId: string, title: string): Promise<Course> {
  const clean = title.trim()
  if (!clean) fail('Donne un nom à ton cours.')
  if (!isConfigured) {
    const db = loadDemo()
    const c = { id: uid(), title: clean, created_at: new Date().toISOString() }
    db.courses.push(c)
    saveDemo(db)
    return { ...c, notes_count: 0 }
  }
  const { data, error } = await sb().from('courses').insert({ user_id: userId, title: clean }).select().single()
  if (error) throw error
  return { id: data.id, title: data.title, created_at: data.created_at, notes_count: 0 }
}

export async function listNotes(courseId: string): Promise<Note[]> {
  if (!isConfigured) {
    return loadDemo().notes.filter((n) => n.course_id === courseId).sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  const { data, error } = await sb().from('notes').select('*').eq('course_id', courseId).order('created_at', { ascending: true })
  if (error) throw error
  return data as Note[]
}

export async function addNote(userId: string, courseId: string, title: string, content: string, source = 'texte'): Promise<Note> {
  if (!content.trim()) fail('Ta note est vide.')
  if (content.length > 60000) fail('Cette note est trop longue. Découpe-la en plusieurs notes.')
  if (!isConfigured) {
    const db = loadDemo()
    const n: Note = { id: uid(), course_id: courseId, title: title.trim() || 'Note', content, source, created_at: new Date().toISOString() }
    db.notes.push(n)
    saveDemo(db)
    return n
  }
  const { data, error } = await sb()
    .from('notes').insert({ user_id: userId, course_id: courseId, title: title.trim() || 'Note', content, source }).select().single()
  if (error) throw error
  return data as Note
}

/* ---------------------------- LIBRAIRIE ---------------------------- */

export async function listDocs(promotion: string | null, faculty: string | null): Promise<LibDoc[]> {
  if (!isConfigured) {
    const db = loadDemo()
    return db.docs
      .filter((d) => !d.deleted_at && (!promotion || d.promotion === promotion) && (!faculty || d.faculty === faculty))
      .map((d) => ({ ...d, is_favorite: db.favs.includes(d.id) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  let q = sb().from('library_documents').select('*').is('deleted_at', null).order('created_at', { ascending: false }).limit(300)
  if (promotion) q = q.eq('promotion', promotion)
  if (faculty) q = q.eq('faculty', faculty)
  const [docs, favs] = await Promise.all([q, sb().from('library_favorites').select('document_id')])
  if (docs.error) throw docs.error
  const fav = new Set((favs.data ?? []).map((f: any) => f.document_id as string))
  return (docs.data as LibDoc[]).map((d) => ({ ...d, is_favorite: fav.has(d.id) }))
}

const ALLOWED_DOC_TYPES = ['application/pdf']
const MAX_DOC_BYTES = 20 * 1024 * 1024

export async function publishDoc(
  userId: string,
  input: { title: string; doc_type: string; university: string; faculty: string; department?: string; promotion: string; course_title: string },
  file: File | null
): Promise<string | null> {
  if (!input.title.trim()) fail('Donne un titre à ton document.')
  if (file) {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) fail('Seuls les fichiers PDF sont acceptés pour le moment.')
    if (file.size > MAX_DOC_BYTES) fail('Le fichier ne doit pas dépasser 20 Mo.')
  }
  if (!isConfigured) {
    const db = loadDemo()
    const id = uid()
    db.docs.push({ id, ...input, file_path: null, owner_id: userId, status: 'published', created_at: new Date().toISOString() })
    saveDemo(db)
    return id
  }
  let file_path: string | null = null
  if (file) {
    file_path = `${userId}/${uid()}.pdf`
    const { error } = await sb().storage.from('library').upload(file_path, file, { contentType: 'application/pdf' })
    if (error) throw error
  }
  // Publié tout de suite ; retiré ensuite si la vérification automatique le refuse ou si plusieurs étudiants le signalent.
  const { data, error } = await sb().from('library_documents').insert({ ...input, owner_id: userId, file_path, status: 'published' }).select('id').single()
  if (error) throw error
  return (data as { id: string }).id
}

/** Documents que l'étudiant a supprimés (corbeille de 30 jours). Efface d'abord pour de bon ceux dont le délai est passé. */
export async function listMyTrashedDocs(userId: string): Promise<LibDoc[]> {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400000).toISOString()
  if (!isConfigured) {
    const db = loadDemo()
    db.docs = db.docs.filter((d) => !(d.deleted_at && d.deleted_at < cutoff))
    saveDemo(db)
    return db.docs.filter((d) => d.deleted_at && d.owner_id === userId)
  }
  const { data, error } = await sb().from('library_documents').select('*').eq('owner_id', userId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false })
  if (error) throw error
  const all = data as LibDoc[]
  const expired = all.filter((d) => d.deleted_at && d.deleted_at < cutoff)
  for (const d of expired) await deleteDocForever(d)
  return all.filter((d) => !expired.includes(d))
}

/** Met un de ses documents à la corbeille (masqué pour tous, restaurable pendant 30 jours) ou le restaure. */
export async function setDocTrashed(id: string, trashed: boolean): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const d = db.docs.find((x) => x.id === id)
    if (d) { d.deleted_at = trashed ? new Date().toISOString() : null; saveDemo(db) }
    return
  }
  const { error } = await sb().rpc('library_trash', { doc_id: id, trashed })
  if (error) throw error
}

/** Efface pour de bon un de ses documents : la ligne et le fichier PDF. */
export async function deleteDocForever(doc: LibDoc): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    db.docs = db.docs.filter((x) => x.id !== doc.id)
    saveDemo(db)
    return
  }
  if (doc.file_path) await sb().storage.from('library').remove([doc.file_path])
  const { error } = await sb().from('library_documents').delete().eq('id', doc.id)
  if (error) throw error
}

export const REPORT_REASONS = [
  { id: 'inapproprie', label: 'Contenu inapproprié' },
  { id: 'pas_un_cours', label: 'Ce n’est pas un document d’étude' },
  { id: 'droit_auteur', label: 'Droits d’auteur' },
  { id: 'autre', label: 'Autre problème' }
] as const

/** Signale un document. Un même étudiant ne peut signaler qu'une fois : un doublon est accepté sans erreur. */
export async function reportDoc(userId: string, docId: string, reason: string): Promise<void> {
  if (!isConfigured) return
  const { error } = await sb().from('library_reports').insert({ user_id: userId, document_id: docId, reason })
  if (error && (error as { code?: string }).code !== '23505') throw error
}

export async function toggleFavorite(userId: string, docId: string, on: boolean): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    db.favs = on ? [...new Set([...db.favs, docId])] : db.favs.filter((x) => x !== docId)
    saveDemo(db)
    return
  }
  if (on) {
    const { error } = await sb().from('library_favorites').upsert({ user_id: userId, document_id: docId })
    if (error) throw error
  } else {
    const { error } = await sb().from('library_favorites').delete().eq('user_id', userId).eq('document_id', docId)
    if (error) throw error
  }
}

/** Adresse temporaire d'un document. Avec `saveAs`, le navigateur télécharge le fichier au lieu de l'ouvrir. */
export async function docDownloadUrl(path: string | null, saveAs?: string): Promise<string | null> {
  if (!path || !isConfigured) return null
  const { data, error } = await sb().storage.from('library').createSignedUrl(path, 120, saveAs ? { download: saveAs } : undefined)
  if (error) throw error
  return data.signedUrl
}

/* ------------------------- FLAMMES (SÉRIE) ------------------------- */

export async function touchToday(userId: string): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    if (!db.activity.includes(today())) {
      db.activity.push(today())
      saveDemo(db)
    }
    return
  }
  await sb().from('activity_days').upsert({ user_id: userId, day: today() }, { onConflict: 'user_id,day', ignoreDuplicates: true })
}

export async function listActivity(userId: string): Promise<string[]> {
  if (!isConfigured) return loadDemo().activity
  void userId
  const since = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
  const { data, error } = await sb().from('activity_days').select('day').gte('day', since)
  if (error) throw error
  return (data ?? []).map((r: any) => r.day as string)
}

/* ------------------------------- IA ------------------------------- */

/** Appelle une fonction serveur et remonte le message d'erreur lisible qu'elle renvoie (JSON { error }). */
/** Le serveur a refusé parce que les points gratuits sont épuisés : l'application propose alors « Passer en Premium ». */
export class LimitError extends Error {}

async function invoke<T>(name: string, body: unknown, fallback: string): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body: body as Record<string, unknown> })
  if (!error) return data as T
  let msg = fallback
  let limit = false
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const j = await ctx.json()
      if (j && typeof j.error === 'string') msg = j.error
      if (j && j.code === 'premium_required') limit = true
    } catch {
      /* corps illisible : on garde le message générique */
    }
  }
  throw limit ? new LimitError(msg) : new Error(msg)
}


export interface AiResult {
  reply: string
  conversationId: string | null
}

/** Toutes les tâches IA passent par la fonction serveur « ai-gateway » : aucune clé d'IA dans le navigateur. */
export async function askAI(args: {
  task: AiTask
  prompt: string
  courseId?: string | null
  conversationId?: string | null
  context?: string
  /** Texte d'un document ou d'une photo joint à la question (lu sur le téléphone). */
  attachment?: string
  /** Autorise l'assistant à chercher sur le web. */
  web?: boolean
  /** Vérification d'un document de la Librairie (tâche review_doc). */
  docId?: string
}): Promise<AiResult> {
  if (!isConfigured) {
    await new Promise((r) => setTimeout(r, 600))
    const db = loadDemo()
    let cid = args.conversationId ?? null
    if (args.task === 'chat') {
      if (!cid) {
        cid = uid()
        db.convs.unshift({ id: cid, title: args.prompt.slice(0, 40), created_at: new Date().toISOString() })
      }
      const reply = "Mode démo : l'IA réelle sera branchée via la fonction serveur ai-gateway. Voici ta question : « " + args.prompt.slice(0, 120) + " »."
      const now = new Date().toISOString()
      db.msgs.push({ id: uid(), conversation_id: cid, role: 'user', content: args.prompt, created_at: now })
      db.msgs.push({ id: uid(), conversation_id: cid, role: 'assistant', content: reply, created_at: now })
      saveDemo(db)
      return { reply, conversationId: cid }
    }
    return { reply: `[Démo — tâche « ${args.task} »]\n\n${args.prompt.slice(0, 400)}`, conversationId: null }
  }
  return invoke<AiResult>('bright-worker', args, "L'assistant est momentanément indisponible. Réessaie dans un instant.")
}

/** Envoie un fichier audio au serveur et reçoit le texte de ce qui y est dit. */
export async function transcribeAudio(file: File): Promise<string> {
  if (!isConfigured) {
    await new Promise((r) => setTimeout(r, 600))
    return '[Démo] Texte de ton audio.'
  }
  const fd = new FormData()
  fd.append('audio', file, file.name || 'audio')
  const r = await invoke<{ text: string }>('bright-worker', fd, "La transcription n'est pas disponible pour l'instant. Réessaie dans un instant.")
  return r.text
}

export async function listConversations(): Promise<Conversation[]> {
  if (!isConfigured) return loadDemo().convs
  const { data, error } = await sb().from('ai_conversations').select('id,title,created_at').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return data as Conversation[]
}

export async function listMessages(conversationId: string): Promise<Message[]> {
  if (!isConfigured) return loadDemo().msgs.filter((m) => m.conversation_id === conversationId)
  const { data, error } = await sb().from('ai_messages').select('id,role,content,created_at').eq('conversation_id', conversationId).order('created_at')
  if (error) throw error
  return data as Message[]
}

/* ---------------------------- PAIEMENTS ---------------------------- */

export async function listPayments(): Promise<Payment[]> {
  if (!isConfigured) return loadDemo().payments
  const { data, error } = await sb().from('payments').select('*').order('created_at', { ascending: false })
  if (error) throw error
  return data as Payment[]
}

export const PRICES = { USD: 4.99, CDF: 11000 } as const // affichage seulement : le serveur fixe le vrai montant
export const PRICE_LABEL = { USD: '4,99 USD', CDF: '11 000 FC' } as const

/** Le navigateur n'envoie PAS le montant : le serveur le déduit du plan et de la devise. */
export async function startPayment(provider: string, phone: string, currency: 'USD' | 'CDF'): Promise<{ message: string }> {
  if (!/^[0-9]{9}$/.test(phone.replace(/\s/g, ''))) fail('Entre ton numéro Mobile Money (9 chiffres, sans le +243).')
  if (!isConfigured) {
    const db = loadDemo()
    db.payments.unshift({
      id: uid(), provider, amount: PRICES[currency], currency, status: 'pending',
      provider_ref: 'DEMO-' + Math.random().toString(36).slice(2, 8).toUpperCase(), created_at: new Date().toISOString()
    })
    saveDemo(db)
    return { message: 'Mode démo : paiement simulé, en attente.' }
  }
  return invoke<{ message: string }>('payments-initiate', { provider, phone, currency, plan: 'monthly' }, "Le paiement n'a pas pu démarrer. Réessaie dans un instant.")
}

export async function hasPremium(userId: string): Promise<boolean> {
  if (!isConfigured) return loadDemo().payments.some((p) => p.status === 'paid')
  void userId
  const { data } = await sb().from('subscriptions').select('expires_at').gt('expires_at', new Date().toISOString()).limit(1)
  return (data ?? []).length > 0
}

/* ------------------- NOTIFICATIONS « LE SAVAIS-TU ? » ------------------- */

export async function savePushSubscription(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): Promise<void> {
  if (!isConfigured) return
  void userId // l'identité vient du jeton de connexion, côté serveur
  const { error } = await sb().rpc('register_push', { p_endpoint: sub.endpoint, p_p256dh: sub.p256dh, p_auth: sub.auth })
  if (error) throw error
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  if (!isConfigured) return
  const { error } = await sb().from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
