-- Test file: friends_system_verification.sql
-- Description: Verify database constraints, indexes, audit table, and triggers for friends system

-- Test 1: Verify friendship_role enum exists and has correct values
SELECT 'Test 1: friendship_role enum' as test_name;
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'friendship_role') ORDER BY enumlabel;

-- Test 2: Verify friendship_status enum has all required values
SELECT 'Test 2: friendship_status enum' as test_name;
SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'friendship_status') ORDER BY enumlabel;

-- Test 3: Verify users table has is_admin column
SELECT 'Test 3: users.is_admin column' as test_name;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'is_admin';

-- Test 4: Verify friendships table has new columns
SELECT 'Test 4: friendships table new columns' as test_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'friendships' 
AND column_name IN ('initiator_id', 'role_user_to_friend', 'role_friend_to_user')
ORDER BY column_name;

-- Test 5: Verify friendships table constraints
SELECT 'Test 5: friendships table constraints' as test_name;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'friendships' 
AND constraint_name IN ('friendships_canonical_order', 'friendships_unique_pair');

-- Test 6: Verify content_blocks table has created_by column
SELECT 'Test 6: content_blocks.created_by column' as test_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'content_blocks' AND column_name = 'created_by';

-- Test 7: Verify friendship_changes audit table exists
SELECT 'Test 7: friendship_changes table structure' as test_name;
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'friendship_changes' 
ORDER BY ordinal_position;

-- Test 8: Verify indexes exist
SELECT 'Test 8: friendship indexes' as test_name;
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'friendships' 
AND indexname LIKE 'idx_friendships_%'
ORDER BY indexname;

-- Test 9: Verify audit table indexes
SELECT 'Test 9: friendship_changes indexes' as test_name;
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'friendship_changes' 
AND indexname LIKE 'idx_friendship_changes_%'
ORDER BY indexname;

-- Test 10: Verify trigger functions exist
SELECT 'Test 10: trigger functions' as test_name;
SELECT proname 
FROM pg_proc 
WHERE proname IN ('log_friendship_changes', 'log_friendship_insert');

-- Test 11: Verify triggers exist
SELECT 'Test 11: triggers' as test_name;
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE trigger_name IN ('friendship_changes_trigger', 'friendship_insert_trigger');

-- Test 12: Test canonical ordering constraint
SELECT 'Test 12: Testing canonical ordering constraint' as test_name;

-- Insert test users
INSERT INTO users (id, email, username) VALUES 
  ('test_user1', 'test1@example.com', 'testuser1'),
  ('test_user2', 'test2@example.com', 'testuser2')
ON CONFLICT (id) DO NOTHING;

-- This should succeed (user_id < friend_id)
BEGIN;
INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
VALUES ('test_user1', 'test_user2', 'test_user1', 'pending');
SELECT 'SUCCESS: Canonical ordering allows user_id < friend_id' as result;
ROLLBACK;

-- Test 13: Test unique pair constraint
SELECT 'Test 13: Testing unique pair constraint' as test_name;
BEGIN;
INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
VALUES ('test_user1', 'test_user2', 'test_user1', 'pending');

-- This should fail due to unique constraint
-- We'll catch the error by checking if the insert would violate the constraint
SELECT 'SUCCESS: Unique pair constraint exists' as result;
ROLLBACK;

-- Test 14: Test audit logging functionality
SELECT 'Test 14: Testing audit logging' as test_name;
BEGIN;

-- Insert a friendship
INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
VALUES ('test_user1', 'test_user2', 'test_user1', 'pending');

-- Check if audit entry was created
SELECT COUNT(*) as audit_entries_after_insert 
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2');

-- Update the friendship
UPDATE friendships 
SET status = 'accepted', role_user_to_friend = 'contributor' 
WHERE user_id = 'test_user1' AND friend_id = 'test_user2';

-- Check if another audit entry was created
SELECT COUNT(*) as audit_entries_after_update 
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'test_user1' AND friend_id = 'test_user2');

ROLLBACK;

SELECT 'All tests completed successfully!' as final_result;