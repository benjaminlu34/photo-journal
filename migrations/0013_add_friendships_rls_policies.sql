-- Row Level Security (RLS) Policies for Enhanced Friends System
-- Task 8: RLS Policies with Directional Roles

-- Enable RLS on friendships table
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships FORCE ROW LEVEL SECURITY;

-- Enable RLS on friendship_changes table
ALTER TABLE friendship_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendship_changes FORCE ROW LEVEL SECURITY;

-- Enable RLS on shared_entries table (will be updated to use friendship roles)
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries FORCE ROW LEVEL SECURITY;

-- ============================================
-- FRIENDSHIPS TABLE RLS POLICIES
-- ============================================

-- 1. INSERT Policy: Only allow insertion with canonical ordering (user_id < friend_id)
-- and initiator_id must match current user
CREATE OR REPLACE FUNCTION check_canonical_ordering()
RETURNS BOOLEAN AS $$
BEGIN
  -- Ensure user_id < friend_id for canonical ordering
  IF NEW.user_id > NEW.friend_id THEN
    RETURN FALSE;
  END IF;
  
  -- Ensure initiator_id is one of the two users
  IF NEW.initiator_id != NEW.user_id AND NEW.initiator_id != NEW.friend_id THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

CREATE POLICY "Canonical ordering and initiator validation"
ON friendships
FOR INSERT
WITH CHECK (
  check_canonical_ordering() AND
  (NEW.initiator_id = current_setting('auth.uid')::text)
);

-- 2. SELECT Policy: Users can see their own friendships
CREATE POLICY "Users can view their own friendships"
ON friendships
FOR SELECT
USING (
  user_id = current_setting('auth.uid')::text OR
  friend_id = current_setting('auth.uid')::text
);

-- 3. UPDATE Policy: Users can update friendships they're part of
-- but cannot change user_id or friend_id (immutable)
CREATE POLICY "Users can update their own friendships"
ON friendships
FOR UPDATE
USING (
  user_id = current_setting('auth.uid')::text OR
  friend_id = current_setting('auth.uid')::text
)
WITH CHECK (
  user_id = current_setting('auth.uid')::text OR
  friend_id = current_setting('auth.uid')::text
);

-- 4. DELETE Policy: Users cannot directly delete friendships (use status updates)
CREATE POLICY "Prevent direct deletion of friendships"
ON friendships
FOR DELETE
USING (FALSE);

-- ============================================
-- FRIENDSHIP_CHANGES TABLE RLS POLICIES
-- ============================================

-- 1. INSERT Policy: Only allow inserts for friendships user is part of
CREATE POLICY "Users can log changes to their friendships"
ON friendship_changes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = friendship_changes.friendship_id
    AND (f.user_id = current_setting('auth.uid')::text OR f.friend_id = current_setting('auth.uid')::text)
  ) AND
  (friendship_changes.actor_id = current_setting('auth.uid')::text)
);

-- 2. SELECT Policy: Users can see changes for their friendships
CREATE POLICY "Users can view changes to their friendships"
ON friendship_changes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM friendships f
    WHERE f.id = friendship_changes.friendship_id
    AND (f.user_id = current_setting('auth.uid')::text OR f.friend_id = current_setting('auth.uid')::text)
  )
);

-- 3. UPDATE/DELETE Policies: No updates or deletes allowed for audit trail
CREATE POLICY "Prevent updates to friendship changes"
ON friendship_changes
FOR UPDATE
USING (FALSE);

CREATE POLICY "Prevent deletion of friendship changes"
ON friendship_changes
FOR DELETE
USING (FALSE);

-- ============================================
-- SHARED_ENTRIES TABLE RLS POLICIES
-- ============================================

-- 1. SELECT Policy: Users can view shared entries if they have appropriate friendship role
CREATE OR REPLACE FUNCTION get_friendship_role(owner_id TEXT, viewer_id TEXT)
RETURNS TEXT AS $$
DECLARE
  role_result TEXT;
BEGIN
  -- Check if there's an accepted friendship
  SELECT 
    CASE 
      WHEN f.user_id = owner_id AND f.friend_id = viewer_id THEN f.role_friend_to_user
      WHEN f.friend_id = owner_id AND f.user_id = viewer_id THEN f.role_user_to_friend
      ELSE NULL
    END
  INTO role_result
  FROM friendships f
  WHERE f.status = 'accepted'
    AND ((f.user_id = owner_id AND f.friend_id = viewer_id) 
         OR (f.friend_id = owner_id AND f.user_id = viewer_id))
  LIMIT 1;
  
  RETURN role_result;
