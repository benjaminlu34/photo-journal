export type ViewMode = "daily" | "weekly-calendar" | "weekly-creative" | "monthly";

export type ContentBlockType = "sticky_note" | "photo" | "text" | "checklist" | "audio" | "drawing";

export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface ContentBlockData {
  id: string;
  type: ContentBlockType;
  content: any;
  position: Position;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryData {
  id: string;
  userId: string;
  date: string;
  title: string | null;
  contentBlocks: ContentBlockData[];
  createdAt: string;
  updatedAt: string;
  owner?: {
    id: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
  };
  permissions?: {
    canEdit: boolean;
    canCreate: boolean;
    canDelete: boolean;
    effectiveRole: 'owner' | 'editor' | 'contributor' | 'viewer';
  };
}

export interface Friend {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
}

export interface DragItem {
  type: string;
  id: string;
  blockType?: ContentBlockType;
}
