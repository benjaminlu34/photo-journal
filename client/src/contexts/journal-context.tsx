import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ViewMode, JournalEntryData, ContentBlockData, Position, ContentBlockType, Friend } from "@/types/journal";
import { blocksToNotes, noteToBlockPatch, type StickyNoteData } from "@/mappers";

interface JournalContextType {
  // State
  currentDate: Date;
  viewMode: ViewMode;
  currentEntry: JournalEntryData | null;
  friends: Friend[];
  gridSnap: boolean;
  
  // Legacy content block actions
  setCurrentDate: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  createContentBlock: (type: ContentBlockType, content: any, position: Position) => void;
  updateContentBlock: (id: string, updates: Partial<ContentBlockData>) => void;
  deleteContentBlock: (id: string) => void;
  updateBlockPosition: (id: string, position: Position) => void;
  
  // New note-based actions (shim to legacy system)
  legacyNotes: StickyNoteData[];
  updateNote: (id: string, data: Partial<StickyNoteData>) => void;
  deleteNote: (id: string) => void;
  setGridSnap: (enabled: boolean) => void;
  
  // Loading states
  isLoading: boolean;
  isCreatingBlock: boolean;
  isUpdatingBlock: boolean;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function useJournal() {
  const context = useContext(JournalContext);
  if (context === undefined) {
    throw new Error("useJournal must be used within a JournalProvider");
  }
  return context;
}

// Alias for StickyNoteShell compatibility
export const useNoteContext = useJournal;

interface JournalProviderProps {
  children: ReactNode;
}

export function JournalProvider({ children }: JournalProviderProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [gridSnap, setGridSnap] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const dateString = currentDate.toISOString().split('T')[0];

  // Fetch current journal entry
  const { data: currentEntry, isLoading } = useQuery({
    queryKey: ["/api/journal", dateString],
    enabled: !!dateString,
    retry: false,
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  // Fetch friends
  const { data: friends = [] } = useQuery({
    queryKey: ["/api/friends"],
    retry: false,
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  // Create content block mutation
  const createBlockMutation = useMutation({
    mutationFn: async (data: { type: ContentBlockType; content: any; position: Position }) => {
      if (!currentEntry) throw new Error("No current entry");
      
      const response = await apiRequest("POST", "/api/content-blocks", {
        entryId: currentEntry.id,
        type: data.type,
        content: data.content,
        position: data.position,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", dateString] });
      toast({
        title: "Content added",
        description: "Your content block has been created successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create content block. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update content block mutation
  const updateBlockMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContentBlockData> }) => {
      const response = await apiRequest("PATCH", `/api/content-blocks/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", dateString] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update content block. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Delete content block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/content-blocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal", dateString] });
      toast({
        title: "Content deleted",
        description: "Your content block has been removed.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete content block. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createContentBlock = (type: ContentBlockType, content: any, position: Position) => {
    createBlockMutation.mutate({ type, content, position });
  };

  const updateContentBlock = (id: string, updates: Partial<ContentBlockData>) => {
    updateBlockMutation.mutate({ id, updates });
  };

  const deleteContentBlock = (id: string) => {
    deleteBlockMutation.mutate(id);
  };

  const updateBlockPosition = (id: string, position: Position) => {
    updateBlockMutation.mutate({ id, updates: { position } });
  };

  // Convert content blocks to notes for the new system
  const legacyNotes = currentEntry?.contentBlocks ? blocksToNotes(currentEntry.contentBlocks) : [];

  // Note-based actions that bridge to the legacy system
  const updateNote = (id: string, data: Partial<StickyNoteData>) => {
    const blockUpdates = noteToBlockPatch(data);
    updateContentBlock(id, blockUpdates);
  };

  const deleteNote = (id: string) => {
    deleteContentBlock(id);
  };

  const value: JournalContextType = {
    currentDate,
    viewMode,
    currentEntry: currentEntry || null,
    friends,
    gridSnap,
    setCurrentDate,
    setViewMode,
    createContentBlock,
    updateContentBlock,
    deleteContentBlock,
    updateBlockPosition,
    legacyNotes,
    updateNote,
    deleteNote,
    setGridSnap,
    isLoading,
    isCreatingBlock: createBlockMutation.isPending,
    isUpdatingBlock: updateBlockMutation.isPending,
  };

  return (
    <JournalContext.Provider value={value}>
      {children}
    </JournalContext.Provider>
  );
}
