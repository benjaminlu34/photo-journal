-- Migration: 0012_fix_audit_actor_constraint
-- Description: Fix audit table actor_id constraint for local development

-- Step 1: Make actor_id nullable in friendship_changes table
ALTER TABLE friendship_changes 
  ALTER COLUMN actor_id DROP NOT NULL;

-- Step 2: Update trigger functions to handle null actor_id
CREATE OR REPLACE FUNCTION log_friendship_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if status or role fields have changed
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
      CASE 
        WHEN auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) 
        THEN auth.uid()::VARCHAR 
        ELSE NULL 
      END,
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

-- Step 3: Update insert trigger function
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
    CASE 
      WHEN auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid()) 
      THEN auth.uid()::VARCHAR 
      ELSE NULL 
    END,
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