import { User, Folder, Tag, Link, Note } from './types';

const STORAGE_KEYS = {
  USER: 'link_saver_user',
  FOLDERS: 'link_saver_folders',
  TAGS: 'link_saver_tags',
  LINKS: 'link_saver_links',
  NOTES: 'link_saver_notes',
  THEME: 'link_saver_theme',
} as const;

// User Storage
export const saveUser = (user: User) => {
  localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
};

export const getUser = (): User | null => {
  const user = localStorage.getItem(STORAGE_KEYS.USER);
  return user ? JSON.parse(user) : null;
};

export const removeUser = () => {
  localStorage.removeItem(STORAGE_KEYS.USER);
};

// Folders Storage
export const saveFolders = (folders: Folder[]) => {
  localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
};

export const getFolders = (): Folder[] => {
  const folders = localStorage.getItem(STORAGE_KEYS.FOLDERS);
  return folders ? JSON.parse(folders) : [];
};

// Tags Storage
export const saveTags = (tags: Tag[]) => {
  localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(tags));
};

export const getTags = (): Tag[] => {
  const tags = localStorage.getItem(STORAGE_KEYS.TAGS);
  return tags ? JSON.parse(tags) : [];
};

// Links Storage
export const saveLinks = (links: Link[]) => {
  localStorage.setItem(STORAGE_KEYS.LINKS, JSON.stringify(links));
};

export const getLinks = (): Link[] => {
  const links = localStorage.getItem(STORAGE_KEYS.LINKS);
  return links ? JSON.parse(links) : [];
};

// Notes Storage
export const saveNotes = (notes: Note[]) => {
  localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
};

export const getNotes = (): Note[] => {
  const notes = localStorage.getItem(STORAGE_KEYS.NOTES);
  return notes ? JSON.parse(notes) : [];
};

// Theme Storage
export const saveTheme = (isDark: boolean) => {
  localStorage.setItem(STORAGE_KEYS.THEME, JSON.stringify(isDark));
};

export const getTheme = (): boolean => {
  const theme = localStorage.getItem(STORAGE_KEYS.THEME);
  return theme ? JSON.parse(theme) : false;
};