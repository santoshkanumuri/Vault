import type { LinkMetadata } from './utils/metadata';
export type { LinkMetadata };

export interface User {
  id: string;
  email: string;
  name: string;
  showMetadata: boolean;
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  userId: string;
  linkCount?: number;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  userId: string;
}

export interface Link {
  id: string;
  name: string;
  url: string;
  description: string;
  folderId: string;
  tagIds: string[];
  createdAt: string;
  userId: string;
  favicon?: string;
  metadata?: LinkMetadata;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string;
  tagIds: string[];
  createdAt: string;
  userId: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export interface AppState {
  folders: Folder[];
  tags: Tag[];
  links: Link[];
  notes: Note[];
  currentFolder: string | null;
  searchQuery: string;
  darkMode: boolean;
}