import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  insertJournalEntrySchema, 
  insertContentBlockSchema,
  insertFriendshipSchema,
  insertSharedEntrySchema 
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Journal entry routes
  app.get('/api/journal/:date', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const date = new Date(req.params.date);
      
      if (isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      let entry = await storage.getJournalEntry(userId, date);
      if (!entry) {
        // Create a new entry for this date
        entry = await storage.createJournalEntry({
          userId,
          date,
          title: null,
        });
      }

      const contentBlocks = await storage.getContentBlocks(entry.id);
      res.json({ ...entry, contentBlocks });
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  app.get('/api/journal/range/:startDate/:endDate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const startDate = new Date(req.params.startDate);
      const endDate = new Date(req.params.endDate);
      
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      const entries = await storage.getJournalEntriesInRange(userId, startDate, endDate);
      
      // Get content blocks for each entry
      const entriesWithBlocks = await Promise.all(
        entries.map(async (entry) => {
          const contentBlocks = await storage.getContentBlocks(entry.id);
          return { ...entry, contentBlocks };
        })
      );

      res.json(entriesWithBlocks);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.patch('/api/journal/:entryId', isAuthenticated, async (req: any, res) => {
    try {
      const { entryId } = req.params;
      const updates = insertJournalEntrySchema.partial().parse(req.body);
      
      const updatedEntry = await storage.updateJournalEntry(entryId, updates);
      res.json(updatedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating journal entry:", error);
      res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  // Content block routes
  app.post('/api/content-blocks', isAuthenticated, async (req: any, res) => {
    try {
      const blockData = insertContentBlockSchema.parse(req.body);
      const newBlock = await storage.createContentBlock(blockData);
      res.json(newBlock);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating content block:", error);
      res.status(500).json({ message: "Failed to create content block" });
    }
  });

  app.patch('/api/content-blocks/:blockId', isAuthenticated, async (req: any, res) => {
    try {
      const { blockId } = req.params;
      const updates = insertContentBlockSchema.partial().parse(req.body);
      
      // Get the existing block to ensure we preserve all fields
      const existingBlock = await storage.getContentBlock(blockId);
      if (!existingBlock) {
        return res.status(404).json({ message: "Content block not found" });
      }
      
      // Merge updates with existing data to ensure no fields are lost
      const mergedUpdates = {
        ...existingBlock,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      
      const updatedBlock = await storage.updateContentBlock(blockId, mergedUpdates);
      res.json(updatedBlock);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error updating content block:", error);
      res.status(500).json({ message: "Failed to update content block" });
    }
  });

  app.delete('/api/content-blocks/:blockId', isAuthenticated, async (req: any, res) => {
    try {
      const { blockId } = req.params;
      await storage.deleteContentBlock(blockId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting content block:", error);
      res.status(500).json({ message: "Failed to delete content block" });
    }
  });

  // Friend routes
  app.get('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friends = await storage.getFriends(userId);
      res.json(friends);
    } catch (error) {
      console.error("Error fetching friends:", error);
      res.status(500).json({ message: "Failed to fetch friends" });
    }
  });

  app.get('/api/friend-requests', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const requests = await storage.getFriendshipRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching friend requests:", error);
      res.status(500).json({ message: "Failed to fetch friend requests" });
    }
  });

  app.post('/api/friends', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const friendshipData = insertFriendshipSchema.parse({
        ...req.body,
        userId,
      });
      
      const friendship = await storage.createFriendship(friendshipData);
      res.json(friendship);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error creating friendship:", error);
      res.status(500).json({ message: "Failed to create friendship" });
    }
  });

  app.patch('/api/friends/:friendshipId', isAuthenticated, async (req: any, res) => {
    try {
      const { friendshipId } = req.params;
      const { status } = req.body;
      
      if (!["accepted", "blocked"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      const updatedFriendship = await storage.updateFriendshipStatus(friendshipId, status);
      res.json(updatedFriendship);
    } catch (error) {
      console.error("Error updating friendship:", error);
      res.status(500).json({ message: "Failed to update friendship" });
    }
  });

  // Sharing routes
  app.get('/api/shared-entries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sharedEntries = await storage.getSharedEntries(userId);
      res.json(sharedEntries);
    } catch (error) {
      console.error("Error fetching shared entries:", error);
      res.status(500).json({ message: "Failed to fetch shared entries" });
    }
  });

  app.post('/api/shared-entries', isAuthenticated, async (req: any, res) => {
    try {
      const shareData = insertSharedEntrySchema.parse(req.body);
      const sharedEntry = await storage.shareEntry(shareData);
      res.json(sharedEntry);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      console.error("Error sharing entry:", error);
      res.status(500).json({ message: "Failed to share entry" });
    }
  });

  app.delete('/api/shared-entries/:entryId/:sharedWithId', isAuthenticated, async (req: any, res) => {
    try {
      const { entryId, sharedWithId } = req.params;
      await storage.removeSharedEntry(entryId, sharedWithId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error removing shared entry:", error);
      res.status(500).json({ message: "Failed to remove shared entry" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
