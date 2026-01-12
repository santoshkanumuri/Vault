'use client';

import React, { Component, ErrorInfo, ReactNode, useState, useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, WifiOff } from 'lucide-react';
import { Button } from './button';
import { logger } from '@/lib/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isOffline: boolean;
}

// Determine if error is likely a network issue
function isNetworkError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('offline') ||
    error.name === 'TypeError' && message.includes('failed')
  );
}

// Mobile-optimized error display component
function ErrorDisplay({ 
  error, 
  errorInfo, 
  isOffline, 
  onReset, 
  onReload 
}: { 
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isOffline: boolean;
  onReset: () => void;
  onReload: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const isNetwork = error && isNetworkError(error);

  return (
    <div className="min-h-[200px] flex items-center justify-center p-4 sm:p-6">
      <div className="text-center max-w-md w-full">
        {/* Error Icon - touch friendly */}
        <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-destructive/10 mb-4">
          {isOffline || isNetwork ? (
            <WifiOff className="h-7 w-7 sm:h-8 sm:w-8 text-amber-500" />
          ) : (
            <AlertTriangle className="h-7 w-7 sm:h-8 sm:w-8 text-destructive" />
          )}
        </div>
        
        {/* Error Title */}
        <h2 className="text-lg sm:text-xl font-semibold text-foreground mb-2">
          {isOffline 
            ? "You're offline"
            : isNetwork 
            ? 'Connection problem' 
            : 'Something went wrong'
          }
        </h2>
        
        {/* Error Description */}
        <p className="text-sm text-muted-foreground mb-6 px-2">
          {isOffline
            ? "Please check your internet connection and try again."
            : isNetwork
            ? "We couldn't connect to the server. Please check your connection."
            : (error?.message || 'An unexpected error occurred. Please try again.')
          }
        </p>
        
        {/* Action Buttons - mobile optimized */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="outline"
            size="default"
            onClick={onReset}
            className="gap-2 w-full sm:w-auto min-h-[44px] touch-manipulation"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={onReload}
            className="w-full sm:w-auto min-h-[44px] touch-manipulation"
          >
            <Home className="h-4 w-4 mr-2" />
            Reload App
          </Button>
        </div>
        
        {/* Development Error Details - collapsible */}
        {process.env.NODE_ENV === 'development' && errorInfo && (
          <div className="mt-6 text-left">
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground 
                         transition-colors p-2 -ml-2 touch-manipulation"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
              {showDetails ? 'Hide' : 'Show'} Error Details
            </button>
            {showDetails && (
              <div className="mt-2 p-3 bg-muted rounded-lg text-xs overflow-auto max-h-48 
                              font-mono select-text touch-pan-y">
                <div className="text-destructive font-semibold mb-2">
                  {error?.name}: {error?.message}
                </div>
                <div className="text-muted-foreground whitespace-pre-wrap break-words">
                  {error?.stack}
                </div>
                <div className="mt-2 pt-2 border-t border-border text-muted-foreground whitespace-pre-wrap break-words">
                  <span className="font-semibold">Component Stack:</span>
                  {errorInfo.componentStack}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isOffline: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidMount() {
    // Track online/offline status
    if (typeof window !== 'undefined') {
      this.setState({ isOffline: !navigator.onLine });
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  public componentWillUnmount() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
  }

  private handleOnline = () => {
    this.setState({ isOffline: false });
  };

  private handleOffline = () => {
    this.setState({ isOffline: true });
  };

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', { 
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack 
    });
    
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          isOffline={this.state.isOffline}
          onReset={this.handleReset}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary wrapper for functional components
interface ErrorBoundaryWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const withErrorBoundary = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) => {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
};

// Compact inline error display for smaller components
export function InlineError({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
      <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
      <span className="text-destructive flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-destructive hover:text-destructive/80 underline text-xs 
                     touch-manipulation min-h-[32px] flex items-center"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export default ErrorBoundary;
