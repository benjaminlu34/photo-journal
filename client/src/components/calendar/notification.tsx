import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, Info, AlertTriangle, X } from "lucide-react";

type NotificationType = 'success' | 'info' | 'warning' | 'error';

interface NotificationProps {
  message: string;
  type: NotificationType;
  duration?: number;
  onDismiss?: () => void;
}

export function Notification({ 
  message, 
  type, 
  duration = 5000,
  onDismiss 
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss?.();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);
  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };
  
  const getVariant = () => {
    switch (type) {
      case 'success':
        return 'default';
      case 'info':
        return 'default';
      case 'warning':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'default';
    }
  };
  
  if (!isVisible) return null;
  
  return (
    <Alert variant={getVariant()} className="m-4 neu-card flex items-center justify-between">
      <div className="flex items-center gap-2">
        {getIcon()}
        <AlertDescription>{message}</AlertDescription>
      </div>
      <button
        onClick={() => {
          setIsVisible(false);
          onDismiss?.();
        }}
        className="ml-2 text-gray-500 hover:text-gray-700"
        aria-label="Dismiss notification"
      >
        <X className="h-4 w-4" />
      </button>
    </Alert>
  );
}