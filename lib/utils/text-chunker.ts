// Text Chunking Utility
// Splits text into overlapping chunks for embedding

export interface TextChunk {
  id: string;
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  metadata?: {
    title?: string;
    url?: string;
    contentType?: string;
  };
}

export interface ChunkingOptions {
  chunkSize?: number;        // Target chunk size in characters (default: 500)
  chunkOverlap?: number;     // Overlap between chunks (default: 50)
  minChunkSize?: number;     // Minimum chunk size (default: 100)
  splitBy?: 'sentence' | 'paragraph' | 'character';  // How to split text
}

const DEFAULT_OPTIONS: ChunkingOptions = {
  chunkSize: 500,
  chunkOverlap: 50,
  minChunkSize: 100,
  splitBy: 'sentence',
};

// Split text into sentences
const splitIntoSentences = (text: string): string[] => {
  // Handle common abbreviations to avoid false splits
  const abbreviations = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Sr.', 'Jr.', 'vs.', 'etc.', 'i.e.', 'e.g.'];
  
  let processedText = text;
  abbreviations.forEach((abbr, i) => {
    processedText = processedText.replace(new RegExp(abbr.replace('.', '\\.'), 'g'), `__ABBR${i}__`);
  });
  
  // Split by sentence-ending punctuation
  const sentences = processedText.split(/(?<=[.!?])\s+/);
  
  // Restore abbreviations
  return sentences.map(sentence => {
    let restored = sentence;
    abbreviations.forEach((abbr, i) => {
      restored = restored.replace(new RegExp(`__ABBR${i}__`, 'g'), abbr);
    });
    return restored.trim();
  }).filter(s => s.length > 0);
};

// Split text into paragraphs
const splitIntoParagraphs = (text: string): string[] => {
  return text.split(/\n\n+/).filter(p => p.trim().length > 0);
};

// Generate a simple hash for chunk ID
const generateChunkId = (text: string, index: number): string => {
  const hash = text.slice(0, 50).split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0);
  }, 0);
  return `chunk_${Math.abs(hash)}_${index}`;
};

// Main chunking function
export const chunkText = (
  text: string,
  options: ChunkingOptions = {},
  metadata?: TextChunk['metadata']
): TextChunk[] => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { chunkSize, chunkOverlap, minChunkSize, splitBy } = opts as Required<ChunkingOptions>;
  
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentStart = 0;
  let chunkIndex = 0;
  
  // Split text based on method
  let segments: string[];
  switch (splitBy) {
    case 'paragraph':
      segments = splitIntoParagraphs(text);
      break;
    case 'sentence':
      segments = splitIntoSentences(text);
      break;
    case 'character':
    default:
      // For character-based, we'll handle differently
      segments = [text];
      break;
  }
  
  if (splitBy === 'character') {
    // Character-based chunking with overlap
    for (let i = 0; i < text.length; i += (chunkSize! - chunkOverlap!)) {
      const chunkText = text.slice(i, i + chunkSize!);
      
      if (chunkText.length >= minChunkSize!) {
        chunks.push({
          id: generateChunkId(chunkText, chunkIndex),
          text: chunkText.trim(),
          index: chunkIndex,
          startChar: i,
          endChar: i + chunkText.length,
          metadata,
        });
        chunkIndex++;
      }
    }
  } else {
    // Sentence or paragraph-based chunking
    let charPosition = 0;
    
    for (const segment of segments) {
      const segmentWithSpace = segment + ' ';
      
      // If adding this segment exceeds chunk size, save current chunk
      if (currentChunk.length + segmentWithSpace.length > chunkSize! && currentChunk.length >= minChunkSize!) {
        chunks.push({
          id: generateChunkId(currentChunk, chunkIndex),
          text: currentChunk.trim(),
          index: chunkIndex,
          startChar: currentStart,
          endChar: currentStart + currentChunk.length,
          metadata,
        });
        chunkIndex++;
        
        // Keep overlap from the end of current chunk
        const overlapText = currentChunk.slice(-chunkOverlap!);
        currentChunk = overlapText + segmentWithSpace;
        currentStart = charPosition - overlapText.length;
      } else {
        if (currentChunk.length === 0) {
          currentStart = charPosition;
        }
        currentChunk += segmentWithSpace;
      }
      
      charPosition += segmentWithSpace.length;
    }
    
    // Don't forget the last chunk
    if (currentChunk.trim().length >= minChunkSize!) {
      chunks.push({
        id: generateChunkId(currentChunk, chunkIndex),
        text: currentChunk.trim(),
        index: chunkIndex,
        startChar: currentStart,
        endChar: currentStart + currentChunk.length,
        metadata,
      });
    }
  }
  
  return chunks;
};

// Chunk with context - includes surrounding context in each chunk
export const chunkTextWithContext = (
  text: string,
  options: ChunkingOptions = {},
  metadata?: TextChunk['metadata']
): TextChunk[] => {
  const chunks = chunkText(text, options, metadata);
  
  // Add context from previous and next chunks
  return chunks.map((chunk, i) => {
    let contextText = chunk.text;
    
    // Add prefix from previous chunk
    if (i > 0) {
      const prevChunk = chunks[i - 1];
      const suffix = prevChunk.text.slice(-50);
      if (suffix) {
        contextText = `...${suffix} ${contextText}`;
      }
    }
    
    // Add suffix from next chunk
    if (i < chunks.length - 1) {
      const nextChunk = chunks[i + 1];
      const prefix = nextChunk.text.slice(0, 50);
      if (prefix) {
        contextText = `${contextText} ${prefix}...`;
      }
    }
    
    return {
      ...chunk,
      text: contextText,
    };
  });
};

// Estimate number of tokens (rough approximation: 1 token ≈ 4 chars)
export const estimateTokens = (text: string): number => {
  return Math.ceil(text.length / 4);
};

// Get optimal chunk size based on embedding model
export const getOptimalChunkSize = (modelName: string = 'default'): number => {
  const modelChunkSizes: Record<string, number> = {
    'text-embedding-ada-002': 8000,  // OpenAI
    'text-embedding-3-small': 8000,  // OpenAI
    'text-embedding-3-large': 8000,  // OpenAI
    'all-MiniLM-L6-v2': 500,         // Local/HuggingFace
    'default': 500,
  };
  
  return modelChunkSizes[modelName] || modelChunkSizes['default'];
};
