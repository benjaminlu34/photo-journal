-- Enable Row Level Security (including forcing it for owners)
ALTER TABLE public.yjs_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yjs_snapshots FORCE ROW LEVEL SECURITY;

-- Create policies
-- Policy for selecting snapshots (users can only see their own snapshots)
CREATE POLICY "Users can view their own snapshots"
ON public.yjs_snapshots
FOR SELECT
USING (
  (metadata->>'userId')::text = current_setting('auth.uid')::text
);

-- Policy for inserting snapshots
CREATE POLICY "Users can insert their own snapshots"
ON public.yjs_snapshots
FOR INSERT
WITH CHECK (
  (metadata->>'userId')::text = current_setting('auth.uid')::text
);

-- Policy for updating snapshots
CREATE POLICY "Users can update their own snapshots"
ON public.yjs_snapshots
FOR UPDATE
USING (
  (metadata->>'userId')::text = current_setting('auth.uid')::text
);

-- Policy for deleting snapshots
CREATE POLICY "Users can delete their own snapshots"
ON public.yjs_snapshots
FOR DELETE
USING (
  (metadata->>'userId')::text = current_setting('auth.uid')::text
);

-- Add shared access policy for collaborators
CREATE POLICY "Collaborators can view shared snapshots"
ON public.yjs_snapshots
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM shared_entries se
    JOIN journal_entries je ON se.entry_id = je.id
    WHERE
      se.shared_with_id::text = current_setting('auth.uid')::text AND
      je.id::text = (metadata->>'journalEntryId')::text
  )
);

-- Add shared access policy for collaborators with edit permissions
CREATE POLICY "Collaborators with edit permission can update shared snapshots"
ON public.yjs_snapshots
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM shared_entries se
    JOIN journal_entries je ON se.entry_id = je.id
    WHERE
      se.shared_with_id::text = current_setting('auth.uid')::text AND
      se.permissions = 'edit' AND
      je.id::text = (metadata->>'journalEntryId')::text
  )
);

-- Add index for faster RLS policy evaluation
-- (Using btree for equality checks on extracted text values)
CREATE INDEX IF NOT EXISTS idx_yjs_snapshots_metadata_userid 
ON public.yjs_snapshots ( (metadata->>'userId') );

CREATE INDEX IF NOT EXISTS idx_yjs_snapshots_metadata_journalentryid 
ON public.yjs_snapshots ( (metadata->>'journalEntryId') );

-- -- Grant necessary privileges for test roles (adjust as needed)
-- GRANT USAGE ON SCHEMA public TO test_user_1, test_user_2;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.yjs_snapshots TO test_user_1, test_user_2;
-- -- If needed, grant on related tables (e.g., if inserts fail there)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.users, public.journal_entries, public.shared_entries TO test_user_1, test_user_2;