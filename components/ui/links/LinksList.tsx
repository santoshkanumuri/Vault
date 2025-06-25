'use client';

import React, { useMemo } from 'react';
import { LinkCard } from './LinkCard';
import { searchLinks } from '@/lib/utils/search';
import { useApp } from '@/contexts/AppContext';
import { Link } from '@/lib/types';

interface LinksListProps {
  onEditLink: (link: Link) => void;
}

export const LinksList: React.FC<LinksListProps> = ({ onEditLink }) => {
  const { links, folders, tags, currentFolder, searchQuery } = useApp();

  const filteredLinks = useMemo(() => {
    let result = links;

    // Filter by folder if selected
    if (currentFolder) {
      result = result.filter(link => link.folderId === currentFolder);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const searchResults = searchLinks(searchQuery, result, folders, tags);
      result = searchResults.map(sr => sr.link);
    }

    // Sort by creation date (newest first)
    return result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [links, folders, tags, currentFolder, searchQuery]);

  if (filteredLinks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          {searchQuery.trim() 
            ? 'No links found matching your search.' 
            : currentFolder 
              ? 'No links in this folder yet.' 
              : 'No links saved yet.'
          }
        </p>
        <p className="text-muted-foreground text-sm mt-2">
          {!searchQuery.trim() && 'Click the "+" button to add your first link.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredLinks.map((link) => {
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
          />
        );
      })}
    </div>
  );
};