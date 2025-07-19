import React, { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (isValid: boolean, error?: string) => void;
  debounceMs?: number;
  className?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

interface ValidationState {
  isChecking: boolean;
  isValid: boolean | null;
  error?: string;
  suggestions?: string[];
}

export function UsernameInput({
  value,
  onChange,
  onValidation,
  debounceMs = 300,
  className,
  label = "Username",
  placeholder = "Enter your username",
  required = false,
}: UsernameInputProps) {
  const [validation, setValidation] = useState<ValidationState>({
    isChecking: false,
    isValid: null,
  });

  // Client-side format validation
  const validateFormat = useCallback((username: string): { isValid: boolean; error?: string } => {
    if (!username) {
      return { isValid: false, error: "Username is required" };
    }

    if (username.length < 3) {
      return { isValid: false, error: "Username must be at least 3 characters" };
    }

    if (username.length > 20) {
      return { isValid: false, error: "Username must be at most 20 characters" };
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      return { isValid: false, error: "Username can only contain lowercase letters, numbers, and underscores" };
    }

    return { isValid: true };
  }, []);

  // Debounced availability check
  const checkAvailability = useCallback(
    async (username: string) => {
      if (!username) return;

      // First check format
      const formatValidation = validateFormat(username);
      if (!formatValidation.isValid) {
        setValidation({
          isChecking: false,
          isValid: false,
          error: formatValidation.error,
        });
        onValidation(false, formatValidation.error);
        return;
      }

      setValidation(prev => ({ ...prev, isChecking: true }));

      try {
        const response = await fetch(`/api/user/check-username?u=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (response.ok) {
          const isValid = data.available;
          const error = isValid ? undefined : (data.error || "Username is not available");
          const suggestions = data.suggestions || [];

          setValidation({
            isChecking: false,
            isValid,
            error,
            suggestions,
          });
          onValidation(isValid, error);
        } else {
          // Handle API errors
          const error = data.message || "Failed to check username availability";
          setValidation({
            isChecking: false,
            isValid: false,
            error,
          });
          onValidation(false, error);
        }
      } catch (error) {
        console.error('Username availability check failed:', error);
        setValidation({
          isChecking: false,
          isValid: false,
          error: "Failed to check username availability",
        });
        onValidation(false, "Failed to check username availability");
      }
    },
    [validateFormat, onValidation]
  );

  // Debounce the availability check
  useEffect(() => {
    if (!value) {
      setValidation({ isChecking: false, isValid: null });
      onValidation(false, "Username is required");
      return;
    }

    const timer = setTimeout(() => {
      checkAvailability(value);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [value, debounceMs, checkAvailability, onValidation]);

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toLowerCase(); // Convert to lowercase
    onChange(newValue);
  };

  // Get validation icon
  const getValidationIcon = () => {
    if (validation.isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-gray-400" />;
    }
    if (validation.isValid === true) {
      return <Check className="h-4 w-4 text-green-500" />;
    }
    if (validation.isValid === false) {
      return <X className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  // Get input border color based on validation state
  const getBorderColor = () => {
    if (validation.isValid === true) return "border-green-500 focus:border-green-500";
    if (validation.isValid === false) return "border-red-500 focus:border-red-500";
    return "";
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label htmlFor="username" className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="relative">
        <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
        <Input
          id="username"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          className={cn(
            "pl-10 pr-10",
            getBorderColor()
          )}
          required={required}
          autoComplete="username"
        />
        <div className="absolute right-3 top-3">
          {getValidationIcon()}
        </div>
      </div>

      {/* Error message */}
      {validation.error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <X className="h-3 w-3" />
          {validation.error}
        </p>
      )}

      {/* Success message */}
      {validation.isValid === true && (
        <p className="text-sm text-green-600 flex items-center gap-1">
          <Check className="h-3 w-3" />
          Username is available!
        </p>
      )}

      {/* Suggestions */}
      {validation.suggestions && validation.suggestions.length > 0 && (
        <div className="text-sm text-gray-600">
          <p className="mb-1">Try these suggestions:</p>
          <div className="flex flex-wrap gap-1">
            {validation.suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => onChange(suggestion)}
                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}