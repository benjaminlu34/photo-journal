import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { UserDisplay } from '@/components/ui/user-display';
import { useBoardStore } from '@/lib/board-store';
import type { UserDisplayData } from '@/lib/usernameUtils';

interface CollaborationCursorProps {
  className?: string;
}

interface AwarenessUser {
  id: string;
  name: string;
  username?: string;
  displayName?: string;
  color: string;
}

/**
 * Collaboration cursor component that shows usernames of active collaborators
 */
export function CollaborationCursor({ className }: CollaborationCursorProps) {
  const { sdk } = useBoardStore();
  const [activeUsers, setActiveUsers] = useState<AwarenessUser[]>([]);

  useEffect(() => {
    if (!sdk?.presence) return;

    const awareness = sdk.presence;

    const updateActiveUsers = () => {
      const states = awareness.getStates();
      const users: AwarenessUser[] = [];
      
      states.forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          users.push(state.user as AwarenessUser);
        }
      });
      
      setActiveUsers(users);
    };

    // Initial update
    updateActiveUsers();

    // Listen for changes
    awareness.on('change', updateActiveUsers);

    return () => {
      awareness.off('change', updateActiveUsers);
    };
  }, [sdk]);

  if (activeUsers.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2 p-2 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-purple-100', className)}>
      <span className="text-xs text-gray-600 font-medium">Active:</span>
      <div className="flex items-center gap-1">
        {activeUsers.map((user) => {
          const userDisplayData: UserDisplayData = {
            id: user.id,
            username: user.username,
            firstName: user.name,
          };

          return (
            <div
              key={user.id}
              className="flex items-center gap-1"
              style={{ color: user.color }}
            >
              <UserDisplay
                user={userDisplayData}
                variant="short"
                size="sm"
                showAvatar={true}
                className="text-xs"
                avatarClassName="border-2 border-current"
                style={{ color: user.color }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Floating collaboration cursors that show live user positions
 */
export function FloatingCollaborationCursors() {
  const { sdk } = useBoardStore();
  const [cursors, setCursors] = useState<Array<AwarenessUser & { x: number; y: number }>>([]);

  useEffect(() => {
    if (!sdk?.presence) return;

    const awareness = sdk.presence;

    const updateCursors = () => {
      const states = awareness.getStates();
      const newCursors: Array<AwarenessUser & { x: number; y: number }> = [];
      
      states.forEach((state, clientId) => {
        if (state.user && state.cursor && clientId !== awareness.clientID) {
          newCursors.push({
            ...(state.user as AwarenessUser),
            x: state.cursor.x,
            y: state.cursor.y,
          });
        }
      });
      
      setCursors(newCursors);
    };

    // Listen for changes
    awareness.on('change', updateCursors);

    return () => {
      awareness.off('change', updateCursors);
    };
  }, [sdk]);

  return (
    <>
      {cursors.map((cursor) => {
        const userDisplayData: UserDisplayData = {
          id: cursor.id,
          username: cursor.username,
          firstName: cursor.name,
        };

        return (
          <div
            key={cursor.id}
            className="fixed pointer-events-none z-50 transition-all duration-100"
            style={{
              left: cursor.x,
              top: cursor.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            {/* Cursor pointer */}
            <div
              className="w-4 h-4 rotate-45 border-2 border-white shadow-lg"
              style={{ backgroundColor: cursor.color }}
            />
            
            {/* Username label */}
            <div
              className="mt-1 px-2 py-1 rounded text-white text-xs font-medium shadow-lg whitespace-nowrap"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.displayName || cursor.username ? `@${cursor.username}` : cursor.name}
            </div>
          </div>
        );
      })}
    </>
  );
}