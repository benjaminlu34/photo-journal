import { useState } from "react";
import { useDrag } from "react-dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useJournal } from "@/contexts/journal-context";
import type { DragItem, ContentBlockType } from "@/types/journal";
import {
  Search,
  FolderOpen,
  Clock,
  StickyNote,
  Camera,
  Mic,
  CheckSquare,
  FileText,
  Palette,
  Image,
  FileIcon,
} from "lucide-react";

interface ContentTypeButtonProps {
  type: ContentBlockType;
  icon: any;
  label: string;
  color: string;
}

function ContentTypeButton({ type, icon: Icon, label, color }: ContentTypeButtonProps) {
  const [{ isDragging }, drag] = useDrag({
    type: "new-content",
    item: (): DragItem => ({ type: "new-content", id: "", blockType: type }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <button
      ref={drag}
      className={`w-full flex items-center space-x-3 p-4 rounded-xl glass-button interactive ${
        isDragging ? "opacity-50 scale-95" : ""
      }`}
    >
      <Icon className={`w-5 h-5 ${color} filter drop-shadow-md`} />
      <span className="text-sm font-semibold text-white">{label}</span>
    </button>
  );
}

export function CollaborationPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentEntry } = useJournal();

  const contentTypes: ContentTypeButtonProps[] = [
    { type: "sticky_note", icon: StickyNote, label: "Sticky Note", color: "text-yellow-500" },
    { type: "photo", icon: Camera, label: "Photo", color: "text-blue-500" },
    { type: "audio", icon: Mic, label: "Voice Note", color: "text-purple-500" },
    { type: "checklist", icon: CheckSquare, label: "Checklist", color: "text-green-500" },
    { type: "text", icon: FileText, label: "Text Block", color: "text-gray-500" },
    { type: "drawing", icon: Palette, label: "Drawing", color: "text-pink-500" },
  ];

  const recentEntries = [
    {
      id: "1",
      title: "Design Mockup v2",
      description: "Just finished the new interface...",
      icon: FileText,
      color: "bg-primary-500",
    },
    {
      id: "2",
      title: "Product Launch Notes",
      description: "Meeting notes from today's session",
      icon: StickyNote,
      color: "bg-orange-500",
    },
    {
      id: "3",
      title: "Demo Recording",
      description: "Voice notes about user feedback",
      icon: Mic,
      color: "bg-green-500",
    },
  ];

  const mediaItems = [
    {
      id: "1",
      type: "image",
      url: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&h=150&fit=crop",
      alt: "Creative workspace",
    },
    {
      id: "2",
      type: "image",
      url: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=200&h=150&fit=crop",
      alt: "Team collaboration",
    },
    {
      id: "3",
      type: "image",
      url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200&h=150&fit=crop",
      alt: "Study setup",
    },
    {
      id: "4",
      type: "image",
      url: "https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200&h=150&fit=crop",
      alt: "Campus sunset",
    },
  ];

  return (
    <div className="w-80 neumorphic-card border-l border-white/10 flex flex-col">
      {/* Header Tabs */}
      <div className="border-b border-white/10 p-6">
        <div className="flex items-center space-x-4">
          <Button
            size="sm"
            className="gradient-button text-white font-semibold px-4 py-2 rounded-xl"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            <span>Content Library</span>
          </Button>
          <span className="text-white/40">|</span>
          <div className="flex items-center space-x-2 text-white/60">
            <span className="text-sm font-medium glass-button px-2 py-1 rounded">M</span>
            <span className="text-sm font-medium glass-button px-2 py-1 rounded">T</span>
            <span className="text-sm font-medium gradient-button px-2 py-1 rounded text-white">W</span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6 relative">
          <Search className="absolute left-3 top-3 w-4 h-4 text-white/40" />
          <Input
            type="text"
            placeholder="Search your content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 glass-button text-white placeholder:text-white/50 border-white/20 focus:border-primary-400 bg-transparent"
          />
        </div>
      </div>

      {/* Recent Entries */}
      <div className="p-6 border-b border-white/10">
        <h3 className="font-bold text-white mb-4 flex items-center">
          <Clock className="w-4 h-4 text-primary-400 mr-2" />
          Recent Entries
        </h3>
        <div className="space-y-3">
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start space-x-3 p-3 rounded-xl glass-button interactive cursor-pointer"
            >
              <div className={`w-10 h-10 gradient-button rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                <entry.icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-white text-sm">{entry.title}</h4>
                <p className="text-xs text-white/60 truncate">{entry.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Types */}
      <div className="p-6 border-b border-white/10">
        <h3 className="font-bold text-white mb-4 flex items-center">
          <FolderOpen className="w-4 h-4 text-primary-400 mr-2" />
          Add Content
        </h3>
        <p className="text-xs text-white/60 mb-4">Drag these to your journal workspace</p>
        <div className="space-y-3">
          {contentTypes.map((contentType) => (
            <ContentTypeButton key={contentType.type} {...contentType} />
          ))}
        </div>
      </div>

      {/* Media Gallery */}
      <div className="p-6 flex-1">
        <h3 className="font-bold text-white mb-4 flex items-center">
          <Image className="w-4 h-4 text-primary-400 mr-2" />
          Media Gallery
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {mediaItems.map((item) => (
            <div key={item.id} className="glass-card rounded-lg overflow-hidden interactive">
              <img
                src={item.url}
                alt={item.alt}
                className="w-full h-20 object-cover"
              />
            </div>
          ))}
        </div>

        {/* File List */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 rounded-lg glass-button interactive cursor-pointer">
            <FileIcon className="w-5 h-5 text-red-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">presentation.pdf</p>
              <p className="text-xs text-white/60">1.8 MB</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
