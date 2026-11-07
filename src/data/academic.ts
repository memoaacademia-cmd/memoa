// Source : Répertoires académiques UPN et UNIKIN 2026-2027 (colonne « Départements & Mentions »).
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
  }
}

export const PROMOTIONS = ['L1', 'L2', 'L3', 'Master 1', 'Master 2', 'Doctorat'] as const
export type Promotion = (typeof PROMOTIONS)[number]

export const VACATIONS = ['Vacation jour', 'Vacation soir', 'Vacation A', 'Vacation B', 'Vacation C'] as const

export const OTHER_UNIV = "Autre université (je l'écris moi-même)"
export const OTHER_FAC = "Autre faculté (je l'écris moi-même)"
export const OTHER_DEP = "Autre département (je l'écris moi-même)"

/** Toutes les facultés connues (sans doublon), pour filtrer la Librairie. */
export function allFaculties(): string[] {
  const set = new Set<string>()
  Object.values(CATALOGUE).forEach((u) => Object.keys(u).forEach((f) => set.add(f)))
  return [...set].sort((a, b) => a.localeCompare(b, 'fr'))
}
