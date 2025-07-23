-- Add created_by field to content_blocks for contributor role enforcement
ALTER TABLE content_blocks 
ADD COLUMN IF NOT EXISTS created_by varchar REFERENCES users(id) ON DELETE SET NULL;

-- Create index for efficient querying by created_by
CREATE INDEX IF NOT EXISTS idx_content_blocks_created_by ON content_blocks(created_by);

-- Backfill existing content_blocks with entry owner as created_by
UPDATE content_blocks 
SET created_by = (
  SELECT user_id 
  FROM journal_entries 
  WHERE journal_entries.id = content_blocks.entry_id
)
WHERE created_by IS NULL;