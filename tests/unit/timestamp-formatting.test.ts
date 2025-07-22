import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from '../../client/src/hooks/useTimestamp';

describe('Timestamp Formatting', () => {
  const now = new Date('2024-01-01T12:00:00Z').getTime();

  it('should show "just now" for timestamps less than 1 minute ago', () => {
    const timestamp = new Date(now - 30 * 1000).toISOString(); // 30 seconds ago
    expect(formatRelativeTime(timestamp, now)).toBe('just now');
  });

  it('should show minutes for timestamps less than 1 hour ago', () => {
    const timestamp = new Date(now - 5 * 60 * 1000).toISOString(); // 5 minutes ago
    expect(formatRelativeTime(timestamp, now)).toBe('5m ago');
  });

  it('should show hours for timestamps less than 1 day ago', () => {
    const timestamp = new Date(now - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago
    expect(formatRelativeTime(timestamp, now)).toBe('3h ago');
  });

  it('should show days for timestamps less than 1 week ago', () => {
    const timestamp = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
    expect(formatRelativeTime(timestamp, now)).toBe('2d ago');
  });

  it('should show date for timestamps older than 1 week', () => {
    const timestamp = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago
    const result = formatRelativeTime(timestamp, now);
    expect(result).toBe('2023-12-22'); // Should be a date format (YYYY-MM-DD or locale format)
  });

  it('should handle edge case of exactly 1 minute', () => {
    const timestamp = new Date(now - 60 * 1000).toISOString(); // Exactly 1 minute ago
    expect(formatRelativeTime(timestamp, now)).toBe('1m ago');
  });

  it('should handle edge case of exactly 1 hour', () => {
    const timestamp = new Date(now - 60 * 60 * 1000).toISOString(); // Exactly 1 hour ago
    expect(formatRelativeTime(timestamp, now)).toBe('1h ago');
  });
});