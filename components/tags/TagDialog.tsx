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
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);

  useEffect(() => {
    if (open) {
      if (tag) {
        setName(tag.name);
        setColor(tag.color);
      } else {
        setName('');
        setColor(PREDEFINED_COLORS[0]);
      }
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsLoading(true);
    try {
      if (tag) {
        await updateTag(tag.id, name, color);
      } else {
        await createTag(name, color);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{tag ? 'Edit Tag' : 'Create New Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Tag Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Important"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker selectedColor={color} onColorChange={setColor} />
          </div>
          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {isLoading ? (
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
