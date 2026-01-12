'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

type SelectableItemType = 'link' | 'note';

interface SelectionItem {
  id: string;
  type: SelectableItemType;
}

interface SelectionContextType {
  selectedItems: Map<string, SelectableItemType>;
  isSelectionMode: boolean;
  toggleSelection: (id: string, type: SelectableItemType) => void;
  selectAll: (items: SelectionItem[]) => void;
  clearSelection: () => void;
  isSelected: (id: string) => boolean;
  getSelectedByType: (type: SelectableItemType) => string[];
  enterSelectionMode: () => void;
  exitSelectionMode: () => void;
}

const SelectionContext = createContext<SelectionContextType | undefined>(undefined);

export const useSelection = () => {
  const context = useContext(SelectionContext);
  if (context === undefined) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
};

export const SelectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectableItemType>>(new Map());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  const toggleSelection = useCallback((id: string, type: SelectableItemType) => {
    setSelectedItems(prev => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
        // Exit selection mode if no items selected
        if (next.size === 0) {
          setIsSelectionMode(false);
        }
      } else {
        next.set(id, type);
        // Enter selection mode when first item selected
        if (!isSelectionMode) {
          setIsSelectionMode(true);
        }
      }
      return next;
    });
  }, [isSelectionMode]);

  const selectAll = useCallback((items: SelectionItem[]) => {
    setSelectedItems(new Map(items.map(item => [item.id, item.type])));
    if (items.length > 0) {
      setIsSelectionMode(true);
    }
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Map());
    setIsSelectionMode(false);
  }, []);

  const isSelected = useCallback((id: string) => {
    return selectedItems.has(id);
  }, [selectedItems]);

  const getSelectedByType = useCallback((type: SelectableItemType): string[] => {
    const result: string[] = [];
    selectedItems.forEach((itemType, id) => {
      if (itemType === type) {
        result.push(id);
      }
    });
    return result;
  }, [selectedItems]);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedItems(new Map());
  }, []);

  const value = useMemo(() => ({
    selectedItems,
    isSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedByType,
    enterSelectionMode,
    exitSelectionMode,
  }), [
    selectedItems,
    isSelectionMode,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    getSelectedByType,
    enterSelectionMode,
    exitSelectionMode,
  ]);

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
};
