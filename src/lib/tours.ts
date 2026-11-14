// Visites guidées de Memoa : définition des parcours et sauvegarde de la progression.
//
// Principe : chaque page principale a SA petite visite (4 à 7 étapes), lancée automatiquement à la
// première arrivée de l'étudiant sur la page, puis relançable depuis « Moi › Visites guidées ».
// Un élément visé est repéré par l'attribut `data-tour="…"` posé dans les pages. Si cet élément
// n'existe pas (page vide, option indisponible…), l'étape est simplement sautée.
import { readAccountTours, writeAccountTours } from './api'

export type TourId = 'home' | 'courses' | 'course' | 'new-course' | 'library' | 'assistant' | 'me'
export type TourStatus = 'done' | 'skipped'
export type TourProgress = Partial<Record<TourId, TourStatus>>

export interface TourStep {
  /** Valeur(s) de data-tour à mettre en évidence ; la première trouvée est utilisée. Absent = bulle centrée. */
  target?: string | string[]
  /** Petit libellé au-dessus du texte (ex. « Tes points »). */
  tag: string
  /** Icône de ui.tsx affichée dans le libellé. */
  icon: string
  /** {first} = prénom de l'étudiant, {memo} = nom de son Memo. */
  text: string
}

export interface TourDef {
  id: TourId
  /** Nom affiché dans la liste « Visites guidées ». */
  title: string
  /** Courte description pour la liste. */
  sub: string
  /** Page de départ quand on relance la visite. */
  route: string
  /** Vrai si la visite s'applique au chemin donné. */
  match: (pathname: string) => boolean
  steps: TourStep[]
}

