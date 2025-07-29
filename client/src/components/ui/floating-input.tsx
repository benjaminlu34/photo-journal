import * as React from "react"
import { cn } from "@/lib/utils"

interface FloatingInputProps extends React.ComponentProps<"input"> {
  label: string
  error?: string
  helperText?: string
  focused?: boolean; // New prop for external control of focus state
}

const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, label, error, helperText, id, type = "text", focused: controlledFocused, ...props }, ref) => {
    const [internalIsFocused, setInternalIsFocused] = React.useState(false);
    const isFocused = controlledFocused !== undefined ? controlledFocused : internalIsFocused;
    const [hasValue, setHasValue] = React.useState(false);
    
    React.useEffect(() => {
      setHasValue(!!props.value && String(props.value).length > 0)
    }, [props.value])
    
    const inputId = id || `floating-input-${React.useId()}`
    const isActive = isFocused || hasValue
    
    return (
      <div className="relative w-full">
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              "w-full px-4 pt-6 pb-2 rounded-xl",
              "bg-white/10 backdrop-blur-md",
              "border border-white/20",
              "text-foreground placeholder-transparent",
              "focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20",
              "transition-all duration-200 ease-in-out",
              "neumorphic-inset",
              error && "border-red-400 focus:border-red-400 focus:ring-red-400/20",
              className
            )}
            onFocus={(e) => {
              setInternalIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setInternalIsFocused(false);
              props.onBlur?.(e);
            }}
            onChange={(e) => {
              setHasValue(e.target.value.length > 0);
              props.onChange?.(e);
            }}
            {...props}
          />
          <label
            htmlFor={inputId}
            className={cn(
              "absolute left-4 transition-all duration-200 ease-in-out pointer-events-none",
              isActive
                ? "-top-2 left-2 text-xs text-indigo-400 bg-surface px-1 rounded-md"
                : "top-1/2 -translate-y-1/2 text-base text-muted-foreground"
            )}
          >
            {label}
          </label>
        </div>
        
        {(error || helperText) && (
          <div className="mt-1 text-xs">
            {error && (
              <span className="text-red-400">{error}</span>
            )}
            {helperText && !error && (
              <span className="text-muted-foreground">{helperText}</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
FloatingInput.displayName = "FloatingInput"

export { FloatingInput }