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
      notes: {
        Row: {
          id: string
          title: string
          content: string
          folder_id: string
          user_id: string
          embedding: number[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          folder_id: string
          user_id: string
          embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          folder_id?: string
          user_id?: string
          embedding?: number[] | null
          created_at?: string
          updated_at?: string
        }
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
        }
      }
      background_tasks: {
        Row: {
          id: string
          user_id: string
          task_type: string
          entity_type: string
          entity_id: string
          status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          priority: number
          payload: Json | null
          result: Json | null
          error_message: string | null
          retry_count: number
          max_retries: number
          started_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          task_type: string
          entity_type: string
          entity_id: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          priority?: number
          payload?: Json | null
          result?: Json | null
          error_message?: string | null
          retry_count?: number
          max_retries?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          task_type?: string
          entity_type?: string
          entity_id?: string
          status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
          priority?: number
          payload?: Json | null
          result?: Json | null
          error_message?: string | null
          retry_count?: number
          max_retries?: number
          started_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
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