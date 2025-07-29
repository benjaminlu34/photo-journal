import { nanoid } from 'nanoid';
import crypto from 'crypto';

/**
 * Photo storage utilities for deterministic path generation and validation
 */

export interface PhotoUploadMetadata {
  userId: string;
  journalDate: string;
  noteId?: string;
  originalFilename: string;
}

export interface PhotoPathInfo {
  storagePath: string;
  fileName: string;
  directory: string;
}

/**
 * Generate deterministic path structure: userId/yyyy-mm-dd/nanoid.ext
 */
export function generatePhotoPath(metadata: PhotoUploadMetadata): PhotoPathInfo {
  const { userId, journalDate, originalFilename } = metadata;
  
  // Extract file extension
  const extension = getFileExtension(originalFilename);
  
  // Generate unique filename with nanoid
  const fileName = `${nanoid()}.${extension}`;
  
  // Create directory path
  const directory = `${userId}/${journalDate}`;
  
  // Full storage path
  const storagePath = `${directory}/${fileName}`;
  
  return {
    storagePath,
    fileName,
    directory
  };
}

/**
 * Extract and validate file extension
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return 'jpg'; // Default extension
  }
  
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  
  // Map common extensions
  const extensionMap: Record<string, string> = {
    'jpeg': 'jpg',
    'jpg': 'jpg',
    'png': 'png',
    'webp': 'webp',
    'gif': 'gif'
  };
  
  return extensionMap[extension] || 'jpg';
}

/**
 * Validate photo file type and size
 */
export function validatePhotoFile(file: Express.Multer.File): string | null {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/gif'
  ];
  
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.';
  }
  
  if (file.size > maxFileSize) {
    return 'File size must be less than 5MB.';
  }
  
  return null; // Valid file
}

/**
 * Validate file ownership based on storage path
 */
export function validatePhotoOwnership(storagePath: string, userId: string): boolean {
  // Path should start with userId/
  return storagePath.startsWith(`${userId}/`);
}

/**
 * Parse storage path to extract components
 */
export function parsePhotoPath(storagePath: string): {
  userId: string;
  journalDate: string;
  fileName: string;
} | null {
  const pathParts = storagePath.split('/');
  
  if (pathParts.length !== 3) {
    return null;
  }
  
  const [userId, journalDate, fileName] = pathParts;
  
  // Validate date format (yyyy-mm-dd)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(journalDate)) {
    return null;
  }
  
  return {
    userId,
    journalDate,
    fileName
  };
}

/**
 * Generate secure hash for file content validation
 */
export function generateFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Format journal date from Date object to yyyy-mm-dd
 */
export function formatJournalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validate photo access based on ownership and friendship permissions
 * Integrates with the existing friendship permission system
 */
export async function validatePhotoAccess(
  currentUserId: string, 
  photoOwnerId: string, 
  storagePath: string
): Promise<boolean> {
  // Owner always has access
  if (currentUserId === photoOwnerId) {
    return true;
  }
  
  // Import storage dynamically to avoid circular dependencies
  const { storage } = await import('../storage');
  
  // Check if users are friends with accepted status
  const friendship = await storage.getFriendship(currentUserId, photoOwnerId);
  if (!friendship || friendship.status !== 'accepted') {
    return false;
  }
  
  // Use permission resolver to determine access
  const { resolveEffectivePermission } = await import('./permission-resolver');
  
  // For photo access, we need at least viewer permissions
  // Note: We don't have a specific entry ID for photos, so we use a dummy entry
  // The permission system will fall back to friendship-level permissions
  const permissionResult = resolveEffectivePermission({
    userId: currentUserId,
    entryOwnerId: photoOwnerId,
    entryId: 'photo-access', // Dummy entry ID for photo access
    friendship,
    // No shared entry for photos - permissions are based on friendship only
  });
  
  // Allow access if user has at least viewer permissions
  return permissionResult.hasAccess && permissionResult.canView;
}

/**
 * Generate signed URL using Supabase Storage with service role key
 * This allows friend access after permission validation
 */
export async function generateSignedUrlWithServiceRole(
  storagePath: string,
  expiresInSeconds: number = 604800 // 7 days default
): Promise<string | null> {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('Supabase not configured for signed URL generation');
      return null;
    }
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    // Generate signed URL for the journal-images bucket
    const { data, error } = await supabaseAdmin.storage
      .from('journal-images')
      .createSignedUrl(storagePath, expiresInSeconds);
    
    if (error) {
      console.error('Failed to generate signed URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error generating signed URL with service role:', error);
    return null;
  }
}

/**
 * Handle permission changes and URL revocation
 * This can be called when friendship status changes
 */
export async function revokePhotoAccess(
  userId: string,
  photoOwnerId: string
): Promise<void> {
  try {
    // In Supabase Storage, we can't directly revoke signed URLs
    // But we can implement strategies like:
    // 1. Move/rename the file to make existing URLs invalid
    // 2. Use shorter TTL and rely on permission checks on refresh
    // 3. Implement a revocation list in the database
    
    console.log(`Photo access revoked for user ${userId} from owner ${photoOwnerId}`);
    
    // For now, we rely on the permission check in validatePhotoAccess
    // which will prevent new signed URLs from being generated
    
    // Future enhancement: Implement a revocation list in Redis or database
    // to track revoked access and check it during signed URL generation
    
  } catch (error) {
    console.error('Error revoking photo access:', error);
  }
}

/**
 * Handle friendship status changes that affect photo access
 * Called by friendship event handlers
 */
export async function handleFriendshipChange(
  userId: string,
  friendId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  try {
    // If friendship was removed, blocked, or declined, revoke photo access
    const accessRevokingStatuses = ['blocked', 'declined', 'unfriended'];
    
    if (accessRevokingStatuses.includes(newStatus)) {
      // Revoke access in both directions
      await revokePhotoAccess(userId, friendId);
      await revokePhotoAccess(friendId, userId);
      
      console.log(`Photo access revoked between users ${userId} and ${friendId} due to status change: ${oldStatus} -> ${newStatus}`);
    }
    
    // If friendship was accepted, no action needed - access will be granted on next request
    if (newStatus === 'accepted') {
      console.log(`Photo access enabled between users ${userId} and ${friendId} due to friendship acceptance`);
    }
    
  } catch (error) {
    console.error('Error handling friendship change for photo access:', error);
  }
}

/**
 * Clean up database references to a deleted photo
 */
export async function cleanupPhotoReferences(storagePath: string): Promise<void> {
  // Import storage dynamically to avoid circular dependencies
  const { storage } = await import('../storage');
  
  try {
    // Find content blocks that reference this storage path
    const { db } = await import('../db');
    const { contentBlocks } = await import('@shared/schema/schema');
    const { eq } = await import('drizzle-orm');
    
    // Update content blocks to remove storage_path reference
    await db
      .update(contentBlocks)
      .set({ storagePath: null })
      .where(eq(contentBlocks.storagePath, storagePath));
      
    console.log(`Cleaned up database references for photo: ${storagePath}`);
  } catch (error) {
    console.error(`Failed to cleanup database references for ${storagePath}:`, error);
    // Don't throw - deletion should succeed even if cleanup fails
  }
}