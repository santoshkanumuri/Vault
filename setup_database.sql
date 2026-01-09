-- Vault Complete Database Setup with Semantic Search
-- Run this entire script in your Supabase SQL Editor

-- Enable pgvector extension for embeddings (if available)
-- Note: This may need to be enabled in Supabase dashboard first
CREATE EXTENSION IF NOT EXISTS vector;

-- First, create all the tables
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  show_metadata boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  description text DEFAULT '',
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  favicon text,
  metadata jsonb,
  -- New columns for semantic search
  full_content text,
  content_type text DEFAULT 'webpage',
  author text,
  word_count integer DEFAULT 0,
  embedding vector(3072), -- OpenAI text-embedding-3-large (3072 dimensions)
  created_at timestamptz DEFAULT now()
);

-- Text chunks table for fine-grained semantic search
CREATE TABLE IF NOT EXISTS link_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES links(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(3072), -- OpenAI text-embedding-3-large (3072 dimensions)
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text DEFAULT '',
  folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  -- New columns for semantic search
  embedding vector(3072), -- OpenAI text-embedding-3-large (3072 dimensions)
  created_at timestamptz DEFAULT now()
);

-- Note chunks table for fine-grained semantic search
CREATE TABLE IF NOT EXISTS note_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  chunk_text text NOT NULL,
  embedding vector(3072), -- OpenAI text-embedding-3-large (3072 dimensions)
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS link_tags (
  link_id uuid REFERENCES links(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (link_id, tag_id)
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id uuid REFERENCES notes(id) ON DELETE CASCADE,
  tag_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE link_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_chunks ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can insert own data during signup" ON users;
DROP POLICY IF EXISTS "Users can manage own folders" ON folders;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
DROP POLICY IF EXISTS "Users can manage own links" ON links;
DROP POLICY IF EXISTS "Users can manage own notes" ON notes;
DROP POLICY IF EXISTS "Users can manage own link tags" ON link_tags;
DROP POLICY IF EXISTS "Users can manage own note tags" ON note_tags;
DROP POLICY IF EXISTS "Users can manage own link chunks" ON link_chunks;
DROP POLICY IF EXISTS "Users can manage own note chunks" ON note_chunks;

-- Create policies for users table
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own data during signup"
  ON users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create policies for folders table
CREATE POLICY "Users can manage own folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for tags table
CREATE POLICY "Users can manage own tags"
  ON tags
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for links table
CREATE POLICY "Users can manage own links"
  ON links
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for notes table
CREATE POLICY "Users can manage own notes"
  ON notes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for link_tags table
CREATE POLICY "Users can manage own link tags"
  ON link_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links
      WHERE links.id = link_tags.link_id
      AND links.user_id = auth.uid()
    )
  );

-- Create policies for note_tags table
CREATE POLICY "Users can manage own note tags"
  ON note_tags
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_tags.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create policies for link_chunks table
CREATE POLICY "Users can manage own link chunks"
  ON link_chunks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM links
      WHERE links.id = link_chunks.link_id
      AND links.user_id = auth.uid()
    )
  );

