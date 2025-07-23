-- Test file: friends_system_constraints.sql
-- Description: Test database constraints, indexes, audit table, and triggers for friends system

BEGIN;

-- Load the TAP functions
SELECT plan(20);

-- Test 1: Verify friendship_role enum exists and has correct values
SELECT has_type('friendship_role', 'friendship_role enum should exist');
SELECT enum_has_labels('friendship_role', ARRAY['viewer', 'contributor', 'editor'], 'friendship_role should have correct values');

-- Test 2: Verify friendship_status enum has all required values
SELECT enum_has_labels('friendship_status', ARRAY['pending', 'accepted', 'blocked', 'declined', 'unfriended'], 'friendship_status should have all required values');

-- Test 3: Verify users table has is_admin column
SELECT has_column('users', 'is_admin', 'users table should have is_admin column');
SELECT col_type_is('users', 'is_admin', 'boolean', 'is_admin should be boolean type');
SELECT col_has_default('users', 'is_admin', 'is_admin should have default value');

-- Test 4: Verify friendships table has new columns
SELECT has_column('friendships', 'initiator_id', 'friendships table should have initiator_id column');
SELECT has_column('friendships', 'role_user_to_friend', 'friendships table should have role_user_to_friend column');
SELECT has_column('friendships', 'role_friend_to_user', 'friendships table should have role_friend_to_user column');

-- Test 5: Verify friendships table constraints
SELECT has_check('friendships', 'friendships_canonical_order', 'friendships should have canonical order constraint');
SELECT has_unique('friendships', ARRAY['user_id', 'friend_id'], 'friendships should have unique pair constraint');

-- Test 6: Verify content_blocks table has created_by column
SELECT has_column('content_blocks', 'created_by', 'content_blocks table should have created_by column');
SELECT col_is_fk('content_blocks', 'created_by', 'created_by should be foreign key to users');

-- Test 7: Verify friendship_changes audit table exists
SELECT has_table('friendship_changes', 'friendship_changes audit table should exist');
SELECT has_column('friendship_changes', 'friendship_id', 'friendship_changes should have friendship_id column');
SELECT has_column('friendship_changes', 'actor_id', 'friendship_changes should have actor_id column');
SELECT has_column('friendship_changes', 'old_status', 'friendship_changes should have old_status column');
SELECT has_column('friendship_changes', 'new_status', 'friendship_changes should have new_status column');

-- Test 8: Verify indexes exist
SELECT has_index('friendships', 'idx_friendships_canonical', 'canonical index should exist');
SELECT has_index('friendships', 'idx_friendships_reverse', 'reverse index should exist');
SELECT has_index('friendships', 'idx_friendships_status_created', 'status_created index should exist');
SELECT has_index('friendships', 'idx_friendships_initiator', 'initiator index should exist');
SELECT has_index('content_blocks', 'idx_content_blocks_created_by', 'created_by index should exist');

-- Test 9: Verify audit table indexes
SELECT has_index('friendship_changes', 'idx_friendship_changes_friendship', 'friendship_changes friendship index should exist');
SELECT has_index('friendship_changes', 'idx_friendship_changes_actor', 'friendship_changes actor index should exist');

-- Test 10: Verify trigger functions exist
SELECT has_function('log_friendship_changes', 'log_friendship_changes function should exist');
SELECT has_function('log_friendship_insert', 'log_friendship_insert function should exist');

-- Finish the tests
SELECT * FROM finish();

ROLLBACK;