'use client';

import React, { useState, useEffect, memo, useRef, useCallback, useTransition } from 'react';
import { motion, useMotionValue, useTransform, useAnimation, PanInfo, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  ExternalLink, 
  Edit, 
  Trash2, 
  RefreshCw,
  Globe,
  Calendar,
  FileText,
  Copy,
  Check,
  Sparkles,
  Loader2,
  AlertCircle,
  Undo2,
  Pin,
  MousePointerClick
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, Folder, Tag } from '@/lib/types';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { formatDistanceToNow } from 'date-fns';
import { LinkStatus } from '@/lib/utils/link-status';
import { trackLinkClick } from '@/lib/services/database';

interface LinkCardProps {
  link: Link;
  folder: Folder;
  tags: Tag[];
  onEdit: (link: Link) => void;
  index?: number;
  searchQuery?: string;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onQuickLook?: () => void; // Added for Quick Look
}

// Custom comparison function for React.memo - only re-render when relevant props change
const arePropsEqual = (
  prevProps: LinkCardProps,
  nextProps: LinkCardProps
): boolean => {
  // Check Quick Look handler
  if (prevProps.onQuickLook !== nextProps.onQuickLook) return false;

  // Check if link data changed
  if (prevProps.link.id !== nextProps.link.id ||
      prevProps.link.name !== nextProps.link.name ||
      prevProps.link.url !== nextProps.link.url ||
      prevProps.link.description !== nextProps.link.description ||
      prevProps.link.favicon !== nextProps.link.favicon ||
      prevProps.link.folderId !== nextProps.link.folderId ||
      prevProps.link.wordCount !== nextProps.link.wordCount ||
      prevProps.link.fullContent !== nextProps.link.fullContent ||
      prevProps.link.isPinned !== nextProps.link.isPinned ||
      prevProps.link.clickCount !== nextProps.link.clickCount) {
    return false;
  }
  
  // Check embedding changes (handle both array and string formats)
  const prevEmbed = prevProps.link.embedding;
  const nextEmbed = nextProps.link.embedding;
  const prevHasEmbed = prevEmbed && ((Array.isArray(prevEmbed) && prevEmbed.length > 0) || (typeof prevEmbed === 'string' && prevEmbed.length > 10));
  const nextHasEmbed = nextEmbed && ((Array.isArray(nextEmbed) && nextEmbed.length > 0) || (typeof nextEmbed === 'string' && nextEmbed.length > 10));
  if (prevHasEmbed !== nextHasEmbed) return false;
  
  // Check tagIds array
  if (prevProps.link.tagIds.length !== nextProps.link.tagIds.length ||
      !prevProps.link.tagIds.every((id, i) => id === nextProps.link.tagIds[i])) {
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
      prevProps.searchQuery !== nextProps.searchQuery ||
      prevProps.isSelectionMode !== nextProps.isSelectionMode ||
      prevProps.isSelected !== nextProps.isSelected) {
    return false;
  }
  
  // All checks passed - props are equal, skip re-render
  return true;
};

