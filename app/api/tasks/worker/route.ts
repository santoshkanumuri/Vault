import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

// Worker endpoint to process pending tasks
// This can be called periodically (e.g., via cron job or scheduled function)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { maxTasks = 10, userId } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    logger.info('Worker: Starting task processing', { maxTasks, userId });

    // Get next pending tasks - call multiple times to get up to maxTasks
    const tasksToProcess: any[] = [];
    
    for (let i = 0; i < maxTasks; i++) {
      const { data: task, error } = await supabase.rpc('get_next_pending_task', {
        p_user_id: userId || null,
      });

      if (error) {
        // If error is "no rows returned", that's fine - no more tasks
        if (error.message?.includes('no rows') || error.code === 'PGRST116') {
          break;
        }
        logger.error('Worker: Error fetching tasks', { error: error.message, errorCode: error.code }, error);
        // Continue to next iteration instead of failing completely
        break;
      }

      if (!task || (Array.isArray(task) && task.length === 0)) {
        break; // No more tasks
      }

      // RPC returns single row or array - normalize it
      const taskRow = Array.isArray(task) ? task[0] : task;
      if (taskRow) {
        tasksToProcess.push(taskRow);
      } else {
        break; // No more tasks
      }
    }

    if (tasksToProcess.length === 0) {
      return NextResponse.json({
        processed: 0,
        message: 'No pending tasks',
      });
    }
    const processed: string[] = [];
    const failed: string[] = [];

    for (const task of tasksToProcess) {
      try {
        await processTask(task.id);
        processed.push(task.id);
      } catch (error: any) {
        logger.error('Worker: Task processing failed', {
          taskId: task.id,
          error: error.message,
        }, error);
        failed.push(task.id);
      }
    }

    logger.info('Worker: Task processing completed', {
      processed: processed.length,
      failed: failed.length,
    });

    return NextResponse.json({
      processed: processed.length,
      failed: failed.length,
      taskIds: { processed, failed },
    });
  } catch (error: any) {
    logger.error('Worker: Error', { error: error.message }, error);
    return NextResponse.json(
      { error: 'Worker processing failed' },
      { status: 500 }
    );
  }
}

// Process a single task
async function processTask(taskId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase configuration missing');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Get task details
  const { data: task, error: fetchError } = await supabase
    .from('background_tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (fetchError || !task) {
    throw new Error(`Task not found: ${taskId}`);
  }

  logger.info('Worker: Processing task', {
    taskId,
    taskType: task.task_type,
    entityId: task.entity_id,
  });

  let result: any = null;
  let errorMessage: string | null = null;

  try {
    // Process based on task type
    switch (task.task_type) {
      case 'link_metadata':
      case 'refresh_link_content':
        result = await processLinkMetadataTask(task, supabase);
        break;
      case 'link_embeddings':
        result = await processLinkEmbeddingsTask(task, supabase);
        break;
      case 'note_embeddings':
      case 'refresh_note_content':
        result = await processNoteEmbeddingsTask(task, supabase);
        break;
      default:
        throw new Error(`Unknown task type: ${task.task_type}`);
    }

    // Mark task as completed
    await supabase.rpc('complete_task', {
      p_task_id: taskId,
      p_result: result,
    });

    logger.info('Worker: Task completed', { taskId });
  } catch (error: any) {
    errorMessage = error.message;
    logger.error('Worker: Task failed', {
      taskId,
      error: errorMessage,
    }, error);

    // Mark task as failed (with retry logic)
    await supabase.rpc('fail_task', {
      p_task_id: taskId,
      p_error_message: errorMessage,
      p_should_retry: true,
    });

    throw error;
  }
}

// Process link metadata task
async function processLinkMetadataTask(task: any, supabase: any) {
  const { entity_id: linkId } = task;

  // Get link URL
  const { data: link, error: linkError } = await supabase
    .from('links')
    .select('url')
    .eq('id', linkId)
    .single();

  if (linkError || !link) {
    throw new Error(`Link not found: ${linkId}`);
  }

  // Fetch metadata only (no full content extraction)
  logger.info('processLinkMetadataTask: Fetching metadata', { linkId, url: link.url });
  
  const { fetchLinkMetadata } = await import('@/lib/utils/metadata');
  const metadata = await fetchLinkMetadata(link.url);

  // Update link with metadata
  const { error: updateError } = await supabase
    .from('links')
    .update({
      metadata: metadata,
    })
    .eq('id', linkId);

  if (updateError) {
    throw new Error(`Failed to update link: ${updateError.message}`);
  }

  return {
    success: true,
    hasTitle: !!metadata.title,
    hasDescription: !!metadata.description,
  };
}

