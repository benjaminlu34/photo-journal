/**
 * Analytics - PostHog Integration for Friendship Events
 * 
 * This module provides PostHog analytics tracking for friendship events
 * including friend requests, accepts, blocks, role changes, and journal sharing.
 */

/* ------------------------------------------------------------------ */
/*  PostHog Analytics Events                                          */
/* ------------------------------------------------------------------ */

export interface AnalyticsEvent {
  event: string;
  distinctId: string;
  properties?: Record<string, any>;
  timestamp?: Date;
}

/**
 * PostHog Analytics Client (Mock Implementation)
 * 
 * Note: This is a mock implementation since PostHog is not installed.
 * In production, this would use the actual PostHog client library.
 */
class AnalyticsClient {
  private enabled: boolean;

  constructor() {
    // Enable analytics in production or when POSTHOG_KEY is set
    this.enabled = process.env.NODE_ENV === 'production' || !!process.env.POSTHOG_KEY;
    
    if (this.enabled) {
      console.log('📊 Analytics client initialized (PostHog)');
    } else {
      console.log('📊 Analytics client initialized (Mock mode - development)');
    }
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent): void {
    if (!this.enabled) {
      // In development, just log the event
      console.log(`[Analytics] ${event.event}:`, {
        distinctId: event.distinctId,
        properties: event.properties,
        timestamp: event.timestamp || new Date()
      });
      return;
    }

    // TODO: In production, this would send to PostHog
    // posthog.capture({
    //   distinctId: event.distinctId,
    //   event: event.event,
    //   properties: event.properties,
    //   timestamp: event.timestamp
    // });
    
    console.log(`[PostHog] ${event.event}:`, {
      distinctId: event.distinctId,
      properties: event.properties,
      timestamp: event.timestamp || new Date()
    });
  }

  /**
   * Identify a user for analytics
   */
  identify(userId: string, properties?: Record<string, any>): void {
    if (!this.enabled) {
      console.log(`[Analytics] Identify user ${userId}:`, properties);
      return;
    }

    // TODO: In production, this would identify the user in PostHog
    // posthog.identify({
    //   distinctId: userId,
    //   properties: properties
    // });
    
    console.log(`[PostHog] Identify user ${userId}:`, properties);
  }
}

// Singleton instance
export const analytics = new AnalyticsClient();

/* ------------------------------------------------------------------ */
/*  Friendship Analytics Events                                       */
/* ------------------------------------------------------------------ */

/**
 * Track friend request sent event
 */
