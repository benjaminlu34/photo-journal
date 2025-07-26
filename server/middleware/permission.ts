/**
 * Permission middleware for Express endpoints
 * 
 * This middleware integrates the permission resolution system with Express routes
 * to enforce directional role-based access control for journal entries and content blocks.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from "uuid"; // Import uuidv4
import { storage } from '../storage';
import {
  resolveEffectivePermission,
  canEditContentBlock,
  canDeleteContentBlock,
  PermissionContext,
  PermissionResult
} from '../utils/permission-resolver';

// Extend Express Request to include permission context
declare global {
  namespace Express {
    interface Request {
      permissionContext?: PermissionContext;
      permissionResult?: PermissionResult;
    }
  }
}

/**
 * Middleware to resolve permissions for journal entry access
 * Populates req.permissionResult with effective permissions
 */
export async function resolveJournalPermissions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUserId = req.user?.id;

    if (!currentUserId) {
      res.status(401).json({ message: 'Authentication required' });
      return;
    }

    const entryId = req.params.entryId;
    const username = req.params.username;
    
    let entryOwnerId: string;
    let actualEntryId: string;

    if (entryId) {
      const entry = await storage.getJournalEntryById(entryId);
      if (!entry) {
        res.status(404).json({ message: 'Journal entry not found' });
        return;
      }
      entryOwnerId = entry.userId;
      actualEntryId = entry.id;
    } else if (username) {
      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        res.status(404).json({ message: 'User not found' });
        return;
      }
      entryOwnerId = targetUser.id;
      
      const date = new Date(req.params.date);
      if (Number.isNaN(date.getTime())) {
        res.status(400).json({ message: 'Invalid date format' });
        return;
      }
      
      const entry = await storage.getJournalEntry(entryOwnerId, date);
      if (!entry) {
        actualEntryId = `new-entry-${uuidv4()}`;
      } else {
        actualEntryId = entry.id;
      }
    } else {
      res.status(400).json({ message: 'Entry ID or username required' });
      return;
    }

    let friendship;
    if (currentUserId !== entryOwnerId) {
      friendship = await storage.getFriendship(currentUserId, entryOwnerId);
    }

    let sharedEntry;
    if (currentUserId !== entryOwnerId) {
      const sharedEntries = await storage.getSharedEntries(currentUserId);
      sharedEntry = sharedEntries.find(se => se.entryId === actualEntryId);
    }

    const permissionContext: PermissionContext = {
      userId: currentUserId,
      entryOwnerId,
      entryId: actualEntryId,
      friendship,
      sharedEntry,
    };

    const permissionResult = resolveEffectivePermission(permissionContext);

    req.permissionContext = permissionContext;
    req.permissionResult = permissionResult;

    next();
  } catch (error) {
    console.error('Permission resolution error:', error);
    res.status(500).json({ message: 'Failed to resolve permissions' });
    return;
  }
}

/**
 * Middleware to enforce view permissions
 * Must be used after resolveJournalPermissions
 */
export function requireViewPermission(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const permissionResult = req.permissionResult;
  
  if (!permissionResult) {
    res.status(500).json({ message: 'Permission context not resolved' });
    return;
  }

  if (!permissionResult.hasAccess || !permissionResult.canView) {
    res.status(403).json({
      message: 'Access denied: Insufficient permissions to view this entry',
      reason: permissionResult.reason
    });
    return;
  }

  next();
}

/**
 * Middleware to enforce edit permissions
 * Must be used after resolveJournalPermissions
 */
export function requireEditPermission(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const permissionResult = req.permissionResult;
  
  if (!permissionResult) {
    res.status(500).json({ message: 'Permission context not resolved' });
    return;
  }

  if (!permissionResult.hasAccess || !permissionResult.canEdit) {
    res.status(403).json({
      message: 'Access denied: Insufficient permissions to edit this entry',
      reason: permissionResult.reason
    });
    return;
  }

  next();
}

/**
 * Middleware to enforce create permissions
 * Must be used after resolveJournalPermissions
 */
export function requireCreatePermission(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const permissionResult = req.permissionResult;
  
  if (!permissionResult) {
    res.status(500).json({ message: 'Permission context not resolved' });
    return;
  }

  if (!permissionResult.hasAccess || !permissionResult.canCreate) {
    res.status(403).json({
      message: 'Access denied: Insufficient permissions to create content in this entry',
      reason: permissionResult.reason
    });
    return;
  }

  next();
}

