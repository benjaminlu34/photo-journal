-- Migration: 0011_fix_auth_uid_triggers
-- Description: Fix trigger functions to handle missing auth.uid() function in local development

-- Step 1: Create a mock auth.uid() function for local development
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS VARCHAR AS $$
BEGIN
  -- Return current user for local development
  -- In production with Supabase, this will be overridden
  RETURN current_user;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Step 3: Recreate the trigger functions with better error handling
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
      COALESCE(auth.uid()::VARCHAR, 'system'),
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

-- Step 4: Recreate the insert trigger function
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
    COALESCE(auth.uid()::VARCHAR, 'system'),
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