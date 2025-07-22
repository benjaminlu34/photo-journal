import React from 'react';
import { cn } from '@/lib/utils';
import { InlineUsername } from '@/components/ui/user-display';
import { useTimestamp, formatRelativeTime } from '@/hooks/useTimestamp';
import type { NoteCreator } from '@/types/notes';
import type { UserDisplayData } from '@/lib/usernameUtils';

export interface NoteAttributionProps {
  creator?: NoteCreator;
  createdAt?: string;
  className?: string;
  variant?: 'full' | 'compact' | 'minimal';
  showTimestamp?: boolean;
}

/**
 * Note attribution component that shows the username of the note creator
 */
export function NoteAttribution({
  creator,
  createdAt,
  className,
  variant = 'compact',
  showTimestamp = true,
}: NoteAttributionProps) {
  if (!creator) {
    return null;
  }

  const userDisplayData: UserDisplayData = {
    id: creator.id,
    username: creator.username,
    firstName: creator.firstName,
    lastName: creator.lastName,
    email: creator.email,
  };

  const currentTime = useTimestamp();

  if (variant === 'minimal') {
    return (
      <div className={cn('text-xs text-gray-500', className)}>
        <InlineUsername user={userDisplayData} className="text-xs" />
      </div>
    );
  }

  if (variant === 'full') {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded', className)}>
        <span>Created by</span>
        <InlineUsername user={userDisplayData} className="text-xs" />
        {showTimestamp && createdAt && (
          <>
            <span>•</span>
            <span>{formatRelativeTime(createdAt, currentTime)}</span>
          </>
        )}
      </div>
    );
  }

  // Default: compact variant
  return (
    <div className={cn('flex items-center gap-1 text-xs text-gray-500', className)}>
      <InlineUsername user={userDisplayData} className="text-xs" />
      {showTimestamp && createdAt && (
        <>
          <span>•</span>
          <span>{formatRelativeTime(createdAt, currentTime)}</span>
        </>
      )}
    </div>
  );
}

/**
 * Floating note attribution that appears on hover at the bottom of the note
 */
export function FloatingNoteAttribution({
  creator,
  createdAt,
  className,
}: Omit<NoteAttributionProps, 'variant'>) {
  if (!creator) {
    return null;
  }

  return (
    <div className={cn(
      'absolute top-full left-0 right-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10',
      'bg-white/90 backdrop-blur-sm rounded px-2 py-1 shadow-sm border border-gray-200 text-center',
      className
    )}>
      <NoteAttribution
        creator={creator}
        createdAt={createdAt}
        variant="compact"
        showTimestamp={true}
      />
    </div>
  );
}