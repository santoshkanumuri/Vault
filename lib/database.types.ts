export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          show_metadata: boolean
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          show_metadata?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          show_metadata?: boolean
          created_at?: string
        }
      }
      folders: {
        Row: {
          id: string
          name: string
          color: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          user_id?: string
          created_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          color: string
          user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          color: string
          user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          color?: string
          user_id?: string
          created_at?: string
        }
      }
      links: {
        Row: {
          id: string
          name: string
          url: string
          description: string
          folder_id: string
          user_id: string
          favicon: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          description: string
          folder_id: string
          user_id: string
          favicon?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          description?: string
          folder_id?: string
          user_id?: string
          favicon?: string | null
          metadata?: Json | null
          created_at?: string
        }
      }
      link_tags: {
        Row: {
          link_id: string
          tag_id: string
        }
        Insert: {
          link_id: string
          tag_id: string
        }
        Update: {
          link_id?: string
          tag_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}