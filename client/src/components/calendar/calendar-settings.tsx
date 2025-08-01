import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, Palette, Globe, Clock } from "lucide-react";

interface CalendarSettingsProps {
  onClose: () => void;
}

export function CalendarSettings({ onClose }: CalendarSettingsProps) {
  const [settings, setSettings] = useState({
    // General Settings
    defaultView: "week",
    weekStartsOn: 0,
    timeFormat: "12h",
    firstDayOfWeek: "sunday",
    
    // Display Settings
    showWeekNumbers: true,
    showMiniCalendar: true,
    compactMode: false,
    showEventEndTime: true,
    
    // Sync Settings
    autoSync: true,
    syncInterval: 30, // minutes
    offlineMode: true,
    
    // Notification Settings
    enableNotifications: true,
    defaultReminder: 30, // minutes
    soundEnabled: true,
    
    // Time Zone Settings
    useSystemTimezone: true,
    selectedTimezone: "America/New_York",
  });
  
  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };
  
  const handleSave = () => {
    console.log("Saving settings:", settings);
    onClose();
  };
  
  const timezones = [
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "America/Denver",
    "America/Toronto",
    "America/Vancouver",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Asia/Dubai",
    "Australia/Sydney",
  ];
  
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-purple-600" />
            Calendar Settings
          </h2>
          <p className="text-gray-600 mt-1">Customize your calendar experience</p>
        </div>
        <Button onClick={onClose} variant="ghost" className="neu-card">
          Close
        </Button>
      </div>
      
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4 neu-card">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="sync" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Sync
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Alerts
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-lg">Calendar Defaults</CardTitle>
              <CardDescription>Set your preferred calendar view and format</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="defaultView" className="text-sm font-medium text-gray-700">
                  Default View
                </Label>
                <Select value={settings.defaultView} onValueChange={(value) => handleSettingChange("defaultView", value)}>
                  <SelectTrigger className="mt-1 neu-inset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day View</SelectItem>
                    <SelectItem value="week">Week View</SelectItem>
                    <SelectItem value="month">Month View</SelectItem>
                    <SelectItem value="agenda">Agenda View</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="weekStartsOn" className="text-sm font-medium text-gray-700">
                  Week Starts On
                </Label>
                <Select value={settings.firstDayOfWeek} onValueChange={(value) => handleSettingChange("firstDayOfWeek", value)}>
                  <SelectTrigger className="mt-1 neu-inset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sunday">Sunday</SelectItem>
                    <SelectItem value="monday">Monday</SelectItem>
                    <SelectItem value="saturday">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="timeFormat" className="text-sm font-medium text-gray-700">
                  Time Format
                </Label>
                <Select value={settings.timeFormat} onValueChange={(value) => handleSettingChange("timeFormat", value)}>
                  <SelectTrigger className="mt-1 neu-inset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour (AM/PM)</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
          
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Time Zone
              </CardTitle>
              <CardDescription>Manage your time zone preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="useSystemTimezone"
                  checked={settings.useSystemTimezone}
                  onCheckedChange={(checked) => handleSettingChange("useSystemTimezone", checked)}
                />
                <Label htmlFor="useSystemTimezone" className="text-sm font-medium text-gray-700">
                  Use system timezone
                </Label>
              </div>
              
              {!settings.useSystemTimezone && (
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium text-gray-700">
                    Select Timezone
                  </Label>
                  <Select value={settings.selectedTimezone} onValueChange={(value) => handleSettingChange("selectedTimezone", value)}>
                    <SelectTrigger className="mt-1 neu-inset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="display" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-lg">Display Options</CardTitle>
              <CardDescription>Customize how your calendar looks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showWeekNumbers" className="text-sm font-medium text-gray-700">
                    Show Week Numbers
                  </Label>
                  <p className="text-xs text-gray-500">Display ISO week numbers in the calendar</p>
                </div>
                <Switch
                  id="showWeekNumbers"
                  checked={settings.showWeekNumbers}
                  onCheckedChange={(checked) => handleSettingChange("showWeekNumbers", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showMiniCalendar" className="text-sm font-medium text-gray-700">
                    Show Mini Calendar
                  </Label>
                  <p className="text-xs text-gray-500">Display a small calendar in the sidebar</p>
                </div>
                <Switch
                  id="showMiniCalendar"
                  checked={settings.showMiniCalendar}
                  onCheckedChange={(checked) => handleSettingChange("showMiniCalendar", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="compactMode" className="text-sm font-medium text-gray-700">
                    Compact Mode
                  </Label>
                  <p className="text-xs text-gray-500">Use a more compact layout for events</p>
                </div>
                <Switch
                  id="compactMode"
                  checked={settings.compactMode}
                  onCheckedChange={(checked) => handleSettingChange("compactMode", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="showEventEndTime" className="text-sm font-medium text-gray-700">
                    Show Event End Time
                  </Label>
                  <p className="text-xs text-gray-500">Display end time for events in calendar views</p>
                </div>
                <Switch
                  id="showEventEndTime"
                  checked={settings.showEventEndTime}
                  onCheckedChange={(checked) => handleSettingChange("showEventEndTime", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sync" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-lg">Sync Settings</CardTitle>
              <CardDescription>Configure how your calendar synchronizes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="autoSync" className="text-sm font-medium text-gray-700">
                    Auto Sync
                  </Label>
                  <p className="text-xs text-gray-500">Automatically sync calendar feeds</p>
                </div>
                <Switch
                  id="autoSync"
                  checked={settings.autoSync}
                  onCheckedChange={(checked) => handleSettingChange("autoSync", checked)}
                />
              </div>
              
              {settings.autoSync && (
                <div>
                  <Label htmlFor="syncInterval" className="text-sm font-medium text-gray-700">
                    Sync Interval
                  </Label>
                  <Select value={settings.syncInterval.toString()} onValueChange={(value) => handleSettingChange("syncInterval", parseInt(value))}>
                    <SelectTrigger className="mt-1 neu-inset">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="offlineMode" className="text-sm font-medium text-gray-700">
                    Offline Mode
                  </Label>
                  <p className="text-xs text-gray-500">Store calendar data for offline access</p>
                </div>
                <Switch
                  id="offlineMode"
                  checked={settings.offlineMode}
                  onCheckedChange={(checked) => handleSettingChange("offlineMode", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>Configure event reminders and alerts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="enableNotifications" className="text-sm font-medium text-gray-700">
                    Enable Notifications
                  </Label>
                  <p className="text-xs text-gray-500">Show notifications for upcoming events</p>
                </div>
                <Switch
                  id="enableNotifications"
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => handleSettingChange("enableNotifications", checked)}
                />
              </div>
              
              {settings.enableNotifications && (
                <>
                  <div>
                    <Label htmlFor="defaultReminder" className="text-sm font-medium text-gray-700">
                      Default Reminder Time
                    </Label>
                    <Select value={settings.defaultReminder.toString()} onValueChange={(value) => handleSettingChange("defaultReminder", parseInt(value))}>
                      <SelectTrigger className="mt-1 neu-inset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">No reminder</SelectItem>
                        <SelectItem value="5">5 minutes before</SelectItem>
                        <SelectItem value="10">10 minutes before</SelectItem>
                        <SelectItem value="15">15 minutes before</SelectItem>
                        <SelectItem value="30">30 minutes before</SelectItem>
                        <SelectItem value="60">1 hour before</SelectItem>
                        <SelectItem value="1440">1 day before</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="soundEnabled" className="text-sm font-medium text-gray-700">
                        Sound Alerts
                      </Label>
                      <p className="text-xs text-gray-500">Play sound for notifications</p>
                    </div>
                    <Switch
                      id="soundEnabled"
                      checked={settings.soundEnabled}
                      onCheckedChange={(checked) => handleSettingChange("soundEnabled", checked)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onClose} className="neu-card">
          Cancel
        </Button>
        <Button onClick={handleSave} className="neu-card bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all">
          Save Settings
        </Button>
      </div>
    </div>
  );
}