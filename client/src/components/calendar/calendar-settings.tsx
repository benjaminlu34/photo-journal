import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Settings, 
  Clock, 
  Palette, 
  Grid, 
  Accessibility, 
  Bell, 
  Monitor,
  X,
  Save,
  RefreshCw
} from "lucide-react";
import { CALENDAR_CONFIG } from "@shared/config/calendar-config";

interface CalendarSettingsProps {
  onClose: () => void;
}

interface CalendarSettingsState {
  // Time grid settings
  hourHeight: number;
  snapInterval: number;
  showMinuteLines: boolean;
  show24HourFormat: boolean;
  
  // Responsive settings
  enableMobilePads: boolean;
  padSize: number;
  autoDetectViewport: boolean;
  
  // Visual settings
  showWeekends: boolean;
  highlightToday: boolean;
  showEventPatterns: boolean;
  defaultEventColor: string;
  
  // Accessibility settings
  enableHighContrast: boolean;
  enableReducedMotion: boolean;
  enableKeyboardNavigation: boolean;
  showColorBlindPatterns: boolean;
  
  // Notification settings
  enableBrowserNotifications: boolean;
  defaultReminderTime: number;
  enableSoundAlerts: boolean;
  
  // Performance settings
  enableVirtualization: boolean;
  maxEventsPerDay: number;
  enableAnimations: boolean;
  cacheTimeout: number;
}

