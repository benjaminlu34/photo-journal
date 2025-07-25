import React from 'react';
import { cn } from '@/lib/utils';
import { getUserDisplayName, getShortDisplayName, getUserInitials, type UserDisplayData } from '@/lib/usernameUtils';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';

export interface UserDisplayProps {
  user: UserDisplayData;
  variant?: 'full' | 'short' | 'initials-only';
  size?: 'sm' | 'md' | 'lg';
  showAvatar?: boolean;
  className?: string;
  avatarClassName?: string;
  textClassName?: string;
  style?: React.CSSProperties;
}

/**
 * UserDisplay component for showing usernames with @ prefix and consistent formatting
 */
export function UserDisplay({
  user,
  variant = 'full',
  size = 'md',
  showAvatar = true,
  className,
  avatarClassName,
  textClassName,
  style,
}: UserDisplayProps) {
  const displayName = variant === 'short' ? getShortDisplayName(user) : getUserDisplayName(user);
  const initials = getUserInitials(user);

  const sizeClasses = {
    sm: {
      container: 'gap-1.5',
      avatar: 'w-6 h-6 text-xs',
      text: 'text-xs',
    },
    md: {
      container: 'gap-2',
      avatar: 'w-8 h-8 text-sm',
      text: 'text-sm',
    },
    lg: {
      container: 'gap-3',
      avatar: 'w-10 h-10 text-base',
      text: 'text-base',
    },
  };

  const sizes = sizeClasses[size];

  if (variant === 'initials-only') {
    return (
      <ProfilePicture
        userId={user.id}
        size={size}
        className={cn(avatarClassName)}
        fallbackText={initials}
      />
    );
  }

  return (
    <div className={cn('inline-flex items-center', sizes.container, className)} style={style}>
      {showAvatar && (
        <ProfilePicture
          userId={user.id}
          size={size}
          className={cn(avatarClassName)}
          fallbackText={initials}
        />
      )}
      <span
        className={cn(
          'font-medium text-gray-800 truncate',
          sizes.text,
          textClassName
        )}
      >
        {displayName}
      </span>
    </div>
  );
}

/**
 * Lightweight username display for inline use
 */
export function InlineUsername({ 
  user, 
  className 
}: { 
  user: UserDisplayData; 
  className?: string; 
}) {
  const displayName = getUserDisplayName(user);
  
  return (
    <span className={cn('font-medium text-purple-600', className)}>
      {displayName}
    </span>
  );
}

/**
 * User avatar only component
 */
export function UserAvatar({ 
  user, 
  size = 'md', 
  className 
}: { 
  user: UserDisplayData; 
  size?: 'sm' | 'md' | 'lg'; 
  className?: string; 
}) {
  return (
    <UserDisplay
      user={user}
      variant="initials-only"
      size={size}
      showAvatar={false}
      avatarClassName={className}
    />
  );
}