export const TOURS: TourDef[] = [
  {
    id: 'home',
    title: 'Accueil',
    sub: 'Recherche, cours, série et fait du jour',
    route: '/',
    match: (p) => p === '/',
    steps: [
      { tag: 'Ton accueil', icon: 'sparkle', text: 'Voilà ton accueil, {first} ! Je te montre l’essentiel en quelques secondes. Tu peux m’arrêter quand tu veux avec « Passer ».' },
      { target: 'home-points', tag: 'Tes points', icon: 'bolt', text: 'Ce petit éclair affiche les points qu’il te reste aujourd’hui.' },
      { target: 'home-search', tag: 'Recherche', icon: 'search', text: 'Cherche un mot, une idée, une définition : je retrouve la bonne note dans tous tes cours.' },
      { target: 'home-resume', tag: 'Reprendre', icon: 'play', text: 'Ton dernier cours est toujours à portée de pouce : touche-le pour reprendre là où tu t’étais arrêté.' },
      { target: 'home-courses', tag: 'Tes cours', icon: 'book', text: 'Tous tes cours défilent ici. Glisse sur le côté pour les voir, touche-en un pour l’ouvrir.' },
      { target: 'home-memo', tag: 'Ta série', icon: 'flame', text: 'Je suis là chaque jour. Plus tu révises régulièrement, plus ta série grandit… et plus je suis content !' },
      { target: 'home-fact', tag: 'Le savais-tu ?', icon: 'sparkle', text: 'Chaque jour, un fait surprenant à découvrir. Une petite pause pour la curiosité.' },
      { target: 'nav', tag: 'Ta barre du bas', icon: 'home', text: 'Ici, tu passes d’une page à l’autre. Chaque page a sa petite visite à ta première arrivée, et tu peux les revoir dans Moi › Visites guidées.' }
    ]
  },
  {
    id: 'courses',
    title: 'Mes cours',
    sub: 'Créer, chercher et ouvrir tes cours',
    route: '/sac',
    match: (p) => p === '/sac',
    steps: [
      { target: 'courses-new', tag: 'Nouveau cours', icon: 'plus', text: 'Ton sac à dos range tous tes cours. Pour en créer un, c’est ici.' },
      { target: 'courses-search', tag: 'Chercher', icon: 'search', text: 'Beaucoup de cours ? Retrouve-les en tapant une partie de leur titre.' },
      { target: 'courses-list', tag: 'Ouvrir un cours', icon: 'book', text: 'Touche un cours pour l’ouvrir : tes notes, le quiz, le résumé et les outils t’y attendent. J’y ferai aussi une petite visite.' }
    ]
  },
  {
    id: 'course',
    title: 'Un cours',
    sub: 'Notes, quiz, audio, PDF et assistant TP',
    route: '/sac',
    match: (p) => /^\/sac\/[^/]+$/.test(p),
    steps: [
      { target: 'course-add', tag: 'Ajouter une note', icon: 'plus', text: 'Écris, dicte, photographie ou importe un document : chaque note est rangée dans ce cours.' },
      { target: 'course-modify', tag: 'Modifier', icon: 'pencil', text: 'Relis et corrige ton cours avant de le mettre en PDF.' },
      { target: 'course-revise', tag: 'Réviser', icon: 'quiz', text: 'Je te pose un quiz tiré de tes propres notes, avec la correction. Il faut une connexion.' },
      { target: 'course-listen', tag: 'Écouter', icon: 'headphones', text: 'Je te lis ton cours à voix haute : pratique dans le bus ou en marchant.' },
      { target: 'course-pdf', tag: 'Lire le PDF', icon: 'pdf', text: 'Ouvre ton cours mis en page, prêt à relire. Tu peux aussi le télécharger juste en dessous.' },
      { target: 'course-tp', tag: 'Assistant TP', icon: 'book', text: 'Un travail pratique à rendre ? On fait le plan ensemble, je rédige, et tu télécharges un PDF avec ta page de garde.' }
    ]
  },
  {
    id: 'new-course',
    title: 'Créer un cours',
    sub: 'Titre, texte, photo, voix et consignes',
    route: '/cours',
    match: (p) => p === '/cours',
    steps: [
      { target: 'editor-title', tag: 'Le titre', icon: 'text', text: 'Donne un titre à ton cours : le nom de la matière ou du chapitre, par exemple.' },
      { target: 'editor-body', tag: 'Ton texte', icon: 'pencil', text: 'Écris ou colle ton cours ici. Tu peux aussi le créer vide et ajouter des notes plus tard.' },
      { target: 'editor-bar', tag: 'Sans taper', icon: 'photo', text: 'Pas envie d’écrire ? Photographie ton cahier, enregistre ta voix ou ajoute un document avec le +.' },
      { target: 'editor-guide', tag: 'Tes consignes', icon: 'sparkle', text: 'Dis-moi comment mettre ta note en forme, ou demande-moi de rédiger le cours à ta place.' },
      { target: 'editor-done', tag: 'Terminer', icon: 'check', text: 'Quand c’est prêt, touche ce bouton. Tu peux aussi garder un brouillon pour y revenir plus tard.' }
    ]
  },
  {
    id: 'library',
    title: 'Librairie',
    sub: 'Documents partagés par ta promotion',
    route: '/librairie',
    match: (p) => p === '/librairie',
    steps: [
      { target: 'lib-search', tag: 'Chercher', icon: 'search', text: 'Cherche un document ou un cours partagé par d’autres étudiants.' },
      { target: 'lib-filters', tag: 'Filtrer', icon: 'shelf', text: 'Affine par faculté et par promotion pour tomber tout de suite sur ce qui te concerne.' },
      { target: 'lib-publish', tag: 'Partager', icon: 'upload', text: 'Tu as de bonnes notes ? Publie-les pour aider ta promotion.' },
      { target: 'lib-list', tag: 'Les documents', icon: 'pdf', text: 'Les documents partagés apparaissent ici : touche « Voir » pour les lire, ou l’étoile pour les garder en favoris.' }
    ]
  },
  {
    id: 'assistant',
    title: 'Assistant',
    sub: 'Poser tes questions à {memo}',
    route: '/assistant',
    match: (p) => p === '/assistant',
    steps: [
      { target: 'as-menu', tag: 'Historique', icon: 'menu', text: 'Retrouve tes anciennes conversations ici, ou démarre-en une nouvelle.' },
      { target: 'as-course', tag: 'Tes notes', icon: 'book', text: 'Choisis un cours : je m’appuie alors sur tes notes pour te répondre.' },
      { target: 'as-composer', tag: 'Pose ta question', icon: 'chat', text: 'Écris ou dicte ta question ici. Tu peux aussi joindre une photo ou un document avec le +.' }
    ]
  },
  {
    id: 'me',
    title: 'Mon profil',
    sub: 'Profil, Memo, réglages et aide',
    route: '/moi',
    match: (p) => p === '/moi',
    steps: [
      { target: 'me-profile', tag: 'Ton profil', icon: 'user', text: 'Ton université, ta faculté, ta promotion : garde-les à jour pour que tes travaux aient la bonne page de garde.' },
      { target: 'me-memo', tag: 'Ton Memo', icon: 'sparkle', text: 'Je suis ton compagnon d’étude. Tu peux me changer d’animal quand tu veux.' },
      { target: 'me-settings', tag: 'Réglages', icon: 'gear', text: 'Notifications, thème, langue et déconnexion se trouvent ici.' },
      { target: 'me-tours', tag: 'Visites guidées', icon: 'sparkle', text: 'Une visite t’a échappé ? Tu peux les revoir toutes ici, quand tu veux.' }
    ]
  }
]

