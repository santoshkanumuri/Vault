'use client';

import { useEffect } from 'react';

interface KeyboardShortcuts {
  onNewLink?: () => void;
  onNewNote?: () => void;
  onToggleDarkMode?: () => void;
  onOpenSearch?: () => void;
  onCloseDialogs?: () => void;
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcuts) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + N: New link
      if (ctrlOrCmd && e.key === 'n' && !e.shiftKey && shortcuts.onNewLink) {
        e.preventDefault();
        shortcuts.onNewLink();
      }

      // Ctrl/Cmd + Shift + N: New note
      if (ctrlOrCmd && e.shiftKey && e.key === 'N' && shortcuts.onNewNote) {
        e.preventDefault();
        shortcuts.onNewNote();
      }

      // Ctrl/Cmd + D: Toggle dark mode
      if (ctrlOrCmd && e.key === 'd' && shortcuts.onToggleDarkMode) {
        e.preventDefault();
        shortcuts.onToggleDarkMode();
      }

      // Ctrl/Cmd + K: Open search (handled by SearchBar, but we can also trigger it here)
      if (ctrlOrCmd && e.key === 'k' && shortcuts.onOpenSearch) {
        // Don't prevent default - let SearchBar handle it
        shortcuts.onOpenSearch();
      }

      // Escape: Close dialogs
      if (e.key === 'Escape' && shortcuts.onCloseDialogs) {
        shortcuts.onCloseDialogs();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};
