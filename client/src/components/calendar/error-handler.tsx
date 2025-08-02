import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ErrorHandlerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorHandler({ error, onRetry, onDismiss }: ErrorHandlerProps) {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(!!error);
  
  useEffect(() => {
    setIsVisible(!!error);
    
    if (error) {
      // Show toast notification for errors
      toast({
        title: "Calendar Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);
  
  if (!isVisible || !error) return null;
  
  return (
    <Alert variant="destructive" className="m-4 neu-card">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription className="flex items-center justify-between">
        <span>{error}</span>
        <div className="flex space-x-2">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="neu-card"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsVisible(false);
                onDismiss();
              }}
              className="neu-card"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}