// Process link embeddings task
async function processLinkEmbeddingsTask(task: any, supabase: any) {
  const { entity_id: linkId } = task;

  // Get link with metadata
  const { data: link, error: linkError } = await supabase
    .from('links')
    .select('name, metadata')
    .eq('id', linkId)
    .single();

  if (linkError || !link) {
    throw new Error(`Link not found: ${linkId}`);
  }

  // Build text for embedding: title + description
  const title = link.name || link.metadata?.title || '';
  const description = link.metadata?.description || '';
  const textToEmbed = [title, description].filter(Boolean).join(' ').trim();

  if (!textToEmbed || textToEmbed.length < 10) {
    throw new Error(`Link metadata too short for embeddings (length: ${textToEmbed.length}). Title or description is required.`);
  }

  // Generate embeddings directly (no HTTP fetch, no chunking needed for just title + description)
  try {
    const { generateEmbedding } = await import('@/lib/utils/embeddings');
    const apiKey = process.env.OPENAI_API_KEY;
    const embeddingResult = await generateEmbedding(textToEmbed, {
      apiKey,
      model: 'text-embedding-3-large',
      dimensions: 3072,
    });

    if (!embeddingResult || !embeddingResult.embedding || embeddingResult.embedding.length === 0) {
      throw new Error('No embedding generated');
    }

    // Save embedding (no chunks)
    const { updateLinkEmbeddings } = await import('@/lib/services/database');
    await updateLinkEmbeddings(linkId, embeddingResult.embedding, []); // Empty chunks array

    return {
      success: true,
      chunksCount: 0,
      embeddingDimensions: embeddingResult.embedding.length,
    };
  } catch (error: any) {
    logger.error('processLinkEmbeddingsTask: Error', { 
      linkId, 
      error: error.message 
    }, error);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

// Process note embeddings task
async function processNoteEmbeddingsTask(task: any, supabase: any) {
  const { entity_id: noteId } = task;

  // Get note content
  const { data: note, error: noteError } = await supabase
    .from('notes')
    .select('title, content')
    .eq('id', noteId)
    .single();

  if (noteError || !note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  const fullText = `${note.title}\n\n${note.content}`;
  if (fullText.length < 50) {
    throw new Error('Note content too short for embeddings');
  }

  try {
    // Generate embeddings directly (no HTTP fetch)
    const { generateEmbeddings, generateEmbedding, averageEmbeddings } = await import('@/lib/utils/embeddings');
    const apiKey = process.env.OPENAI_API_KEY;
    const embeddingConfig = {
      apiKey,
      model: 'text-embedding-3-large',
      dimensions: 3072,
    };

    let chunks: Array<{ id: string; text: string; index: number; embedding: number[] }>;
    let avgEmbedding: number[];

    // Try chunking the text first
    const { chunkText } = await import('@/lib/utils/text-chunker');
    const textChunks = chunkText(fullText, {
      chunkSize: 500,
      chunkOverlap: 50,
      minChunkSize: 50, // Lowered from 100 to handle shorter notes
      splitBy: 'sentence',
    });

    if (textChunks.length > 0) {
      // Multiple chunks - generate embeddings for each
      logger.info('processNoteEmbeddingsTask: Chunking note', { 
        noteId, 
        chunksCount: textChunks.length,
        textLength: fullText.length 
      });

      const embeddingResults = await generateEmbeddings(
        textChunks.map(chunk => chunk.text),
        embeddingConfig
      );

      if (embeddingResults.length === 0) {
        throw new Error('No embeddings generated');
      }

      // Process chunks with embeddings
      chunks = textChunks.map((chunk, i) => ({
        id: chunk.id,
        text: chunk.text,
        index: chunk.index,
        embedding: embeddingResults[i]?.embedding || [],
      }));

      // Calculate average embedding
      const validEmbeddings = chunks.map((c: any) => c.embedding).filter((emb: number[]) => emb.length > 0);
      if (validEmbeddings.length === 0) {
        throw new Error('No valid embeddings in chunks');
      }
      avgEmbedding = averageEmbeddings(validEmbeddings);
    } else {
      // Text too short to chunk - generate single embedding for full text
      logger.info('processNoteEmbeddingsTask: Note too short to chunk, using full text', { 
        noteId, 
        textLength: fullText.length 
      });

      const embeddingResult = await generateEmbedding(fullText, embeddingConfig);
      
      if (!embeddingResult || !embeddingResult.embedding || embeddingResult.embedding.length === 0) {
        throw new Error('No embedding generated for full text');
      }

      // Use the single embedding as both the main embedding and the only chunk
      avgEmbedding = embeddingResult.embedding;
      chunks = [{
        id: `chunk_${noteId}_0`,
        text: fullText,
        index: 0,
        embedding: embeddingResult.embedding,
      }];
    }

    if (avgEmbedding.length === 0) {
      throw new Error('Failed to generate embedding');
    }

    // Save embeddings
    const { updateNoteEmbeddings } = await import('@/lib/services/database');
    await updateNoteEmbeddings(noteId, avgEmbedding, chunks);

    return {
      success: true,
      chunksCount: chunks.length,
      embeddingDimensions: avgEmbedding.length,
    };
  } catch (error: any) {
    logger.error('processNoteEmbeddingsTask: Error', { 
      noteId, 
      error: error.message,
      textLength: fullText.length
    }, error);
    throw new Error(`Failed to generate embeddings: ${error.message}`);
  }
}

