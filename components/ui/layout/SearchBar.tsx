'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Search, X, Clock, Sparkles, Hash, Folder, FileText, Link as LinkIcon } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '../button';
import { getSearchSuggestions } from '@/lib/utils/smart-search';
import { getSearchHistory, saveSearchQuery } from '@/lib/storage';
import { SearchPanel } from '../SearchPanel';

export const SearchBar: React.FC = () => {
  const { searchQuery, setSearchQuery, links, notes, folders, tags } = useApp();
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get search suggestions
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      // Show recent searches when input is empty or short
      const history = getSearchHistory();
      return history.slice(0, 5).map(q => ({ type: 'history' as const, text: q }));
    }
    
    const smartSuggestions = getSearchSuggestions(searchQuery, links, notes, folders, tags);
    return smartSuggestions.map(text => {
      if (text.startsWith('#')) return { type: 'tag' as const, text };
      if (text.startsWith('in "')) return { type: 'folder' as const, text };
      if (text.includes('link') || text.includes('note')) return { type: 'filter' as const, text };
      return { type: 'suggestion' as const, text };
    });
  }, [searchQuery, links, notes, folders, tags]);

  // Handle suggestion selection
  const handleSelectSuggestion = useCallback((text: string) => {
    setSearchQuery(text);
    saveSearchQuery(text);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    inputRef.current?.blur();
  }, [setSearchQuery]);

  // Clear search with keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false);
          setSelectedSuggestionIndex(-1);
        } else if (searchQuery) {
          setSearchQuery('');
          inputRef.current?.blur();
        }
      }
      // Focus search with Cmd+K or Ctrl+K - opens full search panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearchPanel(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchQuery, setSearchQuery, showSuggestions]);

  // Handle input keyboard navigation
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      handleSelectSuggestion(suggestions[selectedSuggestionIndex].text);
    }
  };

  // Handle search submission
  const handleSearchSubmit = useCallback(() => {
    if (searchQuery.trim()) {
      saveSearchQuery(searchQuery.trim());
    }
    setShowSuggestions(false);
  }, [searchQuery]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'history': return <Clock className="h-3.5 w-3.5" />;
      case 'tag': return <Hash className="h-3.5 w-3.5" />;
      case 'folder': return <Folder className="h-3.5 w-3.5" />;
      case 'filter': return <Sparkles className="h-3.5 w-3.5" />;
      default: return <Search className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="relative w-full">
      <motion.div
        className={`relative flex items-center rounded-lg border transition-all duration-200 ${
          isFocused 
            ? 'border-primary/50 ring-2 ring-primary/20 bg-background' 
            : 'border-border/50 bg-muted/30 hover:bg-muted/50'
        }`}
        animate={{ scale: isFocused ? 1.01 : 1 }}
        transition={{ duration: 0.15 }}
      >
        <Search className={`absolute left-3 h-4 w-4 transition-colors ${isFocused ? 'text-primary' : 'text-muted-foreground'}`} />
        <Input
          ref={inputRef}
          placeholder="Search everything..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowSuggestions(true);
            setSelectedSuggestionIndex(-1);
          }}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
            // Open full search panel on focus for better UX
            setShowSearchPanel(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            handleSearchSubmit();
          }}
          onKeyDown={handleInputKeyDown}
          className="pl-9 pr-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-9"
        />
        
        <AnimatePresence>
          {searchQuery && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.1 }}
              className="absolute right-1.5"
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  inputRef.current?.focus();
                }}
                className="h-6 w-6 p-0 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      
      {/* Keyboard hint */}
      <div className="hidden sm:block absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <AnimatePresence>
          {!searchQuery && !isFocused && (
            <motion.kbd 
              className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              ⌘K
            </motion.kbd>
          )}
        </AnimatePresence>
      </div>

      {/* Smart Search Suggestions Dropdown */}
      <AnimatePresence>
        {showSuggestions && suggestions.length > 0 && (
          <motion.div
            ref={suggestionsRef}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50"
          >
            <div className="py-1">
              {/* Smart search hint */}
              <div className="px-3 py-2 border-b border-border/50">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  <span>Smart search: try "recent links", "in folder", "#tag"</span>
                </div>
              </div>
              
              {suggestions.map((suggestion, index) => (
                <motion.button
                  key={`${suggestion.type}-${suggestion.text}`}
                  onClick={() => handleSelectSuggestion(suggestion.text)}
                  onMouseEnter={() => setSelectedSuggestionIndex(index)}
                  className={`w-full px-3 py-2 flex items-center gap-3 text-left transition-colors ${
                    selectedSuggestionIndex === index
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <span className={`flex-shrink-0 ${
                    suggestion.type === 'history' ? 'text-muted-foreground' :
                    suggestion.type === 'tag' ? 'text-primary' :
                    suggestion.type === 'folder' ? 'text-amber-500' :
                    'text-foreground'
                  }`}>
                    {getSuggestionIcon(suggestion.type)}
                  </span>
                  <span className="truncate text-sm">{suggestion.text}</span>
                  {suggestion.type === 'history' && (
                    <span className="ml-auto text-xs text-muted-foreground">Recent</span>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Full Search Panel */}
      {showSearchPanel && (
        <SearchPanel 
          initialQuery={searchQuery}
          onClose={() => {
            setShowSearchPanel(false);
            setIsFocused(false);
            setShowSuggestions(false);
            inputRef.current?.blur();
          }}
        />
      )}
    </div>
  );
};
