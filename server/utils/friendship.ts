/**
 * Friendship utility functions for canonical row management and validation
 */

export interface CanonicalFriendshipIds {
  userId: string;
  friendId: string;
  isInitiator: boolean;
}

/**
 * Build canonical friendship IDs ensuring userId < friendId ordering
 * @param userA First user ID
 * @param userB Second user ID
 * @param initiatorId ID of the user who initiated the friendship
 * @returns Canonical friendship IDs with ordering and initiator flag
 */
export function buildCanonicalFriendshipIds(
  userA: string, 
  userB: string, 
  initiatorId: string
): CanonicalFriendshipIds {
  if (userA === userB) {
    throw new Error('Cannot create friendship with self');
  }

  // Ensure canonical ordering: userId < friendId
  const [userId, friendId] = userA < userB ? [userA, userB] : [userB, userA];
  
  // Determine if the canonical userId is the initiator
  const isInitiator = userId === initiatorId;

  return {
    userId,
    friendId,
    isInitiator
  };
}

/**
 * Check if a friendship request can be sent based on cooldown periods
 * @param lastStatusChange Date of last status change
 * @param currentStatus Current friendship status
 * @returns Whether a new request can be sent
 */
export function canSendFriendRequest(
  lastStatusChange: Date | null,
  currentStatus: string | null
): boolean {
  if (!currentStatus || !lastStatusChange) {
    return true; // No existing friendship
  }

  switch (currentStatus) {
    case 'blocked':
      return false; // Permanent block
    case 'pending':
      return false; // Request already pending
    case 'accepted':
      return false; // Already friends
    case 'declined':
    case 'unfriended':
      // Check 24-hour cooldown
      const cooldownExpired = Date.now() - lastStatusChange.getTime() > 24 * 60 * 60 * 1000;
      return cooldownExpired;
    default:
      return true;
  }
}

/**
 * Validate friendship status transition
 * @param currentStatus Current status
 * @param newStatus Desired new status
 * @param actorId ID of user making the change
 * @param initiatorId ID of user who initiated the friendship
 * @returns Whether the transition is valid
 */
export function isValidStatusTransition(
  currentStatus: string,
  newStatus: string,
  actorId: string,
  initiatorId: string | null
): boolean {
  // Define valid transitions
  const validTransitions: Record<string, string[]> = {
    'pending': ['accepted', 'declined', 'blocked'],
    'accepted': ['unfriended', 'blocked'],
    'declined': ['pending'], // Can send new request after cooldown
    'unfriended': ['pending'], // Can send new request after cooldown
    'blocked': [], // No transitions from blocked (future: unblock to unfriended)
  };

  const allowedNextStates = validTransitions[currentStatus] || [];
  if (!allowedNextStates.includes(newStatus)) {
    return false;
  }

  // Additional business rules
  if (newStatus === 'accepted' && actorId === initiatorId) {
    // Initiator cannot accept their own request
    return false;
  }

  return true;
}

/**
 * Get the role that applies to a specific user in a directional friendship
 * @param friendship Friendship record with directional roles
 * @param userId ID of the user whose role we want to determine
 * @returns The role that applies to the specified user
 */
export function getUserRoleInFriendship(
  friendship: { userId: string; friendId: string; roleUserToFriend: string; roleFriendToUser: string },
  userId: string
): string {
  if (userId === friendship.userId) {
    // This user is the canonical userId, so they receive roleFriendToUser
    return friendship.roleFriendToUser;
  } else if (userId === friendship.friendId) {
    // This user is the canonical friendId, so they receive roleUserToFriend
    return friendship.roleUserToFriend;
  } else {
    throw new Error('User is not part of this friendship');
  }
}

/**
 * Get the role that a user grants to their friend in a directional friendship
 * @param friendship Friendship record with directional roles
 * @param userId ID of the user whose granted role we want to determine
 * @returns The role that the specified user grants to their friend
 */
export function getRoleGrantedByUser(
  friendship: { userId: string; friendId: string; roleUserToFriend: string; roleFriendToUser: string },
  userId: string
): string {
  if (userId === friendship.userId) {
    // This user is the canonical userId, so they grant roleUserToFriend
    return friendship.roleUserToFriend;
  } else if (userId === friendship.friendId) {
    // This user is the canonical friendId, so they grant roleFriendToUser
    return friendship.roleFriendToUser;
  } else {
    throw new Error('User is not part of this friendship');
  }
}