// Couche d'accès aux données. Chaque fonction a deux implémentations :
//  - Supabase (production) ; toute la sécurité repose sur les règles RLS de supabase/migrations
//  - Démo (localStorage) quand les clés Supabase sont absentes.
// Les pages n'appellent QUE ce fichier : changer de backend ne touche pas à l'interface.
import { isConfigured, supabase } from './supabase'
import { loadDemo, saveDemo, uid } from './demo'
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

export function onAuthChange(cb: () => void): () => void {
  if (!isConfigured) {
    window.addEventListener('memoa-demo-auth', cb)
    return () => window.removeEventListener('memoa-demo-auth', cb)
  }
  const { data } = sb().auth.onAuthStateChange(() => cb())
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

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('Choisis une image JPG, PNG ou WebP.')
  if (file.size > 3 * 1024 * 1024) fail('La photo ne doit pas dépasser 3 Mo.')
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

export async function listCourses(userId: string): Promise<Course[]> {
  if (!isConfigured) {
    const db = loadDemo()
    return db.courses
      .map((c) => ({ ...c, notes_count: db.notes.filter((n) => n.course_id === c.id).length }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  void userId
  const { data, error } = await sb()
    .from('courses')
    .select('id,title,created_at,notes(count)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: any) => ({
    id: c.id, title: c.title, created_at: c.created_at, notes_count: c.notes?.[0]?.count ?? 0
  }))
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
    return loadDemo().notes.filter((n) => n.course_id === courseId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  const { data, error } = await sb().from('notes').select('*').eq('course_id', courseId).order('created_at', { ascending: false })
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

export async function listDocs(promotion: string, faculty: string | null): Promise<LibDoc[]> {
  if (!isConfigured) {
    const db = loadDemo()
    return db.docs
      .filter((d) => d.promotion === promotion && (!faculty || d.faculty === faculty))
      .map((d) => ({ ...d, is_favorite: db.favs.includes(d.id) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  let q = sb().from('library_documents').select('*').eq('promotion', promotion).order('created_at', { ascending: false })
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
  input: { title: string; doc_type: string; university: string; faculty: string; promotion: string; course_title: string },
  file: File | null
): Promise<void> {
  if (!input.title.trim()) fail('Donne un titre à ton document.')
  if (file) {
    if (!ALLOWED_DOC_TYPES.includes(file.type)) fail('Seuls les fichiers PDF sont acceptés pour le moment.')
    if (file.size > MAX_DOC_BYTES) fail('Le fichier ne doit pas dépasser 20 Mo.')
  }
  if (!isConfigured) {
    const db = loadDemo()
    db.docs.push({ id: uid(), ...input, file_path: null, owner_id: userId, status: 'published', created_at: new Date().toISOString() })
    saveDemo(db)
    return
  }
  let file_path: string | null = null
  if (file) {
    file_path = `${userId}/${uid()}.pdf`
    const { error } = await sb().storage.from('library').upload(file_path, file, { contentType: 'application/pdf' })
    if (error) throw error
  }
  // Statut forcé à « pending » par la base : un administrateur Memoa valide avant publication.
  const { error } = await sb().from('library_documents').insert({ ...input, owner_id: userId, file_path })
  if (error) throw error
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

export async function docDownloadUrl(path: string | null): Promise<string | null> {
  if (!path || !isConfigured) return null
  const { data, error } = await sb().storage.from('library').createSignedUrl(path, 60)
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
async function invoke<T>(name: string, body: unknown, fallback: string): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body: body as Record<string, unknown> })
  if (!error) return data as T
  let msg = fallback
  const ctx = (error as { context?: Response }).context
  if (ctx && typeof ctx.json === 'function') {
    try {
      const j = await ctx.json()
      if (j && typeof j.error === 'string') msg = j.error
    } catch {
      /* corps illisible : on garde le message générique */
    }
  }
  throw new Error(msg)
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

export const PRICES = { USD: 4.5, CDF: 10500 } as const // affichage seulement : le serveur fixe le vrai montant

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
