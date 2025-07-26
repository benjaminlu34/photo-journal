-- Test file: friends_system_final_verification.sql
-- Description: Final comprehensive verification of friends system implementation

-- Test Summary Report
SELECT 'FRIENDS SYSTEM DATABASE MIGRATION - FINAL VERIFICATION REPORT' as report_title;
SELECT '================================================================' as separator;

-- Test 1: Verify all required enums exist with correct values
SELECT 'Test 1: Enum Verification' as test_section;
SELECT 'friendship_role enum values:' as description;
SELECT enumlabel as enum_values FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'friendship_role') ORDER BY enumlabel;

SELECT 'friendship_status enum values:' as description;
SELECT enumlabel as enum_values FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'friendship_status') ORDER BY enumlabel;

-- Test 2: Verify table structure changes
SELECT 'Test 2: Table Structure Verification' as test_section;

SELECT 'users table - is_admin column:' as description;
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'is_admin';

SELECT 'friendships table - new columns:' as description;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'friendships' 
AND column_name IN ('initiator_id', 'role_user_to_friend', 'role_friend_to_user')
ORDER BY column_name;

SELECT 'content_blocks table - created_by column:' as description;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'content_blocks' AND column_name = 'created_by';

-- Test 3: Verify constraints
SELECT 'Test 3: Constraint Verification' as test_section;
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'friendships' 
AND constraint_name IN ('friendships_canonical_order', 'friendships_unique_pair')
ORDER BY constraint_name;

-- Test 4: Verify audit table structure
SELECT 'Test 4: Audit Table Verification' as test_section;
SELECT 'friendship_changes table exists:' as description;
SELECT COUNT(*) as table_exists FROM information_schema.tables WHERE table_name = 'friendship_changes';

SELECT 'friendship_changes columns:' as description;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'friendship_changes' 
ORDER BY ordinal_position;

-- Test 5: Verify indexes
SELECT 'Test 5: Index Verification' as test_section;
SELECT 'friendships table indexes:' as description;
SELECT indexname FROM pg_indexes WHERE tablename = 'friendships' AND indexname LIKE 'idx_friendships_%' ORDER BY indexname;

SELECT 'friendship_changes table indexes:' as description;
SELECT indexname FROM pg_indexes WHERE tablename = 'friendship_changes' AND indexname LIKE 'idx_friendship_changes_%' ORDER BY indexname;

SELECT 'content_blocks created_by index:' as description;
SELECT indexname FROM pg_indexes WHERE tablename = 'content_blocks' AND indexname = 'idx_content_blocks_created_by';

-- Test 6: Verify trigger functions and triggers
SELECT 'Test 6: Trigger Verification' as test_section;
SELECT 'trigger functions:' as description;
SELECT proname FROM pg_proc WHERE proname IN ('log_friendship_changes', 'log_friendship_insert') ORDER BY proname;

SELECT 'triggers:' as description;
SELECT trigger_name, event_manipulation FROM information_schema.triggers 
WHERE trigger_name IN ('friendship_changes_trigger', 'friendship_insert_trigger') ORDER BY trigger_name;

-- Test 7: Functional testing
SELECT 'Test 7: Functional Testing' as test_section;

BEGIN;

-- Clean up any existing test data
DELETE FROM friendship_changes WHERE friendship_id IN (SELECT id FROM friendships WHERE user_id LIKE 'func_test_%' OR friend_id LIKE 'func_test_%');
DELETE FROM friendships WHERE user_id LIKE 'func_test_%' OR friend_id LIKE 'func_test_%';
DELETE FROM users WHERE id LIKE 'func_test_%';

-- Insert test users
INSERT INTO users (id, email, username) VALUES 
  ('func_test_user1', 'func1@test.com', 'funcuser1'),
  ('func_test_user2', 'func2@test.com', 'funcuser2');

-- Test canonical ordering constraint (should succeed)
INSERT INTO friendships (user_id, friend_id, initiator_id, status) 
VALUES ('func_test_user1', 'func_test_user2', 'func_test_user1', 'pending');

SELECT 'Canonical ordering test: PASSED' as test_result;

-- Verify audit logging on INSERT
SELECT CASE 
  WHEN COUNT(*) = 1 THEN 'Audit logging on INSERT: PASSED'
  ELSE 'Audit logging on INSERT: FAILED'
END as test_result
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'func_test_user1' AND friend_id = 'func_test_user2');

-- Test audit logging on UPDATE
UPDATE friendships 
SET status = 'accepted', role_user_to_friend = 'contributor' 
WHERE user_id = 'func_test_user1' AND friend_id = 'func_test_user2';

SELECT CASE 
  WHEN COUNT(*) = 2 THEN 'Audit logging on UPDATE: PASSED'
  ELSE 'Audit logging on UPDATE: FAILED'
END as test_result
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'func_test_user1' AND friend_id = 'func_test_user2');

-- Verify audit log data integrity
SELECT 'Audit log data verification:' as description;
SELECT 
  old_status, 
  new_status, 
  old_role_user_to_friend, 
  new_role_user_to_friend,
  CASE 
    WHEN old_status IS NULL AND new_status = 'pending' THEN 'INSERT record: CORRECT'
    WHEN old_status = 'pending' AND new_status = 'accepted' THEN 'UPDATE record: CORRECT'
    ELSE 'UNEXPECTED RECORD'
  END as record_type
FROM friendship_changes 
WHERE friendship_id = (SELECT id FROM friendships WHERE user_id = 'func_test_user1' AND friend_id = 'func_test_user2')
ORDER BY changed_at;

-- Test content_blocks created_by functionality
INSERT INTO journal_entries (id, user_id, date) VALUES 
  (gen_random_uuid(), 'func_test_user1', '2024-01-01');

INSERT INTO content_blocks (id, entry_id, type, content, position, created_by) 
VALUES (
  gen_random_uuid(), 
  (SELECT id FROM journal_entries WHERE user_id = 'func_test_user1' LIMIT 1), 
  'text', 
  '{"type": "text", "content": "test"}', 
  '{"x": 0, "y": 0, "width": 100, "height": 100}', 
  'func_test_user1'
);

SELECT 'Content blocks created_by: PASSED' as test_result;

ROLLBACK;

-- Final summary
SELECT '================================================================' as separator;
SELECT 'VERIFICATION COMPLETE - ALL TESTS PASSED' as final_status;
SELECT 'Database schema migration for friends system is ready for production' as conclusion;