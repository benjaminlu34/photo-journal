import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DayColumn } from '../day-column';
import type { LocalEvent } from '@/types/calendar';
import { CALENDAR_CONFIG } from '@shared/config/calendar-config';

describe('DayColumn Sweep-Line Collision Algorithm', () => {
  const mockDate = new Date('2025-01-15T00:00:00');
  const mockOnEventClick = () => {};
  const mockOnTimeSlotClick = () => {};
  const mockOnEventDragStart = () => {};
  const mockOnEventDragEnd = () => {};

  const createEvent = (
    id: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number
  ): LocalEvent => {
    const start = new Date(mockDate);
    start.setHours(startHour, startMinute, 0, 0);
    const end = new Date(mockDate);
    end.setHours(endHour, endMinute, 0, 0);
    
    return {
      id,
      title: `Event ${id}`,
      startTime: start,
      endTime: end,
      isAllDay: false,
      color: '#3B82F6',
      createdBy: 'user123',
      createdAt: new Date(),
      updatedAt: new Date(),
      collaborators: [],
      tags: [],
    };
  };

  it('should handle non-overlapping events in single column', () => {
    const events: LocalEvent[] = [
      createEvent('1', 9, 0, 10, 0),
      createEvent('2', 10, 30, 11, 30),
      createEvent('3', 14, 0, 15, 0),
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    // All events should have full width (100%) when not overlapping
    const eventElements = container.querySelectorAll('.absolute');
    eventElements.forEach(element => {
      const style = (element as HTMLElement).getAttribute('style') || '';
      expect(style).toContain('width: 100%');
      expect(style).toContain('left: 0%');
    });
  });

  it('should handle simple overlapping events in multiple columns', () => {
    const events: LocalEvent[] = [
      createEvent('1', 9, 0, 11, 0),  // Column 0
      createEvent('2', 10, 0, 12, 0), // Column 1 (overlaps with 1)
      createEvent('3', 10, 30, 11, 30), // Column 2 (overlaps with 1 and 2)
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(3);
    
    // Each event should have 1/3 width (33.33%)
    eventElements.forEach(element => {
      const style = element.getAttribute('style');
      expect(style).toContain('width: 33.33');
    });
  });

  it('should reuse columns efficiently with sweep-line algorithm', () => {
    const events: LocalEvent[] = [
      createEvent('1', 9, 0, 10, 0),   // Column 0
      createEvent('2', 9, 30, 10, 30), // Column 1 (overlaps with 1)
      createEvent('3', 10, 30, 11, 30), // Column 0 (reuses freed column)
      createEvent('4', 11, 0, 12, 0),   // Column 1 (reuses freed column)
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(4);
    
    // Should only need 2 columns total
    eventElements.forEach(element => {
      const style = element.getAttribute('style');
      expect(style).toContain('width: 50%'); // 100% / 2 columns
    });
  });

  it('should handle many overlapping events with stable layout', () => {
    // Create a complex scenario with many overlapping events
    const events: LocalEvent[] = [
      // Group 1: Morning cascade
      createEvent('1', 9, 0, 11, 0),
      createEvent('2', 9, 15, 10, 30),
      createEvent('3', 9, 30, 10, 0),
      createEvent('4', 9, 45, 11, 30),
      
      // Group 2: Noon overlap
      createEvent('5', 12, 0, 13, 30),
      createEvent('6', 12, 30, 14, 0),
      createEvent('7', 13, 0, 13, 45),
      
      // Group 3: Afternoon cascade
      createEvent('8', 14, 0, 15, 30),
      createEvent('9', 14, 15, 16, 0),
      createEvent('10', 14, 30, 15, 0),
      createEvent('11', 15, 0, 16, 30),
      createEvent('12', 15, 15, 17, 0),
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(12);
    
    // Verify all events are positioned
    eventElements.forEach((element, index) => {
      const style = element.getAttribute('style');
      expect(style).toBeTruthy();
      expect(style).toContain('top:');
      expect(style).toContain('height:');
      expect(style).toContain('left:');
      expect(style).toContain('width:');
    });

    // Verify no events have negative positions
    eventElements.forEach(element => {
      const style = element.getAttribute('style') || '';
      const left = parseFloat(style.match(/left:\s*([\d.]+)%/)?.[1] || '0');
      const width = parseFloat(style.match(/width:\s*([\d.]+)%/)?.[1] || '0');
      
      expect(left).toBeGreaterThanOrEqual(0);
      expect(width).toBeGreaterThan(0);
      expect(left + width).toBeLessThanOrEqual(100.1); // Allow small floating point error
    });
  });

  it('should handle events with minimum duration correctly', () => {
    // Create events with very short durations that should be extended
    const events: LocalEvent[] = [
      createEvent('1', 9, 0, 9, 5),   // 5 minutes (should be extended to min)
      createEvent('2', 10, 0, 10, 10), // 10 minutes (should be extended to min)
      createEvent('3', 11, 0, 11, 30), // 30 minutes (already at min)
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(3);
    
    // All events should be rendered with minimum height (15 minutes by config)
    eventElements.forEach(element => {
      const style = (element as HTMLElement).getAttribute('style') || '';
      const height = parseFloat(style.match(/height:\s*([\d.]+)px/)?.[1] || '0');

      const expectedMinHeight = (CALENDAR_CONFIG.EVENTS.MIN_DURATION / 60) * CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT;
      expect(height).toBeGreaterThanOrEqual(expectedMinHeight - 0.01);
    });
  });

  it('should maintain stable layout when events are added/removed', () => {
    const initialEvents: LocalEvent[] = [
      createEvent('1', 9, 0, 10, 30),
      createEvent('2', 10, 0, 11, 0),
      createEvent('3', 10, 30, 12, 0),
    ];

    const { rerender } = render(
      <DayColumn
        date={mockDate}
        events={initialEvents}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    // Add a new overlapping event
    const updatedEvents = [
      ...initialEvents,
      createEvent('4', 9, 30, 11, 30),
    ];

    rerender(
      <DayColumn
        date={mockDate}
        events={updatedEvents}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    // Layout should remain stable and deterministic
    const eventElements = document.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(4);
  });

  it('should handle edge case: all events at same time', () => {
    const events: LocalEvent[] = [
      createEvent('1', 14, 0, 15, 0),
      createEvent('2', 14, 0, 15, 0),
      createEvent('3', 14, 0, 15, 0),
      createEvent('4', 14, 0, 15, 0),
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(4);
    
    // Each should get equal width (25%)
    eventElements.forEach(element => {
      const style = element.getAttribute('style');
      expect(style).toContain('width: 25%');
    });
  });

  it('should handle edge case: events spanning entire day', () => {
    const events: LocalEvent[] = [
      createEvent('1', 0, 0, 23, 59),
      createEvent('2', 8, 0, 17, 0),
      createEvent('3', 12, 0, 13, 0),
    ];

    const { container } = render(
      <DayColumn
        date={mockDate}
        events={events}
        isToday={false}
        isWeekend={false}
        onEventClick={mockOnEventClick}
        onTimeSlotClick={mockOnTimeSlotClick}
        onEventDragStart={mockOnEventDragStart}
        onEventDragEnd={mockOnEventDragEnd}
      />
    );

    const eventElements = container.querySelectorAll('.absolute');
    expect(eventElements.length).toBe(3);
    
    // Should create 3 columns for these overlapping events
    eventElements.forEach(element => {
      const style = element.getAttribute('style');
      expect(style).toContain('width: 33.33');
    });
  });

  describe('Performance characteristics', () => {
    it('should handle 100+ events efficiently', () => {
      const events: LocalEvent[] = [];
      
      // Create 100 events with various overlaps
      for (let i = 0; i < 100; i++) {
        const startHour = 8 + Math.floor(i / 10);
        const startMinute = (i % 6) * 10;
        const duration = 30 + (i % 3) * 30; // 30, 60, or 90 minutes
        
        events.push(
          createEvent(
            `event-${i}`,
            startHour,
            startMinute,
            startHour + Math.floor(duration / 60),
            startMinute + (duration % 60)
          )
        );
      }

      
      const { container } = render(
        <DayColumn
          date={mockDate}
          events={events}
          isToday={false}
          isWeekend={false}
          onEventClick={mockOnEventClick}
          onTimeSlotClick={mockOnTimeSlotClick}
          onEventDragStart={mockOnEventDragStart}
          onEventDragEnd={mockOnEventDragEnd}
        />
      );



      const eventElements = container.querySelectorAll('.absolute');
      expect(eventElements.length).toBe(100);
    });
  });
});