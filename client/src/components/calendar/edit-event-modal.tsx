import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Tag, Lock, User } from "lucide-react";
import { format } from "date-fns";
import type { LocalEvent } from "@/types/calendar";
import { availableColors } from "@shared/config/calendar-config";

interface EditEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: LocalEvent;
  onSubmit: (id: string, updates: Partial<LocalEvent>) => void;
  isReadOnly?: boolean;
}

export function EditEventModal({ 
  isOpen, 
  onClose, 
  event,
  onSubmit,
  isReadOnly = false
}: EditEventModalProps) {
  const [formData, setFormData] = useState({
    title: event.title,
    description: event.description || "",
    startTime: new Date(event.startTime),
    endTime: new Date(event.endTime),
    isAllDay: event.isAllDay,
    location: event.location || "",
    color: event.color,
    reminderMinutes: 'reminderMinutes' in event ? event.reminderMinutes || 30 : 30,
    tags: 'tags' in event ? event.tags || [] : [],
  });
  
  const [tagInput, setTagInput] = useState("");
  
  useEffect(() => {
    setFormData({
      title: event.title,
      description: event.description || "",
      startTime: new Date(event.startTime),
      endTime: new Date(event.endTime),
      isAllDay: event.isAllDay,
      location: event.location || "",
      color: event.color,
      reminderMinutes: 'reminderMinutes' in event ? event.reminderMinutes || 30 : 30,
      tags: 'tags' in event ? event.tags || [] : [],
    });
  }, [event.id]); // Only reset form when the event ID changes, not on every re-render
  
  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleDateChange = (field: 'startTime' | 'endTime', value: string) => {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      handleInputChange(field, date);
    }
  };
  
  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput("");
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      return;
    }
    
    onSubmit(event.id, {
      title: formData.title,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      isAllDay: formData.isAllDay,
      location: formData.location,
      color: formData.color,
      reminderMinutes: formData.reminderMinutes,
      tags: formData.tags,
    });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md neu-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            {isReadOnly ? "View Event" : "Edit Event"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-sm font-medium text-gray-700">
              Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleInputChange("title", e.target.value)}
              className="mt-1 neu-inset"
              placeholder="Event title"
              required
              readOnly={isReadOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="description" className="text-sm font-medium text-gray-700">
              Description
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              className="mt-1 neu-inset"
              placeholder="Event description"
              rows={3}
              readOnly={isReadOnly}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                Start Time
              </Label>
              <Input
                id="startTime"
                type={formData.isAllDay ? "date" : "datetime-local"}
                value={formData.isAllDay 
                  ? format(formData.startTime, "yyyy-MM-dd")
                  : format(formData.startTime, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleDateChange("startTime", e.target.value)}
                className="mt-1 neu-inset"
                readOnly={isReadOnly}
              />
            </div>
            
            <div>
              <Label htmlFor="endTime" className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="w-4 h-4" />
                End Time
              </Label>
              <Input
                id="endTime"
                type={formData.isAllDay ? "date" : "datetime-local"}
                value={formData.isAllDay 
                  ? format(formData.endTime, "yyyy-MM-dd")
                  : format(formData.endTime, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => handleDateChange("endTime", e.target.value)}
                className="mt-1 neu-inset"
                readOnly={isReadOnly}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="allDay"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => handleInputChange("isAllDay", checked)}
              disabled={isReadOnly}
            />
            <Label htmlFor="allDay" className="text-sm font-medium text-gray-700">
              All day event
            </Label>
          </div>
          
          <div>
            <Label htmlFor="location" className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Location
            </Label>
            <Input
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              className="mt-1 neu-inset"
              placeholder="Add location"
              readOnly={isReadOnly}
            />
          </div>
          
          {!isReadOnly && (
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
                    disabled={isReadOnly}
                  />
                ))}
              </div>
            </div>
          )}
          
          {!isReadOnly && (
            <div>
              <Label htmlFor="reminder" className="text-sm font-medium text-gray-700">
                Reminder
              </Label>
              <Select
                value={formData.reminderMinutes.toString()}
                onValueChange={(value) => handleInputChange("reminderMinutes", parseInt(value))}
                disabled={isReadOnly}
              >
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
          )}
          
          <div>
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
            {!isReadOnly && (
              <div className="mt-1 flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  className="neu-inset flex-1"
                  placeholder="Add tag"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAddTag}
                  className="neu-card px-3"
                >
                  Add
                </Button>
              </div>
            )}
            {formData.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 neu-inset"
                  >
                    {tag}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 text-purple-600 hover:text-purple-900"
                        aria-label={`Remove tag ${tag}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* Show creator for local events */}
          {event.createdBy && (
            <div className="flex items-center text-sm text-gray-600 mt-2">
              <User className="w-4 h-4 mr-1" />
              Created by: {event.createdBy}
            </div>
          )}
          
          {/* Show read-only indicator for imported events */}
          {!event.createdBy && (
            <div className="flex items-center text-sm text-gray-600 mt-2">
              <Lock className="w-4 h-4 mr-1" />
              Read-only event from external calendar
            </div>
          )}
          
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="neu-card"
            >
              Close
            </Button>
            {!isReadOnly && (
              <Button
                type="submit"
                disabled={!formData.title.trim()}
                className="neu-card bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-neu hover:shadow-neu-lg transition-all"
              >
                Update Event
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}