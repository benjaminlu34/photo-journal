-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON users
FOR SELECT
USING (id::text = auth.uid()::text);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON users
FOR UPDATE
USING (id::text = auth.uid()::text);

-- Journal Entries policies
-- Users can view their own journal entries
CREATE POLICY "Users can view own journal entries"
ON journal_entries
FOR SELECT
USING (user_id::text = auth.uid()::text);

-- Users can insert their own journal entries
CREATE POLICY "Users can insert own journal entries"
ON journal_entries
FOR INSERT
WITH CHECK (user_id::text = auth.uid()::text);

-- Users can update their own journal entries
CREATE POLICY "Users can update own journal entries"
ON journal_entries
FOR UPDATE
USING (user_id::text = auth.uid()::text);

-- Users can delete their own journal entries
CREATE POLICY "Users can delete own journal entries"
ON journal_entries
FOR DELETE
USING (user_id::text = auth.uid()::text);

-- Content Blocks policies
-- Users can view content blocks from their own journal entries
CREATE POLICY "Users can view own content blocks"
ON content_blocks
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = content_blocks.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Users can insert content blocks to their own journal entries
CREATE POLICY "Users can insert own content blocks"
ON content_blocks
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = content_blocks.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Users can update content blocks in their own journal entries
CREATE POLICY "Users can update own content blocks"
ON content_blocks
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = content_blocks.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Users can delete content blocks from their own journal entries
CREATE POLICY "Users can delete own content blocks"
ON content_blocks
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = content_blocks.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Friendships policies
-- Users can view their own friendships (as either user or friend)
CREATE POLICY "Users can view own friendships"
ON friendships
FOR SELECT
USING (user_id::text = auth.uid()::text OR friend_id::text = auth.uid()::text);

-- Users can create friendship requests
CREATE POLICY "Users can create friendship requests"
ON friendships
FOR INSERT
WITH CHECK (user_id::text = auth.uid()::text);

-- Users can update friendship status (accept/block) only if they are the friend
CREATE POLICY "Users can update friendship status"
ON friendships
FOR UPDATE
USING (friend_id::text = auth.uid()::text);

-- Users can delete friendships they created
CREATE POLICY "Users can delete own friendships"
ON friendships
FOR DELETE
USING (user_id::text = auth.uid()::text);

-- Shared Entries policies
-- Users can view entries shared with them
CREATE POLICY "Users can view shared entries"
ON shared_entries
FOR SELECT
USING (shared_with_id::text = auth.uid()::text);

-- Users can share their own journal entries
CREATE POLICY "Users can share own journal entries"
ON shared_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = shared_entries.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Users can update sharing permissions for entries they own
CREATE POLICY "Users can update sharing permissions"
ON shared_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = shared_entries.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Users can remove sharing for entries they own
CREATE POLICY "Users can remove sharing"
ON shared_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries
    WHERE journal_entries.id = shared_entries.entry_id
    AND journal_entries.user_id::text = auth.uid()::text
  )
);

-- Sessions table policy (special case - allow service role only)
CREATE POLICY "Service role can manage sessions" 
ON sessions 
USING (auth.jwt() ->> 'role' = 'service_role');

-- Create indexes to improve RLS performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_content_blocks_entry_id ON content_blocks(entry_id);
CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_entry_id ON shared_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_shared_with_id ON shared_entries(shared_with_id); 