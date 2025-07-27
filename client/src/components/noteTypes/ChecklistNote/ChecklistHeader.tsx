import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { getOptimalTextColor, safeColor } from "@/utils/colorUtils/colorUtils";

interface ChecklistHeaderProps {
  title?: string;
  onTitleChange: (title: string) => void;
  className?: string;
  backgroundColor?: string;
}

const ChecklistHeader: React.FC<ChecklistHeaderProps> = ({
  title = "",
  onTitleChange,
  className,
  backgroundColor
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when title prop changes
  useEffect(() => {
    setLocalTitle(title);
  }, [title]);

  // Debounced save function
  const debouncedSave = useCallback((newTitle: string) => {
    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout for saving
    debounceTimeoutRef.current = setTimeout(() => {
      onTitleChange(newTitle);
    }, 300); // 300ms debounce
  }, [onTitleChange]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    // Focus the input after state update
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, 0);
  }, []);

  const handleEndEdit = useCallback(() => {
    setIsEditing(false);
    // Save any pending changes immediately when ending edit
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      onTitleChange(localTitle);
    }
  }, [localTitle, onTitleChange]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setLocalTitle(newTitle);
    debouncedSave(newTitle);
  }, [debouncedSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEndEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Revert to original title and end editing
      setLocalTitle(title);
      setIsEditing(false);
    }
  }, [title, handleEndEdit]);

  const handleBlur = useCallback(() => {
    handleEndEdit();
  }, [handleEndEdit]);

  const displayTitle = localTitle.trim() || "Untitled Checklist";
  const isPlaceholder = !localTitle.trim();

  // Calculate optimal text color based on background
  const textColorStyles = useMemo(() => {
    if (!backgroundColor) {
      return {
        color: undefined, // Use default CSS colors
        placeholderColor: undefined
      };
    }

    const safeBackgroundColor = safeColor(backgroundColor, '#F4F7FF');
    const optimalTextColor = getOptimalTextColor(safeBackgroundColor);
    
    if (!optimalTextColor) {
      return {
        color: undefined,
        placeholderColor: undefined
      };
    }

    // For placeholder text, use a slightly more transparent version
    const isLightText = optimalTextColor === '#F9FAFB';
    const placeholderColor = isLightText ? 'rgba(249, 250, 251, 0.7)' : 'rgba(31, 41, 55, 0.7)';

    return {
      color: optimalTextColor,
      placeholderColor
    };
  }, [backgroundColor]);

  if (isEditing) {
    return (
      <motion.div
        className={cn("mb-3", className)}
        initial={{ scale: 0.98 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        {textColorStyles.placeholderColor && (
          <style>
            {`
              .checklist-header-input::placeholder {
                color: ${textColorStyles.placeholderColor} !important;
              }
            `}
          </style>
        )}
        <input
          ref={inputRef}
          type="text"
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={cn(
            "w-full bg-transparent border-none outline-none",
            "text-lg font-semibold",
            "checklist-header-input",
            !textColorStyles.color && "text-gray-800",
            !textColorStyles.placeholderColor && "placeholder:text-gray-500",
            "focus:bg-white/30 focus:rounded-md focus:px-2 focus:py-1",
            "focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
            "transition-all duration-200"
          )}
          style={{
            color: textColorStyles.color,
          }}
          placeholder="Enter checklist title..."
          aria-label="Edit checklist title"
          maxLength={100}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("mb-3 cursor-pointer group", className)}
      onClick={handleStartEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleStartEdit();
        }
      }}
      tabIndex={0}
      role="button"
      aria-label={`Checklist title: ${displayTitle}. Click to edit.`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      <h2
        className={cn(
          "text-lg font-semibold transition-all duration-200",
          "group-hover:bg-white/20 group-hover:rounded-md group-hover:px-2 group-hover:py-1",
          "focus-visible:bg-white/20 focus-visible:rounded-md focus-visible:px-2 focus-visible:py-1",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50 focus-visible:ring-offset-1",
          // Only apply default colors if no custom background color
          !textColorStyles.color && (isPlaceholder 
            ? "text-gray-500 italic" 
            : "text-gray-800"),
          // Apply italic styling for placeholder regardless of color
          isPlaceholder && "italic"
        )}
        style={{
          color: textColorStyles.color ? (isPlaceholder ? textColorStyles.placeholderColor : textColorStyles.color) : undefined
        }}
      >
        {displayTitle}
      </h2>
    </motion.div>
  );
};

export default ChecklistHeader;