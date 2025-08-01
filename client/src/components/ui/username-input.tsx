import React, { useState, useEffect, useCallback } from 'react';
import { FloatingInput } from '@/components/ui/floating-input';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usernameSchema } from '@shared/schema/schema';

interface UsernameInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidation: (isValid: boolean, error?: string) => void;
  debounceMs?: number;
  className?: string;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
  required?: boolean;
  currentUsername?: string; // The user's current username to skip validation for
}

interface ValidationState {
  isValid: boolean;
  isChecking: boolean;
  error?: string;
  suggestions?: string[];
}

export const UsernameInput: React.FC<UsernameInputProps> = ({
  value,
  onChange,
  onValidation,
  debounceMs = 300,
  className,
  disabled = false,
  label = "Username",
  placeholder = "Enter username",
  required = false,
  currentUsername
}) => {
  const [validation, setValidation] = useState<ValidationState>({
    isValid: false,
    isChecking: false
  });

  // Debounced validation function
  const validateUsername = useCallback(
    async (username: string) => {
      if (!username.trim()) {
        setValidation({ isValid: false, isChecking: false });
        onValidation(false);
        return;
      }

      // First, validate format locally
      try {
        usernameSchema.parse(username);
      } catch (error: any) {
        const errorMessage = error.errors?.[0]?.message || 'Invalid username format';
        setValidation({
          isValid: false,
          isChecking: false,
          error: errorMessage
        });
        onValidation(false, errorMessage);
        return;
      }

      // Then check availability via API
      setValidation({ isValid: false, isChecking: true });

      try {
        const response = await fetch(`/api/user/check-username?u=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (response.ok) {
          if (data.available) {
            setValidation({ isValid: true, isChecking: false });
            onValidation(true);
          } else {
            setValidation({
              isValid: false,
              isChecking: false,
              error: data.error || 'Username is not available',
              suggestions: data.suggestions
            });
            onValidation(false, data.error || 'Username is not available');
          }
        } else {
          const errorMessage = data.message || 'Failed to check username availability';
          setValidation({
            isValid: false,
            isChecking: false,
            error: errorMessage
          });
          onValidation(false, errorMessage);
        }
      } catch (error) {
        console.error('Username validation error:', error);
        setValidation({
          isValid: false,
          isChecking: false,
          error: 'Failed to check username availability'
        });
        onValidation(false, 'Failed to check username availability');
      }
    },
    [onValidation]
  );

  // Debounce the validation
  useEffect(() => {
    if (!value.trim()) {
      setValidation({ isValid: false, isChecking: false });
      onValidation(false);
      return;
    }

    // Skip validation if the value matches the user's current username (case-insensitive)
    if (currentUsername && value.toLowerCase() === currentUsername.toLowerCase()) {
      setValidation({ isValid: true, isChecking: false });
      onValidation(true);
      return;
    }

    const timeoutId = setTimeout(() => {
      validateUsername(value);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [value, debounceMs, validateUsername, currentUsername]);

  const getValidationIcon = () => {
    if (validation.isChecking) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    if (validation.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (validation.error && value.trim()) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    return null;
  };

  const getValidationMessage = () => {
    if (validation.isChecking) {
      return <span className="text-sm text-muted-foreground">Checking availability...</span>;
    }
    if (validation.isValid) {
      // Check if this is the user's current username
      const isCurrentUsername = currentUsername && value.toLowerCase() === currentUsername.toLowerCase();
      return (
        <span className="text-sm text-green-600">
          {isCurrentUsername ? "This is your current username" : "Username is available!"}
        </span>
      );
    }
    if (validation.error && value.trim()) {
      return (
        <div className="space-y-1">
          <span className="text-sm text-red-600">{validation.error}</span>
          {validation.suggestions && validation.suggestions.length > 0 && (
            <div className="text-sm text-muted-foreground">
              Suggestions: {validation.suggestions.join(', ')}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative w-full">
      <FloatingInput
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "pr-10", // Add padding to the right for the icon
          validation.isValid && "border-green-500",
          validation.error && value.trim() && "border-red-500",
          className
        )}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={20}
        required={required}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
        {getValidationIcon()}
      </div>
      {getValidationMessage()}
      <div className="text-xs text-muted-foreground mt-1">
        3-20 characters, letters, numbers, and underscores
      </div>
    </div>
  );
};