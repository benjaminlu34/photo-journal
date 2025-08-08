import { describe, it, expect, vi, beforeEach } from 'vitest';
import { duplicateEventResolver } from '@/services/duplicate-event-resolver.service';
import type { CalendarEvent, FriendCalendarEvent } from '@/types/calendar';
import { FriendCalendarServiceImpl } from '@/services/friend-calendar.service';

// Helper to construct base dates
const now = new Date();
const in1h = new Date(now.getTime() + 60 * 60 * 1000);

describe('Friend calendar: dedupe and background refresh', () => {
  beforeEach(() => {
    // Ensure document.hidden is writable for this test environment
    try {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    } catch {
      // ignore if environment does not support redefining
    }
  });

  it('resolves duplicates across friend and external sources consistently (external wins by priority)', () => {
    // ical event (external) with higher or equal sequence than friend
    const icalEvent: CalendarEvent = {
      id: 'ical-feed:evt-1',
      title: 'Brunch',
      description: 'with friends',
      startTime: now,
      endTime: in1h,
      timezone: 'UTC',
      isAllDay: false,
      color: '#3B82F6',
      location: 'Cafe',
      attendees: ['alice@example.com'],
      feedId: 'ical-feed',
      feedName: 'Alice iCal',
      externalId: 'evt-1',
      sequence: 5, // higher
      isRecurring: false,
      source: 'ical',
      lastModified: now,
    };

    const friendEvent: FriendCalendarEvent = {
      id: 'friend-123:evt-1',
      title: 'Brunch',
      description: 'with friends',
      startTime: now,
      endTime: in1h,
      timezone: 'UTC',
      isAllDay: false,
      color: '#10B981',
      location: 'Cafe',
      attendees: ['alice@example.com'],
      feedId: 'friend-123',
      feedName: "Alice's Calendar",
      externalId: 'evt-1',
      sequence: 2, // lower
      isRecurring: false,
      source: 'friend',
      lastModified: now,
      friendUserId: '123',
      friendUsername: 'alice',
      isFromFriend: true,
      sourceId: '123',
      canonicalEventId: 'evt-1',
      originalEventId: 'evt-1',
    };

    const result = duplicateEventResolver.resolveEvents([icalEvent, friendEvent]);
    expect(result.canonicalEvents.size).toBe(1);
    const canonical = Array.from(result.canonicalEvents.values())[0];
    // External source should win here
    expect(canonical.source).toBe('ical');
    expect('friendUserId' in (canonical as any)).toBe(false);
    // Canonical ID includes feed scope of the primary item
    expect(canonical.id.startsWith('canonical:evt-1:ical-feed')).toBe(true);
  });

  it('preserves friend metadata on canonical events when friend has higher sequence', () => {
    const icalEvent: CalendarEvent = {
      id: 'ical-feed:evt-2',
      title: 'Gym',
      description: 'leg day',
      startTime: now,
      endTime: in1h,
      timezone: 'UTC',
      isAllDay: false,
      color: '#3B82F6',
      location: 'Gym',
      attendees: [],
      feedId: 'ical-feed',
      feedName: 'Alice iCal',
      externalId: 'evt-2',
      sequence: 1, // lower
      isRecurring: false,
      source: 'ical',
      lastModified: now,
    };

    const friendEvent: FriendCalendarEvent = {
      id: 'friend-123:evt-2',
      title: 'Gym',
      description: 'leg day',
      startTime: now,
      endTime: in1h,
      timezone: 'UTC',
      isAllDay: false,
      color: '#10B981',
      location: 'Gym',
      attendees: [],
      feedId: 'friend-123',
      feedName: "Alice's Calendar",
      externalId: 'evt-2',
      sequence: 9, // higher
      isRecurring: false,
      source: 'friend',
      lastModified: now,
      friendUserId: '123',
      friendUsername: 'alice',
      isFromFriend: true,
      sourceId: '123',
      canonicalEventId: 'evt-2',
      originalEventId: 'evt-2',
    };

    const result = duplicateEventResolver.resolveEvents([icalEvent, friendEvent]);
    expect(result.canonicalEvents.size).toBe(1);
    const canonical = Array.from(result.canonicalEvents.values())[0] as FriendCalendarEvent;
    // Friend should win here
    expect(canonical.source).toBe('friend');
    expect(canonical.friendUserId).toBe('123');
    expect(canonical.friendUsername).toBe('alice');
    // Resolver adds canonical id for friend events
    expect((canonical as FriendCalendarEvent).canonicalEventId).toBeDefined();
  });

  it('friend service uses deterministic color mapping and preserves friend metadata on canonical events', () => {
    const svc = new FriendCalendarServiceImpl();
    const friend = {
      id: 'friend-xyz',
      username: 'bob',
      firstName: 'Bob',
      lastName: 'Builder',
    } as any;

    // Establish feed color assignment
    const feed = svc.createFriendFeed(friend);

    const evA: FriendCalendarEvent = {
      id: 'friend-xyz:evt-10',
      title: 'Coffee',
      description: '',
      startTime: now,
      endTime: in1h,
      isAllDay: false,
      color: '#000000',
      location: undefined,
      attendees: [],
      feedId: `friend-${friend.id}`,
      feedName: `${friend.firstName}'s Calendar`,
      externalId: 'evt-10',
      sequence: 1,
      isRecurring: false,
      source: 'friend',
      lastModified: now,
      friendUserId: friend.id,
      friendUsername: friend.username,
      isFromFriend: true,
      sourceId: friend.id,
      canonicalEventId: 'evt-10',
      originalEventId: 'evt-10',
    };

    const evB: FriendCalendarEvent = {
      ...evA,
      id: 'friend-xyz:evt-10-dup',
      sequence: 2, // newer version of same event
    };

    // Call the private method via any-cast for unit testing
    const resolved = (svc as any).resolveAndColorizeFriendEvents(friend, [evA, evB]) as FriendCalendarEvent[];
    expect(resolved.length).toBe(1);
    const only = resolved[0];

    // Color should match feed color (deterministic per friend via palette manager)
    expect(only.color).toBe(feed.color);

    // Ensure friend metadata is present on canonical event
    expect(only.source).toBe('friend');
    expect(only.friendUserId).toBe(friend.id);
    expect(only.friendUsername).toBe(friend.username);
    expect(only.isFromFriend).toBe(true);
  });

  it('background visibility refresh is rate-limited (handler invoked once within window)', () => {
    const svc = new FriendCalendarServiceImpl();

    // Spy on the internal refresh method to ensure rate limit gates calls
    const spy = vi.fn();
    (svc as any).handleVisibilityRefresh = spy;

    // Ensure page is visible
    try {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    } catch {
      // ignore
    }

    // Dispatch two visibility events quickly
    document.dispatchEvent(new Event('visibilitychange'));
    document.dispatchEvent(new Event('visibilitychange'));

    // Rate limit window is 5 minutes; consecutive dispatches should trigger only once
    expect(spy).toHaveBeenCalledTimes(1);
  });
});