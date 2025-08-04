import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar, Globe, Users, Plus, Trash2, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { availableColors } from "@shared/config/calendar-config";
import type { CalendarFeed } from "@/types/calendar";
import { useCalendar } from "@/contexts/calendar-context";

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
  
  const handleAddIcalFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!icalFormData.name.trim() || !icalFormData.url.trim()) {
      return;
    }
    
    try {
      const newFeed: CalendarFeed = {
        id: crypto.randomUUID(),
        name: icalFormData.name,
        type: 'ical',
        url: icalFormData.url,
        color: icalFormData.color,
        isEnabled: true,
        lastSyncAt: new Date(),
        syncError: undefined
      };
      
      actions.addFeed(newFeed);
      
      // Reset form
      setIcalFormData({
        name: "",
        url: "",
        color: "#3B82F6"
      });
      
      // Mock external events for demo
      actions.addExternalEvents(newFeed.id, []);
      
    } catch (error) {
      console.error('Failed to add iCal feed:', error);
      actions.setError('Failed to add calendar feed. Please check the URL and try again.');
    }
  };
  
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    
    try {
      // Mock Google Calendar OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const googleFeed: CalendarFeed = {
        id: crypto.randomUUID(),
        name: "Google Calendar",
        type: 'google',
        googleCalendarId: "primary",
        color: "#4285F4",
        isEnabled: true,
        lastSyncAt: new Date(),
        syncError: undefined
      };
      
      actions.addFeed(googleFeed);
      
      // Mock external events for demo
      actions.addExternalEvents(googleFeed.id, []);
      
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
      // Mock refresh operation
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Refreshed feed:', feedId);
    } catch (error) {
      console.error('Failed to refresh feed:', error);
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
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          icalFormData.color === color.value
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
                  <p className="text-sm text-purple-600">Coming soon - sync calendars with your friends</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <Input
                  value={friendSearchQuery}
                  onChange={(e) => setFriendSearchQuery(e.target.value)}
                  className="neu-input"
                  placeholder="Search for friends..."
                  disabled
                />
                
                <div className="text-center py-8">
                  <div className="text-gray-500 text-sm">
                    Friend calendar synchronization will be available in a future update.
                    <br />
                    You'll be able to view your friends' calendars with their permission.
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
