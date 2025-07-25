-- Migration: 0014_fix_rls_policies_conflicts
-- Description: Fix RLS policy conflicts and ensure proper implementation for Task 8

-- ============================================
-- CLEAN UP CONFLICTING POLICIES
-- ============================================

-- Drop ALL existing policies from previous migrations to avoid conflicts
DROP POLICY IF EXISTS "Users can view own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests" ON friendships;
DROP POLICY IF EXISTS "Users can update friendship status" ON friendships;
DROP POLICY IF EXISTS "Users can delete own friendships" ON friendships;
DROP POLICY IF EXISTS "Canonical ordering and initiator validation" ON friendships;
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their own friendships" ON friendships;
DROP POLICY IF EXISTS "Prevent direct deletion of friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests with canonical ordering" ON friendships;
DROP POLICY IF EXISTS "Admin can manage all friendships" ON friendships;

-- Drop old shared_entries policies that conflict
DROP POLICY IF EXISTS "Users can view shared entries" ON shared_entries;
DROP POLICY IF EXISTS "Users can share own journal entries" ON shared_entries;
DROP POLICY IF EXISTS "Users can update sharing permissions" ON shared_entries;
DROP POLICY IF EXISTS "Users can remove sharing" ON shared_entries;

-- ============================================
-- ENSURE PROPER CONSTRAINTS (IDEMPOTENT)
-- ============================================

-- Drop existing constraints if they exist to avoid conflicts
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_canonical_order;
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_unique_pair;
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_canonical_ordering;
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_unique_relationship;

-- Add the correct constraints
ALTER TABLE friendships ADD CONSTRAINT friendships_canonical_order CHECK (user_id < friend_id);
ALTER TABLE friendships ADD CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id);

-- ============================================
-- ENSURE RLS IS ENABLED
-- ============================================

-- Enable RLS on all relevant tables
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendship_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_entries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FRIENDSHIPS TABLE RLS POLICIES (CORRECTED)
-- ============================================

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Canonical ordering and initiator validation" ON friendships;
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;
DROP POLICY IF EXISTS "Users can update their own friendships" ON friendships;
DROP POLICY IF EXISTS "Prevent direct deletion of friendships" ON friendships;
DROP POLICY IF EXISTS "Admin can manage all friendships" ON friendships;
DROP POLICY IF EXISTS "Users can create friendship requests with canonical ordering" ON friendships;

-- 1. INSERT Policy: Enforce canonical ordering and initiator validation
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

-- 2. SELECT Policy: Users can view friendships they're part of
CREATE POLICY "Users can view their own friendships"
ON friendships
FOR SELECT
USING (
  user_id = auth.uid()::VARCHAR OR 
  friend_id = auth.uid()::VARCHAR OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- 3. UPDATE Policy: Users can update friendships they're part of
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

-- 4. DELETE Policy: Prevent direct deletion (use status updates instead)
CREATE POLICY "Prevent direct deletion of friendships"
ON friendships
FOR DELETE
USING (
  -- Only admins can directly delete friendships
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- ============================================
-- FRIENDSHIP_CHANGES TABLE RLS POLICIES (CORRECTED)
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can log changes to their friendships" ON friendship_changes;
DROP POLICY IF EXISTS "Users can view changes to their friendships" ON friendship_changes;
DROP POLICY IF EXISTS "Prevent updates to friendship changes" ON friendship_changes;
DROP POLICY IF EXISTS "Prevent deletion of friendship changes" ON friendship_changes;
DROP POLICY IF EXISTS "Admin can view all friendship changes" ON friendship_changes;

-- 1. INSERT Policy: Users can log changes to their own friendships
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

-- 2. SELECT Policy: Users can view changes to their friendships
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

-- 3. Prevent modifications to audit trail
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

-- ============================================
-- SHARED_ENTRIES TABLE RLS POLICIES (WITH FRIENDSHIP ROLE SUPPORT)
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view shared entries based on friendship role" ON shared_entries;
DROP POLICY IF EXISTS "Users can share their own journal entries" ON shared_entries;
DROP POLICY IF EXISTS "Users can update sharing for their own entries" ON shared_entries;
DROP POLICY IF EXISTS "Users can delete sharing for their own entries" ON shared_entries;
DROP POLICY IF EXISTS "Admin can manage all shared entries" ON shared_entries;

-- Create helper function for friendship role resolution
CREATE OR REPLACE FUNCTION get_user_friendship_role(entry_owner_id VARCHAR, requesting_user_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  friendship_role VARCHAR;
BEGIN
  -- Return null if same user (owner doesn't need friendship role)
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

-- 1. SELECT Policy: Users can view shared entries based on friendship roles
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

-- 2. INSERT Policy: Users can share their own journal entries
CREATE POLICY "Entry owners can share their entries"
ON shared_entries
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM journal_entries je 
    WHERE je.id = NEW.entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- 3. UPDATE Policy: Users can update sharing for their own entries
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
    WHERE je.id = NEW.entry_id AND je.user_id = auth.uid()::VARCHAR
  ) OR
  -- Admin bypass
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::VARCHAR AND is_admin = true)
);

-- 4. DELETE Policy: Users can revoke sharing for their own entries
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

-- ============================================
-- PERFORMANCE INDEXES (IDEMPOTENT)
-- ============================================

-- Indexes for RLS performance optimization
CREATE INDEX IF NOT EXISTS idx_friendships_user_id_status ON friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id_status ON friendships(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_canonical_lookup ON friendships(user_id, friend_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_initiator_lookup ON friendships(initiator_id, status);
CREATE INDEX IF NOT EXISTS idx_friendship_changes_friendship_lookup ON friendship_changes(friendship_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_friendship_changes_actor_lookup ON friendship_changes(actor_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_entries_entry_lookup ON shared_entries(entry_id);
CREATE INDEX IF NOT EXISTS idx_shared_entries_shared_with_lookup ON shared_entries(shared_with_id);
CREATE INDEX IF NOT EXISTS idx_users_admin_flag ON users(id, is_admin) WHERE is_admin = true;

-- ============================================
-- VALIDATION FUNCTIONS
-- ============================================

-- Function to validate friendship operations
CREATE OR REPLACE FUNCTION validate_friendship_operation()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure canonical ordering on INSERT
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id >= NEW.friend_id THEN
      RAISE EXCEPTION 'Friendship must maintain canonical ordering: user_id < friend_id';
    END IF;
    
    -- Ensure initiator is one of the users
    IF NEW.initiator_id != NEW.user_id AND NEW.initiator_id != NEW.friend_id THEN
      RAISE EXCEPTION 'Initiator must be one of the users in the friendship';
    END IF;
  END IF;
  
  -- Prevent modification of immutable fields on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.user_id != NEW.user_id OR OLD.friend_id != NEW.friend_id THEN
      RAISE EXCEPTION 'Cannot modify user_id or friend_id of existing friendship';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for friendship validation
DROP TRIGGER IF EXISTS friendship_validation_trigger ON friendships;
CREATE TRIGGER friendship_validation_trigger
  BEFORE INSERT OR UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION validate_friendship_operation();