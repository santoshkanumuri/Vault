'use client';

import React, { useMemo } from 'react';
import { LinkCard } from './links/LinkCard';
import { NoteCard } from './notes/NoteCard';
import { searchAll } from '@/lib/utils/search';
import { useApp } from '@/contexts/AppContext';
import { Link, Note } from '@/lib/types';

interface CombinedListProps {
  onEditLink: (link: Link) => void;
  onEditNote: (note: Note) => void;
}

export const CombinedList: React.FC<CombinedListProps> = ({ onEditLink, onEditNote }) => {
  const { links, notes, folders, tags, currentFolder, searchQuery } = useApp();

  const filteredItems = useMemo(() => {
    let linkResults = links;
    let noteResults = notes;

    // Filter by folder if selected
    if (currentFolder) {
      linkResults = linkResults.filter(link => link.folderId === currentFolder);
      noteResults = noteResults.filter(note => note.folderId === currentFolder);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchAll(searchQuery, linkResults, noteResults, folders, tags);
      return searchResults;
    }

    // If no search query, combine and sort by date
    const combined = [
      ...linkResults.map(link => ({
        type: 'link' as const,
        item: link,
        relevance: 100,
        matchType: 'name',
        createdAt: link.createdAt,
      })),
      ...noteResults.map(note => ({
        type: 'note' as const,
        item: note,
        relevance: 100,
        matchType: 'title',
        createdAt: note.createdAt,
      })),
    ];

    // Sort by creation date (newest first)
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [links, notes, folders, tags, currentFolder, searchQuery]);

  if (filteredItems.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {searchQuery.trim() 
            ? 'No links or notes found matching your search.' 
            : currentFolder 
              ? 'No links or notes in this folder yet.' 
              : 'No links or notes saved yet.'
          }
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          {!searchQuery.trim() && 'Click the "+" button to add your first link or note.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredItems.map((result, index) => {
        const folder = folders.find(f => f.id === result.item.folderId);
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
            />
          );
        }
      })}
    </div>
  );
};
