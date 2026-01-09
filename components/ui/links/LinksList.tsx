'use client';

import React, { useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import { LinkCard } from './LinkCard';
import { smartSearch } from '@/lib/utils/smart-search';
import { useApp } from '@/contexts/AppContext';
import { Link } from '@/lib/types';
import { EmptyState } from '../animations';
import { LinkIcon, Search, FolderOpen, Plus, Sparkles, Loader2, ArrowUpDown } from 'lucide-react';
import { Button } from '../button';
import { BulkActions } from '../BulkActions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../select';
import { useState } from 'react';

interface LinksListProps {
  onEditLink: (link: Link) => void;
  onAddLink?: () => void;
}

type SortOption = 'newest' | 'oldest' | 'alphabetical';

export const LinksList: React.FC<LinksListProps> = ({ onEditLink, onAddLink }) => {
  const { links, folders, tags, currentFolder, searchQuery, isLoadingMore, hasMoreLinks, loadMoreLinks, deleteLink } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const filteredLinks = useMemo(() => {
    let result = links;

    // Filter by folder if selected
    if (currentFolder) {
      result = result.filter(link => link.folderId === currentFolder);
    }

    // Use smart search if there's a query
    if (searchQuery.trim()) {
      const searchResults = smartSearch(searchQuery, result, [], folders, tags);
      // Filter to only links
      result = searchResults
        .filter(r => r.type === 'link')
        .map(r => r.item as Link);
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        return result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case 'alphabetical':
        return result.sort((a, b) => a.name.localeCompare(b.name));
      case 'newest':
      default:
        return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }, [links, folders, tags, currentFolder, searchQuery, sortBy]);

  if (filteredLinks.length === 0) {
    if (searchQuery.trim()) {
      return (
        <EmptyState
          icon={<Search className="w-10 h-10" />}
          title="No links found"
          description={
            <span>
              We couldn't find any links matching "<strong>{searchQuery}</strong>".
              <br />
              <span className="text-xs mt-2 inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Try: "recent links", "in folder", "#tag"
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
          title="No links in this folder"
          description={`Add your first link to ${folder?.name || 'this folder'}.`}
          action={
            <Button size="sm" className="gap-2" onClick={onAddLink}>
              <Plus className="w-4 h-4" />
              Add Link
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        icon={<LinkIcon className="w-10 h-10" />}
        title="No links yet"
        description="Start saving your favorite websites and resources."
        action={
          <Button size="sm" className="gap-2 shadow-glow-sm" onClick={onAddLink}>
            <Plus className="w-4 h-4" />
            Add your first link
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
  const rowCount = Math.ceil(filteredLinks.length / columnCount);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 220, // Estimated row height (card + gap)
    overscan: 2, // Render 2 extra rows for smooth scrolling
  });

  // Only use virtual scrolling for lists with 20+ items
  const useVirtual = filteredLinks.length >= 20;

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
              Found <strong className="text-foreground">{filteredLinks.length}</strong> link{filteredLinks.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
            </span>
          </motion.div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLinks.map((link, index) => {
            const folder = folders.find(f => f.id === link.folderId);
            const linkTags = tags.filter(t => link.tagIds.includes(t.id));
            
            if (!folder) return null;

                  return (
                    <LinkCard
                      key={link.id}
                      link={link}
                      folder={folder}
                      tags={linkTags}
                      onEdit={onEditLink}
                      index={index}
                      searchQuery={searchQuery}
                      isSelected={selectedIds.has(link.id)}
                      onSelect={(selected) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (selected) {
                            next.add(link.id);
                          } else {
                            next.delete(link.id);
                          }
                          return next;
                        });
                      }}
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
              Found <strong className="text-foreground">{filteredLinks.length}</strong> link{filteredLinks.length !== 1 ? 's' : ''} for "<strong className="text-foreground">{searchQuery}</strong>"
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
                  const linkIndex = virtualRow.index * columnCount + colIndex;
                  const link = filteredLinks[linkIndex];
                  
                  if (!link) return null;
                  
                  const folder = folders.find(f => f.id === link.folderId);
                  const linkTags = tags.filter(t => link.tagIds.includes(t.id));
                  
                  if (!folder) return null;

                  return (
                    <LinkCard
                      key={link.id}
                      link={link}
                      folder={folder}
                      tags={linkTags}
                      onEdit={onEditLink}
                      index={linkIndex}
                      searchQuery={searchQuery}
                      isSelected={selectedIds.has(link.id)}
                      onSelect={(selected) => {
                        setSelectedIds(prev => {
                          const next = new Set(prev);
                          if (selected) {
                            next.add(link.id);
                          } else {
                            next.delete(link.id);
                          }
                          return next;
                        });
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Load More Button */}
      {!searchQuery.trim() && hasMoreLinks && (
        <div className="flex justify-center mt-6">
          <Button
            variant="outline"
            onClick={loadMoreLinks}
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
                Load More Links
              </>
            )}
          </Button>
        </div>
      )}
      
      {/* Bulk Actions */}
      <BulkActions
        selectedIds={selectedIds}
        onDelete={async () => {
          for (const id of selectedIds) {
            await deleteLink(id);
          }
          setSelectedIds(new Set());
        }}
        onClearSelection={() => setSelectedIds(new Set())}
      />
    </div>
  );
};
