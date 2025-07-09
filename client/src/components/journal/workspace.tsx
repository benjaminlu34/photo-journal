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
        x: offset.x - workspaceRect.left - 120,
        y: offset.y - workspaceRect.top - 80,
        width: 240,
        height: 180,
        rotation: Math.random() * 6 - 3,
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
      <div className="flex-1 flex items-center justify-center relative">
        <div className="text-center neumorphic-card p-12 rounded-2xl max-w-md mx-auto">
          <div className="w-20 h-20 gradient-button rounded-full flex items-center justify-center mx-auto mb-6 animate-glow">
            <Plus className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-4">Begin Your Story</h3>
          <p className="text-white/70 mb-6 leading-relaxed">Create your first journal entry by adding beautiful content blocks</p>
          <Button onClick={addQuickNote} className="gradient-button text-white font-semibold px-6 py-3 rounded-xl">
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
      className={`flex-1 relative overflow-auto ${isOver ? "bg-primary-500/10" : ""}`}
    >
      {/* Content Blocks */}
      {currentEntry.contentBlocks.map((block) => (
        <ContentBlock key={block.id} block={block} />
      ))}

      {/* Floating Add Button */}
      <Button
        onClick={addQuickNote}
        className="fixed bottom-8 right-96 w-16 h-16 gradient-button rounded-full group z-50 animate-glow"
      >
        <Plus className="w-8 h-8 text-white group-hover:rotate-90 transition-transform duration-300" />
      </Button>

      {/* Drop Zone Indicator */}
      {isOver && (
        <div className="absolute inset-4 neumorphic-card border-2 border-dashed border-primary-400/50 rounded-3xl flex items-center justify-center animate-glow">
          <div className="text-center">
            <Plus className="w-16 h-16 text-primary-400 mx-auto mb-4 animate-bounce-gentle" />
            <p className="text-white font-semibold text-xl">Drop your content here</p>
            <p className="text-white/60 mt-2">Create something beautiful</p>
          </div>
        </div>
      )}
    </div>
  );
}