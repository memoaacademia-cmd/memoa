// Couche d'accès aux données. Chaque fonction a deux implémentations :
//  - Supabase (production) ; toute la sécurité repose sur les règles RLS de supabase/migrations
//  - Démo (localStorage) quand les clés Supabase sont absentes.
// Les pages n'appellent QUE ce fichier : changer de backend ne touche pas à l'interface.
import { cacheCourses } from './outbox'
import { isConfigured, supabase } from './supabase'
import { loadDemo, saveDemo, uid } from './demo'
import { shrinkImage } from './image'
import type { AiTask, Conversation, Course, LibDoc, Message, Note, Payment, Profile } from './types'

export interface AuthUser {
  id: string
  email: string
  phone: string | null
  /** Compte Google qui n'a pas encore choisi son mot de passe ET ajouté son numéro : rien d'autre n'est accessible avant. */
  needsPassword: boolean
  /** Le mot de passe est déjà choisi (il ne manque alors que le numéro). */
  passwordSet: boolean
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

// Dernier étudiant connu sur ce téléphone : sert UNIQUEMENT quand le réseau coupe, pour ouvrir l'appli sans connexion.
const USER_CACHE = 'memoa-user-cache'
const readUserCache = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_CACHE)
    return raw ? (JSON.parse(raw) as AuthUser) : null
  } catch {
    return null
  }
}
const writeUserCache = (u: AuthUser | null) => {
  try {
    if (u) localStorage.setItem(USER_CACHE, JSON.stringify(u))
    else localStorage.removeItem(USER_CACHE)
  } catch {
    /* navigation privée : on ignore */
  }
}
const isNetworkFailure = (e: unknown) => {
  const x = e as { name?: string; message?: string } | null
  return (typeof navigator !== 'undefined' && !navigator.onLine) || x?.name === 'AuthRetryableFetchError' || /fetch|network|timeout/i.test(x?.message ?? '')
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.id === db.session)
    return u ? { id: u.id, email: u.email, phone: u.phone, needsPassword: u.password === '' || !u.phone, passwordSet: u.password !== '' } : null
  }
  let res: Awaited<ReturnType<ReturnType<typeof sb>['auth']['getSession']>>
  try {
    // Sans réseau, le renouvellement de la session peut traîner : au bout de 8 s on reprend le dernier étudiant connu.
    res = await Promise.race([
      sb().auth.getSession(),
      new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), 8000))
    ])
  } catch {
    return readUserCache()
  }
  const { data, error } = res
  const u = data.session?.user
  if (!u) {
    // Session illisible à cause du réseau (et non déconnexion réelle) : l'étudiant reste connecté.
    if (error && isNetworkFailure(error)) return readUserCache()
    writeUserCache(null)
    return null
  }
  // Compte Google : on regarde TOUS les moyens de connexion du compte, pas seulement le premier (« provider »).
  const providers = ((u.app_metadata?.providers as string[] | undefined) ?? []).concat(String(u.app_metadata?.provider ?? ''))
  const viaGoogle = providers.includes('google')
  // Un compte créé d'abord avec e-mail + mot de passe a déjà ses identifiants : on ne lui redemande rien.
  const hasEmailLogin = (u.identities ?? []).some((i) => i.provider === 'email')
  const phone = (u.user_metadata?.phone as string | undefined) ?? u.phone ?? null
  const phoneOk = String(phone ?? '').replace(/\D/g, '').length >= 9
  const passwordSet = hasEmailLogin || !!u.user_metadata?.password_set
  const user: AuthUser = {
    id: u.id,
    email: u.email ?? '',
    phone: phone || null,
    // Compte venu de Google : mot de passe ET numéro obligatoires, toujours, avant d'accéder à quoi que ce soit.
    needsPassword: viaGoogle && !hasEmailLogin && !(passwordSet && phoneOk),
    passwordSet
  }
  writeUserCache(user)
  return user
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
export async function setPasswordAndPhone(password: string | null, phone: string): Promise<void> {
  if (!isConfigured) {
    const db = loadDemo()
    const u = db.users.find((x) => x.id === db.session)
    if (u) {
      if (password) u.password = password
      u.phone = phone
      saveDemo(db)
    }
    return
  }
  const { error } = await sb().auth.updateUser({ ...(password ? { password } : {}), data: { phone, password_set: true } })
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
  writeUserCache(null)
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
  const list = (data ?? []).map((c: any) => ({
    id: c.id, title: c.title, created_at: c.created_at, notes_count: c.notes?.[0]?.count ?? 0
  }))
  // Liste gardée sur le téléphone : sert à choisir un cours quand on ajoute une note sans réseau.
  if (userId) cacheCourses(userId, list)
  return list
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

export interface NoteHit { id: string; course_id: string; title: string; snippet: string }

function snippetOf(content: string, q: string): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  const i = flat.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return flat.slice(0, 90)
  const start = Math.max(0, i - 30)
  return (start > 0 ? '…' : '') + flat.slice(start, start + 100)
}

