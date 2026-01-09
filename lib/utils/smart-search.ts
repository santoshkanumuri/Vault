import { Link, Folder, Tag, Note } from '../types';

// ============================================
// Smart Search Engine
// Features: Fuzzy matching, typo tolerance, 
// natural language queries, relevance scoring
// ============================================

// Levenshtein distance for typo tolerance
const levenshteinDistance = (str1: string, str2: string): number => {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  return dp[m][n];
};

// Calculate fuzzy similarity (0-1)
const fuzzySimilarity = (query: string, text: string): number => {
  if (!query || !text) return 0;
  
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  
  // Exact match
  if (t === q) return 1;
  
  // Contains match
  if (t.includes(q)) return 0.9;
  
  // Starts with
  if (t.startsWith(q)) return 0.95;
  
  // Word starts with
  const words = t.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(q)) return 0.85;
  }
  
  // Levenshtein-based similarity for short queries
  if (q.length <= 10) {
    const distance = levenshteinDistance(q, t.slice(0, q.length + 2));
    const maxLen = Math.max(q.length, t.slice(0, q.length + 2).length);
    const similarity = 1 - distance / maxLen;
    if (similarity > 0.6) return similarity * 0.7;
  }
  
  // Token matching
  const queryTokens = tokenize(q);
  const textTokens = tokenize(t);
  let matchedTokens = 0;
  
  for (const qt of queryTokens) {
    for (const tt of textTokens) {
      if (tt.includes(qt) || qt.includes(tt)) {
        matchedTokens++;
        break;
      }
      // Fuzzy token match
      if (qt.length >= 3 && tt.length >= 3) {
        const dist = levenshteinDistance(qt, tt);
        if (dist <= Math.floor(Math.min(qt.length, tt.length) / 3)) {
          matchedTokens += 0.7;
          break;
        }
      }
    }
  }
  
  if (queryTokens.length > 0) {
    return (matchedTokens / queryTokens.length) * 0.6;
  }
  
  return 0;
};

// Tokenize text into words
const tokenize = (text: string): string[] => {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1);
};

// Common synonyms for better matching
const SYNONYMS: Record<string, string[]> = {
  'article': ['post', 'blog', 'read', 'story', 'news'],
  'video': ['youtube', 'watch', 'clip', 'movie', 'stream'],
  'image': ['photo', 'picture', 'pic', 'img', 'graphic'],
  'document': ['doc', 'file', 'pdf', 'paper'],
  'code': ['programming', 'coding', 'developer', 'dev', 'github'],
  'design': ['ui', 'ux', 'figma', 'sketch', 'creative'],
  'music': ['audio', 'song', 'spotify', 'sound'],
  'social': ['twitter', 'facebook', 'instagram', 'linkedin'],
  'shopping': ['buy', 'purchase', 'store', 'amazon', 'shop'],
  'learn': ['tutorial', 'course', 'education', 'study', 'lesson'],
  'work': ['job', 'career', 'business', 'professional'],
  'important': ['starred', 'favorite', 'saved', 'bookmark'],
  'recent': ['new', 'latest', 'today', 'yesterday'],
  'old': ['ancient', 'archive', 'past', 'previous'],
};

// Expand query with synonyms
const expandWithSynonyms = (tokens: string[]): string[] => {
  const expanded = new Set(tokens);
  
  for (const token of tokens) {
    // Check if token is a synonym key
    if (SYNONYMS[token]) {
      SYNONYMS[token].forEach(syn => expanded.add(syn));
    }
    // Check if token is in synonym values
    for (const [key, values] of Object.entries(SYNONYMS)) {
      if (values.includes(token)) {
        expanded.add(key);
        values.forEach(syn => expanded.add(syn));
      }
    }
  }
  
  return Array.from(expanded);
};

// Natural language query patterns
interface QueryIntent {
  type: 'search' | 'filter_folder' | 'filter_tag' | 'filter_date' | 'filter_type';
  value?: string;
  dateRange?: { start: Date; end: Date };
  searchTerms: string[];
}

