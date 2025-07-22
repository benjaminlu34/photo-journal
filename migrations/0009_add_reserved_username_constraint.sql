-- Migration: 0009_add_reserved_username_constraint
-- Description: Add reserved username constraint to prevent use of system usernames

-- Step 1: Add reserved username constraint
-- This constraint prevents users from using reserved system usernames
ALTER TABLE users ADD CONSTRAINT username_reserved 
CHECK (username IS NULL OR username NOT IN ('admin','api','support','help','root','system','moderator'));

-- Verification query (commented out for production)
-- SELECT COUNT(*) FROM users WHERE username IN ('admin','api','support','help','root','system','moderator');

-- Down Migration (commented out - uncomment if rollback needed)
-- ALTER TABLE users DROP CONSTRAINT IF EXISTS username_reserved;