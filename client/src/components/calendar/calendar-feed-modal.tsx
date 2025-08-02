import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Plus, Settings, Trash2, Chrome, Link, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import type { CalendarFeed } from "@/types/calendar";
import { availableColors } from "@shared/config/calendar-config";
import { useCalendarStore } from "@/lib/calendar-store";

const mockGoogleCalendars = [
  { id: "primary", name: "Personal Calendar", description: "Your main calendar" },
  { id: "work", name: "Work Calendar", description: "Work-related events" },
  { id: "family", name: "Family Calendar", description: "Family events and activities" },
  { id: "holidays", name: "Holidays", description: "Public holidays" },
];

interface CalendarFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingFeeds?: CalendarFeed[];
}

export function CalendarFeedModal({ isOpen, onClose, existingFeeds = [] }: CalendarFeedModalProps) {
  const [activeTab, setActiveTab] = useState("add");
  const [feedType, setFeedType] = useState<"google" | "ical">("google");
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    color: "#3B82F6",
  });
  
  const [selectedCalendars, setSelectedCalendars] = useState<Record<string, boolean>>({});
  const { actions } = useCalendarStore();
  
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Calendar feed submitted:", { ...formData, type: feedType });
    onClose();
  };
  
  const handleCalendarSelection = (id: string, checked: boolean) => {
    setSelectedCalendars(prev => ({ ...prev, [id]: checked }));
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl neu-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            Calendar Feeds
          </DialogTitle>
          <DialogDescription>
            Connect your Google Calendar or iCal feeds to view events in your journal.
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 neu-card">
            <TabsTrigger value="add" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Feed
            </TabsTrigger>
            <TabsTrigger value="friends" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Friends
            </TabsTrigger>
            <TabsTrigger value="manage" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Manage Feeds
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="add" className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Feed Type</Label>
                <Select value={feedType} onValueChange={(value: "google" | "ical") => setFeedType(value)}>
                  <SelectTrigger className="mt-1 neu-inset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">
                      <div className="flex items-center gap-2">
                        <Chrome className="w-4 h-4" />
                        Google Calendar
                      </div>
                    </SelectItem>
                    <SelectItem value="ical">
                      <div className="flex items-center gap-2">
                        <Link className="w-4 h-4" />
                        iCal Feed
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {feedType === "google" ? (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Select Google Calendars
                    </Label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {mockGoogleCalendars.map((calendar) => (
                        <Card key={calendar.id} className="neu-card hover:shadow-neu-lg transition-all cursor-pointer">
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="font-medium text-gray-800">{calendar.name}</h4>
                                <p className="text-sm text-gray-600">{calendar.description}</p>
                              </div>
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                checked={selectedCalendars[calendar.id] || false}
                                onChange={(e) => handleCalendarSelection(calendar.id, e.target.checked)}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  
                  <Button
                    type="button"
                    className="w-full neu-card bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all"
                  >
                    <Chrome className="w-4 h-4 mr-2" />
                    Connect to Google Calendar
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="feedName" className="text-sm font-medium text-gray-700">
                      Feed Name
                    </Label>
                    <Input
                      id="feedName"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="mt-1 neu-inset"
                      placeholder="My Calendar Feed"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="feedUrl" className="text-sm font-medium text-gray-700">
                      iCal URL
                    </Label>
                    <Input
                      id="feedUrl"
                      type="url"
                      value={formData.url}
                      onChange={(e) => handleInputChange("url", e.target.value)}
                      className="mt-1 neu-inset"
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
                          className={`w-8 h-8 rounded-full border-2 transition-all shadow-neu hover:shadow-neu-lg ${
                            formData.color === color.value
                              ? "border-gray-800 scale-110 shadow-neu-lg"
                              : "border-gray-300 hover:scale-105"
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => handleInputChange("color", color.value)}
                          aria-label={`Select ${color.label} color`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="neu-card"
                >
                  Cancel
                </Button>
                {feedType === "ical" && (
                  <Button
                    type="submit"
                    disabled={!formData.name.trim() || !formData.url.trim()}
                    className="neu-card bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all"
                  >
                    Add Feed
                  </Button>
                )}
              </DialogFooter>
            </form>
          </TabsContent>
          
          <TabsContent value="friends" className="space-y-4">
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-700 font-medium mb-2">Friend Calendar Sync</p>
              <p className="text-gray-600 mb-4">
                Sync calendars from friends who have granted you access.
              </p>
              <Button
                onClick={() => {
                  actions.setFriendSyncModalOpen(true);
                  onClose();
                }}
                className="neu-card bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all"
              >
                <Users className="w-4 h-4 mr-2" />
                Manage Friend Sync
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="manage" className="space-y-4">
            {existingFeeds.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No calendar feeds connected yet.</p>
                <p className="text-sm text-gray-500 mt-1">Add a feed to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {existingFeeds.map((feed) => (
                  <Card key={feed.id} className="neu-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: feed.color }}
                          />
                          <div>
                            <h4 className="font-medium text-gray-800">{feed.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-xs">
                                {feed.type === "google" ? "Google Calendar" : "iCal Feed"}
                              </Badge>
                              {feed.lastSyncAt && (
                                <span className="text-xs text-gray-500">
                                  Last synced: {format(new Date(feed.lastSyncAt), 'P')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="neu-card p-2"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="neu-card p-2"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="neu-card p-2 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}