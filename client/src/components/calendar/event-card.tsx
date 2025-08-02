import { useState } from "react";
import { Clock, MapPin, User, Lock } from "lucide-react";
import { format } from "date-fns";
import type { LocalEvent } from "@/types/calendar";
import { applyOpacityToColor } from "@/utils/colorUtils/colorUtils";

interface EventCardProps {
  event: LocalEvent;
  isLocal: boolean;
  isDragging: boolean;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function EventCard({
  event,
  isLocal,
  isDragging,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
  onFocus,
  onBlur
}: EventCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  
  // Truncate text to fit in the card
  const truncateText = (text: string, maxLength: number = 30) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };
  
  return (
    <div
      className={`absolute left-1 right-1 p-2 rounded-lg text-sm transition-all duration-300 cursor-pointer z-10 ${
        isSelected 
          ? 'ring-2 ring-purple-500 shadow-lg' 
          : 'neu-inset hover:shadow-neu-active transform hover:scale-[1.02]'
      } ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: applyOpacityToColor(event.color, 0.1),
        borderLeft: `4px solid ${event.color}`,
      }}
      onClick={onClick}
      draggable={isLocal}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onFocus={onFocus}
      onBlur={onBlur}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} at ${format(new Date(event.startTime), "h:mm a")}`}
    >
      <div className="font-semibold text-gray-800 truncate text-xs">
        {truncateText(event.title)}
      </div>
      
      <div className="flex items-center text-xs text-gray-600 mt-1">
        <Clock className="w-3 h-3 mr-1" />
        {format(new Date(event.startTime), "h:mm a")}
        {!event.isAllDay && (
          <>
            {" - "}
            {format(new Date(event.endTime), "h:mm a")}
          </>
        )}
      </div>
      
      {event.location && (
        <div className="flex items-center text-xs text-gray-600 mt-1">
          <MapPin className="w-3 h-3 mr-1" />
          <span className="truncate">{truncateText(event.location, 20)}</span>
        </div>
      )}
      
      {/* Show creator for local events */}
      {isLocal && event.createdBy && (
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <User className="w-3 h-3 mr-1" />
          {event.createdBy}
        </div>
      )}
      
      {/* Show lock icon for imported events */}
      {!isLocal && (
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <Lock className="w-3 h-3 mr-1" />
          Read-only
        </div>
      )}
      
      {/* Show full title on hover in a tooltip */}
      {isHovered && event.title.length > 30 && (
        <div 
          className="absolute bottom-full left-0 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-20"
          role="tooltip"
        >
          {event.title}
        </div>
      )}
    </div>
  );
}