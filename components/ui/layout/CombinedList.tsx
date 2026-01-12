'use client';

import React, { useMemo } from 'react';
import { LinkCard } from '../links/LinkCard';
import { NoteCard } from '../notes/NoteCard';
import { searchAll } from '@/lib/utils/search';
import { useApp } from '@/contexts/AppContext';
import { useSelection } from '@/contexts/SelectionContext';
import { Link, Note } from '@/lib/types';

interface CombinedListProps {
  onEditLink: (link: Link) => void;
  onEditNote: (note: Note) => void;
}

export const CombinedList: React.FC<CombinedListProps> = ({ onEditLink, onEditNote }) => {
  const { links, notes, folders, tags, currentFolder, searchQuery } = useApp();
  const { isSelectionMode, toggleSelection, isSelected } = useSelection();

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) {
      // If no search query, show all items sorted by date
      const allItems = [
        ...links.map(link => ({ type: 'link' as const, item: link, createdAt: link.createdAt, isPinned: link.isPinned || false })),
        ...notes.map(note => ({ type: 'note' as const, item: note, createdAt: note.createdAt, isPinned: note.isPinned || false }))
      ];

      let result = allItems;

      // Filter by folder if selected
      if (currentFolder) {
        result = result.filter(item => {
          if (item.type === 'link') {
            return (item.item as Link).folderId === currentFolder;
          } else {
            return (item.item as Note).folderId === currentFolder;
          }
        });
      }

      // Sort: pinned first, then by creation date (newest first)
      return result.sort((a, b) => {
        // Pinned items come first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then sort by date
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
    } else {
      // Use search functionality
      let linksToSearch = links;
      let notesToSearch = notes;

      // Filter by folder if selected
      if (currentFolder) {
        linksToSearch = links.filter(link => link.folderId === currentFolder);
        notesToSearch = notes.filter(note => note.folderId === currentFolder);
      }

      const searchResults = searchAll(searchQuery, linksToSearch, notesToSearch, folders, tags);
      return searchResults.map(result => ({
        type: result.type,
        item: result.item,
        createdAt: result.type === 'link' ? (result.item as Link).createdAt : (result.item as Note).createdAt,
        isPinned: result.type === 'link' ? (result.item as Link).isPinned || false : (result.item as Note).isPinned || false
      }));
    }
  }, [links, notes, folders, tags, currentFolder, searchQuery]);

  if (filteredResults.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {searchQuery.trim() 
            ? 'No items found matching your search.' 
            : currentFolder 
              ? 'No items in this folder yet.' 
              : 'No items saved yet.'
          }
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          {!searchQuery.trim() && 'Click the "+" button to add your first item.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredResults.map((result, index) => {
        const folder = folders.find(f => f.id === (result.type === 'link' ? (result.item as Link).folderId : (result.item as Note).folderId));
        
        if (!folder) return null;

        if (result.type === 'link') {
          const link = result.item as Link;
          const linkTags = tags.filter(t => link.tagIds.includes(t.id));
          
          return (
            <LinkCard
              key={`link-${link.id}`}
              link={link}
              folder={folder}
              tags={linkTags}
              onEdit={onEditLink}
              isSelectionMode={isSelectionMode}
              isSelected={isSelected(link.id)}
              onToggleSelect={() => toggleSelection(link.id, 'link')}
            />
          );
        } else {
          const note = result.item as Note;
          const noteTags = tags.filter(t => note.tagIds.includes(t.id));
          
          return (
            <NoteCard
              key={`note-${note.id}`}
              note={note}
              folder={folder}
              tags={noteTags}
              onEdit={onEditNote}
              isSelectionMode={isSelectionMode}
              isSelected={isSelected(note.id)}
              onToggleSelect={() => toggleSelection(note.id, 'note')}
            />
          );
        }
      })}
    </div>
  );
};
