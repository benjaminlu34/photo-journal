-- Test file: friends_system_functionality_test.sql
-- Description: Test functionality of constraints, triggers, and audit logging

-- Test canonical ordering constraint and audit logging
SELECT 'Testing canonical ordering and audit logging' as test_description;

BEGIN;

-- Clean up any existing test data
DELETE FROM friendship_changes WHERE actor_id = 'system';
DELETE FROM friendships WHERE user_id IN ('test_user1', 'test_user2') OR friend_id IN ('test_user1', 'test_user2');
DELETE FROM users WHERE id IN ('test_user1', 'test_user2');

-- Insert test users
INSERT INTO users (id, email, username) VALUES 
  ('test_user1', 'test1@example.com', 'testuser1'),
  ('test_user2', 'test2@example.com', 'testuser2');

-- Test 1: Canonical ordering should work (user_id < friend_id)
INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
VALUES ('test_user1', 'test_user2', 'test_user1', 'pending');

SELECT 'SUCCESS: Canonical ordering allows user_id < friend_id' as test_result;

-- Test 2: Check audit logging on INSERT
SELECT COUNT(*) as audit_entries_after_insert 
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2');

-- Test 3: Update the friendship and check audit logging
UPDATE friendships 
SET status = 'accepted', role_user_to_friend = 'contributor' 
WHERE user_id = 'test_user1' AND friend_id = 'test_user2';

SELECT COUNT(*) as audit_entries_after_update 
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2');

-- Test 4: Verify audit log contains correct data
SELECT 
  old_status, 
  new_status, 
  old_role_user_to_friend, 
  new_role_user_to_friend 
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2')
ORDER BY changed_at;

-- Test 5: Test content_blocks created_by functionality
INSERT INTO journal_entries (id, user_id, date) VALUES 
  (gen_random_uuid(), 'test_user1', '2024-01-01');

INSERT INTO content_blocks (id, entry_id, type, content, position, created_by) 
VALUES (gen_random_uuid(), (SELECT id FROM journal_entries WHERE user_id = 'test_user1' LIMIT 1), 'text', '{"type": "text", "content": "test"}', '{"x": 0, "y": 0, "width": 100, "height": 100}', 'test_user1');

SELECT 'SUCCESS: Content block with created_by inserted' as test_result;

-- Test 6: Verify all indexes exist and are being used
EXPLAIN (FORMAT TEXT) SELECT * FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2' AND status = 'accepted';

ROLLBACK;

SELECT 'All functionality tests completed!' as final_result;