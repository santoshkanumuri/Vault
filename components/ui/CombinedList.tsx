'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LinkCard } from './links/LinkCard';
import { NoteCard } from './notes/NoteCard';
import { smartSearch } from '@/lib/utils/smart-search';
import { useApp } from '@/contexts/AppContext';
import { Link, Note, Folder, Tag } from '@/lib/types';
import { EmptyState } from './animations';
import { Inbox, Search, FolderOpen, Plus, Sparkles, Pin, Tag as TagIcon } from 'lucide-react';
import { Button } from './button';
import { QuickLookModal } from './QuickLookModal';
import { SerendipityWidget } from './SerendipityWidget';

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
  const { links, notes, folders, tags, currentFolder, currentTag, showPinnedOnly, searchQuery } = useApp();
  
  // Quick Look State
  const [quickLookItem, setQuickLookItem] = React.useState<{ item: Link | Note, type: 'link' | 'note' } | null>(null);

  const handleQuickLook = useCallback((item: Link | Note, type: 'link' | 'note') => {
    setQuickLookItem({ item, type });
  }, []);

  const closeQuickLook = useCallback(() => {
    setQuickLookItem(null);
  }, []);

  const filteredItems = useMemo(() => {
    let linkResults = links;
    let noteResults = notes;

    // Filter by pinned if selected
    if (showPinnedOnly) {
      linkResults = linkResults.filter(link => link.isPinned);
      noteResults = noteResults.filter(note => note.isPinned);
    }

    // Filter by folder if selected
    if (currentFolder) {
      linkResults = linkResults.filter(link => link.folderId === currentFolder);
      noteResults = noteResults.filter(note => note.folderId === currentFolder);
    }

    // Filter by tag if selected
    if (currentTag) {
      linkResults = linkResults.filter(link => link.tagIds.includes(currentTag));
      noteResults = noteResults.filter(note => note.tagIds.includes(currentTag));
    }

    // Use smart search if there's a query
    if (searchQuery.trim()) {
      const searchResults = smartSearch(searchQuery, linkResults, noteResults, folders, tags);
      const results = searchResults.map(result => ({
        type: result.type,
        item: result.item,
        relevance: result.score * 100,
        matchType: result.matchDetails[0]?.field || 'name',
        createdAt: result.item.createdAt,
        isPinned: result.item.isPinned || false,
      }));
      // Still show pinned items first even in search results
      return results.sort((a, b) => {
        // Pinned items first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then by relevance for search
        return b.relevance - a.relevance;
      });
    }

    // If no search query, combine and sort with pinned first
    const combined = [
      ...linkResults.map(link => ({
        type: 'link' as const,
        item: link,
        relevance: 100,
        matchType: 'name',
        createdAt: link.createdAt,
        isPinned: link.isPinned || false,
      })),
      ...noteResults.map(note => ({
        type: 'note' as const,
        item: note,
        relevance: 100,
        matchType: 'title',
        createdAt: note.createdAt,
        isPinned: note.isPinned || false,
      })),
    ];

    // Sort: pinned items first, then by creation date (newest first)
    return combined.sort((a, b) => {
      // Pinned items always come first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      // Within same pin status, sort by date
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [links, notes, folders, tags, currentFolder, currentTag, showPinnedOnly, searchQuery]);

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

  // Count pinned items for section header
  const pinnedCount = useMemo(() => 
    filteredItems.filter(item => item.isPinned).length
  , [filteredItems]);

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

    if (currentTag) {
      const tag = tags.find(t => t.id === currentTag);
      return (
        <EmptyState
          icon={<TagIcon className="w-10 h-10" />}
          title={`No items with "${tag?.name || 'tag'}"`}
          description="Add this tag to your links or notes to see them here."
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

  if (!useVirtual) {
    // For small lists, use regular rendering with layout animations
    return (
      <div>
        {/* Serendipity Widget - Only show on main "All" view with content */}
        {!currentFolder && !currentTag && !showPinnedOnly && !searchQuery.trim() && (links.length > 0 || notes.length > 0) && (
            <SerendipityWidget 
                links={links} 
                notes={notes} 
                onQuickLook={handleQuickLook}
            />
        )}

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
        
        {/* Pinned Section Header */}
        <AnimatePresence mode="popLayout">
          {pinnedCount > 0 && !searchQuery.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="mb-3 overflow-hidden"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                <Pin className="w-3.5 h-3.5 fill-current" />
                <span>Pinned ({pinnedCount})</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <LayoutGroup>
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
            layout
          >
            <AnimatePresence mode="popLayout">
              {filteredItems.map((result, index) => {
                const folder = folderMap.get(result.item.folderId);
            if (!folder) return null;

                // Show divider before first unpinned item after pinned section
                const showDivider = !searchQuery.trim() && 
                  pinnedCount > 0 && 
                  index === pinnedCount;

                if (result.type === 'link') {
                  const link = result.item as Link;
                  const linkTags = getItemTags(link.tagIds);
                  
                  return (
                    <React.Fragment key={`link-${link.id}`}>
                      {showDivider && (
                        <motion.div 
                          className="col-span-full my-2"
                          initial={{ opacity: 0, scaleX: 0 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        >
                          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                        </motion.div>
                      )}
                      <motion.div
                        layout
                        layoutId={`link-${link.id}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ 
                          layout: { type: 'spring', stiffness: 500, damping: 35 },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.2 }
                        }}
                      >
                        <LinkCard
                          link={link}
                          folder={folder}
                          tags={linkTags}
                          onEdit={onEditLink}
                          index={index}
                          searchQuery={searchQuery}
                          onQuickLook={() => handleQuickLook(link, 'link')}
                        />
                      </motion.div>
                    </React.Fragment>
                  );
                } else {
                  const note = result.item as Note;
                  const noteTags = getItemTags(note.tagIds);
                  
                  return (
                    <React.Fragment key={`note-${note.id}`}>
                      {showDivider && (
                        <motion.div 
                          className="col-span-full my-2"
                          initial={{ opacity: 0, scaleX: 0 }}
                          animate={{ opacity: 1, scaleX: 1 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        >
                          <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                        </motion.div>
                      )}
                      <motion.div
                        layout
                        layoutId={`note-${note.id}`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ 
                          layout: { type: 'spring', stiffness: 500, damping: 35 },
                          opacity: { duration: 0.2 },
                          scale: { duration: 0.2 }
                        }}
                      >
                        <NoteCard
                          note={note}
                          folder={folder}
                          tags={noteTags}
                          onEdit={onEditNote}
                          index={index}
                          searchQuery={searchQuery}
                          onQuickLook={() => handleQuickLook(note, 'note')}
                        />
                      </motion.div>
                    </React.Fragment>
                  );
                }
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
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
      >
        {/* Serendipity Widget - Only show on main "All" view with content */}
        {!currentFolder && !currentTag && !showPinnedOnly && !searchQuery.trim() && (links.length > 0 || notes.length > 0) && (
            <SerendipityWidget 
                links={links} 
                notes={notes} 
                onQuickLook={handleQuickLook}
            />
        )}
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
                        onQuickLook={() => handleQuickLook(link, 'link')}
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
                        onQuickLook={() => handleQuickLook(note, 'note')}
                      />
                    );
                  }
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

       <QuickLookModal
        isOpen={!!quickLookItem}
        onClose={closeQuickLook}
        item={quickLookItem?.item || null}
        type={quickLookItem?.type || null}
        folder={quickLookItem ? folderMap.get(quickLookItem.item.folderId) : undefined}
        tags={quickLookItem ? getItemTags(quickLookItem.item.tagIds) : undefined}
      />
    </div>
  );
};
