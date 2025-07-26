-- Migration: 0010_add_friends_system_enhancements
-- Description: Add comprehensive friends system with directional roles, audit table, and constraints

-- Step 1: Create friendship role enum for type safety
CREATE TYPE friendship_role AS ENUM ('viewer', 'contributor', 'editor');

-- Step 2: Add admin flag to users table (preparation for future admin features)
ALTER TABLE users
  ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 3: Create friendship status enum if it doesn't exist, then add new values
DO $$ BEGIN
    CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new enum values
ALTER TYPE friendship_status ADD VALUE IF NOT EXISTS 'declined';
ALTER TYPE friendship_status ADD VALUE IF NOT EXISTS 'unfriended';

-- Step 4: Add new columns to friendships table for directional roles and initiator tracking
ALTER TABLE friendships
  ADD COLUMN initiator_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN role_user_to_friend friendship_role NOT NULL DEFAULT 'viewer',
  ADD COLUMN role_friend_to_user friendship_role NOT NULL DEFAULT 'viewer';

-- Step 5: Add CHECK constraint to enforce canonical row ordering (user_id < friend_id)
ALTER TABLE friendships
  ADD CONSTRAINT friendships_canonical_order CHECK (user_id < friend_id);

-- Step 6: Add UNIQUE constraint to prevent duplicate friendships
ALTER TABLE friendships
  ADD CONSTRAINT friendships_unique_pair UNIQUE (user_id, friend_id);

-- Step 7: Create friendship_changes audit table for tracking role and status changes
CREATE TABLE friendship_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id UUID REFERENCES friendships(id) ON DELETE CASCADE,
  actor_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  old_status VARCHAR,
  new_status VARCHAR,
  old_role_user_to_friend friendship_role,
  new_role_user_to_friend friendship_role,
  old_role_friend_to_user friendship_role,
  new_role_friend_to_user friendship_role,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Step 8: Create indexes for friendship_changes audit table
CREATE INDEX idx_friendship_changes_friendship ON friendship_changes (friendship_id, changed_at DESC);
CREATE INDEX idx_friendship_changes_actor ON friendship_changes (actor_id, changed_at DESC);

-- Step 9: Create trigger function for friendship audit logging
CREATE OR REPLACE FUNCTION log_friendship_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) OR 
     (OLD.role_user_to_friend IS DISTINCT FROM NEW.role_user_to_friend) OR 
     (OLD.role_friend_to_user IS DISTINCT FROM NEW.role_friend_to_user) THEN
    
    INSERT INTO friendship_changes (
      friendship_id,
      actor_id,
      old_status,
      new_status,
      old_role_user_to_friend,
      new_role_user_to_friend,
      old_role_friend_to_user,
      new_role_friend_to_user
    ) VALUES (
      NEW.id,
      auth.uid()::VARCHAR,
      OLD.status,
      NEW.status,
      OLD.role_user_to_friend,
      NEW.role_user_to_friend,
      OLD.role_friend_to_user,
      NEW.role_friend_to_user
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Create trigger function for friendship insert logging
CREATE OR REPLACE FUNCTION log_friendship_insert()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO friendship_changes (
    friendship_id,
    actor_id,
    old_status,
    new_status,
    old_role_user_to_friend,
    new_role_user_to_friend,
    old_role_friend_to_user,
    new_role_friend_to_user
  ) VALUES (
    NEW.id,
    auth.uid()::VARCHAR,
    NULL,
    NEW.status,
    NULL,
    NEW.role_user_to_friend,
    NULL,
    NEW.role_friend_to_user
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 11: Create triggers for audit logging
CREATE TRIGGER friendship_changes_trigger
  AFTER UPDATE ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION log_friendship_changes();

CREATE TRIGGER friendship_insert_trigger
  AFTER INSERT ON friendships
  FOR EACH ROW
  EXECUTE FUNCTION log_friendship_insert();

-- Step 12: Add created_by UUID column to content_blocks for contributor role enforcement
ALTER TABLE content_blocks
  ADD COLUMN created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL;

-- Step 13: Create composite indexes for efficient friendship queries
CREATE INDEX idx_friendships_canonical ON friendships (user_id, friend_id, status);
CREATE INDEX idx_friendships_reverse ON friendships (friend_id, user_id, status);
CREATE INDEX idx_friendships_status_created ON friendships (status, created_at);
CREATE INDEX idx_friendships_initiator ON friendships (initiator_id, created_at);

-- Step 14: Create index for content_blocks created_by column
CREATE INDEX idx_content_blocks_created_by ON content_blocks (created_by);