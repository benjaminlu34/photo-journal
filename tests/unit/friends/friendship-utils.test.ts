import { describe, it, expect } from 'vitest';
import {
  buildCanonicalFriendshipIds,
  canSendFriendRequest,
  isValidStatusTransition,
  getUserRoleInFriendship,
  getRoleGrantedByUser,
} from '../../../server/utils/friendship';

describe('buildCanonicalFriendshipIds', () => {
  it('should order UUIDs canonically with locale-independent comparison', () => {
    // Test with UUIDs that have different cases and characters
    const uuid1 = '12345678-1234-1234-1234-123456789abc';
    const uuid2 = 'abcdefab-cdef-abcd-abcd-123456789def';
    
    const result1 = buildCanonicalFriendshipIds(uuid1, uuid2, uuid1);
    expect(result1.userId).toBe(uuid1);
    expect(result1.friendId).toBe(uuid2);
    expect(result1.isInitiator).toBe(true);

    const result2 = buildCanonicalFriendshipIds(uuid2, uuid1, uuid1);
    expect(result2.userId).toBe(uuid1);
    expect(result2.friendId).toBe(uuid2);
    expect(result2.isInitiator).toBe(true);
  });

  it('should handle UUIDs with mixed case correctly', () => {
    // Test with UUIDs that have uppercase and lowercase hex characters
    const uuidLower = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const uuidUpper = 'BBBBBBBB-BBBB-BBBB-BBBB-BBBBBBBBBBBB';
    
    const result1 = buildCanonicalFriendshipIds(uuidUpper, uuidLower, uuidLower);
    expect(result1.userId).toBe(uuidLower);
    expect(result1.friendId).toBe(uuidUpper);
    expect(result1.isInitiator).toBe(true);
  });
  it('should order user IDs canonically (userId < friendId)', () => {
    const result1 = buildCanonicalFriendshipIds('user-b', 'user-a', 'user-b');
    expect(result1.userId).toBe('user-a');
    expect(result1.friendId).toBe('user-b');
    expect(result1.isInitiator).toBe(false); // user-b is initiator but not canonical userId

    const result2 = buildCanonicalFriendshipIds('user-a', 'user-b', 'user-a');
    expect(result2.userId).toBe('user-a');
    expect(result2.friendId).toBe('user-b');
    expect(result2.isInitiator).toBe(true); // user-a is both initiator and canonical userId
  });

  it('should correctly identify initiator in canonical ordering', () => {
    // When initiator becomes canonical userId
    const result1 = buildCanonicalFriendshipIds('user-z', 'user-a', 'user-a');
    expect(result1.userId).toBe('user-a');
    expect(result1.friendId).toBe('user-z');
    expect(result1.isInitiator).toBe(true);

    // When initiator becomes canonical friendId
    const result2 = buildCanonicalFriendshipIds('user-a', 'user-z', 'user-z');
    expect(result2.userId).toBe('user-a');
    expect(result2.friendId).toBe('user-z');
    expect(result2.isInitiator).toBe(false);
  });

  it('should throw error for self-friendship', () => {
    expect(() => {
      buildCanonicalFriendshipIds('user-a', 'user-a', 'user-a');
    }).toThrow('Cannot create friendship with self');
  });
});

describe('canSendFriendRequest', () => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

  it('should allow request when no existing friendship', () => {
    expect(canSendFriendRequest(null, null)).toBe(true);
  });

  it('should block request for blocked status', () => {
    expect(canSendFriendRequest(oneHourAgo, 'blocked')).toBe(false);
  });

  it('should block request for pending status', () => {
    expect(canSendFriendRequest(oneHourAgo, 'pending')).toBe(false);
  });

  it('should block request for accepted status', () => {
    expect(canSendFriendRequest(oneHourAgo, 'accepted')).toBe(false);
  });

  it('should respect 24-hour cooldown for declined status', () => {
    expect(canSendFriendRequest(oneHourAgo, 'declined')).toBe(false);
    expect(canSendFriendRequest(oneDayAgo, 'declined')).toBe(true);
  });

  it('should respect 24-hour cooldown for unfriended status', () => {
    expect(canSendFriendRequest(oneHourAgo, 'unfriended')).toBe(false);
    expect(canSendFriendRequest(oneDayAgo, 'unfriended')).toBe(true);
  });

  it('should handle exact 24-hour cooldown boundary correctly', () => {
    const exact24HoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(canSendFriendRequest(exact24HoursAgo, 'declined')).toBe(true);
    expect(canSendFriendRequest(exact24HoursAgo, 'unfriended')).toBe(true);
  });

  it('should handle millisecond precision correctly', () => {
    // Test with times that are very close to the boundary
    // justBefore: 24 hours - 1 millisecond ago (should be false because it hasn't reached 24 hours)
    const justBefore = new Date(now.getTime() - (24 * 60 * 60 * 1000) + 1);
    // justAfter: 24 hours + 1 millisecond ago (should be true because it has passed 24 hours)
    const justAfter = new Date(now.getTime() - (24 * 60 * 60 * 1000) - 1);
    
    // At 24 hours - 1ms: should NOT be allowed (false)
    expect(canSendFriendRequest(justBefore, 'declined')).toBe(false);
    // At 24 hours + 1ms: should be allowed (true)
    expect(canSendFriendRequest(justAfter, 'declined')).toBe(true);
    
    // Also test the boundary exactly at 24 hours
    const exact24Hours = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    expect(canSendFriendRequest(exact24Hours, 'declined')).toBe(true);
  });
});

