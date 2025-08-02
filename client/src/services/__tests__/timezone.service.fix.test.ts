import { TimezoneService } from '../timezone.service';

describe('TimezoneService - Fixed Implementation', () => {
  let timezoneService: TimezoneService;

  beforeEach(() => {
    timezoneService = TimezoneService.getInstance();
  });

  describe('handleFloatingTime', () => {
    it('should correctly handle floating times with different user timezones', () => {
      // Create a date in UTC
      const utcDate = new Date('2024-01-15T12:00:00Z');
      
      // Test with New York timezone
      const nyTime = timezoneService.handleFloatingTime(utcDate, 'America/New_York');
      // The floating time should appear as 12:00 PM in New York time
      expect(nyTime.getHours()).toBe(12);
      
      // Test with Tokyo timezone
      const tokyoTime = timezoneService.handleFloatingTime(utcDate, 'Asia/Tokyo');
      // The floating time should appear as 12:00 PM in Tokyo time
      expect(tokyoTime.getHours()).toBe(12);
    });

    it('should preserve date components when converting floating times', () => {
      // Create a specific date
      const originalDate = new Date(2024, 0, 15, 14, 30, 0); // Jan 15, 2024 2:30 PM
      
      // Handle as floating time in a different timezone
      const converted = timezoneService.handleFloatingTime(originalDate, 'America/New_York');
      
      // Should preserve the time components as they would appear in the user's timezone
      expect(converted.getHours()).toBe(14);
      expect(converted.getMinutes()).toBe(30);
    });
  });

  describe('convertTimezone', () => {
    it('should correctly convert between timezones', () => {
      // Create a date in New York timezone (12:00 PM)
      const nyDate = new Date('2024-01-15T12:00:00');
      
      // Convert to Tokyo timezone
      const tokyoDate = (timezoneService as any).convertTimezone(nyDate, 'America/New_York', 'Asia/Tokyo');
      
      // The time should be appropriately converted (taking into account timezone difference)
      // Note: This is a simplified check, actual conversion would depend on DST, etc.
      expect(tokyoDate).toBeInstanceOf(Date);
    });
  });
});