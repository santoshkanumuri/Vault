'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  CheckSquare,
  Square
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
import { formatDistanceToNow } from 'date-fns';
import { LinkStatus } from '@/lib/utils/link-status';

interface LinkCardProps {
  link: Link;
  folder: Folder;
  tags: Tag[];
  onEdit: (link: Link) => void;
  index?: number;
  searchQuery?: string;
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({ link, folder, tags, onEdit, index = 0, searchQuery = '', isSelected = false, onSelect }) => {
  const { deleteLink, refreshLinkMetadata, linkStatuses } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
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

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this link?')) {
      await deleteLink(link.id);
    }
  };

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

  const handleOpenLink = () => {
    window.open(link.url, '_blank', 'noopener,noreferrer');
  };

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

  const linkTags = tags.filter(tag => link.tagIds.includes(tag.id));
  const showMetadata = user?.showMetadata && link.metadata;
  
  // Only animate entrance for first 20 items to reduce lag
  const shouldAnimate = index < 20;

  return (
    <motion.div
      initial={shouldAnimate ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={shouldAnimate ? { 
        type: 'spring', 
        stiffness: 400, 
        damping: 30,
        delay: index * 0.02,
      } : { duration: 0 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
    >
      <Card className={`group overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-200 hover:shadow-lg dark:hover:shadow-primary/5 ${isSelected ? 'ring-2 ring-primary' : ''}`}>
        <CardContent className="p-0">
          {/* Header Section */}
          <div className="p-4 pb-3">
            <div className="flex items-start justify-between gap-3">
              {/* Selection Checkbox */}
              {onSelect && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(!isSelected);
                  }}
                  className="mt-0.5 flex-shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5 text-primary" />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
                  )}
                </button>
              )}
              <div className="flex items-start gap-3 flex-1 min-w-0">
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
                    onClick={handleOpenLink}
                    title={link.name}
                  >
                    {link.name}
                  </h3>
                  <p 
                    className="text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors mt-0.5 font-mono text-xs"
                    onClick={handleOpenLink}
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
                    onClick={handleOpenLink}
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
  );
};
