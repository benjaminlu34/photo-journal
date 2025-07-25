-- Comprehensive pg-tap tests for RLS policies
-- Task 8: Test RLS policies with directional roles and canonical ordering

BEGIN;

-- Load pg-tap extension
CREATE EXTENSION IF NOT EXISTS pgtap;

-- Set up test plan
SELECT plan(25);

-- ============================================
-- TEST DATA SETUP
-- ============================================

-- Create test users
INSERT INTO users (id, email, username, is_admin) VALUES
  ('user_a', 'usera@example.com', 'usera', false),
  ('user_b', 'userb@example.com', 'userb', false),
  ('user_c', 'userc@example.com', 'userc', false),
  ('admin_user', 'admin@example.com', 'adminuser', true);

-- Create test journal entries
INSERT INTO journal_entries (id, user_id, date, title) VALUES
  ('entry_1', 'user_a', '2024-01-01', 'User A Entry'),
  ('entry_2', 'user_b', '2024-01-02', 'User B Entry');

-- ============================================
-- TEST 1-4: CANONICAL ORDERING CONSTRAINTS
-- ============================================

-- Test 1: INSERT with sorted UUIDs should succeed
SELECT lives_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend, role_friend_to_user) 
    VALUES ('user_a', 'user_b', 'user_a', 'pending', 'viewer', 'viewer')$$,
  'Test 1: INSERT with sorted UUIDs (user_a < user_b) should succeed'
);

-- Test 2: INSERT with unsorted UUIDs should fail
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend, role_friend_to_user) 
    VALUES ('user_c', 'user_a', 'user_c', 'pending', 'viewer', 'viewer')$$,
  '23514',
  'Friendship must maintain canonical ordering: user_id < friend_id',
  'Test 2: INSERT with unsorted UUIDs should fail due to canonical ordering'
);

-- Test 3: Duplicate friendship should fail
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend, role_friend_to_user) 
    VALUES ('user_a', 'user_b', 'user_a', 'accepted', 'viewer', 'viewer')$$,
  '23505',
  'duplicate key value violates unique constraint "friendships_unique_pair"',
  'Test 3: Duplicate friendship should be prevented by unique constraint'
);

-- Test 4: Invalid initiator should fail
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend, role_friend_to_user) 
    VALUES ('user_a', 'user_c', 'user_b', 'pending', 'viewer', 'viewer')$$,
  'P0001',
  'Initiator must be one of the users in the friendship',
  'Test 4: Invalid initiator should raise exception'
);

-- ============================================
-- TEST 5-9: FRIENDSHIPS RLS POLICIES
-- ============================================

-- Test 5: Users can see their own friendships
SELECT set_config('auth.uid', 'user_a', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM friendships WHERE user_id = 'user_a' OR friend_id = 'user_a'$$,
  ARRAY[1],
  'Test 5: User A should see their own friendships'
);

-- Test 6: Users cannot see others' friendships
SELECT set_config('auth.uid', 'user_c', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM friendships WHERE user_id = 'user_a' OR friend_id = 'user_a'$$,
  ARRAY[0],
  'Test 6: User C should not see User A/B friendship'
);

-- Test 7: Users can update their own friendships
SELECT set_config('auth.uid', 'user_b', true);
SELECT lives_ok(
  $$UPDATE friendships SET status = 'accepted' WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  'Test 7: User B should be able to update their own friendship'
);

-- Test 8: Users cannot update others' friendships
SELECT set_config('auth.uid', 'user_c', true);
SELECT throws_ok(
  $$UPDATE friendships SET status = 'declined' WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  '42501',
  'new row violates row-level security policy for table "friendships"',
  'Test 8: User C should not be able to update User A/B friendship'
);

-- Test 9: Users cannot directly delete friendships
SELECT set_config('auth.uid', 'user_a', true);
SELECT throws_ok(
  $$DELETE FROM friendships WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  '42501',
  'permission denied for table friendships',
  'Test 9: Users should not be able to directly delete friendships'
);

-- ============================================
-- TEST 10-12: ADMIN BYPASS FUNCTIONALITY
-- ============================================

-- Test 10: Admin can see all friendships
SELECT set_config('auth.uid', 'admin_user', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM friendships$$,
  ARRAY[1],
  'Test 10: Admin should see all friendships'
);

-- Test 11: Admin can update any friendship
SELECT set_config('auth.uid', 'admin_user', true);
SELECT lives_ok(
  $$UPDATE friendships SET role_user_to_friend = 'editor' WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  'Test 11: Admin should be able to update any friendship'
);

-- Test 12: Admin can delete friendships
SELECT set_config('auth.uid', 'admin_user', true);
-- First create a test friendship to delete
INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend, role_friend_to_user) 
VALUES ('user_a', 'user_c', 'user_a', 'pending', 'viewer', 'viewer');
SELECT lives_ok(
  $$DELETE FROM friendships WHERE user_id = 'user_a' AND friend_id = 'user_c'$$,
  'Test 12: Admin should be able to delete friendships'
);

-- ============================================
-- TEST 13-16: FRIENDSHIP_CHANGES RLS POLICIES
-- ============================================

