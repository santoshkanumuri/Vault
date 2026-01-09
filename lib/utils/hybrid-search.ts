// Hybrid Search System
// Combines keyword/text search with semantic/embedding search

import { Link, Note, Folder, Tag, HybridSearchResult, SearchMatch } from '../types';
import { generateEmbedding, cosineSimilarity, EmbeddingConfig } from './embeddings';
import { smartSearch, SmartSearchResult } from './smart-search';

export interface HybridSearchConfig {
  keywordWeight?: number;      // Weight for keyword search (0-1), default 0.4
  semanticWeight?: number;     // Weight for semantic search (0-1), default 0.6
  minScore?: number;           // Minimum combined score to include, default 0.1
  topK?: number;               // Max results to return, default 20
  embeddingConfig?: EmbeddingConfig;
}

const DEFAULT_CONFIG: HybridSearchConfig = {
  keywordWeight: 0.4,
  semanticWeight: 0.6,
  minScore: 0.1,
  topK: 20,
};

// Calculate semantic similarity for a link
const calculateLinkSemanticScore = async (
  queryEmbedding: number[],
  link: Link
): Promise<{ score: number; matches: SearchMatch[] }> => {
  const matches: SearchMatch[] = [];
  let maxScore = 0;
  
  // Check link-level embedding
  if (link.embedding && Array.isArray(link.embedding) && link.embedding.length > 0) {
    const similarity = cosineSimilarity(queryEmbedding, link.embedding);
    if (similarity > maxScore) {
      maxScore = similarity;
      matches.push({
        type: 'semantic',
        score: similarity,
        field: 'content',
      });
    }
  }
  
  // Check chunk-level embeddings
  if (link.chunks) {
    for (let i = 0; i < link.chunks.length; i++) {
      const chunk = link.chunks[i];
      if (chunk.embedding && chunk.embedding.length > 0) {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (similarity > 0.5) {
          matches.push({
            type: 'semantic',
            score: similarity,
            field: 'chunk',
            chunkIndex: i,
            highlightText: chunk.text.slice(0, 100) + '...',
          });
          if (similarity > maxScore) {
            maxScore = similarity;
          }
        }
      }
    }
  }
  
  return { score: maxScore, matches };
};

// Calculate semantic similarity for a note
const calculateNoteSemanticScore = async (
  queryEmbedding: number[],
  note: Note
): Promise<{ score: number; matches: SearchMatch[] }> => {
  const matches: SearchMatch[] = [];
  let maxScore = 0;
  
  // Check note-level embedding
  if (note.embedding && Array.isArray(note.embedding) && note.embedding.length > 0) {
    const similarity = cosineSimilarity(queryEmbedding, note.embedding);
    if (similarity > maxScore) {
      maxScore = similarity;
      matches.push({
        type: 'semantic',
        score: similarity,
        field: 'content',
      });
    }
  }
  
  // Check chunk-level embeddings
  if (note.chunks) {
    for (let i = 0; i < note.chunks.length; i++) {
      const chunk = note.chunks[i];
      if (chunk.embedding && chunk.embedding.length > 0) {
        const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
        if (similarity > 0.5) {
          matches.push({
            type: 'semantic',
            score: similarity,
            field: 'chunk',
            chunkIndex: i,
            highlightText: chunk.text.slice(0, 100) + '...',
          });
          if (similarity > maxScore) {
            maxScore = similarity;
          }
        }
      }
    }
  }
  
  return { score: maxScore, matches };
};

