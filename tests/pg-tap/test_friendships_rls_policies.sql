-- pg-tap tests for friendships RLS policies
-- Task 8: Test RLS policies with directional roles and canonical ordering

BEGIN;

-- Load pg-tap extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Create test users
INSERT INTO users (id, email, username, is_admin) VALUES
  ('user1', 'user1@example.com', 'user1', false),
  ('user2', 'user2@example.com', 'user2', false),
  ('user3', 'user3@example.com', 'user3', false),
  ('admin1', 'admin@example.com', 'admin1', true);

-- Set up test environment
SELECT plan(15);

-- Test 1: Canonical ordering constraint
SELECT lives_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
    VALUES ('user1', 'user2', 'user1', 'pending')$$,
  'INSERT with sorted UUIDs (user1 < user2) should succeed'
);

-- Test 2: Reverse ordering should fail
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
    VALUES ('user2', 'user1', 'user1', 'pending')$$,
  '23514',
  'new row for relation "friendships" violates check constraint "friendships_canonical_ordering"',
  'INSERT with unsorted UUIDs (user2 > user1) should fail due to canonical ordering'
);

-- Test 3: Duplicate friendship prevention
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
    VALUES ('user1', 'user2', 'user1', 'accepted')$$,
  '23505',
  'duplicate key value violates unique constraint "friendships_unique_relationship"',
  'Duplicate friendship should be prevented'
);

-- Test 4: Invalid initiator should fail
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
    VALUES ('user1', 'user3', 'user2', 'pending')$$,
  'P0001',
  'Initiator must be one of the users in the friendship',
  'Invalid initiator should raise exception'
);

-- Test 5: RLS SELECT policy - users can see their own friendships
SELECT set_config('auth.uid', 'user1', true);
SELECT results_eq(
  $$SELECT COUNT(*) FROM friendships WHERE user_id = 'user1' OR friend_id = 'user1'$$,
  ARRAY[1],
  'User1 should see their own friendships'
);

-- Test 6: RLS SELECT policy - users cannot see others' friendships
SELECT set_config('auth.uid', 'user3', true);
SELECT results_eq(
  $$SELECT COUNT(*) FROM friendships WHERE user_id = 'user1' OR friend_id = 'user1'$$,
  ARRAY[0],
  'User3 should not see User1/User2 friendship'
);

-- Test 7: RLS UPDATE policy - users can update their own friendships
SELECT set_config('auth.uid', 'user1', true);
SELECT lives_ok(
  $$UPDATE friendships SET status = 'accepted' WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  'User1 should be able to update their own friendship'
);

-- Test 8: RLS UPDATE policy - users cannot update others' friendships
SELECT set_config('auth.uid', 'user3', true);
SELECT throws_ok(
  $$UPDATE friendships SET status = 'accepted' WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  '42501',
  'permission denied for table friendships',
  'User3 should not be able to update User1/User2 friendship'
);

-- Test 9: RLS DELETE policy - users cannot directly delete friendships
SELECT set_config('auth.uid', 'user1', true);
SELECT throws_ok(
  $$DELETE FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  '42501',
  'permission denied for table friendships',
  'Users should not be able to directly delete friendships'
);

-- Test 10: Admin bypass - admin can see all friendships
SELECT set_config('auth.uid', 'admin1', true);
SELECT results_eq(
  $$SELECT COUNT(*) FROM friendships$$,
  ARRAY[1],
  'Admin should see all friendships'
);

-- Test 11: Admin bypass - admin can update any friendship
SELECT set_config('auth.uid', 'admin1', true);
SELECT lives_ok(
  $$UPDATE friendships SET status = 'blocked' WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  'Admin should be able to update any friendship'
);

-- Test 12: Friendship changes RLS - users can insert changes for their friendships
SELECT set_config('auth.uid', 'user1', true);
SELECT lives_ok(
  $$INSERT INTO friendship_changes (friendship_id, actor_id, old_status, new_status)
    SELECT id, 'user1', 'pending', 'accepted' FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  'Users should be able to log changes to their own friendships'
);

-- Test 13: Friendship changes RLS - users cannot log changes for others' friendships
SELECT set_config('auth.uid', 'user3', true);
SELECT throws_ok(
  $$INSERT INTO friendship_changes (friendship_id, actor_id, old_status, new_status)
    SELECT id, 'user3', 'pending', 'accepted' FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2'$$,
  '42501',
  'permission denied for table friendship_changes',
  'Users should not log changes to others\' friendships'
);

-- Test 14: Shared entries RLS - users can share their own journal entries
SELECT set_config('auth.uid', 'user1', true);
INSERT INTO journal_entries (id, user_id, date) VALUES ('entry1', 'user1', NOW());
SELECT lives_ok(
  $$INSERT INTO shared_entries (entry_id, shared_with_id, permissions) VALUES ('entry1', 'user2', 'view')$$,
  'Users should be able to share their own journal entries'
);

-- Test 15: Shared entries RLS - users cannot share others' journal entries
SELECT set_config('auth.uid', 'user2', true);
SELECT throws_ok(
  $$INSERT INTO shared_entries (entry_id, shared_with_id, permissions) VALUES ('entry1', 'user3', 'view')$$,
  '42501',
  'permission denied for table shared_entries',
  'Users should not be able to share others\' journal entries'
);

-- Clean up test data
DELETE FROM friendship_changes;
DELETE FROM shared_entries;
DELETE FROM journal_entries;
DELETE FROM friendships;
DELETE FROM users;

SELECT finish();

ROLLBACK;