describe('isValidStatusTransition', () => {
  it('should allow valid transitions from pending', () => {
    expect(isValidStatusTransition('pending', 'accepted', 'user-b', 'user-a')).toBe(true);
    expect(isValidStatusTransition('pending', 'declined', 'user-b', 'user-a')).toBe(true);
    expect(isValidStatusTransition('pending', 'blocked', 'user-b', 'user-a')).toBe(true);
  });

  it('should prevent initiator from accepting their own request', () => {
    expect(isValidStatusTransition('pending', 'accepted', 'user-a', 'user-a')).toBe(false);
  });

  it('should allow valid transitions from accepted', () => {
    expect(isValidStatusTransition('accepted', 'unfriended', 'user-a', 'user-a')).toBe(true);
    expect(isValidStatusTransition('accepted', 'blocked', 'user-a', 'user-a')).toBe(true);
  });

  it('should allow new requests after decline/unfriend', () => {
    expect(isValidStatusTransition('declined', 'pending', 'user-a', 'user-a')).toBe(true);
    expect(isValidStatusTransition('unfriended', 'pending', 'user-a', 'user-a')).toBe(true);
  });

  it('should prevent transitions from blocked status', () => {
    expect(isValidStatusTransition('blocked', 'pending', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('blocked', 'accepted', 'user-a', 'user-a')).toBe(false);
  });

  it('should reject invalid transitions', () => {
    expect(isValidStatusTransition('pending', 'unfriended', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('accepted', 'pending', 'user-a', 'user-a')).toBe(false);
  });

  it('should reject transitions with null/undefined parameters', () => {
    // Empty strings should be rejected
    expect(isValidStatusTransition('', 'pending', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', '', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', 'accepted', '', 'user-a')).toBe(false);
    
    // Test with null/undefined (should be rejected by defensive checks)
    expect(isValidStatusTransition(null as any, 'pending', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', null as any, 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', 'accepted', null as any, 'user-a')).toBe(false);
    
    // Test with undefined (should be rejected by defensive checks)
    expect(isValidStatusTransition(undefined as any, 'pending', 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', undefined as any, 'user-a', 'user-a')).toBe(false);
    expect(isValidStatusTransition('pending', 'accepted', undefined as any, 'user-a')).toBe(false);
    
    // Valid transition should still work
    expect(isValidStatusTransition('pending', 'accepted', 'user-b', 'user-a')).toBe(true);
  });
});

describe('getUserRoleInFriendship', () => {
  const friendship = {
    userId: 'user-a',
    friendId: 'user-b',
    roleUserToFriend: 'editor',
    roleFriendToUser: 'viewer'
  };

  it('should return correct role for canonical userId', () => {
    // user-a receives roleFriendToUser
    expect(getUserRoleInFriendship(friendship, 'user-a')).toBe('viewer');
  });

  it('should return correct role for canonical friendId', () => {
    // user-b receives roleUserToFriend
    expect(getUserRoleInFriendship(friendship, 'user-b')).toBe('editor');
  });

  it('should throw error for non-participant', () => {
    expect(() => {
      getUserRoleInFriendship(friendship, 'user-c');
    }).toThrow('User is not part of this friendship');
  });
});

describe('getRoleGrantedByUser', () => {
  const friendship = {
    userId: 'user-a',
    friendId: 'user-b',
    roleUserToFriend: 'editor',
    roleFriendToUser: 'viewer'
  };

  it('should return correct granted role for canonical userId', () => {
    // user-a grants roleUserToFriend
    expect(getRoleGrantedByUser(friendship, 'user-a')).toBe('editor');
  });

  it('should return correct granted role for canonical friendId', () => {
    // user-b grants roleFriendToUser
    expect(getRoleGrantedByUser(friendship, 'user-b')).toBe('viewer');
  });

  it('should throw error for non-participant', () => {
    expect(() => {
      getRoleGrantedByUser(friendship, 'user-c');
    }).toThrow('User is not part of this friendship');
  });
});