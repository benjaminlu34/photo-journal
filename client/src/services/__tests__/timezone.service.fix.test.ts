import { TimezoneServiceImpl, timezoneService } from '../timezone.service';
import type { BaseEvent } from '@/types/calendar';

describe('TimezoneService - Enhanced DST Implementation', () => {
  let service: TimezoneServiceImpl;

  beforeEach(() => {
    service = timezoneService as TimezoneServiceImpl;
  });

  describe('handleFloatingTime', () => {
    it('should correctly handle floating times with different user timezones', () => {
      // Create a date representing wall clock time
      const wallClockTime = new Date(2024, 0, 15, 12, 0, 0); // Jan 15, 2024 12:00 PM
      
      // Test with New York timezone
      const nyTime = service.handleFloatingTime(wallClockTime, 'America/New_York');
      // The floating time should appear as 12:00 PM in New York time
      expect(nyTime.getHours()).toBe(12);
      
      // Test with Tokyo timezone
      const tokyoTime = service.handleFloatingTime(wallClockTime, 'Asia/Tokyo');
      // The floating time should appear as 12:00 PM in Tokyo time
      expect(tokyoTime.getHours()).toBe(12);
    });

    it('should preserve date components when converting floating times', () => {
      // Create a specific date
      const originalDate = new Date(2024, 0, 15, 14, 30, 0); // Jan 15, 2024 2:30 PM
      
      // Handle as floating time in a different timezone
      const converted = service.handleFloatingTime(originalDate, 'America/New_York');
      
      // Should preserve the time components as they would appear in the user's timezone
      expect(converted.getHours()).toBe(14);
      expect(converted.getMinutes()).toBe(30);
    });
  });

  describe('convertToLocalTimeSafe', () => {
    it('should handle events with explicit timezones', () => {
      const event: BaseEvent = {
        id: 'test-1',
        title: 'Test Event',
        startTime: new Date('2024-01-15T12:00:00'),
        endTime: new Date('2024-01-15T13:00:00'),
        timezone: 'America/New_York',
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/Los_Angeles');
      
      expect(converted.timezone).toBe('America/Los_Angeles');
      expect(converted.startTime).toBeInstanceOf(Date);
      expect(converted.endTime).toBeInstanceOf(Date);
    });

    it('should handle floating time events', () => {
      const event: BaseEvent = {
        id: 'test-2',
        title: 'Floating Event',
        startTime: new Date(2024, 0, 15, 12, 0, 0),
        endTime: new Date(2024, 0, 15, 13, 0, 0),
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/New_York');
      
      expect(converted.timezone).toBe('America/New_York');
      expect(converted.startTime.getHours()).toBe(12);
      expect(converted.endTime.getHours()).toBe(13);
    });
  });

  describe('DST Spring-Forward Handling', () => {
    it('should handle non-existent local times during spring forward', () => {
      // March 10, 2024 - Spring forward in America/New_York (2:00 AM -> 3:00 AM)
      const nonExistentTime = new Date(2024, 2, 10, 2, 30, 0); // 2:30 AM doesn't exist
      
      const event: BaseEvent = {
        id: 'dst-test-1',
        title: 'DST Test',
        startTime: nonExistentTime,
        endTime: new Date(2024, 2, 10, 3, 30, 0),
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/New_York');
      
      // Should shift forward to valid time (3:30 AM)
      expect(converted.startTime.getHours()).toBe(3);
      expect(converted.startTime.getMinutes()).toBe(30);
    });

    it('should preserve all-day events during spring forward', () => {
      const springForwardDate = new Date(2024, 2, 10); // March 10, 2024
      
      const event: BaseEvent = {
        id: 'allday-dst-1',
        title: 'All Day Event',
        startTime: new Date(2024, 2, 10, 0, 0, 0),
        endTime: new Date(2024, 2, 10, 23, 59, 59),
        isAllDay: true,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/New_York');
      
      // All-day events should not shift dates
      expect(converted.startTime.getDate()).toBe(10);
      expect(converted.endTime.getDate()).toBe(10);
    });
  });

  describe('DST Fall-Back Handling', () => {
    it('should resolve ambiguous local times during fall back', () => {
      // November 3, 2024 - Fall back in America/New_York (2:00 AM -> 1:00 AM)
      const ambiguousTime = new Date(2024, 10, 3, 1, 30, 0); // 1:30 AM occurs twice
      
      const event: BaseEvent = {
        id: 'dst-test-2',
        title: 'DST Fall Back Test',
        startTime: ambiguousTime,
        endTime: new Date(2024, 10, 3, 2, 30, 0),
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/New_York');
      
      // Should choose first occurrence (earlier offset)
      expect(converted.startTime.getHours()).toBe(1);
      expect(converted.startTime.getMinutes()).toBe(30);
    });

    it('should preserve all-day events during fall back', () => {
      const fallBackDate = new Date(2024, 10, 3); // November 3, 2024
      
      const event: BaseEvent = {
        id: 'allday-dst-2',
        title: 'All Day Fall Back Event',
        startTime: new Date(2024, 10, 3, 0, 0, 0),
        endTime: new Date(2024, 10, 3, 23, 59, 59),
        isAllDay: true,
      };

      const converted = service.convertToLocalTimeSafe(event, 'America/New_York');
      
      // All-day events should not duplicate
      expect(converted.startTime.getDate()).toBe(3);
      expect(converted.endTime.getDate()).toBe(3);
    });
  });

  describe('Cross-Timezone Transitions', () => {
    it('should handle user timezone changes', () => {
      const event: BaseEvent = {
        id: 'tz-change-1',
        title: 'Timezone Change Test',
        startTime: new Date('2024-01-15T12:00:00'),
        endTime: new Date('2024-01-15T13:00:00'),
        timezone: 'America/New_York',
        isAllDay: false,
      };

      // Convert to different timezone
      const converted = service.convertToLocalTimeSafe(event, 'Europe/London');
      
      expect(converted.timezone).toBe('Europe/London');
      expect(converted.startTime).toBeInstanceOf(Date);
      expect(converted.endTime).toBeInstanceOf(Date);
    });

    it('should handle events from different timezone sources', () => {
      const nyEvent: BaseEvent = {
        id: 'multi-tz-1',
        title: 'NY Event',
        startTime: new Date('2024-01-15T12:00:00'),
        endTime: new Date('2024-01-15T13:00:00'),
        timezone: 'America/New_York',
        isAllDay: false,
      };

      const londonEvent: BaseEvent = {
        id: 'multi-tz-2',
        title: 'London Event',
        startTime: new Date('2024-01-15T17:00:00'),
        endTime: new Date('2024-01-15T18:00:00'),
        timezone: 'Europe/London',
        isAllDay: false,
      };

      const userTz = 'America/Los_Angeles';
      const convertedNY = service.convertToLocalTimeSafe(nyEvent, userTz);
      const convertedLondon = service.convertToLocalTimeSafe(londonEvent, userTz);

      expect(convertedNY.timezone).toBe(userTz);
      expect(convertedLondon.timezone).toBe(userTz);
    });
  });

  describe('All-Day Event Utilities', () => {
    it('should get correct local day bounds', () => {
      const testDate = new Date(2024, 0, 15); // January 15, 2024
      const bounds = service.getLocalDayBounds(testDate, 'America/New_York');
      
      expect(bounds.start.getHours()).toBe(0);
      expect(bounds.start.getMinutes()).toBe(0);
      expect(bounds.end.getHours()).toBe(23);
      expect(bounds.end.getMinutes()).toBe(59);
    });

    it('should validate all-day events correctly', () => {
      const validEvent: BaseEvent = {
        id: 'valid-allday',
        title: 'Valid All Day',
        startTime: new Date(2024, 0, 15, 0, 0, 0),
        endTime: new Date(2024, 0, 15, 23, 59, 59),
        isAllDay: true,
      };

      const invalidEvent: BaseEvent = {
        id: 'invalid-allday',
        title: 'Invalid All Day',
        startTime: new Date(2024, 0, 15, 0, 0, 0),
        endTime: new Date(2024, 0, 17, 23, 59, 59), // Spans 3 days
        isAllDay: true,
      };

      expect(service.validateAllDayEvent(validEvent, 'America/New_York')).toBe(true);
      expect(service.validateAllDayEvent(invalidEvent, 'America/New_York')).toBe(false);
    });
  });

  describe('Calendar Service Integration', () => {
    it('should handle Google Calendar events with DST', () => {
      const googleEvent: BaseEvent = {
        id: 'google-dst-1',
        title: 'Google DST Event',
        startTime: new Date('2024-03-10T14:00:00'), // During spring forward
        endTime: new Date('2024-03-10T15:00:00'),
        timezone: 'America/New_York',
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(googleEvent, 'America/Los_Angeles');
      
      expect(converted.timezone).toBe('America/Los_Angeles');
      expect(converted.startTime).toBeInstanceOf(Date);
    });

    it('should handle iCal events with DST', () => {
      const icalEvent: BaseEvent = {
        id: 'ical-dst-1',
        title: 'iCal DST Event',
        startTime: new Date(2024, 10, 3, 1, 30, 0), // During fall back
        endTime: new Date(2024, 10, 3, 2, 30, 0),
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(icalEvent, 'America/New_York');
      
      expect(converted.startTime.getHours()).toBe(1);
      expect(converted.startTime.getMinutes()).toBe(30);
    });

    it('should handle friend calendar events with DST', () => {
      const friendEvent: BaseEvent = {
        id: 'friend-dst-1',
        title: 'Friend DST Event',
        startTime: new Date('2024-03-10T02:30:00Z'), // UTC time during spring forward
        endTime: new Date('2024-03-10T03:30:00Z'),
        timezone: 'UTC',
        isAllDay: false,
      };

      const converted = service.convertToLocalTimeSafe(friendEvent, 'America/New_York');
      
      expect(converted.timezone).toBe('America/New_York');
      expect(converted.startTime).toBeInstanceOf(Date);
    });
  });
});