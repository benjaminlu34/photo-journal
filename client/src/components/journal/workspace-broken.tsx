import { useRef } from "react";
import { useDrop } from "react-dnd";
import { Button } from "@/components/ui/button";
import { ContentBlock } from "./content-block";
import { WeeklyCalendarView } from "./weekly-calendar-view";
import { WeeklyCreativeView } from "./weekly-creative-view";
import { MonthlyView } from "./monthly-view";
import { useJournal } from "@/contexts/journal-context";
import type { DragItem, Position, ContentBlockType } from "@/types/journal";
import { Plus } from "lucide-react";

export function JournalWorkspace() {
  const { currentEntry, createContentBlock, viewMode } = useJournal();

  // Return appropriate view based on viewMode
  if (viewMode === "weekly-calendar") {
    return <WeeklyCalendarView />;
  }
  
  if (viewMode === "weekly-creative") {
    return <WeeklyCreativeView />;
  }
  
  if (viewMode === "monthly") {
    return <MonthlyView />;
  }

  // Daily view (default)
  const workspaceRef = useRef<HTMLDivElement>(null);

  const [{ isOver }, drop] = useDrop({
    accept: ["content-block", "new-content"],
    drop: (item: DragItem, monitor) => {
      const offset = monitor.getClientOffset();
      const workspaceRect = workspaceRef.current?.getBoundingClientRect();
      
      if (!offset || !workspaceRect) return;

      const position: Position = {
        x: offset.x - workspaceRect.left - 120, // Offset for block width
        y: offset.y - workspaceRect.top - 80,   // Offset for block height
        width: 240,
        height: 180,
        rotation: Math.random() * 6 - 3, // Random rotation between -3 and 3 degrees
      };

      if (item.type === "new-content" && item.blockType) {
        const defaultContent = getDefaultContent(item.blockType);
        createContentBlock(item.blockType, defaultContent, position);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  const getDefaultContent = (type: ContentBlockType) => {
    switch (type) {
      case "sticky_note":
        return { text: "New note..." };
      case "text":
        return { text: "Write your thoughts..." };
      case "checklist":
        return { items: [{ text: "New task", completed: false }] };
      case "photo":
        return { url: "", caption: "" };
      case "audio":
        return { url: "", duration: "0:00" };
      case "drawing":
        return { strokes: [] };
      default:
        return {};
    }
  };

  const addQuickNote = () => {
    const position: Position = {
      x: Math.random() * 400 + 100,
      y: Math.random() * 300 + 100,
      width: 240,
      height: 180,
      rotation: Math.random() * 6 - 3,
    };
    
    createContentBlock("sticky_note", { text: "New note..." }, position);
  };

  if (!currentEntry) {
    return (
      <div className="flex-1 flex items-center justify-center neumorphic-panel">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="w-8 h-8 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold text-secondary-800 mb-2">No journal entry yet</h3>
          <p className="text-secondary-500 mb-4">Start creating your daily journal by adding content blocks</p>
          <Button onClick={addQuickNote} className="bg-primary-500 hover:bg-primary-600">
            <Plus className="w-4 h-4 mr-2" />
            Add First Note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={(node) => {
        workspaceRef.current = node;
        drop(node);
      }}
      className={`flex-1 relative overflow-auto ${
        isOver ? "bg-primary-50" : ""
      }`}
      style={{
        background: "linear-gradient(135deg, hsl(220, 14%, 97%) 0%, hsl(220, 14%, 99%) 50%, hsl(220, 14%, 95%) 100%)",
        backgroundImage: "radial-gradient(circle at 1px 1px, rgba(139, 126, 200, 0.1) 1px, transparent 0)",
        backgroundSize: "20px 20px"
      }}
    >
      {/* Content Blocks */}
      {currentEntry.contentBlocks.map((block) => (
        <ContentBlock key={block.id} block={block} />
      ))}

      {/* Floating Add Button */}
      <Button
        onClick={addQuickNote}
        className="fixed bottom-8 right-96 w-14 h-14 bg-primary-500 text-white rounded-full shadow-neumorphic hover:bg-primary-600 hover:shadow-lg transition-all group"
      >
        <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
      </Button>

      {/* Drop Zone Indicator */}
      {isOver && (
        <div className="absolute inset-4 border-2 border-dashed border-primary-300 bg-primary-50/50 rounded-2xl flex items-center justify-center">
          <div className="text-center">
            <Plus className="w-12 h-12 text-primary-400 mx-auto mb-2" />
            <p className="text-primary-600 font-medium">Drop content here</p>
          </div>
        </div>
      )}
    </div>
  );
}
