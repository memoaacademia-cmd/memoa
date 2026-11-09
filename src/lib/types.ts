export interface Profile {
  id: string
  full_name: string
  last_name: string
  post_name: string
  first_name: string
  phone: string | null
  university: string
  faculty: string
  department: string
  promotion: string
  vacation: string
  avatar_url: string | null
  memo_animal: string | null
  memo_name: string | null
}

export interface Course {
  id: string
  title: string
  created_at: string
  notes_count: number
  /** Rempli quand le cours est dans la corbeille (restaurable 30 jours). */
  deleted_at?: string | null
}

export interface Note {
  id: string
  course_id: string
  title: string
  content: string
  source: string
  created_at: string
}

export interface LibDoc {
  id: string
  title: string
  doc_type: string
  university: string
  faculty: string
  promotion: string
  course_title: string
  file_path: string | null
  owner_id: string
  status: 'pending' | 'published'
  created_at: string
  is_favorite?: boolean
}

export interface Conversation {
  id: string
  title: string
  created_at: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Payment {
  id: string
  provider: string
  amount: number
  currency: 'USD' | 'CDF'
  status: 'pending' | 'paid' | 'failed'
  provider_ref: string | null
  created_at: string
}

export type AiTask = 'chat' | 'structure_notes' | 'quiz' | 'tp_plan' | 'tp_write'
