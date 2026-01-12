import React, { memo } from 'react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Memoized spinner to prevent unnecessary re-renders
export const LoadingSpinner = memo(function LoadingSpinner({ 
  size = 'md', 
  className 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-2'
  };

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-current border-t-transparent',
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
});

interface SkeletonProps {
  className?: string;
}

// CSS-based skeleton for better mobile performance
export const Skeleton = memo(function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'skeleton rounded-md bg-muted',
        className
      )}
      aria-hidden="true"
    />
  );
});

interface LoadingCardProps {
  className?: string;
}

export const LoadingCard = memo(function LoadingCard({ className }: LoadingCardProps) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 sm:p-6 shadow-sm', className)}>
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-16 sm:h-20 w-full" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-16 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
});

interface PulseProps {
  children: React.ReactNode;
  className?: string;
}

export const Pulse = memo(function Pulse({ children, className }: PulseProps) {
  return (
    <div className={cn('animate-pulse', className)} aria-hidden="true">
      {children}
    </div>
  );
});

// Full page loading overlay - optimized for mobile
interface LoadingOverlayProps {
  message?: string;
  className?: string;
}

export const LoadingOverlay = memo(function LoadingOverlay({ 
  message = 'Loading...', 
  className 
}: LoadingOverlayProps) {
  return (
    <div 
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center',
        'bg-background/80',
        className
      )}
      role="status"
      aria-live="polite"
    >
      <LoadingSpinner size="lg" className="text-primary mb-4" />
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
});

// Inline loading for buttons and small areas
interface InlineLoadingProps {
  className?: string;
}

export const InlineLoading = memo(function InlineLoading({ className }: InlineLoadingProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LoadingSpinner size="sm" />
      <span className="text-sm">Loading...</span>
    </span>
  );
});

// List skeleton for mobile-optimized list loading
interface ListSkeletonProps {
  count?: number;
  className?: string;
}

export const ListSkeleton = memo(function ListSkeleton({ 
  count = 3, 
  className 
}: ListSkeletonProps) {
  return (
    <div className={cn('space-y-3', className)} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center gap-3 p-3 rounded-lg border bg-card"
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
});

// Export default for backwards compatibility
export default LoadingSpinner;
