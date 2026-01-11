'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Folder, Tag, Link, Note } from '@/lib/types';
import { useAuth } from './AuthContext';
import * as db from '@/lib/services/database';
import { logger } from '@/lib/utils/logger';
import { withTimeout, TimeoutError } from '@/lib/utils/timeout';
import { batchCheckLinkStatuses, LinkStatus } from '@/lib/utils/link-status';

interface AppContextType {
  folders: Folder[];
  tags: Tag[];
  links: Link[];
  notes: Note[];
  currentFolder: string | null;
  searchQuery: string;
  darkMode: boolean;
  showMetadata: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreLinks: boolean;
  hasMoreNotes: boolean;
  linkStatuses: Map<string, LinkStatus>;
  recentlyCreatedIds: Set<string>;
  setCurrentFolder: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleDarkMode: () => void;
  toggleMetadata: () => void;
  loadMoreLinks: () => Promise<void>;
  loadMoreNotes: () => Promise<void>;
  createFolder: (name: string, color: string) => Promise<Folder>;
  updateFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  createTag: (name: string, color: string) => Promise<Tag>;
  updateTag: (id: string, name: string, color: string) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  createLink: (name: string, url: string, description: string, folderId: string, tagIds: string[]) => Promise<Link>;
  updateLink: (id: string, name: string, url: string, description: string, folderId: string, tagIds: string[]) => Promise<void>;
  deleteLink: (id: string) => Promise<void>;
  refreshLinkMetadata: (id: string) => Promise<void>;
  createNote: (title: string, content: string, folderId: string, tagIds: string[]) => Promise<Note>;
  updateNote: (id: string, title: string, content: string, folderId: string, tagIds: string[]) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refreshNoteContent: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [linkStatuses, setLinkStatuses] = useState<Map<string, LinkStatus>>(new Map());
  const [linksPage, setLinksPage] = useState(1);
  const [notesPage, setNotesPage] = useState(1);
  const [recentlyCreatedIds, setRecentlyCreatedIds] = useState<Set<string>>(new Set());
  const [hasMoreLinks, setHasMoreLinks] = useState(true);
  const [hasMoreNotes, setHasMoreNotes] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Debug logging
  useEffect(() => {
    if (user) {
      console.log('AppContext: User authenticated', { userId: user.id });
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      // Clear data when user logs out
      setFolders([]);
      setTags([]);
      setLinks([]);
      setNotes([]);
    }
  }, [user]);

