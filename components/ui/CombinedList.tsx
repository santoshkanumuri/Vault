'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LinkCard } from './links/LinkCard';
import { NoteCard } from './notes/NoteCard';
import { smartSearch } from '@/lib/utils/smart-search';
import { useApp } from '@/contexts/AppContext';
import { Link, Note, Folder, Tag } from '@/lib/types';
import { EmptyState } from './animations';
import { Inbox, Search, FolderOpen, Plus, Sparkles } from 'lucide-react';
import { Button } from './button';

interface CombinedListProps {
  onEditLink: (link: Link) => void;
  onEditNote: (note: Note) => void;
  onAddLink?: () => void;
  onAddNote?: () => void;
}

export const CombinedList: React.FC<CombinedListProps> = ({ 
  onEditLink, 
  onEditNote,
  onAddLink,
  onAddNote 
}) => {
  const { links, notes, folders, tags, currentFolder, searchQuery } = useApp();

  const filteredItems = useMemo(() => {
    let linkResults = links;
    let noteResults = notes;

    // Filter by folder if selected
    if (currentFolder) {
      linkResults = linkResults.filter(link => link.folderId === currentFolder);
      noteResults = noteResults.filter(note => note.folderId === currentFolder);
    }

    // Use smart search if there's a query
    if (searchQuery.trim()) {
      const searchResults = smartSearch(searchQuery, linkResults, noteResults, folders, tags);
      return searchResults.map(result => ({
        type: result.type,
        item: result.item,
        relevance: result.score * 100,
        matchType: result.matchDetails[0]?.field || 'name',
        createdAt: result.item.createdAt,
      }));
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

  // Create stable lookup maps for folders and tags to prevent new object references
  const folderMap = useMemo(() => {
    const map = new Map<string, Folder>();
    folders.forEach(f => map.set(f.id, f));
    return map;
  }, [folders]);

  const tagMap = useMemo(() => {
    const map = new Map<string, Tag>();
    tags.forEach(t => map.set(t.id, t));
    return map;
  }, [tags]);

  // Memoized function to get tags for an item - returns stable reference if tags haven't changed
  const getItemTags = useCallback((tagIds: string[]): Tag[] => {
    return tagIds.map(id => tagMap.get(id)).filter((t): t is Tag => t !== undefined);
  }, [tagMap]);

  if (filteredItems.length === 0) {
    if (searchQuery.trim()) {
      return (
        <EmptyState
          icon={<Search className="w-10 h-10" />}
          title="No results found"
          description={
            <span>
              We couldn't find anything matching "<strong>{searchQuery}</strong>". 
              <br />
              <span className="text-xs mt-2 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Try: "recent links", "in folder", "#tag", or different keywords
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
          title={`${folder?.name || 'Folder'} is empty`}
          description="Start organizing by adding your first link or note to this folder."
          action={
            <div className="flex gap-2">
              <Button size="sm" className="gap-2" onClick={onAddLink}>
                <Plus className="w-4 h-4" />
                Add Link
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={onAddNote}>
                <Plus className="w-4 h-4" />
                Add Note
              </Button>
            </div>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<Inbox className="w-10 h-10" />}
        title="Your vault awaits"
        description="Save your first link or note to start building your personal knowledge base."
        action={
          <div className="flex gap-2">
            <Button size="sm" className="gap-2 shadow-glow-sm" onClick={onAddLink}>
              <Plus className="w-4 h-4" />
              Add Link
            </Button>
            <Button size="sm" variant="outline" className="gap-2" onClick={onAddNote}>
              <Plus className="w-4 h-4" />
              Add Note
            </Button>
          </div>
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
  const rowCount = Math.ceil(filteredItems.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // Estimated row height (card + gap)
    overscan: 2, // Render 2 extra rows for smooth scrolling
  });

  // Only use virtual scrolling for lists with 20+ items
  const useVirtual = filteredItems.length >= 20;

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
              Found <strong className="text-foreground">{filteredItems.length}</strong> result{filteredItems.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
            </span>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((result, index) => {
            const folder = folderMap.get(result.item.folderId);
            if (!folder) return null;

            if (result.type === 'link') {
              const link = result.item as Link;
              const linkTags = getItemTags(link.tagIds);
              
              return (
                <LinkCard
                  key={`link-${link.id}`}
                  link={link}
                  folder={folder}
                  tags={linkTags}
                  onEdit={onEditLink}
                  index={index}
                  searchQuery={searchQuery}
                />
              );
            } else {
              const note = result.item as Note;
              const noteTags = getItemTags(note.tagIds);
              
              return (
                <NoteCard
                  key={`note-${note.id}`}
                  note={note}
                  folder={folder}
                  tags={noteTags}
                  onEdit={onEditNote}
                  index={index}
                  searchQuery={searchQuery}
                />
              );
            }
          })}
        </div>
      </div>
    );
  }

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
            Found <strong className="text-foreground">{filteredItems.length}</strong> result{filteredItems.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
          </span>
        </motion.div>
      )}
      
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
                  const itemIndex = virtualRow.index * columnCount + colIndex;
                  const result = filteredItems[itemIndex];
                  
                  if (!result) return null;
                  
                  const folder = folderMap.get(result.item.folderId);
                  if (!folder) return null;

                  if (result.type === 'link') {
                    const link = result.item as Link;
                    const linkTags = getItemTags(link.tagIds);
                    
                    return (
                      <LinkCard
                        key={`link-${link.id}`}
                        link={link}
                        folder={folder}
                        tags={linkTags}
                        onEdit={onEditLink}
                        index={itemIndex}
                        searchQuery={searchQuery}
                      />
                    );
                  } else {
                    const note = result.item as Note;
                    const noteTags = getItemTags(note.tagIds);
                    
                    return (
                      <NoteCard
                        key={`note-${note.id}`}
                        note={note}
                        folder={folder}
                        tags={noteTags}
                        onEdit={onEditNote}
                        index={itemIndex}
                        searchQuery={searchQuery}
                      />
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
