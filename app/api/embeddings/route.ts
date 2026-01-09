import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { withTimeout, TimeoutError } from '@/lib/utils/timeout';
import { retry } from '@/lib/utils/retry';

export const dynamic = 'force-dynamic';

// Configuration
const EMBEDDING_TIMEOUT_MS = 60000; // 60 seconds for embedding generation
const OPENAI_BATCH_SIZE = 100;
const MAX_TEXT_LENGTH = 100000; // Maximum text length per request

// Simple local embedding generation (TF-IDF based)
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

// Local fallback embedding - uses 3072 dimensions to match OpenAI
const createLocalEmbedding = (text: string, dimensions: number = 3072): number[] => {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  const embedding = new Array(dimensions).fill(0);
  
  Object.entries(wordFreq).forEach(([word, freq]) => {
    for (let i = 0; i < 3; i++) {
      const hash = hashString(word + i.toString());
      const position = Math.abs(hash) % dimensions;
      const value = (freq / words.length) * Math.cos(hash);
      embedding[position] += value;
    }
  });
  
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
};

// Chunk text into smaller pieces
const chunkText = (text: string, chunkSize: number = 500, overlap: number = 50): string[] => {
  if (!text || text.length <= chunkSize) {
    return [text];
  }
  
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 100) {
      chunks.push(currentChunk.trim());
      // Keep overlap
      const words = currentChunk.split(' ');
      currentChunk = words.slice(-Math.floor(overlap / 5)).join(' ') + ' ' + sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim().length > 50) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
};

