'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Calendar, Copy, Check, Clock } from 'lucide-react';
import { Button } from './button';
import { Link, Note, Folder, Tag } from '@/lib/types';
import { Badge } from './badge';
import { ScrollArea } from './scroll-area';
import { formatDistanceToNow } from 'date-fns';

interface QuickLookModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Link | Note | null;
  type: 'link' | 'note' | null;
  folder?: Folder;
  tags?: Tag[];
}

export const QuickLookModal: React.FC<QuickLookModalProps> = ({
  isOpen,
  onClose,
  item,
  type,
  folder,
  tags = [],
}) => {
  const [copied, setCopied] = React.useState(false);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      // Also close on Space if it's the trigger key, to toggle
      if (e.key === ' ' && isOpen) {
          e.preventDefault(); // Prevent scrolling
          onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isOpen]);

  if (!item || !type) return null;

  const handleCopy = () => {
    const textToCopy = type === 'link' ? (item as Link).url : (item as Note).content;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = item.createdAt 
    ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true }) 
    : '';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
            className="relative w-full max-w-4xl h-[85vh] bg-card border shadow-2xl rounded-xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`p-2 rounded-lg ${type === 'link' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                    {type === 'link' ? <ExternalLink className="w-5 h-5"/> : <Clock className="w-5 h-5"/>}
                </div>
                <div className="flex flex-col min-w-0">
                  <h2 className="text-lg font-semibold truncate leading-tight">
                    {type === 'link' ? (item as Link).name : (item as Note).title}
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {folder && (
                        <span className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: folder.color }} />
                            {folder.name}
                        </span>
                    )}
                    <span>•</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <Button variant="ghost" size="icon" onClick={handleCopy} title="Copy Content">
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
                {type === 'link' && (
                  <Button variant="ghost" size="icon" asChild title="Open in New Tab">
                    <a href={(item as Link).url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                )}
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-muted/5">
                {type === 'link' ? (
                   <iframe 
                     src={(item as Link).url} 
                     className="w-full h-full border-0 bg-white"
                     sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                     title={(item as Link).name}
                   />
                ) : (
                    <ScrollArea className="h-full">
                        <div className="p-8 max-w-3xl mx-auto prose dark:prose-invert">
                           <div className="whitespace-pre-wrap font-sans text-base leading-relaxed">
                               {(item as Note).content}
                           </div>
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Footer */}
            {tags.length > 0 && (
                <div className="px-6 py-3 border-t bg-muted/10 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    {tags.map(tag => (
                        <Badge key={tag.id} variant="secondary" className="bg-background/80 hover:bg-background border-none gap-1 pl-1">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                        </Badge>
                    ))}
                </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
