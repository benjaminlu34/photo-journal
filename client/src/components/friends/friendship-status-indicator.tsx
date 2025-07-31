import React from 'react';
import { 
  UserPlus, 
  UserCheck, 
  UserX, 
  Clock, 
  Shield,
  Eye,
  Edit3,
  Ban
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export type FriendshipStatus = 
  | 'none' 
  | 'pending_sent' 
  | 'pending_received' 
  | 'accepted' 
  | 'blocked' 
  | 'declined'
  | 'unfriended';

export type FriendshipRole = 'viewer' | 'contributor' | 'editor';

interface FriendshipStatusIndicatorProps {
  status: FriendshipStatus;
  role?: FriendshipRole;
  className?: string;
  variant?: 'badge' | 'button' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  showRole?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  none: {
    label: 'Add Friend',
    icon: UserPlus,
    color: 'default',
    description: 'Send a friend request'
  },
  pending_sent: {
    label: 'Request Sent',
    icon: Clock,
    color: 'secondary',
    description: 'Friend request pending'
  },
  pending_received: {
    label: 'Accept Request',
    icon: UserPlus,
    color: 'default',
    description: 'Accept friend request'
  },
  accepted: {
    label: 'Friends',
    icon: UserCheck,
    color: 'success',
    description: 'You are friends'
  },
  blocked: {
    label: 'Blocked',
    icon: Ban,
    color: 'destructive',
    description: 'User is blocked'
  },
  declined: {
    label: 'Declined',
    icon: UserX,
    color: 'secondary',
    description: 'Friend request was declined'
  },
  unfriended: {
    label: 'Unfriended',
    icon: UserX,
    color: 'secondary',
    description: 'Previously friends'
  }
} as const;

const ROLE_CONFIG = {
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'secondary',
    description: 'Can view shared content'
  },
  contributor: {
    label: 'Contributor',
    icon: Edit3,
    color: 'default',
    description: 'Can view and add content'
  },
  editor: {
    label: 'Editor',
    icon: Shield,
    color: 'success',
    description: 'Full editing permissions'
  }
} as const;

export function FriendshipStatusIndicator({
  status,
  role,
  className,
  variant = 'badge',
  size = 'md',
  showRole = false,
  onClick,
  disabled = false
}: FriendshipStatusIndicatorProps) {
  const statusConfig = STATUS_CONFIG[status];
  const roleConfig = role ? ROLE_CONFIG[role] : null;
  
  const StatusIcon = statusConfig.icon;
  const RoleIcon = roleConfig?.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  if (variant === 'icon') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("inline-flex items-center", className)}>
              <StatusIcon 
                className={cn(
                  iconSizes[size],
                  statusConfig.color === 'success' && 'text-green-600',
                  statusConfig.color === 'destructive' && 'text-red-600',
                  statusConfig.color === 'secondary' && 'text-muted-foreground',
                  statusConfig.color === 'default' && 'text-primary'
                )}
              />
              {showRole && roleConfig && RoleIcon && (
                <RoleIcon 
                  className={cn(
                    iconSizes[size],
                    "ml-1",
                    roleConfig.color === 'success' && 'text-green-600',
                    roleConfig.color === 'secondary' && 'text-muted-foreground',
                    roleConfig.color === 'default' && 'text-primary'
                  )}
                />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-center">
              <p className="font-medium">{statusConfig.label}</p>
              <p className="text-xs text-muted-foreground">{statusConfig.description}</p>
              {showRole && roleConfig && (
                <p className="text-xs text-muted-foreground mt-1">
                  Role: {roleConfig.label}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        variant={statusConfig.color === 'destructive' ? 'destructive' : 
                statusConfig.color === 'success' ? 'default' : 'outline'}
        size={size === 'md' ? 'default' : size}
        onClick={onClick}
        disabled={disabled || status === 'blocked'}
        className={cn(sizeClasses[size], className)}
      >
        <StatusIcon className={cn(iconSizes[size], "mr-2")} />
        {statusConfig.label}
        {showRole && roleConfig && (
          <>
            <span className="mx-2">•</span>
            {RoleIcon && <RoleIcon className={cn(iconSizes[size], "mr-1")} />}
            {roleConfig.label}
          </>
        )}
      </Button>
    );
  }

  // Default badge variant
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Badge 
        variant={
          statusConfig.color === 'success' ? 'default' :
          statusConfig.color === 'destructive' ? 'destructive' :
          'secondary'
        }
        className={cn(
          sizeClasses[size],
          statusConfig.color === 'success' && 'bg-green-100 text-green-800 hover:bg-green-200',
          onClick && 'cursor-pointer hover:opacity-80'
        )}
        onClick={onClick}
      >
        <StatusIcon className={cn(iconSizes[size], "mr-1")} />
        {statusConfig.label}
      </Badge>
      
      {showRole && roleConfig && status === 'accepted' && (
        <Badge 
          variant="outline"
          className={cn(
            sizeClasses[size],
            roleConfig.color === 'success' && 'border-green-200 text-green-700',
            roleConfig.color === 'default' && 'border-primary/20 text-primary'
          )}
        >
          {RoleIcon && <RoleIcon className={cn(iconSizes[size], "mr-1")} />}
          {roleConfig.label}
        </Badge>
      )}
    </div>
  );
}

// Utility function to determine friendship status from API response
export function getFriendshipStatus(
  friendship: any,
  currentUserId: string
): { status: FriendshipStatus; role?: FriendshipRole } {
  if (!friendship) {
    return { status: 'none' };
  }

  const { status: friendshipStatus, initiatorId, userId, friendId, roleUserToFriend, roleFriendToUser } = friendship;

  // Determine if current user is the initiator
  const isInitiator = initiatorId === currentUserId;
  
  // Determine role based on user position in canonical friendship
  const role = currentUserId === userId ? roleFriendToUser : roleUserToFriend;

  switch (friendshipStatus) {
    case 'pending':
      return { 
        status: isInitiator ? 'pending_sent' : 'pending_received',
        role: role as FriendshipRole
      };
    case 'accepted':
      return { 
        status: 'accepted',
        role: role as FriendshipRole
      };
    case 'blocked':
      return { status: 'blocked' };
    case 'declined':
      return { status: 'declined' };
    case 'unfriended':
      return { status: 'unfriended' };
    default:
      return { status: 'none' };
  }
}

// Component for displaying friendship status in search results
interface SearchResultStatusProps {
  friendship: any;
  currentUserId: string;
  onAction?: (action: 'add' | 'accept' | 'view') => void;
  className?: string;
}

export function SearchResultStatus({ 
  friendship, 
  currentUserId, 
  onAction,
  className 
}: SearchResultStatusProps) {
  const { status, role } = getFriendshipStatus(friendship, currentUserId);

  const handleClick = () => {
    switch (status) {
      case 'none':
        onAction?.('add');
        break;
      case 'pending_received':
        onAction?.('accept');
        break;
      case 'accepted':
        onAction?.('view');
        break;
    }
  };

  // Don't show anything for blocked users (security through obscurity)
  if (status === 'blocked') {
    return null;
  }

  return (
    <FriendshipStatusIndicator
      status={status}
      role={role}
      variant="button"
      size="sm"
      showRole={status === 'accepted'}
      onClick={handleClick}
      className={className}
    />
  );
}