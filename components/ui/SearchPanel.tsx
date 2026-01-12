'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Sparkles, Link as LinkIcon, FileText, Loader2, ChevronDown, Clock, Trash2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from './input';
import { Button } from './button';
import { Link, Note } from '@/lib/types';
import { smartSearch } from '@/lib/utils/smart-search';
import { getSearchHistory, saveSearchQuery, clearSearchHistory } from '@/lib/storage';

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
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'link' | 'note'>('all');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Search result cache
  const searchCacheRef = useRef<Map<string, { results: SearchResult[]; timestamp: number }>>(new Map());
  const CACHE_TTL = 60000; // 1 minute
  
  const handleClose = () => {
    setIsOpen(false);
    onClose?.();
  };

  // Load search history on open
  useEffect(() => {
    if (isOpen) {
      setSearchHistory(getSearchHistory());
    }
  }, [isOpen]);

  // Save search query when selecting a result
  const handleSelectResult = (result: SearchResult) => {
    if (query.trim()) {
      saveSearchQuery(query.trim());
    }
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

  // Handle selecting from history
  const handleSelectHistory = (historyQuery: string) => {
    setQuery(historyQuery);
    setSelectedIndex(0);
  };

  // Clear search history
  const handleClearHistory = () => {
    clearSearchHistory();
    setSearchHistory([]);
  };

  // Auto focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

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

  // Apply type filter to results
  const applyFilters = useCallback((results: SearchResult[]): SearchResult[] => {
    if (filterType === 'all') return results;
    return results.filter(r => r.type === filterType);
  }, [filterType]);

  // Perform search with caching
  const performSearch = useCallback(async (searchQuery: string, semantic: boolean) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    // Check cache
    const cacheKey = `${searchQuery}-${semantic}-${filterType}`;
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
      
      // Clean old cache entries - remove expired entries first, then keep last 50
      const now = Date.now();
      const entries = Array.from(searchCacheRef.current.entries());
      
      // Filter out expired entries (TTL expired)
      const validEntries = entries.filter(([_, value]) => now - value.timestamp < CACHE_TTL);
      
      // If still over limit, keep only most recent 50
      if (validEntries.length > 50) {
        validEntries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        searchCacheRef.current.clear();
        validEntries.slice(0, 50).forEach(([key, value]) => {
          searchCacheRef.current.set(key, value);
        });
      } else if (validEntries.length < entries.length) {
        // Some entries were expired, rebuild the cache
        searchCacheRef.current.clear();
        validEntries.forEach(([key, value]) => {
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
  }, [links, notes, folders, tags, user, applyFilters, filterType]);

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
  }, [query, useSemanticSearch, filterType, performSearch]);

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

  const getResultIcon = (type: 'link' | 'note') => {
    return type === 'link' ? (
      <LinkIcon className="h-4 w-4 text-blue-500" />
    ) : (
      <FileText className="h-4 w-4 text-green-500" />
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Panel - Centered Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 flex items-center justify-center p-4 z-[100] pointer-events-none"
          >
            <div className="w-full max-w-xl pointer-events-auto">
            <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden max-h-[75vh] flex flex-col">
              {/* Search Input */}
              <div className="flex items-center gap-2 p-3 sm:p-4 border-b border-border">
                <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <Input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIndex(0);
                  }}
                  placeholder="Search links and notes..."
                  className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-auto text-base sm:text-lg px-0"
                />
                {isSearching && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="h-8 w-8 flex-shrink-0 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Quick Filters - Compact */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-1 flex-1">
                  {['all', 'link', 'note'].map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type as 'all' | 'link' | 'note')}
                      className={`px-3 py-1 text-xs sm:text-sm rounded-full transition-colors ${
                        filterType === type
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                      }`}
                    >
                      {type === 'all' ? 'All' : type === 'link' ? 'Links' : 'Notes'}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setUseSemanticSearch(!useSemanticSearch)}
                  className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-full transition-colors ${
                    useSemanticSearch
                      ? 'bg-primary/20 text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">AI</span>
                </button>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {results.length === 0 && query.trim() && !isSearching ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">No results found</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Try different keywords</p>
                  </div>
                ) : results.length === 0 && !query.trim() ? (
                  <div className="py-2">
                    {searchHistory.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between px-3 sm:px-4 py-2">
                          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            Recent searches
                          </span>
                          <button
                            onClick={handleClearHistory}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
                          >
                            <Trash2 className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                        {searchHistory.slice(0, 8).map((historyItem, index) => (
                          <button
                            key={`history-${index}`}
                            onClick={() => handleSelectHistory(historyItem)}
                            className="w-full text-left px-3 sm:px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                          >
                            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm truncate">{historyItem}</span>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                        <Search className="h-10 w-10 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">Search your content</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Type to find links and notes</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-2">
                    {results.slice(0, 20).map((result, index) => (
                      <motion.button
                        key={`${result.type}-${result.item.id}`}
                        onClick={() => handleSelectResult(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                        className={`w-full text-left px-3 sm:px-4 py-3 flex items-start gap-3 transition-colors ${
                          selectedIndex === index
                            ? 'bg-accent'
                            : 'hover:bg-muted/50'
                        }`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.02 }}
                      >
                        <div className={`mt-0.5 flex-shrink-0 ${result.type === 'link' ? 'text-blue-500' : 'text-green-500'}`}>
                          {result.type === 'link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {result.type === 'link' ? (result.item as Link).name : (result.item as Note).title}
                          </p>
                          {result.type === 'link' && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {(result.item as Link).url}
                            </p>
                          )}
                          {result.chunkText && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {result.chunkText}
                            </p>
                          )}
                        </div>
                        {result.similarity && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {(result.similarity * 100).toFixed(0)}%
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer - Hidden on small screens */}
              <div className="hidden sm:flex items-center justify-between px-4 py-2 border-t border-border text-xs text-muted-foreground bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">↵</kbd>
                    Select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
                  Close
                </span>
              </div>
            </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
