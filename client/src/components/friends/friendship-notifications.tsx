import React, { useEffect, useState } from 'react';
import { 
  Bell, 
  UserPlus, 
  UserCheck, 
  UserX, 
  Settings,
  X,
  Check,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProfilePicture } from '@/components/profile/ProfilePicture/ProfilePicture';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  useFriendshipEvents, 
  formatFriendshipEventMessage,
  getFriendshipEventNotificationType,
  type FriendshipEvent 
} from '@/hooks/useFriendshipEvents';
import { cn } from '@/lib/utils';

interface FriendshipNotification extends FriendshipEvent {
  id: string;
  read: boolean;
  createdAt: Date;
}

interface FriendshipNotificationsProps {
  className?: string;
  maxNotifications?: number;
  autoMarkAsRead?: boolean;
}

const NOTIFICATION_STORAGE_KEY = 'friendship_notifications';
const MAX_STORED_NOTIFICATIONS = 50;

export function FriendshipNotifications({ 
  className,
  maxNotifications = 10,
  autoMarkAsRead = true
}: FriendshipNotificationsProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<FriendshipNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const notifications = parsed.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
          createdAt: new Date(n.createdAt)
        }));
        setNotifications(notifications);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  // Save notifications to localStorage
  const saveNotifications = (notifications: FriendshipNotification[]) => {
    try {
      const toStore = notifications
        .slice(0, MAX_STORED_NOTIFICATIONS)
        .map(n => ({
          ...n,
          timestamp: n.timestamp.toISOString(),
          createdAt: n.createdAt.toISOString()
        }));
      localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(toStore));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  };

  // Add new notification
  const addNotification = (event: FriendshipEvent) => {
    const notification: FriendshipNotification = {
      ...event,
      id: `${event.type}_${event.friendshipId}_${Date.now()}`,
      read: false,
      createdAt: new Date()
    };

    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, MAX_STORED_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });

    // Show toast notification
    const message = formatFriendshipEventMessage(event);
    const type = getFriendshipEventNotificationType(event);
    
    toast({
      title: "Friend Activity",
      description: message,
      variant: type === 'error' ? 'destructive' : 'default',
    });
  };

  // Mark notification as read
  const markAsRead = (notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
  };

  // Mark all as read
  const markAllAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  // Clear all notifications
  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem(NOTIFICATION_STORAGE_KEY);
  };

  // Handle popover open/close
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    
    if (open && autoMarkAsRead) {
      // Mark visible notifications as read after a short delay
      setTimeout(() => {
        const unreadIds = notifications
          .slice(0, maxNotifications)
          .filter(n => !n.read)
          .map(n => n.id);
        
        unreadIds.forEach(markAsRead);
      }, 1000);
    }
  };

  // Set up friendship event handlers
  useFriendshipEvents({
    onFriendRequestReceived: addNotification,
    onFriendRequestSent: addNotification,
    onFriendAccepted: addNotification,
    onFriendDeclined: addNotification,
    onFriendBlocked: addNotification,
    onFriendUnfriended: addNotification,
    onFriendRoleChanged: addNotification,
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const visibleNotifications = notifications.slice(0, maxNotifications);

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="neu"
          size="sm"
          className={cn("relative", className)}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Friend Activity
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {unreadCount} new
                  </Badge>
                )}
              </CardTitle>
              
              {notifications.length > 0 && (
                <div className="flex gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="h-6 px-2 text-xs"
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAll}
                    className="h-6 px-2 text-xs text-muted-foreground"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground text-sm">No friend activity yet</p>
              </div>
            ) : (
              <ScrollArea className="h-80">
                <div className="space-y-1 p-2">
                  {visibleNotifications.map((notification, index) => (
                    <React.Fragment key={notification.id}>
                      <NotificationItem
                        notification={notification}
                        onMarkAsRead={() => markAsRead(notification.id)}
                      />
                      {index < visibleNotifications.length - 1 && (
                        <Separator className="my-1" />
                      )}
                    </React.Fragment>
                  ))}
                  
                  {notifications.length > maxNotifications && (
                    <div className="text-center py-2">
                      <p className="text-xs text-muted-foreground">
                        {notifications.length - maxNotifications} more notifications
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
}

interface NotificationItemProps {
  notification: FriendshipNotification;
  onMarkAsRead: () => void;
}

function NotificationItem({ notification, onMarkAsRead }: NotificationItemProps) {
  const message = formatFriendshipEventMessage(notification);
  const type = getFriendshipEventNotificationType(notification);
  
  const getIcon = () => {
    switch (notification.type) {
      case 'friend_request_received':
      case 'friend_request_sent':
        return UserPlus;
      case 'friend_accepted':
        return UserCheck;
      case 'friend_declined':
      case 'friend_blocked':
      case 'friend_unfriended':
        return UserX;
      case 'friend_role_changed':
        return Settings;
      default:
        return Bell;
    }
  };

  const Icon = getIcon();
  const timeAgo = getTimeAgo(notification.createdAt);

  return (
    <div 
      className={cn(
        "flex items-start gap-3 p-2 rounded-lg transition-colors cursor-pointer",
        !notification.read && "bg-accent/50",
        "hover:bg-accent/70"
      )}
      onClick={onMarkAsRead}
    >
      <div className={cn(
        "p-1.5 rounded-full",
        type === 'success' && "bg-green-100 text-green-600",
        type === 'error' && "bg-red-100 text-red-600",
        type === 'warning' && "bg-yellow-100 text-yellow-600",
        type === 'info' && "bg-blue-100 text-blue-600"
      )}>
        <Icon className="h-3 w-3" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {notification.metadata?.username && (
            <ProfilePicture
              userId={notification.metadata.username || ''}
              size="sm"
              fallbackText={notification.metadata.username}
            />
          )}
          {!notification.read && (
            <div className="w-2 h-2 bg-primary rounded-full" />
          )}
        </div>
        
        <p className="text-sm text-foreground leading-tight mt-1">
          {message}
        </p>
        
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo}
          </p>
          
          {notification.type === 'friend_role_changed' && notification.metadata && (
            <Badge variant="outline" className="text-xs">
              {notification.metadata.oldRole} → {notification.metadata.newRole}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });
}