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
  onDragStart: () => void;
  onDragEnd: () => void;
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
  onBlur,
}: EventCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const truncateText = (text: string, maxLength: number = 30) =>
    text.length <= maxLength ? text : `${text.substring(0, maxLength)}...`;

  return (
    <div
      className={`p-2 rounded-lg text-sm transition-all duration-300 cursor-pointer z-10 ${
        isSelected
          ? "ring-2 ring-purple-500 shadow-lg"
          : "neu-inset hover:shadow-neu-active transform hover:scale-[1.02]"
      } ${isDragging ? "opacity-50" : ""}`}
      style={{
        backgroundColor: applyOpacityToColor(event.color, 0.1),
        borderLeft: `4px solid ${event.color}`,
      }}
      onClick={onClick}
      draggable={isLocal}
      onDragStart={(e) => {
        // Distinguish tap vs drag handled upstream; here just emit
        onDragStart();
      }}
      onDragEnd={(e) => onDragEnd()}
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

      {isLocal && event.createdBy && (
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <User className="w-3 h-3 mr-1" />
          {event.createdBy}
        </div>
      )}

      {!isLocal && (
        <div className="flex items-center text-xs text-gray-500 mt-1">
          <Lock className="w-3 h-3 mr-1" />
          Read-only
        </div>
      )}

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