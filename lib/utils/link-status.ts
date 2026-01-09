import { supabase } from '@/lib/supabase';

export interface LinkStatus {
  hasChunks: boolean;
  isProcessing: boolean;
  isPending: boolean;
  hasFailed: boolean;
}

/**
 * Check the processing status of a link by checking:
 * 1. If chunks exist in the database
 * 2. If there are pending/processing tasks
 * 3. If there are failed tasks
 */
export async function checkLinkStatus(linkId: string, userId: string): Promise<LinkStatus> {
  const client = supabase;
  if (!client) {
    return {
      hasChunks: false,
      isProcessing: false,
      isPending: false,
      hasFailed: false,
    };
  }

  // Check if chunks exist in database
  const { data: chunks, error: chunksError } = await client
    .from('link_chunks')
    .select('id')
    .eq('link_id', linkId)
    .limit(1);

  const hasChunks = !chunksError && chunks && chunks.length > 0;

  // Check for pending/processing tasks
  const { data: tasks, error: tasksError } = await client
    .from('background_tasks')
    .select('status')
    .eq('entity_id', linkId)
    .eq('entity_type', 'link')
    .eq('user_id', userId)
    .in('task_type', ['link_metadata', 'link_embeddings', 'refresh_link_content'])
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false })
    .limit(1);

  const isProcessing = !tasksError && tasks && tasks.length > 0 && tasks[0].status === 'processing';
  const isPending = !tasksError && tasks && tasks.length > 0 && tasks[0].status === 'pending';

  // Check for failed tasks (recent failures)
  const { data: failedTasks, error: failedError } = await client
    .from('background_tasks')
    .select('status, error_message')
    .eq('entity_id', linkId)
    .eq('entity_type', 'link')
    .eq('user_id', userId)
    .in('task_type', ['link_metadata', 'link_embeddings', 'refresh_link_content'])
    .eq('status', 'failed')
    .order('created_at', { ascending: false })
    .limit(1);

  // Consider it failed if there's a recent failed task and no chunks
  const hasFailed = !failedError && failedTasks && failedTasks.length > 0 && !hasChunks;

  return {
    hasChunks,
    isProcessing,
    isPending,
    hasFailed,
  };
}

/**
 * Batch check status for multiple links at once
 */
export async function batchCheckLinkStatuses(
  linkIds: string[],
  userId: string
): Promise<Map<string, LinkStatus>> {
  const client = supabase;
  if (!client || linkIds.length === 0) {
    return new Map();
  }

  const statusMap = new Map<string, LinkStatus>();

  // Initialize all links with default status
  linkIds.forEach(id => {
    statusMap.set(id, {
      hasChunks: false,
      isProcessing: false,
      isPending: false,
      hasFailed: false,
    });
  });

  // Batch check chunks
  const { data: chunks } = await client
    .from('link_chunks')
    .select('link_id')
    .in('link_id', linkIds);

  if (chunks) {
    const chunksByLinkId = new Set(chunks.map(c => c.link_id));
    linkIds.forEach(id => {
      if (chunksByLinkId.has(id)) {
        const status = statusMap.get(id)!;
        statusMap.set(id, { ...status, hasChunks: true });
      }
    });
  }

  // Batch check tasks
  const { data: tasks } = await client
    .from('background_tasks')
    .select('entity_id, status')
    .in('entity_id', linkIds)
    .eq('entity_type', 'link')
    .eq('user_id', userId)
    .in('task_type', ['link_metadata', 'link_embeddings', 'refresh_link_content'])
    .order('created_at', { ascending: false });

  if (tasks) {
    const tasksByLinkId = new Map<string, string>();
    tasks.forEach(task => {
      if (!tasksByLinkId.has(task.entity_id)) {
        tasksByLinkId.set(task.entity_id, task.status);
      }
    });

    linkIds.forEach(id => {
      const taskStatus = tasksByLinkId.get(id);
      if (taskStatus) {
        const status = statusMap.get(id)!;
        if (taskStatus === 'processing') {
          statusMap.set(id, { ...status, isProcessing: true });
        } else if (taskStatus === 'pending') {
          statusMap.set(id, { ...status, isPending: true });
        }
      }
    });
  }

  // Batch check failed tasks
  const { data: failedTasks } = await client
    .from('background_tasks')
    .select('entity_id')
    .in('entity_id', linkIds)
    .eq('entity_type', 'link')
    .eq('user_id', userId)
    .in('task_type', ['link_metadata', 'link_embeddings', 'refresh_link_content'])
    .eq('status', 'failed')
    .order('created_at', { ascending: false });

  if (failedTasks) {
    const failedLinkIds = new Set(failedTasks.map(t => t.entity_id));
    linkIds.forEach(id => {
      const status = statusMap.get(id)!;
      if (failedLinkIds.has(id) && !status.hasChunks) {
        statusMap.set(id, { ...status, hasFailed: true });
      }
    });
  }

  return statusMap;
}