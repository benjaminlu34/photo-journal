import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  decimal,
  uuid,
  customType,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
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
// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  date: timestamp("date").notNull(),
  title: varchar("title"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contentBlocks = pgTable("content_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  type: varchar("type", { enum: ["sticky_note", "photo", "text", "checklist", "audio", "drawing"] }).notNull(),
  content: jsonb("content").notNull(),
  position: jsonb("position").notNull(), // { x, y, width, height, rotation }
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  friendId: varchar("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { enum: ["pending", "accepted", "blocked"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sharedEntries = pgTable("shared_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  sharedWithId: varchar("shared_with_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissions: varchar("permissions", { enum: ["view", "edit"] }).notNull().default("view"),
  createdAt: timestamp("created_at").defaultNow(),
});

// YJS Snapshots table for CRDT persistence
export const yjs_snapshots = pgTable(
  "yjs_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    boardId: uuid("board_id").notNull(),
    version: integer("version").notNull(),
    snapshot: bytea("snapshot").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    metadata: jsonb("metadata"),
  },
  (t) => ({
    boardVersionIdx: index("board_version_idx").on(t.boardId, t.version),
    createdAtIdx: index("created_at_idx").on(t.createdAt),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  journalEntries: many(journalEntries),
  friendships: many(friendships, { relationName: "userFriendships" }),
  friendOf: many(friendships, { relationName: "friendOfUser" }),
  sharedEntries: many(sharedEntries),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  user: one(users, {
    fields: [journalEntries.userId],
    references: [users.id],
  }),
  contentBlocks: many(contentBlocks),
  sharedEntries: many(sharedEntries),
}));

export const contentBlocksRelations = relations(contentBlocks, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [contentBlocks.entryId],
    references: [journalEntries.id],
  }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: "userFriendships",
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: "friendOfUser",
  }),
}));

export const sharedEntriesRelations = relations(sharedEntries, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [sharedEntries.entryId],
    references: [journalEntries.id],
  }),
  sharedWith: one(users, {
    fields: [sharedEntries.sharedWithId],
    references: [users.id],
  }),
}));

export const yjs_snapshotsRelations = relations(yjs_snapshots, ({ one }) => ({
  // Can be extended later to relate to boards or other entities
}));

// Schemas
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContentBlockSchema = createInsertSchema(contentBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFriendshipSchema = createInsertSchema(friendships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSharedEntrySchema = createInsertSchema(sharedEntries).omit({
  id: true,
  createdAt: true,
});

// Content type schemas with validation
export const stickyNoteContentSchema = z.object({
  type: z.literal('sticky_note'),
  text: z.string(),
  backgroundColor: z.string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid HEX color format')
    .max(7, 'Color value too long')
    .optional()
    .refine((val) => {
      // Prevent XSS through color value injection
      if (!val) return true;
      return !val.includes('url(') && !val.includes('javascript:') && !val.includes('expression(');
    }, 'Invalid color value detected')
});

export const photoContentSchema = z.object({
  type: z.literal('photo'),
  url: z.string(),
  caption: z.string().optional(),
});

export const textContentSchema = z.object({
  type: z.literal('text'),
  content: z.string(),
});

export const checklistContentSchema = z.object({
  type: z.literal('checklist'),
  items: z.array(z.object({
    id: z.string(),
    text: z.string(),
    completed: z.boolean(),
  })),
});

export const audioContentSchema = z.object({
  type: z.literal('audio'),
  url: z.string(),
  duration: z.number().optional(),
});

export const drawingContentSchema = z.object({
  type: z.literal('drawing'),
  data: z.string(), // Base64 or SVG data
});

// Union schema for all content types
export const contentSchema = z.discriminatedUnion('type', [
  stickyNoteContentSchema,
  photoContentSchema,
  textContentSchema,
  checklistContentSchema,
  audioContentSchema,
  drawingContentSchema,
]);

// Position schema
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.number().optional().default(0),
});

// Enhanced content block schema with validation
export const contentBlockSchema = z.object({
  id: z.string().uuid().optional(),
  entryId: z.string().uuid(),
  type: z.enum(['sticky_note', 'photo', 'text', 'checklist', 'audio', 'drawing']),
  content: contentSchema,
  position: positionSchema,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type InsertContentBlock = z.infer<typeof insertContentBlockSchema>;
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type SharedEntry = typeof sharedEntries.$inferSelect;
export type InsertSharedEntry = z.infer<typeof insertSharedEntrySchema>;
export type YjsSnapshot = typeof yjs_snapshots.$inferSelect;
export type InsertYjsSnapshot = typeof yjs_snapshots.$inferInsert;

// Content type interfaces
export type StickyNoteContent = z.infer<typeof stickyNoteContentSchema>;
export type PhotoContent = z.infer<typeof photoContentSchema>;
export type TextContent = z.infer<typeof textContentSchema>;
export type ChecklistContent = z.infer<typeof checklistContentSchema>;
export type AudioContent = z.infer<typeof audioContentSchema>;
export type DrawingContent = z.infer<typeof drawingContentSchema>;
export type ContentType = z.infer<typeof contentSchema>;
export type Position = z.infer<typeof positionSchema>;
export type ValidatedContentBlock = z.infer<typeof contentBlockSchema>;
