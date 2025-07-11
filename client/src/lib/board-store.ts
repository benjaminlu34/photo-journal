import { create } from 'zustand';
import type { NoteData } from '@/types/notes';
import { getBoardSdk } from './board-sdk';

interface State {
  notes: Record<string, NoteData>;
  hydrated: boolean;
  sdk?: ReturnType<typeof getBoardSdk>;
  actions: {
    init: (spaceId: string, userId?: string, userName?: string) => void;
    create: (n: NoteData) => void;
    update: (id: string, u: Partial<NoteData>) => void;
    remove: (id: string) => void;
  };
}

export const useBoardStore = create<State>((set) => ({
  notes: {},
  hydrated: false,
  actions: {
    init: (spaceId, userId = 'anonymous', userName = 'Anonymous') => {
      const sdk = getBoardSdk(spaceId, userId, userName);
      // ① initial snapshot
      set({ notes: Object.fromEntries((sdk.getNotes() as NoteData[]).map((n: NoteData) => [n.id, n])), hydrated: true, sdk });
      // ② subscribe to all remote/local changes
      sdk.onChange((all: NoteData[]) => set({ notes: Object.fromEntries(all.map((n: NoteData) => [n.id, n])) }));
      // ③ expose CRUD that simply proxies to SDK
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