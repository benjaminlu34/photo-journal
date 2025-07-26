-- Test file: friends_system_functionality.sql
-- Description: Test functionality of constraints, triggers, and audit logging for friends system

BEGIN;

-- Load the TAP functions
SELECT plan(15);

-- Setup test data
INSERT INTO users (id, email, username) VALUES 
  ('user1', 'user1@test.com', 'testuser1'),
  ('user2', 'user2@test.com', 'testuser2'),
  ('user3', 'user3@test.com', 'testuser3');

-- Test 1: Canonical ordering constraint - should fail with user_id > friend_id
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) VALUES ('user2', 'user1', 'user2', 'pending')$$,
  '23514',
  'Canonical ordering constraint should prevent user_id > friend_id'
);

-- Test 2: Canonical ordering constraint - should succeed with user_id < friend_id
SELECT lives_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) VALUES ('user1', 'user2', 'user1', 'pending')$$,
  'Canonical ordering should allow user_id < friend_id'
);

-- Test 3: Unique pair constraint - should fail on duplicate
SELECT throws_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status) VALUES ('user1', 'user2', 'user1', 'pending')$$,
  '23505',
  'Unique pair constraint should prevent duplicate friendships'
);

-- Test 4: Verify audit logging on INSERT
SELECT is(
  (SELECT COUNT(*) FROM friendship_changes WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')),
  1::bigint,
  'Audit log should contain entry for friendship insert'
);

-- Test 5: Verify audit log contains correct data for insert
SELECT is(
  (SELECT new_status FROM friendship_changes WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')),
  'pending',
  'Audit log should record correct new_status on insert'
);

-- Test 6: Test audit logging on UPDATE
UPDATE friendships 
SET status = 'accepted', role_user_to_friend = 'contributor' 
WHERE user_id = 'user1' AND friend_id = 'user2';

SELECT is(
  (SELECT COUNT(*) FROM friendship_changes WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')),
  2::bigint,
  'Audit log should contain two entries after update'
);

-- Test 7: Verify audit log records status change
SELECT is(
  (SELECT new_status FROM friendship_changes 
   WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')
   AND old_status = 'pending'),
  'accepted',
  'Audit log should record status change from pending to accepted'
);

-- Test 8: Verify audit log records role change
SELECT is(
  (SELECT new_role_user_to_friend FROM friendship_changes 
   WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')
   AND old_role_user_to_friend = 'viewer'),
  'contributor',
  'Audit log should record role change from viewer to contributor'
);

-- Test 9: Test that no audit entry is created when no relevant fields change
UPDATE friendships 
SET updated_at = now() 
WHERE user_id = 'user1' AND friend_id = 'user2';

SELECT is(
  (SELECT COUNT(*) FROM friendship_changes WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2')),
  2::bigint,
  'Audit log should not create entry when only updated_at changes'
);

-- Test 10: Test content_blocks created_by foreign key constraint
INSERT INTO journal_entries (id, user_id, date) VALUES 
  ('entry1', 'user1', '2024-01-01');

SELECT lives_ok(
  $$INSERT INTO content_blocks (id, entry_id, type, content, position, created_by) 
    VALUES ('block1', 'entry1', 'text', '{"type": "text", "content": "test"}', '{"x": 0, "y": 0, "width": 100, "height": 100}', 'user1')$$,
  'Content block should accept valid created_by user'
);

-- Test 11: Test content_blocks created_by with invalid user
SELECT throws_ok(
  $$INSERT INTO content_blocks (id, entry_id, type, content, position, created_by) 
    VALUES ('block2', 'entry1', 'text', '{"type": "text", "content": "test"}', '{"x": 0, "y": 0, "width": 100, "height": 100}', 'invalid_user')$$,
  '23503',
  'Content block should reject invalid created_by user'
);

-- Test 12: Test friendship role enum constraints
SELECT lives_ok(
  $$INSERT INTO friendships (user_id, friend_id, initiator_id, status, role_user_to_friend) 
    VALUES ('user1', 'user3', 'user1', 'pending', 'editor')$$,
  'Friendship should accept valid role enum value'
);

-- Test 13: Test friendship status enum constraints
SELECT lives_ok(
  $$UPDATE friendships SET status = 'declined' WHERE user_id = 'user1' AND friend_id = 'user3'$$,
  'Friendship should accept declined status'
);

-- Test 14: Test friendship status enum constraints with unfriended
SELECT lives_ok(
  $$UPDATE friendships SET status = 'unfriended' WHERE user_id = 'user1' AND friend_id = 'user3'$$,
  'Friendship should accept unfriended status'
);

-- Test 15: Verify indexes improve query performance (basic existence test)
EXPLAIN (FORMAT JSON) SELECT * FROM friendships WHERE user_id = 'user1' AND friend_id = 'user2' AND status = 'accepted';

SELECT ok(
  (SELECT COUNT(*) FROM pg_stat_user_indexes WHERE indexrelname = 'idx_friendships_canonical') > 0,
  'Canonical index should be tracked in pg_stat_user_indexes'
);

-- Finish the tests
SELECT * FROM finish();

ROLLBACK;