export const tourById = (id: TourId): TourDef => TOURS.find((t) => t.id === id) as TourDef
export const tourForPath = (pathname: string): TourDef | undefined => TOURS.find((t) => t.match(pathname))

/** Remplace {first} et {memo} dans un texte de visite. */
export const fillTour = (text: string, vars: { first: string; memo: string }) => text.replace(/\{first\}/g, vars.first).replace(/\{memo\}/g, vars.memo)

/* ------------------------- Sauvegarde de la progression ------------------------- */
// Copie locale par compte (toujours disponible, y compris hors connexion) + copie liée au compte
// (métadonnées d'authentification : aucune migration SQL, elle suit l'étudiant d'un téléphone à l'autre).
const KEY = (uid: string) => `memoa-tours-v1:${uid}`
const VALID: TourStatus[] = ['done', 'skipped']
const IDS = TOURS.map((t) => t.id)

function clean(raw: unknown): TourProgress {
  const out: TourProgress = {}
  if (raw && typeof raw === 'object') {
    for (const id of IDS) {
      const v = (raw as Record<string, unknown>)[id]
      if (typeof v === 'string' && (VALID as string[]).includes(v)) out[id] = v as TourStatus
    }
  }
  return out
}

export function readLocalProgress(uid: string): TourProgress {
  try {
    const raw = localStorage.getItem(KEY(uid))
    return raw ? clean(JSON.parse(raw)) : {}
  } catch {
    return {}
  }
}

export function writeLocalProgress(uid: string, p: TourProgress) {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(p))
  } catch {
    /* stockage indisponible : la progression vaut pour la session seulement */
  }
}

/** Progression locale + celle du compte (union : une visite déjà vue quelque part n'est pas reproposée). */
export async function loadProgress(uid: string): Promise<TourProgress> {
  const local = readLocalProgress(uid)
  let account: TourProgress = {}
  try {
    account = clean(await readAccountTours(uid))
  } catch {
    /* réseau coupé : la copie locale suffit */
  }
  const merged: TourProgress = { ...account, ...local }
  writeLocalProgress(uid, merged)
  return merged
}

let pushTimer: number | undefined
/** Enregistre la progression sur l'appareil tout de suite, et sur le compte juste après (sans jamais bloquer l'interface). */
export function saveProgress(uid: string, p: TourProgress) {
  writeLocalProgress(uid, p)
  window.clearTimeout(pushTimer)
  pushTimer = window.setTimeout(() => {
    void writeAccountTours(uid, p).catch(() => { /* hors connexion : la copie locale reste la référence */ })
  }, 400)
}