const LinkCardComponent: React.FC<LinkCardProps> = ({ 
  link, 
  folder, 
  tags, 
  onEdit, 
  index = 0, 
  searchQuery = '',
  isSelectionMode = false,
  isSelected = false,
  onToggleSelect,
  onQuickLook
}) => {
  const { deleteLink, refreshLinkMetadata, linkStatuses, recentlyCreatedIds, togglePinLink } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  const pressTimer = useRef<NodeJS.Timeout>();

  // Handle Quick Look Trigger (Spacebar & Long Press)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only trigger if hovered, not editing text, and Space is pressed
        if (isHovered && e.code === 'Space' && onQuickLook) {
          // Check if we are focusing an input/textarea
          const activeElement = document.activeElement;
          const isInputFocused = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement;
          
          if (!isInputFocused) {
            e.preventDefault(); // Prevent scrolling
            onQuickLook();
          }
        }
    };

    if (isHovered) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHovered, onQuickLook]);

  // Touch handlers for long press
  const handleTouchStart = () => {
    if (!onQuickLook) return;
    pressTimer.current = setTimeout(() => {
        onQuickLook();
        // Vibrate to indicate success if supported
        if (navigator.vibrate) navigator.vibrate(50);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  // Get status from centralized polling in AppContext
  const linkStatus = linkStatuses.get(link.id) || {
    hasChunks: false,
    isProcessing: false,
    isPending: false,
    hasFailed: false,
  };

  // Check if link has been successfully processed
  // Note: pgvector embedding may not be returned as a JS array, so we also check wordCount
  const embeddingValue = link.embedding;
  const hasEmbedding = embeddingValue && (
    (typeof embeddingValue === 'string' && embeddingValue.length > 10) ||
    (Array.isArray(embeddingValue) && embeddingValue.length > 0)
  );
  const hasBeenProcessed = 
    // Check if embedding exists (could be array, string, or pgvector format)
    hasEmbedding ||
    // Or if we have word count which indicates content was extracted
    (link.wordCount && link.wordCount > 0) ||
    // Or if we have full content
    (link.fullContent && link.fullContent.length > 0);

  // Local processing state (for immediate UI feedback)
  const isLocallyProcessing = isRefreshing;
  
  // Determine status: 'success' | 'processing' | 'failed' | 'pending'
  const getStatus = (): 'success' | 'processing' | 'failed' | 'pending' => {
    // If user just triggered an action, show processing immediately
    if (isLocallyProcessing) return 'processing';
    
    // If link has been processed successfully (has embedding, word count, or full content)
    if (hasBeenProcessed) return 'success';
    
    // Check database status from polling
    if (linkStatus.hasChunks) return 'success'; // Green sparkle - chunks exist
    if (linkStatus.isProcessing) return 'processing'; // Orange dot + processing icon
    if (linkStatus.isPending) return 'processing'; // Orange dot + processing icon
    if (linkStatus.hasFailed) return 'failed'; // Red error + red dot
    
    // Default: no embeddings and not processing = pending (not failed yet)
    // Only show "failed" if we explicitly know a task failed
    return 'pending';
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
    const deletedLink = { ...link };

    // Show undo toast
    const { dismiss } = toast({
      title: "Link deleted",
      description: `"${link.name.slice(0, 25)}${link.name.length > 25 ? '...' : ''}" removed`,
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
        await deleteLink(deletedLink.id);
      } catch (error) {
        console.error('Error deleting link:', error);
        setIsDeleting(false);
        toast({
          title: "Failed to delete",
          description: "Could not delete the link. Please try again.",
          variant: "destructive",
        });
      }
      pendingDeleteRef.current = null;
    }, 5000);
  }, [link, deleteLink, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current);
      }
    };
  }, []);

  const handleRefreshMetadata = async () => {
    setIsRefreshing(true);
    try {
      await refreshLinkMetadata(link.id);
      toast({
        title: "Refreshed",
        description: "Metadata and embeddings have been updated.",
      });
    } catch (error: any) {
      console.error('handleRefreshMetadata error:', error);
      toast({
        title: "Failed to refresh",
        description: error?.message || "Could not refresh metadata. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleOpenLink = useCallback((source: 'direct' | 'search' | 'quicklook' | 'external' = 'direct') => {
    // Track the click (fire and forget - don't block UI)
    if (user?.id) {
      trackLinkClick(link.id, user.id, searchQuery ? 'search' : source).catch(() => {
        // Silently fail - analytics should never break the app
      });
    }
    window.open(link.url, '_blank', 'noopener,noreferrer');
  }, [link.id, link.url, user?.id, searchQuery]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "The link has been copied to your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = link.url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast({
          title: "Link copied!",
          description: "The link has been copied to your clipboard.",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        toast({
          title: "Failed to copy",
          description: "Could not copy the link to clipboard.",
          variant: "destructive",
        });
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const handleTogglePin = async () => {
    const willBePinned = !link.isPinned;
    try {
      await togglePinLink(link.id);
      toast({
        title: willBePinned ? "📌 Pinned to top" : "Unpinned",
        description: willBePinned 
          ? `"${link.name}" will now appear at the top of your list.`
          : `"${link.name}" returned to regular order.`,
        duration: 2000,
      });
    } catch (error) {
      toast({
        title: "Failed to update pin",
        description: "Could not update pin status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const linkTags = tags.filter(tag => link.tagIds.includes(tag.id));
  const showMetadata = user?.showMetadata && link.metadata;
  
  // Only animate entrance for first 20 items to reduce lag
  const shouldAnimate = index < 20;
  
  // Check if this card was just created
  const isNew = recentlyCreatedIds.has(link.id);

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
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchEnd}
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
            className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 blur-xl -z-10"
            initial={{ opacity: 0.8, scale: 1.1 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
        )}
        <Card 
          className={`group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg dark:hover:shadow-primary/5 ${isNew ? 'ring-2 ring-primary/50 shadow-lg shadow-primary/10' : ''} ${isSelected ? 'ring-2 ring-primary border-primary' : ''} ${link.isPinned ? 'border-amber-500/50 ring-1 ring-amber-500/30' : ''}`}
          onClick={isSelectionMode ? onToggleSelect : undefined}
        >
        <CardContent className="p-0">
          {/* Pinned indicator with animation */}
          <AnimatePresence>
            {link.isPinned && (
              <motion.div 
                className="absolute top-2 right-2 z-10"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 45 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                <div className="bg-amber-500/20 dark:bg-amber-500/30 backdrop-blur-sm rounded-full p-1">
                  <Pin className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Header Section */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                {/* Selection checkbox - shown in selection mode or on long press */}
                {isSelectionMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect?.();
                    }}
                    className="flex-shrink-0 mt-0.5"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected 
                        ? 'bg-primary border-primary' 
                        : 'border-muted-foreground/30 hover:border-primary'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                )}
                {/* Favicon with status indicator */}
                <div 
                  className="flex-shrink-0 mt-0.5 relative transition-transform duration-200 hover:scale-110 hover:rotate-3"
                >
                  {link.favicon ? (
                    <img
                      src={link.favicon}
                      alt=""
                      className="w-8 h-8 rounded-lg object-cover bg-muted"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${link.favicon ? 'hidden' : ''}`}>
                    <Globe className="w-4 h-4 text-primary" />
                  </div>
                  {/* Status dot overlay */}
                  {status === 'success' && (
                    <span 
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background"
                      title="Indexed - ready for semantic search"
                    />
                  )}
                  {status === 'processing' && (
                    <span 
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-orange-500 rounded-full border-2 border-background animate-pulse"
                      title="Processing content & embeddings..."
                    />
                  )}
                  {status === 'pending' && (
                    <span 
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-gray-400 rounded-full border-2 border-background"
                      title="Awaiting processing"
                    />
                  )}
                  {status === 'failed' && (
                    <span 
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-background"
                      title="Processing failed - try refreshing"
                    />
                  )}
                </div>

                {/* Title and URL */}
                <div className="flex-1 min-w-0">
                  <h3 
                    className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors duration-200"
                    onClick={() => handleOpenLink('direct')}
                    title={link.name}
                  >
                    {link.name}
                  </h3>
                  <p 
                    className="text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors mt-0.5 font-mono text-xs"
                    onClick={() => handleOpenLink('direct')}
                    title={link.url}
                  >
                    {new URL(link.url).hostname}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <div
                  className={`flex gap-0.5 transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyLink}
                    className="h-8 w-8 p-0"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenLink('external')}
                    className="h-8 w-8 p-0"
                    title="Open link"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem onClick={handleTogglePin} className="gap-2">
                      <Pin className={`h-4 w-4 ${link.isPinned ? 'fill-current text-amber-500' : ''}`} />
                      {link.isPinned ? 'Unpin' : 'Pin to Top'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCopyLink} className="gap-2">
                      <Copy className="h-4 w-4" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onEdit(link)} className="gap-2">
                      <Edit className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleRefreshMetadata} disabled={isRefreshing} className="gap-2">
                      <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleDelete} className="text-destructive gap-2">
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>

          {/* Description */}
          {link.description && (
            <div className="px-4 pb-3">
              <p className="text-sm text-muted-foreground line-clamp-2" title={link.description}>
                {link.description}
              </p>
            </div>
          )}

          {/* Metadata Section */}
          {showMetadata && (
            <motion.div 
              className="px-4 pb-3"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-muted/30 rounded-xl p-3 space-y-2 border border-border/50">
                {link.metadata?.title && link.metadata.title !== link.name && (
                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-foreground line-clamp-2" title={link.metadata.title}>
                      {link.metadata.title}
                    </p>
                  </div>
                )}
                
                {link.metadata?.description && link.metadata.description !== link.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2" title={link.metadata.description}>
                    {link.metadata.description}
                  </p>
                )}
                
                {link.metadata?.siteName && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{link.metadata.siteName}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Footer Section */}
          <div className="px-4 pb-4">
            <div className="flex items-center justify-between gap-3">
              {/* Tags and Folder */}
              <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                {/* Folder Badge */}
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

                {/* Tags */}
                {linkTags.slice(0, 2).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs px-2 py-0.5"
                    style={{
                      backgroundColor: `${tag.color}10`,
                      color: tag.color,
                      borderColor: `${tag.color}25`
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {linkTags.length > 2 && (
                  <Badge variant="outline" className="text-xs px-2 py-0.5">
                    +{linkTags.length - 2}
                  </Badge>
                )}
              </div>

              {/* Status indicators and Created Date */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Status indicator */}
                {status === 'success' && (
                  <div 
                    className="flex items-center gap-1.5 text-xs"
                    title="✓ Indexed - ready for semantic search"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-green-500" />
                    </motion.div>
                    <span className="text-green-600 dark:text-green-400 font-medium hidden sm:inline">Indexed</span>
                  </div>
                )}
                {status === 'processing' && (
                  <div 
                    className="flex items-center gap-1.5 text-xs"
                    title="Processing content & embeddings..."
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    >
                      <Loader2 className="w-3.5 h-3.5 text-orange-500" />
                    </motion.div>
                    <span className="text-orange-500 font-medium hidden sm:inline">Processing</span>
                  </div>
                )}
                {status === 'pending' && (
                  <div 
                    className="flex items-center gap-1.5 text-xs"
                    title="Awaiting processing"
                  >
                    <div className="w-3.5 h-3.5 rounded-full bg-gray-400/50 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                    </div>
                    <span className="text-muted-foreground font-medium hidden sm:inline">Pending</span>
                  </div>
                )}
                {status === 'failed' && (
                  <div 
                    className="flex items-center gap-1.5 text-xs"
                    title="Processing failed - try 'Refresh'"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-red-500 font-medium hidden sm:inline">Failed</span>
                  </div>
                )}

                {/* Click count indicator */}
                {(link.clickCount ?? 0) > 0 && (
                  <div 
                    className="flex items-center gap-1 text-xs text-muted-foreground"
                    title={`Opened ${link.clickCount} time${(link.clickCount ?? 0) > 1 ? 's' : ''}`}
                  >
                    <MousePointerClick className="w-3 h-3" />
                    <span>{link.clickCount}</span>
                  </div>
                )}
                
                {/* Created Date */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span title={new Date(link.createdAt).toLocaleString()}>
                    {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
                  </span>
                </div>
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
export const LinkCard = memo(LinkCardComponent, arePropsEqual);
