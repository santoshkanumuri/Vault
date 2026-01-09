'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Download, Smartphone } from 'lucide-react';
import { AnimatedContainer, FadeInOut } from '@/components/ui/animations';
import { useHapticFeedback } from '@/lib/utils/haptic';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const haptic = useHapticFeedback();

  useEffect(() => {
    // Check if app is already installed
    const checkInstalled = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      setIsInstalled(isStandalone || isNavigatorStandalone);
    };

    checkInstalled();

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a delay if not already installed
      if (!isInstalled) {
        setTimeout(() => setShowPrompt(true), 3000);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isInstalled]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    haptic.medium();
    
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      
      if (choiceResult.outcome === 'accepted') {
        haptic.success();
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Error installing PWA:', error);
      haptic.error();
    }
  };

  const handleDismiss = () => {
    haptic.light();
    setShowPrompt(false);
    // Don't show again for this session
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  };

  // Don't show if already installed or recently dismissed
  if (isInstalled || !deferredPrompt) return null;

  const recentlyDismissed = localStorage.getItem('pwa-prompt-dismissed');
  if (recentlyDismissed && Date.now() - parseInt(recentlyDismissed) < 24 * 60 * 60 * 1000) {
    return null;
  }

  return (
    <FadeInOut show={showPrompt}>
      <div className="fixed bottom-4 left-4 right-4 z-[200] max-w-sm mx-auto pointer-events-auto">
        <AnimatedContainer animation="slideUp" className="w-full">
          <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg pointer-events-auto">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Install App</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-2 -mt-1 pointer-events-auto"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>              <CardDescription className="text-sm">
                Install Vault for a better experience with offline access and quick launch from your home screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  className="flex-1 pointer-events-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Install
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDismiss}
                  className="flex-1 pointer-events-auto"
                >
                  Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </div>
    </FadeInOut>
  );
}

// iOS Safari specific install instructions
export function IOSInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    setIsIOS(iOS);
    
    if (iOS && !isStandalone) {
      // Check if user hasn't dismissed this recently
      const dismissed = localStorage.getItem('ios-install-dismissed');
      if (!dismissed || Date.now() - parseInt(dismissed) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShowPrompt(true), 5000);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ios-install-dismissed', Date.now().toString());
  };

  if (!isIOS || !showPrompt) return null;

  return (
    <FadeInOut show={showPrompt}>
      <div className="fixed bottom-4 left-4 right-4 z-[200] max-w-sm mx-auto pointer-events-auto">
        <AnimatedContainer animation="slideUp" className="w-full">
          <Card className="bg-card/95 backdrop-blur-sm border-border/50 shadow-lg pointer-events-auto">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">Add to Home Screen</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 -mr-2 -mt-1 pointer-events-auto"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription className="text-sm">
                To install this app, tap the share button and then "Add to Home Screen".
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>Tap</span>
                <div className="w-6 h-6 bg-primary/10 rounded flex items-center justify-center">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16,6 12,2 8,6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                </div>
                <span>then "Add to Home Screen"</span>
              </div>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </div>
    </FadeInOut>
  );
}
