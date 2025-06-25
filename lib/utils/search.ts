import { Link, Folder, Tag, Note } from '../types';

// Simple fuzzy search implementation
const fuzzyMatch = (pattern: string, text: string): boolean => {
  const patternLower = pattern.toLowerCase();
  const textLower = text.toLowerCase();
  
  // Direct substring match
  if (textLower.includes(patternLower)) {
    return true;
  }
  
  // Character by character fuzzy matching
  let patternIndex = 0;
  for (let i = 0; i < textLower.length && patternIndex < patternLower.length; i++) {
    if (textLower[i] === patternLower[patternIndex]) {
      patternIndex++;
    }
  }
  
  return patternIndex === patternLower.length;
};

// Calculate relevance score
const calculateRelevance = (query: string, text: string): number => {
  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  if (textLower === queryLower) return 100;
  if (textLower.startsWith(queryLower)) return 90;
  if (textLower.includes(queryLower)) return 80;
  if (fuzzyMatch(queryLower, textLower)) return 60;
  
  return 0;
};

export interface SearchResult {
  link: Link;
  relevance: number;
  matchType: 'name' | 'description' | 'url' | 'tag' | 'folder' | 'metadata' | 'content';
}

export interface NoteSearchResult {
  note: Note;
  relevance: number;
  matchType: 'title' | 'content' | 'tag' | 'folder';
}

export interface CombinedSearchResult {
  type: 'link' | 'note';
  item: Link | Note;
  relevance: number;
  matchType: string;
}

export const searchLinks = (
  query: string,
  links: Link[],
  folders: Folder[],
  tags: Tag[]
): SearchResult[] => {
  if (!query.trim()) return [];
  
  const results: SearchResult[] = [];
  const folderMap = new Map(folders.map(f => [f.id, f]));
  const tagMap = new Map(tags.map(t => [t.id, t]));
  
  links.forEach(link => {
    let maxRelevance = 0;
    let matchType: SearchResult['matchType'] = 'name';
    
    // Search in link name
    const nameRelevance = calculateRelevance(query, link.name);
    if (nameRelevance > maxRelevance) {
      maxRelevance = nameRelevance;
      matchType = 'name';
    }
    
    // Search in description
    const descRelevance = calculateRelevance(query, link.description);
    if (descRelevance > maxRelevance) {
      maxRelevance = descRelevance;
      matchType = 'description';
    }
    
    // Search in URL
    const urlRelevance = calculateRelevance(query, link.url);
    if (urlRelevance > maxRelevance) {
      maxRelevance = urlRelevance;
      matchType = 'url';
    }
    
    // Search in metadata
    if (link.metadata) {
      const metadataTexts = [
        link.metadata.title || '',
        link.metadata.description || '',
        link.metadata.siteName || ''
      ];
      
      metadataTexts.forEach(text => {
        if (text) {
          const metadataRelevance = calculateRelevance(query, text);
          if (metadataRelevance > maxRelevance) {
            maxRelevance = metadataRelevance;
            matchType = 'metadata';
          }
        }
      });

      // Search in content
      if (link.metadata.content) {
        const contentRelevance = calculateRelevance(query, link.metadata.content);
        if (contentRelevance > maxRelevance) {
          maxRelevance = contentRelevance;
          matchType = 'content';
        }
      }
    }
    
    // Search in folder name
    const folder = folderMap.get(link.folderId);
    if (folder) {
      const folderRelevance = calculateRelevance(query, folder.name);
      if (folderRelevance > maxRelevance) {
        maxRelevance = folderRelevance;
        matchType = 'folder';
      }
    }
    
    // Search in tag names
    link.tagIds.forEach(tagId => {
      const tag = tagMap.get(tagId);
      if (tag) {
        const tagRelevance = calculateRelevance(query, tag.name);
        if (tagRelevance > maxRelevance) {
          maxRelevance = tagRelevance;
          matchType = 'tag';
        }
      }
    });
    
    if (maxRelevance > 0) {
      results.push({
        link,
        relevance: maxRelevance,
        matchType
      });
    }
  });
  
  // Sort by relevance (highest first)
  return results.sort((a, b) => b.relevance - a.relevance);
};

export const searchNotes = (
  query: string,
  notes: Note[],
  folders: Folder[],
  tags: Tag[]
): NoteSearchResult[] => {
  if (!query.trim()) return [];
  
  const folderMap = new Map(folders.map(f => [f.id, f]));
  const tagMap = new Map(tags.map(t => [t.id, t]));
  const results: NoteSearchResult[] = [];
  
  notes.forEach(note => {
    let maxRelevance = 0;
    let matchType: NoteSearchResult['matchType'] = 'title';
    
    // Search in title
    const titleRelevance = calculateRelevance(query, note.title);
    if (titleRelevance > maxRelevance) {
      maxRelevance = titleRelevance;
      matchType = 'title';
    }
    
    // Search in content
    const contentRelevance = calculateRelevance(query, note.content);
    if (contentRelevance > maxRelevance) {
      maxRelevance = contentRelevance;
      matchType = 'content';
    }
    
    // Search in folder name
    const folder = folderMap.get(note.folderId);
    if (folder) {
      const folderRelevance = calculateRelevance(query, folder.name);
      if (folderRelevance > maxRelevance) {
        maxRelevance = folderRelevance;
        matchType = 'folder';
      }
    }
    
    // Search in tag names
    note.tagIds.forEach(tagId => {
      const tag = tagMap.get(tagId);
      if (tag) {
        const tagRelevance = calculateRelevance(query, tag.name);
        if (tagRelevance > maxRelevance) {
          maxRelevance = tagRelevance;
          matchType = 'tag';
        }
      }
    });
    
    if (maxRelevance > 0) {
      results.push({
        note,
        relevance: maxRelevance,
        matchType
      });
    }
  });
  
  // Sort by relevance (highest first)
  return results.sort((a, b) => b.relevance - a.relevance);
};

export const searchAll = (
  query: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[]
): CombinedSearchResult[] => {
  if (!query.trim()) return [];

  const linkResults = searchLinks(query, links, folders, tags);
  const noteResults = searchNotes(query, notes, folders, tags);

  const combinedResults: CombinedSearchResult[] = [
    ...linkResults.map(result => ({
      type: 'link' as const,
      item: result.link,
      relevance: result.relevance,
      matchType: result.matchType,
    })),
    ...noteResults.map(result => ({
      type: 'note' as const,
      item: result.note,
      relevance: result.relevance,
      matchType: result.matchType,
    })),
  ];

  // Sort by relevance (highest first)
  return combinedResults.sort((a, b) => b.relevance - a.relevance);
};