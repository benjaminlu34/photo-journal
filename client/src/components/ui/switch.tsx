import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-0 p-1 transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--accent))]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
      // Beautiful neumorphic styling inspired by CodePen
      // OFF state: soft inset with subtle inner shadow
      "data-[state=unchecked]:bg-[#e6e7ee] data-[state=unchecked]:shadow-[inset_6px_6px_10px_#c8c9d0,inset_-6px_-6px_10px_#ffffff]",
      // ON state: vibrant gradient with soft outer glow
      "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[hsl(var(--accent))] data-[state=checked]:to-[hsl(var(--primary))] data-[state=checked]:shadow-[6px_6px_10px_#c8c9d0,-6px_-6px_10px_#ffffff,inset_0px_0px_0px_transparent]",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-6 w-6 rounded-full transition-all duration-500 ease-out",
        // OFF state: soft elevated white circle
        "data-[state=unchecked]:bg-[#e6e7ee] data-[state=unchecked]:shadow-[6px_6px_10px_#c8c9d0,-6px_-6px_10px_#ffffff] data-[state=unchecked]:translate-x-0",
        // ON state: bright white elevated circle that pops
        "data-[state=checked]:bg-white data-[state=checked]:shadow-[4px_4px_8px_rgba(0,0,0,0.1),-4px_-4px_8px_rgba(255,255,255,0.9)] data-[state=checked]:translate-x-6"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
