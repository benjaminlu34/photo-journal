/**
 * Duplicate event resolver service for handling multi-source event deduplication
 * Implements event key generation, sequence handling, and canonical ID assignment
 *
 * Color Policy:
 * - All programmatic color assignment decisions are centralized via ColorPaletteManager.
 * - No direct usage of availableColors for assignment decisions.
 * - We seed existing assignments and route remaining selections through
 *   colorPaletteManager.assignColors() to ensure deterministic, accessible colors.
 * - Contrast is sanity-checked by the manager utilities.
 */
 
import { LRUCache } from 'lru-cache';
import type { CalendarEvent, FriendCalendarEvent } from '@/types/calendar';
import { colorPaletteManager } from './color-palette-manager';
import type { ColorAssignment } from './color-palette-manager';

// Interfaces
interface DeduplicationResult {
  canonicalEvents: Map<string, CalendarEvent>;
  duplicateGroups: Map<string, CalendarEvent[]>;
  colorAssignments: Map<string, string>;
  resolvedCount: number;
}

interface EventGroup {
  canonicalId: string;
  events: CalendarEvent[];
  highestSequence: number;
  primaryEvent: CalendarEvent;
  sources: Set<string>;
}

export class DuplicateEventResolverError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly eventId?: string
  ) {
    super(message);
    this.name = 'DuplicateEventResolverError';
  }
}

export interface DuplicateEventResolver {
  // Core deduplication methods
  resolveEvents(events: CalendarEvent[]): DeduplicationResult;

  // Event key generation
  generateEventKey(event: CalendarEvent): string;

  // Canonical ID assignment
  assignCanonicalId(events: CalendarEvent[]): string;

  // Color collision resolution
  resolveColorCollisions(events: CalendarEvent[]): Map<string, string>;

  // Sequence handling
  compareEventSequences(event1: CalendarEvent, event2: CalendarEvent): number;

  // Utility methods
  areEventsEquivalent(event1: CalendarEvent, event2: CalendarEvent): boolean;
  getEventSourceId(event: CalendarEvent): string;

  // Cache management
  getCacheStats(): { size: number; maxSize: number };
}

export class DuplicateEventResolverImpl implements DuplicateEventResolver {
  // FIXED: Use LRUCache with max size to prevent memory leaks
  private readonly colorAssignmentCache = new LRUCache<string, string>({
    max: 1000, // Limit to 1000 color assignments
    ttl: 24 * 60 * 60 * 1000, // 24 hour TTL to allow cache refresh
  });

