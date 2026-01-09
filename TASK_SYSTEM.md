# Background Task System

## Overview

The application now uses a **server-side background task queue system** for processing metadata extraction and embedding generation. This ensures tasks continue processing even if the user closes their browser.

## Architecture

### Components

1. **Database Table** (`background_tasks`)
   - Stores all background tasks with status tracking
   - Supports retry logic and priority queuing
   - Located in `setup_tasks_table.sql`

2. **Task API** (`/api/tasks`)
   - `GET`: Query task status
   - `POST`: Create new tasks
   - Located in `app/api/tasks/route.ts`

3. **Worker API** (`/api/tasks/worker`)
   - Processes pending tasks
   - Can be called periodically or on-demand
   - Located in `app/api/tasks/worker/route.ts`

4. **Frontend Integration** (`AppContext.tsx`)
   - Queues tasks instead of running them directly
   - Tasks are processed server-side

## Setup Instructions

### 1. Database Setup

Run the SQL script to create the tasks table:

```sql
-- Run setup_tasks_table.sql in your Supabase SQL Editor
```

This creates:
- `background_tasks` table
- RLS policies
- Helper functions (`get_next_pending_task`, `complete_task`, `fail_task`)
- Indexes for performance

### 2. Environment Variables

Add to your `.env.local`:

```env
# Required for task processing
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production URL
```

**Important**: The `SUPABASE_SERVICE_ROLE_KEY` is needed for server-side task processing. Get it from your Supabase project settings.

### 3. Worker Setup

You have two options for processing tasks:

#### Option A: On-Demand Processing (Current Implementation)
Tasks are processed immediately when queued. The worker is called automatically after task creation.

#### Option B: Scheduled Processing (Recommended for Production)
Set up a cron job or scheduled function to call the worker periodically:

```bash
# Example: Call worker every minute
curl -X POST https://your-domain.com/api/tasks/worker \
  -H "Content-Type: application/json" \
  -d '{"maxTasks": 10}'
```

Or use Vercel Cron Jobs (add to `vercel.json`):

```json
{
  "crons": [{
    "path": "/api/tasks/worker",
    "schedule": "*/1 * * * *"
  }]
}
```

## Task Types

### Link Tasks

1. **`link_metadata`** - Extract metadata and full content from URL
   - Priority: 7 (high)
   - Runs first to get content

2. **`link_embeddings`** - Generate embeddings for link content
   - Priority: 5 (medium)
   - Runs after metadata extraction

3. **`refresh_link_content`** - Refresh metadata and embeddings
   - Priority: 7 (high)
   - Full refresh of link content

### Note Tasks

1. **`note_embeddings`** - Generate embeddings for note content
   - Priority: 5 (medium)

2. **`refresh_note_content`** - Refresh note embeddings
   - Priority: 5 (medium)

## Task Lifecycle

1. **Pending** - Task is queued, waiting to be processed
2. **Processing** - Task is currently being executed
3. **Completed** - Task finished successfully
4. **Failed** - Task failed after all retries
5. **Cancelled** - Task was cancelled (not currently used)

## Retry Logic

- Tasks automatically retry on failure
- Default: 3 retries with exponential backoff
- Retry delay: 1s, 2s, 4s (doubles each retry)
- After max retries, task is marked as `failed`

## Usage Examples

### Queue a Task (Automatic)

Tasks are automatically queued when:
- Creating a new link
- Updating a link URL
- Creating/updating a note
- Calling `refreshLinkContent()` or `refreshNoteContent()`

### Check Task Status

```typescript
import { getTaskStatus } from '@/lib/utils/task-polling';

const tasks = await getTaskStatus(
  linkId,
  'link',
  userId
);

console.log(tasks); // Array of tasks for this link
```

### Poll for Completion

```typescript
import { pollTaskStatus } from '@/lib/utils/task-polling';

const task = await pollTaskStatus({
  entityId: linkId,
  entityType: 'link',
  userId: userId,
  onStatusChange: (task) => {
    console.log('Status changed:', task.status);
  },
  onComplete: (task) => {
    console.log('Task completed!', task.result);
  },
  onError: (task) => {
    console.error('Task failed:', task.error_message);
  },
});
```

## Benefits

1. **Persistence** - Tasks continue even if browser closes
2. **Reliability** - Automatic retry on failures
3. **Scalability** - Can process multiple tasks concurrently
4. **Priority** - Important tasks processed first
5. **Monitoring** - Track task status and history
6. **Consistency** - All processing happens server-side

## Monitoring

Query tasks in Supabase:

```sql
-- Get all pending tasks
SELECT * FROM background_tasks WHERE status = 'pending';

-- Get failed tasks
SELECT * FROM background_tasks WHERE status = 'failed';

-- Get tasks for a specific link
SELECT * FROM background_tasks 
WHERE entity_type = 'link' AND entity_id = 'your-link-id';
```

## Troubleshooting

### Tasks Not Processing

1. Check worker is being called:
   - Verify `SUPABASE_SERVICE_ROLE_KEY` is set
   - Check server logs for errors
   - Verify worker endpoint is accessible

2. Check task status:
   ```sql
   SELECT * FROM background_tasks WHERE status = 'pending' ORDER BY created_at;
   ```

3. Manually trigger worker:
   ```bash
   curl -X POST http://localhost:3000/api/tasks/worker \
     -H "Content-Type: application/json" \
     -d '{"maxTasks": 10}'
   ```

### Tasks Failing

1. Check error messages:
   ```sql
   SELECT id, task_type, error_message, retry_count 
   FROM background_tasks 
   WHERE status = 'failed';
   ```

2. Common issues:
   - Missing content (content too short)
   - Network timeouts
   - API rate limits
   - Invalid URLs

### Performance

- Tasks are processed sequentially per worker call
- Adjust `maxTasks` in worker call to process more at once
- Use priority to ensure important tasks run first
- Consider multiple worker instances for high volume

## Future Enhancements

- [ ] Task cancellation
- [ ] Task progress tracking
- [ ] Webhook notifications on completion
- [ ] Task scheduling (run at specific times)
- [ ] Batch task operations
- [ ] Task analytics dashboard
