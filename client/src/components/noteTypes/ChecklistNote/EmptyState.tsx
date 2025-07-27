import React from "react";
import { motion } from "framer-motion";
import { CheckSquare, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  onAddFirstItem?: () => void;
  className?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAddFirstItem, className }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "flex flex-col items-center justify-center py-8 px-4 text-center",
        "min-h-[120px]", // Ensure minimum height for the empty state
        className
      )}
      role="region"
      aria-label="Empty checklist"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-3"
      >
        <div className={cn(
          "w-12 h-12 rounded-full",
          "bg-white/20 backdrop-blur-sm",
          "border border-white/30",
          "flex items-center justify-center",
          "shadow-sm"
        )}>
          <CheckSquare className="w-6 h-6 text-gray-600/70" />
        </div>
      </motion.div>

      {/* Main message */}
      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="text-sm font-medium text-gray-700 mb-1"
      >
        Your checklist is empty
      </motion.h3>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="text-xs text-gray-500 mb-4 max-w-[200px] leading-relaxed"
      >
        Add your first task to get started organizing your thoughts
      </motion.p>

      {/* Call to action */}
      <motion.button
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.4, duration: 0.3 }}
        onClick={onAddFirstItem}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onAddFirstItem?.();
          }
        }}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-2 text-xs",
          "bg-white/30 hover:bg-white/40",
          "border border-white/40 hover:border-white/50",
          "rounded-md backdrop-blur-sm",
          "text-gray-700 hover:text-gray-800",
          "transition-all duration-200 ease-in-out",
          "hover:shadow-sm hover:scale-105",
          "focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-1",
          "active:scale-95"
        )}
        aria-label="Add your first checklist item"
        type="button"
        tabIndex={0}
      >
        <Plus className="w-3 h-3" />
        Add first item
      </motion.button>

      {/* Accessibility description */}
      <div className="sr-only" id="empty-checklist-description">
        This checklist is currently empty. Use the input field below or click the "Add first item" button to create your first task.
      </div>
    </motion.div>
  );
};

export default EmptyState;