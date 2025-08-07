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
import {
  usernameCheckRateLimit,
userSearchRateLimit,
  usernameChangeRateLimit,
  friendRequestRateLimit,
  friendManagementRateLimit,
  sharingRateLimit,
  enhancedFriendMutationsRateLimit,
  enhancedSearchRateLimit,
  enhancedSharingRateLimit,
  calendarOAuthRateLimit,
  roleChangeAuditMiddleware,
  friendshipInputValidation,
  blockedUserSecurityCheck
} from "./middleware/rateLimit";
import { validateUsername, generateUsernameSuggestions } from "./utils/username";
import { validatePhotoOwnership, parsePhotoPath, validatePhotoAccess, cleanupPhotoReferences, generateSignedUrlWithServiceRole, validateFileUpload as validateFileContent } from "./utils/photo-storage";
import {
  resolveJournalPermissions,
  requireViewPermission,
  requireEditPermission,
  requireCreatePermission,
  requireContentBlockEditPermission,
  requireContentBlockDeletePermission
} from "./middleware/permission";

import {
  insertJournalEntrySchema,
  insertContentBlockSchema,
  insertFriendshipSchema,
  insertSharedEntrySchema,
  users,
  usernameSchema,
} from "@shared/schema/schema";

import { friendshipEventManager } from "./utils/friendship-events";
import { encryptToken, decryptToken } from "./utils/token-crypto";
import {
  trackFriendRequestSent,
  trackFriendAccepted,
  trackFriendDeclined,
  trackFriendBlocked,
  trackFriendUnfriended,
  trackFriendRoleChanged
} from "./utils/analytics";
import {
  emitFriendRequestSent,
  emitFriendAccepted,
  emitFriendDeclined,
  emitFriendBlocked,
  emitFriendUnfriended,
  emitFriendRoleChanged
} from "./utils/friendship-events";