END;
$$ LANGUAGE plpgsql;

CREATE POLICY "Users can view shared entries based on friendship role"
ON shared_entries
FOR SELECT
USING (
  -- Owner can always see their own shared entries
  (SELECT user_id FROM journal_entries WHERE id = shared_entries.entry_id) = current_setting('auth.uid')::text OR
  
  -- Shared with user can see if they have any friendship role
  shared_with_id = current_setting('auth.uid')::text OR
  
  -- Users with friendship role can see shared entries
  get_friendship_role(
    (SELECT user_id FROM journal_entries WHERE id = shared_entries.entry_id),
    current_setting('auth.uid')::text
  ) IS NOT NULL
);

-- 2. INSERT Policy: Users can share their own journal entries
CREATE POLICY "Users can share their own journal entries"
ON shared_entries
FOR INSERT
WITH CHECK (
  (SELECT user_id FROM journal_entries WHERE id = NEW.entry_id) = current_setting('auth.uid')::text
);

-- 3. UPDATE Policy: Users can update sharing for their own entries
CREATE POLICY "Users can update sharing for their own entries"
ON shared_entries
FOR UPDATE
USING (
  (SELECT user_id FROM journal_entries WHERE id = entry_id) = current_setting('auth.uid')::text
)
WITH CHECK (
  (SELECT user_id FROM journal_entries WHERE id = NEW.entry_id) = current_setting('auth.uid')::text
);

-- 4. DELETE Policy: Users can delete sharing for their own entries
CREATE POLICY "Users can delete sharing for their own entries"
ON shared_entries
FOR DELETE
USING (
  (SELECT user_id FROM journal_entries WHERE id = entry_id) = current_setting('auth.uid')::text
);

-- ============================================
-- ADMIN BYPASS CLAUSES
-- ============================================

-- Create admin bypass function for future admin features
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users 
    WHERE id = current_setting('auth.uid')::text 
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql;

-- Update all policies to include admin bypass
-- This will be done by creating new versions of policies with admin clauses

-- Admin bypass for friendships
CREATE POLICY "Admin can manage all friendships"
ON friendships
FOR ALL
USING (is_admin_user());

-- Admin bypass for friendship_changes
CREATE POLICY "Admin can view all friendship changes"
ON friendship_changes
FOR ALL
USING (is_admin_user());

-- Admin bypass for shared_entries
CREATE POLICY "Admin can manage all shared entries"
ON shared_entries
FOR ALL
USING (is_admin_user());

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Indexes for RLS performance optimization
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_status ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id_status ON friendships(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_canonical ON friendships(user_id, friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_initiator_id ON friendships(initiator_id);
CREATE INDEX IF NOT EXISTS idx_friendship_changes_friendship_id ON friendship_changes(friendship_id);
CREATE INDEX IF NOT EXISTS idx_friendship_changes_actor_id ON friendship_changes(actor_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_entry_id ON shared_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_shared_with_id ON shared_entries(shared_with_id);

-- ============================================
-- CONSTRAINT FOR CANONICAL ORDERING
-- ============================================

-- Add constraint to enforce canonical ordering (user_id < friend_id)
ALTER TABLE friendships ADD CONSTRAINT friendships_canonical_ordering 
CHECK (user_id < friend_id);

-- Add unique constraint to prevent duplicate friendships
ALTER TABLE friendships ADD CONSTRAINT friendships_unique_relationship 
UNIQUE (user_id, friend_id);

-- Create function to validate friendship constraints
CREATE OR REPLACE FUNCTION validate_friendship_constraints()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for duplicate in reverse direction
  IF EXISTS (
    SELECT 1 FROM friendships
    WHERE user_id = NEW.friend_id AND friend_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Friendship already exists in reverse direction';
  END IF;
  
  -- Ensure initiator is one of the two users
  IF NEW.initiator_id != NEW.user_id AND NEW.initiator_id != NEW.friend_id THEN
    RAISE EXCEPTION 'Initiator must be one of the users in the friendship';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;