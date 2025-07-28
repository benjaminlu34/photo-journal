-- Migration: 0017_add_storage_path_to_content_blocks
-- Description: Add storage_path column to content_blocks table for persistent image storage

-- Add storage_path column to content_blocks table
ALTER TABLE content_blocks 
ADD COLUMN storage_path TEXT;

-- Add unique constraint to prevent duplicate storage paths
ALTER TABLE content_blocks 
ADD CONSTRAINT content_blocks_storage_path_unique UNIQUE (storage_path);

-- Add index for efficient storage_path lookups
CREATE INDEX idx_content_blocks_storage_path ON content_blocks(storage_path) WHERE storage_path IS NOT NULL;

-- Add comment to document the column purpose
COMMENT ON COLUMN content_blocks.storage_path IS 'Path to persistent storage for image content (e.g., Supabase Storage path)';