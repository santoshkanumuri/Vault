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
import { X, Plus, Loader2, Globe, RefreshCw } from 'lucide-react';
import { Link } from '@/lib/types';
import { LinkMetadata } from '@/lib/utils/metadata';
import { useApp } from '@/contexts/AppContext';
import { isValidUrl, fetchLinkMetadata } from '@/lib/utils/metadata';
import { ColorPicker, PREDEFINED_COLORS } from '@/components/ui/ColorPicker';

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
  const { folders, tags, createLink, updateLink, createTag } = useApp();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
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
    }
  }, [open, link, defaultFolderId, folders]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate required fields
    if (!formData.url.trim()) {
      setError('URL is required');
      return;
    }
    
    if (!formData.folderId) {
      setError('Please select a folder');
      return;
    }
    
    // Validate URL format
    if (!isValidUrl(formData.url)) {
      setError('Please enter a valid URL');
      return;
    }

    setIsLoading(true);
    try {
      if (link) {
        await updateLink(
          link.id,
          formData.name.trim() || 'Untitled Link',
          formData.url.trim(),
          formData.description.trim(),
          formData.folderId,
          formData.tagIds
        );
      } else {
        await createLink(
          formData.name.trim() || 'Untitled Link',
          formData.url.trim(),
          formData.description.trim(),
          formData.folderId,
          formData.tagIds
        );
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving link:', error);
      setError('Failed to save link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    setFormData(prev => ({ ...prev, url }));
    setPreviewMetadata(null);
  };

  const fetchMetadataPreview = async () => {
    if (!formData.url || !isValidUrl(formData.url)) {
      // Invalid URL provided
      return;
    }
    
    // Starting metadata fetch
    setIsFetchingMetadata(true);
    try {
      const metadata = await fetchLinkMetadata(formData.url);
      // Metadata fetched successfully
      setPreviewMetadata(metadata);
      
      // Auto-fill name if empty
      if (!formData.name && metadata.title) {
        setFormData(prev => ({ ...prev, name: metadata.title || '' }));
      }
      
      // Auto-fill description if empty
      if (!formData.description && metadata.description) {
        setFormData(prev => ({ ...prev, description: metadata.description || '' }));
      }
    } catch (error) {
      console.error('Error fetching metadata:', error);
    } finally {
      setIsFetchingMetadata(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {link ? 'Edit Link' : 'Add New Link'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Display */}
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {/* URL Field */}
          <div className="space-y-2">
            <Label htmlFor="url">URL *</Label>
            <div className="flex space-x-2">
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={formData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
                required
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchMetadataPreview}
                disabled={!formData.url || !isValidUrl(formData.url) || isFetchingMetadata}
                className="px-3"
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
          {previewMetadata && (
            <div className="p-4 border rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-start space-x-3">
                {previewMetadata.favicon && (
                  <img 
                    src={previewMetadata.favicon} 
                    alt="" 
                    className="w-6 h-6 object-contain mt-0.5"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm truncate">
                    {previewMetadata.title || 'No title'}
                  </h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {previewMetadata.description || 'No description'}
                  </p>
                  {previewMetadata.siteName && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {previewMetadata.siteName}
                    </p>
                  )}
                </div>
              </div>
              {previewMetadata.image && (
                <img 
                  src={previewMetadata.image} 
                  alt=""
                  className="w-full h-32 object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
            </div>
          )}

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Link name (auto-filled from metadata)"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Link description (auto-filled from metadata)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          {/* Folder Selection */}
          <div className="space-y-2">
            <Label htmlFor="folder">Folder *</Label>
            <Select
              value={formData.folderId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, folderId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.filter(folder => folder && folder.id).map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <div className="flex items-center space-x-2">
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
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Tags</Label>
            
            {/* Selected Tags */}
            {selectedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedTags.map(tag => (
                  <Badge 
                    key={tag.id}
                    variant="secondary"
                    className="flex items-center space-x-1 px-2 py-1"
                    style={{ 
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                      borderColor: tag.color + '40'
                    }}
                  >
                    <span>{tag.name}</span>
                    <button
                      type="button"
                      onClick={() => removeTag(tag.id)}
                      className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Add New Tag */}
            <div className="flex space-x-2">
              <Input
                placeholder="Add a tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={!newTagName.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <ColorPicker 
              selectedColor={newTagColor}
              onColorChange={setNewTagColor}
              className="pt-2"
            />

            {/* Available Tags */}
            {tags.length > 0 && (
              <div className="space-y-2 pt-2">
                <Label className="text-sm text-muted-foreground">Available Tags:</Label>
                <div className="flex flex-wrap gap-2">
                  {tags
                    .filter(tag => !formData.tagIds.includes(tag.id))
                    .map(tag => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="cursor-pointer hover:bg-muted transition-colors"
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
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.url || !formData.folderId}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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