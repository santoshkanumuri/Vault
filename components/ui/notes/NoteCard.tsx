'use client';

import React, { useState, memo, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo } from 'framer-motion';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, StickyNote, Calendar, Brain, Sparkles, Loader2, AlertCircle, Undo2 } from 'lucide-react';
import { Note, Folder, Tag } from '@/lib/types';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { formatDistanceToNow } from 'date-fns';

interface NoteCardProps {
  note: Note;
  folder: Folder;
  tags: Tag[];
  onEdit: (note: Note) => void;
  index?: number;
  searchQuery?: string;
}

// Custom comparison function for React.memo - only re-render when relevant props change
const arePropsEqual = (
  prevProps: NoteCardProps,
  nextProps: NoteCardProps
): boolean => {
  // Check if note data changed
  if (prevProps.note.id !== nextProps.note.id ||
      prevProps.note.title !== nextProps.note.title ||
      prevProps.note.content !== nextProps.note.content ||
      prevProps.note.folderId !== nextProps.note.folderId) {
    return false;
  }
  
  // Check embedding changes
  const prevHasEmbed = prevProps.note.embedding && prevProps.note.embedding.length > 0;
  const nextHasEmbed = nextProps.note.embedding && nextProps.note.embedding.length > 0;
  if (prevHasEmbed !== nextHasEmbed) return false;
  
  // Check tagIds array
  if (prevProps.note.tagIds.length !== nextProps.note.tagIds.length ||
      !prevProps.note.tagIds.every((id, i) => id === nextProps.note.tagIds[i])) {
    return false;
  }
  
  // Check folder
  if (prevProps.folder.id !== nextProps.folder.id ||
      prevProps.folder.name !== nextProps.folder.name ||
      prevProps.folder.color !== nextProps.folder.color) {
    return false;
  }
  
  // Check tags array (by id and name)
  if (prevProps.tags.length !== nextProps.tags.length) return false;
  for (let i = 0; i < prevProps.tags.length; i++) {
    if (prevProps.tags[i].id !== nextProps.tags[i].id ||
        prevProps.tags[i].name !== nextProps.tags[i].name ||
        prevProps.tags[i].color !== nextProps.tags[i].color) {
      return false;
    }
  }
  
  // Check other props
  if (prevProps.index !== nextProps.index ||
      prevProps.searchQuery !== nextProps.searchQuery) {
    return false;
  }
  
  // All checks passed - props are equal, skip re-render
  return true;
};

