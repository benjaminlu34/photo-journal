import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { storage } from "../../../server/storage";
import { db } from "../../../server/db";
import { registerRoutes } from "../../../server/routes";
import { users, journalEntries, contentBlocks, friendships, sharedEntries } from "@shared/schema/schema";
import { eq } from "drizzle-orm";
import { createTestUserToken } from "../test-helpers";

import { setupTestDB, teardownTestDB } from '../../test-utils';

describe('Journal Sharing Edge Cases Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });
  let app: any;
  let owner: { token: string; id: string; username: string };
  let friend: { token: string; id: string; username: string };
  let entry: any;

  beforeEach(async () => {
    // Set up test environment
    process.env.SUPABASE_JWT_SECRET = 'test-secret';

    // Clean up test data
    await db.delete(sharedEntries);
    await db.delete(contentBlocks);
    await db.delete(journalEntries);
    await db.delete(friendships);
    await db.delete(users);

    app = express();
    await registerRoutes(app);

    // Create test users
    owner = await createTestUser("owner-123", "owner@example.com", "jane");
    friend = await createTestUser("friend-456", "friend@example.com", "john");

    // Create journal entry
    entry = await storage.createJournalEntry({
      userId: owner.id,
      date: new Date("2024-01-20"),
      title: "Edge Case Testing"
    });
  });

  afterEach(async () => {
    await db.delete(sharedEntries);
    await db.delete(contentBlocks);
    await db.delete(journalEntries);
    await db.delete(friendships);
    await db.delete(users);
  });

  async function createTestUser(id: string, email: string, username: string) {
    await storage.upsertUser({
      id,
      email,
      username,
      firstName: username.charAt(0).toUpperCase() + username.slice(1),
      lastName: "Test"
    });

    return {
      token: createTestUserToken(id, email, username),
      id,
      username
    };
  }

  describe("Username Case Sensitivity", () => {
    it("should handle case variations in username sharing", async () => {
      // Create friendship
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        owner.id,
        friend.id,
        owner.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, "accepted", friend.id);

      // Test sharing with different case variations
      const variations = ["JOHN", "John", "john"];
      
      for (const username of variations) {
        const response = await request(app)
          .post(`/api/journal/${entry.id}/share`)
          .set("Authorization", owner.token)
          .send({
            friendUsername: username,
            permissions: "view"
          });

        expect(response.status).toBe(201);
        await storage.removeSharedEntry(entry.id, friend.id); // Clean up for next test
      }
    });
  });

  describe("Concurrent Sharing Operations", () => {
    it("should handle rapid sharing/unsharing cycles", async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        owner.id,
        friend.id,
        owner.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, "accepted", friend.id);

      // Rapid sequence of operations
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post(`/api/journal/${entry.id}/share`)
          .set("Authorization", owner.token)
          .send({
            friendUsername: "john",
            permissions: "edit"
          });

        await request(app)
          .delete(`/api/journal/${entry.id}/share/john`)
          .set("Authorization", owner.token);
      }

      // Verify final state
      const shares = await storage.getSharedEntriesForEntry(entry.id);
      expect(shares).toHaveLength(0);
    });
  });

  describe("Content Block Ownership", () => {
    it("should maintain content block ownership across sharing changes", async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        owner.id,
        friend.id,
        owner.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, "accepted", friend.id);

      // Share with edit permission
      await storage.shareEntryWithFriend(entry.id, owner.id, "john", "edit");

      // Create content blocks as both users
      const ownerBlock = await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Owner content" },
        position: { x: 100, y: 100, width: 200, height: 100 },
        createdBy: owner.id
      });

      const friendBlock = await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Friend content" },
        position: { x: 200, y: 200, width: 200, height: 100 },
        createdBy: friend.id
      });

      // Verify ownership
      expect(ownerBlock.createdBy).toBe(owner.id);
      expect(friendBlock.createdBy).toBe(friend.id);

      // Change to contributor role
      await storage.updateFriendshipRole(friendship.id, owner.id, "contributor");

      // Verify permissions still work
      const blocks = await storage.getContentBlocks(entry.id);
      expect(blocks).toHaveLength(2);
    });
  });

  describe("Permission Downgrade Edge Cases", () => {
    it("should handle role downgrade from editor to viewer", async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        owner.id,
        friend.id,
        owner.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, "accepted", friend.id);

      // Start with editor role
      await storage.updateFriendshipRole(friendship.id, owner.id, "editor");
      await storage.shareEntryWithFriend(entry.id, owner.id, "john", "edit");

      // Create content as friend
      const friendBlock = await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Friend content" },
        position: { x: 100, y: 100, width: 200, height: 100 },
        createdBy: friend.id
      });

      // Downgrade to viewer
      await storage.updateFriendshipRole(friendship.id, owner.id, "viewer");

      // Verify friend can no longer edit their own content
      const response = await request(app)
        .patch(`/api/content-blocks/${friendBlock.id}`)
        .set("Authorization", friend.token)
        .send({
          content: { type: "text", content: "Should not update" }
        });

      expect(response.status).toBe(403);
    });
  });

  describe("Non-existent User Handling", () => {
    it("should gracefully handle sharing with non-existent username", async () => {
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", owner.token)
        .send({
          friendUsername: "nonexistentuser123",
          permissions: "view"
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Friend not found");
    });

    it("should handle revoking sharing with non-existent friend", async () => {
      const response = await request(app)
        .delete(`/api/journal/${entry.id}/share/nonexistentuser123`)
        .set("Authorization", owner.token);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Friend not found");
    });
  });

  describe("Authorization Bypass Prevention", () => {
    it("should prevent accessing non-owned journals without sharing", async () => {
      // No friendship created
      const response = await request(app)
        .get("/api/journal/user/jane/2024-01-20")
        .set("Authorization", friend.token);

      expect(response.status).toBe(403);
    });

    it("should prevent sharing non-owned entries", async () => {
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", friend.token)
        .send({
          friendUsername: "someuser",
          permissions: "view"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can only share your own journal entries");
    });
  });

  describe("Data Integrity", () => {
    it("should maintain data integrity during friendship deletion", async () => {
      const friendship = await storage.createFriendshipWithCanonicalOrdering(
        owner.id,
        friend.id,
        owner.id
      );
      await storage.updateFriendshipStatusWithAudit(friendship.id, "accepted", friend.id);

      // Share entry
      await storage.shareEntryWithFriend(entry.id, owner.id, "john", "edit");

      // Create content
      await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Test content" },
        position: { x: 100, y: 100, width: 200, height: 100 },
        createdBy: friend.id
      });

      // Delete friendship
      await storage.updateFriendshipStatusWithAudit(friendship.id, "unfriended", owner.id);

      // Verify sharing is revoked
      const shares = await storage.getSharedEntriesForEntry(entry.id);
      expect(shares).toHaveLength(0);

      // Verify content blocks still exist but access is denied
      const accessResponse = await request(app)
        .get("/api/journal/user/jane/2024-01-20")
        .set("Authorization", friend.token);

      expect(accessResponse.status).toBe(403);
    });
  });
});