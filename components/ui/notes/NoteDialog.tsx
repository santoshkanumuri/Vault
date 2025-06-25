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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Plus, Loader2, StickyNote } from 'lucide-react';
import { Note } from '@/lib/types';
import { useApp } from '@/contexts/AppContext';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note?: Note | null;
  defaultFolderId?: string;
}

export const NoteDialog: React.FC<NoteDialogProps> = ({
  open,
  onOpenChange,
  note,
  defaultFolderId,
}) => {
  const { folders, tags, createNote, updateNote, createTag } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folderId: '',
    tagIds: [] as string[],
  });  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PREDEFINED_COLORS[0]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (note) {
        // Editing existing note
        setFormData({
          title: note.title,
          content: note.content,
          folderId: note.folderId,
          tagIds: note.tagIds,
        });
      } else {
        // Creating new note
        setFormData({
          title: '',
          content: '',
          folderId: defaultFolderId || (folders[0]?.id || ''),
          tagIds: [],
        });
      }
    }
  }, [open, note, defaultFolderId, folders]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate required fields
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }
    
    if (!formData.folderId) {
      setError('Please select a folder');
      return;
    }

    setIsLoading(true);
    try {
      if (note) {
        await updateNote(
          note.id,
          formData.title.trim(),
          formData.content.trim(),
          formData.folderId,
          formData.tagIds
        );
      } else {
        await createNote(
          formData.title.trim(),
          formData.content.trim(),
          formData.folderId,
          formData.tagIds
        );
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving note:', error);
      setError('Failed to save note. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;

    setIsLoading(true);
    try {
      const tag = await createTag(newTagName.trim(), newTagColor);
      setFormData(prev => ({
        ...prev,
        tagIds: [...prev.tagIds, tag.id]
      }));
      setNewTagName('');
      setNewTagColor(PREDEFINED_COLORS[0]);
      setIsAddingTag(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId]
    }));
  };

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds.filter(id => id !== tagId)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="h-5 w-5" />
            {note ? 'Edit Note' : 'Create New Note'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter note title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Write your note content here..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={8}
              className="resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder *</Label>
            <Select
              value={formData.folderId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, folderId: value }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: folder.color }}
                      />
                      {folder.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAddingTag(true)}
                className="h-8 px-3"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add Tag
              </Button>
            </div>

            {isAddingTag && (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <Input
                  placeholder="Tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="flex-1"
                />                <ColorPicker
                  selectedColor={newTagColor}
                  onColorChange={setNewTagColor}
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddTag}
                  disabled={!newTagName.trim() || isLoading}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingTag(false);
                    setNewTagName('');
                    setNewTagColor(PREDEFINED_COLORS[0]);
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}

            {formData.tagIds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Selected Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {formData.tagIds.map((tagId) => {
                    const tag = tags.find(t => t.id === tagId);
                    if (!tag) return null;
                    return (
                      <Badge
                        key={tag.id}
                        variant="secondary"
                        className="flex items-center gap-1 pr-1"
                        style={{ backgroundColor: `${tag.color}15`, color: tag.color }}
                      >
                        {tag.name}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 hover:bg-transparent"
                          onClick={() => removeTag(tag.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {tags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Available Tags</Label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {tags
                    .filter(tag => !formData.tagIds.includes(tag.id))
                    .map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted"
                        style={{ borderColor: tag.color, color: tag.color }}
                        onClick={() => toggleTag(tag.id)}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!formData.title.trim() || !formData.folderId || isLoading}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {note ? 'Save Changes' : 'Create Note'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
