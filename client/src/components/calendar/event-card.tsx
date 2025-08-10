import { useState, useCallback, useRef } from "react";
import { Clock, MapPin, User, Lock } from "lucide-react";
import { format } from "date-fns";
import type { LocalEvent } from "@/types/calendar";
import { applyOpacityToColor } from "@/utils/colorUtils/colorUtils";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";

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
  currentUser?: {
    id: string;
    username?: string;
  } | null;
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
  currentUser,
}: EventCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [dragStartTime, setDragStartTime] = useState<number | null>(null);
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Calculate event duration in minutes for layout decisions
  const durationMinutes = (event.endTime.getTime() - event.startTime.getTime()) / (1000 * 60);
  const isShortEvent = durationMinutes <= 30; // 30 minutes or less
  const isMediumEvent = durationMinutes > 30 && durationMinutes <= 90; // 30-90 minutes
  const isLongEvent = durationMinutes > 90; // More than 90 minutes

  const truncateText = useCallback((text: string, maxLength: number = 30) =>
    text.length <= maxLength ? text : `${text.substring(0, maxLength)}...`, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isLocal) return;
    
    setDragStartTime(Date.now());
    setDragStartPosition({ x: e.clientX, y: e.clientY });
  }, [isLocal]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragStartTime || !dragStartPosition || !isLocal) return;

    const timeDiff = Date.now() - dragStartTime;
    const distance = Math.sqrt(
      Math.pow(e.clientX - dragStartPosition.x, 2) + 
      Math.pow(e.clientY - dragStartPosition.y, 2)
    );

    // Check if we've exceeded the drag thresholds
    if (timeDiff >= CALENDAR_CONFIG.MOBILE.DRAG_START_DELAY && 
        distance >= CALENDAR_CONFIG.MOBILE.DRAG_START_DISTANCE) {
      onDragStart();
      setDragStartTime(null);
      setDragStartPosition(null);
    }
  }, [dragStartTime, dragStartPosition, isLocal, onDragStart]);

  const handleMouseUp = useCallback(() => {
    if (dragStartTime && dragStartPosition) {
      // This was a click, not a drag
      onClick();
    }
    setDragStartTime(null);
    setDragStartPosition(null);
  }, [dragStartTime, dragStartPosition, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  }, [onClick]);

  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isLocal) {
      e.preventDefault();
      return;
    }
    
    // Set drag data
    e.dataTransfer.setData('text/plain', event.id);
    e.dataTransfer.effectAllowed = 'move';
    
    onDragStart();
  }, [isLocal, event.id, onDragStart]);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    onDragEnd();
  }, [onDragEnd]);

  return (
    <div
      ref={cardRef}
      className={`relative rounded-xl text-sm transition-all duration-300 cursor-pointer z-10 select-none backdrop-blur-sm h-full flex flex-col ${
        isShortEvent ? 'p-2' : isMediumEvent ? 'p-3' : 'p-4'
      } ${
        isSelected
          ? "ring-2 ring-purple-500 shadow-lg transform scale-105"
          : "shadow-neu hover:shadow-neu-lg transform hover:scale-[1.02] hover:-translate-y-0.5"
      } ${isDragging ? "opacity-50 rotate-2 scale-110" : ""} ${!isLocal ? "cursor-default" : ""}`}
      style={{
        backgroundColor: applyOpacityToColor(event.color, 0.15),
        borderLeft: `4px solid ${event.color}`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${applyOpacityToColor(event.color, 0.3)}`,
        boxShadow: isHovered 
          ? `0 8px 32px ${applyOpacityToColor(event.color, 0.2)}, inset 0 1px 0 rgba(255, 255, 255, 0.1)`
          : `0 4px 16px ${applyOpacityToColor(event.color, 0.1)}, inset 0 1px 0 rgba(255, 255, 255, 0.05)`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      draggable={isLocal}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      aria-label={`${event.title} from ${format(event.startTime, "h:mm a")} to ${format(event.endTime, "h:mm a")}${event.location ? ` at ${event.location}` : ''}${!isLocal ? ' (read-only)' : ''}`}
      aria-describedby={isHovered && event.description ? `${event.id}-description` : undefined}
    >
      {/* Event pattern overlay for accessibility */}
      {event.pattern && event.pattern !== 'plain' && (
        <div 
          className={`absolute inset-0 rounded-xl pointer-events-none ${
            event.pattern === 'stripe' 
              ? 'bg-gradient-to-r from-transparent via-white/20 to-transparent bg-[length:8px_8px]'
              : event.pattern === 'dot'
              ? 'bg-[radial-gradient(circle_at_2px_2px,white_1px,transparent_1px)] bg-[length:8px_8px]'
              : ''
          }`}
          style={{ opacity: 0.3 }}
        />
      )}

      <div className="relative z-10 flex flex-col h-full">
        {/* Title - always visible */}
        <div className={`font-semibold text-gray-800 leading-tight ${
          isShortEvent ? 'text-xs truncate' : 'text-sm'
        }`}>
          {isShortEvent ? truncateText(event.title, 20) : truncateText(event.title)}
        </div>

        {/* Time - always visible but compact for short events */}
        <div className={`flex items-center text-gray-600 ${
          isShortEvent ? 'text-xs mt-0.5' : 'text-xs mt-1.5'
        }`}>
          <Clock className={`mr-1.5 flex-shrink-0 ${isShortEvent ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
          <span className="truncate">
            {event.isAllDay ? 'All day' : (
              isShortEvent ? (
                // For short events, show compact time
                `${format(event.startTime, "h:mm a")}`
              ) : (
                // For longer events, show full time range
                <>
                  {format(event.startTime, "h:mm a")}
                  {" - "}
                  {format(event.endTime, "h:mm a")}
                </>
              )
            )}
          </span>
        </div>

        {/* Location - only show for medium and long events */}
        {event.location && !isShortEvent && (
          <div className="flex items-center text-xs text-gray-600 mt-1">
            <MapPin className="w-3 h-3 mr-1.5 flex-shrink-0" />
            <span className="truncate">{truncateText(event.location, 20)}</span>
          </div>
        )}

        {/* Spacer for long events */}
        {isLongEvent && <div className="flex-1" />}

        {/* Bottom section - user info and indicators */}
        {!isShortEvent && (
          <div className={`flex items-center justify-between ${
            isMediumEvent ? 'mt-2' : 'mt-3'
          }`}>
            {isLocal && event.createdBy && event.createdBy !== 'external' ? (
              <div className="flex items-center text-xs text-gray-500">
                <User className="w-3 h-3 mr-1" />
                <span className="truncate">
                  {currentUser && currentUser.id === event.createdBy && currentUser.username 
                    ? truncateText(`@${currentUser.username}`, 12)
                    : truncateText(event.createdBy, 12)
                  }
                </span>
              </div>
            ) : (
              <div className="flex items-center text-xs text-gray-500">
                <Lock className="w-3 h-3 mr-1" />
                <span>Read-only</span>
              </div>
            )}

            {/* Visual indicator for event type */}
            <div className="flex items-center space-x-1">
              {event.attendees && event.attendees.length > 0 && (
                <div className="w-2 h-2 rounded-full bg-blue-400" title={`${event.attendees.length} attendees`} />
              )}
              {event.linkedJournalEntryId && (
                <div className="w-2 h-2 rounded-full bg-green-400" title="Linked to journal entry" />
              )}
              {event.reminderMinutes && (
                <div className="w-2 h-2 rounded-full bg-yellow-400" title="Has reminder" />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize handle for local events */}
      {isLocal && (
        <div
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 hover:opacity-100 transition-opacity"
          style={{
            background: `linear-gradient(to bottom, transparent, ${event.color}40)`,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            // TODO: Implement resize functionality
            console.log('Resize started for event:', event.id);
          }}
          role="button"
          aria-label="Resize event"
          tabIndex={-1}
        >
          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-1 bg-gray-400 rounded-full" />
        </div>
      )}

      {/* Tooltip for truncated title or description */}
      {isHovered && (event.title.length > 30 || event.description) && (
        <div
          id={`${event.id}-description`}
          className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg z-20 max-w-xs"
          role="tooltip"
          style={{ minWidth: '200px' }}
        >
          {event.title.length > 30 && (
            <div className="font-semibold mb-1">{event.title}</div>
          )}
          {event.description && (
            <div className="text-gray-300">{event.description}</div>
          )}
          {event.attendees && event.attendees.length > 0 && (
            <div className="text-gray-400 mt-1 text-xs">
              {event.attendees.length} attendee{event.attendees.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}