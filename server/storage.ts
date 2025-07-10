import {
  users,
  journalEntries,
  contentBlocks,
  friendships,
  sharedEntries,
  type User,
  type UpsertUser,
  type JournalEntry,
  type InsertJournalEntry,
  type ContentBlock,
  type InsertContentBlock,
  type Friendship,
  type InsertFriendship,
  type SharedEntry,
  type InsertSharedEntry,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, or } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Journal operations
  getJournalEntry(userId: string, date: Date): Promise<JournalEntry | undefined>;
  createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  updateJournalEntry(entryId: string, updates: Partial<InsertJournalEntry>): Promise<JournalEntry>;
  getJournalEntriesInRange(userId: string, startDate: Date, endDate: Date): Promise<JournalEntry[]>;
  
  // Content block operations
  getContentBlocks(entryId: string): Promise<ContentBlock[]>;
  getContentBlock(blockId: string): Promise<ContentBlock | undefined>;
  createContentBlock(block: InsertContentBlock): Promise<ContentBlock>;
  updateContentBlock(blockId: string, updates: Partial<InsertContentBlock>): Promise<ContentBlock>;
  deleteContentBlock(blockId: string): Promise<void>;
  
  // Friend operations
  getFriends(userId: string): Promise<User[]>;
  getFriendshipRequests(userId: string): Promise<(Friendship & { user: User })[]>;
  createFriendship(friendship: InsertFriendship): Promise<Friendship>;
  updateFriendshipStatus(friendshipId: string, status: "accepted" | "blocked"): Promise<Friendship>;
  
  // Sharing operations
  getSharedEntries(userId: string): Promise<(SharedEntry & { entry: JournalEntry & { user: User } })[]>;
  shareEntry(share: InsertSharedEntry): Promise<SharedEntry>;
  removeSharedEntry(entryId: string, sharedWithId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Journal operations
  async getJournalEntry(userId: string, date: Date): Promise<JournalEntry | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          gte(journalEntries.date, startOfDay),
          lte(journalEntries.date, endOfDay)
        )
      );
    return entry;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const [newEntry] = await db
      .insert(journalEntries)
      .values(entry)
      .returning();
    return newEntry;
  }

  async updateJournalEntry(entryId: string, updates: Partial<InsertJournalEntry>): Promise<JournalEntry> {
    const [updatedEntry] = await db
      .update(journalEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(journalEntries.id, entryId))
      .returning();
    return updatedEntry;
  }

  async getJournalEntriesInRange(userId: string, startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    return await db
      .select()
      .from(journalEntries)
      .where(
        and(
          eq(journalEntries.userId, userId),
          gte(journalEntries.date, startDate),
          lte(journalEntries.date, endDate)
        )
      )
      .orderBy(desc(journalEntries.date));
  }

  // Content block operations
  async getContentBlocks(entryId: string): Promise<ContentBlock[]> {
    return await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.entryId, entryId))
      .orderBy(desc(contentBlocks.createdAt));
  }

  async getContentBlock(blockId: string): Promise<ContentBlock | undefined> {
    const [block] = await db
      .select()
      .from(contentBlocks)
      .where(eq(contentBlocks.id, blockId));
    return block;
  }

  async createContentBlock(block: InsertContentBlock): Promise<ContentBlock> {
    const [newBlock] = await db
      .insert(contentBlocks)
      .values(block)
      .returning();
    return newBlock;
  }

  async updateContentBlock(blockId: string, updates: Partial<InsertContentBlock>): Promise<ContentBlock> {
    const [updatedBlock] = await db
      .update(contentBlocks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contentBlocks.id, blockId))
      .returning();
    return updatedBlock;
  }

  async deleteContentBlock(blockId: string): Promise<void> {
    await db.delete(contentBlocks).where(eq(contentBlocks.id, blockId));
  }

  // Friend operations
  async getFriends(userId: string): Promise<User[]> {
    const userFriendships = await db
      .select({
        friend: users,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.status, "accepted")
        )
      );
    
    return userFriendships.map((f: { friend: User }) => f.friend);
  }

  async getFriendshipRequests(userId: string): Promise<(Friendship & { user: User })[]> {
    const requests = await db
      .select({
        friendship: friendships,
        user: users,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.userId))
      .where(
        and(
          eq(friendships.friendId, userId),
          eq(friendships.status, "pending")
        )
      );
    
    return requests.map(r => ({ ...r.friendship, user: r.user }));
  }

  async createFriendship(friendship: InsertFriendship): Promise<Friendship> {
    const [newFriendship] = await db
      .insert(friendships)
      .values(friendship)
      .returning();
    return newFriendship;
  }

  async updateFriendshipStatus(friendshipId: string, status: "accepted" | "blocked"): Promise<Friendship> {
    const [updatedFriendship] = await db
      .update(friendships)
      .set({ status, updatedAt: new Date() })
      .where(eq(friendships.id, friendshipId))
      .returning();
    return updatedFriendship;
  }

  // Sharing operations
  async getSharedEntries(userId: string): Promise<(SharedEntry & { entry: JournalEntry & { user: User } })[]> {
    const shared = await db
      .select({
        sharedEntry: sharedEntries,
        entry: journalEntries,
        user: users,
      })
      .from(sharedEntries)
      .innerJoin(journalEntries, eq(journalEntries.id, sharedEntries.entryId))
      .innerJoin(users, eq(users.id, journalEntries.userId))
      .where(eq(sharedEntries.sharedWithId, userId));
    
    return shared.map(s => ({ 
      ...s.sharedEntry, 
      entry: { ...s.entry, user: s.user } 
    }));
  }

  async shareEntry(share: InsertSharedEntry): Promise<SharedEntry> {
    const [newShare] = await db
      .insert(sharedEntries)
      .values(share)
      .returning();
    return newShare;
  }

  async removeSharedEntry(entryId: string, sharedWithId: string): Promise<void> {
    await db
      .delete(sharedEntries)
      .where(
        and(
          eq(sharedEntries.entryId, entryId),
          eq(sharedEntries.sharedWithId, sharedWithId)
        )
      );
  }
}

export const storage = new DatabaseStorage();
