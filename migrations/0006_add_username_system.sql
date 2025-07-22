-- Migration: 0006_add_username_system
-- Description: Add username system with nullable username column, unique index, format validation, and audit table

-- Step 1: Add nullable username column to users table
ALTER TABLE users ADD COLUMN username varchar(20);

-- Step 2: Create unique index for username (treats NULL != NULL, allowing duplicates during Phase 1)
CREATE UNIQUE INDEX users_username_key ON users (username);

-- Step 3: Add format validation constraint (allows NULL during migration)
ALTER TABLE users ADD CONSTRAINT username_format 
CHECK (username IS NULL OR username ~ '^[a-z0-9_]{3,20}$');

-- Step 4: Add reserved username constraint
ALTER TABLE users ADD CONSTRAINT username_reserved 
CHECK (username IS NULL OR username NOT IN ('admin','api','support','help','root','system','moderator'));

-- Step 5: Create username_changes audit table for tracking changes
CREATE TABLE username_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_username varchar(20) NOT NULL DEFAULT '', -- Store empty string for first change
  new_username varchar(20) NOT NULL,
  changed_at timestamp DEFAULT now()
);

-- Step 6: Create index for username change tracking queries
CREATE INDEX username_changes_user_id_idx ON username_changes (user_id, changed_at DESC);

-- Verification queries (commented out for production)
-- SELECT COUNT(*) as users_with_username FROM users WHERE username IS NOT NULL;
-- SELECT COUNT(*) as users_without_username FROM users WHERE username IS NULL;
-- SELECT * FROM username_changes ORDER BY changed_at DESC LIMIT 5;

-- Down Migration (commented out - uncomment if rollback needed)
-- DROP INDEX IF EXISTS username_changes_user_id_idx;
-- DROP TABLE IF EXISTS username_changes;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS username_reserved;
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS username_format;
-- DROP INDEX IF EXISTS users_username_key;
-- ALTER TABLE users DROP COLUMN IF EXISTS username;