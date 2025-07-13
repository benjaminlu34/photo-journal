-- Enable Row Level Security
ALTER TABLE yjs_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Policy for selecting snapshots (users can only see their own snapshots)
CREATE POLICY "Users can view their own snapshots" 
ON yjs_snapshots 
FOR SELECT 
USING (
  (metadata->>'userId')::text = auth.uid()
);

-- Policy for inserting snapshots
CREATE POLICY "Users can insert their own snapshots" 
ON yjs_snapshots 
FOR INSERT 
WITH CHECK (
  (metadata->>'userId')::text = auth.uid()
);

-- Policy for updating snapshots
CREATE POLICY "Users can update their own snapshots" 
ON yjs_snapshots 
FOR UPDATE 
USING (
  (metadata->>'userId')::text = auth.uid()
);

-- Policy for deleting snapshots
CREATE POLICY "Users can delete their own snapshots" 
ON yjs_snapshots 
FOR DELETE 
USING (
  (metadata->>'userId')::text = auth.uid()
);

-- Add shared access policy for collaborators
CREATE POLICY "Collaborators can view shared snapshots" 
ON yjs_snapshots 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM shared_entries se
    JOIN journal_entries je ON se.entry_id = je.id
    WHERE 
      se.shared_with_id = auth.uid() AND
      je.id::text = (metadata->>'journalEntryId')::text
  )
);

-- Add shared access policy for collaborators with edit permissions
CREATE POLICY "Collaborators with edit permission can update shared snapshots" 
ON yjs_snapshots 
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM shared_entries se
    JOIN journal_entries je ON se.entry_id = je.id
    WHERE 
      se.shared_with_id = auth.uid() AND
      se.permissions = 'edit' AND
      je.id::text = (metadata->>'journalEntryId')::text
  )
);

-- Add index for faster RLS policy evaluation
CREATE INDEX IF NOT EXISTS idx_yjs_snapshots_metadata_userid ON yjs_snapshots USING gin ((metadata->>'userId'));
CREATE INDEX IF NOT EXISTS idx_yjs_snapshots_metadata_journalentryid ON yjs_snapshots USING gin ((metadata->>'journalEntryId')); 