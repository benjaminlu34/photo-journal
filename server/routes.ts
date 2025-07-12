import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";

import { storage } from "./storage";
import { setupAuth as setupReplitAuth, isAuthenticated as replitAuth } from "./replitAuth";
import { localAuth } from "./localAuth";

import {
  insertJournalEntrySchema,
  insertContentBlockSchema,
  insertFriendshipSchema,
  insertSharedEntrySchema,
} from "@shared/schema";

/** -----------------------------------------------------------------------
 *  Helper types
 *  -------------------------------------------------------------------- */
interface AuthedRequest extends Request {
  /** Populated by either localAuth or replitAuth */
  user: {
    /** Replit → sub claim, local → header string */
    id: string;
    role?: string;
    /** Present only when Replit OIDC is active */
    claims?: { sub: string };
  };
}

/** -----------------------------------------------------------------------
 *  Route registration
 *  -------------------------------------------------------------------- */
export async function registerRoutes(app: Express): Promise<Server> {
  /* ─────────────────────────  AUTH MODE SWITCH  ─────────────────────── */
  const usingReplit = process.env.REPLIT === "true" || Boolean(process.env.REPL_ID);

  // choose middleware
  const isAuthenticated: (req: Request, res: Response, next: NextFunction) => void =
    usingReplit ? replitAuth : localAuth;

  // Replit needs async setup (keys, JWKS, etc.)
  if (usingReplit) {
    await setupReplitAuth(app);
  }

  /* ─────────────────────────────  ROUTES  ───────────────────────────── */

  /* -- Auth ----------------------------------------------------------- */
  app.get("/api/auth/user", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = usingReplit ? req.user.claims!.sub : req.user.id;
      const user = await storage.getUser(userId);
      return res.json(user);
    } catch (err) {
      console.error("GET /api/auth/user:", err);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  /* -- Journal entries ----------------------------------------------- */
  app.get("/api/journal/:date", isAuthenticated, async (req: AuthedRequest, res) => {
    try {
      const userId = usingReplit ? req.user.claims!.sub : req.user.id;
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

  app.get(
    "/api/journal/range/:startDate/:endDate",
    isAuthenticated,
    async (req: AuthedRequest, res) => {
      try {
        const userId = usingReplit ? req.user.claims!.sub : req.user.id;
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

  app.patch("/api/journal/:entryId", isAuthenticated, async (req: Request, res) => {
    try {
      const updates = insertJournalEntrySchema.partial().parse(req.body);
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

  /* -- Content blocks ------------------------------------------------- */
  app.post("/api/content-blocks", isAuthenticated, async (req: Request, res) => {
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

  /* -- Friendships ---------------------------------------------------- */
  app.post("/api/friendships", isAuthenticated, async (req: Request, res) => {
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

  /* -- Shared entries ------------------------------------------------- */
  app.post("/api/share-entry", isAuthenticated, async (req: Request, res) => {
    try {
      const data = insertSharedEntrySchema.parse(req.body);
      const shared = await storage.createSharedEntry(data);
      return res.json(shared);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("POST /api/share-entry:", err);
      return res.status(500).json({ message: "Failed to share entry" });
    }
  });

  /* ------------------------------------------------------------------ */
  /*  CENTRALIZED ERROR HANDLER                                        */
  /* ------------------------------------------------------------------ */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled error:", err);
    return res.status(status).json({ message });
  });

  /* ------------------------------------------------------------------ */
  /*  START SERVER (same as original)                                   */
  /* ------------------------------------------------------------------ */
  const server = createServer(app);
  const port = process.env.PORT ? Number(process.env.PORT) : 5000;
  server.listen(port, "0.0.0.0", () => console.log(`🚀  API listening on :${port}`));

  return server;
}