/**
 * Middleware to enforce content block edit permissions
 * Checks both global permissions and content block ownership for contributors
 */
export async function requireContentBlockEditPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const permissionResult = req.permissionResult;
    const currentUserId = req.user?.id;
    const blockId = req.params.blockId;
    
    if (!permissionResult || !currentUserId) {
      res.status(500).json({ message: 'Permission context not resolved' });
      return;
    }

    if (!permissionResult.hasAccess) {
      res.status(403).json({
        message: 'Access denied: No access to this entry',
        reason: permissionResult.reason
      });
      return;
    }

    // Get the content block to check ownership
    const contentBlock = await storage.getContentBlock(blockId);
    if (!contentBlock) {
      res.status(404).json({ message: 'Content block not found' });
      return;
    }

    // Check if user can edit this specific content block
    const canEdit = canEditContentBlock(
      permissionResult,
      contentBlock.createdBy,
      currentUserId
    );

    if (!canEdit) {
      res.status(403).json({
        message: 'Access denied: Insufficient permissions to edit this content block',
        reason: permissionResult.effectiveRole === 'contributor'
          ? 'Contributors can only edit content blocks they created'
          : permissionResult.reason
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Content block permission check error:', error);
    res.status(500).json({ message: 'Failed to check content block permissions' });
    return;
  }
}

/**
 * Middleware to enforce content block delete permissions
 * Checks both global permissions and content block ownership for contributors
 */
export async function requireContentBlockDeletePermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const permissionResult = req.permissionResult;
    const currentUserId = req.user?.id;
    const blockId = req.params.blockId;
    
    if (!permissionResult || !currentUserId) {
      res.status(500).json({ message: 'Permission context not resolved' });
      return;
    }

    if (!permissionResult.hasAccess) {
      res.status(403).json({
        message: 'Access denied: No access to this entry',
        reason: permissionResult.reason
      });
      return;
    }

    // Get the content block to check ownership
    const contentBlock = await storage.getContentBlock(blockId);
    if (!contentBlock) {
      res.status(404).json({ message: 'Content block not found' });
      return;
    }

    // Check if user can delete this specific content block
    const canDelete = canDeleteContentBlock(
      permissionResult,
      contentBlock.createdBy,
      currentUserId
    );

    if (!canDelete) {
      res.status(403).json({
        message: 'Access denied: Insufficient permissions to delete this content block',
        reason: permissionResult.effectiveRole === 'contributor'
          ? 'Contributors can only delete content blocks they created'
          : permissionResult.reason
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Content block permission check error:', error);
    res.status(500).json({ message: 'Failed to check content block permissions' });
    return;
  }
}

/**
 * Helper function to check permissions programmatically
 * Useful for WebSocket collaboration and other non-Express contexts
 */
export async function checkJournalPermissions(
  userId: string,
  entryId: string
): Promise<PermissionResult> {
  try {
    // Get the journal entry
    const entry = await storage.getJournalEntryById(entryId);
    if (!entry) {
      return {
        hasAccess: false,
        effectiveRole: null,
        reason: 'Journal entry not found',
        canView: false,
        canEdit: false,
        canCreate: false,
        canDelete: false,
      };
    }

    const entryOwnerId = entry.userId;

    // Get friendship if users are different
    let friendship;
    if (userId !== entryOwnerId) {
      friendship = await storage.getFriendship(userId, entryOwnerId);
    }

    // Get shared entry if exists
    let sharedEntry;
    if (userId !== entryOwnerId) {
      const sharedEntries = await storage.getSharedEntries(userId);
      sharedEntry = sharedEntries.find(se => se.entryId === entryId);
    }

    // Build permission context
    const permissionContext: PermissionContext = {
      userId,
      entryOwnerId,
      entryId,
      friendship,
      sharedEntry,
    };

    // Resolve and return effective permissions
    return resolveEffectivePermission(permissionContext);
  } catch (error) {
    console.error('Permission check error:', error);
    return {
      hasAccess: false,
      effectiveRole: null,
      reason: 'Failed to check permissions',
      canView: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
    };
  }
}