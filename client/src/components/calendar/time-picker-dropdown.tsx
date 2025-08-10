import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';

interface TimePickerDropdownProps {
  value: Date;
  onChange: (date: Date) => void;
  isOpen: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  minTime?: Date; // Minimum selectable time
}

export function TimePickerDropdown({ 
  value, 
  onChange, 
  isOpen, 
  onClose, 
  anchorRef,
  minTime
}: TimePickerDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Position is now handled by CSS relative positioning

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  // Generate time options (every 15 minutes)
  const generateTimeOptions = () => {
    const options = [];
    const baseDate = new Date(value);
    baseDate.setHours(0, 0, 0, 0);
    
    // Determine starting hour and minute based on minTime
    let startHour = 0;
    let startMinute = 0;
    
    if (minTime && minTime.toDateString() === value.toDateString()) {
      startHour = minTime.getHours();
      startMinute = minTime.getMinutes();
      // Round up to next 15-minute interval only if not already on a 15-minute boundary
      if (startMinute % 15 !== 0) {
        startMinute = Math.ceil(startMinute / 15) * 15;
        if (startMinute >= 60) {
          startHour += 1;
          startMinute = 0;
        }
      }
    }
    
    for (let hour = startHour; hour < 24; hour++) {
      const minuteStart = hour === startHour ? startMinute : 0;
      for (let minute = minuteStart; minute < 60; minute += 15) {
        const optionDate = new Date(baseDate);
        optionDate.setHours(hour, minute);
        
        const isSelected = optionDate.getHours() === value.getHours() && 
                          optionDate.getMinutes() === value.getMinutes();
        
        // Calculate duration from start time for display
        let durationText = '';
        if (minTime && minTime.toDateString() === value.toDateString()) {
          // Calculate from the actual start time, not the minTime
          const actualStartTime = new Date(minTime.getTime() - (15 * 60 * 1000)); // minTime - 15 minutes = actual start time
          const diffMs = optionDate.getTime() - actualStartTime.getTime();
          const diffMinutes = Math.round(diffMs / (1000 * 60));
          
          if (diffMinutes >= 0) {
            if (diffMinutes < 60) {
              durationText = ` (${diffMinutes} mins)`;
            } else {
              const hours = diffMinutes / 60;
              if (hours % 1 === 0) {
                durationText = ` (${hours} hr${hours !== 1 ? 's' : ''})`;
              } else {
                durationText = ` (${hours.toFixed(1)} hrs)`;
              }
            }
          }
        }
        
        options.push({
          time: optionDate,
          label: format(optionDate, 'h:mm a'),
          duration: durationText,
          isSelected
        });
      }
    }
    
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleTimeSelect = (selectedTime: Date) => {
    const newDate = new Date(value);
    newDate.setHours(selectedTime.getHours(), selectedTime.getMinutes(), 0, 0);
    onChange(newDate);
    onClose();
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute z-[9999] bg-surface-elevated backdrop-blur-sm shadow-neu-lg border-0 max-h-64 overflow-y-auto"
      style={{
        top: '100%',
        left: '0',
        marginTop: '4px',
        minWidth: '200px',
        borderRadius: '0.5rem 0.5rem 0 0', // Only round top corners
      }}
    >
      <div className="py-2">
        {timeOptions.map((option, index) => {
          // Check if this time would create an invalid duration
          const isInvalid = minTime && option.time < minTime;
          
          return (
            <button
              key={index}
              onClick={() => handleTimeSelect(option.time)}
              disabled={isInvalid}
              className={`w-full text-left px-4 py-2 text-sm transition-all duration-200 ${
                isInvalid
                  ? 'bg-red-50 text-red-400 cursor-not-allowed'
                  : option.isSelected
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 hover:font-medium hover:shadow-md'
              }`}
            >
              <span className="font-medium">{option.label}</span>
              {option.duration && (
                <span className={`ml-1 ${isInvalid ? 'text-red-300' : 'text-gray-500'}`}>
                  {option.duration}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}