// OpenAI embedding generation - using text-embedding-3-large (3072 dimensions)
async function generateOpenAIEmbeddings(
  texts: string[],
  apiKey: string,
  model: string = 'text-embedding-3-large',
  dimensions: number = 3072
): Promise<number[][]> {
  logger.info('generateOpenAIEmbeddings: Calling OpenAI API', { 
    model, 
    dimensions, 
    textCount: texts.length 
  });
  
  // Validate inputs
  if (!texts || texts.length === 0) {
    throw new Error('No texts provided for embedding generation');
  }

  // Check text lengths
  const totalLength = texts.reduce((sum, text) => sum + text.length, 0);
  if (totalLength > MAX_TEXT_LENGTH) {
    throw new Error(`Total text length (${totalLength}) exceeds maximum (${MAX_TEXT_LENGTH})`);
  }

  const fetchWithRetry = () => retry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), EMBEDDING_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: texts,
          dimensions,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `OpenAI API error: ${response.status}`;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        logger.error('generateOpenAIEmbeddings: API error', { 
          status: response.status, 
          error: errorMessage 
        });
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid response format from OpenAI API');
      }

      logger.info('generateOpenAIEmbeddings: Success', { 
        embeddingsCount: data.data.length,
        dimensions: data.data[0]?.embedding?.length 
      });
      
      return data.data.map((d: any) => d.embedding);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new TimeoutError('OpenAI API request timed out');
      }
      throw error;
    }
  }, {
    maxAttempts: 3,
    delayMs: 1000,
    shouldRetry: (error) => {
      // Retry on network errors and 5xx errors
      if (error instanceof TimeoutError) return false;
      if (error?.message?.includes('timeout')) return true;
      if (error?.status >= 500 && error?.status < 600) return true;
      return false;
    },
  });

  return await fetchWithRetry();
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { texts, chunk, chunkSize = 500, chunkOverlap = 50 } = body;
    
    logger.info('POST /api/embeddings: Request received', { 
      textCount: texts?.length,
      chunk,
      chunkSize 
    });
    
    // Validate inputs
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      logger.warn('POST /api/embeddings: Invalid input', { texts });
      return NextResponse.json(
        { error: 'texts array is required and must not be empty' }, 
        { status: 400 }
      );
    }

    if (chunkSize < 50 || chunkSize > 8000) {
      return NextResponse.json(
        { error: 'chunkSize must be between 50 and 8000' },
        { status: 400 }
      );
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    const useOpenAI = !!apiKey;
    
    // Filter and validate texts
    let processedTexts = texts
      .filter((t: any) => t && typeof t === 'string' && t.trim().length > 0)
      .map((t: string) => t.trim());
    
    if (processedTexts.length === 0) {
      return NextResponse.json({
        embeddings: [],
        model: 'none',
        dimensions: 0,
        chunked: chunk || false,
        totalChunks: 0,
      });
    }
    
    let chunks: Array<{ text: string; index: number; parentIndex: number }> = [];
    
    // Chunk texts if requested
    if (chunk) {
      processedTexts.forEach((text: string, parentIndex: number) => {
        try {
          const textChunks = chunkText(text, chunkSize, chunkOverlap);
          textChunks.forEach((chunkText, index) => {
            chunks.push({ text: chunkText, index, parentIndex });
          });
        } catch (error) {
          logger.warn('POST /api/embeddings: Chunking failed for text', { 
            parentIndex, 
            error 
          });
          // Fallback: use entire text as single chunk
          chunks.push({ text, index: 0, parentIndex });
        }
      });
    } else {
      chunks = processedTexts.map((text: string, index: number) => ({
        text,
        index,
        parentIndex: index,
      }));
    }
    
    if (chunks.length === 0) {
      return NextResponse.json({
        embeddings: [],
        model: 'none',
        dimensions: 0,
        chunked: chunk || false,
        totalChunks: 0,
      });
    }
    
    logger.info('POST /api/embeddings: Processing chunks', { 
      chunksCount: chunks.length,
      useOpenAI 
    });
    
    let embeddings: number[][];
    let model: string;
    let dimensions: number;
    
    if (useOpenAI) {
      try {
        // Batch process in groups of OPENAI_BATCH_SIZE
        embeddings = [];
        
        for (let i = 0; i < chunks.length; i += OPENAI_BATCH_SIZE) {
          const batch = chunks.slice(i, i + OPENAI_BATCH_SIZE).map(c => c.text);
          logger.debug('POST /api/embeddings: Processing batch', { 
            batchIndex: Math.floor(i / OPENAI_BATCH_SIZE) + 1,
            batchSize: batch.length 
          });
          
          const batchEmbeddings = await withTimeout(
            generateOpenAIEmbeddings(batch, apiKey!),
            EMBEDDING_TIMEOUT_MS,
            `Batch ${Math.floor(i / OPENAI_BATCH_SIZE) + 1} timed out`
          );
          
          embeddings.push(...batchEmbeddings);
        }
        
        model = 'text-embedding-3-large';
        dimensions = embeddings[0]?.length || 3072;
        
        logger.info('POST /api/embeddings: OpenAI embeddings generated', {
          totalEmbeddings: embeddings.length,
          dimensions
        });
      } catch (error: any) {
        logger.warn('POST /api/embeddings: OpenAI failed, using local fallback', { 
          error: error.message 
        });
        
        // Fallback to local embeddings
        embeddings = chunks.map(c => createLocalEmbedding(c.text));
        model = 'local-tfidf-3072';
        dimensions = 3072;
      }
    } else {
      // Use local embedding (3072 dimensions to match OpenAI schema)
      logger.info('POST /api/embeddings: Using local TF-IDF embeddings');
      embeddings = chunks.map(c => createLocalEmbedding(c.text));
      model = 'local-tfidf-3072';
      dimensions = 3072;
    }
    
    // Validate embeddings
    if (embeddings.length !== chunks.length) {
      throw new Error(`Embedding count mismatch: expected ${chunks.length}, got ${embeddings.length}`);
    }
    
    // Format response
    const results = chunks.map((chunk, i) => ({
      text: chunk.text,
      embedding: embeddings[i],
      chunkIndex: chunk.index,
      parentIndex: chunk.parentIndex,
    }));
    
    const duration = Date.now() - startTime;
    logger.info('POST /api/embeddings: Success', {
      model,
      dimensions,
      totalChunks: chunks.length,
      durationMs: duration
    });
    
    return NextResponse.json({
      embeddings: results,
      model,
      dimensions,
      chunked: chunk || false,
      totalChunks: chunks.length,
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('POST /api/embeddings: Error', { 
      error: error.message,
      durationMs: duration 
    }, error);
    
    const statusCode = error instanceof TimeoutError ? 504 : 500;
    const errorMessage = error instanceof TimeoutError 
      ? 'Embedding generation timed out. Please try again with smaller text.'
      : error.message || 'Failed to generate embeddings';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}

// GET endpoint for generating a single query embedding
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query parameter is required and must not be empty' }, 
        { status: 400 }
      );
    }

    if (query.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Query length (${query.length}) exceeds maximum (${MAX_TEXT_LENGTH})` },
        { status: 400 }
      );
    }
    
    logger.info('GET /api/embeddings: Query embedding request', { 
      queryLength: query.length 
    });
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    let embedding: number[];
    let model: string;
    
    if (apiKey) {
      try {
        logger.debug('GET /api/embeddings: Using OpenAI for query embedding');
        const embeddings = await withTimeout(
          generateOpenAIEmbeddings([query], apiKey),
          EMBEDDING_TIMEOUT_MS,
          'Query embedding generation timed out'
        );
        embedding = embeddings[0];
        model = 'text-embedding-3-large';
      } catch (error: any) {
        logger.warn('GET /api/embeddings: OpenAI failed, using local fallback', { 
          error: error.message 
        });
        embedding = createLocalEmbedding(query);
        model = 'local-tfidf-3072';
      }
    } else {
      logger.info('GET /api/embeddings: No API key, using local TF-IDF');
      embedding = createLocalEmbedding(query);
      model = 'local-tfidf-3072';
    }
    
    const duration = Date.now() - startTime;
    logger.info('GET /api/embeddings: Query embedding success', {
      model,
      dimensions: embedding.length,
      durationMs: duration
    });
    
    return NextResponse.json({
      query,
      embedding,
      model,
      dimensions: embedding.length,
    });
    
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error('GET /api/embeddings: Query embedding error', { 
      error: error.message,
      durationMs: duration 
    }, error);
    
    const statusCode = error instanceof TimeoutError ? 504 : 500;
    const errorMessage = error instanceof TimeoutError
      ? 'Query embedding generation timed out'
      : 'Failed to generate query embedding';
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
