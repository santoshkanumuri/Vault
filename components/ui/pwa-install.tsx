'use client';

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Download, X, Share, Plus, AlertCircle, CheckCircle } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type InstallState = 'idle' | 'prompting' | 'success' | 'error';

// Check if device prefers reduced motion
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

// Mobile-optimized PWA Install Banner
export const PWAInstallPrompt = memo(function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installState, setInstallState] = useState<InstallState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Early exit for SSR
    if (typeof window === 'undefined') return;

    // Check if already installed - use try/catch for safety
    try {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (window.navigator as any).standalone === true;
      
      if (isStandalone || isNavigatorStandalone) {
        setIsInstalled(true);
        return;
      }
    } catch {
      // Silently fail if matchMedia not supported
    }

    // Check if dismissed recently (7 days)
    try {
      const dismissed = localStorage.getItem('pwa-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    } catch {
      // localStorage might be blocked
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Delay showing banner to not interrupt initial load
      showTimeoutRef.current = setTimeout(() => {
        // Use requestAnimationFrame for smoother rendering
        requestAnimationFrame(() => setShowBanner(true));
      }, 3000);
    };

    const handleAppInstalled = () => {
      setInstallState('success');
      setTimeout(() => {
        setIsInstalled(true);
        setShowBanner(false);
        setDeferredPrompt(null);
      }, 1500);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt, { passive: true });
    window.addEventListener('appinstalled', handleAppInstalled, { passive: true });

    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt || installState === 'prompting') return;
    
    setInstallState('prompting');
    setErrorMessage(null);
    
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setInstallState('success');
        // Let success state show briefly before hiding
        setTimeout(() => setShowBanner(false), 1500);
      } else {
        setInstallState('idle');
      }
      setDeferredPrompt(null);
    } catch (err) {
      setInstallState('error');
      setErrorMessage(err instanceof Error ? err.message : 'Installation failed');
      // Auto-reset error state
      setTimeout(() => {
        setInstallState('idle');
        setErrorMessage(null);
      }, 3000);
    }
  }, [deferredPrompt, installState]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem('pwa-dismissed', Date.now().toString());
    } catch {
      // Silently fail if localStorage blocked
    }
  }, []);

  // Touch-optimized dismiss on swipe up
  useEffect(() => {
    if (!showBanner || !bannerRef.current) return;
    
    let startY = 0;
    const banner = bannerRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      if (startY - endY > 50) { // Swipe up threshold
        handleDismiss();
      }
    };
    
    banner.addEventListener('touchstart', handleTouchStart, { passive: true });
    banner.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      banner.removeEventListener('touchstart', handleTouchStart);
      banner.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showBanner, handleDismiss]);

  if (isInstalled || !showBanner || !deferredPrompt) return null;

  const animationClass = prefersReducedMotion 
    ? 'opacity-100' 
    : 'animate-in slide-in-from-top duration-300';

  return (
    <div 
      ref={bannerRef}
      className={`fixed top-0 left-0 right-0 z-[100] safe-area-top touch-pan-x ${animationClass}`}
      role="alert"
      aria-live="polite"
    >
      <div className={`px-4 py-3 flex items-center justify-between gap-3 ${
        installState === 'error' 
          ? 'bg-destructive text-destructive-foreground' 
          : installState === 'success'
          ? 'bg-green-600 text-white'
          : 'bg-primary text-primary-foreground'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {installState === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : installState === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span className="text-sm font-medium truncate">
            {installState === 'error' 
              ? (errorMessage || 'Installation failed')
              : installState === 'success'
              ? 'Successfully installed!'
              : 'Install Vault for offline access'
            }
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {installState !== 'success' && installState !== 'error' && (
            <button
              onClick={handleInstall}
              disabled={installState === 'prompting'}
              className="bg-primary-foreground text-primary px-4 py-1.5 rounded-md text-sm font-medium 
                         touch-manipulation select-none min-h-[36px]
                         hover:opacity-90 active:opacity-80 disabled:opacity-50
                         transition-opacity"
              aria-label="Install application"
            >
              {installState === 'prompting' ? 'Installing...' : 'Install'}
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-white/20 rounded-md touch-manipulation select-none min-h-[36px] min-w-[36px]
                       flex items-center justify-center transition-colors"
            aria-label="Dismiss installation prompt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Swipe indicator for mobile */}
      <div className="h-1 bg-white/20 mx-auto w-10 rounded-full mt-1 mb-1 md:hidden" aria-hidden="true" />
    </div>
  );
});

// iOS Safari - optimized for mobile performance
export const IOSInstallPrompt = memo(function IOSInstallPrompt() {
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    // Early exit for SSR
    if (typeof window === 'undefined') return;

    // Detect iOS Safari with error handling
    try {
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      
      if (!iOS || !isSafari || isStandalone) return;
      
      setIsIOS(true);

      // Check if dismissed (7 days)
      const dismissed = localStorage.getItem('ios-pwa-dismissed');
      if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) {
        return;
      }

      // Delay showing to avoid blocking initial render
      const timer = setTimeout(() => {
        requestAnimationFrame(() => setShowBanner(true));
      }, 4000);
      return () => clearTimeout(timer);
    } catch {
      // Silently fail on unsupported browsers
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    try {
      localStorage.setItem('ios-pwa-dismissed', Date.now().toString());
    } catch {
      // Silently fail if localStorage blocked
    }
  }, []);

  // Swipe to dismiss
  useEffect(() => {
    if (!showBanner || !bannerRef.current) return;
    
    let startY = 0;
    const banner = bannerRef.current;
    
    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
    };
    
    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      if (startY - endY > 40) {
        handleDismiss();
      }
    };
    
    banner.addEventListener('touchstart', handleTouchStart, { passive: true });
    banner.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      banner.removeEventListener('touchstart', handleTouchStart);
      banner.removeEventListener('touchend', handleTouchEnd);
    };
  }, [showBanner, handleDismiss]);

  if (!isIOS || !showBanner) return null;

  const animationClass = prefersReducedMotion 
    ? 'opacity-100' 
    : 'animate-in slide-in-from-top duration-300';

  return (
    <div 
      ref={bannerRef}
      className={`fixed top-0 left-0 right-0 z-[100] safe-area-top touch-pan-x ${animationClass}`}
      role="alert"
      aria-live="polite"
    >
      {/* Use solid background instead of gradient for better mobile perf */}
      <div className="bg-blue-600 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold mb-1.5">Install Vault App</p>
            <div className="text-xs opacity-95 flex items-center gap-2 flex-wrap leading-relaxed">
              <span className="flex items-center gap-1">
                <span>Tap</span>
                <span className="inline-flex items-center justify-center w-6 h-6 bg-white/25 rounded" aria-label="share icon">
                  <Share className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span>then</span>
                <span className="inline-flex items-center gap-1 bg-white/25 px-2 py-1 rounded text-xs font-medium">
                  <Plus className="h-3 w-3" aria-hidden="true" /> 
                  <span>Add to Home</span>
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-white/20 rounded-md shrink-0 touch-manipulation select-none
                       min-h-[36px] min-w-[36px] flex items-center justify-center transition-colors"
            aria-label="Dismiss installation instructions"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Swipe indicator */}
      <div className="h-1 bg-white/30 mx-auto w-10 rounded-full mt-1 mb-1" aria-hidden="true" />
    </div>
  );
});