const NoteCardComponent: React.FC<NoteCardProps> = ({
  note,
  folder,
  tags,
  onEdit,
  index = 0,
  searchQuery = '',
}) => {
  const { deleteNote, refreshNoteContent, recentlyCreatedIds } = useApp();
  const { toast } = useToast();
  const [isHovered, setIsHovered] = useState(false);
  const [isUpdatingContent, setIsUpdatingContent] = useState(false);

  // Status tracking
  const hasEmbedding = !!(note.embedding && note.embedding.length > 0);
  const hasEnoughContent = note.content && note.content.length >= 50;
  const isProcessing = isUpdatingContent;
  
  // Determine status: 'indexed' | 'pending' | 'processing' | 'none'
  const getStatus = () => {
    if (isProcessing) return 'processing';
    if (hasEmbedding) return 'indexed';
    if (hasEnoughContent && !hasEmbedding) return 'pending';
    return 'none';
  };
  const status = getStatus();

  // Soft delete with undo functionality
  const pendingDeleteRef = useRef<NodeJS.Timeout | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    // Cancel any pending delete
    if (pendingDeleteRef.current) {
      clearTimeout(pendingDeleteRef.current);
    }

    setIsDeleting(true);
    const deletedNote = { ...note };

    // Show undo toast
    const { dismiss } = toast({
      title: "Note deleted",
      description: `"${note.title.slice(0, 25)}${note.title.length > 25 ? '...' : ''}" removed`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Undo delete"
          onClick={() => {
            // Cancel the pending delete
            if (pendingDeleteRef.current) {
              clearTimeout(pendingDeleteRef.current);
              pendingDeleteRef.current = null;
            }
            setIsDeleting(false);
            dismiss();
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Undo
        </ToastAction>
      ),
    });

    // Schedule actual deletion after toast duration
    pendingDeleteRef.current = setTimeout(async () => {
      try {
        await deleteNote(deletedNote.id);
      } catch (error) {
        console.error('Error deleting note:', error);
        setIsDeleting(false);
        toast({
          title: "Failed to delete",
          description: "Could not delete the note. Please try again.",
          variant: "destructive",
        });
      }
      pendingDeleteRef.current = null;
    }, 5000);
  }, [note, deleteNote, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current);
      }
    };
  }, []);

  const handleUpdateContent = async () => {
    setIsUpdatingContent(true);
    try {
      await refreshNoteContent(note.id);
      toast({
        title: "Content updated",
        description: "Embeddings generated successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to update content",
        description: "Could not generate embeddings.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingContent(false);
    }
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength: number = 120) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  // Generate a subtle gradient based on folder color
  const getCardGradient = () => {
    return {
      background: `linear-gradient(135deg, ${folder.color}08 0%, transparent 60%)`,
    };
  };

  // Only animate entrance for first 20 items to reduce lag
  const shouldAnimate = index < 20;
  
  // Check if this card was just created
  const isNew = recentlyCreatedIds.has(note.id);

  // Swipe to delete functionality
  const x = useMotionValue(0);
  const controls = useAnimation();
  const deleteThreshold = -100;
  
  // Transform x position to background opacity and scale
  const deleteOpacity = useTransform(x, [-150, -100, 0], [1, 0.8, 0]);
  const deleteScale = useTransform(x, [-150, -100, 0], [1, 0.95, 0.8]);
  
  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (info.offset.x < deleteThreshold) {
      // Animate off screen then delete
      await controls.start({ x: -400, opacity: 0, transition: { duration: 0.2 } });
      handleDelete();
    } else {
      // Snap back
      controls.start({ x: 0, transition: { type: 'spring', stiffness: 500, damping: 30 } });
    }
  };

  // Hide card during undo period
  if (isDeleting) return null;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, scale: 0.8, y: 20 } : shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={isNew ? { 
        type: 'spring', 
        stiffness: 500, 
        damping: 25,
        mass: 0.8,
      } : shouldAnimate ? { 
        type: 'spring', 
        stiffness: 400, 
        damping: 30,
        delay: index * 0.02,
      } : { duration: 0 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative ${isNew ? 'z-10' : ''}`}
    >
      {/* Delete background revealed on swipe */}
      <motion.div 
        className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-end pr-6 overflow-hidden"
        style={{ opacity: deleteOpacity, scale: deleteScale }}
      >
        <motion.div
          className="flex items-center gap-2 text-white font-medium"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Trash2 className="h-5 w-5" />
          <span>Delete</span>
        </motion.div>
      </motion.div>
      
      {/* Swipeable card container */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={controls}
        className="relative touch-pan-y"
      >
        {/* New card glow effect */}
        {isNew && (
          <motion.div
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 blur-xl -z-10"
            initial={{ opacity: 0.8, scale: 1.1 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        )}
        <Card 
          className={`group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg dark:hover:shadow-primary/5 cursor-pointer ${isNew ? 'ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10' : ''}`}
          style={getCardGradient()}
          onClick={() => onEdit(note)}
        >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div
                className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center relative transition-transform duration-200 hover:scale-110 hover:-rotate-3"
              >
                <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                {/* Status dot overlay */}
                {status === 'indexed' && (
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-background"
                    title="Indexed"
                  />
                )}
                {status === 'processing' && (
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-background animate-pulse"
                    title="Processing"
                  />
                )}
                {status === 'pending' && (
                  <span 
                    className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-background"
                    title="Pending"
                  />
                )}
              </div>
              <CardTitle className="text-base line-clamp-1 break-words">
                {note.title}
              </CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(note); }} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={(e) => { e.stopPropagation(); handleUpdateContent(); }} 
                  disabled={isUpdatingContent}
                  className="gap-2"
                >
                  <Brain className={`h-4 w-4 ${isUpdatingContent ? 'animate-pulse' : ''}`} />
                  {isUpdatingContent ? 'Processing...' : 'Update Embeddings'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="text-destructive gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0">
          {note.content && (
            <p className="text-sm text-muted-foreground mb-4 line-clamp-3 whitespace-pre-wrap leading-relaxed">
              {truncateContent(note.content)}
            </p>
          )}
          
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="text-xs px-2.5 py-0.5 font-medium border"
                style={{ 
                  backgroundColor: `${folder.color}15`, 
                  color: folder.color,
                  borderColor: `${folder.color}30`
                }}
              >
                {folder.name}
              </Badge>
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs px-2 py-0.5"
                  style={{ 
                    borderColor: `${tag.color}30`, 
                    color: tag.color,
                    backgroundColor: `${tag.color}10`
                  }}
                >
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
            
            {/* Status and Date */}
            <div className="flex items-center gap-2">
              {/* Status indicator */}
              {status === 'processing' && (
                <div 
                  className="flex items-center gap-1.5 text-xs"
                  title="Processing embeddings..."
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Loader2 className="w-3.5 h-3.5 text-blue-500" />
                  </motion.div>
                  <span className="text-blue-500 font-medium hidden sm:inline">Processing</span>
                </div>
              )}
              {status === 'indexed' && (
                <div 
                  className="flex items-center gap-1.5 text-xs"
                  title="✓ Indexed for smart search"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  </motion.div>
                  <span className="text-amber-600 dark:text-amber-400 font-medium hidden sm:inline">Indexed</span>
                </div>
              )}
              {status === 'pending' && (
                <div 
                  className="flex items-center gap-1.5 text-xs"
                  title="Embeddings pending"
                >
                  <div className="relative">
                    <Brain className="w-3.5 h-3.5 text-orange-500" />
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" />
                  </div>
                  <span className="text-orange-500 font-medium hidden sm:inline">Pending</span>
                </div>
              )}
              
              {/* Date */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span title={new Date(note.createdAt).toLocaleString()}>
                  {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </motion.div>
    </motion.div>
  );
};

// Export memoized component to prevent unnecessary re-renders
export const NoteCard = memo(NoteCardComponent, arePropsEqual);
