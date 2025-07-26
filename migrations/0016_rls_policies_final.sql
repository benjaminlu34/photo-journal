-- Migration: 0016_rls_policies_final
-- Description: Final RLS policies for Task 8 - optimized for Supabase Auth

-- ============================================
-- FINAL RLS POLICIES FOR SUPABASE AUTH
-- ============================================

-- Create helper function for friendship role resolution (if not exists)
CREATE OR REPLACE FUNCTION get_user_friendship_role(entry_owner_id VARCHAR, requesting_user_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  friendship_role VARCHAR;
BEGIN
  -- Return owner if same user
  IF entry_owner_id = requesting_user_id THEN
    RETURN 'owner';
  END IF;
  
  -- Check for accepted friendship and get the appropriate directional role
  SELECT 
    CASE 
      WHEN f.user_id = entry_owner_id AND f.friend_id = requesting_user_id THEN f.role_user_to_friend
      WHEN f.friend_id = entry_owner_id AND f.user_id = requesting_user_id THEN f.role_friend_to_user
      ELSE NULL
    END
  INTO friendship_role
  FROM friendships f
  WHERE f.status = 'accepted'
    AND ((f.user_id = entry_owner_id AND f.friend_id = requesting_user_id) 
         OR (f.friend_id = entry_owner_id AND f.user_id = requesting_user_id))
  LIMIT 1;
  
  RETURN friendship_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop test policies and recreate with proper auth.uid() for Supabase
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests with canonical ordering" ON friendships;
DROP POLICY IF EXISTS "Prevent direct deletion of friendships" ON friendships;

-- Friendships table policies (optimized for Supabase)
CREATE POLICY "Users can view their own friendships"
ON friendships
FOR SELECT
USING (
  user_id = auth.uid()::VARCHAR OR 
  friend_id = auth.uid()::VARCHAR OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Users can update their own friendships"
ON friendships
FOR UPDATE
USING (
  user_id = auth.uid()::VARCHAR OR 
  friend_id = auth.uid()::VARCHAR OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
)
WITH CHECK (
  user_id = auth.uid()::VARCHAR OR 
  friend_id = auth.uid()::VARCHAR OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Users can create friendship requests with canonical ordering"
ON friendships
FOR INSERT
WITH CHECK (
  -- Must be canonical ordering (user_id < friend_id)
  user_id < friend_id AND
  -- Initiator must be the current user
  initiator_id = auth.uid()::VARCHAR AND
  -- Initiator must be one of the two users in the friendship
  (initiator_id = user_id OR initiator_id = friend_id)
);

CREATE POLICY "Prevent direct deletion of friendships"
ON friendships
FOR DELETE
USING (
  -- Only admins can directly delete friendships
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- Update friendship_changes policies for Supabase
DROP POLICY IF EXISTS "Users can log changes to their friendships" ON friendship_changes;
DROP POLICY IF EXISTS "Users can view changes to their friendships" ON friendship_changes;
DROP POLICY IF EXISTS "Prevent updates to friendship changes" ON friendship_changes;
DROP POLICY IF EXISTS "Prevent deletion of friendship changes" ON friendship_changes;

CREATE POLICY "Users can log changes to their friendships"
ON friendship_changes
FOR INSERT
WITH CHECK (
  actor_id = auth.uid()::VARCHAR AND
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = friendship_id
    AND (f.user_id = auth.uid()::VARCHAR OR f.friend_id = auth.uid()::VARCHAR)
  )
);

CREATE POLICY "Users can view changes to their friendships"
ON friendship_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = friendship_id
    AND (f.user_id = auth.uid()::VARCHAR OR f.friend_id = auth.uid()::VARCHAR)
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Prevent updates to friendship changes"
ON friendship_changes
FOR UPDATE
USING (
  -- Only admins can update audit records
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Prevent deletion of friendship changes"
ON friendship_changes
FOR DELETE
USING (
  -- Only admins can delete audit records
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- Update shared_entries policies for Supabase
DROP POLICY IF EXISTS "Users can view shared entries with friendship role support" ON shared_entries;
DROP POLICY IF EXISTS "Entry owners can share their entries" ON shared_entries;
DROP POLICY IF EXISTS "Entry owners can update their sharing" ON shared_entries;
DROP POLICY IF EXISTS "Entry owners can revoke their sharing" ON shared_entries;

CREATE POLICY "Users can view shared entries with friendship role support"
ON shared_entries
FOR SELECT
USING (
  -- Entry owner can always see their shares
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  
  -- User the entry is shared with can see it
  shared_with_id = auth.uid()::VARCHAR OR
  
  -- Users with accepted friendship can see based on global role
  get_user_friendship_role(
    (SELECT user_id FROM journal_entries WHERE id = entry_id),
    auth.uid()::VARCHAR
  ) IN ('viewer', 'contributor', 'editor') OR
  
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Entry owners can share their entries"
ON shared_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Entry owners can update their sharing"
ON shared_entries
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

CREATE POLICY "Entry owners can revoke their sharing"
ON shared_entries
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);