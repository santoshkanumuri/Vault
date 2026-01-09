-- Background Tasks Table for Processing Metadata and Embeddings
-- Run this in your Supabase SQL Editor after setup_database.sql

-- Create tasks table for background job processing
CREATE TABLE IF NOT EXISTS background_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  task_type text NOT NULL CHECK (task_type IN ('link_metadata', 'link_embeddings', 'note_embeddings', 'refresh_link_content', 'refresh_note_content')),
  entity_type text NOT NULL CHECK (entity_type IN ('link', 'note')),
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  priority integer DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  payload jsonb, -- Task-specific data (e.g., URL for link tasks)
  result jsonb, -- Task result data
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE background_tasks ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS "Users can manage own tasks" ON background_tasks;

-- Create policy for tasks
CREATE POLICY "Users can manage own tasks"
  ON background_tasks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_background_tasks_user_id ON background_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_status ON background_tasks(status);
CREATE INDEX IF NOT EXISTS idx_background_tasks_entity ON background_tasks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_background_tasks_pending ON background_tasks(status, priority DESC, created_at ASC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_background_tasks_processing ON background_tasks(status, started_at) WHERE status = 'processing';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_background_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS trigger_background_tasks_updated_at ON background_tasks;
CREATE TRIGGER trigger_background_tasks_updated_at
  BEFORE UPDATE ON background_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_background_tasks_updated_at();

-- Function to get next pending task (for worker)
CREATE OR REPLACE FUNCTION get_next_pending_task(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  task_type text,
  entity_type text,
  entity_id uuid,
  payload jsonb,
  retry_count integer,
  max_retries integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  task_id_val uuid;
  task_user_id_val uuid;
  task_type_val text;
  task_entity_type_val text;
  task_entity_id_val uuid;
  task_payload_val jsonb;
  task_retry_count_val integer;
  task_max_retries_val integer;
BEGIN
  -- Select next pending task ordered by priority and creation time
  SELECT 
    bt.id,
    bt.user_id,
    bt.task_type,
    bt.entity_type,
    bt.entity_id,
    bt.payload,
    bt.retry_count,
    bt.max_retries
  INTO 
    task_id_val,
    task_user_id_val,
    task_type_val,
    task_entity_type_val,
    task_entity_id_val,
    task_payload_val,
    task_retry_count_val,
    task_max_retries_val
  FROM background_tasks bt
  WHERE bt.status = 'pending'
    AND (p_user_id IS NULL OR bt.user_id = p_user_id)
  ORDER BY bt.priority DESC, bt.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED; -- Prevent multiple workers from picking same task

  -- If task found, mark as processing and return
  IF task_id_val IS NOT NULL THEN
    UPDATE background_tasks
    SET status = 'processing',
        started_at = now()
    WHERE background_tasks.id = task_id_val;

    RETURN QUERY SELECT
      task_id_val,
      task_user_id_val,
      task_type_val,
      task_entity_type_val,
      task_entity_id_val,
      task_payload_val,
      task_retry_count_val,
      task_max_retries_val;
  END IF;
END;
$$;

-- Function to mark task as completed
CREATE OR REPLACE FUNCTION complete_task(
  p_task_id uuid,
  p_result jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE background_tasks
  SET status = 'completed',
      result = p_result,
      completed_at = now()
  WHERE id = p_task_id;
END;
$$;

-- Function to mark task as failed
CREATE OR REPLACE FUNCTION fail_task(
  p_task_id uuid,
  p_error_message text,
  p_should_retry boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_retry_count integer;
  current_max_retries integer;
BEGIN
  SELECT retry_count, max_retries INTO current_retry_count, current_max_retries
  FROM background_tasks
  WHERE id = p_task_id;

  -- If should retry and haven't exceeded max retries, reset to pending
  IF p_should_retry AND current_retry_count < current_max_retries THEN
    UPDATE background_tasks
    SET status = 'pending',
        retry_count = current_retry_count + 1,
        error_message = p_error_message,
        started_at = NULL
    WHERE id = p_task_id;
  ELSE
    -- Mark as failed permanently
    UPDATE background_tasks
    SET status = 'failed',
        error_message = p_error_message,
        completed_at = now()
    WHERE id = p_task_id;
  END IF;
END;
$$;

-- Verify the setup
SELECT 'Background tasks table setup completed successfully!' as status;
