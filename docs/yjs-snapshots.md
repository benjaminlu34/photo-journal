# YJS Snapshots Implementation

This document describes the implementation of YJS snapshots in the photo-journal application.

## Schema

The `yjs_snapshots` table is designed to store binary snapshots of YJS documents:

```typescript
export const yjs_snapshots = pgTable(
  "yjs_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id").notNull(),
    version: integer("version").notNull(),
    snapshot: bytea("snapshot").notNull(), // Custom bytea type
    createdAt: timestamp("created_at").defaultNow(),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    boardVersionIdx: index("board_version_idx").on(t.boardId, t.version),
    createdAtIdx: index("created_at_idx").on(t.createdAt),
  }),
);
```

## Custom bytea Type

We've implemented a custom `bytea` type for Drizzle ORM to handle binary data efficiently:

```typescript
const bytea = (name: string) =>
  customType<{ data: Uint8Array; driverData: Buffer }>({
    dataType() {
      return "bytea";               // ← emitted into SQL
    },
    toDriver(value) {               // Drizzle → PG
      return Buffer.isBuffer(value) ? value : Buffer.from(value);
    },
    fromDriver(value) {             // PG → Drizzle
      return new Uint8Array(value); // node-pg gives Buffer
    },
  })(name);
```

This implementation:
- Uses PostgreSQL's native `bytea` type for efficient binary storage
- Handles conversion between JavaScript's `Uint8Array` and Node.js `Buffer`
- Avoids the ~33% overhead of Base64 encoding/decoding

## Utility Functions

The `binary-utils.ts` file provides helper functions for working with binary snapshots:

- `prepareSnapshotForStorage`: Prepares a snapshot for database insertion
- `compressBinary`: Placeholder for future gzip compression
- `decompressBinary`: Placeholder for future gzip decompression

## Future Optimizations

Potential future optimizations include:

1. **Compression**: Add gzip compression for large snapshots (>1MB)
   - Add a `compressed` boolean column
   - Implement compression/decompression in the utility functions

2. **State Vector Storage**: Store state vectors alongside snapshots
   - Add a `stateVector` bytea column
   - Enable delta-based updates for more efficient synchronization

## Migration

The schema is defined in `migrations/0001_initial.sql` with both up and down migrations:

```sql
-- Up Migration
CREATE TABLE IF NOT EXISTS "yjs_snapshots" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "board_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" BYTEA NOT NULL,
  "created_at" TIMESTAMP DEFAULT now(),
  "metadata" JSONB
);

-- Down Migration
DROP TABLE IF EXISTS "yjs_snapshots";
``` 