-- Test 13: Users can insert changes for their friendships
SELECT set_config('auth.uid', 'user_a', true);
SELECT lives_ok(
  $$INSERT INTO friendship_changes (friendship_id, actor_id, old_status, new_status, old_role_user_to_friend, new_role_user_to_friend)
    SELECT id, 'user_a', 'pending', 'accepted', 'viewer', 'editor' 
    FROM friendships WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  'Test 13: Users should be able to log changes to their own friendships'
);

-- Test 14: Users cannot insert changes for others' friendships
SELECT set_config('auth.uid', 'user_c', true);
SELECT throws_ok(
  $$INSERT INTO friendship_changes (friendship_id, actor_id, old_status, new_status)
    SELECT id, 'user_c', 'accepted', 'blocked' 
    FROM friendships WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  '42501',
  'new row violates row-level security policy for table "friendship_changes"',
  'Test 14: Users should not log changes to others'' friendships'
);

-- Test 15: Users can view changes to their friendships
SELECT set_config('auth.uid', 'user_a', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM friendship_changes fc 
    JOIN friendships f ON f.id = fc.friendship_id 
    WHERE f.user_id = 'user_a' OR f.friend_id = 'user_a'$$,
  ARRAY[1],
  'Test 15: Users should see changes to their own friendships'
);

-- Test 16: Users cannot modify audit trail
SELECT set_config('auth.uid', 'user_a', true);
SELECT throws_ok(
  $$UPDATE friendship_changes SET old_status = 'blocked' WHERE actor_id = 'user_a'$$,
  '42501',
  'permission denied for table friendship_changes',
  'Test 16: Users should not be able to modify audit trail'
);

-- ============================================
-- TEST 17-21: SHARED_ENTRIES RLS POLICIES
-- ============================================

-- Test 17: Users can share their own journal entries
SELECT set_config('auth.uid', 'user_a', true);
SELECT lives_ok(
  $$INSERT INTO shared_entries (entry_id, shared_with_id, permissions) 
    VALUES ('entry_1', 'user_b', 'view')$$,
  'Test 17: Users should be able to share their own journal entries'
);

-- Test 18: Users cannot share others' journal entries
SELECT set_config('auth.uid', 'user_b', true);
SELECT throws_ok(
  $$INSERT INTO shared_entries (entry_id, shared_with_id, permissions) 
    VALUES ('entry_1', 'user_c', 'view')$$,
  '42501',
  'new row violates row-level security policy for table "shared_entries"',
  'Test 18: Users should not be able to share others'' journal entries'
);

-- Test 19: Users can view shared entries based on friendship role
SELECT set_config('auth.uid', 'user_b', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM shared_entries WHERE entry_id = 'entry_1'$$,
  ARRAY[1],
  'Test 19: User B should see entries shared with them or via friendship'
);

-- Test 20: Users without friendship cannot see shared entries
SELECT set_config('auth.uid', 'user_c', true);
SELECT results_eq(
  $$SELECT COUNT(*)::int FROM shared_entries WHERE entry_id = 'entry_1'$$,
  ARRAY[0],
  'Test 20: User C should not see entries not shared with them'
);

-- Test 21: Entry owners can revoke sharing
SELECT set_config('auth.uid', 'user_a', true);
SELECT lives_ok(
  $$DELETE FROM shared_entries WHERE entry_id = 'entry_1' AND shared_with_id = 'user_b'$$,
  'Test 21: Entry owners should be able to revoke sharing'
);

-- ============================================
-- TEST 22-25: DIRECTIONAL ROLES FUNCTIONALITY
-- ============================================

-- Test 22: Directional role function works correctly
SELECT results_eq(
  $$SELECT get_user_friendship_role('user_a', 'user_b')$$,
  ARRAY['editor'::VARCHAR],
  'Test 22: Friendship role function should return correct directional role'
);

-- Test 23: Role function returns owner for same user
SELECT results_eq(
  $$SELECT get_user_friendship_role('user_a', 'user_a')$$,
  ARRAY['owner'::VARCHAR],
  'Test 23: Role function should return owner for same user'
);

-- Test 24: Role function returns null for non-friends
SELECT results_eq(
  $$SELECT get_user_friendship_role('user_a', 'user_c')$$,
  ARRAY[NULL::VARCHAR],
  'Test 24: Role function should return null for non-friends'
);

-- Test 25: Friendship validation trigger works
SELECT throws_ok(
  $$UPDATE friendships SET user_id = 'user_c' WHERE user_id = 'user_a' AND friend_id = 'user_b'$$,
  'P0001',
  'Cannot modify user_id or friend_id of existing friendship',
  'Test 25: Should prevent modification of immutable friendship fields'
);

-- ============================================
-- CLEANUP
-- ============================================

-- Clean up test data
DELETE FROM friendship_changes;
DELETE FROM shared_entries;
DELETE FROM friendships;
DELETE FROM journal_entries;
DELETE FROM users WHERE id IN ('user_a', 'user_b', 'user_c', 'admin_user');

-- Finish tests
SELECT finish();

ROLLBACK;