import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Tag } from "lucide-react";
import { format } from "date-fns";
import type { CalendarEvent, LocalEvent } from "@/types/calendar";
import { availableColors } from "@shared/config/calendar-config";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  event?: CalendarEvent | LocalEvent;
  initialDate?: Date;
}

export function EventModal({ isOpen, onClose, event, initialDate }: EventModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startTime: initialDate ? new Date(initialDate.getTime()) : new Date(),
    endTime: initialDate ? new Date(initialDate.getTime() + 60 * 60 * 1000) : new Date(Date.now() + 60 * 60 * 1000),
    isAllDay: false,
    location: "",
    color: "#3B82F6",
    reminderMinutes: 30,
    tags: [] as string[],
  });
  
  const [tagInput, setTagInput] = useState("");
  
  useEffect(() => {
    if (event) {
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
    } else if (initialDate) {
      setFormData(prev => ({
        ...prev,
        startTime: new Date(initialDate.getTime()),
        endTime: new Date(initialDate.getTime() + 60 * 60 * 1000),
      }));
    }
  }, [event, initialDate]);
  
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
    
    const eventData = {
      title: formData.title,
      description: formData.description,
      startTime: formData.startTime,
      endTime: formData.endTime,
      isAllDay: formData.isAllDay,
      location: formData.location,
      color: formData.color,
      reminderMinutes: formData.reminderMinutes,
      tags: formData.tags,
    };
    
    // Mock functionality for UI purposes
    console.log("Event submitted:", eventData);
    onClose();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md neu-card">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-600" />
            {event ? "Edit Event" : "Create Event"}
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
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="allDay"
              checked={formData.isAllDay}
              onCheckedChange={(checked) => handleInputChange("isAllDay", checked)}
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
          
          <div>
            <Label htmlFor="reminder" className="text-sm font-medium text-gray-700">
              Reminder
            </Label>
            <Select
              value={formData.reminderMinutes.toString()}
              onValueChange={(value) => handleInputChange("reminderMinutes", parseInt(value))}
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
          
          <div>
            <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Tags
            </Label>
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
            {formData.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 neu-inset"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-purple-600 hover:text-purple-900"
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="neu-card"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim()}
              className="neu-card bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(var(--accent))] hover:from-[hsl(var(--primary))] hover:to-[hsl(var(--accent))] text-white shadow-neu hover:shadow-neu-lg transition-all"
            >
              {event ? "Update" : "Create"} Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}