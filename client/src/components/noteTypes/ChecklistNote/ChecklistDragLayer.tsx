import React from "react";
import { useDragLayer } from "react-dnd";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { ChecklistItem } from "@/types/checklist";

interface DragLayerCollectedProps {
  item: {
    type: string;
    id: string;
    index: number;
    checklistItem?: ChecklistItem;
  } | null;
  itemType: string | symbol | null;
  initialOffset: { x: number; y: number } | null;
  currentOffset: { x: number; y: number } | null;
  isDragging: boolean;
}

const ChecklistDragLayer: React.FC = () => {
  const {
    item,
    itemType,
    initialOffset,
    currentOffset,
    isDragging,
  } = useDragLayer<DragLayerCollectedProps>((monitor) => ({
    item: monitor.getItem(),
    itemType: monitor.getItemType(),
    initialOffset: monitor.getInitialSourceClientOffset(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || !item || itemType !== 'CHECKLIST_ITEM' || !currentOffset) {
    return null;
  }

  // Get the checklist item data (this would need to be passed through the drag item)
  const checklistItem = item.checklistItem;
  if (!checklistItem) {
    return null;
  }

  const transform = `translate(${currentOffset.x}px, ${currentOffset.y}px) rotate(2deg)`;

  return (
    <div
      className="fixed top-0 left-0 z-50 pointer-events-none"
      style={{ transform }}
    >
      <div
        className={cn(
          "flex items-center gap-2 p-2 rounded-lg shadow-xl",
          "bg-white/95 backdrop-blur-sm border border-white/60",
          "text-sm max-w-xs transform scale-105"
        )}
      >
        {/* Checkbox preview */}
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0",
            checklistItem.completed
              ? "bg-blue-500 border-blue-500"
              : "bg-white border-gray-300"
          )}
        >
          {checklistItem.completed && <Check className="w-3 h-3 text-white" />}
        </div>

        {/* Text preview */}
        <span
          className={cn(
            "text-gray-800 truncate",
            checklistItem.completed && "line-through text-gray-600"
          )}
        >
          {checklistItem.text}
        </span>
      </div>
    </div>
  );
};

export default ChecklistDragLayer;