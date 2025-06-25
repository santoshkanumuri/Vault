'use client';

import React, { useState } from 'react';
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
  Copy
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

interface LinkCardProps {
  link: Link;
  folder: Folder;
  tags: Tag[];
  onEdit: (link: Link) => void;
}

export const LinkCard: React.FC<LinkCardProps> = ({ link, folder, tags, onEdit }) => {
  const { deleteLink, refreshLinkMetadata } = useApp();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this link?')) {
      await deleteLink(link.id);
    }
  };

  const handleRefreshMetadata = async () => {
    setIsRefreshing(true);
    try {
      await refreshLinkMetadata(link.id);
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
      toast({
        title: "Link copied!",
        description: "The link has been copied to your clipboard.",
      });
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = link.url;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast({
          title: "Link copied!",
          description: "The link has been copied to your clipboard.",
        });
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

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-border">
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="p-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Favicon */}
              <div className="flex-shrink-0 mt-1">
                {link.favicon ? (
                  <img
                    src={link.favicon}
                    alt=""
                    className="w-5 h-5 rounded-sm object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-5 h-5 rounded-sm bg-muted flex items-center justify-center ${link.favicon ? 'hidden' : ''}`}>
                  <Globe className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>

              {/* Title and URL */}
              <div className="flex-1 min-w-0">
                <h3 
                  className="font-semibold text-foreground line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                  onClick={handleOpenLink}
                  title={link.name}
                >
                  {link.name}
                </h3>
                <p 
                  className="text-sm text-muted-foreground truncate cursor-pointer hover:text-foreground transition-colors mt-1"
                  onClick={handleOpenLink}
                  title={link.url}
                >
                  {link.url}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyLink}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                title="Copy link"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenLink}
                className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                title="Open link"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(link)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleRefreshMetadata} disabled={isRefreshing}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh Metadata
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
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
          <div className="px-4 pb-3">
            <div className="bg-muted/30 rounded-lg p-3 space-y-2">
              {link.metadata?.title && link.metadata.title !== link.name && (
                <div className="flex items-start gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground line-clamp-2" title={link.metadata.title}>
                    {link.metadata.title}
                  </p>
                </div>
              )}
              
              {link.metadata?.description && link.metadata.description !== link.description && (
                <p className="text-xs text-muted-foreground line-clamp-3" title={link.metadata.description}>
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
          </div>
        )}

        {/* Footer Section */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between gap-3">
            {/* Tags and Folder */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {/* Folder Badge */}
              <Badge 
                variant="secondary" 
                className="text-xs px-2 py-1 flex-shrink-0"
                style={{ 
                  backgroundColor: `${folder.color}20`,
                  color: folder.color,
                  borderColor: `${folder.color}40`
                }}
              >
                {folder.name}
              </Badge>

              {/* Tags */}
              <div className="flex items-center gap-1 flex-wrap min-w-0">
                {linkTags.slice(0, 3).map(tag => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-xs px-2 py-1 flex-shrink-0"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      borderColor: `${tag.color}30`
                    }}
                  >
                    {tag.name}
                  </Badge>
                ))}
                {linkTags.length > 3 && (
                  <Badge variant="outline" className="text-xs px-2 py-1 flex-shrink-0">
                    +{linkTags.length - 3}
                  </Badge>
                )}
              </div>
            </div>

            {/* Created Date */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Calendar className="w-3 h-3" />
              <span title={new Date(link.createdAt).toLocaleString()}>
                {formatDistanceToNow(new Date(link.createdAt), { addSuffix: true })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};