export function trackFriendRequestSent(
  senderId: string,
  receiverId: string,
  metadata?: { 
    senderUsername?: string;
    receiverUsername?: string;
    source?: string; // e.g., 'search', 'suggestion', 'profile'
  }
): void {
  analytics.track({
    event: 'friend_request_sent',
    distinctId: senderId,
    properties: {
      receiver_id: receiverId,
      sender_username: metadata?.senderUsername,
      receiver_username: metadata?.receiverUsername,
      source: metadata?.source || 'unknown',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track friend request accepted event
 */
export function trackFriendAccepted(
  accepterId: string,
  requesterId: string,
  metadata?: {
    accepterUsername?: string;
    requesterUsername?: string;
    timeToAccept?: number; // milliseconds from request to accept
  }
): void {
  analytics.track({
    event: 'friend_accepted',
    distinctId: accepterId,
    properties: {
      requester_id: requesterId,
      accepter_username: metadata?.accepterUsername,
      requester_username: metadata?.requesterUsername,
      time_to_accept_ms: metadata?.timeToAccept,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track friend request declined event
 */
export function trackFriendDeclined(
  declinerId: string,
  requesterId: string,
  metadata?: {
    declinerUsername?: string;
    requesterUsername?: string;
    timeToDecline?: number; // milliseconds from request to decline
  }
): void {
  analytics.track({
    event: 'friend_declined',
    distinctId: declinerId,
    properties: {
      requester_id: requesterId,
      decliner_username: metadata?.declinerUsername,
      requester_username: metadata?.requesterUsername,
      time_to_decline_ms: metadata?.timeToDecline,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track friend blocked event
 */
export function trackFriendBlocked(
  blockerId: string,
  blockedId: string,
  metadata?: {
    blockerUsername?: string;
    blockedUsername?: string;
    previousStatus?: string; // What status was the friendship before blocking
    reason?: string; // Optional reason for blocking
  }
): void {
  analytics.track({
    event: 'friend_blocked',
    distinctId: blockerId,
    properties: {
      blocked_id: blockedId,
      blocker_username: metadata?.blockerUsername,
      blocked_username: metadata?.blockedUsername,
      previous_status: metadata?.previousStatus,
      reason: metadata?.reason,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track friend unfriended event
 */
export function trackFriendUnfriended(
  unfrienderId: string,
  unfriendedId: string,
  metadata?: {
    unfrienderUsername?: string;
    unfriendedUsername?: string;
    friendshipDuration?: number; // milliseconds the friendship lasted
    reason?: string; // Optional reason for unfriending
  }
): void {
  analytics.track({
    event: 'friend_unfriended',
    distinctId: unfrienderId,
    properties: {
      unfriended_id: unfriendedId,
      unfriender_username: metadata?.unfrienderUsername,
      unfriended_username: metadata?.unfriendedUsername,
      friendship_duration_ms: metadata?.friendshipDuration,
      reason: metadata?.reason,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track friend role changed event
 */
export function trackFriendRoleChanged(
  changerId: string,
  friendId: string,
  oldRole: string,
  newRole: string,
  metadata?: {
    changerUsername?: string;
    friendUsername?: string;
    context?: string; // e.g., 'bulk_change', 'individual_change'
  }
): void {
  analytics.track({
    event: 'friend_role_changed',
    distinctId: changerId,
    properties: {
      friend_id: friendId,
      old_role: oldRole,
      new_role: newRole,
      changer_username: metadata?.changerUsername,
      friend_username: metadata?.friendUsername,
      context: metadata?.context || 'individual_change',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track journal shared event
 */
export function trackJournalShared(
  sharerId: string,
  friendId: string,
  entryId: string,
  metadata?: {
    sharerUsername?: string;
    friendUsername?: string;
    permission?: string; // 'view' or 'edit'
    entryDate?: string;
    contentBlockCount?: number;
  }
): void {
  analytics.track({
    event: 'journal_shared',
    distinctId: sharerId,
    properties: {
      friend_id: friendId,
      entry_id: entryId,
      sharer_username: metadata?.sharerUsername,
      friend_username: metadata?.friendUsername,
      permission: metadata?.permission,
      entry_date: metadata?.entryDate,
      content_block_count: metadata?.contentBlockCount,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track shared journal accessed event
 */
export function trackSharedJournalAccessed(
  accessorId: string,
  ownerId: string,
  entryId: string,
  metadata?: {
    accessorUsername?: string;
    ownerUsername?: string;
    permission?: string; // 'view' or 'edit'
    entryDate?: string;
    accessMethod?: string; // 'direct_link', 'friend_list', 'search'
  }
): void {
  analytics.track({
    event: 'shared_journal_accessed',
    distinctId: accessorId,
    properties: {
      owner_id: ownerId,
      entry_id: entryId,
      accessor_username: metadata?.accessorUsername,
      owner_username: metadata?.ownerUsername,
      permission: metadata?.permission,
      entry_date: metadata?.entryDate,
      access_method: metadata?.accessMethod || 'unknown',
      timestamp: new Date().toISOString()
    }
  });
}

/* ------------------------------------------------------------------ */
/*  User Analytics Events                                             */
/* ------------------------------------------------------------------ */

/**
 * Track user registration/first login
 */
export function trackUserRegistered(
  userId: string,
  metadata?: {
    username?: string;
    email?: string;
    registrationMethod?: string; // 'email', 'oauth', etc.
  }
): void {
  analytics.identify(userId, {
    username: metadata?.username,
    email: metadata?.email,
    registration_method: metadata?.registrationMethod,
    registered_at: new Date().toISOString()
  });

  analytics.track({
    event: 'user_registered',
    distinctId: userId,
    properties: {
      username: metadata?.username,
      email: metadata?.email,
      registration_method: metadata?.registrationMethod,
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Track user login
 */
export function trackUserLogin(
  userId: string,
  metadata?: {
    username?: string;
    loginMethod?: string;
    isFirstLogin?: boolean;
  }
): void {
  analytics.track({
    event: 'user_login',
    distinctId: userId,
    properties: {
      username: metadata?.username,
      login_method: metadata?.loginMethod,
      is_first_login: metadata?.isFirstLogin || false,
      timestamp: new Date().toISOString()
    }
  });
}