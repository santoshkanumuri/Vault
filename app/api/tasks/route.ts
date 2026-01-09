import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

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

// GET: Get task status or list tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    const entityId = searchParams.get('entityId');
    const entityType = searchParams.get('entityType');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from('background_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (taskId) {
      query = query.eq('id', taskId);
    }
    if (entityId) {
      query = query.eq('entity_id', entityId);
    }
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (status) {
      // Support comma-separated statuses
      const statuses = status.split(',').map(s => s.trim());
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else {
        query = query.in('status', statuses);
      }
    }

    const { data, error } = await query.limit(100);

    if (error) {
      logger.error('GET /api/tasks: Database error', { error: error.message }, error);
      return NextResponse.json(
        { error: 'Failed to fetch tasks' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tasks: data || [] });
  } catch (error: any) {
    logger.error('GET /api/tasks: Error', { error: error.message }, error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST: Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      taskType,
      entityType,
      entityId,
      payload,
      priority = 5,
      maxRetries = 3,
    } = body;

    // Validate inputs
    if (!userId || !taskType || !entityType || !entityId) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, taskType, entityType, entityId' },
        { status: 400 }
      );
    }

    const validTaskTypes = ['link_metadata', 'link_embeddings', 'note_embeddings', 'refresh_link_content', 'refresh_note_content'];
    if (!validTaskTypes.includes(taskType)) {
      return NextResponse.json(
        { error: `Invalid taskType. Must be one of: ${validTaskTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Check if there's already a pending task for this entity
    const { data: existingTask } = await supabase
      .from('background_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('task_type', taskType)
      .in('status', ['pending', 'processing'])
      .single();

    if (existingTask) {
      logger.info('POST /api/tasks: Task already exists', {
        taskId: existingTask.id,
        entityId,
        taskType,
      });
      return NextResponse.json({
        task: existingTask,
        message: 'Task already exists',
      });
    }

    // Create new task
    const { data: task, error } = await supabase
      .from('background_tasks')
      .insert({
        user_id: userId,
        task_type: taskType,
        entity_type: entityType,
        entity_id: entityId,
        payload: payload || {},
        priority: Math.max(1, Math.min(10, priority)),
        max_retries: maxRetries,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      logger.error('POST /api/tasks: Database error', { error: error.message }, error);
      return NextResponse.json(
        { error: 'Failed to create task' },
        { status: 500 }
      );
    }

    logger.info('POST /api/tasks: Task created', {
      taskId: task.id,
      taskType,
      entityId,
    });

    // Get base URL from request for internal API calls
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;
    
    // Trigger background processing (non-blocking)
    processTaskInBackground(task.id, baseUrl).catch((err) => {
      logger.error('POST /api/tasks: Background processing error', {
        taskId: task.id,
        error: err.message,
      }, err);
    });

    return NextResponse.json({ task });
  } catch (error: any) {
    logger.error('POST /api/tasks: Error', { error: error.message }, error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// Background task processor (runs asynchronously)
async function processTaskInBackground(taskId: string, baseUrl?: string) {
  const supabase = getSupabaseAdmin();
  
  try {
    // Get task details
    const { data: task, error: fetchError } = await supabase
      .from('background_tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !task) {
      logger.error('processTaskInBackground: Task not found', { taskId });
      return;
    }

    logger.info('processTaskInBackground: Processing task', {
      taskId,
      taskType: task.task_type,
      entityId: task.entity_id,
    });

    let result: any = null;
    let errorMessage: string | null = null;

    // Process based on task type
    switch (task.task_type) {
      case 'link_metadata':
      case 'refresh_link_content':
        result = await processLinkMetadataTask(task);
        break;
      case 'link_embeddings':
        result = await processLinkEmbeddingsTask(task, baseUrl);
        break;
      case 'note_embeddings':
      case 'refresh_note_content':
        result = await processNoteEmbeddingsTask(task, baseUrl);
        break;
      default:
        throw new Error(`Unknown task type: ${task.task_type}`);
    }

    // Mark task as completed
    await supabase.rpc('complete_task', {
      p_task_id: taskId,
      p_result: result,
    });

    logger.info('processTaskInBackground: Task completed', { taskId });
  } catch (error: any) {
    logger.error('processTaskInBackground: Task failed', {
      taskId,
      error: error.message,
    }, error);

    // Mark task as failed (with retry logic)
    const supabase = getSupabaseAdmin();
    await supabase.rpc('fail_task', {
      p_task_id: taskId,
      p_error_message: error.message,
      p_should_retry: true,
    });

    // If task should be retried, schedule retry
    const { data: updatedTask } = await supabase
      .from('background_tasks')
      .select('status, retry_count, max_retries')
      .eq('id', taskId)
      .single();

    if (updatedTask?.status === 'pending' && updatedTask.retry_count < updatedTask.max_retries) {
      // Retry after exponential backoff
      const retryDelay = Math.pow(2, updatedTask.retry_count) * 1000; // 1s, 2s, 4s
      setTimeout(() => {
        processTaskInBackground(taskId).catch(console.error);
      }, retryDelay);
    }
  }
}

// Process link metadata task
async function processLinkMetadataTask(task: any) {
  const supabase = getSupabaseAdmin();
  const { entity_id: linkId, payload } = task;

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
  
  // Use direct import instead of HTTP fetch to avoid network issues
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
async function processLinkEmbeddingsTask(task: any, baseUrl?: string) {
  const supabase = getSupabaseAdmin();
  const { entity_id: linkId } = task;
  
  // Use provided baseUrl or construct from env vars
  const apiBaseUrl = baseUrl || 
                     process.env.NEXT_PUBLIC_APP_URL || 
                     (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

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

  logger.info('processLinkEmbeddingsTask: Generating embeddings', { 
    linkId, 
    textLength: textToEmbed.length,
    apiBaseUrl 
  });
  
  const embeddingResponse = await fetch(
    `${apiBaseUrl}/api/embeddings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [textToEmbed],
        chunk: false, // No chunking for simple metadata
      }),
      cache: 'no-store',
    }
  );

  if (!embeddingResponse.ok) {
    throw new Error(`Embedding generation failed: ${embeddingResponse.status}`);
  }

  const embeddingData = await embeddingResponse.json();
  if (!embeddingData.embeddings || embeddingData.embeddings.length === 0) {
    throw new Error('No embeddings generated');
  }

  // Get the single embedding (no chunks for metadata-only)
  const embedding = embeddingData.embeddings[0]?.embedding;
  if (!embedding || embedding.length === 0) {
    throw new Error('Invalid embedding returned');
  }

  // Save embedding (no chunks)
  const { updateLinkEmbeddings } = await import('@/lib/services/database');
  await updateLinkEmbeddings(linkId, embedding, []); // Empty chunks array

  return {
    success: true,
    chunksCount: 0,
    embeddingDimensions: embedding.length,
  };
}

