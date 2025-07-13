import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

import { storage } from "./storage";
import { isAuthenticatedSupabase } from "./middleware/auth";

import {
  insertJournalEntrySchema,
  insertContentBlockSchema,
  insertFriendshipSchema,
  insertSharedEntrySchema,
} from "@shared/schema";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface AuthedRequest extends Request {
  user: {
    id: string;
    email: string;
  };
}

/* Small helper so we cast once per route, not on every access */
const getUserId = (req: Request): string => (req as AuthedRequest).user.id;
const getUserEmail = (req: Request): string => (req as AuthedRequest).user.email;

/* ------------------------------------------------------------------ */
/*  Route registration                                                */
/* ------------------------------------------------------------------ */
export async function registerRoutes(app: Express): Promise<Server> {

  /* ----------------  ROUTES  ------------------ */

  /* Auth */
  app.get("/api/auth/user", isAuthenticatedSupabase, async (req, res) => {
    try {
      const user = await storage.getUser(getUserId(req));
      return res.json(user);
    } catch (err) {
      console.error("GET /api/auth/user:", err);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  /* Journal entry – single date */
  app.get("/api/journal/:date", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);
      const date = new Date(req.params.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      let entry = await storage.getJournalEntry(userId, date);
      if (!entry) {
        entry = await storage.createJournalEntry({ userId, date, title: null });
      }
      const blocks = await storage.getContentBlocks(entry.id);
      return res.json({ ...entry, contentBlocks: blocks });
    } catch (err) {
      console.error("GET /api/journal/:date:", err);
      return res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  /* Journal entries – range */
  app.get(
    "/api/journal/range/:startDate/:endDate",
    isAuthenticatedSupabase,
    async (req, res) => {
      try {
        const userId = getUserId(req);
        const start = new Date(req.params.startDate);
        const end = new Date(req.params.endDate);
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        const entries = await storage.getJournalEntriesInRange(userId, start, end);
        const withBlocks = await Promise.all(
          entries.map(async (e) => ({
            ...e,
            contentBlocks: await storage.getContentBlocks(e.id),
          })),
        );
        return res.json(withBlocks);
      } catch (err) {
        console.error("GET /api/journal/range:", err);
        return res.status(500).json({ message: "Failed to fetch journal entries" });
      }
    },
  );

  /* Update a journal entry */
  app.patch("/api/journal/:entryId", isAuthenticatedSupabase, async (req, res) => {
    try {
      const updates = insertJournalEntrySchema.partial().parse(req.body);
      const userId = getUserId(req);

      // Verify the entry actually belongs to this user
      const entry = await storage.getJournalEntryById(req.params.entryId);
      if (!entry || entry.userId !== userId) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      const updated = await storage.updateJournalEntry(req.params.entryId, updates);
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("PATCH /api/journal/:entryId:", err);
      return res.status(500).json({ message: "Failed to update journal entry" });
    }
  });

  /* Content blocks */
  app.post("/api/content-blocks", isAuthenticatedSupabase, async (req, res) => {
    try {
      const block = insertContentBlockSchema.parse(req.body);
      const created = await storage.createContentBlock(block);
      return res.json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("POST /api/content-blocks:", err);
      return res.status(500).json({ message: "Failed to create content block" });
    }
  });

  /* Friendships */
  app.post("/api/friendships", isAuthenticatedSupabase, async (req, res) => {
    try {
      const data = insertFriendshipSchema.parse(req.body);
      const created = await storage.createFriendship(data);
      return res.json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("POST /api/friendships:", err);
      return res.status(500).json({ message: "Failed to create friendship" });
    }
  });

  /* Shared entries */
  app.post("/api/share-entry", isAuthenticatedSupabase, async (req, res) => {
    try {
      const data = insertSharedEntrySchema.parse(req.body);
      const shared = await storage.shareEntry(data);
      return res.json(shared);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("POST /api/share-entry:", err);
      return res.status(500).json({ message: "Failed to share entry" });
    }
  });

  /* Central error handler */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled error:", err);
    return res.status(status).json({ message });
  });

  /* Create server */
  const server = createServer(app);
  
  return server;
}
