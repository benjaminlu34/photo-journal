import React, { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { TimePickerDropdown } from './time-picker-dropdown';

interface EnhancedTimeInputProps {
  id?: string;
  value: Date;
  onChange: (date: Date) => void;
  isAllDay: boolean;
  className?: string;
  readOnly?: boolean;
}

export function EnhancedTimeInput({
  id,
  value,
  onChange,
  isAllDay,
  className,
  readOnly = false
}: EnhancedTimeInputProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const date = new Date(newValue);
    if (!isNaN(date.getTime())) {
      onChange(date);
    }
  };

  const handleInputClick = () => {
    if (!readOnly && !isAllDay) {
      setIsDropdownOpen(true);
    }
  };

  const handleDropdownClose = () => {
    setIsDropdownOpen(false);
  };

  const handleDropdownChange = (newDate: Date) => {
    onChange(newDate);
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        type={isAllDay ? "date" : "datetime-local"}
        value={isAllDay 
          ? format(value, "yyyy-MM-dd")
          : format(value, "yyyy-MM-dd'T'HH:mm")}
        onChange={handleInputChange}
        onClick={handleInputClick}
        className={className}
        readOnly={readOnly}
      />
      
      {!isAllDay && (
        <TimePickerDropdown
          value={value}
          onChange={handleDropdownChange}
          isOpen={isDropdownOpen}
          onClose={handleDropdownClose}
          anchorRef={inputRef}
        />
      )}
    </div>
  );
}