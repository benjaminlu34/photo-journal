import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-lg border-0 bg-[#e6e7ee] px-4 py-3 text-base text-gray-800 placeholder:text-gray-500 transition-all duration-300 resize-none",
        // Beautiful neumorphic inset styling
        "shadow-[inset_6px_6px_10px_#c8c9d0,inset_-6px_-6px_10px_#ffffff]",
        // Enhanced focus state with subtle glow
        "focus-visible:outline-none focus-visible:shadow-[inset_4px_4px_8px_#c8c9d0,inset_-4px_-4px_8px_#ffffff,0_0_0_2px_hsl(var(--accent))/30]",
        // Orange text selection styling
        "selection:bg-[hsl(var(--accent))]/20 selection:text-[hsl(var(--primary))]",
        // Disabled state
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:text-gray-400",
        // Responsive text sizing
        "md:text-sm",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
