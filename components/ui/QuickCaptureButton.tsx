'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Link as LinkIcon, StickyNote, X } from 'lucide-react';
import { Button } from './button';

interface QuickCaptureButtonProps {
  onAddLink: () => void;
  onAddNote: () => void;
}

// Simple transition for mobile performance
const simpleTransition = {
  type: 'tween',
  duration: 0.15,
  ease: 'easeOut',
};

const QuickCaptureButtonComponent: React.FC<QuickCaptureButtonProps> = ({
  onAddLink,
  onAddNote,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Close on click outside - optimized with useCallback
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    // Use passive listeners for better mobile performance
    document.addEventListener('mousedown', handleClickOutside, { capture: true });
    document.addEventListener('touchstart', handleClickOutside, { capture: true, passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, { capture: true });
      document.removeEventListener('touchstart', handleClickOutside, { capture: true });
    };
  }, [isExpanded]);

  // Close on escape - optimized
  useEffect(() => {
    if (!isExpanded) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleToggle = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  const handleAddLink = useCallback(() => {
    setIsExpanded(false);
    // Use requestAnimationFrame for smoother transition
    requestAnimationFrame(() => {
      onAddLink();
    });
  }, [onAddLink]);

  const handleAddNote = useCallback(() => {
    setIsExpanded(false);
    requestAnimationFrame(() => {
      onAddNote();
    });
  }, [onAddNote]);

  // Simplified render for reduced motion preference
  if (prefersReducedMotion) {
    return (
      <div 
        ref={containerRef}
        className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 safe-area-bottom"
      >
        {isExpanded && (
          <>
            <Button
              onClick={handleAddNote}
              size="lg"
              className="h-12 px-4 rounded-full shadow-lg gap-2 bg-amber-500 hover:bg-amber-600 text-white touch-manipulation"
            >
              <StickyNote className="h-5 w-5" />
              <span className="text-sm font-medium">New Note</span>
            </Button>
            <Button
              onClick={handleAddLink}
              size="lg"
              className="h-12 px-4 rounded-full shadow-lg gap-2 bg-blue-500 hover:bg-blue-600 text-white touch-manipulation"
            >
              <LinkIcon className="h-5 w-5" />
              <span className="text-sm font-medium">New Link</span>
            </Button>
          </>
        )}
        <button
          onClick={handleToggle}
          className="h-14 w-14 rounded-full shadow-lg bg-primary flex items-center justify-center touch-manipulation"
          aria-label={isExpanded ? 'Close menu' : 'Quick actions'}
          aria-expanded={isExpanded}
        >
          <span className={`text-white text-3xl font-light leading-none transition-transform ${isExpanded ? 'rotate-45' : ''}`}>+</span>
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3 safe-area-bottom"
    >
      {/* Expanded actions */}
      <AnimatePresence mode="popLayout">
        {isExpanded && (
          <>
            {/* Add Note button */}
            <motion.div
              key="note-btn"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={{ ...simpleTransition, delay: 0.02 }}
            >
              <Button
                onClick={handleAddNote}
                size="lg"
                className="h-12 px-4 rounded-full shadow-lg gap-2 bg-amber-500 hover:bg-amber-600 text-white 
                           active:opacity-80 touch-manipulation select-none"
              >
                <StickyNote className="h-5 w-5" />
                <span className="text-sm font-medium">New Note</span>
              </Button>
            </motion.div>

            {/* Add Link button */}
            <motion.div
              key="link-btn"
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 16 }}
              transition={simpleTransition}
            >
              <Button
                onClick={handleAddLink}
                size="lg"
                className="h-12 px-4 rounded-full shadow-lg gap-2 bg-blue-500 hover:bg-blue-600 text-white 
                           active:opacity-80 touch-manipulation select-none"
              >
                <LinkIcon className="h-5 w-5" />
                <span className="text-sm font-medium">New Link</span>
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        onClick={handleToggle}
        animate={{ rotate: isExpanded ? 45 : 0 }}
        transition={simpleTransition}
        className="h-14 w-14 rounded-full shadow-lg bg-primary flex items-center justify-center 
                   active:opacity-80 touch-manipulation select-none"
        aria-label={isExpanded ? 'Close menu' : 'Quick actions'}
        aria-expanded={isExpanded}
      >
        <span className="text-white text-3xl font-light leading-none">+</span>
      </motion.button>
    </div>
  );
};

// Memoize to prevent unnecessary re-renders
export const QuickCaptureButton = memo(QuickCaptureButtonComponent);
