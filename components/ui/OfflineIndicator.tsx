'use client';

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Debounce online/offline events to prevent rapid toggling
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  
  return debouncedValue;
}

// Check reduced motion preference
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } catch {
      // Silently fail
    }
  }, []);
  
  return prefersReducedMotion;
}

export const OfflineIndicator = memo(function OfflineIndicator() {
  const [rawOnlineState, setRawOnlineState] = useState(true);
  const [hasShownToast, setHasShownToast] = useState(false);
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();
  const indicatorRef = useRef<HTMLDivElement>(null);
  
  // Debounce the online state to prevent flickering
  const isOnline = useDebounce(rawOnlineState, 300);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Set initial online status
    setRawOnlineState(navigator.onLine);

    const handleOnline = () => {
      setRawOnlineState(true);
    };

    const handleOffline = () => {
      setRawOnlineState(false);
    };

    // Use passive event listeners for better performance
    window.addEventListener('online', handleOnline, { passive: true });
    window.addEventListener('offline', handleOffline, { passive: true });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handle toast notifications separately from render
  useEffect(() => {
    if (isOnline && hasShownToast) {
      toast({
        title: 'Back online',
        description: 'Your connection has been restored.',
      });
      setHasShownToast(false);
    } else if (!isOnline && !hasShownToast) {
      toast({
        title: "You're offline",
        description: 'Changes will sync when you reconnect.',
        variant: 'default',
      });
      setHasShownToast(true);
    }
  }, [isOnline, hasShownToast, toast]);

  // Don't render when online
  if (isOnline) return null;

  const animationClass = prefersReducedMotion
    ? 'opacity-100'
    : 'animate-in slide-in-from-top duration-300';

  return (
    <div
      ref={indicatorRef}
      className={`fixed top-0 left-0 right-0 z-50 ${animationClass}`}
      role="status"
      aria-live="polite"
    >
      {/* Use solid color instead of backdrop-blur for mobile performance */}
      <div className="bg-amber-600 dark:bg-amber-700 border-b border-amber-700 dark:border-amber-800">
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-white text-sm">
          <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="font-medium">You're offline</span>
          <span className="hidden sm:inline text-amber-100">• Changes will sync when you reconnect</span>
        </div>
      </div>
    </div>
  );
});
