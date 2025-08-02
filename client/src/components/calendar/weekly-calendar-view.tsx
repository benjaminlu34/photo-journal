import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Plus, 
  Settings, 
  Users,
  ChevronLeft, 
  ChevronRight,
  Home
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, isToday } from 'date-fns';
import { useCalendarStore } from '@/lib/calendar-store';
import { CalendarFeedModal } from './calendar-feed-modal';
import { FriendCalendarSyncModal } from './friend-calendar-sync-modal';
import { CreateEventModal } from './create-event-modal';
import { DayColumn } from './day-column';
import { WeekHeader } from './week-header';
import type { WeeklyCalendarViewProps } from '@/types/calendar';

export function WeeklyCalendarView({ 
  initialDate = new Date(),
  username,
  collaborationEnabled = true,
  feedsEnabled = true,
  syncedFriends = []
}: WeeklyCalendarViewProps) {
  const {
    localEvents,
    externalEvents,
    friendEvents,
    feeds,
    syncedFriends: storeSyncedFriends,
    currentWeek,
    isLoading,
    error,
    isFriendSyncModalOpen,
    actions
  } = useCalendarStore();

  const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState(false);
  const [isImportCalendarModalOpen, setIsImportCalendarModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Initialize calendar store
  useEffect(() => {
    const weekId = format(currentWeek, 'yyyy-\'W\'ww');
    actions.init(weekId, username, username, username);
  }, [currentWeek, username, actions]);

  // Load friend events when week changes or synced friends change
  useEffect(() => {
    if (storeSyncedFriends.length > 0) {
      actions.loadFriendEventsForWeek(currentWeek);
    }
  }, [currentWeek, storeSyncedFriends, actions]);

  // Initialize synced friends from props
  useEffect(() => {
    if (syncedFriends.length > 0) {
      syncedFriends.forEach(friendUserId => {
        if (!storeSyncedFriends.includes(friendUserId)) {
          actions.syncFriendCalendar(friendUserId);
        }
      });
    }
  }, [syncedFriends, storeSyncedFriends, actions]);

  const handlePreviousWeek = () => {
    const newWeek = subWeeks(currentWeek, 1);
    actions.setCurrentWeek(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = addWeeks(currentWeek, 1);
    actions.setCurrentWeek(newWeek);
  };

  const handleTodayClick = () => {
    actions.setCurrentWeek(new Date());
  };

  const handleToggleFriendSync = async (friendUserId: string, enabled: boolean) => {
    try {
      if (enabled) {
        await actions.syncFriendCalendar(friendUserId);
      } else {
        await actions.unsyncFriendCalendar(friendUserId);
      }
    } catch (error) {
      console.error('Error toggling friend sync:', error);
    }
  };

  const handleRefreshFriend = async (friendUserId: string) => {
    try {
      await actions.refreshFriendEvents(friendUserId);
    } catch (error) {
      console.error('Error refreshing friend events:', error);
    }
  };

  // Get all events for the week
  const getAllEvents = () => {
    const allEvents = [];
    
    // Add local events
    Object.values(localEvents).forEach(event => {
      allEvents.push({ ...event, eventType: 'local' });
    });
    
    // Add external events
    Object.values(externalEvents).flat().forEach(event => {
      allEvents.push({ ...event, eventType: 'external' });
    });
    
    // Add friend events
    Object.values(friendEvents).flat().forEach(event => {
      allEvents.push({ ...event, eventType: 'friend' });
    });
    
    return allEvents;
  };

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekDays = [];
  
  // Generate array of days for the week
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDays.push(date);
  }

  const allEvents = getAllEvents();
  const syncedFriendCount = storeSyncedFriends.length;

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-purple-50/30 via-pink-50/20 to-blue-50/30">
      {/* Header */}
      <div className="flex-none p-4 border-b border-gray-200/50 bg-white/80 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Calendar className="w-6 h-6 text-purple-600" />
              Weekly Calendar
            </h1>
            
            {/* Week navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePreviousWeek}
                className="neu-card p-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextWeek}
                className="neu-card p-2"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleTodayClick}
                className="neu-card text-sm"
              >
                <Home className="w-4 h-4 mr-1" />
                Today
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Friend sync indicator */}
            {feedsEnabled && syncedFriendCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700">
                <Users className="w-3 h-3 mr-1" />
                {syncedFriendCount} friend{syncedFriendCount !== 1 ? 's' : ''} synced
              </Badge>
            )}

            {/* Action buttons */}
            <Button
              onClick={() => setIsCreateEventModalOpen(true)}
              size="sm"
              className="neu-card bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Event
            </Button>

            {feedsEnabled && (
              <>
                <Button
                  onClick={() => actions.setFriendSyncModalOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="neu-card"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Friends
                </Button>

                <Button
                  onClick={() => setIsImportCalendarModalOpen(true)}
                  size="sm"
                  variant="ghost"
                  className="neu-card"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Feeds
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
            {error}
          </div>
        )}
      </div>

      {/* Week Header */}
      <WeekHeader
        currentWeek={currentWeek}
        onWeekChange={actions.setCurrentWeek}
        onTodayClick={handleTodayClick}
        hasJournalEntries={weekDays.map(() => false)} // TODO: Implement journal entry checking
        showRecurrenceBanner={false} // TODO: Implement feature flag
      />

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 h-full min-h-[600px]">
          {weekDays.map((date, index) => (
            <DayColumn
              key={date.toISOString()}
              date={date}
              events={allEvents.filter(event => {
                const eventDate = new Date(event.startTime);
                return eventDate.toDateString() === date.toDateString();
              })}
              localEvents={Object.values(localEvents).filter(event => {
                const eventDate = new Date(event.startTime);
                return eventDate.toDateString() === date.toDateString();
              })}
              onEventClick={(event) => {
                // TODO: Implement event click handling
                console.log('Event clicked:', event);
              }}
              onEventDrag={(eventId, newTime, deltaMinutes) => {
                // TODO: Implement event drag handling
                console.log('Event dragged:', eventId, newTime, deltaMinutes);
              }}
              onEventResize={(eventId, newEndTime) => {
                // TODO: Implement event resize handling
                console.log('Event resized:', eventId, newEndTime);
              }}
              isToday={isToday(date)}
              hasJournalEntry={false} // TODO: Implement journal entry checking
              gridSnapMinutes={15}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {isCreateEventModalOpen && (
        <CreateEventModal
          isOpen={isCreateEventModalOpen}
          onClose={() => setIsCreateEventModalOpen(false)}
          selectedDate={selectedDate}
        />
      )}

      {isImportCalendarModalOpen && (
        <CalendarFeedModal
          isOpen={isImportCalendarModalOpen}
          onClose={() => setIsImportCalendarModalOpen(false)}
          existingFeeds={feeds}
        />
      )}

      {isFriendSyncModalOpen && (
        <FriendCalendarSyncModal
          isOpen={isFriendSyncModalOpen}
          onClose={() => actions.setFriendSyncModalOpen(false)}
          syncedFriends={storeSyncedFriends}
          onToggleSync={handleToggleFriendSync}
          onRefreshFriend={handleRefreshFriend}
        />
      )}
    </div>
  );
}
