import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Clock, Bell, Palette, Users } from "lucide-react";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

interface CalendarSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CalendarSettings({ isOpen, onClose }: CalendarSettingsProps) {
  const [settings, setSettings] = useState({
    // Time grid settings
    hourHeight: CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT,
    minuteInterval: CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL,
    snapInterval: 15,
    
    // Notification settings
    enableNotifications: true,
    defaultReminderMinutes: 30,
    soundEnabled: false,
    
    // Display settings
    weekStartsOn: 0, // Sunday
    timeFormat: '12h' as '12h' | '24h',
    showWeekNumbers: false,
    compactView: false,
    
    // Feature flags
    enableRecurrence: CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI,
    enableFriendSync: CALENDAR_CONFIG.FEATURES.ENABLE_FRIEND_SYNC,
    enableOfflineMode: CALENDAR_CONFIG.FEATURES.ENABLE_OFFLINE_MODE,
  });

  const handleSettingChange = <K extends keyof typeof settings>(key: K, value: typeof settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // TODO: Save settings to localStorage or user preferences
    localStorage.setItem('calendar-settings', JSON.stringify(settings));
    onClose();
  };

  const handleReset = () => {
    // Reset to defaults
    setSettings({
      hourHeight: CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT,
      minuteInterval: CALENDAR_CONFIG.TIME_GRID.MINUTE_INTERVAL,
      snapInterval: 15,
      enableNotifications: true,
      defaultReminderMinutes: 30,
      soundEnabled: false,
      weekStartsOn: 0,
      timeFormat: '12h',
      showWeekNumbers: false,
      compactView: false,
      enableRecurrence: CALENDAR_CONFIG.FEATURES.ENABLE_RECURRENCE_UI,
      enableFriendSync: CALENDAR_CONFIG.FEATURES.ENABLE_FRIEND_SYNC,
      enableOfflineMode: CALENDAR_CONFIG.FEATURES.ENABLE_OFFLINE_MODE,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-2xl font-bold text-gray-800">
            <Settings className="w-6 h-6 text-blue-600" />
            Calendar Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="display" className="w-full">
          <TabsList className="grid w-full grid-cols-4 neu-card shadow-sm">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="time">Time Grid</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
          </TabsList>

        <TabsContent value="display" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5" />
                Display Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="week-starts">Week starts on</Label>
                <Select
                  value={settings.weekStartsOn.toString()}
                  onValueChange={(value) => handleSettingChange('weekStartsOn', parseInt(value))}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Sunday</SelectItem>
                    <SelectItem value="1">Monday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="time-format">Time format</Label>
                <Select
                  value={settings.timeFormat}
                  onValueChange={(value: '12h' | '24h') => handleSettingChange('timeFormat', value)}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12 hour</SelectItem>
                    <SelectItem value="24h">24 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="week-numbers">Show week numbers</Label>
                <Switch
                  id="week-numbers"
                  checked={settings.showWeekNumbers}
                  onCheckedChange={(checked) => handleSettingChange('showWeekNumbers', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="compact-view">Compact view</Label>
                <Switch
                  id="compact-view"
                  checked={settings.compactView}
                  onCheckedChange={(checked) => handleSettingChange('compactView', checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="time" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Time Grid Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="hour-height">Hour height</Label>
                <Select
                  value={settings.hourHeight.toString()}
                  onValueChange={(value) => handleSettingChange('hourHeight', parseInt(value, 10) as typeof settings.hourHeight)}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="40">Compact (40px)</SelectItem>
                    <SelectItem value="60">Normal (60px)</SelectItem>
                    <SelectItem value="80">Large (80px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="minute-interval">Grid lines</Label>
                <Select
                  value={settings.minuteInterval.toString()}
                  onValueChange={(value) => handleSettingChange('minuteInterval', parseInt(value, 10) as typeof settings.minuteInterval)}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">Every 15 min</SelectItem>
                    <SelectItem value="30">Every 30 min</SelectItem>
                    <SelectItem value="60">Hourly only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="snap-interval">Snap to grid</Label>
                <Select
                  value={settings.snapInterval.toString()}
                  onValueChange={(value) => handleSettingChange('snapInterval', parseInt(value))}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Notification Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-notifications">Enable notifications</Label>
                <Switch
                  id="enable-notifications"
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) => handleSettingChange('enableNotifications', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="default-reminder">Default reminder</Label>
                <Select
                  value={settings.defaultReminderMinutes.toString()}
                  onValueChange={(value) => handleSettingChange('defaultReminderMinutes', parseInt(value))}
                  disabled={!settings.enableNotifications}
                >
                  <SelectTrigger className="w-32 neu-input">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">No reminder</SelectItem>
                    <SelectItem value="5">5 minutes</SelectItem>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="1440">1 day</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="sound-enabled">Sound notifications</Label>
                <Switch
                  id="sound-enabled"
                  checked={settings.soundEnabled}
                  onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                  disabled={!settings.enableNotifications}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card className="neu-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Feature Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="friend-sync">Friend calendar sync</Label>
                  <p className="text-sm text-gray-500">Sync calendars with friends</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="friend-sync"
                    checked={settings.enableFriendSync}
                    onCheckedChange={(checked: boolean) => handleSettingChange('enableFriendSync', checked as typeof settings.enableFriendSync)}
                  />
                  {settings.enableFriendSync && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="offline-mode">Offline mode</Label>
                  <p className="text-sm text-gray-500">Cache events for offline viewing</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="offline-mode"
                    checked={settings.enableOfflineMode}
                    onCheckedChange={(checked: boolean) => handleSettingChange('enableOfflineMode', checked as typeof settings.enableOfflineMode)}
                  />
                  {settings.enableOfflineMode && (
                    <Badge variant="secondary" className="text-xs">Active</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="recurrence">Recurring events</Label>
                  <p className="text-sm text-gray-500">Create repeating events</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="recurrence"
                    checked={settings.enableRecurrence}
                    onCheckedChange={(checked: boolean) => handleSettingChange('enableRecurrence', checked as typeof settings.enableRecurrence)}
                    disabled={true}
                  />
                  <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
       </Tabs>

       <DialogFooter className="pt-6 border-t border-gray-200">
         <div className="flex w-full justify-between">
           <Button
             variant="outline"
             onClick={handleReset}
             className="neu-card"
           >
             Reset to Defaults
           </Button>
           <div className="flex gap-2">
             <Button
               variant="ghost"
               onClick={onClose}
               className="neu-card"
             >
               Cancel
             </Button>
             <Button
               onClick={handleSave}
               className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white"
             >
               Save Settings
             </Button>
           </div>
         </div>
       </DialogFooter>
     </DialogContent>
   </Dialog>
 );
}