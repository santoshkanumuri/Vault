'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Folder, Tag, Link, Note } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getFolders, getTags, getLinks, getNotes, saveFolders, saveTags, saveLinks, saveNotes, getTheme, saveTheme } from '@/lib/storage';
import { generateRandomColor } from '@/lib/utils/colors';
import { fetchLinkMetadata } from '@/lib/utils/metadata';
import { useAuth } from './AuthContext';
import * as db from '@/lib/services/database';

interface AppContextType {
  folders: Folder[];
  tags: Tag[];
  links: Link[];
  notes: Note[];
  currentFolder: string | null;
  searchQuery: string;
  darkMode: boolean;
  showMetadata: boolean;
  setCurrentFolder: (folderId: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleDarkMode: () => void;
  toggleMetadata: () => void;
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

  const useDatabase = isSupabaseConfigured();

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, useDatabase]);

  const loadData = async () => {
    if (!user) return;

    try {
      if (useDatabase) {
        // Load from Supabase
        const [foldersData, tagsData, linksData, notesData] = await Promise.all([
          db.getFolders(user.id),
          db.getTags(user.id),
          db.getLinks(user.id),
          db.getNotes(user.id)
        ]);
        
        setFolders(foldersData);
        setTags(tagsData);
        setLinks(linksData);
        setNotes(notesData);
        
        // Create default folder if none exist
        if (foldersData.length === 0) {
          await createDefaultFolder();
        }
      } else {
        // Load from localStorage
        const savedFolders = getFolders().filter(f => f.userId === user.id);
        const savedTags = getTags().filter(t => t.userId === user.id);
        const savedLinks = getLinks().filter(l => l.userId === user.id);
        const savedNotes = getNotes().filter(n => n.userId === user.id);
        
        setFolders(savedFolders);
        setTags(savedTags);
        setLinks(savedLinks);
        setNotes(savedNotes);
        
        // Create default folder if none exist
        if (savedFolders.length === 0) {
          await createDefaultFolder();
        }
      }

      const savedTheme = getTheme();
      setDarkMode(savedTheme);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const createDefaultFolder = async () => {
    if (!user) return;
    
    const defaultFolder: Folder = {
      id: Date.now().toString(),
      name: 'General',
      color: generateRandomColor(),
      createdAt: new Date().toISOString(),
      userId: user.id,
    };

    try {
      if (useDatabase) {
        const created = await db.createFolder(defaultFolder.name, defaultFolder.color, user.id);
        if (created) setFolders([created]);
      } else {
        setFolders([defaultFolder]);
        saveFolders([...getFolders(), defaultFolder]);
      }
    } catch (error) {
      console.error('Error creating default folder:', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    saveTheme(newDarkMode);
  };

  const toggleMetadata = () => {
    setShowMetadata(!showMetadata);
  };

  const createFolder = async (name: string, color: string): Promise<Folder> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      if (useDatabase) {
        const folder = await db.createFolder(name, color, user.id);
        if (!folder) throw new Error('Folder creation failed in database');
        setFolders(prev => [...prev, folder]);
        return folder;
      } else {
        const folder: Folder = {
          id: Date.now().toString(),
          name,
          color,
          createdAt: new Date().toISOString(),
          userId: user.id,
        };
        
        const newFolders = [...folders, folder];
        setFolders(newFolders);
        saveFolders([...getFolders(), folder]);
        return folder;
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  };

  const updateFolder = async (id: string, name: string) => {
    try {
      if (useDatabase) {
        await db.updateFolder(id, name);
      } else {
        const allFolders = getFolders().map(f => f.id === id ? { ...f, name } : f);
        saveFolders(allFolders);
      }
      
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    } catch (error) {
      console.error('Error updating folder:', error);
      throw error;
    }
  };

  const deleteFolder = async (id: string) => {
    try {
      if (useDatabase) {
        await db.deleteFolder(id);
      } else {
        // For localStorage, we need to handle cascading deletes manually
        const allFolders = getFolders().filter(f => f.id !== id);
        saveFolders(allFolders);
        
        // Remove links in this folder
        const allLinks = getLinks().filter(l => l.folderId !== id);
        saveLinks(allLinks);
        
        // Remove notes in this folder
        const allNotes = getNotes().filter(n => n.folderId !== id);
        saveNotes(allNotes);
      }
      
      // Update local state
      setFolders(prev => prev.filter(f => f.id !== id));
      setLinks(prev => prev.filter(l => l.folderId !== id));
      setNotes(prev => prev.filter(n => n.folderId !== id));
      
      if (currentFolder === id) {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw error;
    }
  };

  const createTag = async (name: string, color: string): Promise<Tag> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      if (useDatabase) {
        const tag = await db.createTag(name, color, user.id);
        if (!tag) throw new Error('Tag creation failed in database');
        setTags(prev => [...prev, tag]);
        return tag;
      } else {
        const tag: Tag = {
          id: Date.now().toString(),
          name,
          color,
          createdAt: new Date().toISOString(),
          userId: user.id,
        };
        
        const newTags = [...tags, tag];
        setTags(newTags);
        saveTags([...getTags(), tag]);
        return tag;
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      throw error;
    }
  };

  const updateTag = async (id: string, name: string, color: string) => {
    try {
      if (useDatabase) {
        await db.updateTag(id, name, color);
      } else {
        const allTags = getTags().map(t => t.id === id ? { ...t, name, color } : t);
        saveTags(allTags);
      }
      
      setTags(prev => prev.map(t => t.id === id ? { ...t, name, color } : t));
    } catch (error) {
      console.error('Error updating tag:', error);
      throw error;
    }
  };

  const deleteTag = async (id: string) => {
    try {
      if (useDatabase) {
        await db.deleteTag(id);
      } else {
        // For localStorage, handle cascading updates manually
        const allTags = getTags().filter(t => t.id !== id);
        saveTags(allTags);
        
        // Remove tag from all links
        const allLinks = getLinks().map(l => ({
          ...l,
          tagIds: l.tagIds.filter(tagId => tagId !== id)
        }));
        saveLinks(allLinks);
        
        // Remove tag from all notes
        const allNotes = getNotes().map(n => ({
          ...n,
          tagIds: n.tagIds.filter(tagId => tagId !== id)
        }));
        saveNotes(allNotes);
      }
      
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
    } catch (error) {
      console.error('Error deleting tag:', error);
      throw error;
    }
  };

  const createLink = async (name: string, url: string, description: string, folderId: string, tagIds: string[]): Promise<Link> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      // Fetch metadata for the link
      const metadata = await fetchLinkMetadata(url);
      
      const linkData = {
        name: name || metadata.title || 'Untitled Link',
        url,
        description: description || metadata.description || '',
        folderId,
        tagIds,
        favicon: metadata.favicon,
        metadata,
      };

      if (useDatabase) {
        const link = await db.createLink(
          linkData.name,
          linkData.url,
          linkData.description,
          linkData.folderId,
          user.id,
          linkData.tagIds,
          linkData.favicon,
          linkData.metadata
        );
        if (!link) throw new Error('Link creation failed in database');
        setLinks(prev => [...prev, link]);
        return link;
      } else {
        const link: Link = {
          id: Date.now().toString(),
          ...linkData,
          createdAt: new Date().toISOString(),
          userId: user.id,
        };
        
        const newLinks = [...links, link];
        setLinks(newLinks);
        saveLinks([...getLinks(), link]);
        return link;
      }
    } catch (error) {
      console.error('Error creating link:', error);
      throw error;
    }
  };

  const updateLink = async (id: string, name: string, url: string, description: string, folderId: string, tagIds: string[]) => {
    try {
      const existingLink = links.find(l => l.id === id);
      let metadata = existingLink?.metadata;
      let favicon = existingLink?.favicon;
      
      // If URL changed, fetch new metadata
      if (existingLink && existingLink.url !== url) {
        const newMetadata = await fetchLinkMetadata(url);
        metadata = newMetadata;
        favicon = newMetadata.favicon;
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

      if (useDatabase) {
        await db.updateLink(
          id, 
          linkData.name,
          linkData.url,
          linkData.description,
          linkData.folderId,
          linkData.tagIds,
          linkData.favicon,
          linkData.metadata
        );
      } else {
        const allLinks = getLinks().map(l => l.id === id ? { ...l, ...linkData } : l);
        saveLinks(allLinks);
      }
      
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...linkData } : l));
    } catch (error) {
      console.error('Error updating link:', error);
      throw error;
    }
  };

  const deleteLink = async (id: string) => {
    try {
      if (useDatabase) {
        await db.deleteLink(id);
      } else {
        const allLinks = getLinks().filter(l => l.id !== id);
        saveLinks(allLinks);
      }
      
      setLinks(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting link:', error);
      throw error;
    }
  };

  const refreshLinkMetadata = async (id: string) => {
    const link = links.find(l => l.id === id);
    if (!link) return;
    
    try {
      const metadata = await fetchLinkMetadata(link.url);
      
      const updatedData = {
        favicon: metadata.favicon,
        metadata
      };

      if (useDatabase) {
        await db.updateLink(
          id,
          link.name,
          link.url,
          link.description,
          link.folderId,
          link.tagIds,
          updatedData.favicon,
          updatedData.metadata
          );
      } else {
        const allLinks = getLinks().map(l => l.id === id ? { ...l, ...updatedData } : l);
        saveLinks(allLinks);
      }
      
      setLinks(prev => prev.map(l => l.id === id ? { ...l, ...updatedData } : l));
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
    }
  };

  const createNote = async (title: string, content: string, folderId: string, tagIds: string[]): Promise<Note> => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const note: Note = {
        id: Date.now().toString(),
        title,
        content,
        folderId,
        tagIds,
        createdAt: new Date().toISOString(),
        userId: user.id,
      };

      if (useDatabase) {
        const createdNote = await db.createNote(
          note.title,
          note.content,
          note.folderId,
          note.tagIds,
          user.id
        );
        if (!createdNote) throw new Error('Note creation failed in database');
        setNotes(prev => [...prev, createdNote]);
        return createdNote;
      } else {
        setNotes(prev => [...prev, note]);
        saveNotes([...getNotes(), note]);
        return note;
      }
    } catch (error) {
      console.error('Error creating note:', error);
      throw error;
    }
  };

  const updateNote = async (id: string, title: string, content: string, folderId: string, tagIds: string[]) => {
    try {
      const noteData = {
        title,
        content,
        folderId,
        tagIds
      };

      if (useDatabase) {
        await db.updateNote(
          id, 
          noteData.title,
          noteData.content,
          noteData.folderId,
          noteData.tagIds
        );
      } else {
        const allNotes = getNotes().map(n => n.id === id ? { ...n, ...noteData } : n);
        saveNotes(allNotes);
      }
      
      setNotes(prev => prev.map(n => n.id === id ? { ...n, ...noteData } : n));
    } catch (error) {
      console.error('Error updating note:', error);
      throw error;
    }
  };

  const deleteNote = async (id: string) => {
    try {
      if (useDatabase) {
        await db.deleteNote(id);
      } else {
        const allNotes = getNotes().filter(n => n.id !== id);
        saveNotes(allNotes);
      }
      
      setNotes(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting note:', error);
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
      setCurrentFolder,
      setSearchQuery,
      toggleDarkMode,
      toggleMetadata,
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
    }}>
      {children}
    </AppContext.Provider>
  );
};