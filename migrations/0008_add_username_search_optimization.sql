-- Migration: 0008_add_username_search_optimization
-- Description: Add trigram index support for efficient username prefix search

-- Step 1: Enable pg_trgm extension for trigram support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Step 2: Create trigram index for username prefix search
-- This significantly improves performance for LIKE 'prefix%' queries
CREATE INDEX users_username_trgm_idx ON users USING gin (username gin_trgm_ops);

-- Step 3: Create additional index for exact username lookups (case-insensitive)
-- This complements the existing unique index for faster case-insensitive searches
CREATE INDEX users_username_lower_idx ON users (LOWER(username));

-- Verification queries (commented out for production)
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE username LIKE 'test%' LIMIT 10;
-- EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM users WHERE LOWER(username) = 'testuser';

-- Down Migration (commented out - uncomment if rollback needed)
-- DROP INDEX IF EXISTS users_username_lower_idx;
-- DROP INDEX IF EXISTS users_username_trgm_idx;
-- DROP EXTENSION IF EXISTS pg_trgm;