import { create } from 'zustand';
import type { NoteData } from '@/types/notes';
import { getBoardSdk } from './board-sdk';

interface State {
  notes: Record<string, NoteData>;
  hydrated: boolean;
  sdk?: ReturnType<typeof getBoardSdk>;
  userId?: string;
  actions: {
    init: (spaceId: string, userId?: string, userName?: string, username?: string) => void;
    create: (n: NoteData) => void;
    update: (id: string, u: Partial<NoteData>) => void;
    remove: (id: string) => void;
  };
}

export const useBoardStore = create<State>((set) => ({
  notes: {},
  hydrated: false,
  userId: undefined,
  actions: {
    init: (spaceId, userId = 'anonymous', userName = 'Anonymous', username?: string) => {
      const sdk = getBoardSdk(spaceId, userId, userName, username);
      set({ userId });
      
      // ① initial snapshot
      set({ notes: Object.fromEntries((sdk.getNotes() as NoteData[]).map((n: NoteData) => [n.id, n])), hydrated: true, sdk });
      
      // ② subscribe to all remote/local changes with permission filtering
      sdk.onChange((all: NoteData[]) => {
        // Filter notes based on permissions (owner-based filtering)
        const filteredNotes = all.filter(note => {
          // For now, allow all notes as permissions are handled by server-side RLS
          return true;
        });
        
        set({ notes: Object.fromEntries(filteredNotes.map((n: NoteData) => [n.id, n])) });
      });
      
      // ③ expose CRUD that simply proxies to SDK (permissions handled by SDK)
      set((s) => ({
        actions: {
          ...s.actions,
          create: sdk.createNote,
          update: sdk.updateNote,
          remove: sdk.deleteNote,
        },
      }));
    },
    create: () => {},
    update: () => {},
    remove: () => {},
  },
}));