  // Core deduplication methods
  resolveEvents(events: CalendarEvent[]): DeduplicationResult {
    if (events.length === 0) {
      return {
        canonicalEvents: new Map(),
        duplicateGroups: new Map(),
        colorAssignments: new Map(),
        resolvedCount: 0,
      };
    }

    try {
      // Step 1: Group events by their base identifier (external ID without sequence)
      const eventGroups = this.groupEventsByIdentifier(events);

      // Step 2: Resolve duplicates within each group
      const resolvedGroups = this.resolveDuplicatesInGroups(eventGroups);

      // Step 3: Assign canonical IDs
      const canonicalEvents = this.assignCanonicalIds(resolvedGroups);

      // Step 4: Resolve color collisions
      const colorAssignments = this.resolveColorCollisions(Array.from(canonicalEvents.values()));

      // Step 5: Build duplicate groups for debugging/transparency
      const duplicateGroups = this.buildDuplicateGroups(resolvedGroups);

      return {
        canonicalEvents,
        duplicateGroups,
        colorAssignments,
        resolvedCount: events.length - canonicalEvents.size,
      };
    } catch (error) {
      throw new DuplicateEventResolverError(
        `Failed to resolve event duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'RESOLUTION_FAILED'
      );
    }
  }

  // Event key generation
  generateEventKey(event: CalendarEvent): string {
    const sourceId = this.getEventSourceId(event);
    return `${event.externalId}:${event.sequence}:${sourceId}`;
  }

  // Canonical ID assignment
  assignCanonicalId(events: CalendarEvent[]): string {
    if (events.length === 0) {
      throw new DuplicateEventResolverError('Cannot assign canonical ID to empty event list', 'EMPTY_EVENT_LIST');
    }

    // Sort events by priority: highest sequence first, then by source priority
    const sortedEvents = events.sort((a, b) => {
      // First, compare by sequence (higher sequence wins)
      const sequenceDiff = b.sequence - a.sequence;
      if (sequenceDiff !== 0) return sequenceDiff;

      // Then by source priority (Google > iCal > friend)
      const sourcePriorityA = this.getSourcePriority(a);
      const sourcePriorityB = this.getSourcePriority(b);
      const sourceDiff = sourcePriorityB - sourcePriorityA;
      if (sourceDiff !== 0) return sourceDiff;

      // Finally by feed ID for consistency
      return a.feedId.localeCompare(b.feedId);
    });

    const primaryEvent = sortedEvents[0];

    // Generate a stable canonical ID based on the primary event
    return `canonical:${primaryEvent.externalId}:${primaryEvent.feedId}`;
  }

  // Color collision resolution
  resolveColorCollisions(events: CalendarEvent[]): Map<string, string> {
    // Map of event.id -> hex color
    const colorAssignments = new Map<string, string>();
    const usedColors = new Set<string>();

    // First pass: retain cached and existing colors where possible
    for (const event of events) {
      const cachedColor = this.colorAssignmentCache.get(event.id);
      if (cachedColor && !usedColors.has(cachedColor)) {
        colorAssignments.set(event.id, cachedColor);
        usedColors.add(cachedColor);
        continue;
      }

      if (event.color && !usedColors.has(event.color)) {
        colorAssignments.set(event.id, event.color);
        usedColors.add(event.color);
        this.colorAssignmentCache.set(event.id, event.color);
      }
    }

    // Build existing assignment map for the palette manager
    const existingAssignments = new Map<string, ColorAssignment>();
    for (const [eventId, color] of colorAssignments.entries()) {
      existingAssignments.set(
        eventId,
        colorPaletteManager.validateColorAssignment({ color })
      );
    }

    // Determine which events still need color selection
    const remainingItems = events
      .filter((e) => !colorAssignments.has(e.id))
      .map((e) => ({ id: e.id }));

    if (remainingItems.length > 0) {
      // Delegate selection to ColorPaletteManager to ensure determinism + accessibility
      const assigned = colorPaletteManager.assignColors(remainingItems, existingAssignments);

      // Persist only newly assigned colors
      for (const item of remainingItems) {
        const assignment = assigned.get(item.id);
        if (assignment) {
          const color = assignment.color;
          if (!usedColors.has(color)) {
            colorAssignments.set(item.id, color);
            usedColors.add(color);
            this.colorAssignmentCache.set(item.id, color);
          }
        }
      }
    }

    return colorAssignments;
  }

  // Sequence handling
  compareEventSequences(event1: CalendarEvent, event2: CalendarEvent): number {
    // Higher sequence number indicates a more recent version
    return event2.sequence - event1.sequence;
  }

  // Utility methods
  areEventsEquivalent(event1: CalendarEvent, event2: CalendarEvent): boolean {
    // Events are equivalent if they have the same external ID and are from compatible sources
    return event1.externalId === event2.externalId &&
      this.areSourcesCompatible(event1, event2);
  }

  getEventSourceId(event: CalendarEvent): string {
    if ('friendUserId' in event) {
      return (event as FriendCalendarEvent).friendUserId;
    }
    return event.feedId;
  }

  // Private helper methods
  private groupEventsByIdentifier(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const groups = new Map<string, CalendarEvent[]>();

    for (const event of events) {
      // Use external ID as the base identifier for grouping
      const baseId = event.externalId;

      if (!groups.has(baseId)) {
        groups.set(baseId, []);
      }

      groups.get(baseId)!.push(event);
    }

    return groups;
  }

  private resolveDuplicatesInGroups(eventGroups: Map<string, CalendarEvent[]>): Map<string, EventGroup> {
    const resolvedGroups = new Map<string, EventGroup>();

    for (const [baseId, events] of eventGroups) {
      if (events.length === 1) {
        // No duplicates, create a simple group
        const event = events[0];
        resolvedGroups.set(baseId, {
          canonicalId: this.assignCanonicalId([event]),
          events: [event],
          highestSequence: event.sequence,
          primaryEvent: event,
          sources: new Set([this.getEventSourceId(event)]),
        });
        continue;
      }

      // Handle duplicates by sequence and EXDATE rules
      const resolvedGroup = this.resolveDuplicateGroup(events);
      resolvedGroups.set(baseId, resolvedGroup);
    }

    return resolvedGroups;
  }

  private resolveDuplicateGroup(events: CalendarEvent[]): EventGroup {
    // Sort by sequence (highest first) to handle EXDATE sequence updates
    const sortedEvents = events.sort((a, b) => this.compareEventSequences(a, b));

    // Find the highest sequence number
    const highestSequence = sortedEvents[0].sequence;

    // Filter events: higher sequence replaces lower sequence
    const validEvents = sortedEvents.filter(event => {
      // Keep events with the highest sequence
      if (event.sequence === highestSequence) {
        return true;
      }

      // For lower sequences, only keep if they're from different sources
      // and don't conflict with higher sequence events
      return !this.hasConflictingHigherSequence(event, sortedEvents);
    });

    // Select primary event (highest sequence, best source)
    const primaryEvent = validEvents[0];

    // Collect all sources
    const sources = new Set(validEvents.map(event => this.getEventSourceId(event)));

    return {
      canonicalId: this.assignCanonicalId(validEvents),
      events: validEvents,
      highestSequence,
      primaryEvent,
      sources,
    };
  }

  private hasConflictingHigherSequence(event: CalendarEvent, sortedEvents: CalendarEvent[]): boolean {
    const eventSourceId = this.getEventSourceId(event);

    for (const otherEvent of sortedEvents) {
      if (otherEvent.sequence > event.sequence) {
        const otherSourceId = this.getEventSourceId(otherEvent);

        // If there's a higher sequence from the same source, this event is superseded
        if (eventSourceId === otherSourceId) {
          return true;
        }

        // If there's a higher sequence from a compatible source, check for conflicts
        if (this.areSourcesCompatible(event, otherEvent)) {
          return this.eventsConflict(event, otherEvent);
        }
      }
    }

    return false;
  }

  private assignCanonicalIds(resolvedGroups: Map<string, EventGroup>): Map<string, CalendarEvent> {
    const canonicalEvents = new Map<string, CalendarEvent>();

    for (const [, group] of resolvedGroups) {
      // Use the primary event as the canonical event
      const canonicalEvent: CalendarEvent = {
        ...group.primaryEvent,
        id: group.canonicalId,
      };

      // Add canonical event ID to friend calendar events
      if ('friendUserId' in canonicalEvent) {
        (canonicalEvent as FriendCalendarEvent).canonicalEventId = group.canonicalId;
      }

      canonicalEvents.set(group.canonicalId, canonicalEvent);
    }

    return canonicalEvents;
  }

  private buildDuplicateGroups(resolvedGroups: Map<string, EventGroup>): Map<string, CalendarEvent[]> {
    const duplicateGroups = new Map<string, CalendarEvent[]>();

    for (const [, group] of resolvedGroups) {
      if (group.events.length > 1) {
        duplicateGroups.set(group.canonicalId, group.events);
      }
    }

    return duplicateGroups;
  }

  private getSourcePriority(event: CalendarEvent): number {
    // Higher number = higher priority
    switch (event.source) {
      case 'google':
        return 3;
      case 'ical':
        return 2;
      default:
        // Friend calendars or other sources
        return 1;
    }
  }

  private areSourcesCompatible(event1: CalendarEvent, event2: CalendarEvent): boolean {
    // Events from the same source are always compatible
    if (this.getEventSourceId(event1) === this.getEventSourceId(event2)) {
      return true;
    }

    // Events with the same external ID from different sources are potentially compatible
    // This handles cases where the same event appears in multiple calendars
    return event1.externalId === event2.externalId;
  }

  private eventsConflict(event1: CalendarEvent, event2: CalendarEvent): boolean {
    // Events conflict if they have overlapping times and different content
    const timeOverlap = this.eventsOverlapInTime(event1, event2);
    const contentDifferent = this.eventsHaveDifferentContent(event1, event2);

    return timeOverlap && contentDifferent;
  }

  private eventsOverlapInTime(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return event1.startTime < event2.endTime && event2.startTime < event1.endTime;
  }

  private eventsHaveDifferentContent(event1: CalendarEvent, event2: CalendarEvent): boolean {
    return event1.title !== event2.title ||
      event1.description !== event2.description ||
      event1.location !== event2.location;
  }

  // Color selection delegated to ColorPaletteManager.assignColors()

  // Cache management
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.colorAssignmentCache.size,
      maxSize: this.colorAssignmentCache.max,
    };
  }
}

// Create a singleton instance
export const duplicateEventResolver = new DuplicateEventResolverImpl();