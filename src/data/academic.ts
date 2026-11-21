// Source : Répertoires académiques UPN et UNIKIN 2026-2027 (colonne « Départements & Mentions »).
// Académie des Beaux-Arts de Kinshasa (ABA-KIN) : référentiel officiel LMD (academie-kinshasa.cd), voir ABA_RULES plus bas.
// ULK, UPC et UCC : listes de départ à relire par l'équipe ; l'étudiant peut toujours écrire sa propre faculté ou son département.
// Modèle : Université → Faculté → Département. Les étudiants peuvent toujours écrire leur propre valeur.
export const CATALOGUE: Record<string, Record<string, string[]>> = {
  "Université Pédagogique Nationale (UPN)": {
    "Faculté de Droit": [
      "Droit",
      "Avocature"
    ],
    "Faculté des Sciences Économiques et de Gestion": [
      "Sciences Économiques",
      "Informatique de Gestion (IG/IAG)",
      "Fiscalité"
    ],
    "Faculté des Lettres et Sciences Humaines": [
      "Lettres & Civilisations Françaises",
      "Lettres & Civilisations Anglaises",
      "Anglais & Informatique d'Affaires",
      "Sciences Historiques",
      "Philosophie",
      "Langues & Afrikanistique"
    ],
    "Faculté de Psychologie et des Sciences de l'Éducation": [
      "Sciences de l'Éducation",
      "Psychologie",
      "Orientation Scolaire (OSP)",
      "Gestion des Entreprises (GEOT)"
    ],
    "Faculté des Sciences Sociales, Administratives et Politiques": [
      "Sciences Politiques & Administratives",
      "Relations Internationales",
      "Sociologie & Anthropologie",
      "Sciences des Religions"
    ],
    "Faculté des Sciences de la Santé": [
      "Sciences Infirmières",
      "Biologie Médicale",
      "Nutrition & Diététique",
      "Sage-Femmes"
    ],
    "Faculté de Pédagogie et Didactique des Disciplines": [
      "Pédagogie Générale",
      "Didactique des Disciplines",
      "Petite Enfance",
      "Agrégation"
    ],
    "Faculté des Sciences et Technologies": [
      "Math-Informatique (MI)",
      "Physique",
      "Chimie",
      "Géographie & Environnement",
      "Génie & Télécoms"
    ],
    "Faculté des Sciences Agronomiques et Environnement": [
      "Agronomie Généraliste",
      "Ressources Naturelles",
      "Économie Agricole"
    ],
    "Faculté de Médecine Vétérinaire": [
      "Médecine Vétérinaire"
    ]
  },
  "Université de Kinshasa (UNIKIN)": {
    "Faculté de Droit": [
      "Droit Public / Privé",
      "Droit Économique & Social / International"
    ],
    "Faculté des Sciences Économiques et de Gestion (FASEG)": [
      "Sciences Économiques",
      "Gestion & Administration",
      "Informatique de Gestion (IAG)"
    ],
    "Faculté de Médecine": [
      "Médecine Générale",
      "Biologie Médicale",
      "Chirurgie & Spécialités"
    ],
    "Faculté de Médecine Dentaire": [
      "Stomatologie & Dentaire"
    ],
    "Faculté des Sciences Pharmaceutiques (FSP)": [
      "Pharmacie Industrielle",
      "Chimie Analytique",
      "Pharmacologie"
    ],
    "Faculté Polytechnique": [
      "Génie Civil / Électrique",
      "Génie Mécanique",
      "Chimique & Métallurgie"
    ],
    "Faculté des Sciences et Technologies": [
      "Math-Info & Statistique",
      "Physique / Chimie",
      "Géosciences & Environnement"
    ],
    "Faculté de Pétrole, Gaz & Énergies Nouvelles": [
      "Exploration & Production",
      "Raffinage & Pétrochimie",
      "Énergies Renouvelables"
    ],
    "Faculté des Lettres & Sciences Humaines (FLSH)": [
      "Langues & Littératures",
      "Histoire / Philosophie",
      "Information & Communication (SIC)"
    ],
    "Faculté de Psychologie et Sciences de l'Éducation": [
      "Psychologie / Sciences de l'Éducation",
      "Gestion des Entreprises (GEOT)",
      "Agrégation"
    ],
    "Faculté des Sciences Sociales, Administratives & Politiques": [
      "Sciences Politiques & Administratives",
      "Relations Internationales",
      "Sociologie & Anthropologie"
    ],
    "Faculté des Sciences Agronomiques & Environnement": [
      "Phytotechnie / Zootechnie",
      "Économie Agricole / Sol",
      "Eaux et Forêts"
    ],
    "Faculté de Médecine Vétérinaire": [
      "Anatomie & Pathologie"
    ],
    "École de Santé Publique (ESP-UNIKIN)": [
      "Épidémiologie / Bio-statistique",
      "Santé Communautaire"
    ]
  },
  "Université Libre de Kinshasa (ULK)": {
    "Faculté de Droit": [
      "Droit Privé et Judiciaire",
      "Droit Public",
      "Droit Économique et Social"
    ],
    "Faculté des Sciences Économiques": [
      "Sciences Économiques",
      "Gestion Financière"
    ],
    "Faculté d'Informatique de Gestion": [
      "Informatique de Gestion"
    ],
    "Faculté des Sciences Sociales, Politiques et Administratives": [
      "Sciences Politiques et Administratives",
      "Relations Internationales"
    ],
    "Faculté de Médecine": [
      "Médecine"
    ]
  },
  "Université Protestante au Congo (UPC)": {
    "Faculté de Droit": [
      "Droit Privé et Judiciaire",
      "Droit Public",
      "Droit Économique et Social"
    ],
    "Faculté des Sciences Économiques et de Gestion": [
      "Sciences Économiques",
      "Gestion"
    ],
    "Faculté de Médecine": [
      "Médecine"
    ],
    "Faculté de Théologie": [
      "Théologie"
    ]
  },
  "Université Catholique du Congo (UCC)": {
    "Faculté de Théologie": [
      "Théologie"
    ],
    "Faculté de Droit Canonique": [
      "Droit Canonique"
    ],
    "Faculté de Philosophie": [
      "Philosophie"
    ],
    "Faculté de Droit": [
      "Droit"
    ],
    "Faculté d'Économie et Développement": [
      "Économie et Développement"
    ],
    "Faculté de Sciences Politiques": [
      "Sciences Politiques"
    ],
    "Faculté de Communication": [
      "Sciences et Techniques de la Communication"
    ]
  },
  "Académie des Beaux-Arts de Kinshasa (ABA-KIN)": {
    "Licence Transversale": [
      "Licence Transversale"
    ],
    "Arts Plastiques": [
      "Sculpture",
      "Peinture",
      "Céramique",
      "Métal",
      "Conservation et Restauration d'œuvres d'art"
    ],
    "Arts Graphiques": [
      "Communication Visuelle",
      "Architecture d'Intérieur",
      "Photographie",
      "Design",
      "Design – Design d'objet et mobilier",
      "Design – Design textile",
      "Design – Design urbain",
      "Design – Design industriel"
    ]
  }
}

