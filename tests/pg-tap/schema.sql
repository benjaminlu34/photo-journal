-- Load the pgTAP extension
BEGIN;
SELECT plan(8);

-- Test if the yjs_snapshots table exists
SELECT has_table('yjs_snapshots', 'Table yjs_snapshots should exist');

-- Test if the columns exist
SELECT has_column('yjs_snapshots', 'id', 'Column id should exist');
SELECT has_column('yjs_snapshots', 'board_id', 'Column board_id should exist');
SELECT has_column('yjs_snapshots', 'version', 'Column version should exist');
SELECT has_column('yjs_snapshots', 'snapshot', 'Column snapshot should exist');

-- Test if the index exists
SELECT has_index('yjs_snapshots', 'board_version_idx', 'Index board_version_idx should exist');

-- Test the column type (should be BYTEA)
SELECT col_type_is('yjs_snapshots', 'snapshot', 'bytea', 'Snapshot column should be bytea type');

-- Verify in information_schema
SELECT ok(
  EXISTS(
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'yjs_snapshots' AND column_name = 'snapshot' AND data_type = 'bytea'
  ),
  'Snapshot column data_type should be bytea in information_schema'
);

-- Finish the tests and clean up
SELECT * FROM finish();
ROLLBACK;