'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Link as LinkIcon, StickyNote, X } from 'lucide-react';
import { Button } from './button';

interface QuickCaptureButtonProps {
  onAddLink: () => void;
  onAddNote: () => void;
}

export const QuickCaptureButton: React.FC<QuickCaptureButtonProps> = ({
  onAddLink,
  onAddNote,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const handleAddLink = () => {
    setIsExpanded(false);
    onAddLink();
  };

  const handleAddNote = () => {
    setIsExpanded(false);
    onAddNote();
  };

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3"
    >
      {/* Expanded actions */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Add Note button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.05 }}
            >
              <Button
                onClick={handleAddNote}
                size="lg"
                className="h-12 px-4 rounded-full shadow-lg gap-2 bg-amber-500 hover:bg-amber-600 text-white"
              >
                <StickyNote className="h-5 w-5" />
                <span className="text-sm font-medium">New Note</span>
              </Button>
            </motion.div>

            {/* Add Link button */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            >
              <Button
                onClick={handleAddLink}
                size="lg"
                className="h-12 px-4 rounded-full shadow-lg gap-2 bg-blue-500 hover:bg-blue-600 text-white"
              >
                <LinkIcon className="h-5 w-5" />
                <span className="text-sm font-medium">New Link</span>
              </Button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.div
        animate={{ rotate: isExpanded ? 45 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
        >
          <Plus className="h-6 w-6" />
        </Button>
      </motion.div>
    </div>
  );
};
