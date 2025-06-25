'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Folder,
  Plus,
  Tag,
  Settings,
  Moon,
  Sun,
  User,
  LogOut,
  Edit,
  Trash2,
  MoreHorizontal,
  Link as LinkIcon,
  Eye,
  EyeOff
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { FolderDialog } from '@/components/folders/FolderDialog';
import { TagDialog } from '@/components/tags/TagDialog';
import { Folder as FolderType, Tag as TagType } from '@/lib/types';

export const Sidebar: React.FC = () => {
  const { 
    folders, 
    tags, 
    links,
    currentFolder, 
    setCurrentFolder, 
    darkMode, 
    toggleDarkMode,
    deleteFolder,
    deleteTag
  } = useApp();
  const { user, logout, updateMetadataPreference } = useAuth();

  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<FolderType | null>(null);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagType | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleDeleteFolder = async (id: string) => {
    if (confirm('Are you sure you want to delete this folder? All links in this folder will be deleted.')) {
      await deleteFolder(id);
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (confirm('Are you sure you want to delete this tag?')) {
      await deleteTag(id);
    }
  };

  const handleMetadataToggle = async (checked: boolean) => {
    try {
      await updateMetadataPreference(checked);
    } catch (error) {
      console.error('Failed to update metadata preference:', error);
    }
  };

  const getFolderLinkCount = (folderId: string) => {
    return links.filter(link => link.folderId === folderId).length;
  };

  const getTagLinkCount = (tagId: string) => {
    return links.filter(link => link.tagIds.includes(tagId)).length;
  };

  return (
    <div className="h-full bg-card border-r border-border flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LinkIcon className="h-6 w-6 text-primary" />
            <h2 className="font-bold text-lg">Vault</h2>
          </div>
          
          <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-3 py-2">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              
              <div className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-metadata" className="text-sm">Show Metadata</Label>
                  <Switch
                    id="show-metadata"
                    checked={user?.showMetadata || false}
                    onCheckedChange={handleMetadataToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Display link metadata in cards
                </p>
              </div>
              
              <DropdownMenuSeparator />
              
              <div className="px-3 py-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Theme</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleDarkMode}
                    className="h-8 w-8 p-0"
                  >
                    {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* All Links */}
        <div>
          <Button
            variant={currentFolder === null ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => setCurrentFolder(null)}
          >
            <LinkIcon className="mr-2 h-4 w-4" />
            All Links
            <Badge variant="secondary" className="ml-auto">
              {links.length}
            </Badge>
          </Button>
        </div>

        <Separator />

        {/* Folders */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Folders
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => {
                setEditingFolder(null);
                setIsFolderDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1">
            {folders.filter(folder => folder && folder.id).map(folder => (
              <div key={folder.id} className="group flex items-center">
                <Button
                  variant={currentFolder === folder.id ? "secondary" : "ghost"}
                  className="flex-1 justify-start truncate"
                  onClick={() => setCurrentFolder(folder.id)}
                >
                  <div
                    className="mr-2 h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="truncate">{folder.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {getFolderLinkCount(folder.id)}
                  </Badge>
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0 ml-1"
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setEditingFolder(folder);
                      setIsFolderDialogOpen(true);
                    }}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleDeleteFolder(folder.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Tags */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Tags
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0"
              onClick={() => {
                setEditingTag(null);
                setIsTagDialogOpen(true);
              }}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1">
            {tags.filter(tag => tag && tag.id).map(tag => (
              <div key={tag.id} className="group flex items-center justify-between w-full">
                <div className="flex items-center gap-2 flex-1 truncate">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="truncate text-sm">{tag.name}</span>
                </div>
                
                <div className="flex items-center">
                  <Badge variant="secondary" className="mr-1">
                    {getTagLinkCount(tag.id)}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingTag(tag);
                        setIsTagDialogOpen(true);
                      }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FolderDialog 
        open={isFolderDialogOpen}
        onOpenChange={setIsFolderDialogOpen}
        folder={editingFolder}
      />
      <TagDialog
        open={isTagDialogOpen}
        onOpenChange={setIsTagDialogOpen}
        tag={editingTag}
      />
    </div>
  );
};