// Process note embeddings task
async function processNoteEmbeddingsTask(task: any) {
  const supabase = getSupabaseAdmin();
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

  // Generate embeddings
  const embeddingResponse = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/embeddings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: [fullText],
        chunk: true,
        chunkSize: 500,
        chunkOverlap: 50,
      }),
    }
  );

  if (!embeddingResponse.ok) {
    throw new Error(`Embedding generation failed: ${embeddingResponse.status}`);
  }

  const embeddingData = await embeddingResponse.json();
  if (!embeddingData.embeddings || embeddingData.embeddings.length === 0) {
    throw new Error('No embeddings generated');
  }

  // Process chunks
  const chunks = embeddingData.embeddings.map((emb: any, i: number) => ({
    id: `chunk_${Date.now()}_${i}`,
    text: emb.text,
    index: emb.chunkIndex,
    embedding: emb.embedding,
  }));

  // Calculate average embedding
  const avgEmbedding = calculateAverageEmbedding(
    chunks.map((c: any) => c.embedding).filter(Boolean)
  );

  // Save embeddings
  const { updateNoteEmbeddings } = await import('@/lib/services/database');
  await updateNoteEmbeddings(noteId, avgEmbedding, chunks);

  return {
    success: true,
    chunksCount: chunks.length,
    embeddingDimensions: avgEmbedding.length,
  };
}

// Helper function to calculate average embedding
function calculateAverageEmbedding(embeddings: number[][]): number[] {
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
}