/** « Préparatoire » : année avant la L1 dans certaines universités. */
export const PROMOTIONS = ['Préparatoire', 'L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat'] as const
export type Promotion = (typeof PROMOTIONS)[number]

export const VACATIONS = ['Vacation jour', 'Vacation soir', 'Vacation A', 'Vacation B', 'Vacation C'] as const


/* ── Règles propres à l'Académie des Beaux-Arts (ABA-KIN) ──
   • pas d'année préparatoire ;
   • L1 = tronc commun « Licence Transversale » (faculté et département verrouillés) ;
   • dès la L2 : Arts Plastiques ou Arts Graphiques seulement. */
export const ABA = 'Académie des Beaux-Arts de Kinshasa (ABA-KIN)'
const ABA_TRONC = 'Licence Transversale'

/** Promotions proposées pour une université (l'ABA n'a pas de préparatoire). */
export function promotionsFor(university: string | undefined): string[] {
  return university === ABA ? PROMOTIONS.filter((p) => p !== 'Préparatoire') : [...PROMOTIONS]
}

/** Facultés proposées selon l'université ET la promotion choisies. */
export function facultiesAvailable(university: string, promo: string): string[] {
  const all = Object.keys(CATALOGUE[university] ?? {})
  if (university !== ABA) return all
  return promo === 'L1' ? all.filter((f) => f === ABA_TRONC) : all.filter((f) => f !== ABA_TRONC)
}

/** Valeur imposée (L1 de l'ABA) : { fac, dep }, sinon null. */
export function lockedFor(university: string, promo: string): { fac: string; dep: string } | null {
  return university === ABA && promo === 'L1' ? { fac: ABA_TRONC, dep: ABA_TRONC } : null
}

export const OTHER_UNIV = "Autre université (je l'écris moi-même)"
export const OTHER_FAC = "Autre faculté (je l'écris moi-même)"
export const OTHER_DEP = "Autre département (je l'écris moi-même)"

/** Toutes les facultés connues (sans doublon), pour filtrer la Librairie. */
export function allFaculties(): string[] {
  const set = new Set<string>()
  Object.values(CATALOGUE).forEach((u) => Object.keys(u).forEach((f) => set.add(f)))
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}

/** Facultés de l'université de l'étudiant d'abord, puis les autres. */
export function facultiesFor(university: string | undefined): string[] {
  const own = university && CATALOGUE[university] ? Object.keys(CATALOGUE[university]) : []
  const rest = allFaculties().filter((f) => !own.includes(f))
  return [...own.sort((a, b) => a.localeCompare(b, 'fr')), ...rest]
}

/** Logos intégrés à Memoa (dossier public/logos). Utilisés tels quels, sans laisser croire que le document est officiel. */
const LOGOS: Record<string, string> = {
  'Université Pédagogique Nationale (UPN)': 'upn',
  'Université de Kinshasa (UNIKIN)': 'unikin',
  'Université Libre de Kinshasa (ULK)': 'ulk',
  'Université Protestante au Congo (UPC)': 'upc',
  'Université Catholique du Congo (UCC)': 'ucc',
  'Académie des Beaux-Arts de Kinshasa (ABA-KIN)': 'aba'
}

export function logoUrlFor(university: string | undefined): string | null {
  const k = university ? LOGOS[university] : undefined
  return k ? `${import.meta.env.BASE_URL}logos/${k}.png` : null
}

/** Nom sans sigle entre parenthèses : « Université Pédagogique Nationale (UPN) » → « Université Pédagogique Nationale ». */
export function universityLabel(university: string): string {
  return university.replace(/\s*\([^)]*\)\s*$/, '')
}