// Main hybrid search function
export const hybridSearch = async (
  query: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[],
  config: HybridSearchConfig = {}
): Promise<HybridSearchResult[]> => {
  const opts = { ...DEFAULT_CONFIG, ...config };
  
  if (!query.trim()) {
    return [];
  }
  
  // Step 1: Get keyword search results
  const keywordResults = smartSearch(query, links, notes, folders, tags);
  
  // Create maps for quick lookup
  const keywordScores = new Map<string, SmartSearchResult>();
  keywordResults.forEach(result => {
    const key = `${result.type}-${result.item.id}`;
    keywordScores.set(key, result);
  });
  
  // Step 2: Generate query embedding for semantic search
  let queryEmbedding: number[] | null = null;
  try {
    const embeddingResult = await generateEmbedding(query, opts.embeddingConfig);
    if (embeddingResult) {
      queryEmbedding = embeddingResult.embedding;
    }
  } catch (error) {
    console.warn('Failed to generate query embedding:', error);
  }
  
  // Step 3: Calculate combined scores
  const results: HybridSearchResult[] = [];
  const processedIds = new Set<string>();
  
  // Process links
  for (const link of links) {
    const itemKey = `link-${link.id}`;
    processedIds.add(itemKey);
    
    // Get keyword score
    const keywordResult = keywordScores.get(itemKey);
    const keywordScore = keywordResult ? keywordResult.score / 100 : 0;
    
    // Get semantic score
    let semanticScore = 0;
    let semanticMatches: SearchMatch[] = [];
    
    if (queryEmbedding && (link.embedding || link.chunks?.some(c => c.embedding))) {
      const semanticResult = await calculateLinkSemanticScore(queryEmbedding, link);
      semanticScore = semanticResult.score;
      semanticMatches = semanticResult.matches;
    }
    
    // Calculate combined score
    const combinedScore = (keywordScore * opts.keywordWeight!) + (semanticScore * opts.semanticWeight!);
    
    if (combinedScore >= opts.minScore!) {
      const matches: SearchMatch[] = [];
      
      if (keywordScore > 0 && keywordResult) {
        matches.push({
          type: 'keyword',
          score: keywordScore,
          field: keywordResult.matchDetails[0]?.field || 'name',
        });
      }
      
      matches.push(...semanticMatches);
      
      results.push({
        type: 'link',
        item: link,
        keywordScore,
        semanticScore,
        combinedScore,
        matches,
      });
    }
  }
  
  // Process notes
  for (const note of notes) {
    const itemKey = `note-${note.id}`;
    processedIds.add(itemKey);
    
    // Get keyword score
    const keywordResult = keywordScores.get(itemKey);
    const keywordScore = keywordResult ? keywordResult.score / 100 : 0;
    
    // Get semantic score
    let semanticScore = 0;
    let semanticMatches: SearchMatch[] = [];
    
    if (queryEmbedding && (note.embedding || note.chunks?.some(c => c.embedding))) {
      const semanticResult = await calculateNoteSemanticScore(queryEmbedding, note);
      semanticScore = semanticResult.score;
      semanticMatches = semanticResult.matches;
    }
    
    // Calculate combined score
    const combinedScore = (keywordScore * opts.keywordWeight!) + (semanticScore * opts.semanticWeight!);
    
    if (combinedScore >= opts.minScore!) {
      const matches: SearchMatch[] = [];
      
      if (keywordScore > 0 && keywordResult) {
        matches.push({
          type: 'keyword',
          score: keywordScore,
          field: keywordResult.matchDetails[0]?.field || 'title',
        });
      }
      
      matches.push(...semanticMatches);
      
      results.push({
        type: 'note',
        item: note,
        keywordScore,
        semanticScore,
        combinedScore,
        matches,
      });
    }
  }
  
  // Sort by combined score and return top K
  return results
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, opts.topK);
};

// Quick search (keyword only, no embeddings)
export const quickHybridSearch = (
  query: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[]
): HybridSearchResult[] => {
  const keywordResults = smartSearch(query, links, notes, folders, tags);
  
  return keywordResults.map(result => ({
    type: result.type,
    item: result.item,
    keywordScore: result.score / 100,
    semanticScore: 0,
    combinedScore: result.score / 100,
    matches: result.matchDetails.map(detail => ({
      type: 'keyword' as const,
      score: result.score / 100,
      field: detail.field,
    })),
  }));
};

// Search with automatic fallback
export const searchWithFallback = async (
  query: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[],
  config: HybridSearchConfig = {}
): Promise<HybridSearchResult[]> => {
  // Check if any items have embeddings
  const hasEmbeddings = links.some(l => l.embedding || l.chunks?.some(c => c.embedding)) ||
                       notes.some(n => n.embedding || n.chunks?.some(c => c.embedding));
  
  if (hasEmbeddings) {
    try {
      return await hybridSearch(query, links, notes, folders, tags, config);
    } catch (error) {
      console.warn('Hybrid search failed, falling back to keyword search:', error);
    }
  }
  
  // Fallback to quick keyword search
  return quickHybridSearch(query, links, notes, folders, tags);
};

// Get search insights
export const getSearchInsights = (results: HybridSearchResult[]): {
  totalResults: number;
  keywordMatches: number;
  semanticMatches: number;
  hybridMatches: number;
  averageScore: number;
  topMatchType: 'keyword' | 'semantic' | 'hybrid';
} => {
  let keywordMatches = 0;
  let semanticMatches = 0;
  let hybridMatches = 0;
  let totalScore = 0;
  
  for (const result of results) {
    if (result.keywordScore > 0 && result.semanticScore > 0) {
      hybridMatches++;
    } else if (result.keywordScore > 0) {
      keywordMatches++;
    } else if (result.semanticScore > 0) {
      semanticMatches++;
    }
    totalScore += result.combinedScore;
  }
  
  const topMatchType = semanticMatches > keywordMatches 
    ? (hybridMatches > semanticMatches ? 'hybrid' : 'semantic')
    : (hybridMatches > keywordMatches ? 'hybrid' : 'keyword');
  
  return {
    totalResults: results.length,
    keywordMatches,
    semanticMatches,
    hybridMatches,
    averageScore: results.length > 0 ? totalScore / results.length : 0,
    topMatchType,
  };
};
