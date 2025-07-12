-- Migration: 0001_initial
-- Description: Initial schema setup with yjs_snapshots table using bytea type

-- Up Migration
CREATE TABLE IF NOT EXISTS "yjs_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "board_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" BYTEA NOT NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  "metadata" JSONB
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "board_version_idx" ON "yjs_snapshots" ("board_id", "version");
CREATE INDEX IF NOT EXISTS "created_at_idx" ON "yjs_snapshots" ("created_at");

-- Down Migration
DROP TABLE IF EXISTS "yjs_snapshots"; 