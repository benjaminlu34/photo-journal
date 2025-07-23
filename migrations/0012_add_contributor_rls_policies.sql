-- RLS Policies for contributor role enforcement
-- These policies ensure that contributors can only edit/delete their own content blocks

-- Enable RLS on content_blocks table
ALTER TABLE content_blocks ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Allow users to view content blocks they have access to
CREATE POLICY "Users can view content blocks based on journal permissions" ON content_blocks
  FOR SELECT USING (
    -- Owner can view all
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = content_blocks.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
    OR
    -- Shared entry viewers can view
    EXISTS (
      SELECT 1 FROM shared_entries 
      JOIN journal_entries ON journal_entries.id = shared_entries.entry_id
      WHERE shared_entries.entry_id = content_blocks.entry_id
      AND shared_entries.shared_with_id = auth.uid()
    )
    OR
    -- Friends with appropriate role can view
    EXISTS (
      SELECT 1 FROM friendships f
      JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
      WHERE j.id = content_blocks.entry_id
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
      AND f.status = 'accepted'
    )
  );

-- Policy for INSERT: Allow users with create permission
CREATE POLICY "Users can insert content blocks with create permission" ON content_blocks
  FOR INSERT WITH CHECK (
    -- Owner can create
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = content_blocks.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
    OR
    -- Friends with contributor+ role can create
    EXISTS (
      SELECT 1 FROM friendships f
      JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
      WHERE j.id = content_blocks.entry_id
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
      AND f.status = 'accepted'
      AND (
        (j.user_id = auth.uid() AND f.role_user_to_friend IN ('contributor', 'editor'))
        OR (j.friend_id = auth.uid() AND f.role_friend_to_user IN ('contributor', 'editor'))
      )
    )
    OR
    -- Shared entry with edit permission can create
    EXISTS (
      SELECT 1 FROM shared_entries 
      JOIN journal_entries ON journal_entries.id = shared_entries.entry_id
      WHERE shared_entries.entry_id = content_blocks.entry_id
      AND shared_entries.shared_with_id = auth.uid()
      AND shared_entries.permissions = 'edit'
    )
  );

-- Policy for UPDATE: Allow users to edit based on role and ownership
CREATE POLICY "Users can update content blocks based on role and ownership" ON content_blocks
  FOR UPDATE USING (
    -- Owner can edit any
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = content_blocks.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
    OR
    -- Editors can edit any
    EXISTS (
      SELECT 1 FROM friendships f
      JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
      WHERE j.id = content_blocks.entry_id
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
      AND f.status = 'accepted'
      AND (
        (j.user_id = auth.uid() AND f.role_user_to_friend = 'editor')
        OR (j.friend_id = auth.uid() AND f.role_friend_to_user = 'editor')
      )
    )
    OR
    -- Contributors can edit their own
    (content_blocks.created_by = auth.uid() AND
     EXISTS (
       SELECT 1 FROM friendships f
       JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
       WHERE j.id = content_blocks.entry_id
       AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
       AND f.status = 'accepted'
       AND (
         (j.user_id = auth.uid() AND f.role_user_to_friend = 'contributor')
         OR (j.friend_id = auth.uid() AND f.role_friend_to_user = 'contributor')
       )
     )
    )
    OR
    -- Shared entry with edit permission can edit any
    EXISTS (
      SELECT 1 FROM shared_entries 
      JOIN journal_entries ON journal_entries.id = shared_entries.entry_id
      WHERE shared_entries.entry_id = content_blocks.entry_id
      AND shared_entries.shared_with_id = auth.uid()
      AND shared_entries.permissions = 'edit'
    )
  );

-- Policy for DELETE: Allow users to delete based on role and ownership
CREATE POLICY "Users can delete content blocks based on role and ownership" ON content_blocks
  FOR DELETE USING (
    -- Owner can delete any
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = content_blocks.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
    OR
    -- Editors can delete any
    EXISTS (
      SELECT 1 FROM friendships f
      JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
      WHERE j.id = content_blocks.entry_id
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
      AND f.status = 'accepted'
      AND (
        (j.user_id = auth.uid() AND f.role_user_to_friend = 'editor')
        OR (j.friend_id = auth.uid() AND f.role_friend_to_user = 'editor')
      )
    )
    OR
    -- Contributors can delete their own
    (content_blocks.created_by = auth.uid() AND
     EXISTS (
       SELECT 1 FROM friendships f
       JOIN journal_entries j ON j.user_id = f.user_id OR j.user_id = f.friend_id
       WHERE j.id = content_blocks.entry_id
       AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
       AND f.status = 'accepted'
       AND (
         (j.user_id = auth.uid() AND f.role_user_to_friend = 'contributor')
         OR (j.friend_id = auth.uid() AND f.role_friend_to_user = 'contributor')
       )
     )
    )
    OR
    -- Shared entry with edit permission can delete any
    EXISTS (
      SELECT 1 FROM shared_entries 
      JOIN journal_entries ON journal_entries.id = shared_entries.entry_id
      WHERE shared_entries.entry_id = content_blocks.entry_id
      AND shared_entries.shared_with_id = auth.uid()
      AND shared_entries.permissions = 'edit'
    )
  );

-- RLS Policies for shared_entries
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Allow users to view their own shares and shares with them
CREATE POLICY "Users can view shared entries" ON shared_entries
  FOR SELECT USING (
    -- Owner can view all shares of their entries
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = shared_entries.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
    OR
    -- Shared with user
    shared_entries.shared_with_id = auth.uid()
  );

-- Policy for INSERT: Allow owners to share their entries
CREATE POLICY "Owners can share their entries" ON shared_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = shared_entries.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
  );

-- Policy for DELETE: Allow owners to revoke sharing
CREATE POLICY "Owners can revoke sharing" ON shared_entries
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = shared_entries.entry_id 
      AND journal_entries.user_id = auth.uid()
    )
  );

-- RLS Policies for journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Policy for SELECT: Allow owner and authorized friends/shared users
CREATE POLICY "Users can view journal entries based on permissions" ON journal_entries
  FOR SELECT USING (
    -- Owner can view
    user_id = auth.uid()
    OR
    -- Shared entry viewers
    EXISTS (
      SELECT 1 FROM shared_entries 
      WHERE shared_entries.entry_id = journal_entries.id
      AND shared_entries.shared_with_id = auth.uid()
    )
    OR
    -- Friends with appropriate role
    EXISTS (
      SELECT 1 FROM friendships f
      WHERE (f.user_id = journal_entries.user_id OR f.friend_id = journal_entries.user_id)
      AND (f.user_id = auth.uid() OR f.friend_id = auth.uid())
      AND f.status = 'accepted'
    )
  );