-- Create policies for note_chunks table
CREATE POLICY "Users can manage own note chunks"
  ON note_chunks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notes
      WHERE notes.id = note_chunks.note_id
      AND notes.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_links_folder_id ON links(folder_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_folder_id ON notes(folder_id);
CREATE INDEX IF NOT EXISTS idx_link_tags_link_id ON link_tags(link_id);
CREATE INDEX IF NOT EXISTS idx_link_tags_tag_id ON link_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_note_id ON note_tags(note_id);
CREATE INDEX IF NOT EXISTS idx_note_tags_tag_id ON note_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_links_metadata ON links USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_links_full_content ON links USING gin(to_tsvector('english', coalesce(full_content, '')));
CREATE INDEX IF NOT EXISTS idx_notes_content ON notes USING gin(to_tsvector('english', coalesce(content, '')));

-- Vector similarity indexes (for semantic search)
-- NOTE: Both IVFFlat and HNSW indexes have a 2000 dimension limit in pgvector
-- Since we're using 3072-dimensional embeddings (text-embedding-3-large), we cannot create indexes
-- Semantic search will still work perfectly fine - it will use sequential scans instead of indexed scans
-- For most use cases with reasonable data sizes (< 100k vectors), performance will be acceptable
-- If you need better performance with large datasets, consider:
--   1. Using a smaller embedding model (e.g., text-embedding-3-small with 1536 dimensions)
--   2. Using a different vector database (e.g., Pinecone, Weaviate, Qdrant) that supports higher dimensions
--   3. Reducing embedding dimensions via PCA or other dimensionality reduction techniques

-- Drop any existing indexes that might have been created with lower dimensions
DROP INDEX IF EXISTS idx_links_embedding;
DROP INDEX IF EXISTS idx_notes_embedding;
DROP INDEX IF EXISTS idx_link_chunks_embedding;
DROP INDEX IF EXISTS idx_note_chunks_embedding;

-- No indexes created - semantic search functions will use sequential scans
-- This is fine for most applications with reasonable data sizes

-- Chunk indexes
CREATE INDEX IF NOT EXISTS idx_link_chunks_link_id ON link_chunks(link_id);
CREATE INDEX IF NOT EXISTS idx_note_chunks_note_id ON note_chunks(note_id);

-- Function to search links by semantic similarity
CREATE OR REPLACE FUNCTION match_links(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.url,
    l.description,
    1 - (l.embedding <=> query_embedding) as similarity
  FROM links l
  WHERE l.embedding IS NOT NULL
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND 1 - (l.embedding <=> query_embedding) > match_threshold
  ORDER BY l.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search link chunks by semantic similarity
CREATE OR REPLACE FUNCTION match_link_chunks(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  chunk_id uuid,
  link_id uuid,
  chunk_text text,
  chunk_index int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.id as chunk_id,
    lc.link_id,
    lc.chunk_text,
    lc.chunk_index,
    1 - (lc.embedding <=> query_embedding) as similarity
  FROM link_chunks lc
  JOIN links l ON l.id = lc.link_id
  WHERE lc.embedding IS NOT NULL
    AND (p_user_id IS NULL OR l.user_id = p_user_id)
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to search notes by semantic similarity
CREATE OR REPLACE FUNCTION match_notes(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    1 - (n.embedding <=> query_embedding) as similarity
  FROM notes n
  WHERE n.embedding IS NOT NULL
    AND (p_user_id IS NULL OR n.user_id = p_user_id)
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Hybrid search function (combines keyword and semantic search)
CREATE OR REPLACE FUNCTION hybrid_search_links(
  search_query text,
  query_embedding vector(3072),
  keyword_weight float DEFAULT 0.4,
  semantic_weight float DEFAULT 0.6,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  url text,
  description text,
  keyword_score float,
  semantic_score float,
  combined_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH keyword_results AS (
    SELECT
      l.id,
      l.name,
      l.url,
      l.description,
      ts_rank(
        to_tsvector('english', coalesce(l.name, '') || ' ' || coalesce(l.description, '') || ' ' || coalesce(l.full_content, '')),
        plainto_tsquery('english', search_query)
      ) as kw_score
    FROM links l
    WHERE (p_user_id IS NULL OR l.user_id = p_user_id)
      AND to_tsvector('english', coalesce(l.name, '') || ' ' || coalesce(l.description, '') || ' ' || coalesce(l.full_content, ''))
          @@ plainto_tsquery('english', search_query)
  ),
  semantic_results AS (
    SELECT
      l.id,
      1 - (l.embedding <=> query_embedding) as sem_score
    FROM links l
    WHERE l.embedding IS NOT NULL
      AND (p_user_id IS NULL OR l.user_id = p_user_id)
  )
  SELECT
    COALESCE(k.id, s.id) as id,
    l.name,
    l.url,
    l.description,
    COALESCE(k.kw_score, 0) as keyword_score,
    COALESCE(s.sem_score, 0) as semantic_score,
    (COALESCE(k.kw_score, 0) * keyword_weight + COALESCE(s.sem_score, 0) * semantic_weight) as combined_score
  FROM keyword_results k
  FULL OUTER JOIN semantic_results s ON k.id = s.id
  JOIN links l ON l.id = COALESCE(k.id, s.id)
  WHERE COALESCE(k.kw_score, 0) > 0 OR COALESCE(s.sem_score, 0) > 0.5
  ORDER BY combined_score DESC
  LIMIT match_count;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, show_metadata, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    true,
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, users.name);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Verify the setup
SELECT 'Database setup with semantic search completed successfully!' as status;
