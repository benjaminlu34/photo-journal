-- Start transaction and plan the tests.
BEGIN;
SELECT plan(12);

-- Mock auth.uid() for testing (overrides to read from session variable)
-- This assumes auth schema exists; adjust if needed
DROP FUNCTION IF EXISTS auth.uid();
CREATE OR REPLACE FUNCTION auth.uid() RETURNS text AS $$
  SELECT current_setting('auth.uid')::text;
$$ LANGUAGE sql STABLE;

-- Test RLS is enabled
SELECT ok(has_table_privilege('postgres', 'yjs_snapshots', 'SELECT'), 'Superuser can access table');

SELECT ok(
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.yjs_snapshots'::regclass),
    'RLS should be enabled on yjs_snapshots table'
);

-- Test policies exist
SELECT policies_are('public', 'yjs_snapshots', ARRAY[
    'Users can view their own snapshots',
    'Users can insert their own snapshots',
    'Users can update their own snapshots',
    'Users can delete their own snapshots',
    'Collaborators can view shared snapshots',
    'Collaborators with edit permission can update shared snapshots'
], 'All expected policies should exist on yjs_snapshots table');

-- Create test users
SELECT lives_ok($$
    CREATE ROLE test_user_1 WITH LOGIN PASSWORD 'password';
    CREATE ROLE test_user_2 WITH LOGIN PASSWORD 'password';
$$, 'Create test users');

-- Insert test data
SELECT lives_ok($$
    -- Insert test users
    INSERT INTO users (id, email) VALUES 
        ('test_user_1', 'user1@example.com'),
        ('test_user_2', 'user2@example.com');
    
    -- Insert journal entries
    INSERT INTO journal_entries (id, user_id, date, title)
    VALUES 
        ('11111111-1111-1111-1111-111111111111', 'test_user_1', NOW(), 'User 1 Journal'),
        ('22222222-2222-2222-2222-222222222222', 'test_user_2', NOW(), 'User 2 Journal');
    
    -- Insert shared entry
    INSERT INTO shared_entries (entry_id, shared_with_id, permissions)
    VALUES 
        ('22222222-2222-2222-2222-222222222222', 'test_user_1', 'view');
    
    -- Insert snapshots (use valid UUIDs for board_id)
    INSERT INTO yjs_snapshots (id, board_id, version, snapshot, metadata)
    VALUES 
        ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 1, 'snapshot1'::bytea, 
            '{"userId": "test_user_1", "journalEntryId": "11111111-1111-1111-1111-111111111111"}'::jsonb),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 1, 'snapshot2'::bytea, 
            '{"userId": "test_user_2", "journalEntryId": "22222222-2222-2222-2222-222222222222"}'::jsonb);
$$, 'Insert test data');

-- Test user 1 access
SELECT lives_ok($$
    SET ROLE test_user_1;
    SET SESSION "auth.uid" = 'test_user_1';
    
    -- Should see own snapshot
    SELECT 1/count(*) FROM yjs_snapshots WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    
    -- Should see shared snapshot from user 2
    SELECT 1/count(*) FROM yjs_snapshots WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
$$, 'User 1 can see their own snapshot and shared snapshot');

-- Test user 2 access
SELECT lives_ok($$
    SET ROLE test_user_2;
    SET SESSION "auth.uid" = 'test_user_2';
    
    -- Should see own snapshot
    SELECT 1/count(*) FROM yjs_snapshots WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    
    -- Should NOT see user 1's snapshot (this will error if visible)
    SELECT 1/(1 - count(*)) FROM yjs_snapshots WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
$$, 'User 2 can see their own snapshot but not user 1 snapshot');

-- Test insert policy
SELECT lives_ok($$
    SET ROLE test_user_1;
    SET SESSION "auth.uid" = 'test_user_1';
    
    -- Should be able to insert own snapshot (use valid UUID for board_id)
    INSERT INTO yjs_snapshots (id, board_id, version, snapshot, metadata)
    VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 1, 'snapshot3'::bytea, 
        '{"userId": "test_user_1", "journalEntryId": "11111111-1111-1111-1111-111111111111"}'::jsonb);
$$, 'User 1 can insert their own snapshot');

-- Test update policy
SELECT lives_ok($$
    SET ROLE test_user_1;
    SET SESSION "auth.uid" = 'test_user_1';
    
    -- Should be able to update own snapshot
    UPDATE yjs_snapshots 
    SET version = 2 
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
$$, 'User 1 can update their own snapshot');

-- Test delete policy
SELECT lives_ok($$
    SET ROLE test_user_1;
    SET SESSION "auth.uid" = 'test_user_1';
    
    -- Should be able to delete own snapshot
    DELETE FROM yjs_snapshots 
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
$$, 'User 1 can delete their own snapshot');

-- Test update shared policy
SELECT throws_ok($$
    SET ROLE test_user_1;
    SET SESSION "auth.uid" = 'test_user_1';
    
    -- Should NOT be able to update user 2's snapshot with only view permission
    UPDATE yjs_snapshots 
    SET version = 2 
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
$$, null, 'User 1 cannot update user 2 snapshot with only view permission');

-- Clean up
SELECT lives_ok($$
    SET ROLE postgres;
    DELETE FROM yjs_snapshots WHERE id IN (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    );
    DELETE FROM shared_entries WHERE entry_id = '22222222-2222-2222-2222-222222222222';
    DELETE FROM journal_entries WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222'
    );
    DELETE FROM users WHERE id IN ('test_user_1', 'test_user_2');
    DROP ROLE test_user_1;
    DROP ROLE test_user_2;
$$, 'Clean up test data');

-- Finish the tests and clean up.
SELECT * FROM finish();
ROLLBACK;