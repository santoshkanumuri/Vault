'use client';

import React, { useRef, useEffect, useState, memo, useCallback } from 'react';
import { motion, AnimatePresence, Variants, useInView, useReducedMotion } from 'framer-motion';

// Check if we're on a low-end device
function useIsLowEndDevice(): boolean {
  const [isLowEnd, setIsLowEnd] = useState(false);
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check for low-end indicators
    const lowMemory = (navigator as any).deviceMemory && (navigator as any).deviceMemory < 4;
    const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    setIsLowEnd(lowMemory || lowCores || isMobile);
  }, []);
  
  return isLowEnd;
}

// Optimized spring config - lighter for mobile
const springConfig = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

const fastSpring = {
  type: 'spring',
  stiffness: 400,
  damping: 35,
  mass: 0.5,
};

// Simple CSS transitions for mobile (no spring physics)
const simpleTransition = {
  type: 'tween',
  duration: 0.2,
  ease: 'easeOut',
};

interface AnimatedContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  animation?: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scale' | 'blur';
}

const animationVariants: Record<string, Variants> = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  },
  slideUp: {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 }
  },
  slideDown: {
    initial: { opacity: 0, y: -16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 8 }
  },
  slideLeft: {
    initial: { opacity: 0, x: 16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -8 }
  },
  slideRight: {
    initial: { opacity: 0, x: -16 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 8 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 }
  },
  // Remove blur animation on mobile - very expensive
  blur: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  }
};

export const AnimatedContainer = memo(function AnimatedContainer({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.2, 
  animation = 'fadeIn' 
}: AnimatedContainerProps) {
  const prefersReducedMotion = useReducedMotion();
  const isLowEnd = useIsLowEndDevice();
  
  // Skip animations entirely if reduced motion is preferred
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      variants={animationVariants[animation]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={isLowEnd ? { ...simpleTransition, delay } : { ...springConfig, delay, duration }}
    >
      {children}
    </motion.div>
  );
});

interface StaggeredListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
  animation?: 'slideUp' | 'scale' | 'fadeIn';
}

const listVariants: Record<string, Variants> = {
  slideUp: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0 }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 }
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  }
};

export const StaggeredList = memo(function StaggeredList({ 
  children, 
  className, 
  staggerDelay = 0.04,
  animation = 'slideUp' 
}: StaggeredListProps) {
  const prefersReducedMotion = useReducedMotion();
  const isLowEnd = useIsLowEndDevice();
  
  // Skip staggered animations on low-end devices or if user prefers
  if (prefersReducedMotion || isLowEnd) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren: 0.03,
          }
        }
      }}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={listVariants[animation]}
          transition={simpleTransition}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
});

interface FadeInOutProps {
  children: React.ReactNode;
  show: boolean;
  className?: string;
}

export const FadeInOut = memo(function FadeInOut({ children, show, className }: FadeInOutProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return show ? <div className={className}>{children}</div> : null;
  }
  
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={simpleTransition}
          style={{ touchAction: 'auto' }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

interface PressableProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  scale?: number;
  disabled?: boolean;
}

export const Pressable = memo(function Pressable({ 
  children, 
  className, 
  onPress, 
  scale = 0.97,
  disabled = false 
}: PressableProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion || disabled) {
    return (
      <div 
        className={className} 
        onClick={disabled ? undefined : onPress}
        style={{ cursor: onPress && !disabled ? 'pointer' : 'default' }}
      >
        {children}
      </div>
    );
  }
  
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      transition={simpleTransition}
      onClick={disabled ? undefined : onPress}
      style={{ 
        cursor: onPress && !disabled ? 'pointer' : 'default',
        touchAction: 'manipulation',
      }}
    >
      {children}
    </motion.div>
  );
});

interface ModalWrapperProps {
  children: React.ReactNode;
  isOpen: boolean;
}

export const ModalWrapper = memo(function ModalWrapper({ children, isOpen }: ModalWrapperProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (!isOpen) return null;
  
  if (prefersReducedMotion) {
    return (
      <>
        <div className="fixed inset-0 bg-black/60 z-40" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {children}
        </div>
      </>
    );
  }
  
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={simpleTransition}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

// Sidebar slide animation
interface SlideInProps {
  children: React.ReactNode;
  isOpen: boolean;
  direction?: 'left' | 'right';
  className?: string;
  onClose?: () => void;
}

export const SlideIn = memo(function SlideIn({ 
  children, 
  isOpen, 
  direction = 'left', 
  className,
  onClose 
}: SlideInProps) {
  const prefersReducedMotion = useReducedMotion();
  const xOffset = direction === 'left' ? -280 : 280;
  
  // Handle escape key to close
  useEffect(() => {
    if (!isOpen || !onClose) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  if (prefersReducedMotion) {
    return (
      <>
        <div 
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
        />
        <div className={className}>
          {children}
        </div>
      </>
    );
  }
  
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            className={className}
            initial={{ x: xOffset, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: xOffset, opacity: 0 }}
            transition={simpleTransition}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTransition = memo(function PageTransition({ children, className }: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }
  
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...simpleTransition, delay: 0.05 }}
    >
      {children}
    </motion.div>
  );
});

// Reveal on scroll - optimized with intersection observer
interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
}

export const RevealOnScroll = memo(function RevealOnScroll({ children, className }: RevealOnScrollProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      transition={simpleTransition}
    >
      {children}
    </motion.div>
  );
});

// Skeleton loading animation - CSS based for better performance
interface SkeletonPulseProps {
  className?: string;
}

export const SkeletonPulse = memo(function SkeletonPulse({ className }: SkeletonPulseProps) {
  // Use CSS animation instead of Framer Motion for better performance
  return (
    <div 
      className={`bg-muted rounded-lg skeleton ${className}`}
      aria-hidden="true"
    />
  );
});

// Card skeleton
export const CardSkeleton = memo(function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonPulse className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <SkeletonPulse className="h-4 w-3/4" />
          <SkeletonPulse className="h-3 w-1/2" />
        </div>
      </div>
      <SkeletonPulse className="h-16 w-full" />
      <div className="flex gap-2">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
});

// Loading spinner with CSS animation
export const LoadingSpinner = memo(function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  
  return (
    <div
      className={`border-2 border-primary/30 border-t-primary rounded-full animate-spin ${sizeMap[size]}`}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
});

// Premium loading screen - optimized for mobile
export const LoadingScreen = memo(function LoadingScreen() {
  const prefersReducedMotion = useReducedMotion();
  
  if (prefersReducedMotion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-primary-foreground" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
              />
            </svg>
          </div>
          <p className="text-muted-foreground font-medium">Opening your vault...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={simpleTransition}
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center animate-pulse">
          <svg 
            className="w-8 h-8 text-primary-foreground" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" 
            />
          </svg>
        </div>
        <motion.p 
          className="text-muted-foreground font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Opening your vault...
        </motion.p>
      </motion.div>
    </div>
  );
});

// Empty state animation
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState = memo(function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const prefersReducedMotion = useReducedMotion();
  
  const content = (
    <div className="text-center py-12 sm:py-16 px-4">
      <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center">
        <div className="text-muted-foreground">
          {icon}
        </div>
      </div>
      <h3 className="text-base sm:text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
  
  if (prefersReducedMotion) {
    return content;
  }
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={simpleTransition}
    >
      {content}
    </motion.div>
  );
});
