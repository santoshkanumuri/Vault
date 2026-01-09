'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { Trash2, FolderOpen, Tag, Archive } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';

interface BulkActionsProps {
  selectedIds: Set<string>;
  onDelete: () => void;
  onMove?: () => void;
  onTag?: () => void;
  onArchive?: () => void;
  onClearSelection: () => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedIds,
  onDelete,
  onMove,
  onTag,
  onArchive,
  onClearSelection,
}) => {
  if (selectedIds.size === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-card border border-border rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          
          <div className="flex items-center gap-2">
            {onMove && (
              <Button
                variant="outline"
                size="sm"
                onClick={onMove}
                className="gap-2"
              >
                <FolderOpen className="h-4 w-4" />
                Move
              </Button>
            )}
            
            {onTag && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTag}
                className="gap-2"
              >
                <Tag className="h-4 w-4" />
                Tag
              </Button>
            )}
            
            {onArchive && (
              <Button
                variant="outline"
                size="sm"
                onClick={onArchive}
                className="gap-2"
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            )}
            
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
