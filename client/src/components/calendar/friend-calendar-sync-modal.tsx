import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Calendar,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Eye,
  UserX
} from "lucide-react";
import { format } from "date-fns";
import type { Friend } from "@/types/journal";
import { friendCalendarService } from "@/services/friend-calendar.service";
import { useCalendarStore } from "@/lib/calendar-store";
import { generateFriendColor } from "@/utils/colorUtils/colorUtils";

interface FriendCalendarSyncItem {
  friend: Friend;
  isSynced: boolean;
  lastSyncAt?: Date;
  syncError?: string;
  eventCount: number;
  canSync: boolean; // Based on friendship permissions (viewer+ required)
  assignedColor: string; // Auto-assigned distinct color to avoid collisions
  isRefreshing?: boolean;
}

interface FriendCalendarSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncedFriends: string[]; // Currently synced friend user IDs
  onToggleSync: (friendUserId: string, enabled: boolean) => Promise<void>;
  onRefreshFriend: (friendUserId: string) => Promise<void>;
}

export function FriendCalendarSyncModal({
  isOpen,
  onClose,
  syncedFriends,
  onToggleSync,
  onRefreshFriend
}: FriendCalendarSyncModalProps) {
  const [activeTab, setActiveTab] = useState("sync");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingFriends, setRefreshingFriends] = useState<Set<string>>(new Set());
  const [showConsentBanner, setShowConsentBanner] = useState(false);
  const [recentlyEnabledFriends, setRecentlyEnabledFriends] = useState<Friend[]>([]);

  const { actions } = useCalendarStore();

  // Load friends with calendar access on mount
  const loadFriendsWithCalendarAccess = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const friendsWithAccess = await friendCalendarService.getFriendsWithCalendarAccess();
      setFriends(friendsWithAccess);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load friends';
      setError(errorMessage);
      console.error('Error loading friends with calendar access:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadFriendsWithCalendarAccess();
    }
  }, [isOpen, loadFriendsWithCalendarAccess]);

  // Memoize syncItems to avoid unnecessary re-renders
  // NOTE: lastSyncAt is mock data until wired to real state (friend lastSync from store).
  const syncItems = useMemo(() => {
    return friends.map(friend => {
      const isSynced = syncedFriends.includes(friend.id);

      return {
        friend,
        isSynced,
        // MOCK: Show a placeholder string rather than a misleading timestamp.
        lastSyncLabel: isSynced ? 'Last synced: mock' : undefined,
        syncError: undefined,
        eventCount: isSynced ? Math.floor(Math.random() * 20) : 0, // Mock data
        canSync: true, // In real implementation, check permissions from store/service
        assignedColor: generateFriendColor(friend.id),
        isRefreshing: refreshingFriends.has(friend.id)
      };
    });
  }, [friends, syncedFriends, refreshingFriends, generateFriendColor]);



  const handleToggleSync = async (friend: Friend, enabled: boolean) => {
    try {
      setError(null);
      
      if (enabled) {
        // Check permissions before enabling
        const canAccess = await friendCalendarService.canViewFriendCalendar(friend.id);
        if (!canAccess) {
          setError(`You don't have permission to view ${friend.firstName || friend.lastName || 'this friend'}'s calendar`);
          return;
        }
        
        // Show consent banner for newly enabled friends (only if not previously dismissed)
        const hasDismissedConsent = localStorage.getItem('friend-calendar-consent-dismissed') === 'true';
        setRecentlyEnabledFriends(prev => {
          // Prevent duplicate friends in the array
          if (!prev.some(f => f.id === friend.id)) {
            return [...prev, friend];
          }
          return prev;
        });
        setShowConsentBanner(!hasDismissedConsent);
      }
      
      await onToggleSync(friend.id, enabled);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle sync';
      setError(errorMessage);
      console.error('Error toggling friend calendar sync:', error);
    }
  };

  const handleRefreshFriend = async (friend: Friend) => {
    try {
      setError(null);
      setRefreshingFriends(prev => new Set(prev).add(friend.id));
      
      await onRefreshFriend(friend.id);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to refresh';
      setError(errorMessage);
      
      
      console.error('Error refreshing friend calendar:', error);
    } finally {
      setRefreshingFriends(prev => {
        const newSet = new Set(prev);
        newSet.delete(friend.id);
        return newSet;
      });
    }
  };


  const getSyncStatusIcon = (item: FriendCalendarSyncItem) => {
    if (item.isRefreshing) {
      return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (item.syncError) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    
    if (item.isSynced) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    return <UserX className="w-4 h-4 text-gray-400" />;
  };

  const dismissConsentBanner = () => {
    setShowConsentBanner(false);
    setRecentlyEnabledFriends([]);
    
    // Store preference in localStorage
    localStorage.setItem('friend-calendar-consent-dismissed', 'true');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl neu-card max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Friend Calendar Sync
          </DialogTitle>
          <DialogDescription>
            Sync calendars from friends who have granted you access. Your events will be visible to synced friends.
          </DialogDescription>
        </DialogHeader>

        {/* Consent Banner */}
        {showConsentBanner && recentlyEnabledFriends.length > 0 && (
          <Alert className="mb-4 neu-card border-blue-200 bg-blue-50">
            <Eye className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                Your events are now visible to{' '}
                {recentlyEnabledFriends.map(f => f.firstName || f.lastName || 'friend').join(', ')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={dismissConsentBanner}
                className="text-blue-600 hover:text-blue-700"
              >
                Got it
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Error Alert */}
        {error && (
          <Alert className="mb-4 neu-card border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-700">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 neu-card">
            <TabsTrigger value="sync" className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Sync Settings
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Sync Status
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="sync" className="h-full overflow-y-auto space-y-4 mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="ml-2 text-gray-600">Loading friends...</span>
                </div>
              ) : syncItems.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No friends with calendar access found.</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Friends need viewer+ permissions to share calendars.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {syncItems.map((item) => (
                    <Card key={item.friend.id} className="neu-card">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: item.assignedColor }}
                            />
                            <div className="flex items-center gap-2">
                              {item.friend.profileImageUrl ? (
                                <img
                                  src={item.friend.profileImageUrl}
                                  alt={`${item.friend.firstName || item.friend.lastName || 'Friend'}'s profile`}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                  <Users className="w-4 h-4 text-gray-500" />
                                </div>
                              )}
                              <div>
                                <h4 className="font-medium text-gray-800">
                                  {item.friend.firstName || item.friend.lastName || 'Friend'}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                  {getSyncStatusIcon(item)}
                                  <span className="text-xs text-gray-500">
                                    {item.isSynced ? (
                                      `${item.eventCount} events synced`
                                    ) : (
                                      'Not synced'
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {item.isSynced && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRefreshFriend(item.friend)}
                                disabled={item.isRefreshing}
                                className="neu-card p-2"
                              >
                                <RefreshCw className={`w-4 h-4 ${item.isRefreshing ? 'animate-spin' : ''}`} />
                              </Button>
                            )}
                            
                            <Switch
                              checked={item.isSynced}
                              onCheckedChange={(checked) => handleToggleSync(item.friend, checked)}
                              disabled={!item.canSync || item.isRefreshing}
                            />
                          </div>
                        </div>

                        {item.syncError && (
                          <div className="mt-2 p-2 bg-red-50 rounded-md">
                            <p className="text-xs text-red-600">{item.syncError}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="status" className="h-full overflow-y-auto space-y-4 mt-4">
              <div className="space-y-3">
                {syncItems.filter(item => item.isSynced).map((item) => (
                  <Card key={item.friend.id} className="neu-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: item.assignedColor }}
                          />
                          <div>
                            <h4 className="font-medium text-gray-800">
                              {item.friend.firstName || item.friend.lastName || 'Friend'}
                            </h4>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {item.eventCount} events
                              </span>
                              {item.lastSyncLabel && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {item.lastSyncLabel}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              item.syncError ? 'bg-red-100 text-red-700' : 
                              item.isRefreshing ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}
                          >
                            {item.syncError ? 'Error' : 
                             item.isRefreshing ? 'Syncing...' : 'Active'}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {syncItems.filter(item => item.isSynced).length === 0 && (
                  <div className="text-center py-8">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No friend calendars synced yet.</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Enable sync for friends to see their events here.
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200">
          <Button
            variant="ghost"
            onClick={loadFriendsWithCalendarAccess}
            disabled={isLoading}
            className="neu-card text-sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh List
          </Button>
          
          <Button
            onClick={onClose}
            className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:from-[hsl(var(--primary))] hover:to-[hsl(var(--accent))] text-white shadow-neu hover:shadow-neu-lg transition-all"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
