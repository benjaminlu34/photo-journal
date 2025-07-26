/**
 * WebSocket Permission Utilities for Yjs Collaboration
 * 
 * This module provides permission checking for WebSocket-based real-time collaboration
 * using Yjs operations. It ensures that users can only perform operations they have
 * permission for based on their directional friendship roles.
 */

import { checkJournalPermissions } from '../middleware/permission';
import { PermissionResult } from './permission-resolver';

export interface YjsOperationContext {
  userId: string;
  entryId: string;
  operationType: 'view' | 'edit' | 'create' | 'delete';
  contentBlockId?: string;
  contentBlockCreatedBy?: string;
}

export interface YjsPermissionResult {
  allowed: boolean;
  reason: string;
  effectiveRole: string | null;
}

/**
 * Check if a Yjs operation is allowed based on user permissions
 * This is the main entry point for WebSocket permission validation
 */
export async function validateYjsOperation(
  context: YjsOperationContext
): Promise<YjsPermissionResult> {
  try {
    const { userId, entryId, operationType } = context;

    // Get the user's permissions for this journal entry
    const permissionResult = await checkJournalPermissions(userId, entryId);

    if (!permissionResult.hasAccess) {
      return {
        allowed: false,
        reason: permissionResult.reason,
        effectiveRole: null,
      };
    }

    // Check operation-specific permissions
    const operationAllowed = await checkOperationPermission(
      permissionResult,
      context
    );

    return {
      allowed: operationAllowed.allowed,
      reason: operationAllowed.reason,
      effectiveRole: permissionResult.effectiveRole,
    };
  } catch (error) {
    console.error('Yjs operation validation error:', error);
    return {
      allowed: false,
      reason: 'Failed to validate operation permissions',
      effectiveRole: null,
    };
  }
}

/**
 * Check if a specific operation type is allowed based on permission result
 */
async function checkOperationPermission(
  permissionResult: PermissionResult,
  context: YjsOperationContext
): Promise<{ allowed: boolean; reason: string }> {
  const { operationType, contentBlockId, contentBlockCreatedBy, userId } = context;

  switch (operationType) {
    case 'view':
      return {
        allowed: permissionResult.canView,
        reason: permissionResult.canView 
          ? 'User has view permission' 
          : 'User lacks view permission',
      };

    case 'create':
      return {
        allowed: permissionResult.canCreate,
        reason: permissionResult.canCreate 
          ? 'User has create permission' 
          : 'User lacks create permission',
      };

    case 'edit':
      if (!permissionResult.canEdit && permissionResult.effectiveRole !== 'contributor') {
        return {
          allowed: false,
          reason: 'User lacks edit permission',
        };
      }

      // For contributors, check content block ownership
      if (permissionResult.effectiveRole === 'contributor') {
        if (!contentBlockId || !contentBlockCreatedBy) {
          return {
            allowed: false,
            reason: 'Content block ownership information required for contributors',
          };
        }

        if (contentBlockCreatedBy !== userId) {
          return {
            allowed: false,
            reason: 'Contributors can only edit content blocks they created',
          };
        }
      }

      return {
        allowed: true,
        reason: 'User has edit permission for this content block',
      };

    case 'delete':
      if (!permissionResult.canDelete && permissionResult.effectiveRole !== 'contributor') {
        return {
          allowed: false,
          reason: 'User lacks delete permission',
        };
      }

      // For contributors, check content block ownership
      if (permissionResult.effectiveRole === 'contributor') {
        if (!contentBlockId || !contentBlockCreatedBy) {
          return {
            allowed: false,
            reason: 'Content block ownership information required for contributors',
          };
        }

        if (contentBlockCreatedBy !== userId) {
          return {
            allowed: false,
            reason: 'Contributors can only delete content blocks they created',
          };
        }
      }

      return {
        allowed: true,
        reason: 'User has delete permission for this content block',
      };

    default:
      return {
        allowed: false,
        reason: `Unknown operation type: ${operationType}`,
      };
  }
}

/**
 * Validate a batch of Yjs operations
 * Useful for validating multiple operations in a single transaction
 */
export async function validateYjsOperationBatch(
  contexts: YjsOperationContext[]
): Promise<YjsPermissionResult[]> {
  const results = await Promise.all(
    contexts.map(context => validateYjsOperation(context))
  );

  return results;
}

/**
 * Check if any operation in a batch is rejected
 * Returns true if all operations are allowed, false if any are rejected
 */
export function isBatchAllowed(results: YjsPermissionResult[]): boolean {
  return results.every(result => result.allowed);
}

/**
 * Filter allowed operations from a batch
 * Returns only the contexts for operations that are allowed
 */
export function filterAllowedOperations(
  contexts: YjsOperationContext[],
  results: YjsPermissionResult[]
): YjsOperationContext[] {
  return contexts.filter((_, index) => results[index]?.allowed);
}

/**
 * Mock Yjs operation validator for testing
 * Simulates rejecting operations when effective permission is 'viewer'
 */
export async function simulateYjsOperationRejection(
  userId: string,
  entryId: string,
  operationType: 'edit' | 'create' | 'delete'
): Promise<boolean> {
  const context: YjsOperationContext = {
    userId,
    entryId,
    operationType,
  };

  const result = await validateYjsOperation(context);
  
  // Return true if operation was rejected (for testing purposes)
  return !result.allowed;
}

/**
 * WebSocket message handler for permission validation
 * This would be integrated with your WebSocket server implementation
 */
export interface WebSocketMessage {
  type: string;
  userId: string;
  entryId: string;
  operation: {
    type: 'view' | 'edit' | 'create' | 'delete';
    contentBlockId?: string;
    data?: any;
  };
}

export async function handleWebSocketMessage(
  message: WebSocketMessage
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const context: YjsOperationContext = {
      userId: message.userId,
      entryId: message.entryId,
      operationType: message.operation.type,
      contentBlockId: message.operation.contentBlockId,
    };

    const permissionResult = await validateYjsOperation(context);

    if (!permissionResult.allowed) {
      return {
        success: false,
        error: `Operation rejected: ${permissionResult.reason}`,
      };
    }

    // Operation is allowed, process it
    return {
      success: true,
      data: {
        effectiveRole: permissionResult.effectiveRole,
        operation: message.operation,
      },
    };
  } catch (error) {
    console.error('WebSocket message handling error:', error);
    return {
      success: false,
      error: 'Failed to process WebSocket message',
    };
  }
}