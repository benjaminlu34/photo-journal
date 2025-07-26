/**
 * Permission utilities for client-side permission enforcement
 * Based on the friend functionality permission matrix
 * 
 * Note: These utilities work with raw data instead of React hooks
 * to avoid context provider issues
 */

export type PermissionRole = 'viewer' | 'contributor' | 'editor' | 'owner';

export interface PermissionContext {
  role: PermissionRole;
  userId: string;
  isOwner: boolean;
}

/**
 * Determines the current user's permission role based on note ownership
 * This version works with passed parameters instead of React hooks
 */
export function getPermissionForNote(
  note: any,
  currentUserId: string,
  isOwnJournal: boolean = true
): PermissionContext {
  // If this is the user's own journal, they have owner permissions
  if (isOwnJournal) {
    return { role: 'owner', userId: currentUserId, isOwner: true };
  }

  // For friend's journals, determine role based on friendship
  const isOwner = note.createdBy?.id === currentUserId;
  if (isOwner) {
    return { role: 'owner', userId: currentUserId, isOwner: true };
  }

  // Default to contributor for now - this should be enhanced with friend role data
  return { role: 'contributor', userId: currentUserId, isOwner: false };
}

/**
 * Checks if the user has permission to perform a specific action
 */
export function hasPermission(
  context: PermissionContext,
  action: 'view' | 'create' | 'edit' | 'delete' | 'move' | 'resize',
  noteOwner?: string
): boolean {
  const { role } = context;

  switch (action) {
    case 'view':
      return true; // All roles can view
    
    case 'create':
      return role === 'owner' || role === 'editor' || role === 'contributor';
    
    case 'edit':
    case 'move':
    case 'resize':
      if (role === 'owner' || role === 'editor') {
        return true;
      }
      if (role === 'contributor' && noteOwner) {
        return noteOwner === context.userId; // Can only edit their own notes
      }
      return false;
    
    case 'delete':
      return role === 'owner' || role === 'editor';
    
    default:
      return false;
  }
}

/**
 * Simple permission check function for components
 * Pass the current user ID and note ownership directly
 */
export function checkPermission(
  action: 'view' | 'create' | 'edit' | 'delete' | 'move' | 'resize',
  currentUserId: string,
  noteOwnerId?: string,
  isOwnJournal: boolean = true
): boolean {
  const context = getPermissionForNote(
    { createdBy: { id: noteOwnerId } },
    currentUserId,
    isOwnJournal
  );
  
  return hasPermission(context, action, noteOwnerId);
}

/**
 * Default permission context for when we don't have specific user data
 */
export const DEFAULT_PERMISSION_CONTEXT: PermissionContext = {
  role: 'owner',
  userId: 'default',
  isOwner: true,
};