// Task polling utility for checking task status

export interface Task {
  id: string;
  user_id: string;
  task_type: string;
  entity_type: string;
  entity_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  payload?: any;
  result?: any;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface TaskPollingOptions {
  entityId: string;
  entityType: 'link' | 'note';
  userId: string;
  onStatusChange?: (task: Task) => void;
  onComplete?: (task: Task) => void;
  onError?: (task: Task) => void;
  pollInterval?: number;
  maxPollTime?: number;
}

/**
 * Poll for task status until completion or timeout
 */
export async function pollTaskStatus(
  options: TaskPollingOptions
): Promise<Task | null> {
  const {
    entityId,
    entityType,
    userId,
    onStatusChange,
    onComplete,
    onError,
    pollInterval = 2000, // 2 seconds
    maxPollTime = 120000, // 2 minutes
  } = options;

  const startTime = Date.now();
  let lastStatus: string | null = null;

  while (Date.now() - startTime < maxPollTime) {
    try {
      const response = await fetch(
        `/api/tasks?entityId=${entityId}&entityType=${entityType}&userId=${userId}&status=pending,processing`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status}`);
      }

      const { tasks } = await response.json();
      const relevantTasks = tasks.filter(
        (t: Task) =>
          t.entity_id === entityId &&
          t.entity_type === entityType &&
          (t.status === 'pending' || t.status === 'processing' || t.status === 'completed' || t.status === 'failed')
      );

      if (relevantTasks.length === 0) {
        // No tasks found - might be completed already
        return null;
      }

      // Get the most recent task
      const task = relevantTasks[0];

      // Notify on status change
      if (task.status !== lastStatus) {
        lastStatus = task.status;
        onStatusChange?.(task);
      }

      // Handle completion
      if (task.status === 'completed') {
        onComplete?.(task);
        return task;
      }

      // Handle failure
      if (task.status === 'failed') {
        onError?.(task);
        return task;
      }

      // Continue polling if still pending or processing
      if (task.status === 'pending' || task.status === 'processing') {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        continue;
      }
    } catch (error) {
      console.error('Task polling error:', error);
      // Continue polling on error
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout reached
  return null;
}

/**
 * Get task status for an entity
 */
export async function getTaskStatus(
  entityId: string,
  entityType: 'link' | 'note',
  userId: string
): Promise<Task[]> {
  try {
    const response = await fetch(
      `/api/tasks?entityId=${entityId}&entityType=${entityType}&userId=${userId}`
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch tasks: ${response.status}`);
    }

    const { tasks } = await response.json();
    return tasks || [];
  } catch (error) {
    console.error('Failed to get task status:', error);
    return [];
  }
}
