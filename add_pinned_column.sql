-- Add is_pinned column to links and notes tables for pinning/favorites feature
-- Run this in your Supabase SQL Editor

-- Add is_pinned column to links table
ALTER TABLE links ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Add is_pinned column to notes table  
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create index for faster sorting by pinned status
CREATE INDEX IF NOT EXISTS idx_links_is_pinned ON links(is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned DESC, created_at DESC);
