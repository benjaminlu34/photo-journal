import { createContext, useContext, ReactNode } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

interface DndContextType {
  // Future DnD utilities can be added here
}

const DndContext = createContext<DndContextType | undefined>(undefined);

export function useDnd() {
  const context = useContext(DndContext);
  if (context === undefined) {
    throw new Error("useDnd must be used within a DndProvider");
  }
  return context;
}

interface DndContextProviderProps {
  children: ReactNode;
}

export function DndContextProvider({ children }: DndContextProviderProps) {
  const value: DndContextType = {
    // Add DnD utilities here as needed
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <DndContext.Provider value={value}>
        {children}
      </DndContext.Provider>
    </DndProvider>
  );
}
