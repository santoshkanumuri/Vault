'use client';

import React from 'react';
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
import { MoreHorizontal, Edit, Trash2, StickyNote } from 'lucide-react';
import { Note, Folder, Tag } from '@/lib/types';
import { useApp } from '@/contexts/AppContext';

interface NoteCardProps {
  note: Note;
  folder: Folder;
  tags: Tag[];
  onEdit: (note: Note) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({
  note,
  folder,
  tags,
  onEdit,
}) => {
  const { deleteNote } = useApp();

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await deleteNote(note.id);
      } catch (error) {
        console.error('Error deleting note:', error);
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength: number = 150) => {
    if (content.length <= maxLength) return content;
    return content.slice(0, maxLength) + '...';
  };

  return (
    <Card className="group hover:shadow-md transition-all duration-200 cursor-pointer relative">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StickyNote className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <CardTitle className="text-base line-clamp-2 break-words">
              {note.title}
            </CardTitle>
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
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(note)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <CardDescription className="text-xs">
          {formatDate(note.createdAt)}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0" onClick={() => onEdit(note)}>
        {note.content && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-4 whitespace-pre-wrap">
            {truncateContent(note.content)}
          </p>
        )}
        
        <div className="flex items-center justify-between">
          <Badge
            variant="secondary"
            className="text-xs"
            style={{ backgroundColor: `${folder.color}15`, color: folder.color }}
          >
            {folder.name}
          </Badge>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs h-5"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.name}
                </Badge>
              ))}
              {tags.length > 2 && (
                <Badge variant="outline" className="text-xs h-5">
                  +{tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
