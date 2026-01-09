'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Sparkles, Link as LinkIcon, FileText, Loader2, Calendar, Folder, Hash, Filter } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from './input';
import { Checkbox } from './checkbox';
import { Button } from './button';
import { Badge } from './badge';
import { Link, Note } from '@/lib/types';
import { smartSearch } from '@/lib/utils/smart-search';

interface SearchResult {
  type: 'link' | 'note';
  item: Link | Note;
  score?: number;
  similarity?: number;
  chunkText?: string;
}

interface SearchPanelProps {
  initialQuery?: string;
  onClose?: () => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({ initialQuery = '', onClose }) => {
  const { user } = useAuth();
  const { links, notes, folders, tags, setSearchQuery, setCurrentFolder } = useApp();
  const [isOpen, setIsOpen] = useState(true);
  const [query, setQuery] = useState(initialQuery);
  const [useSemanticSearch, setUseSemanticSearch] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filters, setFilters] = useState<{
    type?: 'link' | 'note';
    folderId?: string;
    tagId?: string;
    dateRange?: 'today' | 'this-week' | 'this-month';
    hasEmbedding?: boolean;
  }>({});
  
  // Search result cache
  const searchCacheRef = useRef<Map<string, { results: SearchResult[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 60000; // 1 minute
  
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // Update query when initialQuery changes
  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Close with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Apply filters to results
  const applyFilters = useCallback((results: SearchResult[]): SearchResult[] => {
    let filtered = results;
    
    // Type filter
    if (filters.type) {
      filtered = filtered.filter(r => r.type === filters.type);
    }
    
    // Folder filter
    if (filters.folderId) {
      filtered = filtered.filter(r => r.item.folderId === filters.folderId);
    }
    
    // Tag filter
    if (filters.tagId) {
      filtered = filtered.filter(r => {
        if (r.type === 'link') {
          return (r.item as Link).tagIds.includes(filters.tagId!);
        } else {
          return (r.item as Note).tagIds.includes(filters.tagId!);
        }
      });
    }
    
    // Date range filter
    if (filters.dateRange) {
      const now = new Date();
      let startDate: Date;
      
      switch (filters.dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'this-week':
          startDate = new Date(now);
          startDate.setDate(now.getDate() - 7);
          break;
        case 'this-month':
          startDate = new Date(now);
          startDate.setMonth(now.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }
      
      filtered = filtered.filter(r => {
        const createdAt = new Date(r.item.createdAt);
        return createdAt >= startDate && createdAt <= now;
      });
    }
    
    // Has embedding filter
    if (filters.hasEmbedding === true) {
      filtered = filtered.filter(r => {
        if (r.type === 'link') {
          return !!(r.item as Link).embedding && (r.item as Link).embedding!.length > 0;
        } else {
          return !!(r.item as Note).embedding && (r.item as Note).embedding!.length > 0;
        }
      });
    }
    
    return filtered;
  }, [filters]);

  // Perform search with caching
  const performSearch = useCallback(async (searchQuery: string, semantic: boolean) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Check cache
    const cacheKey = `${searchQuery}-${semantic}-${JSON.stringify(filters)}`;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setResults(cached.results);
      return;
    }

    setIsSearching(true);
    try {
      let searchResults: SearchResult[] = [];
      
      if (semantic && user) {
        // Semantic search via API
        const response = await fetch('/api/search/semantic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: searchQuery,
            userId: user.id,
            limit: 50,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          searchResults = (data.results || []).map((r: any) => ({
            type: r.type,
            item: r.item,
            similarity: r.similarity,
            chunkText: r.chunkText,
          }));
        } else {
          // Fallback to keyword search
          const keywordResults = smartSearch(searchQuery, links, notes, folders, tags);
          searchResults = keywordResults.map(r => ({
            type: r.type,
            item: r.item,
            score: r.score,
          }));
        }
      } else {
        // Keyword search
        const keywordResults = smartSearch(searchQuery, links, notes, folders, tags);
        searchResults = keywordResults.map(r => ({
          type: r.type,
          item: r.item,
          score: r.score,
        }));
      }
      
      // Apply filters
      const filteredResults = applyFilters(searchResults);
      
      // Cache results
      searchCacheRef.current.set(cacheKey, {
        results: filteredResults,
        timestamp: Date.now(),
      });
      
      // Clean old cache entries (keep only last 50)
      if (searchCacheRef.current.size > 50) {
        const entries = Array.from(searchCacheRef.current.entries());
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        searchCacheRef.current.clear();
        entries.slice(0, 50).forEach(([key, value]) => {
          searchCacheRef.current.set(key, value);
        });
      }
      
      setResults(filteredResults);
    } catch (error) {
      console.error('Search error:', error);
      // Fallback to keyword search
      const keywordResults = smartSearch(searchQuery, links, notes, folders, tags);
      const filteredResults = applyFilters(keywordResults.map(r => ({
        type: r.type,
        item: r.item,
        score: r.score,
      })));
      setResults(filteredResults);
    } finally {
      setIsSearching(false);
    }
  }, [links, notes, folders, tags, user, applyFilters, filters]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        performSearch(query, useSemanticSearch);
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, useSemanticSearch, filters, performSearch]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && results[selectedIndex]) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelectResult = (result: SearchResult) => {
    if (result.type === 'link') {
      const link = result.item as Link;
      setCurrentFolder(link.folderId);
      setSearchQuery(link.name);
    } else {
      const note = result.item as Note;
      setCurrentFolder(note.folderId);
      setSearchQuery(note.title);
    }
    setIsOpen(false);
  };

