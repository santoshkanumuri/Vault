-- Link Analytics - Track link opens/clicks
-- Run this in your Supabase SQL Editor

-- Create link_analytics table to track link clicks
CREATE TABLE IF NOT EXISTS link_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid REFERENCES links(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  clicked_at timestamptz DEFAULT now(),
  source text DEFAULT 'direct' -- 'direct', 'search', 'quicklook', etc.
);

-- Enable Row Level Security
ALTER TABLE link_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
DROP POLICY IF EXISTS "Users can manage own link analytics" ON link_analytics;
CREATE POLICY "Users can manage own link analytics"
  ON link_analytics
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_link_analytics_link_id ON link_analytics(link_id);
CREATE INDEX IF NOT EXISTS idx_link_analytics_user_id ON link_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_link_analytics_clicked_at ON link_analytics(clicked_at DESC);

-- Add click_count column to links table for quick access to total clicks
ALTER TABLE links ADD COLUMN IF NOT EXISTS click_count integer DEFAULT 0;

-- Function to increment click count and record analytics
CREATE OR REPLACE FUNCTION track_link_click(
  p_link_id uuid,
  p_user_id uuid,
  p_source text DEFAULT 'direct'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert analytics record
  INSERT INTO link_analytics (link_id, user_id, source)
  VALUES (p_link_id, p_user_id, p_source);
  
  -- Update click count on the link
  UPDATE links 
  SET click_count = click_count + 1
  WHERE id = p_link_id;
END;
$$;

-- Function to get most clicked links
CREATE OR REPLACE FUNCTION get_most_clicked_links(
  p_user_id uuid,
  p_limit int DEFAULT 10,
  p_days int DEFAULT 30 -- Last N days
)
RETURNS TABLE (
  link_id uuid,
  link_name text,
  link_url text,
  total_clicks bigint,
  last_clicked timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id as link_id,
    l.name as link_name,
    l.url as link_url,
    COUNT(la.id) as total_clicks,
    MAX(la.clicked_at) as last_clicked
  FROM links l
  LEFT JOIN link_analytics la ON l.id = la.link_id 
    AND la.clicked_at > NOW() - (p_days || ' days')::interval
  WHERE l.user_id = p_user_id
  GROUP BY l.id, l.name, l.url
  HAVING COUNT(la.id) > 0
  ORDER BY total_clicks DESC, last_clicked DESC
  LIMIT p_limit;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION track_link_click(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_most_clicked_links(uuid, int, int) TO authenticated;

SELECT 'Link analytics setup completed!' as status;
