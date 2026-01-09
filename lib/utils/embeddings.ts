// Embedding Service
// Generates vector embeddings for text using OpenAI text-embedding-3-large (3072 dimensions)

export type EmbeddingVector = number[];

export interface EmbeddingResult {
  text: string;
  embedding: EmbeddingVector;
  model: string;
  dimensions: number;
}

export interface EmbeddingConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

// Default embedding dimensions (OpenAI text-embedding-3-large)
export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large';
export const DEFAULT_EMBEDDING_DIMENSIONS = 3072;

// Simple TF-IDF based local embedding (fallback when no API key)
// Creates a sparse vector representation based on word frequencies
const createLocalEmbedding = (text: string, dimensions: number = DEFAULT_EMBEDDING_DIMENSIONS): EmbeddingVector => {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  // Create word frequency map
  const wordFreq: Record<string, number> = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  // Generate a deterministic embedding based on word hashes
  const embedding = new Array(dimensions).fill(0);
  
  Object.entries(wordFreq).forEach(([word, freq]) => {
    // Create multiple hash positions for each word (simulating dense embedding)
    for (let i = 0; i < 3; i++) {
      const hash = hashString(word + i.toString());
      const position = Math.abs(hash) % dimensions;
      const value = (freq / words.length) * Math.cos(hash);
      embedding[position] += value;
    }
  });
  
  // Normalize the vector
  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= magnitude;
    }
  }
  
  return embedding;
};

// Simple string hash function
const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

// Generate embeddings using OpenAI API (text-embedding-3-large with 3072 dimensions)
const createOpenAIEmbedding = async (
  texts: string[],
  config: EmbeddingConfig
): Promise<EmbeddingResult[]> => {
  const model = config.model || DEFAULT_EMBEDDING_MODEL;
  const dimensions = config.dimensions || DEFAULT_EMBEDDING_DIMENSIONS;
  
  console.log('createOpenAIEmbedding: Calling OpenAI API...', { model, dimensions, textCount: texts.length });
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('createOpenAIEmbedding: API error', error);
    throw new Error(`OpenAI API error: ${error}`);
  }
  
  const data = await response.json();
  console.log('createOpenAIEmbedding: Success', { embeddingsCount: data.data.length });
  
  return texts.map((text, i) => ({
    text,
    embedding: data.data[i].embedding,
    model,
    dimensions: data.data[i].embedding.length,
  }));
};

// Main embedding function
export const generateEmbeddings = async (
  texts: string[],
  config: EmbeddingConfig = {}
): Promise<EmbeddingResult[]> => {
  // Filter out empty texts
  const validTexts = texts.filter(t => t && t.trim().length > 0);
  
  if (validTexts.length === 0) {
    return [];
  }
  
  // Use OpenAI if API key is provided
  if (config.apiKey) {
    try {
      return await createOpenAIEmbedding(validTexts, config);
    } catch (error) {
      console.error('OpenAI embedding failed, falling back to local:', error);
    }
  }
  
  // Fallback to local embedding (3072 dimensions to match OpenAI schema)
  const dimensions = config.dimensions || DEFAULT_EMBEDDING_DIMENSIONS;
  console.log('generateEmbeddings: Using local TF-IDF fallback', { dimensions });
  return validTexts.map(text => ({
    text,
    embedding: createLocalEmbedding(text, dimensions),
    model: 'local-tfidf-3072',
    dimensions,
  }));
};

// Generate embedding for a single text
export const generateEmbedding = async (
  text: string,
  config: EmbeddingConfig = {}
): Promise<EmbeddingResult | null> => {
  const results = await generateEmbeddings([text], config);
  return results[0] || null;
};

// Calculate cosine similarity between two vectors
export const cosineSimilarity = (a: EmbeddingVector, b: EmbeddingVector): number => {
  if (a.length !== b.length) {
    // If dimensions don't match, return 0
    return 0;
  }
  
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }
  
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProduct / (magnitudeA * magnitudeB);
};

// Calculate euclidean distance between two vectors
export const euclideanDistance = (a: EmbeddingVector, b: EmbeddingVector): number => {
  if (a.length !== b.length) {
    return Infinity;
  }
  
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  
  return Math.sqrt(sum);
};

// Find most similar embeddings
export const findSimilar = (
  queryEmbedding: EmbeddingVector,
  embeddings: Array<{ id: string; embedding: EmbeddingVector; [key: string]: any }>,
  topK: number = 10,
  threshold: number = 0.5
): Array<{ id: string; similarity: number; [key: string]: any }> => {
  const results = embeddings.map(item => ({
    ...item,
    similarity: cosineSimilarity(queryEmbedding, item.embedding),
  }));
  
  return results
    .filter(r => r.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
};

// Batch embedding with rate limiting
export const batchGenerateEmbeddings = async (
  texts: string[],
  config: EmbeddingConfig = {},
  batchSize: number = 100,
  delayMs: number = 100
): Promise<EmbeddingResult[]> => {
  const results: EmbeddingResult[] = [];
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchResults = await generateEmbeddings(batch, config);
    results.push(...batchResults);
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < texts.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};

// Combine multiple embeddings (averaging)
export const averageEmbeddings = (embeddings: EmbeddingVector[]): EmbeddingVector => {
  if (embeddings.length === 0) {
    return [];
  }
  
  const dimensions = embeddings[0].length;
  const result = new Array(dimensions).fill(0);
  
  for (const embedding of embeddings) {
    for (let i = 0; i < dimensions; i++) {
      result[i] += embedding[i];
    }
  }
  
  // Average and normalize
  const magnitude = Math.sqrt(result.reduce((sum, val) => sum + (val / embeddings.length) ** 2, 0));
  
  return result.map(val => magnitude > 0 ? (val / embeddings.length) / magnitude : 0);
};