export function CalendarSettings({ onClose }: CalendarSettingsProps) {
  const [settings, setSettings] = useState<CalendarSettingsState>({
    // Time grid settings
    hourHeight: CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT,
    snapInterval: CALENDAR_CONFIG.TIME_GRID.SNAP_INTERVALS[1], // 15 minutes
    showMinuteLines: true,
    show24HourFormat: false,
    
    // Responsive settings
    enableMobilePads: true,
    padSize: CALENDAR_CONFIG.MOBILE.PAD_SIZE,
    autoDetectViewport: true,
    
    // Visual settings
    showWeekends: true,
    highlightToday: true,
    showEventPatterns: true,
    defaultEventColor: CALENDAR_CONFIG.COLORS.DEFAULT_EVENT_COLOR,
    
    // Accessibility settings
    enableHighContrast: false,
    enableReducedMotion: false,
    enableKeyboardNavigation: true,
    showColorBlindPatterns: true,
    
    // Notification settings
    enableBrowserNotifications: false,
    defaultReminderTime: 30,
    enableSoundAlerts: false,
    
    // Performance settings
    enableVirtualization: true,
    maxEventsPerDay: CALENDAR_CONFIG.PERFORMANCE.MAX_EVENTS_PER_DAY,
    enableAnimations: true,
    cacheTimeout: 15, // minutes
  });

  const [activeTab, setActiveTab] = useState("display");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const updateSetting = <K extends keyof CalendarSettingsState>(
    key: K,
    value: CalendarSettingsState[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSaveSettings = () => {
    // In a real implementation, this would save to localStorage or API
    console.log('Saving calendar settings:', settings);
    setHasUnsavedChanges(false);
    
    // Mock save operation
    setTimeout(() => {
      console.log('Settings saved successfully');
    }, 500);
  };

  const handleResetDefaults = () => {
    setSettings({
      hourHeight: CALENDAR_CONFIG.TIME_GRID.HOUR_HEIGHT,
      snapInterval: 15,
      showMinuteLines: true,
      show24HourFormat: false,
      enableMobilePads: true,
      padSize: CALENDAR_CONFIG.MOBILE.PAD_SIZE,
      autoDetectViewport: true,
      showWeekends: true,
      highlightToday: true,
      showEventPatterns: true,
      defaultEventColor: CALENDAR_CONFIG.COLORS.DEFAULT_EVENT_COLOR,
      enableHighContrast: false,
      enableReducedMotion: false,
      enableKeyboardNavigation: true,
      showColorBlindPatterns: true,
      enableBrowserNotifications: false,
      defaultReminderTime: 30,
      enableSoundAlerts: false,
      enableVirtualization: true,
      maxEventsPerDay: CALENDAR_CONFIG.PERFORMANCE.MAX_EVENTS_PER_DAY,
      enableAnimations: true,
      cacheTimeout: 15,
    });
    setHasUnsavedChanges(true);
  };

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Settings className="w-6 h-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-bold text-gray-800">Calendar Settings</h2>
            <p className="text-sm text-gray-600">Customize your calendar experience</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          {hasUnsavedChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="neu-card p-2"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="display" className="flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Display
            </TabsTrigger>
            <TabsTrigger value="accessibility" className="flex items-center gap-2">
              <Accessibility className="w-4 h-4" />
              Accessibility
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Grid className="w-4 h-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          {/* Display Settings */}
          <TabsContent value="display" className="space-y-6 mt-6">
            {/* Time Grid Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-800">Time Grid</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Hour Height: {settings.hourHeight}px
                  </Label>
                  <Slider
                    value={[settings.hourHeight]}
                    onValueChange={([value]) => updateSetting('hourHeight', value)}
                    min={40}
                    max={120}
                    step={10}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Snap Interval</Label>
                  <Select
                    value={settings.snapInterval.toString()}
                    onValueChange={(value) => updateSetting('snapInterval', parseInt(value))}
                  >
                    <SelectTrigger className="mt-2 neu-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutes</SelectItem>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Show minute lines</Label>
                  <Switch
                    checked={settings.showMinuteLines}
                    onCheckedChange={(checked) => updateSetting('showMinuteLines', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">24-hour format</Label>
                  <Switch
                    checked={settings.show24HourFormat}
                    onCheckedChange={(checked) => updateSetting('show24HourFormat', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Visual Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-purple-600" />
                <h3 className="text-lg font-semibold text-gray-800">Visual Appearance</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Show weekends</Label>
                  <Switch
                    checked={settings.showWeekends}
                    onCheckedChange={(checked) => updateSetting('showWeekends', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Highlight today</Label>
                  <Switch
                    checked={settings.highlightToday}
                    onCheckedChange={(checked) => updateSetting('highlightToday', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Show event patterns</Label>
                  <Switch
                    checked={settings.showEventPatterns}
                    onCheckedChange={(checked) => updateSetting('showEventPatterns', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Enable animations</Label>
                  <Switch
                    checked={settings.enableAnimations}
                    onCheckedChange={(checked) => updateSetting('enableAnimations', checked)}
                  />
                </div>
              </div>
            </div>

            {/* Responsive Settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Responsive Behavior</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Auto-detect viewport</Label>
                  <Switch
                    checked={settings.autoDetectViewport}
                    onCheckedChange={(checked) => updateSetting('autoDetectViewport', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Enable mobile pads</Label>
                  <Switch
                    checked={settings.enableMobilePads}
                    onCheckedChange={(checked) => updateSetting('enableMobilePads', checked)}
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Accessibility Settings */}
          <TabsContent value="accessibility" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Accessibility className="w-5 h-5 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-800">Accessibility Options</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">High contrast mode</Label>
                  <Switch
                    checked={settings.enableHighContrast}
                    onCheckedChange={(checked) => updateSetting('enableHighContrast', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Reduced motion</Label>
                  <Switch
                    checked={settings.enableReducedMotion}
                    onCheckedChange={(checked) => updateSetting('enableReducedMotion', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Keyboard navigation</Label>
                  <Switch
                    checked={settings.enableKeyboardNavigation}
                    onCheckedChange={(checked) => updateSetting('enableKeyboardNavigation', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Color-blind patterns</Label>
                  <Switch
                    checked={settings.showColorBlindPatterns}
                    onCheckedChange={(checked) => updateSetting('showColorBlindPatterns', checked)}
                  />
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 ml-7">
                <div className="flex items-start space-x-2">
                  <Accessibility className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Accessibility Features</h4>
                    <ul className="text-sm text-blue-700 mt-2 space-y-1">
                      <li>• ARIA labels for screen readers</li>
                      <li>• Keyboard navigation support</li>
                      <li>• High contrast color options</li>
                      <li>• Pattern-based event distinction</li>
                      <li>• Focus management for modals</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Notification Settings */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Bell className="w-5 h-5 text-yellow-600" />
                <h3 className="text-lg font-semibold text-gray-800">Notification Preferences</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Browser notifications</Label>
                  <Switch
                    checked={settings.enableBrowserNotifications}
                    onCheckedChange={(checked) => updateSetting('enableBrowserNotifications', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Sound alerts</Label>
                  <Switch
                    checked={settings.enableSoundAlerts}
                    onCheckedChange={(checked) => updateSetting('enableSoundAlerts', checked)}
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">Default reminder time</Label>
                  <Select
                    value={settings.defaultReminderTime.toString()}
                    onValueChange={(value) => updateSetting('defaultReminderTime', parseInt(value))}
                  >
                    <SelectTrigger className="mt-2 neu-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">No reminder</SelectItem>
                      <SelectItem value="5">5 minutes before</SelectItem>
                      <SelectItem value="15">15 minutes before</SelectItem>
                      <SelectItem value="30">30 minutes before</SelectItem>
                      <SelectItem value="60">1 hour before</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 ml-7">
                <div className="flex items-start space-x-2">
                  <Bell className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-800">Coming Soon</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      Email reminders and push notifications will be available in a future update.
                      Currently only browser notifications are supported.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Performance Settings */}
          <TabsContent value="performance" className="space-y-6 mt-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Grid className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold text-gray-800">Performance Options</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-7">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-gray-700">Enable virtualization</Label>
                  <Switch
                    checked={settings.enableVirtualization}
                    onCheckedChange={(checked) => updateSetting('enableVirtualization', checked)}
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Max events per day: {settings.maxEventsPerDay}
                  </Label>
                  <Slider
                    value={[settings.maxEventsPerDay]}
                    onValueChange={([value]) => updateSetting('maxEventsPerDay', value)}
                    min={10}
                    max={100}
                    step={10}
                    className="mt-2"
                  />
                </div>
                
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Cache timeout: {settings.cacheTimeout} minutes
                  </Label>
                  <Slider
                    value={[settings.cacheTimeout]}
                    onValueChange={([value]) => updateSetting('cacheTimeout', value)}
                    min={5}
                    max={60}
                    step={5}
                    className="mt-2"
                  />
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 ml-7">
                <div className="flex items-start space-x-2">
                  <Grid className="w-5 h-5 text-gray-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-800">Performance Tips</h4>
                    <ul className="text-sm text-gray-700 mt-2 space-y-1">
                      <li>• Virtualization helps with large time grids (&gt;12 hours)</li>
                      <li>• Lower event limits improve rendering performance</li>
                      <li>• Shorter cache timeouts keep data fresh</li>
                      <li>• Disabled animations reduce CPU usage</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
        <Button
          variant="ghost"
          onClick={handleResetDefaults}
          className="neu-card text-gray-600 hover:text-gray-800"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Reset to Defaults
        </Button>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="neu-card"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveSettings}
            disabled={!hasUnsavedChanges}
            className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
