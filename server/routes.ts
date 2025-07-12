import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

import { storage } from "./storage";
import {
  setupAuth as setupReplitAuth,
  isAuthenticated as replitAuth,
} from "./replitAuth";
import { localAuth } from "./localAuth";

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
    role?: string;
    claims?: { sub: string };
  };
}

/* Small helper so we cast once per route, not on every access */
const getUserId = (req: Request, replit: boolean): string =>
  replit
    ? (req as AuthedRequest).user.claims!.sub
    : (req as AuthedRequest).user.id;

/* ------------------------------------------------------------------ */
/*  Route registration                                                */
/* ------------------------------------------------------------------ */
export async function registerRoutes(app: Express): Promise<Server> {
  /* ------------  AUTH MODE SWITCH  ------------ */
  const usingReplit = process.env.REPLIT === "true" || Boolean(process.env.REPL_ID);
  const isAuthenticated: (req: Request, res: Response, next: NextFunction) => void =
    usingReplit ? replitAuth : localAuth;

  if (usingReplit) await setupReplitAuth(app);

  /* ----------------  ROUTES  ------------------ */

  /* Auth */
  app.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = await storage.getUser(getUserId(req, usingReplit));
      return res.json(user);
    } catch (err) {
      console.error("GET /api/auth/user:", err);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  /* Journal entry – single date */
  app.get("/api/journal/:date", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req, usingReplit);
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
    isAuthenticated,
    async (req, res) => {
      try {
        const userId = getUserId(req, usingReplit);
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
  app.patch("/api/journal/:entryId", isAuthenticated, async (req, res) => {
    try {
      const updates = insertJournalEntrySchema.partial().parse(req.body);
      const userId = getUserId(req, usingReplit);

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
  app.post("/api/content-blocks", isAuthenticated, async (req, res) => {
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
  app.post("/api/friendships", isAuthenticated, async (req, res) => {
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
  app.post("/api/share-entry", isAuthenticated, async (req, res) => {
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

  /* Start server */
  const server = createServer(app);
  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen(port, "0.0.0.0", () => console.log(`🚀 API listening on :${port}`));

  return server;
}
