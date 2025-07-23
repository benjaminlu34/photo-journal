import {
  users,
  journalEntries,
  contentBlocks,
  friendships,
  sharedEntries,
  usernameChanges,
  friendshipChanges,
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
  type FriendshipChange,
  type InsertFriendshipChange,
} from "@shared/schema/schema";
import { db } from "./db";
import { eq, and, desc, gte, lte, ilike, sql, or } from "drizzle-orm";
import { 
  buildCanonicalFriendshipIds, 
  canSendFriendRequest, 
  isValidStatusTransition 
} from "./utils/friendship";

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
  
  // Enhanced Friend operations
  getFriends(userId: string): Promise<User[]>;
  getFriendshipRequests(userId: string): Promise<(Friendship & { user: User })[]>;
  createFriendship(friendship: InsertFriendship): Promise<Friendship>;
  updateFriendshipStatus(friendshipId: string, status: "accepted" | "blocked"): Promise<Friendship>;
  
  // Enhanced friendship methods supporting all five statuses
  getFriendship(userA: string, userB: string): Promise<Friendship | undefined>;
  getFriendshipById(friendshipId: string): Promise<Friendship | undefined>;
  createFriendshipWithCanonicalOrdering(userA: string, userB: string, initiatorId: string): Promise<Friendship>;
  updateFriendshipStatusWithAudit(friendshipId: string, newStatus: string, actorId: string): Promise<Friendship>;
  updateFriendshipRole(friendshipId: string, actorId: string, newRole: string): Promise<Friendship>;
  getFriendshipsWithStatus(userId: string, status: string): Promise<(Friendship & { friend: User })[]>;
  canSendFriendRequestTo(fromUserId: string, toUserId: string): Promise<boolean>;
  
  // Enhanced friend list operations with pagination and roles
  getFriendsWithRoles(userId: string, options?: { limit?: number; offset?: number }): Promise<{
    friends: (User & {
      friendshipId: string;
      roleUserToFriend: string;
      roleFriendToUser: string;
      status: string;
      createdAt: Date;
    })[];
    totalCount: number;
  }>;
  getFriendRequests(userId: string, options?: { limit?: number; offset?: number }): Promise<{
    sent: (Friendship & { friend: User })[];
    received: (Friendship & { user: User })[];
    totalCount: number;
  }>;
  
  // Friendship audit operations
  logFriendshipChange(change: InsertFriendshipChange): Promise<FriendshipChange>;
  getFriendshipHistory(friendshipId: string): Promise<FriendshipChange[]>;
  
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
        isAdmin: users.isAdmin,
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

    return results.map(user => ({
      ...user,
      isAdmin: user.isAdmin ?? false,
    }));
  }

  async searchUsersByUsernameWithFriendshipStatus(
    currentUserId: string,
    query: string,
    options?: { limit?: number; friendsOnly?: boolean }
  ): Promise<(User & { friendshipStatus?: string; friendshipId?: string })[]> {
    const searchQuery = query.toLowerCase();
    const limit = options?.limit || 10;
    const friendsOnly = options?.friendsOnly || false;

    // Main query with friendship status
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        friendshipStatus: sql<string | null>`friendships.status`,
        friendshipId: sql<string | null>`friendships.id`
      })
      .from(users)
      .leftJoin(
        friendships,
        or(
          and(
            eq(friendships.userId, users.id),
            eq(friendships.friendId, currentUserId)
          ),
          and(
            eq(friendships.friendId, users.id),
            eq(friendships.userId, currentUserId)
          )
        )
      )
      .where(
        and(
          sql`${users.username} IS NOT NULL`,
          sql`LOWER(${users.username}) LIKE ${searchQuery + '%'}`,
          sql`${users.id} != ${currentUserId}`, // Exclude current user
          // Block enforcement: exclude users where current user is blocked or has blocked them
          or(
            sql`friendships.status IS NULL`,
            and(
              sql`friendships.status != 'blocked'`,
              sql`friendships.status != 'unfriended'`
            )
          ),
          // If friendsOnly, only include accepted friendships
          friendsOnly ? sql`friendships.status = 'accepted'` : sql`TRUE`
        )
      )
      .orderBy(
        // Exact match first, then by prefix length, then by created date
        sql`CASE WHEN LOWER(${users.username}) = ${searchQuery} THEN 0 ELSE 1 END`,
        sql`LENGTH(${users.username})`,
        users.createdAt
      )
      .limit(limit);

    return results.map(user => ({
      ...user,
      friendshipStatus: user.friendshipStatus || undefined,
      friendshipId: user.friendshipId || undefined
    }));
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

  async createContentBlock(block: InsertContentBlock & { createdBy?: string | null }): Promise<ContentBlock> {
    const [newBlock] = await db
      .insert(contentBlocks)
      .values({
        entryId: block.entryId,
        type: block.type,
        content: block.content,
        position: block.position,
        createdBy: block.createdBy || null,
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

  // Journal sharing operations
  async getSharedEntry(entryId: string, sharedWithId: string): Promise<SharedEntry | undefined> {
    const [sharedEntry] = await db
      .select()
      .from(sharedEntries)
      .where(
        and(
          eq(sharedEntries.entryId, entryId),
          eq(sharedEntries.sharedWithId, sharedWithId)
        )
      );
    return sharedEntry;
  }

  async getSharedEntriesForEntry(entryId: string): Promise<(SharedEntry & { user: User })[]> {
    const shared = await db
      .select({
        sharedEntry: sharedEntries,
        user: users
      })
      .from(sharedEntries)
      .innerJoin(users, eq(users.id, sharedEntries.sharedWithId))
      .where(eq(sharedEntries.entryId, entryId));
    
    return shared.map(s => ({
      ...s.sharedEntry,
      user: s.user
    }));
  }

  async shareEntryWithFriend(entryId: string, ownerId: string, friendUsername: string, permissions: 'view' | 'edit'): Promise<SharedEntry> {
    // Find friend by username
    const friend = await this.getUserByUsername(friendUsername);
    if (!friend) {
      throw new Error('Friend not found');
    }

    // Verify friendship exists and is accepted
    const friendship = await this.getFriendship(ownerId, friend.id);
    if (!friendship || friendship.status !== 'accepted') {
      throw new Error('Friendship not found or not accepted');
    }

    return this.shareEntry({
      entryId,
      sharedWithId: friend.id,
      permissions
    });
  }

  async revokeEntrySharing(entryId: string, ownerId: string, friendUsername: string): Promise<void> {
    // Find friend by username
    const friend = await this.getUserByUsername(friendUsername);
    if (!friend) {
      throw new Error('Friend not found');
    }

    await this.removeSharedEntry(entryId, friend.id);
  }

  async backfillContentBlocksWithCreatedBy(): Promise<void> {
    // Backfill existing content_blocks with created_by = entry owner
    await db.execute(sql`
      UPDATE content_blocks
      SET created_by = (
        SELECT user_id
        FROM journal_entries
        WHERE journal_entries.id = content_blocks.entry_id
      )
      WHERE created_by IS NULL
    `);
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

  // Enhanced friendship methods supporting all five statuses
  async getFriendship(userA: string, userB: string): Promise<Friendship | undefined> {
    const { userId, friendId } = buildCanonicalFriendshipIds(userA, userB, userA);
    
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.friendId, friendId)
        )
      );
    
    return friendship;
  }

  async getFriendshipById(friendshipId: string): Promise<Friendship | undefined> {
    const [friendship] = await db
      .select()
      .from(friendships)
      .where(eq(friendships.id, friendshipId));
    
    return friendship;
  }

  async createFriendshipWithCanonicalOrdering(userA: string, userB: string, initiatorId: string): Promise<Friendship> {
    const { userId, friendId } = buildCanonicalFriendshipIds(userA, userB, initiatorId);
    
    const friendshipData: InsertFriendship = {
      userId,
      friendId,
      initiatorId,
      status: 'pending',
      roleUserToFriend: 'viewer',
      roleFriendToUser: 'viewer',
    };

    const [newFriendship] = await db
      .insert(friendships)
      .values(friendshipData)
      .returning();

    // Log the friendship creation
    await this.logFriendshipChange({
      friendshipId: newFriendship.id,
      actorId: initiatorId,
      oldStatus: null,
      newStatus: 'pending',
      oldRoleUserToFriend: null,
      newRoleUserToFriend: 'viewer',
      oldRoleFriendToUser: null,
      newRoleFriendToUser: 'viewer',
    });

    // Invalidate cache for both users
    this.invalidateUserCache(userA);
    this.invalidateUserCache(userB);

    return newFriendship;
  }

  async updateFriendshipStatusWithAudit(friendshipId: string, newStatus: string, actorId: string): Promise<Friendship> {
    // Get current friendship to validate transition and log changes
    const currentFriendship = await this.getFriendshipById(friendshipId);
    if (!currentFriendship) {
      throw new Error(`Friendship with ID ${friendshipId} not found`);
    }

    // Validate status transition
    if (!isValidStatusTransition(currentFriendship.status, newStatus, actorId, currentFriendship.initiatorId)) {
      throw new Error(`Invalid status transition from ${currentFriendship.status} to ${newStatus}`);
    }

    // Update the friendship
    const [updatedFriendship] = await db
      .update(friendships)
      .set({ 
        status: newStatus as any, // Cast to satisfy enum type
        updatedAt: new Date() 
      })
      .where(eq(friendships.id, friendshipId))
      .returning();

    // Log the status change
    await this.logFriendshipChange({
      friendshipId,
      actorId,
      oldStatus: currentFriendship.status,
      newStatus,
      oldRoleUserToFriend: null,
      newRoleUserToFriend: null,
      oldRoleFriendToUser: null,
      newRoleFriendToUser: null,
    });

    // Invalidate cache for both users
    this.invalidateUserCache(currentFriendship.userId);
    this.invalidateUserCache(currentFriendship.friendId);

    return updatedFriendship;
  }

  async updateFriendshipRole(friendshipId: string, actorId: string, newRole: string): Promise<Friendship> {
    // Get current friendship to determine which role to update
    const currentFriendship = await this.getFriendshipById(friendshipId);
    if (!currentFriendship) {
      throw new Error(`Friendship with ID ${friendshipId} not found`);
    }

    // Determine which role field to update based on actor
    let updateData: Partial<InsertFriendship>;
    let oldRoleUserToFriend = null;
    let newRoleUserToFriend = null;
    let oldRoleFriendToUser = null;
    let newRoleFriendToUser = null;

    if (actorId === currentFriendship.userId) {
      // Actor is canonical userId, they're updating roleUserToFriend
      updateData = { roleUserToFriend: newRole as any };
      oldRoleUserToFriend = currentFriendship.roleUserToFriend;
      newRoleUserToFriend = newRole;
    } else if (actorId === currentFriendship.friendId) {
      // Actor is canonical friendId, they're updating roleFriendToUser
      updateData = { roleFriendToUser: newRole as any };
      oldRoleFriendToUser = currentFriendship.roleFriendToUser;
      newRoleFriendToUser = newRole;
    } else {
      throw new Error('Actor is not part of this friendship');
    }

    // Update the friendship
    const [updatedFriendship] = await db
      .update(friendships)
      .set({ 
        ...updateData,
        updatedAt: new Date() 
      })
      .where(eq(friendships.id, friendshipId))
      .returning();

    // Log the role change
    await this.logFriendshipChange({
      friendshipId,
      actorId,
      oldStatus: null,
      newStatus: null,
      oldRoleUserToFriend: oldRoleUserToFriend as any,
      newRoleUserToFriend: newRoleUserToFriend as any,
      oldRoleFriendToUser: oldRoleFriendToUser as any,
      newRoleFriendToUser: newRoleFriendToUser as any,
    });

    // Invalidate cache for both users
    this.invalidateUserCache(currentFriendship.userId);
    this.invalidateUserCache(currentFriendship.friendId);

    return updatedFriendship;
  }

  async getFriendshipsWithStatus(userId: string, status: string): Promise<(Friendship & { friend: User })[]> {
    // Query for friendships where user is either userId or friendId
    const results = await db
      .select({
        friendship: friendships,
        friend: users,
      })
      .from(friendships)
      .innerJoin(
        users,
        or(
          and(eq(friendships.userId, userId), eq(users.id, friendships.friendId)),
          and(eq(friendships.friendId, userId), eq(users.id, friendships.userId))
        )
      )
      .where(
        and(
          or(
            eq(friendships.userId, userId),
            eq(friendships.friendId, userId)
          ),
          eq(friendships.status, status as any)
        )
      );

    return results.map(r => ({ ...r.friendship, friend: r.friend }));
  }

  // Simple in-memory cache for friend lists
  private friendsCache = new Map<string, { data: any; timestamp: number }>();
  private requestsCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  private shouldUseCache(key: string, cache: Map<string, { data: any; timestamp: number }>): boolean {
    const cached = cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    const age = now - cached.timestamp;
    return age < this.CACHE_TTL;
  }

  private getFromCache(key: string, cache: Map<string, { data: any; timestamp: number }>): any {
    const cached = cache.get(key);
    return cached?.data;
  }

  private setCache(key: string, data: any, cache: Map<string, { data: any; timestamp: number }>): void {
    cache.set(key, { data, timestamp: Date.now() });
  }

  private invalidateUserCache(userId: string): void {
    // Invalidate both friends and requests cache for this user
    this.friendsCache.delete(`friends:${userId}`);
    this.friendsCache.delete(`friends:${userId}:0:50`);
    this.requestsCache.delete(`requests:${userId}`);
    this.requestsCache.delete(`requests:${userId}:0:50`);
  }

  async getFriendsWithRoles(userId: string, options?: { limit?: number; offset?: number }): Promise<{
    friends: (User & {
      friendshipId: string;
      roleUserToFriend: string;
      roleFriendToUser: string;
      status: string;
      createdAt: Date;
    })[];
    totalCount: number;
  }> {
    const limit = Math.floor(options?.limit || 50);
    const offset = Math.floor(options?.offset || 0);
    const cacheKey = `friends:${userId}:${offset}:${limit}`;

    // Check cache first
    if (this.shouldUseCache(cacheKey, this.friendsCache)) {
      return this.getFromCache(cacheKey, this.friendsCache);
    }

    // Get total count of accepted friendships
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.userId, userId),
            eq(friendships.friendId, userId)
          )
        )
      );

    const totalCount = Number(countResult?.count || 0);

    // Get paginated friends with their roles
    const results = await db
      .select({
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        isAdmin: users.isAdmin,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        friendshipId: friendships.id,
        roleUserToFriend: friendships.roleUserToFriend,
        roleFriendToUser: friendships.roleFriendToUser,
        status: friendships.status,
        friendshipCreatedAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(
        users,
        or(
          and(eq(friendships.userId, userId), eq(users.id, friendships.friendId)),
          and(eq(friendships.friendId, userId), eq(users.id, friendships.userId))
        )
      )
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(
            eq(friendships.userId, userId),
            eq(friendships.friendId, userId)
          )
        )
      )
      .orderBy(desc(friendships.createdAt))
      .limit(limit)
      .offset(offset);

    const friends = results.map(user => ({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      isAdmin: user.isAdmin ?? false,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
      friendshipId: user.friendshipId,
      roleUserToFriend: user.roleUserToFriend as string,
      roleFriendToUser: user.roleFriendToUser as string,
      status: user.status as string,
    }));

    const result = { friends, totalCount };
    
    // Cache the result
    this.setCache(cacheKey, result, this.friendsCache);
    
    return result;
  }

  async getFriendRequests(userId: string, options?: { limit?: number; offset?: number }): Promise<{
    sent: (Friendship & { friend: User })[];
    received: (Friendship & { user: User })[];
    totalCount: number;
  }> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    const cacheKey = `requests:${userId}:${offset}:${limit}`;

    // Check cache first
    if (this.shouldUseCache(cacheKey, this.requestsCache)) {
      return this.getFromCache(cacheKey, this.requestsCache);
    }

    // Get total count of pending requests (sent + received)
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'pending'),
          or(
            eq(friendships.userId, userId),
            eq(friendships.friendId, userId)
          )
        )
      );

    const totalCount = Number(countResult?.count || 0);

    // Get sent requests
    const sentResults = await db
      .select({
        friendship: friendships,
        friend: users,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.friendId))
      .where(
        and(
          eq(friendships.userId, userId),
          eq(friendships.status, 'pending')
        )
      )
      .orderBy(desc(friendships.createdAt))
      .limit(Math.floor(limit / 2))
      .offset(offset);

    // Get received requests
    const receivedResults = await db
      .select({
        friendship: friendships,
        user: users,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.userId))
      .where(
        and(
          eq(friendships.friendId, userId),
          eq(friendships.status, 'pending')
        )
      )
      .orderBy(desc(friendships.createdAt))
      .limit(Math.floor(limit / 2))
      .offset(offset);

    const result = {
      sent: sentResults.map(r => ({ ...r.friendship, friend: r.friend })),
      received: receivedResults.map(r => ({ ...r.friendship, user: r.user })),
      totalCount,
    };
    
    // Cache the result
    this.setCache(cacheKey, result, this.requestsCache);
    
    return result;
  }

  async canSendFriendRequestTo(fromUserId: string, toUserId: string): Promise<boolean> {
    if (fromUserId === toUserId) {
      return false; // Cannot friend self
    }

    const existingFriendship = await this.getFriendship(fromUserId, toUserId);
    
    if (!existingFriendship) {
      return true; // No existing friendship
    }

    return canSendFriendRequest(existingFriendship.updatedAt, existingFriendship.status);
  }

  // Friendship audit operations
  async logFriendshipChange(change: InsertFriendshipChange): Promise<FriendshipChange> {
    const [newChange] = await db
      .insert(friendshipChanges)
      .values(change)
      .returning();
    
    return newChange;
  }

  async getFriendshipHistory(friendshipId: string): Promise<FriendshipChange[]> {
    const history = await db
      .select()
      .from(friendshipChanges)
      .where(eq(friendshipChanges.friendshipId, friendshipId))
      .orderBy(desc(friendshipChanges.changedAt));

    return history;
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
