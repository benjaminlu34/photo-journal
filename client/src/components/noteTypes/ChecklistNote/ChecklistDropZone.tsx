import React from "react";
import { useDrop } from "react-dnd";
import { cn } from "@/lib/utils";
import type { DragItem, DropCollectedProps } from "@/types/notes";

interface ChecklistDropZoneProps {
  index: number;
  onDrop: (dragIndex: number, dropIndex: number) => void;
  isVisible?: boolean;
}

const ChecklistDropZone: React.FC<ChecklistDropZoneProps> = ({
  index,
  onDrop,
  isVisible = false,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop<DragItem, void, DropCollectedProps>({
    accept: 'CHECKLIST_ITEM',
    drop: (draggedItem: DragItem) => {
      onDrop(draggedItem.index, index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  const showDropZone = isVisible || (isOver && canDrop);

  return (
    <div
      ref={drop}
      className={cn(
        "transition-all duration-200 ease-in-out",
        showDropZone
          ? "h-8 my-1 border-2 border-dashed border-blue-400 bg-blue-50/30 rounded-lg flex items-center justify-center"
          : "h-0 overflow-hidden"
      )}
      role="region"
      aria-label={`Drop zone ${index}`}
    >
      {showDropZone && (
        <div className="text-xs text-blue-600 font-medium">
          Drop here
        </div>
      )}
    </div>
  );
};

export default ChecklistDropZone;