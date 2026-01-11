'use client';

import React, { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { NoteCard } from './NoteCard';
import { smartSearch } from '@/lib/utils/smart-search';
import { useApp } from '@/contexts/AppContext';
import { Note } from '@/lib/types';
import { EmptyState } from '../animations';
import { StickyNote, Search, FolderOpen, Plus, Sparkles, Loader2, ArrowUpDown } from 'lucide-react';
import { Button } from '../button';
import { BulkActions } from '../BulkActions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useState } from 'react';

interface NotesListProps {
  onEditNote: (note: Note) => void;
  onAddNote?: () => void;
}

type SortOption = 'newest' | 'oldest' | 'alphabetical';

export const NotesList: React.FC<NotesListProps> = ({ onEditNote, onAddNote }) => {
  const { notes, folders, tags, currentFolder, searchQuery, links, isLoadingMore, hasMoreNotes, loadMoreNotes, deleteNote } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredNotes = useMemo(() => {
    let result = notes;

    // Filter by folder if selected
    if (currentFolder) {
      result = result.filter(note => note.folderId === currentFolder);
    }

    // Use smart search if there's a query
    if (searchQuery.trim()) {
      const searchResults = smartSearch(searchQuery, [], result, folders, tags);
      // Filter to only notes
      result = searchResults
        .filter(r => r.type === 'note')
        .map(r => r.item as Note);
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'alphabetical':
        return result.sort((a, b) => a.title.localeCompare(b.title));
      case 'newest':
      default:
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [notes, folders, tags, currentFolder, searchQuery, sortBy]);

  if (filteredNotes.length === 0) {
    if (searchQuery.trim()) {
      return (
        <EmptyState
          icon={<Search className="w-10 h-10" />}
          title="No notes found"
          description={
            <span>
              We couldn't find any notes matching "<strong>{searchQuery}</strong>".
              <br />
              <span className="text-xs mt-2 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Try: "recent notes", "in folder", "#tag"
              </span>
            </span>
          }
        />
      );
    }

    if (currentFolder) {
      const folder = folders.find(f => f.id === currentFolder);
      return (
        <EmptyState
          icon={<FolderOpen className="w-10 h-10" />}
          title="No notes in this folder"
          description={`Add your first note to ${folder?.name || 'this folder'}.`}
          action={
            <Button size="sm" className="gap-2" onClick={onAddNote}>
              <Plus className="w-4 h-4" />
              Add Note
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<StickyNote className="w-10 h-10" />}
        title="No notes yet"
        description="Capture your thoughts and ideas in a note."
        action={
          <Button size="sm" className="gap-2 shadow-glow-sm" onClick={onAddNote}>
            <Plus className="w-4 h-4" />
            Create your first note
          </Button>
        }
      />
    );
  }

  const parentRef = useRef<HTMLDivElement>(null);
  
  // Calculate grid columns based on screen size
  const getColumnCount = () => {
    if (typeof window === 'undefined') return 3;
    const width = window.innerWidth;
    if (width >= 1280) return 3; // xl
    if (width >= 768) return 2;  // md
    return 1; // sm
  };

  const columnCount = getColumnCount();
  const rowCount = Math.ceil(filteredNotes.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // Estimated row height (card + gap)
    overscan: 2, // Render 2 extra rows for smooth scrolling
  });

  // Only use virtual scrolling for lists with 20+ items
  const useVirtual = filteredNotes.length >= 20;

  if (!useVirtual) {
    // For small lists, use regular rendering
    return (
      <div>
        {/* Show search info when searching */}
        {searchQuery.trim() && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              Found <strong className="text-foreground">{filteredNotes.length}</strong> note{filteredNotes.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
            </span>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredNotes.map((note, index) => {
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
                        index={index}
                        searchQuery={searchQuery}
                      />
                    );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with search info and sort */}
      <div className="mb-4 flex items-center justify-between gap-4">
        {searchQuery.trim() ? (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              Found <strong className="text-foreground">{filteredNotes.length}</strong> note{filteredNotes.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
            </span>
          </motion.div>
        ) : (
          <div />
        )}
        
        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
          <SelectTrigger className="w-[140px] gap-2">
            <ArrowUpDown className="h-4 w-4" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="alphabetical">Alphabetical</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div
        ref={parentRef}
        className="h-full overflow-auto custom-scrollbar"
        style={{ height: 'calc(100vh - 200px)' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 px-1">
                {Array.from({ length: columnCount }).map((_, colIndex) => {
                  const noteIndex = virtualRow.index * columnCount + colIndex;
                  const note = filteredNotes[noteIndex];
                  
                  if (!note) return null;
                  
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
                        index={noteIndex}
                        searchQuery={searchQuery}
                      />
                    );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Load More Button */}
      {!searchQuery.trim() && hasMoreNotes && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={loadMoreNotes}
            disabled={isLoadingMore}
            className="gap-2"
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                Load More Notes
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Bulk Actions */}
      <BulkActions
        selectedIds={selectedIds}
        onDelete={async () => {
          for (const id of Array.from(selectedIds)) {
            await deleteNote(id);
          }
          setSelectedIds(new Set());
        }}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
};