const parseNaturalQuery = (query: string): QueryIntent => {
  const q = query.toLowerCase().trim();
  const intent: QueryIntent = {
    type: 'search',
    searchTerms: [],
  };
  
  // Date patterns
  const datePatterns = [
    { pattern: /\b(today|now)\b/i, days: 0 },
    { pattern: /\byesterday\b/i, days: 1 },
    { pattern: /\bthis week\b/i, days: 7 },
    { pattern: /\blast week\b/i, days: 14 },
    { pattern: /\bthis month\b/i, days: 30 },
    { pattern: /\blast month\b/i, days: 60 },
    { pattern: /\brecent(ly)?\b/i, days: 7 },
  ];
  
  for (const { pattern, days } of datePatterns) {
    if (pattern.test(q)) {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      intent.dateRange = { start, end: now };
      intent.type = 'filter_date';
      break;
    }
  }
  
  // Folder/tag patterns
  const folderMatch = q.match(/(?:in|from|folder)\s+["']?([^"']+)["']?/i);
  if (folderMatch) {
    intent.type = 'filter_folder';
    intent.value = folderMatch[1].trim();
  }
  
  const tagMatch = q.match(/(?:tagged?|with tag|#)["']?([^"'\s]+)["']?/i);
  if (tagMatch) {
    intent.type = 'filter_tag';
    intent.value = tagMatch[1].trim();
  }
  
  // Type patterns
  if (/\b(links?|urls?|websites?)\b/i.test(q)) {
    intent.type = 'filter_type';
    intent.value = 'link';
  } else if (/\b(notes?|memos?)\b/i.test(q)) {
    intent.type = 'filter_type';
    intent.value = 'note';
  }
  
  // Extract remaining search terms
  let cleanQuery = q
    .replace(/\b(in|from|folder|tagged?|with tag|#|today|yesterday|this week|last week|this month|last month|recent(ly)?|links?|urls?|websites?|notes?|memos?)\b/gi, '')
    .replace(/["']/g, '')
    .trim();
  
  intent.searchTerms = tokenize(cleanQuery);
  
  return intent;
};

// Search result types
export interface SmartSearchResult {
  type: 'link' | 'note';
  item: Link | Note;
  score: number;
  matchDetails: {
    field: string;
    matchType: 'exact' | 'fuzzy' | 'token' | 'synonym';
    highlightRanges?: Array<{ start: number; end: number }>;
  }[];
}

// Main smart search function
export const smartSearch = (
  query: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[]
): SmartSearchResult[] => {
  if (!query.trim()) return [];
  
  const intent = parseNaturalQuery(query);
  const queryTokens = tokenize(query);
  const expandedTokens = expandWithSynonyms(queryTokens);
  
  const results: SmartSearchResult[] = [];
  
  // Create lookup maps
  const folderMap = new Map(folders.map(f => [f.id, f]));
  const tagMap = new Map(tags.map(t => [t.id, t]));
  
  // Search links
  for (const link of links) {
    // Apply filters based on intent
    if (intent.type === 'filter_type' && intent.value === 'note') continue;
    
    if (intent.type === 'filter_folder' && intent.value) {
      const folder = folderMap.get(link.folderId);
      if (!folder || !fuzzySimilarity(intent.value, folder.name)) continue;
    }
    
    if (intent.type === 'filter_tag' && intent.value) {
      const hasTag = link.tagIds.some(tid => {
        const tag = tagMap.get(tid);
        return tag && fuzzySimilarity(intent.value!, tag.name) > 0.5;
      });
      if (!hasTag) continue;
    }
    
    if (intent.dateRange) {
      const created = new Date(link.createdAt);
      if (created < intent.dateRange.start || created > intent.dateRange.end) continue;
    }
    
    // Calculate scores for each field
    const matchDetails: SmartSearchResult['matchDetails'] = [];
    let totalScore = 0;
    
    // Name (highest weight)
    const nameScore = calculateFieldScore(query, expandedTokens, link.name);
    if (nameScore > 0) {
      totalScore += nameScore * 1.5;
      matchDetails.push({ field: 'name', matchType: nameScore > 0.8 ? 'exact' : 'fuzzy' });
    }
    
    // URL
    const urlScore = calculateFieldScore(query, expandedTokens, link.url);
    if (urlScore > 0) {
      totalScore += urlScore * 0.8;
      matchDetails.push({ field: 'url', matchType: 'fuzzy' });
    }
    
    // Description
    const descScore = calculateFieldScore(query, expandedTokens, link.description);
    if (descScore > 0) {
      totalScore += descScore * 1.0;
      matchDetails.push({ field: 'description', matchType: 'token' });
    }
    
    // Metadata
    if (link.metadata) {
      const metaFields = [link.metadata.title, link.metadata.description, link.metadata.siteName]
        .filter(Boolean) as string[];
      
      for (const field of metaFields) {
        const metaScore = calculateFieldScore(query, expandedTokens, field);
        if (metaScore > 0) {
          totalScore += metaScore * 0.7;
          matchDetails.push({ field: 'metadata', matchType: 'token' });
          break;
        }
      }
    }
    
    // Folder name
    const folder = folderMap.get(link.folderId);
    if (folder) {
      const folderScore = calculateFieldScore(query, expandedTokens, folder.name);
      if (folderScore > 0) {
        totalScore += folderScore * 0.6;
        matchDetails.push({ field: 'folder', matchType: 'fuzzy' });
      }
    }
    
    // Tags
    for (const tagId of link.tagIds) {
      const tag = tagMap.get(tagId);
      if (tag) {
        const tagScore = calculateFieldScore(query, expandedTokens, tag.name);
        if (tagScore > 0) {
          totalScore += tagScore * 0.8;
          matchDetails.push({ field: 'tag', matchType: 'exact' });
          break;
        }
      }
    }
    
    if (totalScore > 0.1) {
      results.push({
        type: 'link',
        item: link,
        score: totalScore,
        matchDetails,
      });
    }
  }
  
  // Search notes
  for (const note of notes) {
    // Apply filters based on intent
    if (intent.type === 'filter_type' && intent.value === 'link') continue;
    
    if (intent.type === 'filter_folder' && intent.value) {
      const folder = folderMap.get(note.folderId);
      if (!folder || !fuzzySimilarity(intent.value, folder.name)) continue;
    }
    
    if (intent.type === 'filter_tag' && intent.value) {
      const hasTag = note.tagIds.some(tid => {
        const tag = tagMap.get(tid);
        return tag && fuzzySimilarity(intent.value!, tag.name) > 0.5;
      });
      if (!hasTag) continue;
    }
    
    if (intent.dateRange) {
      const created = new Date(note.createdAt);
      if (created < intent.dateRange.start || created > intent.dateRange.end) continue;
    }
    
    const matchDetails: SmartSearchResult['matchDetails'] = [];
    let totalScore = 0;
    
    // Title (highest weight)
    const titleScore = calculateFieldScore(query, expandedTokens, note.title);
    if (titleScore > 0) {
      totalScore += titleScore * 1.5;
      matchDetails.push({ field: 'title', matchType: titleScore > 0.8 ? 'exact' : 'fuzzy' });
    }
    
    // Content
    const contentScore = calculateFieldScore(query, expandedTokens, note.content);
    if (contentScore > 0) {
      totalScore += contentScore * 1.2;
      matchDetails.push({ field: 'content', matchType: 'token' });
    }
    
    // Folder name
    const folder = folderMap.get(note.folderId);
    if (folder) {
      const folderScore = calculateFieldScore(query, expandedTokens, folder.name);
      if (folderScore > 0) {
        totalScore += folderScore * 0.6;
        matchDetails.push({ field: 'folder', matchType: 'fuzzy' });
      }
    }
    
    // Tags
    for (const tagId of note.tagIds) {
      const tag = tagMap.get(tagId);
      if (tag) {
        const tagScore = calculateFieldScore(query, expandedTokens, tag.name);
        if (tagScore > 0) {
          totalScore += tagScore * 0.8;
          matchDetails.push({ field: 'tag', matchType: 'exact' });
          break;
        }
      }
    }
    
    if (totalScore > 0.1) {
      results.push({
        type: 'note',
        item: note,
        score: totalScore,
        matchDetails,
      });
    }
  }
  
  // Sort by score (highest first)
  results.sort((a, b) => b.score - a.score);
  
  return results;
};

// Calculate score for a single field
const calculateFieldScore = (
  query: string,
  expandedTokens: string[],
  fieldValue: string
): number => {
  if (!fieldValue) return 0;
  
  // Direct fuzzy match
  const directScore = fuzzySimilarity(query, fieldValue);
  if (directScore > 0.5) return directScore;
  
  // Token-based matching with expanded synonyms
  const fieldTokens = tokenize(fieldValue);
  let tokenMatches = 0;
  
  for (const qt of expandedTokens) {
    for (const ft of fieldTokens) {
      const sim = fuzzySimilarity(qt, ft);
      if (sim > 0.6) {
        tokenMatches += sim;
        break;
      }
    }
  }
  
  if (expandedTokens.length > 0) {
    return (tokenMatches / expandedTokens.length) * 0.8;
  }
  
  return 0;
};

// Highlight matching text (for UI)
export const highlightMatches = (
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> => {
  if (!query.trim()) {
    return [{ text, highlight: false }];
  }
  
  const result: Array<{ text: string; highlight: boolean }> = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const tokens = tokenize(lowerQuery);
  
  let lastIndex = 0;
  const matches: Array<{ start: number; end: number }> = [];
  
  // Find all matches
  for (const token of tokens) {
    let searchStart = 0;
    while (true) {
      const index = lowerText.indexOf(token, searchStart);
      if (index === -1) break;
      matches.push({ start: index, end: index + token.length });
      searchStart = index + 1;
    }
  }
  
  // Sort and merge overlapping matches
  matches.sort((a, b) => a.start - b.start);
  const mergedMatches: Array<{ start: number; end: number }> = [];
  
  for (const match of matches) {
    if (mergedMatches.length === 0) {
      mergedMatches.push(match);
    } else {
      const last = mergedMatches[mergedMatches.length - 1];
      if (match.start <= last.end) {
        last.end = Math.max(last.end, match.end);
      } else {
        mergedMatches.push(match);
      }
    }
  }
  
  // Build result
  for (const match of mergedMatches) {
    if (match.start > lastIndex) {
      result.push({ text: text.slice(lastIndex, match.start), highlight: false });
    }
    result.push({ text: text.slice(match.start, match.end), highlight: true });
    lastIndex = match.end;
  }
  
  if (lastIndex < text.length) {
    result.push({ text: text.slice(lastIndex), highlight: false });
  }
  
  return result.length > 0 ? result : [{ text, highlight: false }];
};

// Search suggestions based on existing data
export const getSearchSuggestions = (
  partialQuery: string,
  links: Link[],
  notes: Note[],
  folders: Folder[],
  tags: Tag[]
): string[] => {
  if (!partialQuery.trim() || partialQuery.length < 2) return [];
  
  const suggestions = new Set<string>();
  const q = partialQuery.toLowerCase();
  
  // Add matching folder names
  for (const folder of folders) {
    if (folder.name.toLowerCase().includes(q)) {
      suggestions.add(`in "${folder.name}"`);
    }
  }
  
  // Add matching tag names
  for (const tag of tags) {
    if (tag.name.toLowerCase().includes(q)) {
      suggestions.add(`#${tag.name}`);
    }
  }
  
  // Add matching link names
  for (const link of links) {
    if (link.name.toLowerCase().includes(q)) {
      suggestions.add(link.name);
    }
  }
  
  // Add matching note titles
  for (const note of notes) {
    if (note.title.toLowerCase().includes(q)) {
      suggestions.add(note.title);
    }
  }
  
  // Add natural language suggestions
  if ('recent'.includes(q)) suggestions.add('recent links');
  if ('today'.includes(q)) suggestions.add('today');
  if ('yesterday'.includes(q)) suggestions.add('yesterday');
  if ('this week'.includes(q)) suggestions.add('this week');
  
  return Array.from(suggestions).slice(0, 8);
};
