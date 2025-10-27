import type { User, Session } from '@supabase/supabase-js'

export interface AuthUser {
  id: string
  email: string | undefined
  username: string | undefined
  avatar_url: string | undefined
}

export interface AuthState {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  error: string | null
}

export interface PDF {
  id: string
  user_id: string
  filename: string
  file_path: string
  share_token: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  pdf_id: string
  x: number
  y: number
  page: number
  text: string
  author_name?: string
  created_at: string
}

export type { User, Session }
