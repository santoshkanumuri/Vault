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
import { X, Plus, Loader2, Globe, RefreshCw, Link as LinkIcon, Sparkles, FolderPlus, Check } from 'lucide-react';
import { Link } from '@/lib/types';
import { LinkMetadata } from '@/lib/utils/metadata';
import { useApp } from '@/contexts/AppContext';
import { isValidUrl, fetchLinkMetadata } from '@/lib/utils/metadata';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';
import { generateRandomColor } from '@/lib/utils/colors';
import { useToast } from '@/hooks/use-toast';

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  link?: Link | null;
  defaultFolderId?: string;
}

export const LinkDialog: React.FC<LinkDialogProps> = ({
  open,
  onOpenChange,
  link,
  defaultFolderId,
}) => {
  const { folders, tags, createLink, updateLink, createTag, createFolder, isLoading, links } = useApp();
  const { toast } = useToast();
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Local loading state for form submission
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    description: '',
    folderId: '',
    tagIds: [] as string[],
  });
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PREDEFINED_COLORS[0]);
  const [error, setError] = useState('');
  const [previewMetadata, setPreviewMetadata] = useState<LinkMetadata | null>(null);
  
  // New folder creation state
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState(generateRandomColor());
  const [showNewFolderForm, setShowNewFolderForm] = useState(false);

  useEffect(() => {
    if (open) {
      if (link) {
        setFormData({
          name: link.name,
          url: link.url,
          description: link.description,
          folderId: link.folderId,
          tagIds: link.tagIds,
        });
        setPreviewMetadata(link.metadata || null);
      } else {
        setFormData({
          name: '',
          url: '',
          description: '',
          folderId: defaultFolderId || (folders[0]?.id || ''),
          tagIds: [],
        });
        setPreviewMetadata(null);
      }
      setNewTagName('');
      setNewTagColor(PREDEFINED_COLORS[0]);
      setNewFolderName('');
      setNewFolderColor(generateRandomColor());
      setIsCreatingFolder(false);
      setError('');
    }
  }, [open, link, defaultFolderId, folders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (!formData.url.trim()) {
      setError('URL is required');
      setIsSubmitting(false);
      return;
    }

    if (!formData.folderId) {
      setError('Please select a folder');
      setIsSubmitting(false);
      return;
    }

    if (!isValidUrl(formData.url)) {
      setError('Please enter a valid URL');
      setIsSubmitting(false);
      return;
    }

    // Check for duplicate URL (normalize URLs for comparison)
    if (!link) {
      try {
        const normalizedUrl = formData.url.trim().toLowerCase().replace(/\/$/, '');
        const existingLink = links.find(l => {
          const existingNormalized = l.url.toLowerCase().replace(/\/$/, '');
          return existingNormalized === normalizedUrl;
        });

        if (existingLink) {
          toast({
            title: 'Duplicate link detected',
            description: `A link with this URL already exists: "${existingLink.name}"`,
            variant: 'destructive',
          });
          setError('This URL already exists in your vault');
          setIsSubmitting(false);
          return;
        }
      } catch (err) {
        // If URL parsing fails, continue anyway
      }
    }

    // Create a timeout promise to prevent hanging indefinitely
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), 15000);
    });

    try {
      if (link) {
        await Promise.race([
          updateLink(
            link.id,
            formData.name.trim() || 'Untitled Link',
            formData.url.trim(),
            formData.description.trim(),
            formData.folderId,
            formData.tagIds
          ),
          timeoutPromise
        ]);
      } else {
        await Promise.race([
          createLink(
            formData.name.trim() || 'Untitled Link',
            formData.url.trim(),
            formData.description.trim(),
            formData.folderId,
            formData.tagIds
          ),
          timeoutPromise
        ]);
      }
      // Close dialog immediately after successful creation
      setIsSubmitting(false);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving link:', error);
      setError(error?.message || 'Failed to save link. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }));
    setPreviewMetadata(null);
  };

  const fetchMetadataPreview = async () => {
    if (!formData.url || !isValidUrl(formData.url)) {
      return;
    }

    setIsFetchingMetadata(true);
    try {
      const metadata = await fetchLinkMetadata(formData.url);
      setPreviewMetadata(metadata);

      if (!formData.name && metadata.title) {
        setFormData(prev => ({ ...prev, name: metadata.title || '' }));
      }

      if (!formData.description && metadata.description) {
        setFormData(prev => ({ ...prev, description: metadata.description || '' }));
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setIsFetchingMetadata(false);
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
    // Allow closing if not currently submitting
    if (isSubmitting && !newOpen) {
      return;
    }
    // Reset submitting state when closing
    if (!newOpen) {
      setIsSubmitting(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <LinkIcon className="w-4 h-4 text-primary" />
            </div>
            {link ? 'Edit Link' : 'Add New Link'}
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

          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="url" className="text-sm font-medium">URL *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com"
                  value={formData.url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  required
                  className="pl-9"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={fetchMetadataPreview}
                disabled={!formData.url || !isValidUrl(formData.url) || isFetchingMetadata}
                className="flex-shrink-0"
              >
                {isFetchingMetadata ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Metadata Preview */}
          <AnimatePresence>
            {previewMetadata && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 border border-border/50 rounded-xl bg-muted/30 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Sparkles className="w-3 h-3" />
                    <span>Preview from URL</span>
                  </div>
                  <div className="flex items-start space-x-3">
                    {previewMetadata.favicon && (
                      <img 
                        src={previewMetadata.favicon} 
                        alt="" 
                        className="w-8 h-8 rounded-lg object-contain bg-background mt-0.5"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm line-clamp-1">
                        {previewMetadata.title || 'No title'}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {previewMetadata.description || 'No description'}
                      </p>
                      {previewMetadata.siteName && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {previewMetadata.siteName}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Name</Label>
            <Input
              id="name"
              placeholder="Link name (auto-filled from metadata)"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">Description</Label>
            <Textarea
              id="description"
              placeholder="Brief description..."
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={2}
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
              disabled={isSubmitting || !formData.url || !formData.folderId}
              className="gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {link ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                link ? 'Update Link' : 'Add Link'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