/** Recherche dans les notes de l'étudiant (titre et texte). Sert uniquement à l'Accueil. */
export async function searchNotes(userId: string, query: string): Promise<NoteHit[]> {
  const q = query.replace(/[%,()_*\\]/g, ' ').trim()
  if (q.length < 2) return []
  if (!isConfigured) {
    const needle = q.toLowerCase()
    return loadDemo().notes
      .filter((n) => n.title.toLowerCase().includes(needle) || n.content.toLowerCase().includes(needle))
      .slice(0, 8)
      .map((n) => ({ id: n.id, course_id: n.course_id, title: n.title, snippet: snippetOf(n.content, q) }))
  }
  void userId
  const { data, error } = await sb()
    .from('notes')
    .select('id,course_id,title,content')
    .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    .order('created_at', { ascending: false })
    .limit(8)
  if (error) throw error
  return (data ?? []).map((n: any) => ({ id: n.id, course_id: n.course_id, title: n.title, snippet: snippetOf(n.content ?? '', q) }))
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

/** Modifie le titre et le texte d'une note existante (écran « Modifier » d'un cours). */
export async function updateNote(noteId: string, title: string, content: string): Promise<void> {
  if (!content.trim()) fail('Ton cours est vide.')
  if (content.length > 60000) fail('Ce texte est trop long. Découpe-le en plusieurs notes.')
  if (!isConfigured) {
    const db = loadDemo()
    const n = db.notes.find((x) => x.id === noteId)
    if (n) { n.title = title.trim() || n.title; n.content = content; saveDemo(db) }
    return
  }
  const { error } = await sb().from('notes').update({ title: title.trim() || 'Note', content }).eq('id', noteId)
  if (error) throw error
}

export async function renameCourse(id: string, title: string): Promise<void> {
  const clean = title.trim()
  if (!clean) fail('Donne un nom à ton cours.')
  if (!isConfigured) {
    const db = loadDemo()
    const c = db.courses.find((x) => x.id === id)
    if (c) { c.title = clean; saveDemo(db) }
    return
  }
  const { error } = await sb().from('courses').update({ title: clean }).eq('id', id)
  if (error) throw error
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


/** Points gratuits du jour : solde, maximum, et prochain renouvellement (minuit à Kinshasa). null pendant l'essai et avec Premium. */
export interface PointsInfo {
  left: number
  max: number
  resetAt: string
}

export interface AiResult {
  reply: string
  conversationId: string | null
  /** Solde de points après cette demande (absent en mode démo). */
  points?: PointsInfo | null
  /** Session de TP ouverte (ou réutilisée) par le serveur : à renvoyer avec les demandes suivantes du même TP. */
  tpSession?: string
}

/** Solde de points de l'étudiant, sans rien consommer. null = essai ou Premium (rien à afficher). */
export async function fetchPoints(): Promise<PointsInfo | null> {
  if (!isConfigured) return null
  const r = await invoke<{ points: PointsInfo | null }>('bright-worker', { task: 'balance' }, 'Solde indisponible.')
  return r.points ?? null
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
  /** « course » : création d'un cours depuis l'écran Nouveau cours (15 points au total). Le serveur vérifie et fixe le prix. */
  purpose?: 'course'
  /** Session de TP déjà payée (renvoyée par le serveur après le plan) : les ajustements et la rédaction ne coûtent plus rien. */
  tpSession?: string | null
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
  const res = await invoke<AiResult>('bright-worker', args, "L'assistant est momentanément indisponible. Réessaie dans un instant.")
  // Tout l'appli (Accueil, Assistant) affiche le nouveau solde tout de suite.
  if (res.points !== undefined) window.dispatchEvent(new CustomEvent('memoa-points', { detail: res.points }))
  return res
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
  return invoke<{ message: string }>('swift-worker', { provider, phone, currency, plan: 'monthly' }, "Le paiement n'a pas pu démarrer. Réessaie dans un instant.")
}

export async function hasPremium(userId: string): Promise<boolean> {
  if (!isConfigured) return loadDemo().payments.some((p) => p.status === 'paid')
  void userId
  const { data } = await sb().from('subscriptions').select('expires_at').gt('expires_at', new Date().toISOString()).limit(1)
  return (data ?? []).length > 0
}

/** Dernier abonnement de l'étudiant (actif ou terminé), ou null s'il n'en a jamais eu. */
export async function getSubscription(userId: string): Promise<{ expires_at: string } | null> {
  if (!isConfigured) {
    const paid = loadDemo().payments.filter((p) => p.status === 'paid').sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    return paid ? { expires_at: new Date(new Date(paid.created_at).getTime() + 30 * 86_400_000).toISOString() } : null
  }
  void userId
  const { data } = await sb().from('subscriptions').select('expires_at').eq('user_id', userId).order('expires_at', { ascending: false }).limit(1)
  return data?.[0] ? { expires_at: data[0].expires_at as string } : null
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
