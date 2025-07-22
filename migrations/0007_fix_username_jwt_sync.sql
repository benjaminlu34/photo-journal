-- Migration: 0009_fix_username_jwt_sync
-- Description: Replace HTTP-based JWT sync with proper Supabase pattern

-- Step 1: Remove the problematic HTTP trigger and function
DROP TRIGGER IF EXISTS sync_username_trigger ON users;
DROP FUNCTION IF EXISTS sync_username_to_auth();
DROP FUNCTION IF EXISTS manual_sync_username_to_jwt(TEXT, TEXT);

-- Step 2: Create a lightweight notification system for username changes
-- This allows async processing without blocking the user update
CREATE OR REPLACE FUNCTION notify_username_changed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if username actually changed
  IF OLD.username IS DISTINCT FROM NEW.username AND NEW.username IS NOT NULL THEN
    -- Send a PostgreSQL notification (non-blocking)
    PERFORM pg_notify('username_changed', json_build_object(
      'user_id', NEW.id,
      'old_username', OLD.username,
      'new_username', NEW.username,
      'timestamp', extract(epoch from now())
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Create the lightweight trigger
CREATE TRIGGER username_notify_trigger
  AFTER UPDATE OF username ON users
  FOR EACH ROW
  EXECUTE FUNCTION notify_username_changed();

-- Step 4: Create a helper function for application-level JWT sync
-- This should be called from the application code, not from triggers
CREATE OR REPLACE FUNCTION get_user_jwt_claims(target_user_id TEXT)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
BEGIN
  -- Get user data for JWT claims
  SELECT id, email, username, created_at
  INTO user_record
  FROM users
  WHERE id = target_user_id;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Return JWT claims structure
  RETURN json_build_object(
    'sub', user_record.id,
    'email', user_record.email,
    'username', user_record.username,
    'iat', extract(epoch from now()),
    'exp', extract(epoch from now() + interval '1 hour')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Add audit logging for username changes (optional)
CREATE TABLE IF NOT EXISTS username_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username varchar(20),
  new_username varchar(20) NOT NULL,
  changed_at timestamp DEFAULT now(),
  changed_by varchar, -- Could be 'user', 'admin', 'migration', etc.
  ip_address inet,
  user_agent text
);

-- Create index for audit queries
CREATE INDEX IF NOT EXISTS username_change_log_user_id_idx 
ON username_change_log (user_id, changed_at DESC);

-- Step 6: Create function to log username changes
CREATE OR REPLACE FUNCTION log_username_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if username actually changed
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    INSERT INTO username_change_log (
      user_id,
      old_username,
      new_username,
      changed_by
    ) VALUES (
      NEW.id,
      OLD.username,
      NEW.username,
      'user' -- Default, can be overridden by application
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create audit trigger
CREATE TRIGGER username_audit_trigger
  AFTER UPDATE OF username ON users
  FOR EACH ROW
  EXECUTE FUNCTION log_username_change();

-- Verification queries (commented out for production)
-- SELECT * FROM username_change_log ORDER BY changed_at DESC LIMIT 5;
-- LISTEN username_changed; -- To test notifications

-- Down Migration (commented out - uncomment if rollback needed)
-- DROP TRIGGER IF EXISTS username_audit_trigger ON users;
-- DROP TRIGGER IF EXISTS username_notify_trigger ON users;
-- DROP FUNCTION IF EXISTS log_username_change();
-- DROP FUNCTION IF EXISTS get_user_jwt_claims(TEXT);
-- DROP FUNCTION IF EXISTS notify_username_changed();
-- DROP TABLE IF EXISTS username_change_log;