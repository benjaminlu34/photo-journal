import {
  users,
  journalEntries,
  contentBlocks,
  friendships,
  sharedEntries,
  usernameChanges,
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
  type UsernameChange,
  type InsertUsernameChange,
} from "@shared/schema/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, ilike, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<UpsertUser>): Promise<User>;
  updateUserWithJWTSync(id: string, updates: Partial<UpsertUser>): Promise<User>;
  
  // Username operations
  checkUsernameAvailability(username: string): Promise<boolean>;
  searchUsersByUsername(query: string, limit?: number): Promise<User[]>;
  trackUsernameChange(change: { userId: string; oldUsername: string; newUsername: string }): Promise<void>;
  getUsernameChangesInPeriod(userId: string, since: Date): Promise<UsernameChange[]>;
  
  // Journal operations
  getJournalEntry(userId: string, date: Date): Promise<JournalEntry | undefined>;
  getJournalEntryById(entryId: string): Promise<JournalEntry | undefined>;
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
  // User operations (mandatory for Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(sql`LOWER(${users.username})`, username.toLowerCase()));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
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

  // New function for Supabase user provisioning
  async upsertUserFromSupabase(supabaseUser: { id: string; email?: string | null; username?: string }): Promise<User> {
    const userData: UpsertUser = {
      id: supabaseUser.id,
      email: supabaseUser.email || undefined,
      username: supabaseUser.username || undefined,
      firstName: undefined,
      lastName: undefined,
    };

    return this.upsertUser(userData);
  }

  async updateUser(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    
    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    return updatedUser;
  }

  // Update user with username sync to JWT claims
  async updateUserWithJWTSync(id: string, updates: Partial<UpsertUser>): Promise<User> {
    const updatedUser = await this.updateUser(id, updates);
    
    // If username was updated, handle JWT sync at application level
    if (updates.username) {
      console.log(`Username updated for user ${id}: ${updates.username}`);
      
      // The database will send a pg_notify event via the username_notify_trigger
      // In a production environment, you would:
      // 1. Call Supabase Admin API to update auth.users metadata
      // 2. Optionally refresh the user's session to get new JWT with username
      // 
      // Sync username to Supabase Auth metadata (non-blocking)
      this.syncUsernameToSupabaseAuth(id, updates.username).catch(error => {
        console.error(`Background sync failed for user ${id}:`, error);
      });
      
      // The client should refresh their session to get the updated JWT
      // The JWT claims will automatically include the new username
    }
    
    return updatedUser;
  }

  // Helper method for Supabase auth sync
  private async syncUsernameToSupabaseAuth(userId: string, username: string): Promise<void> {
    // Import the sync utility dynamically to avoid circular dependencies
    try {
      const { syncUsernameToAuth } = await import('./utils/supabase-sync');
      await syncUsernameToAuth(userId, username);
    } catch (error) {
      console.error(`Failed to sync username to Supabase auth for user ${userId}:`, error);
    }
  }

  // Username operations
  async checkUsernameAvailability(username: string): Promise<boolean> {
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`LOWER(${users.username})`, username.toLowerCase()))
      .limit(1);
    
    return !existingUser;
  }

  async searchUsersByUsername(query: string, limit: number = 10): Promise<User[]> {
    const searchQuery = query.toLowerCase();
    
    // Use prefix matching with case-insensitive search
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        and(
          sql`${users.username} IS NOT NULL`,
          sql`LOWER(${users.username}) LIKE ${searchQuery + '%'}`
        )
      )
      .orderBy(
        // Exact match first, then by prefix length, then by created date
        sql`CASE WHEN LOWER(${users.username}) = ${searchQuery} THEN 0 ELSE 1 END`,
        sql`LENGTH(${users.username})`,
        users.createdAt
      )
      .limit(limit);

    return results;
  }

  async trackUsernameChange(change: { userId: string; oldUsername: string; newUsername: string }): Promise<void> {
    await db
      .insert(usernameChanges)
      .values({
        userId: change.userId,
        oldUsername: change.oldUsername,
        newUsername: change.newUsername,
      });
  }

  async getUsernameChangesInPeriod(userId: string, since: Date): Promise<UsernameChange[]> {
    const results = await db
      .select()
      .from(usernameChanges)
      .where(
        and(
          eq(usernameChanges.userId, userId),
          gte(usernameChanges.changedAt, since)
        )
      )
      .orderBy(desc(usernameChanges.changedAt));

    return results;
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

  async getJournalEntryById(entryId: string): Promise<JournalEntry | undefined> {
    const [entry] = await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.id, entryId));
    return entry;
  }

  async createJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    // Ensure user exists before creating journal entry
    const user = await this.getUser(entry.userId);
    if (!user) {
      // Create user record from Supabase auth
      await this.upsertUserFromSupabase({
        id: entry.userId,
        email: undefined // Will be populated from auth context
      });
    }

    const [newEntry] = await db
      .insert(journalEntries)
      .values({
        ...entry,
        createdAt: new Date(),
        updatedAt: new Date()
      })
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
      .values({
        ...block,
        createdAt: new Date(),
        updatedAt: new Date()
      })
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

// Remove MemoryStorage and always export DatabaseStorage
export const storage = new DatabaseStorage();
