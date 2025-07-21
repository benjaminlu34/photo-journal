import { useState, useEffect } from 'react';

// Global timestamp that updates every minute
let globalCurrentTime = Date.now();
let subscribers: Set<() => void> = new Set();
let intervalId: NodeJS.Timeout | null = null;

function startGlobalTimer() {
  if (intervalId) return;
  
  intervalId = setInterval(() => {
    globalCurrentTime = Date.now();
    subscribers.forEach(callback => callback());
  }, 60000); // Update every minute
}

function stopGlobalTimer() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

/**
 * Hook that provides a timestamp that updates every minute
 * Uses a single global timer shared across all components
 */
export function useTimestamp() {
  const [currentTime, setCurrentTime] = useState(globalCurrentTime);

  useEffect(() => {
    const updateTime = () => setCurrentTime(globalCurrentTime);
    
    // Subscribe to global timer
    subscribers.add(updateTime);
    
    // Start timer if this is the first subscriber
    if (subscribers.size === 1) {
      startGlobalTimer();
    }

    return () => {
      // Unsubscribe
      subscribers.delete(updateTime);
      
      // Stop timer if no more subscribers
      if (subscribers.size === 0) {
        stopGlobalTimer();
      }
    };
  }, []);

  return currentTime;
}

/**
 * Format a timestamp relative to current time
 */
export function formatRelativeTime(timestamp: string, currentTime: number = Date.now()): string {
  const date = new Date(timestamp);
  const now = new Date(currentTime);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}