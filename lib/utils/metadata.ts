export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  content?: string;
}

export interface FullContent {
  fullText: string;
  contentType: 'article' | 'tweet' | 'video' | 'webpage' | 'unknown';
  author?: string;
  wordCount: number;
}

export interface ExtendedLinkMetadata extends LinkMetadata {
  fullContent?: FullContent;
}

export interface TextChunkWithEmbedding {
  id: string;
  text: string;
  index: number;
  embedding?: number[];
}

export interface ProcessedLinkContent {
  fullText: string;
  contentType: string;
  author?: string;
  wordCount: number;
  chunks: TextChunkWithEmbedding[];
  embedding?: number[];
}

export const isValidUrl = (url: string): boolean => {
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
};

// Helper to get the base URL for API calls (works in both client and server)
const getApiBaseUrl = (): string => {
  // Server-side: use environment variable or default to localhost
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  // Client-side: use relative URL
  return '';
};

export const fetchLinkMetadata = async (url: string): Promise<LinkMetadata> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/metadata?url=${encodeURIComponent(url)}`, {
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Metadata fetch failed: ${response.status}`, errorText);
      return {
        title: url,
        description: response.status === 504 
          ? 'Metadata fetch timed out. Please try again.'
          : 'Could not fetch metadata for this URL.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      };
    }

    const metadata: LinkMetadata = await response.json();
    return metadata;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("Metadata fetch timed out:", url);
      return {
        title: url,
        description: 'Metadata fetch timed out. Please try again.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      };
    }
    console.error("Error fetching link metadata:", error);
    return {
      title: url,
      description: 'Error occurred while fetching metadata.',
      favicon: '',
      siteName: '',
      image: '',
      content: ''
    };
  }
};

// Fetch metadata with full content extraction
export const fetchLinkMetadataWithContent = async (url: string): Promise<ExtendedLinkMetadata> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds for full content

    const baseUrl = getApiBaseUrl();
    const response = await fetch(
      `${baseUrl}/api/metadata?url=${encodeURIComponent(url)}&extractContent=true`,
      { signal: controller.signal }
    ).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Metadata fetch with content failed: ${response.status}`, errorText);
      return {
        title: url,
        description: response.status === 504 
          ? 'Content extraction timed out. Please try again.'
          : 'Could not fetch metadata for this URL.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      };
    }

    const metadata: ExtendedLinkMetadata = await response.json();
    return metadata;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error("Metadata fetch with content timed out:", url);
      return {
        title: url,
        description: 'Content extraction timed out. Please try again.',
        favicon: '',
        siteName: '',
        image: '',
        content: ''
      };
    }
    console.error("Error fetching link metadata with content:", error);
    return {
      title: url,
      description: 'Error occurred while fetching metadata.',
      favicon: '',
      siteName: '',
      image: '',
      content: ''
    };
  }
};

// Generate embeddings for text content
export const generateContentEmbeddings = async (
  text: string,
  chunk: boolean = true,
  chunkSize: number = 500
): Promise<{
  chunks: TextChunkWithEmbedding[];
  embedding: number[];
  model: string;
} | null> => {
  if (!text || text.trim().length < 50) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout

    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [text],
        chunk,
        chunkSize,
        chunkOverlap: 50,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error('Embedding generation failed', { 
        status: response.status, 
        error: errorText 
      });
      return null;
    }

    const data = await response.json();
    
    if (!data.embeddings || data.embeddings.length === 0) {
      console.warn('No embeddings returned from API');
      return null;
    }

    // Process chunks
    const chunks: TextChunkWithEmbedding[] = data.embeddings.map((emb: any, i: number) => ({
      id: `chunk_${Date.now()}_${i}`,
      text: emb.text,
      index: emb.chunkIndex,
      embedding: emb.embedding,
    }));

    // Calculate average embedding for the whole document
    const avgEmbedding = averageEmbeddings(chunks.map(c => c.embedding!).filter(Boolean));

    return {
      chunks,
      embedding: avgEmbedding,
      model: data.model,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('Embedding generation timed out');
    } else {
      console.error('Error generating embeddings:', error);
    }
    return null;
  }
};

// Average multiple embeddings
const averageEmbeddings = (embeddings: number[][]): number[] => {
  if (embeddings.length === 0) return [];
  
  const dimensions = embeddings[0].length;
  const result = new Array(dimensions).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += embedding[i];
    }
  }
  
  const magnitude = Math.sqrt(
    result.reduce((sum, val) => sum + (val / embeddings.length) ** 2, 0)
  );
  
  return result.map(val => 
    magnitude > 0 ? (val / embeddings.length) / magnitude : 0
  );
};

// Process a link and generate embeddings for its content
export const processLinkContent = async (
  url: string,
  existingMetadata?: LinkMetadata
): Promise<ProcessedLinkContent | null> => {
  try {
    // Fetch full content if not already available
    let metadata = existingMetadata;
    if (!metadata?.content || metadata.content.length < 100) {
      const extendedMetadata = await fetchLinkMetadataWithContent(url);
      metadata = extendedMetadata;
      
      if (!extendedMetadata.fullContent?.fullText) {
        return null;
      }
    }

    const fullText = (metadata as ExtendedLinkMetadata).fullContent?.fullText || 
                    metadata?.content || '';
    
    if (fullText.length < 50) {
      return null;
    }

    // Generate embeddings
    const embeddingResult = await generateContentEmbeddings(fullText);
    
    if (!embeddingResult) {
      return {
        fullText,
        contentType: (metadata as ExtendedLinkMetadata).fullContent?.contentType || 'webpage',
        author: (metadata as ExtendedLinkMetadata).fullContent?.author,
        wordCount: fullText.split(/\s+/).length,
        chunks: [],
        embedding: undefined,
      };
    }

    return {
      fullText,
      contentType: (metadata as ExtendedLinkMetadata).fullContent?.contentType || 'webpage',
      author: (metadata as ExtendedLinkMetadata).fullContent?.author,
      wordCount: fullText.split(/\s+/).length,
      chunks: embeddingResult.chunks,
      embedding: embeddingResult.embedding,
    };
  } catch (error) {
    console.error('Error processing link content:', error);
    return null;
  }
};

// Generate query embedding for search
export const generateQueryEmbedding = async (query: string): Promise<number[] | null> => {
  if (!query || query.trim().length < 2) {
    return null;
  }

  try {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/embeddings?query=${encodeURIComponent(query)}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.embedding || null;
  } catch (error) {
    console.error('Error generating query embedding:', error);
    return null;
  }
};
