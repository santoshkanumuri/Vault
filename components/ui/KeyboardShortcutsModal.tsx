'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Command, Search, Moon, Link, StickyNote, X } from 'lucide-react';

interface ShortcutItem {
  keys: string[];
  description: string;
  icon: React.ReactNode;
}

const shortcuts: ShortcutItem[] = [
  {
    keys: ['⌘', 'N'],
    description: 'Create new link',
    icon: <Link className="h-4 w-4" />,
  },
  {
    keys: ['⌘', '⇧', 'N'],
    description: 'Create new note',
    icon: <StickyNote className="h-4 w-4" />,
  },
  {
    keys: ['⌘', 'K'],
    description: 'Open search',
    icon: <Search className="h-4 w-4" />,
  },
  {
    keys: ['⌘', 'D'],
    description: 'Toggle dark mode',
    icon: <Moon className="h-4 w-4" />,
  },
  {
    keys: ['Esc'],
    description: 'Close dialogs',
    icon: <X className="h-4 w-4" />,
  },
  {
    keys: ['?'],
    description: 'Show this help',
    icon: <Keyboard className="h-4 w-4" />,
  },
];

// Detect if user is on Mac
const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

// Convert Mac symbols to Windows keys if needed
const convertKey = (key: string): string => {
  if (isMac) return key;
  const keyMap: Record<string, string> = {
    '⌘': 'Ctrl',
    '⇧': 'Shift',
    '⌥': 'Alt',
  };
  return keyMap[key] || key;
};

export function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    // Cleanup: restore scroll and pointer events when closing
    if (!newOpen) {
      setTimeout(() => {
        document.documentElement.classList.remove('overflow-hidden');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      }, 0);
    }
    setIsOpen(newOpen);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // "?" key to open shortcuts help
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Keyboard className="h-4 w-4 text-primary" />
            </div>
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-1 mt-4">
          <AnimatePresence>
            {shortcuts.map((shortcut, index) => (
              <motion.div
                key={shortcut.description}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ 
                  delay: index * 0.05,
                  type: 'spring',
                  stiffness: 500,
                  damping: 30,
                }}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    {shortcut.icon}
                  </div>
                  <span className="text-sm">{shortcut.description}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <React.Fragment key={keyIndex}>
                      <Badge 
                        variant="secondary" 
                        className="px-2 py-0.5 text-xs font-mono bg-background border shadow-sm"
                      >
                        {convertKey(key)}
                      </Badge>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-muted-foreground text-xs">+</span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            Press <Badge variant="outline" className="px-1.5 py-0 text-xs font-mono mx-1">?</Badge> anytime to show shortcuts
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
