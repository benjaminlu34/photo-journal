'use client';

import { useEffect, useCallback, useRef } from 'react';
import { createBoardSDK, BoardSDK } from '@/lib/board-sdk';
import { useBoardStore } from '@/lib/store';
import type { NoteData, NoteContent } from '@/types/notes';

// Types for awareness (cursor positions, selections, etc.)
export interface AwarenessState {
  user: {
    id: string;
    name: string;
    color: string;
  };
  cursor?: {
    x: number;
    y: number;
  };
  selectedNoteId?: string | null;
}

interface YjsChangeEvent {
  changes: {
    keys: Map<string, { action: 'add' | 'update' | 'delete' }>;
  };
  origin?: any; // Yjs origin for tracking local vs remote changes
}

interface CollaborationResult {
  updateCursor: (x: number, y: number) => void;
  onLocalDragEnd: () => void; // Signal when local drag ends
  createNote: (type: NoteData['type'], position?: { x: number; y: number; width?: number; height?: number; rotation?: number }) => string;
  updateNote: (id: string, updates: Partial<NoteData>) => void;
  deleteNote: (id: string) => void;
  isConnected: boolean;
}

const SYNC_RETRY_DELAY = 1000;
const MAX_SYNC_RETRIES = 3;
const CRDT_ECHO_THROTTLE = 150; // ms to ignore remote updates after local drag

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * useCollaboration
 *
 * ⚠️ Never call useCollaboration outside CRDTProvider. This hook must only be used inside CRDTProvider to ensure a single Yjs doc/provider per spaceId.
 *
 * Handles Yjs document and WebRTC provider setup for real-time board collaboration.
 */
export const useCollaboration = (userId: string, userName: string, spaceId: string = 'default-board'): BoardSDK => {
  const sdkRef = useRef<BoardSDK | null>(null);
  if (!sdkRef.current) {
    sdkRef.current = createBoardSDK({ spaceId, userId, userName });
  }

  useEffect(() => {
    return () => {
      sdkRef.current?.destroy();
    };
  }, [spaceId]);

  return sdkRef.current;
}; 