'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
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
  Moon,
  Sun,
  User,
  LogOut,
  Edit,
  Trash2,
  MoreHorizontal,
  Link as LinkIcon,
  Shield,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { FolderDialog } from '@/components/folders/FolderDialog';
import { TagDialog } from '@/components/tags/TagDialog';
import { Folder as FolderType, Tag as TagType } from '@/lib/types';

interface SidebarProps {
  onNavigate?: () => void;
}

const springConfig = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
};

// Animated counter component for smooth number transitions
const AnimatedCounter: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const prevValue = useRef(value);
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const direction = useRef<'up' | 'down'>('up');

  useEffect(() => {
    if (prevValue.current !== value) {
      direction.current = value > prevValue.current ? 'up' : 'down';
      setIsAnimating(true);
      prevValue.current = value;
      
      // Quick transition to new value
      const timeout = setTimeout(() => {
        setDisplayValue(value);
        setIsAnimating(false);
      }, 150);
      
      return () => clearTimeout(timeout);
    }
  }, [value]);

  return (
    <span className={`relative inline-flex overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={displayValue}
          initial={{ 
            y: direction.current === 'up' ? 10 : -10, 
            opacity: 0,
            scale: 0.8 
          }}
          animate={{ 
            y: 0, 
            opacity: 1,
            scale: 1 
          }}
          exit={{ 
            y: direction.current === 'up' ? -10 : 10, 
            opacity: 0,
            scale: 0.8,
            position: 'absolute' 
          }}
          transition={{ 
            type: 'spring', 
            stiffness: 500, 
            damping: 30,
            mass: 0.5 
          }}
        >
          {displayValue}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const { 
    folders, 
    tags, 
    links,
    notes,
    currentFolder, 
    currentTag,
    setCurrentFolder, 
    setCurrentTag,
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
    if (confirm('Are you sure you want to delete this folder? All items in this folder will be deleted.')) {
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

  const handleNavigation = (folderId: string | null) => {
    setCurrentFolder(folderId);
    setCurrentTag(null); // Clear tag filter when navigating to folder
    onNavigate?.();
  };

  const handleTagClick = (tagId: string | null) => {
    setCurrentTag(tagId);
    setCurrentFolder(null); // Clear folder filter when filtering by tag
    onNavigate?.();
  };

  const getFolderItemCount = (folderId: string) => {
    const linkCount = links.filter(link => link.folderId === folderId).length;
    const noteCount = notes.filter(note => note.folderId === folderId).length;
    return linkCount + noteCount;
  };

  const getTagItemCount = (tagId: string) => {
    const linkCount = links.filter(link => link.tagIds.includes(tagId)).length;
    const noteCount = notes.filter(note => note.tagIds.includes(tagId)).length;
    return linkCount + noteCount;
  };

  const totalItems = links.length + notes.length;

  return (
    <div className="h-full bg-card/50 backdrop-blur-sm border-r border-border/50 flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center justify-between">
          <motion.div 
            className="flex items-center gap-3"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={springConfig}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow-sm">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-lg tracking-tight">Vault</h2>
              <p className="text-xs text-muted-foreground">Your digital sanctuary</p>
            </div>
          </motion.div>
          
          <DropdownMenu open={isUserMenuOpen} onOpenChange={setIsUserMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full">
                <User className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-3 py-3">
                <p className="font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              
              <div className="px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-metadata" className="text-sm">Show Metadata</Label>
                  <Switch
                    id="show-metadata"
                    checked={user?.showMetadata || false}
                    onCheckedChange={handleMetadataToggle}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Display link previews on cards
                </p>
              </div>
              
              <DropdownMenuSeparator />
              
              <div className="px-3 py-2.5">
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
              <DropdownMenuItem onClick={logout} className="text-destructive gap-2">
                <LogOut className="h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        {/* All Items */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.1 }}
        >
          <Button
            variant={currentFolder === null ? "secondary" : "ghost"}
            className={`w-full justify-start gap-3 h-11 ${currentFolder === null ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
            onClick={() => handleNavigation(null)}
          >
            <Sparkles className="h-4 w-4" />
            <span className="flex-1 text-left">All Items</span>
            <Badge 
              variant="secondary" 
              className={`ml-auto font-medium min-w-[1.5rem] justify-center ${currentFolder === null ? 'bg-primary/20 text-primary' : ''}`}
            >
              <AnimatedCounter value={totalItems} />
            </Badge>
          </Button>
        </motion.div>

        <Separator className="bg-border/50" />

        {/* Folders */}
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.15 }}
        >
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Folders
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-primary/10"
              onClick={() => {
                setEditingFolder(null);
                setIsFolderDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {folders.filter(folder => folder && folder.id).map((folder, index) => (
                <motion.div 
                  key={folder.id} 
                  className="group flex items-center"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ ...springConfig, delay: index * 0.02 }}
                >
                  <Button
                    variant={currentFolder === folder.id ? "secondary" : "ghost"}
                    className={`flex-1 justify-start gap-2.5 h-10 ${currentFolder === folder.id ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                    onClick={() => handleNavigation(folder.id)}
                  >
                    <div
                      className="h-3 w-3 rounded-full flex-shrink-0 ring-2 ring-offset-1 ring-offset-background"
                      style={{ 
                        backgroundColor: folder.color,
                        ['--tw-ring-color' as any]: `${folder.color}40`
                      }}
                    />
                    <span className="truncate flex-1 text-left text-sm">{folder.name}</span>
                    <Badge 
                      variant="secondary" 
                      className={`ml-auto text-xs min-w-[1.25rem] justify-center ${currentFolder === folder.id ? 'bg-primary/20 text-primary' : ''}`}
                    >
                      <AnimatedCounter value={getFolderItemCount(folder.id)} />
                    </Badge>
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 ml-1"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => {
                        setEditingFolder(folder);
                        setIsFolderDialogOpen(true);
                      }} className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="text-destructive gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>

        <Separator className="bg-border/50" />

        {/* Tags */}
        <motion.div 
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springConfig, delay: 0.2 }}
        >
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Tags
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 w-6 p-0 hover:bg-primary/10"
              onClick={() => {
                setEditingTag(null);
                setIsTagDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {tags.filter(tag => tag && tag.id).map((tag, index) => (
                <motion.div 
                  key={tag.id} 
                  className="group flex items-center"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ ...springConfig, delay: index * 0.02 }}
                >
                  <Button
                    variant={currentTag === tag.id ? "secondary" : "ghost"}
                    className={`flex-1 justify-start gap-2.5 h-10 ${currentTag === tag.id ? 'bg-primary/10 text-primary hover:bg-primary/15' : ''}`}
                    onClick={() => handleTagClick(tag.id)}
                  >
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate flex-1 text-left text-sm">{tag.name}</span>
                    <Badge 
                      variant="secondary" 
                      className={`ml-auto text-xs min-w-[1.25rem] justify-center ${currentTag === tag.id ? 'bg-primary/20 text-primary' : ''}`}
                    >
                      <AnimatedCounter value={getTagItemCount(tag.id)} />
                    </Badge>
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0 ml-1"
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem onClick={() => {
                        setEditingTag(tag);
                        setIsTagDialogOpen(true);
                      }} className="gap-2">
                        <Edit className="h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteTag(tag.id)}
                        className="text-destructive gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
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
