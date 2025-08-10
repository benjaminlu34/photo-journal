import { useState, useEffect } from 'react';
import { addMinutes, isAfter, isBefore, differenceInMinutes } from 'date-fns';

interface UseSmartDurationProps {
  startTime: Date;
  endTime: Date;
  onStartTimeChange: (date: Date) => void;
  onEndTimeChange: (date: Date) => void;
}

interface UseSmartDurationReturn {
  isValidDuration: boolean;
  hasTimeConflict: boolean;
  handleStartTimeChange: (newStartTime: Date) => void;
  handleEndTimeChange: (newEndTime: Date) => void;
  getMinEndTime: () => Date;
}

export function useSmartDuration({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange
}: UseSmartDurationProps): UseSmartDurationReturn {
  const [isValidDuration, setIsValidDuration] = useState(true);
  const [hasTimeConflict, setHasTimeConflict] = useState(false);

  // Check if duration is valid (end time must be after start time)
  useEffect(() => {
    const valid = isBefore(startTime, endTime);
    setIsValidDuration(valid);
    setHasTimeConflict(!valid);
  }, [startTime, endTime]);

  const handleStartTimeChange = (newStartTime: Date) => {
    // If new start time is after current end time, shift end time
    if (isAfter(newStartTime, endTime)) {
      const currentDuration = differenceInMinutes(endTime, startTime);
      const newEndTime = addMinutes(newStartTime, Math.max(currentDuration, 30)); // Minimum 30 minutes
      onEndTimeChange(newEndTime);
    }
    onStartTimeChange(newStartTime);
  };

  const handleEndTimeChange = (newEndTime: Date) => {
    // Do not auto-adjust start time; flag conflict via state and let the user resolve
    onEndTimeChange(newEndTime);
  };

  const getMinEndTime = () => {
    // End time should be at least 15 minutes after start time
    return addMinutes(startTime, 15);
  };

  return {
    isValidDuration,
    hasTimeConflict,
    handleStartTimeChange,
    handleEndTimeChange,
    getMinEndTime
  };
}