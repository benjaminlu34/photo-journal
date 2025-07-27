import React from "react";
import { useDragLayer } from "react-dnd";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, GripVertical } from "lucide-react";
import type { ChecklistItem } from "@/types/checklist";

interface DragLayerCollectedProps {
  item: any;
  itemType: string | symbol | null;
  currentOffset: { x: number; y: number } | null;
  isDragging: boolean;
}

const ChecklistDragPreview: React.FC = () => {
  return null;
};

export default ChecklistDragPreview;