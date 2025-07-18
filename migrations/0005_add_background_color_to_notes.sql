-- Migration: 0005_add_background_color_to_notes
-- Description: Add default backgroundColor to existing sticky_note content blocks

-- Up Migration
-- Update existing sticky_note content blocks to include default backgroundColor
UPDATE content_blocks 
SET content = jsonb_set(
  content, 
  '{backgroundColor}', 
  '"#F4F7FF"'::jsonb
)
WHERE 
  type = 'sticky_note' 
  AND content->>'type' = 'sticky_note'
  AND content->>'backgroundColor' IS NULL;

-- Verify the update
-- This query should return the count of sticky notes that now have backgroundColor
-- SELECT COUNT(*) as updated_notes 
-- FROM content_blocks 
-- WHERE type = 'sticky_note' 
--   AND content->>'backgroundColor' = '--note-bg-default';

-- Down Migration
-- Remove backgroundColor field from sticky_note content blocks
-- UPDATE content_blocks 
-- SET content = content - 'backgroundColor'
-- WHERE 
--   type = 'sticky_note' 
--   AND content->>'type' = 'sticky_note'
--   AND content->>'backgroundColor' = '--note-bg-default';