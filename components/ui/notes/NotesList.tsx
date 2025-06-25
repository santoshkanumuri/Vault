'use client';

import React, { useMemo } from 'react';
import { NoteCard } from './NoteCard';
import { searchNotes } from '@/lib/utils/search';
import { useApp } from '@/contexts/AppContext';
import { Note } from '@/lib/types';

interface NotesListProps {
  onEditNote: (note: Note) => void;
}

export const NotesList: React.FC<NotesListProps> = ({ onEditNote }) => {
  const { notes, folders, tags, currentFolder, searchQuery } = useApp();

  const filteredNotes = useMemo(() => {
    let result = notes;

    // Filter by folder if selected
    if (currentFolder) {
      result = result.filter(note => note.folderId === currentFolder);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchNotes(searchQuery, result, folders, tags);
      result = searchResults.map(sr => sr.note);
    }

    // Sort by creation date (newest first)
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notes, folders, tags, currentFolder, searchQuery]);

  if (filteredNotes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {searchQuery.trim() 
            ? 'No notes found matching your search.' 
            : currentFolder 
              ? 'No notes in this folder yet.' 
              : 'No notes saved yet.'
          }
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          {!searchQuery.trim() && 'Click the "+" button to add your first note.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredNotes.map((note) => {
        const folder = folders.find(f => f.id === note.folderId);
        const noteTags = tags.filter(t => note.tagIds.includes(t.id));
        
        if (!folder) return null;

        return (
          <NoteCard
            key={note.id}
            note={note}
            folder={folder}
            tags={noteTags}
            onEdit={onEditNote}
          />
        );
      })}
    </div>
  );
};
