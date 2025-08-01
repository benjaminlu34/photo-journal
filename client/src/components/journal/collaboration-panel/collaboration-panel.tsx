import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/floating-input";
import { Badge } from "@/components/ui/badge";
import { UserDisplay } from "@/components/ui/user-display";
import { useJournal } from "@/contexts/journal-context";
import { useBoardStore } from '@/lib/board-store';
import { useUser } from '@/hooks/useUser';
import type { ContentBlockType, Position } from "@/types/journal";
import type { NoteData } from "@/types/notes";
import type { UserDisplayData } from '@/lib/usernameUtils';
import {
  Search,
  FolderOpen,
  StickyNote,
  Camera,
  Mic,
  CheckSquare,
  FileText,
  Palette,
  Image,
  FileIcon,
  Users,
} from "lucide-react";

interface ContentTypeButtonProps {
  type: ContentBlockType;
  icon: any;
  label: string;
  color: string;
  currentUserRole?: 'owner' | 'editor' | 'contributor' | 'viewer';
}

function ContentTypeButton({
  type,
  icon: Icon,
  label,
  color,
  currentUserRole,
}: ContentTypeButtonProps) {
  const { create } = useBoardStore((s) => s.actions);

  // Map legacy content block types to new note types
  const getNoteType = (legacyType: ContentBlockType): NoteData['type'] => {
    switch (legacyType) {
      case "sticky_note":
        return "sticky_note";
      case "checklist":
        return "checklist";
      case "photo":
        return "image";
      default:
        return "sticky_note";
    }
  };

  const handleClick = () => {
    // Check permissions
    if (currentUserRole === 'viewer' || currentUserRole === undefined) {
      return;
    }

    const position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      width: 240,
      height: 180,
      rotation: Math.random() * 6 - 3,
    };
    const noteType = getNoteType(type);
    try {
      const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      let content: any;
      switch (noteType) {
        case 'sticky_note':
          content = { type: 'sticky_note', text: 'New sticky note' };
          break;
        case 'checklist':
          content = { type: 'checklist', items: [{ id: '1', text: 'New item', completed: false }] };
          break;
        case 'image':
          content = { type: 'image', imageUrl: undefined, alt: undefined };
          break;
        default:
          content = { type: noteType, text: 'New note' };
      }
      const newNote = {
        id,
        type: noteType,
        position,
        content,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      create(newNote);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center space-x-3 p-4 rounded-xl neu-card hover:shadow-neu-active transition-all duration-200"
    >
      <Icon className={`w-5 h-5 ${color} filter drop-shadow-md`} />
      <span className="text-sm font-semibold text-gray-800">{label}</span>
    </button>
  );
}

export function CollaborationPanel() {
  const [searchQuery, setSearchQuery] = useState("");
  const { currentEntry, currentUserRole } = useJournal();
  const { data: currentUser } = useUser();
  const { sdk } = useBoardStore();
  const [activeCollaborators, setActiveCollaborators] = useState<Array<{
    id: string;
    name: string;
    username?: string;
    displayName?: string;
    color: string;
  }>>([]);

  // Track active collaborators
  useEffect(() => {
    if (!sdk?.presence) return;

    const awareness = sdk.presence;

    const updateCollaborators = () => {
      const states = awareness.getStates();
      const collaborators: Array<{
        id: string;
        name: string;
        username?: string;
        displayName?: string;
        color: string;
      }> = [];
      
      states.forEach((state, clientId) => {
        if (state.user && clientId !== awareness.clientID) {
          collaborators.push(state.user);
        }
      });
      
      setActiveCollaborators(collaborators);
    };

    // Initial update
    updateCollaborators();

    // Listen for changes
    awareness.on('change', updateCollaborators);

    return () => {
      awareness.off('change', updateCollaborators);
    };
  }, [sdk]);

  const contentTypes: ContentTypeButtonProps[] = [
    {
      type: "sticky_note",
      icon: StickyNote,
      label: "Sticky Note",
      color: "text-red-500",
    },
    { type: "photo", icon: Camera, label: "Photo", color: "text-blue-500" },
    {
      type: "checklist",
      icon: CheckSquare,
      label: "Checklist",
      color: "text-green-500",
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
    <div className="w-80 bg-surface flex flex-col h-screen p-4 space-y-4">
      {/* Header Card */}
      <div className="neu-card p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <Button
            size="sm"
            className="neu-button text-white font-semibold px-3 py-2 rounded-xl text-xs"
          >
            <FolderOpen className="w-3 h-3 mr-1" />
            <span>Library</span>
          </Button>
          <div className="flex items-center space-x-1 text-gray-600">
            <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
              M
            </span>
            <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded">
              T
            </span>
            <span className="text-xs font-medium gradient-button px-2 py-1 rounded text-white">
              W
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <FloatingInput
            type="text"
            label="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="neu-inset text-gray-800 border-0 flex-1 text-sm"
          />
        </div>
      </div>

      {/* Active Collaborators Card */}
      <div className="neu-card p-6 flex-shrink-0">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
          <Users className="w-4 h-4 text-purple-500 mr-2" />
          Active Collaborators ({activeCollaborators.length})
        </h3>
        {activeCollaborators.length > 0 ? (
          <div className="space-y-3">
            {activeCollaborators.map((collaborator) => {
              const userDisplayData: UserDisplayData = {
                id: collaborator.id,
                username: collaborator.username,
                firstName: collaborator.name,
              };

              return (
                <div
                  key={collaborator.id}
                  className="flex items-center space-x-3 p-3 rounded-xl bg-green-50 hover:bg-green-100 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-full shadow-sm"
                    style={{ backgroundColor: collaborator.color }}
                  />
                  <UserDisplay
                    user={userDisplayData}
                    variant="short"
                    size="sm"
                    showAvatar={true}
                    className="flex-1"
                  />
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                    Online
                  </Badge>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-4">
            <div className="text-gray-500 text-sm">
              No other collaborators online
            </div>
            <div className="text-gray-400 text-xs mt-1">
              Share this journal entry to collaborate in real-time
            </div>
          </div>
        )}
      </div>

      {/* Add Content Card */}
      <div className="neu-card p-6 flex-shrink-0">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
          <FolderOpen className="w-4 h-4 text-purple-500 mr-2" />
          Add Content
        </h3>
        <p className="text-xs text-gray-600 mb-4">
          Click one of the options below to add to your workspace!
        </p>
        <div className="space-y-3">
          {contentTypes.map((contentType) => (
            <ContentTypeButton
              key={contentType.type}
              {...contentType}
              currentUserRole={currentUserRole}
            />
          ))}
        </div>
      </div>

      {/* Media Gallery Card */}
      <div className="neu-card p-6 flex-1 overflow-hidden flex flex-col">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center">
          <Image className="w-4 h-4 text-purple-500 mr-2" />
          Media Gallery
        </h3>
        <div className="grid grid-cols-2 gap-3 overflow-y-auto">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="relative group cursor-pointer rounded-lg overflow-hidden neu-card hover:shadow-neu-active transition-all duration-200"
            >
              <img
                src={item.url}
                alt={item.alt}
                className="w-full h-20 object-cover"
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <Button
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 neu-button text-white"
                >
                  <FileIcon className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
