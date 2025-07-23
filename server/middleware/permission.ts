/**
 * Permission middleware for Express endpoints
 * 
 * This middleware integrates the permission resolution system with Express routes
 * to enforce directional role-based access control for journal entries and content blocks.
 */

import { Request, Response, NextFunction } from 'express';
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
      return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract entry information from route parameters
    const entryId = req.params.entryId;
    const username = req.params.username;
    
    let entryOwnerId: string;
    let actualEntryId: string;

    if (entryId) {
      // Direct entry ID access
      const entry = await storage.getJournalEntryById(entryId);
      if (!entry) {
        return res.status(404).json({ message: 'Journal entry not found' });
      }
      entryOwnerId = entry.userId;
      actualEntryId = entry.id;
    } else if (username) {
      // Username-based access
      const targetUser = await storage.getUserByUsername(username);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      entryOwnerId = targetUser.id;
      
      // For username-based access, we might need to create the entry
      const date = new Date(req.params.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      
      let entry = await storage.getJournalEntry(entryOwnerId, date);
      if (!entry) {
        // Only create entry if user is the owner or has contributor+ permissions
        if (currentUserId === entryOwnerId) {
          entry = await storage.createJournalEntry({ 
            userId: entryOwnerId, 
            date, 
            title: null 
          });
        } else {
          return res.status(404).json({ message: 'Journal entry not found' });
        }
      }
      actualEntryId = entry.id;
    } else {
      return res.status(400).json({ message: 'Entry ID or username required' });
    }

    // Get friendship if users are different
    let friendship;
    if (currentUserId !== entryOwnerId) {
      friendship = await storage.getFriendship(currentUserId, entryOwnerId);
    }

    // Get shared entry if exists
    let sharedEntry;
    if (currentUserId !== entryOwnerId) {
      const sharedEntries = await storage.getSharedEntries(currentUserId);
      sharedEntry = sharedEntries.find(se => se.entryId === actualEntryId);
    }

    // Build permission context
    const permissionContext: PermissionContext = {
      userId: currentUserId,
      entryOwnerId,
      entryId: actualEntryId,
      friendship,
      sharedEntry,
    };

    // Resolve effective permissions
    const permissionResult = resolveEffectivePermission(permissionContext);

    // Attach to request for use in route handlers
    req.permissionContext = permissionContext;
    req.permissionResult = permissionResult;

    next();
  } catch (error) {
    console.error('Permission resolution error:', error);
    return res.status(500).json({ message: 'Failed to resolve permissions' });
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
    return res.status(500).json({ message: 'Permission context not resolved' });
  }

  if (!permissionResult.hasAccess || !permissionResult.canView) {
    return res.status(403).json({ 
      message: 'Access denied: Insufficient permissions to view this entry',
      reason: permissionResult.reason 
    });
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
    return res.status(500).json({ message: 'Permission context not resolved' });
  }

  if (!permissionResult.hasAccess || !permissionResult.canEdit) {
    return res.status(403).json({ 
      message: 'Access denied: Insufficient permissions to edit this entry',
      reason: permissionResult.reason 
    });
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
    return res.status(500).json({ message: 'Permission context not resolved' });
  }

  if (!permissionResult.hasAccess || !permissionResult.canCreate) {
    return res.status(403).json({ 
      message: 'Access denied: Insufficient permissions to create content in this entry',
      reason: permissionResult.reason 
    });
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
      return res.status(500).json({ message: 'Permission context not resolved' });
    }

    if (!permissionResult.hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied: No access to this entry',
        reason: permissionResult.reason 
      });
    }

    // Get the content block to check ownership
    const contentBlock = await storage.getContentBlock(blockId);
    if (!contentBlock) {
      return res.status(404).json({ message: 'Content block not found' });
    }

    // Check if user can edit this specific content block
    const canEdit = canEditContentBlock(
      permissionResult,
      contentBlock.createdBy,
      currentUserId
    );

    if (!canEdit) {
      return res.status(403).json({ 
        message: 'Access denied: Insufficient permissions to edit this content block',
        reason: permissionResult.effectiveRole === 'contributor' 
          ? 'Contributors can only edit content blocks they created'
          : permissionResult.reason
      });
    }

    next();
  } catch (error) {
    console.error('Content block permission check error:', error);
    return res.status(500).json({ message: 'Failed to check content block permissions' });
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
      return res.status(500).json({ message: 'Permission context not resolved' });
    }

    if (!permissionResult.hasAccess) {
      return res.status(403).json({ 
        message: 'Access denied: No access to this entry',
        reason: permissionResult.reason 
      });
    }

    // Get the content block to check ownership
    const contentBlock = await storage.getContentBlock(blockId);
    if (!contentBlock) {
      return res.status(404).json({ message: 'Content block not found' });
    }

    // Check if user can delete this specific content block
    const canDelete = canDeleteContentBlock(
      permissionResult,
      contentBlock.createdBy,
      currentUserId
    );

    if (!canDelete) {
      return res.status(403).json({ 
        message: 'Access denied: Insufficient permissions to delete this content block',
        reason: permissionResult.effectiveRole === 'contributor' 
          ? 'Contributors can only delete content blocks they created'
          : permissionResult.reason
      });
    }

    next();
  } catch (error) {
    console.error('Content block permission check error:', error);
    return res.status(500).json({ message: 'Failed to check content block permissions' });
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