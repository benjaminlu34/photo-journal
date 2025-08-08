import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RRule } from 'rrule';
import { RecurrenceExpansionServiceImpl } from '../recurrence-expansion.service';
import type { CalendarEvent, IcalCalendarEvent } from '@/types/calendar';

describe('RecurrenceExpansionService - EXDATE handling and aggregate cap', () => {
  let service: RecurrenceExpansionServiceImpl;

  beforeEach(() => {
    service = new RecurrenceExpansionServiceImpl();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeIcalEvent(overrides: Partial<IcalCalendarEvent> = {}): IcalCalendarEvent {
    const start = new Date('2025-01-01T10:00:00.000Z');
    const end = new Date('2025-01-01T11:00:00.000Z');
  
    const base: IcalCalendarEvent = {
      id: 'event-1',
      title: 'Test',
      description: 'desc',
      startTime: start,
      endTime: end,
      timezone: undefined as any,
      isAllDay: false,
      color: '#3B82F6',
      location: undefined,
      attendees: [],
      feedId: 'feed-1',
      feedName: 'Feed',
      externalId: 'uid-1',
      sequence: 0,
      recurrenceRule: 'FREQ=DAILY;COUNT=5',
      isRecurring: true,
      originalEvent: undefined,
      lastModified: start,
      source: 'ical',
    };
  
    return { ...base, ...overrides };
  }

  it('filters instances matching EXDATE dates (applyExceptions)', async () => {
    const start = new Date('2025-01-01T10:00:00.000Z');
    const event: CalendarEvent = makeIcalEvent({
      id: 'exdate-1',
      startTime: start,
      endTime: new Date(start.getTime() + 60 * 60 * 1000),
      recurrenceRule: 'FREQ=DAILY;COUNT=5',
      isRecurring: true,
      // Provide EXDATEs for 2nd and 4th occurrence starts
      exceptionDates: [
        new Date('2025-01-02T10:00:00.000Z'),
        new Date('2025-01-04T10:00:00.000Z'),
      ],
    });

    // Ensure RRULE is parsed with known dtstart so occurrences align with event.startTime
    const r = new RRule({
      freq: RRule.DAILY,
      count: 5,
      dtstart: start,
    });
    vi.spyOn(service, 'parseRRule').mockReturnValue(r);

    const instances = await service.expandRecurringEvent(event, start, {
      includeExceptions: true,
    });

    // Expect 5 daily instances minus 2 EXDATEs = 3 instances left
    expect(instances.length).toBe(3);

    const instStartsISO = instances.map((i) => i.instanceStart.toISOString());
    expect(instStartsISO).toContain('2025-01-01T10:00:00.000Z');
    expect(instStartsISO).toContain('2025-01-03T10:00:00.000Z');
    expect(instStartsISO).toContain('2025-01-05T10:00:00.000Z');

    // Ensure excluded dates are not present
    expect(instStartsISO).not.toContain('2025-01-02T10:00:00.000Z');
    expect(instStartsISO).not.toContain('2025-01-04T10:00:00.000Z');
  });

  it('enforces aggregate cap of 5,000 instances across expandMultipleEvents', async () => {
    const baseStart = new Date('2025-01-01T10:00:00.000Z');

    const eventA: CalendarEvent = makeIcalEvent({
      id: 'A',
      externalId: 'uid-A',
    });
    const eventB: CalendarEvent = makeIcalEvent({
      id: 'B',
      externalId: 'uid-B',
    });

    // Build helper to create many stub instances without heavy RRULE generation
    const makeInstances = (n: number, ev: CalendarEvent) =>
      Array.from({ length: n }, (_, i) => {
        const start = new Date(baseStart.getTime() + i * 60_000);
        const end = new Date(start.getTime() + (ev.endTime.getTime() - ev.startTime.getTime()));
        return {
          originalEvent: ev,
          instanceStart: start,
          instanceEnd: end,
          instanceId: `${ev.id}:${i}`,
        };
      });

    // Spy on expandRecurringEvent to return large sets per event
    vi.spyOn(service, 'expandRecurringEvent').mockImplementation(async (ev) => {
      if (ev.id === 'A') return makeInstances(4000, ev);
      return makeInstances(3000, ev); // B returns 3000 instances
    });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await service.expandMultipleEvents([eventA, eventB], baseStart);

    const a = result.get('A')!;
    const b = result.get('B')!;

    // Expect aggregate cap applied deterministically by input order:
    // A: 4000 kept, B: truncated to remaining 1000
    expect(a.length).toBe(4000);
    expect(b.length).toBe(1000);

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.map((c) => String(c[0])).join(' '))
      .toContain('Aggregate recurrence instances exceeded 5000');
  });
});