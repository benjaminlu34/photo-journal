/**
 * Permission Resolution System with Directional Roles
 * 
 * This module implements the intersection rule (MIN approach) for resolving
 * effective permissions between global friendship roles and entry-specific permissions.
 */

import { Friendship, SharedEntry } from "@shared/schema/schema";
import { getUserRoleInFriendship } from "./friendship";

// Role ranking system - higher numbers = more permissions
export const ROLE_RANKS = {
  'viewer': 1,
  'view': 1,      // SharedEntry permission equivalent
  'contributor': 2,
  'editor': 3,
  'edit': 3,      // SharedEntry permission equivalent
} as const;

export type GlobalRole = 'viewer' | 'contributor' | 'editor';
export type EntryPermission = 'view' | 'edit';
export type EffectiveRole = GlobalRole;

export interface PermissionContext {
  userId: string;
  entryOwnerId: string;
  entryId: string;
  friendship?: Friendship;
  sharedEntry?: SharedEntry;
}

export interface PermissionResult {
  hasAccess: boolean;
  effectiveRole: EffectiveRole | null;
  reason: string;
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
}

/**
 * Resolve effective permission using intersection rule (MIN approach)
 * Global role acts as a hard ceiling - entry privileges cannot exceed the current global role
 */
export function resolveEffectivePermission(context: PermissionContext): PermissionResult {
  const { userId, entryOwnerId, friendship, sharedEntry } = context;

  // Owner has full access
  if (userId === entryOwnerId) {
    return {
      hasAccess: true,
      effectiveRole: 'editor',
      reason: 'Entry owner has full access',
      canView: true,
      canEdit: true,
      canCreate: true,
      canDelete: true,
    };
  }

  // No friendship = no access (unless explicitly shared)
  if (!friendship || friendship.status !== 'accepted') {
    // Check if entry is explicitly shared without friendship
    // Validate that sharedEntry exists and sharedWithId is properly set
    if (sharedEntry && sharedEntry.sharedWithId && sharedEntry.sharedWithId === userId) {
      const entryRole = mapEntryPermissionToRole(sharedEntry.permissions);
      return buildPermissionResult(entryRole, 'Entry explicitly shared');
    }

    return {
      hasAccess: false,
      effectiveRole: null,
      reason: 'No friendship or entry not shared',
      canView: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
    };
  }

  // Get global role from friendship
  const globalRole = getUserRoleInFriendship(friendship, userId) as GlobalRole;

  // If entry is explicitly shared, take the MIN of global and entry-specific roles
  // Validate that sharedEntry exists and sharedWithId is properly set
  if (sharedEntry && sharedEntry.sharedWithId && sharedEntry.sharedWithId === userId) {
    const globalRank = ROLE_RANKS[globalRole];
    const entryRank = ROLE_RANKS[sharedEntry.permissions];
    const effectiveRank = Math.min(globalRank, entryRank);
    const effectiveRole = mapRankToRole(effectiveRank);

    return buildPermissionResult(
      effectiveRole,
      `Global role: ${globalRole}, Entry permission: ${sharedEntry.permissions}, Effective: ${effectiveRole}`
    );
  }

  // If not explicitly shared, but is a friend, the global role is the effective role
  return buildPermissionResult(globalRole, `Access granted through friendship role: ${globalRole}`);
}

/**
 * Map numeric rank back to role name
 */
function mapRankToRole(rank: number): GlobalRole {
  if (rank >= 3) return 'editor';
  if (rank >= 2) return 'contributor';
  return 'viewer';
}

/**
 * Map entry permission to global role equivalent
 */
function mapEntryPermissionToRole(permission: EntryPermission): GlobalRole {
  return permission === 'edit' ? 'editor' : 'viewer';
}

/**
 * Build permission result based on effective role
 */
function buildPermissionResult(effectiveRole: GlobalRole, reason: string): PermissionResult {
  const permissions = getPermissionsForRole(effectiveRole);
  
  return {
    hasAccess: true,
    effectiveRole,
    reason,
    ...permissions,
  };
}

/**
 * Get specific permissions for a role
 *
 * IMPORTANT: Contributors have canEdit: false and canDelete: false at the global level,
 * but CAN edit and delete their OWN content blocks. This is checked by the
 * canEditContentBlock() and canDeleteContentBlock() functions. Always use those
 * functions for content block operations, not the global canEdit/canDelete flags.
 */
export function getPermissionsForRole(role: GlobalRole): {
  canView: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
} {
  switch (role) {
    case 'editor':
      return {
        canView: true,
        canEdit: true,
        canCreate: true,
        canDelete: true,
      };
    case 'contributor':
      return {
        canView: true,
        canEdit: false,  // Global edit flag is false - use canEditContentBlock() for block-level checks
        canCreate: true,
        canDelete: false, // Global delete flag is false - use canDeleteContentBlock() for block-level checks
      };
    case 'viewer':
    default:
      return {
        canView: true,
        canEdit: false,
        canCreate: false,
        canDelete: false,
      };
  }
}

/**
 * Check if user can edit a specific content block
 * Contributors can only edit blocks they created
 */
export function canEditContentBlock(
  permissionResult: PermissionResult,
  contentBlockCreatedBy: string | null,
  userId: string
): boolean {
  // Editors can edit any block
  if (permissionResult.effectiveRole === 'editor') {
    return true;
  }
  
  // Contributors can only edit their own blocks
  if (permissionResult.effectiveRole === 'contributor') {
    return contentBlockCreatedBy === userId;
  }
  
  // Viewers cannot edit any blocks
  return false;
}

/**
 * Check if user can delete a specific content block
 * Contributors can only delete blocks they created
 */
export function canDeleteContentBlock(
  permissionResult: PermissionResult,
  contentBlockCreatedBy: string | null,
  userId: string
): boolean {
  // Editors can delete any block
  if (permissionResult.effectiveRole === 'editor') {
    return true;
  }
  
  // Contributors can only delete their own blocks
  if (permissionResult.effectiveRole === 'contributor') {
    return contentBlockCreatedBy === userId;
  }
  
  // Viewers cannot delete any blocks
  return false;
}

/**
 * Validate if a role downgrade should immediately revoke privileges
 * Used for testing global role downgrade scenarios
 */
export function shouldRevokePrivileges(
  oldRole: GlobalRole,
  newRole: GlobalRole
): boolean {
  const oldRank = ROLE_RANKS[oldRole];
  const newRank = ROLE_RANKS[newRole];
  
  return newRank < oldRank;
}