  const getResultIcon = (type: 'link' | 'note') => {
    return type === 'link' ? (
      <LinkIcon className="h-4 w-4 text-blue-500" />
    ) : (
      <FileText className="h-4 w-4 text-green-500" />
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] sm:w-full max-w-2xl bg-popover border border-border rounded-lg shadow-2xl z-50 max-h-[80vh] flex flex-col mx-auto"
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search everything..."
                className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-auto text-base"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Filters */}
            <div className="px-4 py-2 border-b border-border space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  Filters:
                </span>
                
                {/* Type Filter */}
                <Badge
                  variant={filters.type === 'link' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, type: prev.type === 'link' ? undefined : 'link' }))}
                >
                  <LinkIcon className="h-3 w-3 mr-1" />
                  Links
                </Badge>
                <Badge
                  variant={filters.type === 'note' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, type: prev.type === 'note' ? undefined : 'note' }))}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Notes
                </Badge>
                
                {/* Date Range Filters */}
                <Badge
                  variant={filters.dateRange === 'today' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: prev.dateRange === 'today' ? undefined : 'today' }))}
                >
                  <Calendar className="h-3 w-3 mr-1" />
                  Today
                </Badge>
                <Badge
                  variant={filters.dateRange === 'this-week' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: prev.dateRange === 'this-week' ? undefined : 'this-week' }))}
                >
                  This Week
                </Badge>
                <Badge
                  variant={filters.dateRange === 'this-month' ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, dateRange: prev.dateRange === 'this-month' ? undefined : 'this-month' }))}
                >
                  This Month
                </Badge>
                
                {/* Folder Filter */}
                {folders.slice(0, 3).map(folder => (
                  <Badge
                    key={folder.id}
                    variant={filters.folderId === folder.id ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => setFilters(prev => ({ ...prev, folderId: prev.folderId === folder.id ? undefined : folder.id }))}
                  >
                    <Folder className="h-3 w-3 mr-1" />
                    {folder.name}
                  </Badge>
                ))}
                
                {/* Has Embedding Filter */}
                <Badge
                  variant={filters.hasEmbedding === true ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => setFilters(prev => ({ ...prev, hasEmbedding: prev.hasEmbedding === true ? undefined : true }))}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Indexed
                </Badge>
                
                {/* Clear Filters */}
                {(filters.type || filters.folderId || filters.tagId || filters.dateRange || filters.hasEmbedding) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters({})}
                    className="h-6 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
              
              {/* Semantic Search Toggle */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="semantic-search"
                  checked={useSemanticSearch}
                  onCheckedChange={(checked) => setUseSemanticSearch(checked === true)}
                />
                <label
                  htmlFor="semantic-search"
                  className="text-sm text-muted-foreground cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Semantic search (compare with chunked embeddings)
                </label>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-2">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    {useSemanticSearch ? 'Searching embeddings...' : 'Searching...'}
                  </span>
                </div>
              ) : results.length === 0 && query.trim() ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  No results found
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  Start typing to search...
                </div>
              ) : (
                <div className="space-y-1">
                  {results.map((result, index) => (
                    <motion.button
                      key={`${result.type}-${result.item.id}`}
                      onClick={() => handleSelectResult(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-start gap-3 ${
                        selectedIndex === index
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted/50'
                      }`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      {getResultIcon(result.type)}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {result.type === 'link' ? (result.item as Link).name : (result.item as Note).title}
                        </div>
                        {result.type === 'link' && (
                          <div className="text-xs text-muted-foreground truncate">
                            {(result.item as Link).url}
                          </div>
                        )}
                        {result.chunkText && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {result.chunkText}
                          </div>
                        )}
                        {(result.score || result.similarity) && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {useSemanticSearch && result.similarity
                              ? `Similarity: ${(result.similarity * 100).toFixed(1)}%`
                              : `Relevance: ${((result.score || 0) * 100).toFixed(1)}%`}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>Enter Select</span>
                <span>Esc Close</span>
              </div>
              <span>Ctrl+K to open</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
