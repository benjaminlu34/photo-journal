import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUsernameNavigation } from "@/hooks/useUsernameNavigation";
import { isUnauthorizedError } from "@/lib/authUtils";
import type {
  ViewMode,
  JournalEntryData,
  ContentBlockData,
  Position,
  ContentBlockType,
  Friend,
} from "@/types/journal";
// Removed: import { blocksToNotes, noteToBlockPatch, type StickyNoteData } from "@/mappers";

// Timezone-safe date parsing utilities
function parseLocalDate(dateString: string): Date {
  // Parse date string as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

function formatLocalDate(date: Date): string {
  // Format date as YYYY-MM-DD in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface JournalContextType {
  // State
  currentDate: Date;
  currentWeek: Date;
  viewMode: ViewMode;
  currentEntry: JournalEntryData | null;
  friends: Friend[];
  gridSnap: boolean;
  currentUserRole: 'owner' | 'editor' | 'contributor' | 'viewer';

  // Legacy content block actions
  setCurrentDate: (date: Date) => void;
  setCurrentWeek: (date: Date) => void;
  setViewMode: (mode: ViewMode) => void;
  createContentBlock: (
    type: ContentBlockType,
    content: any,
    position: Position,
  ) => void;
  updateContentBlock: (id: string, updates: Partial<ContentBlockData>) => void;
  deleteContentBlock: (id: string) => void;
  updateBlockPosition: (id: string, position: Position) => void;

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
  const { date: urlDate, username: urlUsername } = useParams();
  const [viewMode, setViewMode] = useState<ViewMode>("daily");
  const [gridSnap, setGridSnap] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { navigateToUserBoard, navigateToMyBoard } = useUsernameNavigation();

  // Get today's date string for stable comparison
  const todayString = useMemo(() => {
    const today = new Date();
    return formatLocalDate(today);
  }, []); // Empty dependency array means this only runs once

  // Parse date from URL or use today's date (timezone-safe) - memoized to prevent re-renders
  const currentDate = useMemo(() => {
    return urlDate ? parseLocalDate(urlDate) : parseLocalDate(todayString);
  }, [urlDate, todayString]);
  
  const dateString = useMemo(() => formatLocalDate(currentDate), [currentDate]);

  // Track current week for weekly views - initialize based on current date
  const [currentWeek, setCurrentWeek] = useState(() => currentDate);

  // Update currentWeek when currentDate changes, but only if we're not in a weekly view
  // This prevents the circular dependency
  useEffect(() => {
    if (viewMode !== "weekly-calendar" && viewMode !== "weekly-creative") {
      setCurrentWeek(currentDate);
    }
  }, [currentDate, viewMode]);

  // Function to update the current date (updates URL) - memoized to prevent re-renders
  const setCurrentDate = useCallback((newDate: Date) => {
    if (urlUsername) {
      navigateToUserBoard(urlUsername, newDate);
    } else {
      navigateToMyBoard(newDate);
    }
  }, [urlUsername, navigateToUserBoard, navigateToMyBoard]);

  // Function to update the current week - memoized
  const setCurrentWeekMemo = useCallback((newWeek: Date) => {
    setCurrentWeek(newWeek);
  }, []);

  // Function to update view mode - memoized
  const setViewModeMemo = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  // Fetch current journal entry - use username-based API if in username route
  const apiEndpoint = urlUsername
    ? `/api/journal/user/${urlUsername}/${dateString}`
    : `/api/journal/${dateString}`;

  const { data: currentEntry, isLoading } = useQuery<
    JournalEntryData | null,
    Error,
    JournalEntryData | null
  >({
    queryKey: [apiEndpoint],
    enabled: !!dateString,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Fetch friends
  const { data: friends = [] } = useQuery<Friend[], Error, Friend[]>({
    queryKey: ["/api/friends"],
    retry: false,
  });

  // Create content block mutation
  const createBlockMutation = useMutation({
    mutationFn: async (data: {
      type: ContentBlockType;
      content: any;
      position: Position;
    }) => {
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
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
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

  // Update content block mutation with optimistic updates
  const updateBlockMutation = useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<ContentBlockData>;
    }) => {
      const response = await apiRequest(
        "PATCH",
        `/api/content-blocks/${id}`,
        updates,
      );
      return response.json();
    },
    onMutate: async ({ id, updates }) => {
      // Cancel any outgoing refetches to avoid overwriting our optimistic update
      await queryClient.cancelQueries({ queryKey: [apiEndpoint] });

      // Snapshot the previous value
      const previousEntry = queryClient.getQueryData<JournalEntryData>([apiEndpoint]);

      // Optimistically update the cache
      if (previousEntry) {
        const optimisticEntry: JournalEntryData = {
          ...previousEntry,
          contentBlocks: previousEntry.contentBlocks.map(block =>
            block.id === id ? { ...block, ...updates, updatedAt: new Date().toISOString() } : block
          )
        };
        queryClient.setQueryData([apiEndpoint], optimisticEntry);
      }

      // Return a context object with the snapshotted value
      return { previousEntry };
    },
    onSuccess: (data, variables) => {
      // Update the cache with the server response to ensure consistency
      const currentEntry = queryClient.getQueryData<JournalEntryData>([apiEndpoint]);
      if (currentEntry) {
        const updatedEntry: JournalEntryData = {
          ...currentEntry,
          contentBlocks: currentEntry.contentBlocks.map(block =>
            block.id === variables.id ? { ...block, ...data } : block
          )
        };
        queryClient.setQueryData([apiEndpoint], updatedEntry);
      }
    },
    onError: (error: Error, variables, context) => {
      // If the mutation fails, rollback to the previous value
      if (context?.previousEntry) {
        queryClient.setQueryData([apiEndpoint], context.previousEntry);
      }

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

      // Only refetch on error to ensure we have the latest data
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
    },
  });

  // Delete content block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/content-blocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiEndpoint] });
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

  const createContentBlock = useCallback((
    type: ContentBlockType,
    content: any,
    position: Position,
  ) => {
    createBlockMutation.mutate({ type, content, position });
  }, [createBlockMutation]);

  const updateContentBlock = useCallback((
    id: string,
    updates: Partial<ContentBlockData>,
  ) => {
    updateBlockMutation.mutate({ id, updates });
  }, [updateBlockMutation]);

  const deleteContentBlock = useCallback((id: string) => {
    deleteBlockMutation.mutate(id);
  }, [deleteBlockMutation]);

  const updateBlockPosition = useCallback((id: string, position: Position) => {
    updateBlockMutation.mutate({ id, updates: { position } });
  }, [updateBlockMutation]);

  // Removed: legacyNotes, updateNote, deleteNote, and their usages

  // Memoize the context value to prevent unnecessary re-renders
  const value: JournalContextType = useMemo(() => ({
    currentDate,
    currentWeek,
    viewMode,
    currentEntry: currentEntry || null,
    friends,
    gridSnap,
    currentUserRole: currentEntry?.permissions?.effectiveRole || (urlUsername ? 'viewer' : 'owner'),
    setCurrentDate,
    setCurrentWeek: setCurrentWeekMemo,
    setViewMode: setViewModeMemo,
    createContentBlock,
    updateContentBlock,
    deleteContentBlock,
    updateBlockPosition,
    isLoading,
    isCreatingBlock: createBlockMutation.isPending,
    isUpdatingBlock: updateBlockMutation.isPending,
  }), [
    currentDate,
    currentWeek,
    viewMode,
    currentEntry,
    friends,
    gridSnap,
    urlUsername,
    setCurrentDate,
    setCurrentWeekMemo,
    setViewModeMemo,
    createContentBlock,
    updateContentBlock,
    deleteContentBlock,
    updateBlockPosition,
    createBlockMutation.isPending,
    updateBlockMutation.isPending,
    isLoading
  ]);

  return (
    <JournalContext.Provider value={value}>{children}</JournalContext.Provider>
  );
}