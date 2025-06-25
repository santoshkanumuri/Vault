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
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PREDEFINED_COLORS[0]);

  useEffect(() => {
    if (open) {
      if (folder) {
        setName(folder.name);
        setColor(folder.color);
      } else {
        setName('');
        setColor(PREDEFINED_COLORS[0]);
      }
    }
  }, [open, folder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setIsLoading(true);
    try {
      if (folder) {
        await updateFolder(folder.id, name);
      } else {
        await createFolder(name, color);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving folder:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{folder ? 'Edit Folder' : 'Create New Folder'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Folder Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design Resources"
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
