'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Folder } from '@/lib/types';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';

interface FolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder?: Folder | null;
}

export const FolderDialog: React.FC<FolderDialogProps> = ({ open, onOpenChange, folder }) => {
  const { createFolder, updateFolder } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (folder) {
        setName(folder.name);
        setColor(folder.color);
      } else {
        setName('');
        setColor(PREDEFINED_COLORS[0]);
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [open, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');
    
    try {
      if (folder) {
        await updateFolder(folder.id, name.trim());
      } else {
        const newFolder = await createFolder(name.trim(), color);
        console.log('FolderDialog: Folder created successfully:', newFolder);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('FolderDialog: Error saving folder:', error);
      const errorMessage = error?.message || 'Failed to save folder. Please try again.';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent dialog from closing during submission
  const handleOpenChange = (newOpen: boolean) => {
    if (isSubmitting && !newOpen) {
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{folder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Folder Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Resources"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker selectedColor={color} onColorChange={setColor} />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {folder ? 'Saving...' : 'Creating...'}</>
              ) : (
                folder ? 'Save Changes' : 'Create Folder'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
