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

// Text chunk for embedding
export interface TextChunk {
  id: string;
  text: string;
  index: number;
  embedding?: number[];
}

// Extended link metadata with content and embeddings
export interface LinkContent {
  fullText: string;
  contentType: 'article' | 'tweet' | 'video' | 'webpage' | 'unknown';
  author?: string;
  publishedDate?: string;
  wordCount: number;
  chunks?: TextChunk[];
  embedding?: number[];  // Average embedding of all chunks
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
  // Fields for semantic search (stored directly in database)
  fullContent?: string;
  contentType?: string;
  author?: string;
  wordCount?: number;
  embedding?: number[];
  chunks?: TextChunk[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string;
  tagIds: string[];
  createdAt: string;
  userId: string;
  // New fields for semantic search
  chunks?: TextChunk[];
  embedding?: number[];
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

// Search result types
export interface SearchMatch {
  type: 'keyword' | 'semantic' | 'hybrid';
  score: number;
  field: string;
  chunkIndex?: number;
  highlightText?: string;
}

export interface HybridSearchResult {
  type: 'link' | 'note';
  item: Link | Note;
  keywordScore: number;
  semanticScore: number;
  combinedScore: number;
  matches: SearchMatch[];
}
