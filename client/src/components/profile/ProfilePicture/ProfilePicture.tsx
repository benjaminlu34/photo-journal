import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useProfilePicture, getInitials } from '@/hooks/useProfilePicture';
import { useUser } from '@/hooks/useUser';
import { cn } from '@/lib/utils';

interface ProfilePictureProps {
  userId?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showInitials?: boolean;
  fallbackText?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export const ProfilePicture: React.FC<ProfilePictureProps> = ({
  userId,
  size = 'md',
  className,
  showInitials = true,
  fallbackText,
}) => {
  const { data: profileUser } = useUser();
  const targetUserId = userId || profileUser?.id;
  
  const { data: profilePicture, isLoading } = useProfilePicture(targetUserId);
  
  // Determine which user data to use for initials
  const userData = userId ? { id: userId } : profileUser;
  
  if (isLoading) {
    return (
      <div className={cn(
        sizeClasses[size],
        'rounded-full bg-muted animate-pulse',
        className
      )} />
    );
  }

  const initials = fallbackText || getInitials(
    userData?.firstName,
    userData?.lastName,
    userData?.email
  );

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage 
        src={profilePicture || undefined} 
        alt="Profile picture"
        className="object-cover"
      />
      {showInitials && (
        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
          {initials}
        </AvatarFallback>
      )}
    </Avatar>
  );
};