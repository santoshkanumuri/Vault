'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './button';
import { Trash2, FolderOpen, Tag, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { useSelection } from '@/contexts/SelectionContext';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

export const BulkActions: React.FC = () => {
  const { selectedItems, clearSelection, getSelectedByType, isSelectionMode } = useSelection();
  const { folders, tags, deleteLink, deleteNote, updateLink, updateNote, links, notes } = useApp();
  const { toast } = useToast();
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTagDialog, setShowTagDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedCount = selectedItems.size;

  if (!isSelectionMode || selectedCount === 0) return null;

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const linkIds = getSelectedByType('link');
      const noteIds = getSelectedByType('note');

      // Delete all selected links
      for (const id of linkIds) {
        await deleteLink(id);
      }

      // Delete all selected notes  
      for (const id of noteIds) {
        await deleteNote(id);
      }

      toast({
        title: 'Deleted',
        description: `${selectedCount} item${selectedCount !== 1 ? 's' : ''} deleted successfully`,
      });

      clearSelection();
      setShowDeleteDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to delete some items. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMoveToFolder = async (folderId: string) => {
    setIsProcessing(true);
    try {
      const linkIds = getSelectedByType('link');
      const noteIds = getSelectedByType('note');

      // Move all selected links
      for (const id of linkIds) {
        const link = links.find(l => l.id === id);
        if (link) {
          await updateLink(id, link.name, link.url, link.description, folderId, link.tagIds);
        }
      }

      // Move all selected notes
      for (const id of noteIds) {
        const note = notes.find(n => n.id === id);
        if (note) {
          await updateNote(id, note.title, note.content, folderId, note.tagIds);
        }
      }

      const folder = folders.find(f => f.id === folderId);
      toast({
        title: 'Moved',
        description: `${selectedCount} item${selectedCount !== 1 ? 's' : ''} moved to "${folder?.name}"`,
      });

      clearSelection();
      setShowMoveDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to move some items. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    setIsProcessing(true);
    try {
      const linkIds = getSelectedByType('link');
      const noteIds = getSelectedByType('note');

      // Add tag to all selected links
      for (const id of linkIds) {
        const link = links.find(l => l.id === id);
        if (link && !link.tagIds.includes(tagId)) {
          await updateLink(id, link.name, link.url, link.description, link.folderId, [...link.tagIds, tagId]);
        }
      }

      // Add tag to all selected notes
      for (const id of noteIds) {
        const note = notes.find(n => n.id === id);
        if (note && !note.tagIds.includes(tagId)) {
          await updateNote(id, note.title, note.content, note.folderId, [...note.tagIds, tagId]);
        }
      }

      const tag = tags.find(t => t.id === tagId);
      toast({
        title: 'Tagged',
        description: `Added "${tag?.name}" to ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`,
      });

      clearSelection();
      setShowTagDialog(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to tag some items. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
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
              {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMoveDialog(true)}
                className="gap-2"
                disabled={isProcessing}
              >
                <FolderOpen className="h-4 w-4" />
                Move
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTagDialog(true)}
                className="gap-2"
                disabled={isProcessing}
              >
                <Tag className="h-4 w-4" />
                Tag
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="gap-2"
                disabled={isProcessing}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Move to Folder Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Select a folder to move {selectedCount} item{selectedCount !== 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4 max-h-64 overflow-y-auto">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => handleMoveToFolder(folder.id)}
                disabled={isProcessing}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: folder.color }} 
                />
                <span className="font-medium">{folder.name}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Tag Dialog */}
      <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Tag</DialogTitle>
            <DialogDescription>
              Select a tag to add to {selectedCount} item{selectedCount !== 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4 max-h-64 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No tags created yet. Create a tag first.
              </p>
            ) : (
              tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => handleAddTag(tag.id)}
                  disabled={isProcessing}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: tag.color }} 
                  />
                  <span className="font-medium">{tag.name}</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Items</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedCount} item{selectedCount !== 1 ? 's' : ''}? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isProcessing}
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
