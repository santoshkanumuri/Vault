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
import { Tag } from '@/lib/types';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
}

export const TagDialog: React.FC<TagDialogProps> = ({ open, onOpenChange, tag }) => {
  const { createTag, updateTag } = useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name);
        setColor(tag.color);
      } else {
        setName('');
        setColor(PREDEFINED_COLORS[0]);
      }
      setError('');
      setIsSubmitting(false);
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError('');
    
    try {
      if (tag) {
        await updateTag(tag.id, name.trim(), color);
      } else {
        const newTag = await createTag(name.trim(), color);
        console.log('TagDialog: Tag created successfully:', newTag);
      }
      onOpenChange(false);
    } catch (error: any) {
      console.error('TagDialog: Error saving tag:', error);
      const errorMessage = error?.message || 'Failed to save tag. Please try again.';
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
    
    // Cleanup: restore scroll and pointer events when closing
    if (!newOpen) {
      setTimeout(() => {
        document.documentElement.classList.remove('overflow-hidden');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        document.body.style.pointerEvents = '';
      }, 0);
    }
    
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Tag Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Important"
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
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tag ? 'Saving...' : 'Creating...'}</>
              ) : (
                tag ? 'Save Changes' : 'Create Tag'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
