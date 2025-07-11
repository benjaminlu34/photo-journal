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

// In-memory storage implementation to bypass database connectivity issues
export class MemoryStorage implements IStorage {
  private users = new Map<string, User>();
  private journalEntries = new Map<string, JournalEntry>();
  private contentBlocks = new Map<string, ContentBlock>();
  private friendships = new Map<string, Friendship>();
  private sharedEntries = new Map<string, SharedEntry>();

  // User operations (mandatory for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const now = new Date();
    const user: User = {
      ...userData,
      createdAt: this.users.get(userData.id)?.createdAt || now,
      updatedAt: now,
    };
    this.users.set(userData.id, user);
    return user;
  }

  // Journal operations
  async getJournalEntry(userId: string, date: Date): Promise<JournalEntry | undefined> {
    const dateStr = date.toISOString().split('T')[0];
    for (const entry of this.journalEntries.values()) {
      if (entry.userId === userId && entry.date.toISOString().split('T')[0] === dateStr) {
        return entry;
      }
    }
    return undefined;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const now = new Date();
    const id = `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newEntry: JournalEntry = {
      id,
      ...entry,
      createdAt: now,
      updatedAt: now,
    };
    this.journalEntries.set(id, newEntry);
    return newEntry;
  }

  async updateJournalEntry(entryId: string, updates: Partial<InsertJournalEntry>): Promise<JournalEntry> {
    const entry = this.journalEntries.get(entryId);
    if (!entry) throw new Error('Journal entry not found');
    
    const updatedEntry: JournalEntry = {
      ...entry,
      ...updates,
      updatedAt: new Date(),
    };
    this.journalEntries.set(entryId, updatedEntry);
    return updatedEntry;
  }

  async getJournalEntriesInRange(userId: string, startDate: Date, endDate: Date): Promise<JournalEntry[]> {
    const entries: JournalEntry[] = [];
    for (const entry of this.journalEntries.values()) {
      if (entry.userId === userId && entry.date >= startDate && entry.date <= endDate) {
        entries.push(entry);
      }
    }
    return entries.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  // Content block operations
  async getContentBlocks(entryId: string): Promise<ContentBlock[]> {
    const blocks: ContentBlock[] = [];
    for (const block of this.contentBlocks.values()) {
      if (block.journalEntryId === entryId) {
        blocks.push(block);
      }
    }
    return blocks;
  }

  async getContentBlock(blockId: string): Promise<ContentBlock | undefined> {
    return this.contentBlocks.get(blockId);
  }

  async createContentBlock(block: InsertContentBlock): Promise<ContentBlock> {
    const now = new Date();
    const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newBlock: ContentBlock = {
      id,
      ...block,
      createdAt: now,
      updatedAt: now,
    };
    this.contentBlocks.set(id, newBlock);
    return newBlock;
  }

  async updateContentBlock(blockId: string, updates: Partial<InsertContentBlock>): Promise<ContentBlock> {
    const block = this.contentBlocks.get(blockId);
    if (!block) throw new Error('Content block not found');
    
    const updatedBlock: ContentBlock = {
      ...block,
      ...updates,
      updatedAt: new Date(),
    };
    this.contentBlocks.set(blockId, updatedBlock);
    return updatedBlock;
  }

  async deleteContentBlock(blockId: string): Promise<void> {
    this.contentBlocks.delete(blockId);
  }

  // Friend operations
  async getFriends(userId: string): Promise<User[]> {
    const friends: User[] = [];
    for (const friendship of this.friendships.values()) {
      if (friendship.status === 'accepted') {
        if (friendship.userId === userId) {
          const friend = this.users.get(friendship.friendId);
          if (friend) friends.push(friend);
        } else if (friendship.friendId === userId) {
          const friend = this.users.get(friendship.userId);
          if (friend) friends.push(friend);
        }
      }
    }
    return friends;
  }

  async getFriendshipRequests(userId: string): Promise<(Friendship & { user: User })[]> {
    const requests: (Friendship & { user: User })[] = [];
    for (const friendship of this.friendships.values()) {
      if (friendship.friendId === userId && friendship.status === 'pending') {
        const user = this.users.get(friendship.userId);
        if (user) {
          requests.push({ ...friendship, user });
        }
      }
    }
    return requests;
  }

  async createFriendship(friendship: InsertFriendship): Promise<Friendship> {
    const now = new Date();
    const id = `friendship-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newFriendship: Friendship = {
      id,
      ...friendship,
      createdAt: now,
      updatedAt: now,
    };
    this.friendships.set(id, newFriendship);
    return newFriendship;
  }

  async updateFriendshipStatus(friendshipId: string, status: "accepted" | "blocked"): Promise<Friendship> {
    const friendship = this.friendships.get(friendshipId);
    if (!friendship) throw new Error('Friendship not found');
    
    const updatedFriendship: Friendship = {
      ...friendship,
      status,
      updatedAt: new Date(),
    };
    this.friendships.set(friendshipId, updatedFriendship);
    return updatedFriendship;
  }

  // Sharing operations
  async getSharedEntries(userId: string): Promise<(SharedEntry & { entry: JournalEntry & { user: User } })[]> {
    const sharedEntries: (SharedEntry & { entry: JournalEntry & { user: User } })[] = [];
    for (const share of this.sharedEntries.values()) {
      if (share.sharedWithId === userId) {
        const entry = this.journalEntries.get(share.journalEntryId);
        const user = entry ? this.users.get(entry.userId) : undefined;
        if (entry && user) {
          sharedEntries.push({ ...share, entry: { ...entry, user } });
        }
      }
    }
    return sharedEntries;
  }

  async shareEntry(share: InsertSharedEntry): Promise<SharedEntry> {
    const now = new Date();
    const id = `share-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newShare: SharedEntry = {
      id,
      ...share,
      createdAt: now,
      updatedAt: now,
    };
    this.sharedEntries.set(id, newShare);
    return newShare;
  }

  async removeSharedEntry(entryId: string, sharedWithId: string): Promise<void> {
    for (const [id, share] of this.sharedEntries.entries()) {
      if (share.journalEntryId === entryId && share.sharedWithId === sharedWithId) {
        this.sharedEntries.delete(id);
        break;
      }
    }
  }
}

// Use in-memory storage to bypass database connectivity issues
export const storage = process.env.NODE_ENV === 'development' 
  ? new MemoryStorage() 
  : new DatabaseStorage();