// Date formatting utility
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

  /* Google Calendar OAuth endpoints */
  const googleEnvSchema = z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
  });

  let cachedGoogleClient: any | null = null;
  async function getGoogleClient() {
    if (cachedGoogleClient) return cachedGoogleClient;
    const env = googleEnvSchema.parse({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    const openid = await import("openid-client");
    const googleIssuer = await (openid as any).Issuer.discover("https://accounts.google.com");
    cachedGoogleClient = new (googleIssuer as any).Client({
      client_id: env.clientId,
      client_secret: env.clientSecret,
      token_endpoint_auth_method: 'client_secret_post',
    });
    return cachedGoogleClient;
  }

  const exchangeSchema = z.object({
    code: z.string().min(1),
    redirectUri: z.string().url(),
  });

  app.post(
    "/api/calendar/google/exchange-token",
    isAuthenticatedSupabase,
    calendarOAuthRateLimit,
    async (req, res) => {
      try {
        const { code, redirectUri } = exchangeSchema.parse(req.body);
        const client = await getGoogleClient();

        // Authorization Code exchange (no PKCE for server-side exchange)
        const tokenSet = await client.grant({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        } as any);

        const accessToken = tokenSet.access_token;
        const refreshToken = tokenSet.refresh_token || undefined;
        const expiresIn = tokenSet.expires_in || 3600; // default 1h if absent

        if (!accessToken) {
          return res.status(502).json({ message: "Google token exchange did not return access token" });
        }

        // Bind token to user via AAD to mitigate token swapping between users
        const userBoundAAD = getUserId(req);
        const encryptedToken = encryptToken(accessToken, userBoundAAD);
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        return res.json({ encryptedToken, refreshToken, expiresAt });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid request", errors: err.errors });
        }
        console.error("POST /api/calendar/google/exchange-token:", err);
        return res.status(502).json({ message: "Failed to exchange Google auth code" });
      }
    }
  );

  const refreshSchema = z.object({
    refreshToken: z.string().min(1),
  });

  app.post(
    "/api/calendar/google/refresh-token",
    isAuthenticatedSupabase,
    calendarOAuthRateLimit,
    async (req, res) => {
      try {
        const { refreshToken } = refreshSchema.parse(req.body);
        const client = await getGoogleClient();

        const tokenSet = await client.grant({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        } as any);

        const accessToken = tokenSet.access_token;
        const newRefreshToken = tokenSet.refresh_token || undefined; // Google may rotate
        const expiresIn = tokenSet.expires_in || 3600;

        if (!accessToken) {
          return res.status(502).json({ message: "Google refresh did not return access token" });
        }

        const userBoundAAD = getUserId(req);
        const encryptedToken = encryptToken(accessToken, userBoundAAD);
        const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

        return res.json({ encryptedToken, refreshToken: newRefreshToken, expiresAt });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid request", errors: err.errors });
        }
        console.error("POST /api/calendar/google/refresh-token:", err);
        return res.status(502).json({ message: "Failed to refresh Google token" });
      }
    }
  );

  const decryptSchema = z.object({
    encryptedToken: z.string().min(1),
  });

  app.post(
    "/api/calendar/google/decrypt-token",
    isAuthenticatedSupabase,
    calendarOAuthRateLimit,
    async (req, res) => {
      try {
        const { encryptedToken } = decryptSchema.parse(req.body);
        const userBoundAAD = getUserId(req);
        const accessToken = decryptToken(encryptedToken, userBoundAAD);
        // Return short-lived access token (Google enforces expiry)
        return res.json({ accessToken });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid request", errors: err.errors });
        }
        console.error("POST /api/calendar/google/decrypt-token:", err);
        return res.status(400).json({ message: "Failed to decrypt token" });
      }
    }
  );

  /* Update user profile */
  app.patch("/api/auth/profile", isAuthenticatedSupabase, async (req, res, next) => {
    try {
      const userId = getUserId(req);

      // Create a schema for profile updates using shared validation
      const updateProfileSchema = z.object({
        firstName: z.string().min(0).optional(), // Allow empty strings
        lastName: z.string().min(0).optional(),  // Allow empty strings
        // profileImageUrl: z.string().optional(), // Profile images not yet implemented
        username: usernameSchema.optional(), // Use shared schema with case normalization
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
          await fs.promises.unlink(req.file.path); // Delete invalid file
          return res.status(400).json({ message: validationError });
        }

        // Validate that the file belongs to the user
        if (!validateFileOwnership(userId, path.basename(req.file.path))) {
          await fs.promises.unlink(req.file.path); // Delete the file
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

  /* Photo upload endpoint for journal images */
  app.post("/api/photos/upload",
    uploadRateLimit,
    isAuthenticatedSupabase,
    upload.single("photo"),
    async (req, res) => {
      try {

        if (!req.file) {
          return res.status(400).json({ message: "No photo uploaded" });
        }

        const userId = getUserId(req);
        const { journalDate, noteId } = req.body;

        // Validate required fields
        if (!journalDate) {
          await fs.promises.unlink(req.file.path);
          return res.status(400).json({ message: "Journal date is required" });
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(journalDate)) {
          await fs.promises.unlink(req.file.path);
          return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
        }

        // Enhanced file validation with magic number checking
        const validationBuffer = await fs.promises.readFile(req.file.path);
        const validationResult = await validateFileContent(req.file, validationBuffer);
        
        if (!validationResult.isValid) {
          await fs.promises.unlink(req.file.path);
          return res.status(400).json({ message: validationResult.error });
        }
        

        // Generate deterministic storage path
        const { generatePhotoPath, formatJournalDate } = await import('./utils/photo-storage');
        const pathInfo = generatePhotoPath({
          userId,
          journalDate,
          noteId,
          originalFilename: req.file.originalname
        });

        // Upload to Supabase Storage
        const { createClient } = await import('@supabase/supabase-js');
        const { getServerStorageConfig } = await import('./config/photo-storage-server');

        const config = getServerStorageConfig();
        const supabaseAdmin = createClient(config.supabaseUrl, config.serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Read file buffer for upload
        const fileBuffer = await fs.promises.readFile(req.file.path);

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(config.bucketName)
          .upload(pathInfo.storagePath, fileBuffer, {
            contentType: req.file.mimetype,
            upsert: true
          });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          // Clean up local file
          await fs.promises.unlink(req.file.path);
          return res.status(500).json({ message: "Failed to upload to storage" });
        }

        // Generate signed URL for immediate access
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
          .from(config.bucketName)
          .createSignedUrl(pathInfo.storagePath, config.signedUrlTtlSeconds);

        if (signedUrlError) {
          console.error('Signed URL generation error:', signedUrlError);
          // Clean up local file
          await fs.promises.unlink(req.file.path);
          return res.status(500).json({ message: "Failed to generate access URL" });
        }

        // Clean up local temporary file
        await fs.promises.unlink(req.file.path);

        return res.status(201).json({
          url: signedUrlData.signedUrl,
          storagePath: pathInfo.storagePath,
          size: req.file.size,
          mimeType: req.file.mimetype,
          fileName: pathInfo.fileName
        });
      } catch (err) {
        console.error("POST /api/photos/upload:", err);
        if (req.file) {
          await fs.promises.unlink(req.file.path); // Clean up on error
        }
        return res.status(500).json({ message: "Failed to upload photo" });
      }
    }
  );

  /* Generate signed URL for photo access */
  app.get("/api/photos/:path(*)/signed-url",
    isAuthenticatedSupabase,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const storagePath = req.params.path;

        // Parse and validate storage path
        const pathInfo = parsePhotoPath(storagePath);
        if (!pathInfo) {
          return res.status(400).json({ message: "Invalid storage path format" });
        }

        // Check if user owns the photo or has permission through friendship
        const hasAccess = await validatePhotoAccess(currentUserId, pathInfo.userId, storagePath);
        
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied to this photo" });
        }

        // Get TTL from environment or use default (7 days)
        const ttlSeconds = parseInt(process.env.SIGNED_URL_TTL_SECONDS || '604800'); // 7 days

        // Generate signed URL from Supabase Storage using service role key
        const signedUrl = await generateSignedUrlWithServiceRole(storagePath, ttlSeconds);

        if (!signedUrl) {
          // Fallback to local URL if Supabase is not configured
          const protocol = req.protocol;
          const host = req.get("host");
          const tempUrl = `${protocol}://${host}/uploads/${storagePath}`;

          return res.json({
            signedUrl: tempUrl,
            expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
            storagePath
          });
        }

        return res.json({
          signedUrl,
          expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
          storagePath
        });
      } catch (err) {
        console.error("GET /api/photos/:path/signed-url:", err);
        return res.status(500).json({ message: "Failed to generate signed URL" });
      }
    }
  );

  /* Delete photo from storage */
  app.delete("/api/photos/:path(*)",
    isAuthenticatedSupabase,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const storagePath = req.params.path;

        // Parse and validate storage path
        const pathInfo = parsePhotoPath(storagePath);
        if (!pathInfo) {
          return res.status(400).json({ message: "Invalid storage path format" });
        }

        // Validate ownership - only owner can delete photos
        const isOwner = validatePhotoOwnership(storagePath, currentUserId);
        
        if (!isOwner) {
          return res.status(403).json({ message: "Access denied. You can only delete your own photos." });
        }

        // Delete from Supabase Storage
        const { createClient } = await import('@supabase/supabase-js');
        const { getServerStorageConfig } = await import('./config/photo-storage-server');

        const config = getServerStorageConfig();
        const supabaseAdmin = createClient(config.supabaseUrl, config.serviceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        });

        // Delete from Supabase Storage
        const { error: deleteError } = await supabaseAdmin.storage
          .from(config.bucketName)
          .remove([storagePath]);

        if (deleteError) {
          console.error('Supabase delete error:', deleteError);
          return res.status(500).json({ message: "Failed to delete from storage" });
        }

        // Also try to delete from local storage if it exists (cleanup)
        const localFilePath = path.join(uploadDir, storagePath);
        try {
          await fs.promises.unlink(localFilePath);
        } catch (unlinkError) {
          // Ignore errors when deleting local files that might not exist
          console.log('Local file cleanup skipped:', unlinkError);
        }

        // Clean up database references
        await cleanupPhotoReferences(storagePath);

        return res.status(204).end();
      } catch (err) {
        console.error("DELETE /api/photos/:path:", err);
        return res.status(500).json({ message: "Failed to delete photo" });
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

  /* Username-based journal entry access */
  app.get("/api/journal/user/:username/:date", isAuthenticatedSupabase, resolveJournalPermissions, requireViewPermission, async (req, res) => {
    try {
      const currentUserId = getUserId(req);
      const { username, date } = req.params;

      // Validate date format
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // Find user by username
      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get the journal entry
      let entry = await storage.getJournalEntry(targetUser.id, parsedDate);

      // If the user is viewing their own journal, create the entry if it doesn't exist
      if (!entry && targetUser.id === currentUserId) {
        entry = await storage.createJournalEntry({ userId: targetUser.id, date: parsedDate, title: null });
      } else if (!entry) {
        // If viewing a friend's journal and no entry exists, create a temporary one
        entry = {
          id: uuidv4(), // Generate a new ID for a temporary entry
          userId: targetUser.id,
          date: parsedDate,
          title: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const blocks = await storage.getContentBlocks(entry.id);

      return res.json({
        ...entry,
        contentBlocks: blocks,
        owner: {
          id: targetUser.id,
          username: targetUser.username,
          firstName: targetUser.firstName,
          lastName: targetUser.lastName
        },
        permissions: {
          canEdit: req.permissionResult?.canEdit || false,
          canCreate: req.permissionResult?.canCreate || false,
          canDelete: req.permissionResult?.canDelete || false,
          effectiveRole: req.permissionResult?.effectiveRole || null
        }
      });
    } catch (err) {
      console.error("GET /api/journal/user/:username/:date:", err);
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
  app.post("/api/content-blocks", isAuthenticatedSupabase, resolveJournalPermissions, requireCreatePermission, async (req, res) => {
    try {
      const userId = getUserId(req);
      const block = insertContentBlockSchema.parse(req.body);

      // Verify that the journal entry belongs to the current user or is accessible
      const entry = await storage.getJournalEntryById(block.entryId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      // Create content block with created_by field
      const created = await storage.createContentBlock({
        ...block,
        createdBy: userId
      });
      return res.json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: err.errors });
      }
      console.error("POST /api/content-blocks:", err);
      return res.status(500).json({ message: "Failed to create content block" });
    }
  });

  // Add route to update content block with permission validation
  app.patch("/api/content-blocks/:blockId", isAuthenticatedSupabase, resolveJournalPermissions, requireContentBlockEditPermission, async (req, res) => {
    try {
      const userId = getUserId(req);
      const blockId = req.params.blockId;

      // Parse and validate the updates
      const updateSchema = insertContentBlockSchema.partial().omit({ entryId: true, createdBy: true });
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

  // Add route to delete content block with permission validation
  app.delete("/api/content-blocks/:blockId", isAuthenticatedSupabase, resolveJournalPermissions, requireContentBlockDeletePermission, async (req, res) => {
    try {
      const userId = getUserId(req);
      const blockId = req.params.blockId;

      // Delete the content block
      await storage.deleteContentBlock(blockId);
      return res.status(204).end();
    } catch (err) {
      console.error("DELETE /api/content-blocks/:blockId:", err);
      return res.status(500).json({ message: "Failed to delete content block" });
    }
  });

  /* Friend Management API Endpoints */

  /* Send friend request by username */
  app.post("/api/friends/:username/request",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    blockedUserSecurityCheck,
    enhancedFriendMutationsRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { username } = req.params;

        // Find target user by username
        const targetUser = await storage.getUserByUsername(username);
        if (!targetUser) {
          return res.status(404).json({ message: "User not found" });
        }

        // Prevent self-friendship
        if (targetUser.id === currentUserId) {
          return res.status(400).json({ message: "Cannot send friend request to yourself" });
        }

        // Check if user can send friend request (cooldown validation)
        const canSend = await storage.canSendFriendRequestTo(currentUserId, targetUser.id);
        if (!canSend) {
          const existingFriendship = await storage.getFriendship(currentUserId, targetUser.id);
          if (existingFriendship?.status === 'blocked') {
            return res.status(403).json({ message: "Cannot send friend request to blocked user" });
          } else if (existingFriendship?.status === 'pending') {
            return res.status(409).json({ message: "Friend request already pending" });
          } else if (existingFriendship?.status === 'accepted') {
            return res.status(409).json({ message: "Already friends with this user" });
          } else {
            return res.status(429).json({
              message: "Must wait 24 hours before sending another friend request to this user",
              retryAfter: 86400 // 24 hours in seconds
            });
          }
        }

        // Create friendship with canonical ordering and initiator tracking
        const friendship = await storage.createFriendshipWithCanonicalOrdering(
          currentUserId,
          targetUser.id,
          currentUserId
        );

        // Get current user info for events
        const currentUser = await storage.getUser(currentUserId);

        // Emit real-time event and track analytics
        emitFriendRequestSent(
          currentUserId,
          targetUser.id,
          friendship.id,
          {
            username: targetUser.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendRequestSent(
          currentUserId,
          targetUser.id,
          {
            senderUsername: currentUser?.username || undefined,
            receiverUsername: targetUser.username || undefined,
            source: 'username_search'
          }
        );

        return res.status(201).json({
          id: friendship.id,
          status: friendship.status,
          targetUser: {
            id: targetUser.id,
            username: targetUser.username,
            firstName: targetUser.firstName,
            lastName: targetUser.lastName
          },
          createdAt: friendship.createdAt
        });
      } catch (err) {
        console.error("POST /api/friends/:username/request:", err);
        return res.status(500).json({ message: "Failed to send friend request" });
      }
    });

  /* Accept friend request */
  app.patch("/api/friends/:friendshipId/accept",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedFriendMutationsRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { friendshipId } = req.params;

        // Get friendship to validate
        const friendship = await storage.getFriendshipById(friendshipId);
        if (!friendship) {
          return res.status(404).json({ message: "Friend request not found" });
        }

        // Verify user is part of this friendship and not the initiator
        if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
          return res.status(403).json({ message: "Not authorized to accept this friend request" });
        }

        // Prevent initiator from accepting their own request
        if (friendship.initiatorId === currentUserId) {
          return res.status(400).json({ message: "Cannot accept your own friend request" });
        }

        // Verify friendship is in pending status
        if (friendship.status !== 'pending') {
          return res.status(400).json({ message: `Cannot accept friend request with status: ${friendship.status}` });
        }

        // Update friendship status to accepted
        const updatedFriendship = await storage.updateFriendshipStatusWithAudit(
          friendshipId,
          'accepted',
          currentUserId
        );

        // Get friend user info for response
        const friendId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
        const friendUser = await storage.getUser(friendId);
        const currentUser = await storage.getUser(currentUserId);

        // Calculate time to accept (if we have creation timestamp)
        const timeToAccept = friendship.createdAt ?
          Date.now() - friendship.createdAt.getTime() : undefined;

        // Emit real-time event and track analytics
        emitFriendAccepted(
          currentUserId,
          friendId,
          friendshipId,
          {
            username: friendUser?.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendAccepted(
          currentUserId,
          friendId,
          {
            accepterUsername: currentUser?.username || undefined,
            requesterUsername: friendUser?.username || undefined,
            timeToAccept
          }
        );

        return res.json({
          id: updatedFriendship.id,
          status: updatedFriendship.status,
          friend: friendUser ? {
            id: friendUser.id,
            username: friendUser.username,
            firstName: friendUser.firstName,
            lastName: friendUser.lastName
          } : null,
          updatedAt: updatedFriendship.updatedAt
        });
      } catch (err) {
        console.error("PATCH /api/friends/:friendshipId/accept:", err);
        return res.status(500).json({ message: "Failed to accept friend request" });
      }
    });

  /* Decline friend request */
  app.patch("/api/friends/:friendshipId/decline",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedFriendMutationsRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { friendshipId } = req.params;

        // Get friendship to validate
        const friendship = await storage.getFriendshipById(friendshipId);
        if (!friendship) {
          return res.status(404).json({ message: "Friend request not found" });
        }

        // Verify user is part of this friendship and not the initiator
        if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
          return res.status(403).json({ message: "Not authorized to decline this friend request" });
        }

        // Prevent initiator from declining their own request
        if (friendship.initiatorId === currentUserId) {
          return res.status(400).json({ message: "Cannot decline your own friend request" });
        }

        // Verify friendship is in pending status
        if (friendship.status !== 'pending') {
          return res.status(400).json({ message: `Cannot decline friend request with status: ${friendship.status}` });
        }

        // Update friendship status to declined
        const updatedFriendship = await storage.updateFriendshipStatusWithAudit(
          friendshipId,
          'declined',
          currentUserId
        );

        // Get friend user info for events
        const friendId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
        const friendUser = await storage.getUser(friendId);
        const currentUser = await storage.getUser(currentUserId);

        // Calculate time to decline (if we have creation timestamp)
        const timeToDecline = friendship.createdAt ?
          Date.now() - friendship.createdAt.getTime() : undefined;

        // Emit real-time event and track analytics
        emitFriendDeclined(
          currentUserId,
          friendId,
          friendshipId,
          {
            username: friendUser?.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendDeclined(
          currentUserId,
          friendId,
          {
            declinerUsername: currentUser?.username || undefined,
            requesterUsername: friendUser?.username || undefined,
            timeToDecline
          }
        );

        return res.json({
          id: updatedFriendship.id,
          status: updatedFriendship.status,
          updatedAt: updatedFriendship.updatedAt
        });
      } catch (err) {
        console.error("PATCH /api/friends/:friendshipId/decline:", err);
        return res.status(500).json({ message: "Failed to decline friend request" });
      }
    });

  /* Block user */
  app.patch("/api/friends/:friendshipId/block",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedFriendMutationsRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { friendshipId } = req.params;

        // Get friendship to validate
        const friendship = await storage.getFriendshipById(friendshipId);
        if (!friendship) {
          return res.status(404).json({ message: "Friendship not found" });
        }

        // Verify user is part of this friendship
        if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
          return res.status(403).json({ message: "Not authorized to block this user" });
        }

        // Block is allowed from any status except already blocked
        if (friendship.status === 'blocked') {
          return res.status(400).json({ message: "User is already blocked" });
        }

        // Update friendship status to blocked
        const updatedFriendship = await storage.updateFriendshipStatusWithAudit(
          friendshipId,
          'blocked',
          currentUserId
        );

        // Get friend user info for events
        const friendId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
        const friendUser = await storage.getUser(friendId);
        const currentUser = await storage.getUser(currentUserId);

        // Emit real-time event and track analytics
        emitFriendBlocked(
          currentUserId,
          friendId,
          friendshipId,
          {
            username: friendUser?.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendBlocked(
          currentUserId,
          friendId,
          {
            blockerUsername: currentUser?.username || undefined,
            blockedUsername: friendUser?.username || undefined,
            previousStatus: friendship.status
          }
        );

        return res.json({
          id: updatedFriendship.id,
          status: updatedFriendship.status,
          updatedAt: updatedFriendship.updatedAt
        });
      } catch (err) {
        console.error("PATCH /api/friends/:friendshipId/block:", err);
        return res.status(500).json({ message: "Failed to block user" });
      }
    });

  /* Update friend role (directional role management) */
  app.patch("/api/friends/:friendshipId/role",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    roleChangeAuditMiddleware,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { friendshipId } = req.params;

        // Validate request body
        const roleSchema = z.object({
          role: z.enum(['viewer', 'contributor', 'editor'])
        });

        const { role } = roleSchema.parse(req.body);

        // Get friendship to validate
        const friendship = await storage.getFriendshipById(friendshipId);
        if (!friendship) {
          return res.status(404).json({ message: "Friendship not found" });
        }

        // Verify user is part of this friendship
        if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
          return res.status(403).json({ message: "Not authorized to update role for this friendship" });
        }

        // Only allow role updates for accepted friendships
        if (friendship.status !== 'accepted') {
          return res.status(400).json({ message: "Can only update roles for accepted friendships" });
        }

        // Get old role before updating
        const oldRole = currentUserId === friendship.userId ?
          friendship.roleUserToFriend : friendship.roleFriendToUser;

        // Update the friendship role (directional)
        const updatedFriendship = await storage.updateFriendshipRole(
          friendshipId,
          currentUserId,
          role
        );

        // Get friend user info for response
        const friendId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
        const friendUser = await storage.getUser(friendId);
        const currentUser = await storage.getUser(currentUserId);

        // Emit real-time event and track analytics
        emitFriendRoleChanged(
          currentUserId,
          friendId,
          friendshipId,
          oldRole || 'viewer', // Default to viewer if null
          role,
          {
            username: friendUser?.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendRoleChanged(
          currentUserId,
          friendId,
          oldRole || 'viewer', // Default to viewer if null
          role,
          {
            changerUsername: currentUser?.username || undefined,
            friendUsername: friendUser?.username || undefined,
            context: 'individual_change'
          }
        );

        return res.json({
          id: updatedFriendship.id,
          status: updatedFriendship.status,
          roleUserToFriend: updatedFriendship.roleUserToFriend,
          roleFriendToUser: updatedFriendship.roleFriendToUser,
          friend: friendUser ? {
            id: friendUser.id,
            username: friendUser.username,
            firstName: friendUser.firstName,
            lastName: friendUser.lastName
          } : null,
          updatedAt: updatedFriendship.updatedAt
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid role", errors: err.errors });
        }
        console.error("PATCH /api/friends/:friendshipId/role:", err);
        return res.status(500).json({ message: "Failed to update friend role" });
      }
    });

  /* Unfriend user (soft delete to 'unfriended' status) */
  app.delete("/api/friends/:friendshipId",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedFriendMutationsRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { friendshipId } = req.params;

        // Get friendship to validate
        const friendship = await storage.getFriendshipById(friendshipId);
        if (!friendship) {
          return res.status(404).json({ message: "Friendship not found" });
        }

        // Verify user is part of this friendship
        if (friendship.userId !== currentUserId && friendship.friendId !== currentUserId) {
          return res.status(403).json({ message: "Not authorized to unfriend this user" });
        }

        // Only allow unfriending accepted friendships
        if (friendship.status !== 'accepted') {
          return res.status(400).json({ message: "Can only unfriend accepted friendships" });
        }

        // Update friendship status to unfriended (soft delete)
        const updatedFriendship = await storage.updateFriendshipStatusWithAudit(
          friendshipId,
          'unfriended',
          currentUserId
        );

        // Get friend user info for events
        const friendId = friendship.userId === currentUserId ? friendship.friendId : friendship.userId;
        const friendUser = await storage.getUser(friendId);
        const currentUser = await storage.getUser(currentUserId);

        // Calculate friendship duration (if we have creation timestamp)
        const friendshipDuration = friendship.createdAt ?
          Date.now() - friendship.createdAt.getTime() : undefined;

        // Emit real-time event and track analytics
        emitFriendUnfriended(
          currentUserId,
          friendId,
          friendshipId,
          {
            username: friendUser?.username || undefined,
            avatar: undefined // Profile images not yet implemented
          }
        );

        trackFriendUnfriended(
          currentUserId,
          friendId,
          {
            unfrienderUsername: currentUser?.username || undefined,
            unfriendedUsername: friendUser?.username || undefined,
            friendshipDuration
          }
        );

        // Return 200 with JSON (not 204) as specified in requirements
        return res.status(200).json({
          id: updatedFriendship.id,
          status: updatedFriendship.status,
          message: "Successfully unfriended user",
          updatedAt: updatedFriendship.updatedAt
        });
      } catch (err) {
        console.error("DELETE /api/friends/:friendshipId:", err);
        return res.status(500).json({ message: "Failed to unfriend user" });
      }
    });

  /* Legacy Friendships endpoint (kept for backward compatibility) */
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

  /* Friend List and Request Management Endpoints */

  /* Get friends list with pagination and role information */
  app.get("/api/friends", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Parse pagination parameters
      const limitParam = req.query.limit as string;
      const offsetParam = req.query.offset as string;

      const limit = Math.min(parseInt(limitParam) || 50, 100); // Cap at 100
      const offset = Math.max(parseInt(offsetParam) || 0, 0);

      const { friends, totalCount } = await storage.getFriendsWithRoles(userId, {
        limit,
        offset,
      });

      // Transform friends to include profile picture compatibility
      const transformedFriends = friends.map(friend => ({
        id: friend.id,
        friendshipId: friend.friendshipId, // Include friendship ID for role management
        username: friend.username || '',
        firstName: friend.firstName || '',
        lastName: friend.lastName || '',
        avatar: undefined, // Profile pictures not yet implemented
        status: 'accepted' as const,
        roleUserToFriend: friend.roleUserToFriend as 'viewer' | 'contributor' | 'editor',
        roleFriendToUser: friend.roleFriendToUser as 'viewer' | 'contributor' | 'editor',
        currentUserRole: friend.currentUserRole as 'viewer' | 'contributor' | 'editor',
        createdAt: friend.createdAt ? friend.createdAt.toISOString() : new Date().toISOString(),
        lastActivity: friend.updatedAt ? friend.updatedAt.toISOString() : new Date().toISOString(),
      }));

      return res.json({
        friends: transformedFriends,
        pagination: {
          limit,
          offset,
          totalCount,
          hasMore: offset + limit < totalCount,
        },
      });
    } catch (err) {
      console.error("GET /api/friends:", err);
      return res.status(500).json({ message: "Failed to fetch friends list" });
    }
  });

  /* Get friend requests (sent and received) */
  app.get("/api/friends/requests", isAuthenticatedSupabase, async (req, res) => {
    try {
      const userId = getUserId(req);

      // Parse pagination parameters
      const limitParam = req.query.limit as string;
      const offsetParam = req.query.offset as string;

      const limit = Math.min(parseInt(limitParam) || 50, 100); // Cap at 100
      const offset = Math.max(parseInt(offsetParam) || 0, 0);

      const { sent, received, totalCount } = await storage.getFriendRequests(userId, {
        limit,
        offset,
      });

      // Transform sent requests to match frontend FriendRequest interface
      const transformedSent = sent.map(item => ({
        id: item.id,
        username: item.friend.username || '',
        firstName: item.friend.firstName,
        lastName: item.friend.lastName,
        avatar: null, // Profile images not yet implemented
        status: 'pending' as const,
        direction: 'sent' as const,
        createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
        initiatorId: item.initiatorId || '',
        friend: item.friend, // Include the full friend object for tests
      }));

      // Transform received requests to match frontend FriendRequest interface
      const transformedReceived = received.map(item => ({
        id: item.id,
        username: item.user.username || '',
        firstName: item.user.firstName,
        lastName: item.user.lastName,
        avatar: null, // Profile images not yet implemented
        status: 'pending' as const,
        direction: 'received' as const,
        createdAt: item.createdAt?.toISOString() || new Date().toISOString(),
        initiatorId: item.initiatorId || '',
        user: item.user, // Include the full user object for tests
      }));

      return res.json({
        sent: transformedSent,
        received: transformedReceived,
        pagination: {
          totalCount,
        },
      });
    } catch (err) {
      console.error("GET /api/friends/requests:", err);
      return res.status(500).json({ message: "Failed to fetch friend requests" });
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

  /* Journal sharing with friends */
  app.post("/api/journal/:entryId/share",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedSharingRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { entryId } = req.params;

        // Validate request body
        const shareSchema = z.object({
          friendUsername: z.string().min(1, "Friend username is required"),
          permissions: z.enum(['view', 'edit'])
        });

        const { friendUsername, permissions } = shareSchema.parse(req.body);

        // Verify the journal entry belongs to the current user
        const entry = await storage.getJournalEntryById(entryId);
        if (!entry) {
          return res.status(404).json({ message: "Journal entry not found" });
        }

        if (entry.userId !== currentUserId) {
          return res.status(403).json({ message: "You can only share your own journal entries" });
        }

        // Share entry with friend
        const sharedEntry = await storage.shareEntryWithFriend(
          entryId,
          currentUserId,
          friendUsername,
          permissions
        );

        // Get friend details for response
        const friend = await storage.getUserByUsername(friendUsername);

        return res.status(201).json({
          id: sharedEntry.id,
          entryId: sharedEntry.entryId,
          permissions: sharedEntry.permissions,
          sharedWith: {
            id: friend?.id,
            username: friend?.username,
            firstName: friend?.firstName,
            lastName: friend?.lastName
          },
          createdAt: sharedEntry.createdAt
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return res.status(400).json({ message: "Invalid data", errors: err.errors });
        }
        if (err instanceof Error && err.message === 'Friend not found') {
          return res.status(404).json({ message: "Friend not found" });
        }
        if (err instanceof Error && err.message === 'Friendship not found or not accepted') {
          return res.status(403).json({ message: "You can only share with accepted friends" });
        }
        console.error("POST /api/journal/:entryId/share:", err);
        return res.status(500).json({ message: "Failed to share journal entry" });
      }
    });

  /* Revoke journal sharing */
  app.delete("/api/journal/:entryId/share/:friendUsername",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedSharingRateLimit,
    async (req, res) => {
      try {
        const currentUserId = getUserId(req);
        const { entryId, friendUsername } = req.params;

        // Verify the journal entry belongs to the current user
        const entry = await storage.getJournalEntryById(entryId);
        if (!entry) {
          return res.status(404).json({ message: "Journal entry not found" });
        }

        if (entry.userId !== currentUserId) {
          return res.status(403).json({ message: "You can only revoke sharing of your own journal entries" });
        }

        // Revoke sharing
        await storage.revokeEntrySharing(entryId, currentUserId, friendUsername);

        return res.status(200).json({
          message: "Successfully revoked sharing with friend",
          entryId,
          friendUsername
        });
      } catch (err) {
        if (err instanceof Error && err.message === 'Friend not found') {
          return res.status(404).json({ message: "Friend not found" });
        }
        console.error("DELETE /api/journal/:entryId/share/:friendUsername:", err);
        return res.status(500).json({ message: "Failed to revoke sharing" });
      }
    });

  /* Get shared entries for a journal entry */
  app.get("/api/journal/:entryId/shares", isAuthenticatedSupabase, async (req, res) => {
    try {
      const currentUserId = getUserId(req);
      const { entryId } = req.params;

      // Verify the journal entry belongs to the current user
      const entry = await storage.getJournalEntryById(entryId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }

      if (entry.userId !== currentUserId) {
        return res.status(403).json({ message: "You can only view shares of your own journal entries" });
      }

      // Get shared entries
      const sharedEntries = await storage.getSharedEntriesForEntry(entryId);

      return res.json({
        shares: sharedEntries,
        count: sharedEntries.length
      });
    } catch (err) {
      console.error("GET /api/journal/:entryId/shares:", err);
      return res.status(500).json({ message: "Failed to get shared entries" });
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

  /* Search users by username with friendship status */
  app.get("/api/users/search",
    isAuthenticatedSupabase,
    friendshipInputValidation,
    enhancedSearchRateLimit,
    async (req, res) => {
      try {
        const query = req.query.query as string;
        const limitParam = req.query.limit as string;
        const friendsOnlyParam = req.query.friendsOnly as string;

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

        // Parse friendsOnly parameter
        const friendsOnly = friendsOnlyParam === 'true';

        const currentUserId = getUserId(req);

        // Use enhanced search with friendship status
        const users = await storage.searchUsersByUsernameWithFriendshipStatus(
          currentUserId,
          query,
          { limit, friendsOnly }
        );

        // Format response with match type detection and friendship status
        const results = users.map(user => {
          const matchType = user.username?.toLowerCase() === query.toLowerCase() ? 'exact' : 'prefix';

          // Create friendship object if friendship exists
          const friendship = user.friendshipStatus ? {
            id: user.friendshipId,
            status: user.friendshipStatus,
            userId: currentUserId < user.id ? currentUserId : user.id,
            friendId: currentUserId < user.id ? user.id : currentUserId,
            initiatorId: user.initiatorId || null,
            roleUserToFriend: user.roleUserToFriend || 'viewer',
            roleFriendToUser: user.roleFriendToUser || 'viewer'
          } : null;

          return {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
            avatar: null, // Profile images not yet implemented in schema
            matchType,
            friendship
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

  /* Legacy user ID route redirects - 302 redirects to username-based URLs */
  app.get('/user/:userId/:date?', async (req, res) => {
    try {
      const { userId, date } = req.params;

      // Get user by ID to find their username
      const user = await storage.getUser(userId);
      if (!user || !user.username) {
        return res.status(404).json({ message: "User not found or username not available" });
      }

      // Construct the new username-based URL
      const redirectUrl = date
        ? `/@${user.username}/${date}`
        : `/@${user.username}/${formatLocalDate(new Date())}`;

      // 302 redirect to username-based URL
      return res.redirect(302, redirectUrl);
    } catch (err) {
      console.error("GET /user/:userId/:date redirect error:", err);
      return res.status(500).json({ message: "Failed to redirect to username-based URL" });
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

  // Initialize WebSocket server for friendship events
  friendshipEventManager.initialize(server);

  return server;
}