  // Load theme from localStorage (theme can stay in localStorage as it's a preference)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('vault-theme');
      if (savedTheme === 'dark') {
        setDarkMode(true);
      }
    }
  }, []);

  // Use a ref to track links for polling without causing re-renders
  const linksRef = useRef<Link[]>([]);
  useEffect(() => {
    linksRef.current = links;
  }, [links]);

  // Centralized polling for link processing statuses - only depends on user
  useEffect(() => {
    if (!user) return;

    let isPolling = false; // Prevent concurrent polls

    const pollProcessingStatuses = async () => {
      if (isPolling) return; // Skip if already polling
      isPolling = true;
      
      try {
        // Use ref to get current links without triggering re-renders
        const currentLinks = linksRef.current;
        
        // Only poll for links that haven't been processed yet
        // Check embedding (could be array or pgvector string), wordCount, or fullContent
        const processingLinks = currentLinks.filter(l => {
          const hasEmbedding = l.embedding && (
            (Array.isArray(l.embedding) && l.embedding.length > 0) ||
            (typeof l.embedding === 'string' && l.embedding.length > 10)
          );
          const hasProcessedContent = (l.wordCount && l.wordCount > 0) || (l.fullContent && l.fullContent.length > 0);
          return !hasEmbedding && !hasProcessedContent;
        });
        
        if (processingLinks.length === 0) {
          setLinkStatuses(new Map());
          return;
        }

        const linkIds = processingLinks.map(l => l.id);
        const statuses = await batchCheckLinkStatuses(linkIds, user.id);
        
        // Only update state if statuses actually changed to prevent unnecessary re-renders
        setLinkStatuses(prev => {
          // Compare with previous - if same content, return same reference
          if (prev.size === statuses.size) {
            let isSame = true;
            const statusEntries = Array.from(statuses.entries());
            for (let i = 0; i < statusEntries.length; i++) {
              const [key, value] = statusEntries[i];
              const prevValue = prev.get(key);
              if (!prevValue || 
                  prevValue.hasChunks !== value.hasChunks ||
                  prevValue.isProcessing !== value.isProcessing ||
                  prevValue.isPending !== value.isPending ||
                  prevValue.hasFailed !== value.hasFailed) {
                isSame = false;
                break;
              }
            }
            if (isSame) return prev; // Return same reference - no re-render
          }
          return statuses; // Statuses changed - trigger re-render
        });
      } catch (error) {
        logger.warn('Failed to poll link statuses', { error });
      } finally {
        isPolling = false;
      }
    };

    // Initial poll after a short delay to let the UI settle
    const initialTimeout = setTimeout(pollProcessingStatuses, 1000);

    // Poll every 15 seconds (less frequent to reduce load)
    const interval = setInterval(pollProcessingStatuses, 15000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [user]); // Only depend on user, not links

  const loadData = async (reset: boolean = true) => {
    if (!user) return;

    if (reset) {
      setIsLoading(true);
      setLinksPage(1);
      setNotesPage(1);
    } else {
      setIsLoadingMore(true);
    }

    try {
      logger.info('Loading data from Supabase', { userId: user.id, reset });
      
      const page = reset ? 1 : linksPage;
      const notesPageNum = reset ? 1 : notesPage;
      
      const [foldersData, tagsData, linksResult, notesResult] = await Promise.all([
        db.getFolders(user.id),
        db.getTags(user.id),
        db.getLinks(user.id, page, 50),
        db.getNotes(user.id, notesPageNum, 50)
      ]);

      logger.info('Data loaded', {
        folders: foldersData.length,
        tags: tagsData.length,
        links: linksResult.links.length,
        notes: notesResult.notes.length,
        hasMoreLinks: linksResult.hasMore,
        hasMoreNotes: notesResult.hasMore
      });

      setFolders(foldersData);
      setTags(tagsData);
      
      if (reset) {
        setLinks(linksResult.links);
        setNotes(notesResult.notes);
      } else {
        setLinks(prev => [...prev, ...linksResult.links]);
        setNotes(prev => [...prev, ...notesResult.notes]);
      }
      
      setHasMoreLinks(linksResult.hasMore);
      setHasMoreNotes(notesResult.hasMore);

      // Create default folder if none exist
      if (foldersData.length === 0) {
        await createDefaultFolder();
      }
    } catch (error: any) {
      logger.error('Error loading data from Supabase', { 
        userId: user?.id,
        error: error.message 
      }, error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreLinks = async () => {
    if (!user || isLoadingMore || !hasMoreLinks) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = linksPage + 1;
      const result = await db.getLinks(user.id, nextPage, 50);
      setLinks(prev => [...prev, ...result.links]);
      setHasMoreLinks(result.hasMore);
      setLinksPage(nextPage);
    } catch (error: any) {
      logger.error('Error loading more links', { error: error.message }, error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadMoreNotes = async () => {
    if (!user || isLoadingMore || !hasMoreNotes) return;
    
    setIsLoadingMore(true);
    try {
      const nextPage = notesPage + 1;
      const result = await db.getNotes(user.id, nextPage, 50);
      setNotes(prev => [...prev, ...result.notes]);
      setHasMoreNotes(result.hasMore);
      setNotesPage(nextPage);
    } catch (error: any) {
      logger.error('Error loading more notes', { error: error.message }, error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const createDefaultFolder = async () => {
    if (!user) return;

    try {
      console.log('Creating default folder...');
      const created = await db.createFolder('General', '#6366f1', user.id);
      if (created) {
        console.log('Default folder created:', created);
        setFolders([created]);
      }
    } catch (error) {
      console.error('Error creating default folder:', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('vault-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('vault-theme', 'light');
      }
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const toggleMetadata = () => {
    setShowMetadata(!showMetadata);
  };

  const createFolder = async (name: string, color: string): Promise<Folder> => {
    if (!user) {
      console.error('createFolder: User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
      console.log('createFolder: Creating folder in Supabase...', { name, color, userId: user.id });
      const folder = await db.createFolder(name, color, user.id);
      if (!folder) {
        console.error('createFolder: Database returned null');
        throw new Error('Folder creation failed in database');
      }
      console.log('createFolder: Success, folder:', folder);
      setFolders(prev => [...prev, folder]);
      return folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  };

  const updateFolder = async (id: string, name: string) => {
    try {
      console.log('updateFolder: Updating folder...', { id, name });
      await db.updateFolder(id, name);
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
      console.log('updateFolder: Success');
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      console.log('deleteFolder: Deleting folder...', { id });
      await db.deleteFolder(id);

      // Update local state
      setFolders(prev => prev.filter(f => f.id !== id));
      setLinks(prev => prev.filter(l => l.folderId !== id));
      setNotes(prev => prev.filter(n => n.folderId !== id));

      if (currentFolder === id) {
        setCurrentFolder(null);
      }
      console.log('deleteFolder: Success');
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  };

  const createTag = async (name: string, color: string): Promise<Tag> => {
    if (!user) {
      console.error('createTag: User not authenticated');
      throw new Error('User not authenticated');
    }

    try {
      console.log('createTag: Creating tag in Supabase...', { name, color, userId: user.id });
      const tag = await db.createTag(name, color, user.id);
      if (!tag) {
        console.error('createTag: Database returned null');
        throw new Error('Tag creation failed in database');
      }
      console.log('createTag: Success, tag:', tag);
      setTags(prev => [...prev, tag]);
      return tag;
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  };

  const updateTag = async (id: string, name: string, color: string) => {
    try {
      console.log('updateTag: Updating tag...', { id, name, color });
      await db.updateTag(id, name, color);
      setTags(prev => prev.map(t => t.id === id ? { ...t, name, color } : t));
      console.log('updateTag: Success');
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      console.log('deleteTag: Deleting tag...', { id });
      await db.deleteTag(id);

      // Update local state
      setTags(prev => prev.filter(t => t.id !== id));
      setLinks(prev => prev.map(l => ({
        ...l,
        tagIds: l.tagIds.filter(tagId => tagId !== id)
      })));
      setNotes(prev => prev.map(n => ({
        ...n,
        tagIds: n.tagIds.filter(tagId => tagId !== id)
      })));
      console.log('deleteTag: Success');
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  };

  // Queue link processing tasks (content extraction + embeddings) - runs in background
  const queueLinkProcessingTasks = async (linkId: string, url: string): Promise<void> => {
    if (!user) return;
    
    logger.info('Queueing link processing tasks', { linkId, url });
    
    // Run in background using setTimeout to not block
    setTimeout(async () => {
      try {
        await processLinkContentInBackground(linkId, url);
      } catch (error: any) {
        logger.warn('Background link processing failed', { 
          linkId, 
          error: error.message 
        });
      }
    }, 100);
  };

  const createLink = async (name: string, url: string, description: string, folderId: string, tagIds: string[]): Promise<Link> => {
    if (!user) {
      const error = new Error('User not authenticated');
      console.error('createLink: User not authenticated');
      throw error;
    }

    // Note: Removed global setIsLoading(true) to prevent UI freeze/skeleton flash
    // The link is added optimistically to state immediately after DB creation
    console.log('createLink: Starting...', { name, url, folderId, tagCount: tagIds.length });
    
    try {
      // Create the link IMMEDIATELY with minimal data - don't wait for metadata
      // This makes the UI responsive right away
      console.log('createLink: Creating link in database...');
      
      const linkData = {
        name: name || 'Untitled Link',
        url,
        description: description || '',
        folderId,
        tagIds,
        favicon: null,
        metadata: null,
      };

      // Create the link quickly without waiting for metadata - with timeout
      const dbTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timed out')), 10000);
      });
      
      const link = await Promise.race([
        db.createLink(
          linkData.name,
          linkData.url,
          linkData.description,
          linkData.folderId,
          user.id,
          linkData.tagIds,
          linkData.favicon,
          linkData.metadata
        ),
        dbTimeout
      ]);
      
      console.log('createLink: Database call returned', { link });
      
      if (!link) {
        const error = new Error('Link creation failed in database - null returned');
        console.error('createLink: Failed - null link returned');
        throw error;
      }
      
      console.log('createLink: Success! Link created:', link.id);
      // Optimistically add link to state immediately - no loading state change
      setLinks(prev => {
        console.log('createLink: Adding link to state, current count:', prev.length);
        return [link, ...prev]; // Add to beginning for immediate visibility
      });
      console.log('createLink: Link added to state optimistically');
      
      // Mark as recently created for animation
      setRecentlyCreatedIds(prev => new Set(prev).add(link.id));
      // Clear the "new" flag after 2 seconds
      setTimeout(() => {
        setRecentlyCreatedIds(prev => {
          const next = new Set(prev);
          next.delete(link.id);
          return next;
        });
      }, 2000);
      
      // Fetch metadata in the background and update the link (non-blocking)
      // Use a shorter timeout to prevent hanging
      setTimeout(() => {
        (async () => {
          try {
            // Use a shorter timeout for initial metadata fetch
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds max
            
            const baseUrl = typeof window === 'undefined' 
              ? (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')
              : '';
            
            const response = await fetch(
              `${baseUrl}/api/metadata?url=${encodeURIComponent(url)}`,
              { signal: controller.signal }
            ).finally(() => clearTimeout(timeoutId));
            
            if (response.ok) {
              const metadata = await response.json();
              
              // Update the link with metadata using db.updateLink directly
              await db.updateLink(
                link.id,
                name || metadata.title || link.name,
                url,
                description || metadata.description || link.description,
                folderId,
                tagIds,
                metadata.favicon,
                metadata
              );
              
              // Update local state
              setLinks(prev => prev.map(l => 
                l.id === link.id 
                  ? { 
                      ...l, 
                      name: name || metadata.title || l.name, 
                      description: description || metadata.description || l.description, 
                      favicon: metadata.favicon, 
                      metadata 
                    }
                  : l
              ));
              
              console.log('createLink: Metadata updated in background', { linkId: link.id });
            }
          } catch (err: any) {
            // Silently fail - metadata fetch is optional
            if (err.name !== 'AbortError') {
              logger.warn('createLink: Background metadata fetch failed', { 
                linkId: link.id, 
                error: err.message 
              });
            }
          }
        })().catch(() => {
          // Ignore errors - metadata is optional
        });
      }, 100); // Small delay to ensure main function returns first
      
      // Queue background tasks for server-side processing (full content extraction)
      setTimeout(() => {
        queueLinkProcessingTasks(link.id, url).catch((err) => {
          logger.warn('createLink: Failed to queue background tasks', { 
            linkId: link.id, 
            error: err.message 
          });
        });
      }, 200);
      
      return link;
    } catch (error) {
      console.error('Error creating link:', error);
      // No loading state to reset - operation failed but UI stays responsive
      throw error;
    }
  };

  // Background content processing - completely non-blocking with timeout (DEPRECATED - use queueLinkProcessingTasks)
  const processLinkContentInBackground = async (linkId: string, url: string) => {
    const abortController = new AbortController();
    const timeoutMs = 30000; // 30 seconds timeout (much faster now)
    
    try {
      logger.info('Background: Starting metadata extraction', { linkId, url });
      
      // Fetch metadata only (no full content)
      const metadataPromise = fetch(
        `/api/metadata?url=${encodeURIComponent(url)}`,
        { signal: abortController.signal }
      );
      
      const metadataResponse = await withTimeout(
        metadataPromise,
        timeoutMs,
        'Metadata extraction timed out'
      );
      
      if (!metadataResponse.ok) {
        logger.warn('Background: Failed to fetch metadata', { 
          linkId, 
          status: metadataResponse.status 
        });
        return;
      }
      
      const metadata = await metadataResponse.json();
      
      // Build text for embedding: title + description
      const link = links.find(l => l.id === linkId);
      const title = link?.name || metadata.title || '';
      const description = metadata.description || '';
      const textToEmbed = [title, description].filter(Boolean).join(' ').trim();
      
      if (!textToEmbed || textToEmbed.length < 10) {
        logger.info('Background: Metadata too short, skipping embeddings', { 
          linkId, 
          length: textToEmbed.length 
        });
        return;
      }
      
      logger.info('Background: Metadata extracted, generating embeddings', { 
        linkId,
        textLength: textToEmbed.length 
      });
      
      // Generate embeddings (no chunking for simple metadata)
      const embeddingPromise = fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: [textToEmbed],
          chunk: false, // No chunking for metadata
        }),
        signal: abortController.signal,
      });
      
      const embeddingResponse = await withTimeout(
        embeddingPromise,
        timeoutMs,
        'Embedding generation timed out'
      );
      
      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        logger.warn('Background: Embedding generation failed', { 
          linkId, 
          status: embeddingResponse.status,
          error: errorText 
        });
        return;
      }
      
      const embeddingData = await embeddingResponse.json();
      
      if (!embeddingData.embeddings || embeddingData.embeddings.length === 0) {
        logger.warn('Background: No embeddings returned', { linkId });
        return;
      }
      
      // Get the single embedding (no chunks for metadata-only)
      const embedding = embeddingData.embeddings[0]?.embedding;
      if (!embedding || embedding.length === 0) {
        logger.warn('Background: Invalid embedding returned', { linkId });
        return;
      }
      
      // Save embeddings (no chunks)
      await db.updateLinkEmbeddings(linkId, embedding, []);
      
      // Update local state
      setLinks(prev => prev.map(l => l.id === linkId ? { 
        ...l, 
        embedding: embedding,
        metadata: metadata,
      } : l));
      
      logger.info('Background: SUCCESS! Embeddings saved', { linkId });
    } catch (error: any) {
      if (error.name === 'AbortError' || error instanceof TimeoutError) {
        logger.warn('Background: Metadata processing timed out', { linkId, url });
      } else {
        logger.warn('Background: Metadata processing failed', { 
          linkId, 
          url,
          error: error.message 
        }, error);
      }
      // Silently fail - the link is already created
    } finally {
      abortController.abort();
    }
  };

  const updateLink = async (id: string, name: string, url: string, description: string, folderId: string, tagIds: string[]) => {
    // Note: Removed global setIsLoading(true) to prevent UI freeze
    // Update is applied optimistically to state
    try {
      const existingLink = links.find(l => l.id === id);
      let metadata = existingLink?.metadata;
      let favicon = existingLink?.favicon;
      const urlChanged = existingLink && existingLink.url !== url;

      // If URL changed, fetch new basic metadata (with timeout)
      if (urlChanged) {
        console.log('updateLink: URL changed, fetching new metadata...');
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(
            `/api/metadata?url=${encodeURIComponent(url)}`,
            { signal: controller.signal }
          ).finally(() => clearTimeout(timeoutId));
          
          if (response.ok) {
            const newMetadata = await response.json();
            metadata = newMetadata;
            favicon = newMetadata.favicon;
          }
        } catch (err: any) {
          // Metadata fetch failed - continue with update anyway
          if (err.name !== 'AbortError') {
            logger.warn('updateLink: Metadata fetch failed', { id, error: err.message });
          }
        }
      }

      const linkData = {
        name,
        url,
        description,
        folderId,
        tagIds,
        favicon,
        metadata
      };

      console.log('updateLink: Updating link in Supabase...', { id, linkData });
      
      // Database operation with timeout
      const dbTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database operation timed out')), 10000);
      });
      
      // Optimistically update state BEFORE database call for instant UI feedback
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...linkData } : l));
      console.log('updateLink: State updated optimistically');
      
      // Now persist to database (non-blocking from UI perspective)
      await Promise.race([
        db.updateLink(
          id, 
          linkData.name,
          linkData.url,
          linkData.description,
          linkData.folderId,
          linkData.tagIds,
          linkData.favicon,
          linkData.metadata
        ),
        dbTimeout
      ]);
      console.log('updateLink: Database updated');
      
      // If URL changed, queue re-processing tasks
      if (urlChanged) {
        setTimeout(() => {
          queueLinkProcessingTasks(id, url).catch((err) => {
            logger.warn('updateLink: Failed to queue background tasks', { 
              linkId: id, 
              error: err.message 
            });
          });
        }, 100);
      }
    } catch (error) {
      console.error('Error updating link:', error);
      // Rollback optimistic update on error
      if (user) {
        const originalLinks = await db.getLinks(user.id, 1, 50);
        setLinks(originalLinks.links);
      }
      throw error;
    }
  };

  const deleteLink = async (id: string) => {
    // Don't use global loading for quick delete operations
    try {
      console.log('deleteLink: Deleting link...', { id });
      // Optimistically update UI first
      setLinks(prev => prev.filter(l => l.id !== id));
      await db.deleteLink(id);
      console.log('deleteLink: Success');
    } catch (error) {
      console.error('Error deleting link:', error);
      // Rollback: reload data on error
      if (user) loadData();
      throw error;
    }
  };

  const refreshLinkMetadata = async (id: string) => {
    const link = links.find(l => l.id === id);
    if (!link) return;

    // Don't use global loading - this runs in background
    try {
      console.log('refreshLinkMetadata: Fetching metadata...', { url: link.url });
      
      // Fetch metadata with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(
        `/api/metadata?url=${encodeURIComponent(link.url)}`,
        { signal: controller.signal }
      ).finally(() => clearTimeout(timeoutId));
      
      if (!response.ok) {
        throw new Error('Failed to fetch metadata');
      }
      
      const metadata = await response.json();

      const updatedData = {
        favicon: metadata.favicon,
        metadata
      };

      console.log('refreshLinkMetadata: Updating link...', { id, updatedData });
      await db.updateLink(
        id,
        metadata.title || link.name,
        link.url,
        metadata.description || link.description,
        link.folderId,
        link.tagIds,
        updatedData.favicon,
        updatedData.metadata
      );

      // Generate embeddings from title and description
      const textToEmbed = [
        metadata.title || link.name,
        metadata.description || link.description
      ].filter(Boolean).join(' ').trim();
      
      if (textToEmbed.length >= 10) {
        console.log('refreshLinkMetadata: Generating embeddings...', { id, textLength: textToEmbed.length });
        
        try {
          const embeddingResponse = await fetch('/api/embeddings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              texts: [textToEmbed],
              chunk: false,
            }),
          });
          
          if (embeddingResponse.ok) {
            const embeddingData = await embeddingResponse.json();
            const embedding = embeddingData.embeddings?.[0]?.embedding;
            
            if (embedding && embedding.length > 0) {
              // Save embedding to database
              await db.updateLinkEmbeddings(id, embedding, []);
              
              // Update local state with embedding
              setLinks(prev => prev.map(l => 
                l.id === id 
                  ? { 
                      ...l, 
                      ...updatedData,
                      name: metadata.title || l.name,
                      description: metadata.description || l.description,
                      embedding 
                    }
                  : l
              ));
              console.log('refreshLinkMetadata: Embeddings saved', { id });
              return;
            }
          }
        } catch (embeddingError: any) {
          logger.warn('refreshLinkMetadata: Embedding generation failed', { 
            id, 
            error: embeddingError.message 
          });
        }
      }

      // Update local state without embeddings if embedding generation failed or text too short
      setLinks(prev => prev.map(l => 
        l.id === id 
          ? { 
              ...l, 
              ...updatedData,
              name: metadata.title || l.name,
              description: metadata.description || l.description,
            }
          : l
      ));
      console.log('refreshLinkMetadata: Success');
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      throw error;
    }
  };

  
  // Helper function to calculate average embedding
  const calculateAverageEmbedding = (embeddings: number[][]): number[] => {
    if (embeddings.length === 0) return [];
    
    const dimensions = embeddings[0].length;
    const result = new Array(dimensions).fill(0);
    
    for (const embedding of embeddings) {
      for (let i = 0; i < dimensions; i++) {
        result[i] += embedding[i];
      }
    }
    
    // Normalize
    const magnitude = Math.sqrt(
      result.reduce((sum, val) => sum + (val / embeddings.length) ** 2, 0)
    );
    
    return result.map(val => 
      magnitude > 0 ? (val / embeddings.length) / magnitude : 0
    );
  };

  const createNote = async (title: string, content: string, folderId: string, tagIds: string[]): Promise<Note> => {
    if (!user) throw new Error('User not authenticated');

    // Note: Removed global setIsLoading(true) to prevent UI freeze/skeleton flash
    try {
      console.log('createNote: Creating note in Supabase...', { title, folderId });
      const createdNote = await db.createNote(
        title,
        content,
        folderId,
        tagIds,
        user.id
      );
      
      if (!createdNote) throw new Error('Note creation failed in database');
      
      console.log('createNote: Success, note:', createdNote.id);
      // Optimistically add note to beginning of state for immediate visibility
      setNotes(prev => [createdNote, ...prev]);
      
      // Mark as recently created for animation
      setRecentlyCreatedIds(prev => new Set(prev).add(createdNote.id));
      // Clear the "new" flag after 2 seconds
      setTimeout(() => {
        setRecentlyCreatedIds(prev => {
          const next = new Set(prev);
          next.delete(createdNote.id);
          return next;
        });
      }, 2000);
      
      // Queue embeddings task (server-side processing)
      if (content && content.length > 50) {
        queueNoteEmbeddingsTask(createdNote.id).catch((err) => {
          logger.warn('createNote: Failed to queue embeddings task', { 
            noteId: createdNote.id, 
            error: err.message 
          });
        });
      }
      
      return createdNote;
    } catch (error) {
      console.error('Error creating note:', error);
      // No loading state to reset - operation failed but UI stays responsive
      throw error;
    }
  };

  // Queue note embeddings task (server-side processing)
  const queueNoteEmbeddingsTask = async (noteId: string) => {
    if (!user) return;
    
    try {
      logger.info('Queueing note embeddings task', { noteId });
      
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          taskType: 'note_embeddings',
          entityType: 'note',
          entityId: noteId,
          payload: {},
          priority: 5,
          maxRetries: 3,
        }),
      });
      
      logger.info('Note embeddings task queued', { noteId });
      
      // Trigger worker to process tasks immediately (non-blocking)
      fetch('/api/tasks/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTasks: 5, userId: user.id }),
      }).catch(() => {
        // Worker call is optional
      });
    } catch (error: any) {
      logger.warn('Failed to queue note embeddings task', { 
        noteId, 
        error: error.message 
      });
    }
  };

  const updateNote = async (id: string, title: string, content: string, folderId: string, tagIds: string[]) => {
    // Note: Removed global setIsLoading(true) to prevent UI freeze
    try {
      const existingNote = notes.find(n => n.id === id);
      const contentChanged = existingNote && (existingNote.title !== title || existingNote.content !== content);
      
      const noteData = {
        title,
        content,
        folderId,
        tagIds
      };

      // Optimistically update state BEFORE database call for instant UI feedback
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...noteData } : n));
      console.log('updateNote: State updated optimistically');
      
      // Now persist to database
      console.log('updateNote: Updating note in Supabase...', { id, noteData });
      await db.updateNote(
        id, 
        noteData.title,
        noteData.content,
        noteData.folderId,
        noteData.tagIds
      );
      console.log('updateNote: Database updated');
      
      // Re-generate embeddings in background if content changed
      if (contentChanged && content && content.length > 50) {
        queueNoteEmbeddingsTask(id).catch((err) => {
          logger.warn('updateNote: Failed to queue embeddings task', { 
            noteId: id, 
            error: err.message 
          });
        });
      }
    } catch (error) {
      console.error('Error updating note:', error);
      // Rollback optimistic update on error by reloading
      if (user) loadData();
      throw error;
    }
  };

  // Refresh note embeddings (queues server-side task)
  const refreshNoteContent = async (id: string) => {
    if (!user) throw new Error('User not authenticated');
    
    const note = notes.find(n => n.id === id);
    if (!note) {
      logger.error('refreshNoteContent: Note not found', { id });
      throw new Error('Note not found');
    }

    try {
      logger.info('refreshNoteContent: Queueing refresh task', { id });
      
      // Queue refresh task (server-side processing)
      await queueNoteEmbeddingsTask(id);
      
      // Trigger immediate processing
      await fetch('/api/tasks/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxTasks: 1, userId: user.id }),
      });
      
      logger.info('refreshNoteContent: Task queued', { id });
    } catch (error: any) {
      logger.error('refreshNoteContent: Failed to queue task', { id, error: error.message }, error);
      throw error;
    }
  };

  const deleteNote = async (id: string) => {
    // Don't use global loading for quick delete operations
    try {
      console.log('deleteNote: Deleting note...', { id });
      // Optimistically update UI first
      setNotes(prev => prev.filter(n => n.id !== id));
      await db.deleteNote(id);
      console.log('deleteNote: Success');
    } catch (error) {
      console.error('Error deleting note:', error);
      // Rollback: reload data on error
      if (user) loadData();
      throw error;
    }
  };

  return (
    <AppContext.Provider value={{
      folders,
      tags,
      links,
      notes,
      currentFolder,
      searchQuery,
      darkMode,
      showMetadata,
      isLoading,
      isLoadingMore,
      hasMoreLinks,
      hasMoreNotes,
      linkStatuses,
      recentlyCreatedIds,
      setCurrentFolder,
      setSearchQuery,
      toggleDarkMode,
      toggleMetadata,
      loadMoreLinks,
      loadMoreNotes,
      createFolder,
      updateFolder,
      deleteFolder,
      createTag,
      updateTag,
      deleteTag,
      createLink,
      updateLink,
      deleteLink,
      refreshLinkMetadata,
      createNote,
      updateNote,
      deleteNote,
      refreshNoteContent,
    }}>
      {children}
    </AppContext.Provider>
  );
};
