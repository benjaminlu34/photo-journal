import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Globe, Users, Plus, Trash2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { add, sub, format, startOfWeek, endOfWeek } from "date-fns";
import { availableColors } from "@shared/config/calendar-config";
import type { CalendarFeed, CalendarEvent } from "@/types/calendar";
import { useCalendar } from "@/contexts/calendar-context";
import { calendarFeedService } from "@/services/calendar-feed.service";

interface CalendarFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarFeedModal({ isOpen, onClose }: CalendarFeedModalProps) {
  const { feeds, actions } = useCalendar();
  const [activeTab, setActiveTab] = useState("feeds");

  // iCal feed form state
  const [icalFormData, setIcalFormData] = useState({
    name: "",
    url: "",
    color: "#3B82F6"
  });

  // Google Calendar form state
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // Friend calendar state
  const [friendSearchQuery, setFriendSearchQuery] = useState("");

  // Helper: compute current ±2 week window
  const computeTwoWeekWindow = useCallback(() => {
    const now = new Date();
    const start = sub(startOfWeek(now, { weekStartsOn: 0 }), { days: 14 });
    const end = add(endOfWeek(now, { weekStartsOn: 0 }), { days: 14 });
    return { now, start, end };
  }, []);

  const handleAddIcalFeed = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!icalFormData.name.trim() || !icalFormData.url.trim()) {
      return;
    }

    // Determine current ±2 week window
    const { now, start: windowStart, end: windowEnd } = computeTwoWeekWindow();

    // Generate feedId outside try so we can use it in catch
    const feedId = crypto.randomUUID();

    try {
      // Persist feed first in store
      const newFeed: CalendarFeed = {
        id: feedId,
        name: icalFormData.name.trim(),
        type: 'ical',
        url: icalFormData.url.trim(),
        color: icalFormData.color,
        isEnabled: true,
        lastSyncAt: new Date(),
        syncError: undefined
      };
      actions.addFeed(newFeed);

      // Use unified service to fetch events for the window
      const events = await calendarFeedService.fetchFeedEvents(newFeed, { start: windowStart, end: windowEnd });

      // Recurrence expansion and de-duplication
      const expanded = await calendarFeedService.expandRecurringEvents(events, now);
      const deduped = calendarFeedService.resolveEventDuplicates(expanded);

      // Merge into store
      actions.addExternalEvents(newFeed.id, deduped);

      // Update last sync meta if store exposes it
      actions.updateFeedMeta?.(newFeed.id, { lastSyncAt: new Date(), syncError: undefined });

      // Reset form
      setIcalFormData({ name: "", url: "", color: "#3B82F6" });
    } catch (error) {
      console.error('Failed to add iCal feed:', error);
      // Surface sync error if store supports it
      actions.updateFeedMeta?.(feedId, { syncError: 'Failed to add calendar feed. Please check the URL and try again.' });
      actions.setError('Failed to add calendar feed. Please check the URL and try again.');
    }
  };

  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      // Begin OAuth by opening the Google consent page
      const redirectUri = window.location.origin + '/oauth/google/callback';
      const authUrl = calendarFeedService.getGoogleAuthUrl(redirectUri);

      // Open a popup for OAuth
      const popup = window.open(authUrl, 'google-oauth', 'width=480,height=700');
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups and try again.');
      }

      // Wait for postMessage from the callback page with code
      const code: string = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('message', onMessage);
          reject(new Error('OAuth timed out'));
        }, 120000);
        function onMessage(ev: MessageEvent) {
          // Security: Verify message origin to prevent malicious code injection
          if (ev.origin !== window.location.origin) {
            return;
          }
          try {
            if (typeof ev.data === 'object' && ev.data && ev.data.type === 'google-oauth-code' && typeof ev.data.code === 'string') {
              clearTimeout(timeout);
              window.removeEventListener('message', onMessage);
              resolve(ev.data.code);
            }
          } catch (err) {
            console.error('Error processing OAuth message event:', err);
          }
        }
        window.addEventListener('message', onMessage);
      });

      // Exchange code for encrypted credentials via server
      const creds = await calendarFeedService.exchangeGoogleAuthCode(code, redirectUri);

      // Create feed and load initial window
      const googleFeed: CalendarFeed = {
        id: crypto.randomUUID(),
        name: "Google Calendar",
        type: 'google',
        googleCalendarId: "primary",
        color: "#4285F4",
        isEnabled: true,
        lastSyncAt: new Date(),
        syncError: undefined,
        credentials: creds
      };
      actions.addFeed(googleFeed);

      // Initial load for ±2 weeks
      const { now, start: windowStart, end: windowEnd } = computeTwoWeekWindow();
      const events = await calendarFeedService.fetchFeedEvents(googleFeed, { start: windowStart, end: windowEnd });
      const expanded = await calendarFeedService.expandRecurringEvents(events, now);
      const deduped = calendarFeedService.resolveEventDuplicates(expanded);
      actions.addExternalEvents(googleFeed.id, deduped);

      // Update last sync meta if available
      actions.updateFeedMeta?.(googleFeed.id, { lastSyncAt: new Date(), syncError: undefined });
    } catch (error) {
      console.error('Failed to connect Google Calendar:', error);
      actions.setError('Failed to connect Google Calendar. Please try again.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleRemoveFeed = (feedId: string) => {
    actions.removeFeed(feedId);
  };

  const handleRefreshFeed = async (feedId: string) => {
    try {
      const { now, start: windowStart, end: windowEnd } = computeTwoWeekWindow();

      // Find the feed from current state
      const feed = feeds.find(f => f.id === feedId);
      if (!feed) throw new Error('Feed not found');

      // Use unified fetch for all feed types (ical, google, etc.)
      const events: CalendarEvent[] = await calendarFeedService.fetchFeedEvents(feed, { start: windowStart, end: windowEnd });

      const expanded = await calendarFeedService.expandRecurringEvents(events, now);
      const deduped = calendarFeedService.resolveEventDuplicates(expanded);
      actions.addExternalEvents(feed.id, deduped);

      // Update feed meta if available
      actions.updateFeedMeta?.(feed.id, { lastSyncAt: new Date(), syncError: undefined });
    } catch (error) {
      console.error('Failed to refresh feed:', error);
      actions.updateFeedMeta?.(feedId, { syncError: 'Failed to refresh calendar feed.' });
      actions.setError('Failed to refresh calendar feed.');
    }
  };

  const renderFeedItem = (feed: CalendarFeed) => (
    <div key={feed.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl neu-card">
      <div className="flex items-center space-x-3">
        <div
          className="w-4 h-4 rounded-full border-2 border-white shadow-neu"
          style={{ backgroundColor: feed.color }}
          aria-label={`${feed.name} color indicator`}
        />
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="font-medium text-gray-800">{feed.name}</h3>
            {feed.type === 'google' && <Calendar className="w-4 h-4 text-blue-500" />}
            {feed.type === 'ical' && <Globe className="w-4 h-4 text-green-500" />}
            {feed.type === 'friend' && <Users className="w-4 h-4 text-purple-500" />}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Last sync: {format(feed.lastSyncAt, "MMM d, h:mm a")}
            {feed.syncError && (
              <Badge variant="destructive" className="ml-2 text-xs">
                Error
              </Badge>
            )}
          </div>
          {feed.syncError && (
            <div className="text-xs text-red-600 mt-1 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {feed.syncError}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRefreshFeed(feed.id)}
          className="neu-card p-2"
          aria-label={`Refresh ${feed.name}`}
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRemoveFeed(feed.id)}
          className="neu-card p-2 text-red-600 hover:text-red-700"
          aria-label={`Remove ${feed.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Calendar Feeds
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="feeds">My Feeds ({feeds.length})</TabsTrigger>
            <TabsTrigger value="add">Add Feed</TabsTrigger>
            <TabsTrigger value="friends">Friends</TabsTrigger>
          </TabsList>

          {/* Existing Feeds */}
          <TabsContent value="feeds" className="space-y-4">
            {feeds.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No calendar feeds added</h3>
                <p className="text-gray-500 mb-4">Add Google Calendar, iCal feeds, or sync with friends to see their events.</p>
                <Button
                  onClick={() => setActiveTab("add")}
                  className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Feed
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {feeds.map(renderFeedItem)}
              </div>
            )}
          </TabsContent>

          {/* Add New Feed */}
          <TabsContent value="add" className="space-y-6">
            {/* Google Calendar */}
            <div className="p-4 border border-blue-200 rounded-xl bg-blue-50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  <div>
                    <h3 className="font-medium text-blue-800">Google Calendar</h3>
                    <p className="text-sm text-blue-600">Connect your Google Calendar account</p>
                  </div>
                </div>
                <Button
                  onClick={handleConnectGoogle}
                  disabled={isConnectingGoogle}
                  className="neu-card bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isConnectingGoogle ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Connect
                    </>
                  )}
                </Button>
              </div>
              <div className="text-xs text-blue-700 flex items-center">
                <ExternalLink className="w-3 h-3 mr-1" />
                Read-only access to view your events
              </div>
            </div>

            {/* iCal Feed */}
            <form onSubmit={handleAddIcalFeed} className="p-4 border border-green-200 rounded-xl bg-green-50">
              <div className="flex items-center space-x-3 mb-4">
                <Globe className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-medium text-green-800">iCal Feed</h3>
                  <p className="text-sm text-green-600">Add any iCal (.ics) calendar feed</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <Label htmlFor="ical-name" className="text-sm font-medium text-gray-700">
                    Feed Name
                  </Label>
                  <Input
                    id="ical-name"
                    value={icalFormData.name}
                    onChange={(e) => setIcalFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 neu-input"
                    placeholder="e.g., Work Calendar"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="ical-url" className="text-sm font-medium text-gray-700">
                    iCal URL
                  </Label>
                  <Input
                    id="ical-url"
                    type="url"
                    value={icalFormData.url}
                    onChange={(e) => setIcalFormData(prev => ({ ...prev, url: e.target.value }))}
                    className="mt-1 neu-input"
                    placeholder="https://example.com/calendar.ics"
                    required
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">Color</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {availableColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${icalFormData.color === color.value
                          ? "border-gray-800 ring-2 ring-gray-400"
                          : "border-gray-300 hover:border-gray-500"
                          }`}
                        style={{ backgroundColor: color.value }}
                        onClick={() => setIcalFormData(prev => ({ ...prev, color: color.value }))}
                        aria-label={`Select ${color.label} color`}
                      />
                    ))}
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full neu-card bg-green-600 hover:bg-green-700 text-white mt-4"
                  disabled={!icalFormData.name.trim() || !icalFormData.url.trim()}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add iCal Feed
                </Button>
              </div>
            </form>
          </TabsContent>

          {/* Friend Calendars */}
          <TabsContent value="friends" className="space-y-4">
            <div className="p-4 border border-purple-200 rounded-xl bg-purple-50">
              <div className="flex items-center space-x-3 mb-3">
                <Users className="w-6 h-6 text-purple-600" />
                <div>
                  <h3 className="font-medium text-purple-800">Friend Calendars</h3>
                  <p className="text-sm text-purple-600">
                    Manage friend calendar sync from the Friend Calendar Sync panel in Weekly View.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Input
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  className="neu-input"
                  placeholder="Open the Friend Calendar Sync panel from Weekly View"
                  disabled
                />

                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm">
                    To view friends' events, open the Friend Calendar Sync panel in the weekly calendar.
                    You can request permissions and enable per-friend feeds there.
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button
            onClick={onClose}
            className="neu-card"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
