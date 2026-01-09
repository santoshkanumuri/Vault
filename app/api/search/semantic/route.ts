import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Calculate cosine similarity between two vectors
function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// Get Supabase admin client (server-side only)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId, limit = 20, threshold = 0.5 } = body;

    if (!query || !userId) {
      return NextResponse.json(
        { error: 'Query and userId are required' },
        { status: 400 }
      );
    }

    // Generate query embedding
    const embeddingResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/embeddings`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [query],
          chunk: false,
        }),
      }
    );

    if (!embeddingResponse.ok) {
      logger.error('Semantic search: Failed to generate embedding', {
        status: embeddingResponse.status,
      });
      return NextResponse.json(
        { error: 'Failed to generate query embedding' },
        { status: 500 }
      );
    }

    const embeddingData = await embeddingResponse.json();
    if (!embeddingData.embeddings || embeddingData.embeddings.length === 0) {
      return NextResponse.json(
        { error: 'No embedding generated' },
        { status: 500 }
      );
    }

    const queryEmbedding = embeddingData.embeddings[0].embedding;

    const supabase = getSupabaseAdmin();
    const results: Array<{
      type: 'link' | 'note';
      item: any;
      similarity: number;
      chunkText?: string;
    }> = [];

    // Search link chunks
    const { data: linkChunks, error: linkChunksError } = await supabase.rpc(
      'match_link_chunks',
      {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
        p_user_id: userId,
      }
    );

    if (!linkChunksError && linkChunks) {
      // Get unique link IDs
      const linkIds = [...new Set(linkChunks.map((c: any) => c.link_id))];
      
      // Fetch full link data
      const { data: links, error: linksError } = await supabase
        .from('links')
        .select('*')
        .in('id', linkIds);

      if (!linksError && links) {
        // Map chunks to links
        const linkMap = new Map(links.map((l: any) => [l.id, l]));
        const chunkMap = new Map<string, any[]>();
        
        linkChunks.forEach((chunk: any) => {
          if (!chunkMap.has(chunk.link_id)) {
            chunkMap.set(chunk.link_id, []);
          }
          chunkMap.get(chunk.link_id)!.push(chunk);
        });

        linkChunks.forEach((chunk: any) => {
          const link = linkMap.get(chunk.link_id);
          if (link) {
            // Avoid duplicates
            if (!results.some(r => r.type === 'link' && r.item.id === link.id)) {
              results.push({
                type: 'link',
                item: {
                  id: link.id,
                  name: link.name || 'Untitled Link',
                  url: link.url || '',
                  description: link.description || '',
                  folderId: link.folder_id || null,
                  tagIds: link.tag_ids || [],
                  createdAt: link.created_at || new Date().toISOString(),
                  favicon: link.favicon,
                  metadata: link.metadata,
                },
                similarity: chunk.similarity,
                chunkText: chunk.chunk_text,
              });
            }
          }
        });
      }
    }

    // Search note chunks - query directly since match_note_chunks doesn't exist
    const { data: noteChunksData, error: noteChunksError } = await supabase
      .from('note_chunks')
      .select(`
        id,
        note_id,
        chunk_text,
        chunk_index,
        embedding,
        notes(id, title, content, folder_id, tag_ids, created_at, user_id)
      `)
      .not('embedding', 'is', null)
      .limit(limit * 5); // Get more to filter by similarity

    if (!noteChunksError && noteChunksData) {
      // Calculate similarity for each chunk and filter by user_id
      const chunksWithSimilarity = noteChunksData
        .map((chunk: any) => {
          if (!chunk.embedding || !chunk.notes || chunk.notes.user_id !== userId) {
            return null;
          }
          
          // Calculate cosine similarity
          const similarity = calculateCosineSimilarity(queryEmbedding, chunk.embedding);
          
          if (similarity >= threshold) {
            return {
              ...chunk,
              similarity,
              note: chunk.notes,
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, limit);

      // Add note results
      chunksWithSimilarity.forEach((chunk: any) => {
        const note = chunk.note;
        if (note) {
          // Avoid duplicates
          if (!results.some(r => r.type === 'note' && r.item.id === note.id)) {
            results.push({
              type: 'note',
              item: {
                id: note.id,
                title: note.title || 'Untitled Note',
                content: note.content || '',
                folderId: note.folder_id || null,
                tagIds: note.tag_ids || [],
                createdAt: note.created_at || new Date().toISOString(),
              },
              similarity: chunk.similarity,
              chunkText: chunk.chunk_text,
            });
          }
        }
      });
    }

    // Also search link-level and note-level embeddings
    const { data: links, error: linksError } = await supabase.rpc('match_links', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_user_id: userId,
    });

    if (!linksError && links) {
      // Fetch full link data for links found by match_links
      const linkIds = links.map((l: any) => l.id);
      const { data: fullLinks, error: fullLinksError } = await supabase
        .from('links')
        .select('*')
        .in('id', linkIds);

      if (!fullLinksError && fullLinks) {
        const linkMap = new Map(fullLinks.map((l: any) => [l.id, l]));
        links.forEach((link: any) => {
          const fullLink = linkMap.get(link.id);
          // Only add if not already in results
          if (!results.some(r => r.type === 'link' && r.item.id === link.id)) {
            results.push({
              type: 'link',
              item: {
                id: link.id,
                name: fullLink?.name || link.name || 'Untitled Link',
                url: fullLink?.url || link.url || '',
                description: fullLink?.description || link.description || '',
                folderId: fullLink?.folder_id || null,
                tagIds: fullLink?.tag_ids || [],
                createdAt: fullLink?.created_at || new Date().toISOString(),
                favicon: fullLink?.favicon,
                metadata: fullLink?.metadata,
              },
              similarity: link.similarity,
            });
          }
        });
      }
    }

    const { data: notes, error: notesError } = await supabase.rpc('match_notes', {
      query_embedding: queryEmbedding,
      match_threshold: threshold,
      match_count: limit,
      p_user_id: userId,
    });

    if (!notesError && notes) {
      // Fetch full note data for notes found by match_notes
      const noteIds = notes.map((n: any) => n.id);
      const { data: fullNotes, error: fullNotesError } = await supabase
        .from('notes')
        .select('*')
        .in('id', noteIds);

      if (!fullNotesError && fullNotes) {
        const noteMap = new Map(fullNotes.map((n: any) => [n.id, n]));
        notes.forEach((note: any) => {
          const fullNote = noteMap.get(note.id);
          // Only add if not already in results
          if (!results.some(r => r.type === 'note' && r.item.id === note.id)) {
            results.push({
              type: 'note',
              item: {
                id: note.id,
                title: fullNote?.title || note.title || 'Untitled Note',
                content: fullNote?.content || note.content || '',
                folderId: fullNote?.folder_id || null,
                tagIds: fullNote?.tag_ids || [],
                createdAt: fullNote?.created_at || new Date().toISOString(),
              },
              similarity: note.similarity,
            });
          }
        });
      }
    }

    // Sort by similarity and limit
    results.sort((a, b) => b.similarity - a.similarity);
    const limitedResults = results.slice(0, limit);

    logger.info('Semantic search completed', {
      query,
      userId,
      resultsCount: limitedResults.length,
    });

    return NextResponse.json({ results: limitedResults });
  } catch (error: any) {
    logger.error('Semantic search error', { error: error.message }, error);
    return NextResponse.json(
      { error: 'Search failed', message: error.message },
      { status: 500 }
    );
  }
}
