'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { X, Plus, Loader2, StickyNote, FolderPlus, Check } from 'lucide-react';
import { Note } from '@/lib/types';
import { useApp } from '@/contexts/AppContext';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';
import { generateRandomColor } from '@/lib/utils/colors';

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
  const { folders, tags, createNote, updateNote, createTag, createFolder, isLoading } = useApp();
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    folderId: '',
    tagIds: [] as string[],
  });
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PREDEFINED_COLORS[0]);
  const [error, setError] = useState('');
  
  // New folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(generateRandomColor());
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);

  useEffect(() => {
    if (open) {
      if (note) {
        setFormData({
          title: note.title,
          content: note.content,
          folderId: note.folderId,
          tagIds: note.tagIds,
        });
      } else {
        setFormData({
          title: '',
          content: '',
          folderId: defaultFolderId || (folders[0]?.id || ''),
          tagIds: [],
        });
      }
      setNewTagName('');
      setNewTagColor(PREDEFINED_COLORS[0]);
      setNewFolderName('');
      setNewFolderColor(generateRandomColor());
      setError('');
    }
  }, [open, note, defaultFolderId, folders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.folderId) {
      setError('Please select a folder');
      return;
    }

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
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    setIsCreatingFolder(true);
    try {
      // Add timeout to prevent infinite hang
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Folder creation timed out')), 10000)
      );
      
      const folder = await Promise.race([
        createFolder(newFolderName.trim(), newFolderColor),
        timeoutPromise
      ]);
      
      if (folder) {
        setFormData(prev => ({ ...prev, folderId: folder.id }));
        setNewFolderName('');
        setNewFolderColor(generateRandomColor());
        setShowNewFolderForm(false);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder. Please try again.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const addTag = () => {
    if (!newTagName.trim()) return;

    const existingTag = tags.find(t => t.name.toLowerCase() === newTagName.toLowerCase());
    if (existingTag) {
      if (!formData.tagIds.includes(existingTag.id)) {
        setFormData(prev => ({
          ...prev,
          tagIds: [...prev.tagIds, existingTag.id]
        }));
      }
    } else {
      createTag(newTagName, newTagColor).then(newTag => {
        if (newTag) {
          setFormData(prev => ({
            ...prev,
            tagIds: [...prev.tagIds, newTag.id]
          }));
        }
      }).catch(console.error);
    }
    setNewTagName('');
    setNewTagColor(PREDEFINED_COLORS[0]);
  };

  const removeTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tagIds: prev.tagIds.filter(id => id !== tagId)
    }));
  };

  const selectedTags = tags.filter(t => formData.tagIds.includes(t.id));
  const selectedFolder = folders.find(f => f.id === formData.folderId);

  const handleOpenChange = (newOpen: boolean) => {
    if (isLoading && !newOpen) {
      return;
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
              <StickyNote className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            {note ? 'Edit Note' : 'Create New Note'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Error Display */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title Field */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm font-medium">Title *</Label>
            <Input
              id="title"
              placeholder="Enter note title..."
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          {/* Content Field */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-sm font-medium">Content</Label>
            <Textarea
              id="content"
              placeholder="Write your note content here..."
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={6}
              className="resize-none"
            />
          </div>

          {/* Folder Selection with Create New */}
          <div className="space-y-2">
            <Label htmlFor="folder" className="text-sm font-medium">Folder *</Label>
            <div className="flex gap-2">
              <Select
                value={formData.folderId}
                onValueChange={(value) => setFormData(prev => ({ ...prev, folderId: value }))}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a folder">
                    {selectedFolder && (
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: selectedFolder.color }}
                        />
                        <span>{selectedFolder.name}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {folders.filter(folder => folder && folder.id).map(folder => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: folder.color }}
                        />
                        <span>{folder.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                type="button" 
                variant={showNewFolderForm ? "secondary" : "outline"} 
                size="icon" 
                className="flex-shrink-0"
                onClick={() => setShowNewFolderForm(!showNewFolderForm)}
              >
                {showNewFolderForm ? <X className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
              </Button>
            </div>
            
            {/* Inline New Folder Form */}
            <AnimatePresence>
              {showNewFolderForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 border border-border/50 rounded-lg bg-muted/30 space-y-3 mt-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <FolderPlus className="w-3 h-3" />
                      <span>Create New Folder</span>
                    </div>
                    <Input
                      placeholder="Folder name..."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateFolder();
                        }
                      }}
                      autoFocus
                    />
                    <ColorPicker
                      selectedColor={newFolderColor}
                      onColorChange={setNewFolderColor}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setShowNewFolderForm(false);
                          setNewFolderName('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 gap-2"
                        onClick={handleCreateFolder}
                        disabled={!newFolderName.trim() || isCreatingFolder}
                      >
                        {isCreatingFolder ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Create
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Tags</Label>

            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedTags.map(tag => (
                  <Badge 
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center gap-1.5 px-2.5 py-1 pr-1.5"
                    style={{ 
                      backgroundColor: tag.color + '15',
                      color: tag.color,
                      borderColor: tag.color + '30'
                    }}
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      className="ml-0.5 hover:bg-black/10 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="flex gap-2">
              <Input
                placeholder="Type to add or create tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addTag}
                disabled={!newTagName.trim()}
                title={tags.some(t => t.name.toLowerCase() === newTagName.toLowerCase()) ? 'Add existing tag' : 'Create new tag'}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Tag hint */}
            {newTagName.trim() && !tags.some(t => t.name.toLowerCase() === newTagName.toLowerCase()) && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Plus className="h-3 w-3" />
                Press Enter to create new tag "{newTagName}"
              </p>
            )}

            <ColorPicker 
              selectedColor={newTagColor}
              onColorChange={setNewTagColor}
            />

            {/* Available Tags */}
            {tags.filter(tag => !formData.tagIds.includes(tag.id)).length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Available Tags:</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags
                    .filter(tag => !formData.tagIds.includes(tag.id))
                    .map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted transition-colors text-xs"
                        style={{ 
                          borderColor: tag.color + '40',
                          color: tag.color
                        }}
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          tagIds: [...prev.tagIds, tag.id]
                        }))}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.title.trim() || !formData.folderId}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                note ? 'Save Changes' : 'Create Note'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
