'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(true);
  const { toast } = useToast();
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  const [hasShownOnlineToast, setHasShownOnlineToast] = useState(false);

  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);
    setHasShownOfflineToast(!navigator.onLine);
    setHasShownOnlineToast(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      if (!hasShownOnlineToast) {
        toast({
          title: 'Back online',
          description: 'Your connection has been restored.',
        });
        setHasShownOnlineToast(true);
        setHasShownOfflineToast(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (!hasShownOfflineToast) {
        toast({
          title: 'You\'re offline',
          description: 'Some features may be limited. Your changes will sync when you reconnect.',
          variant: 'default',
        });
        setHasShownOfflineToast(true);
        setHasShownOnlineToast(false);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast, hasShownOfflineToast, hasShownOnlineToast]);

  if (isOnline) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50 bg-orange-500/90 dark:bg-orange-600/90 backdrop-blur-sm border-b border-orange-600 dark:border-orange-700"
      >
        <div className="container mx-auto px-4 py-2 flex items-center justify-center gap-2 text-white text-sm">
          <WifiOff className="h-4 w-4" />
          <span>You're offline. Changes will sync when you reconnect.</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
