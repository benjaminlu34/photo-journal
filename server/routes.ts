import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import rateLimit from "express-rate-limit";

import { storage } from "./storage";
import { isAuthenticatedSupabase } from "./middleware/auth";
import { usernameCheckRateLimit, userSearchRateLimit, usernameChangeRateLimit } from "./middleware/rateLimit";
import { validateUsername, generateUsernameSuggestions } from "./utils/username";

import {
  insertJournalEntrySchema,
  insertContentBlockSchema,
  insertFriendshipSchema,
  insertSharedEntrySchema,
  users,
} from "@shared/schema/schema";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
interface AuthedRequest extends Request {
  user: {
    id: string;
    email: string;
    username?: string; // Optional during migration phase
  };
}

/* Small helper so we cast once per route, not on every access */
const getUserId = (req: Request): string => (req as AuthedRequest).user.id;
const getUserEmail = (req: Request): string => (req as AuthedRequest).user.email;
const getUserUsername = (req: Request): string | undefined => (req as AuthedRequest).user.username;

/* ------------------------------------------------------------------ */
/*  Security helpers                                                  */
/* ------------------------------------------------------------------ */
// Generate a secure filename based on user ID and original filename
const generateSecureFilename = (userId: string, originalFilename: string): string => {
  const fileExt = path.extname(originalFilename).toLowerCase();
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(8).toString('hex');
  return `${userId}_${timestamp}_${randomString}${fileExt}`;
};

// Validate file ownership
const validateFileOwnership = (userId: string, filename: string): boolean => {
  // Check if the file starts with the user's ID prefix
  return filename.startsWith(`${userId}_`);
};

/* ------------------------------------------------------------------ */
/*  File upload configuration                                         */
/* ------------------------------------------------------------------ */
// Configure storage
const uploadDir = path.join(process.cwd(), "uploads");
// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Create user-specific upload directories
const getUserUploadDir = (userId: string): string => {
  const userDir = path.join(uploadDir, userId);
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  return userDir;
};

const storage_config = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const userId = getUserId(req);
    const userDir = getUserUploadDir(userId);
    cb(null, userDir);
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const userId = getUserId(req);
    const secureFilename = generateSecureFilename(userId, file.originalname);
    cb(null, secureFilename);
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1, // Only allow one file per request
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed."));
    }
  },
});

