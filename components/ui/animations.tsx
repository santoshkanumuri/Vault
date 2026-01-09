'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, Variants, useInView } from 'framer-motion';

// Optimized spring config for smooth, fast animations
const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

const fastSpring = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.5,
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
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 }
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 10 }
  },
  slideLeft: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -10 }
  },
  slideRight: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 }
  },
  scale: {
    initial: { opacity: 0, scale: 0.92 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 }
  },
  blur: {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(5px)' }
  }
};

export function AnimatedContainer({ 
  children, 
  className, 
  delay = 0, 
  duration = 0.25, 
  animation = 'fadeIn' 
}: AnimatedContainerProps) {
  return (
    <motion.div
      className={className}
      variants={animationVariants[animation]}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        ...springConfig,
        delay,
        duration,
      }}
    >
      {children}
    </motion.div>
  );
}

interface StaggeredListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
  animation?: 'slideUp' | 'scale' | 'fadeIn';
}

const listVariants: Record<string, Variants> = {
  slideUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  },
  scale: {
    hidden: { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1 }
  },
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  }
};

export function StaggeredList({ 
  children, 
  className, 
  staggerDelay = 0.05,
  animation = 'slideUp' 
}: StaggeredListProps) {
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
            delayChildren: 0.05,
          }
        }
      }}
    >
      {React.Children.map(children, (child, index) => (
        <motion.div
          key={index}
          variants={listVariants[animation]}
          transition={fastSpring}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface FadeInOutProps {
  children: React.ReactNode;
  show: boolean;
  className?: string;
}

export function FadeInOut({ children, show, className }: FadeInOutProps) {
  return (
    <AnimatePresence mode="wait">
      {show && (
        <motion.div
          className={className}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={fastSpring}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PressableProps {
  children: React.ReactNode;
  className?: string;
  onPress?: () => void;
  scale?: number;
}

export function Pressable({ children, className, onPress, scale = 0.97 }: PressableProps) {
  return (
    <motion.div
      className={className}
      whileTap={{ scale }}
      whileHover={{ scale: 1.02 }}
      transition={fastSpring}
      onClick={onPress}
      style={{ cursor: onPress ? 'pointer' : 'default' }}
    >
      {children}
    </motion.div>
  );
}

interface ModalWrapperProps {
  children: React.ReactNode;
  isOpen: boolean;
}

export function ModalWrapper({ children, isOpen }: ModalWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={fastSpring}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Sidebar slide animation
interface SlideInProps {
  children: React.ReactNode;
  isOpen: boolean;
  direction?: 'left' | 'right';
  className?: string;
}

export function SlideIn({ children, isOpen, direction = 'left', className }: SlideInProps) {
  const xOffset = direction === 'left' ? -280 : 280;
  
  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          {/* Panel */}
          <motion.div
            className={className}
            initial={{ x: xOffset, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: xOffset, opacity: 0 }}
            transition={springConfig}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springConfig, delay: 0.1 }}
    >
      {children}
    </motion.div>
  );
}

// Reveal on scroll
interface RevealOnScrollProps {
  children: React.ReactNode;
  className?: string;
}

export function RevealOnScroll({ children, className }: RevealOnScrollProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={springConfig}
    >
      {children}
    </motion.div>
  );
}

// Skeleton loading animation
interface SkeletonPulseProps {
  className?: string;
}

export function SkeletonPulse({ className }: SkeletonPulseProps) {
  return (
    <motion.div
      className={`bg-muted rounded-lg ${className}`}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

// Card skeleton
export function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
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
}

// Loading spinner with animation
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  
  return (
    <motion.div
      className={`border-2 border-primary/30 border-t-primary rounded-full ${sizeMap[size]}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
}

// Premium loading screen
export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <motion.div 
        className="text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={springConfig}
      >
        <motion.div
          className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center"
          animate={{ 
            rotate: [0, 10, -10, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
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
        </motion.div>
        <motion.p 
          className="text-muted-foreground font-medium"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Opening your vault...
        </motion.p>
      </motion.div>
    </div>
  );
}

// Empty state animation
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <motion.div 
      className="text-center py-16 px-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springConfig}
    >
      <motion.div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-muted/50 flex items-center justify-center"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="text-muted-foreground">
          {icon}
        </div>
      </motion.div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mx-auto mb-6">{description}</p>
      {action}
    </motion.div>
  );
}
