import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TimePickerDropdown } from './time-picker-dropdown';
import { DatePickerDropdown } from './date-picker-dropdown';

interface SmartDateTimeInputProps {
  id?: string;
  value: Date;
  onChange: (date: Date) => void;
  isAllDay: boolean;
  className?: string;
  readOnly?: boolean;
  minTime?: Date; // For end time to prevent ending before start
  startTime?: Date; // Start time for duration calculation in time picker
  label?: string;
}

export function SmartDateTimeInput({
  id,
  value,
  onChange,
  isAllDay,
  className,
  readOnly = false,
  minTime,
  startTime,
  label
}: SmartDateTimeInputProps) {
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const dateButtonRef = useRef<HTMLButtonElement>(null);
  const timeButtonRef = useRef<HTMLButtonElement>(null);

  const handleDateClick = () => {
    if (!readOnly) {
      setIsDateDropdownOpen(true);
      setIsTimeDropdownOpen(false);
    }
  };

  const handleTimeClick = () => {
    if (!readOnly && !isAllDay) {
      setIsTimeDropdownOpen(true);
      setIsDateDropdownOpen(false);
    }
  };

  const handleDateChange = (newDate: Date) => {
    onChange(newDate);
  };

  const handleTimeChange = (newDate: Date) => {
    onChange(newDate);
  };

  const handleDateDropdownClose = () => {
    setIsDateDropdownOpen(false);
  };

  const handleTimeDropdownClose = () => {
    setIsTimeDropdownOpen(false);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Date picker button */}
      <div className="relative">
        <Button
          ref={dateButtonRef}
          type="button"
          variant="outline"
          onClick={handleDateClick}
          disabled={readOnly}
          className={`w-full justify-start text-left font-normal bg-surface-elevated border-0 ${
            isDateDropdownOpen ? 'shadow-neu-inset ring-2 ring-blue-500/30' : 'shadow-neu hover:shadow-neu-lg hover:-translate-y-0.5'
          } ${readOnly ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''} transition-all duration-200`}
        >
          <Calendar className="mr-2 h-4 w-4 text-gray-600" />
          <span className="text-gray-800 font-medium">{format(value, 'MMM d, yyyy')}</span>
        </Button>
        
        <DatePickerDropdown
          value={value}
          onChange={handleDateChange}
          isOpen={isDateDropdownOpen}
          onClose={handleDateDropdownClose}
          anchorRef={dateButtonRef}
        />
      </div>

      {/* Time picker button */}
      {!isAllDay && (
        <div className="relative">
          <Button
            ref={timeButtonRef}
            type="button"
            variant="outline"
            onClick={handleTimeClick}
            disabled={readOnly}
            className={`w-full justify-start text-left font-normal bg-surface-elevated border-0 ${
              isTimeDropdownOpen ? 'shadow-neu-inset ring-2 ring-blue-500/30' : 'shadow-neu hover:shadow-neu-lg hover:-translate-y-0.5'
            } ${minTime && value < minTime ? 'bg-red-50 text-red-700' : ''} ${readOnly ? 'opacity-60 cursor-not-allowed hover:translate-y-0' : ''} transition-all duration-200`}
          >
            <Clock className="mr-2 h-4 w-4 text-gray-600" />
            <span className="text-gray-800 font-medium">{format(value, 'h:mm a')}</span>
          </Button>
          
          <TimePickerDropdown
            value={value}
            onChange={handleTimeChange}
            isOpen={isTimeDropdownOpen}
            onClose={handleTimeDropdownClose}
            anchorRef={timeButtonRef}
            minTime={minTime}
            startTime={startTime}
          />
        </div>
      )}
    </div>
  );
}