/* ------------------------------------------------------------------ */
/*  Route registration                                                */
/* ------------------------------------------------------------------ */
export async function registerRoutes(app: Express): Promise<Server> {

  /* ----------------  ROUTES  ------------------ */

  /* Health check - public endpoint */
  app.get("/api/health", (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  /* Auth */
  app.get("/api/auth/user", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);
      const email = getUserEmail(req);
      const username = getUserUsername(req);
      
      let user = await storage.getUser(userId);
      
      if (!user) {
        // Create user if they don't exist in local DB
        if (email) {
          user = await storage.upsertUserFromSupabase({
            id: userId,
            email,
            username, // Include username from JWT
          });
          return res.json(user);
        }
        return res.status(404).json({ message: "User not found" });
      }
      
      // Auto-populate email for legacy users with null email
      if (!user.email && email) {
        user = await storage.updateUser(userId, { email });
      }
      
      // Auto-populate username from JWT if not in database yet
      if (!user.username && username) {
        user = await storage.updateUser(userId, { username });
      }
      
      return res.json(user);
    } catch (err) {
      console.error("GET /api/auth/user error:", err);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  /* Update user profile */
  app.patch("/api/auth/profile", isAuthenticatedSupabase, async (req, res, next) => {
    try {
      const userId = getUserId(req);
      
      // Create a schema for profile updates
      const updateProfileSchema = z.object({
        firstName: z.string().min(0).optional(), // Allow empty strings
        lastName: z.string().min(0).optional(),  // Allow empty strings
        profileImageUrl: z.string().optional(), // Allow profile image URL updates
        username: z.string().min(3).max(20).regex(/^[a-z0-9_]+$/).optional(), // Username updates
      });
      
      const updates = updateProfileSchema.parse(req.body);
      
      // If username is being updated, apply rate limiting
      if (updates.username) {
        // Apply rate limiting middleware for username changes
        return usernameChangeRateLimit(req, res, async () => {
          try {
            // Get current user to track the change
            const currentUser = await storage.getUser(userId);
            if (!currentUser) {
              return res.status(404).json({ message: "User not found" });
            }

            // Update the user profile with JWT sync for username changes
            const updatedUser = await storage.updateUserWithJWTSync(userId, updates);
            
            // Track the username change in audit table
            if (currentUser.username !== updates.username && updates.username) {
              await storage.trackUsernameChange({
                userId,
                oldUsername: currentUser.username || '',
                newUsername: updates.username,
              });
            }
            
            console.log('user updated with username change!', updatedUser);
            return res.json(updatedUser);
          } catch (err) {
            console.error("PATCH /api/auth/profile (username change):", err);
            return res.status(500).json({ message: "Failed to update user profile" });
          }
        });
      } else {
        // Regular profile update without username change
        const updatedUser = await storage.updateUser(userId, updates);
        console.log('user updated!', updatedUser);
        return res.json(updatedUser);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("PATCH /api/auth/profile:", err);
      return res.status(500).json({ message: "Failed to update user profile" });
    }
  });

  /* Rate limiting for uploads */
  const uploadRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 uploads per window
    message: 'Too many upload attempts, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
  });

  /* Enhanced file validation */
  const validateFileUpload = (req: Request, file: Express.Multer.File): string | null => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxFileSize = 2 * 1024 * 1024; // 2MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.';
    }

    if (file.size > maxFileSize) {
      return 'File size must be less than 2MB.';
    }

    return null;
  };

  /* Upload profile image - with enhanced security */
  app.post("/api/upload",
    uploadRateLimit,
    isAuthenticatedSupabase,
    upload.single("file"),
    async (req, res) => {
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const userId = getUserId(req);
        
        // Enhanced file validation
        const validationError = validateFileUpload(req, req.file);
        if (validationError) {
          fs.unlinkSync(req.file.path); // Delete invalid file
          return res.status(400).json({ message: validationError });
        }

        // Validate that the file belongs to the user
        if (!validateFileOwnership(userId, path.basename(req.file.path))) {
          fs.unlinkSync(req.file.path); // Delete the file
          return res.status(403).json({ message: "Unauthorized file access" });
        }

        // Get the server URL
        const protocol = req.protocol;
        const host = req.get("host");
        
        // Create the file URL with user ID in the path for easy validation
        const fileUrl = `${protocol}://${host}/uploads/${userId}/${path.basename(req.file.path)}`;
        
        // Store file metadata in database
        // await storage.createFileRecord({
        //   userId,
        //   filename: path.basename(req.file.path),
        //   originalName: req.file.originalname,
        //   mimeType: req.file.mimetype,
        //   size: req.file.size,
        //   url: fileUrl
        // });
        
        return res.json({
          url: fileUrl,
          filename: path.basename(req.file.path)
        });
      } catch (err) {
        console.error("POST /api/upload:", err);
        return res.status(500).json({ message: "Failed to upload file" });
      }
    }
  );

  /* Serve uploaded files with user validation */
  app.use("/uploads/:userId", isAuthenticatedSupabase, (req, res, next) => {
    const requestedUserId = req.params.userId;
    const currentUserId = getUserId(req);
    
    // Only allow users to access their own files
    if (requestedUserId !== currentUserId) {
      return res.status(403).json({ message: "Unauthorized file access" });
    }
    
    next();
  }, express.static(uploadDir));

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
      const userId = getUserId(req);
      const block = insertContentBlockSchema.parse(req.body);
      
      // Verify that the journal entry belongs to the current user
      const entry = await storage.getJournalEntryById(block.entryId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      
      // Check ownership
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this journal entry" });
      }
      
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

  // Add route to update content block with ownership validation
  app.patch("/api/content-blocks/:blockId", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);
      const blockId = req.params.blockId;
      
      // Get the content block
      const block = await storage.getContentBlock(blockId);
      if (!block) {
        return res.status(404).json({ message: "Content block not found" });
      }
      
      // Get the journal entry to verify ownership
      const entry = await storage.getJournalEntryById(block.entryId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      
      // Check ownership
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this content block" });
      }
      
      // Parse and validate the updates
      const updateSchema = insertContentBlockSchema.partial().omit({ entryId: true });
      const updates = updateSchema.parse(req.body);
      
      // Update the content block
      const updated = await storage.updateContentBlock(blockId, updates);
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("PATCH /api/content-blocks/:blockId:", err);
      return res.status(500).json({ message: "Failed to update content block" });
    }
  });

  // Add route to delete content block with ownership validation
  app.delete("/api/content-blocks/:blockId", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);
      const blockId = req.params.blockId;
      
      // Get the content block
      const block = await storage.getContentBlock(blockId);
      if (!block) {
        return res.status(404).json({ message: "Content block not found" });
      }
      
      // Get the journal entry to verify ownership
      const entry = await storage.getJournalEntryById(block.entryId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      
      // Check ownership
      if (entry.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized: You don't own this content block" });
      }
      
      // Delete the content block
      await storage.deleteContentBlock(blockId);
      return res.status(204).end();
    } catch (err) {
      console.error("DELETE /api/content-blocks/:blockId:", err);
      return res.status(500).json({ message: "Failed to delete content block" });
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

  /* Username validation endpoints */
  
  /* Check username availability */
  app.get("/api/user/check-username", usernameCheckRateLimit, async (req, res) => {
    try {
      const username = req.query.u as string;
      
      if (!username) {
        return res.status(400).json({
          error: "INVALID_REQUEST",
          message: "Username parameter 'u' is required"
        });
      }

      // Validate the username format and availability
      const validation = await validateUsername(username);
      
      if (validation.isValid) {
        return res.json({
          available: true
        });
      } else {
        // Username is not available or invalid
        return res.json({
          available: false,
          error: validation.error,
          suggestions: validation.suggestions || []
        });
      }
    } catch (err) {
      console.error("GET /api/user/check-username:", err);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to check username availability"
      });
    }
  });

  /* Search users by username */
  app.get("/api/users/search", userSearchRateLimit, isAuthenticatedSupabase, async (req, res) => {
    try {
      const query = req.query.query as string;
      const limitParam = req.query.limit as string;
      
      if (!query) {
        return res.status(400).json({
          error: "INVALID_REQUEST",
          message: "Search query parameter is required"
        });
      }

      if (query.length < 1) {
        return res.status(400).json({
          error: "INVALID_REQUEST", 
          message: "Search query must be at least 1 character"
        });
      }

      // Parse limit with default of 10, max of 10
      let limit = 10;
      if (limitParam) {
        const parsedLimit = parseInt(limitParam, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          limit = Math.min(parsedLimit, 10); // Cap at 10
        }
      }

      // Search for users
      const users = await storage.searchUsersByUsername(query, limit);
      
      // Format response with match type detection
      const results = users.map(user => {
        const matchType = user.username?.toLowerCase() === query.toLowerCase() ? 'exact' : 'prefix';
        return {
          id: user.id,
          username: user.username,
          avatar: null, // TODO: Add avatar support when implemented
          matchType
        };
      });

      return res.json({
        users: results
      });
    } catch (err) {
      console.error("GET /api/users/search:", err);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Failed to search users"
      });
    }
  });

  /* Legacy redirect handlers - prevent 404s from old auth routes */
  app.get('/api/login', (_req, res) => {
    res.redirect('/');
  });

  app.get('/login', (_req, res) => {
    res.redirect('/');
  });

  app.get('/signup', (_req, res) => {
    res.redirect('/');
  });

  app.get('/auth', (_req, res) => {
    res.redirect('/');
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
