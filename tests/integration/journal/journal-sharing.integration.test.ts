import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { storage } from "../../../server/storage";
import { db } from "../../../server/db";
import { registerRoutes } from "../../../server/routes";
import { users, journalEntries, contentBlocks, friendships, sharedEntries } from "../../../shared/schema/schema";
import { eq } from "drizzle-orm";
import { createTestUserToken } from "../test-helpers";

describe("Journal Sharing Integration Tests", () => {
  let app: any;
  let user1: { token: string; id: string; username: string };
  let user2: { token: string; id: string; username: string };
  let user3: { token: string; id: string; username: string };
  let entry: any;
  let friendship: any;

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
    const timestamp = Date.now().toString().slice(-4);
    
    user1 = await createTestUser(`u1-${timestamp}`, `u1-${timestamp}@example.com`, `a-${timestamp}`);
    user2 = await createTestUser(`u2-${timestamp}`, `u2-${timestamp}@example.com`, `b-${timestamp}`);
    user3 = await createTestUser(`u3-${timestamp}`, `u3-${timestamp}@example.com`, `c-${timestamp}`);

    // Create journal entry for user1
    entry = await storage.createJournalEntry({
      userId: user1.id,
      date: new Date("2024-01-15"),
      title: "Test Entry"
    });

    // Create friendship between user1 and user2
    friendship = await storage.createFriendshipWithCanonicalOrdering(
      user1.id,
      user2.id,
      user1.id
    );
    
    // Accept the friendship
    await storage.updateFriendshipStatusWithAudit(
      friendship.id,
      "accepted",
      user2.id
    );
  });

  afterEach(async () => {
    // Clean up test data
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

  describe("GET /api/journal/user/:username/:date", () => {
    it("should allow owner to access their own journal", async () => {
      const response = await request(app)
        .get(`/api/journal/user/${user1.username}/2024-01-15`)
        .set("Authorization", user1.token);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(user1.id);
    });

    it("should allow friend with view permission to access journal", async () => {
      // Share entry with user2
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "view");

      const response = await request(app)
        .get(`/api/journal/user/${user1.username}/2024-01-15`)
        .set("Authorization", user2.token);

      expect(response.status).toBe(200);
      expect(response.body.userId).toBe(user1.id);
      expect(response.body.permissions.canView).toBe(true);
    });

    it("should deny access to non-friend", async () => {
      const response = await request(app)
        .get(`/api/journal/user/${user1.username}/2024-01-15`)
        .set("Authorization", user3.token);

      expect(response.status).toBe(403);
    });

    it("should deny access to blocked friend", async () => {
      // Block user2
      await storage.updateFriendshipStatusWithAudit(
        friendship.id,
        "blocked",
        user1.id
      );

      const response = await request(app)
        .get(`/api/journal/user/${user1.username}/2024-01-15`)
        .set("Authorization", user2.token);

      expect(response.status).toBe(403);
    });
  });

  describe("POST /api/journal/:entryId/share", () => {
    it("should share journal entry with friend", async () => {
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", user1.token)
        .send({
          friendUsername: user2.username,
          permissions: "edit"
        });

      expect(response.status).toBe(201);
      expect(response.body.permissions).toBe("edit");
      expect(response.body.sharedWith.username).toBe(user2.username);
    });

    it("should deny sharing with non-friend", async () => {
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", user1.token)
        .send({
          friendUsername: user3.username,
          permissions: "view"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("Friendship not found or not accepted");
    });

    it("should deny sharing non-owned entry", async () => {
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", user2.token)
        .send({
          friendUsername: user3.username,
          permissions: "view"
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can only share your own journal entries");
    });

    it("should prevent duplicate sharing", async () => {
      // First share
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "view");

      // Try to share again
      const response = await request(app)
        .post(`/api/journal/${entry.id}/share`)
        .set("Authorization", user1.token)
        .send({
          friendUsername: user2.username,
          permissions: "edit"
        });

      // Should update existing share
      expect(response.status).toBe(201);
    });
  });

  describe("DELETE /api/journal/:entryId/share/:friendUsername", () => {
    it("should revoke sharing with friend", async () => {
      // First share the entry
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "view");

      // Then revoke sharing
      const response = await request(app)
        .delete(`/api/journal/${entry.id}/share/${user2.username}`)
        .set("Authorization", user1.token);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Successfully revoked sharing with friend");
    });

    it("should deny revoking non-owned entry sharing", async () => {
      const response = await request(app)
        .delete(`/api/journal/${entry.id}/share/${user2.username}`)
        .set("Authorization", user2.token);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can only revoke sharing of your own journal entries");
    });

    it("should return 404 for non-existent friend", async () => {
      const response = await request(app)
        .delete(`/api/journal/${entry.id}/share/nonexistent`)
        .set("Authorization", user1.token);

      expect(response.status).toBe(404);
      expect(response.body.message).toBe("Friend not found");
    });
  });

  describe("GET /api/journal/:entryId/shares", () => {
    it("should list shared entries for owned journal", async () => {
      // Share entry with user2
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "edit");

      const response = await request(app)
        .get(`/api/journal/${entry.id}/shares`)
        .set("Authorization", user1.token);

      expect(response.status).toBe(200);
      expect(response.body.shares).toHaveLength(1);
      expect(response.body.shares[0].user.username).toBe(user2.username);
    });

    it("should deny listing shares for non-owned journal", async () => {
      const response = await request(app)
        .get(`/api/journal/${entry.id}/shares`)
        .set("Authorization", user2.token);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe("You can only view shares of your own journal entries");
    });
  });

  describe("Content block permissions", () => {
    it("should allow owner to create content blocks", async () => {
      const response = await request(app)
        .post("/api/content-blocks")
        .set("Authorization", user1.token)
        .send({
          entryId: entry.id,
          type: "text",
          content: { type: "text", content: "Test content" },
          position: { x: 100, y: 100, width: 200, height: 100 }
        });

      expect(response.status).toBe(200);
      expect(response.body.createdBy).toBe(user1.id);
    });

    it("should allow friend with edit permission to create content blocks", async () => {
      // Share entry with edit permission
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "edit");

      const response = await request(app)
        .post("/api/content-blocks")
        .set("Authorization", user2.token)
        .send({
          entryId: entry.id,
          type: "text",
          content: { type: "text", content: "Friend content" },
          position: { x: 150, y: 150, width: 200, height: 100 }
        });

      expect(response.status).toBe(200);
      expect(response.body.createdBy).toBe(user2.id);
    });

    it("should deny friend with view permission from creating content blocks", async () => {
      // Share entry with view permission
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "view");

      const response = await request(app)
        .post("/api/content-blocks")
        .set("Authorization", user2.token)
        .send({
          entryId: entry.id,
          type: "text",
          content: { type: "text", content: "Should not create" },
          position: { x: 200, y: 200, width: 200, height: 100 }
        });

      expect(response.status).toBe(403);
    });

    it("should allow contributor to edit their own content blocks", async () => {
      // Share entry with edit permission
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "edit");

      // Create content block as user2
      const contentBlock = await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Friend content" },
        position: { x: 150, y: 150, width: 200, height: 100 },
        createdBy: user2.id
      });

      const response = await request(app)
        .patch(`/api/content-blocks/${contentBlock.id}`)
        .set("Authorization", user2.token)
        .send({
          content: { type: "text", content: "Updated friend content" }
        });

      expect(response.status).toBe(200);
    });

    it("should deny contributor from editing others' content blocks", async () => {
      // Share entry with edit permission
      await storage.shareEntryWithFriend(entry.id, user1.id, user2.username, "edit");

      // Create content block as user1
      const contentBlock = await storage.createContentBlock({
        entryId: entry.id,
        type: "text",
        content: { type: "text", content: "Owner content" },
        position: { x: 100, y: 100, width: 200, height: 100 },
        createdBy: user1.id
      });

      const response = await request(app)
        .patch(`/api/content-blocks/${contentBlock.id}`)
        .set("Authorization", user2.token)
        .send({
          content: { type: "text", content: "Should not update" }
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("Insufficient permissions");
    });
  });
});