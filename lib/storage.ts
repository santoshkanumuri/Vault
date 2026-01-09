// ============================================
// Theme Storage (kept in localStorage as user preference)
// ============================================

const THEME_KEY = 'vault-theme';

export const saveTheme = (isDark: boolean) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  }
};

export const getTheme = (): boolean => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(THEME_KEY) === 'dark';
  }
  return false;
};

// ============================================
// Search History (for smart search suggestions)
// ============================================

const SEARCH_HISTORY_KEY = 'vault-search-history';
const MAX_SEARCH_HISTORY = 20;

export const saveSearchQuery = (query: string) => {
  if (typeof window === 'undefined') return;
  
  try {
    const history = getSearchHistory();
    const filtered = history.filter(q => q.toLowerCase() !== query.toLowerCase());
    filtered.unshift(query);
    localStorage.setItem(
      SEARCH_HISTORY_KEY, 
      JSON.stringify(filtered.slice(0, MAX_SEARCH_HISTORY))
    );
  } catch (error) {
    console.error('Error saving search history:', error);
  }
};

export const getSearchHistory = (): string[] => {
  if (typeof window === 'undefined') return [];
  
  try {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    return history ? JSON.parse(history) : [];
  } catch {
    return [];
  }
};

export const clearSearchHistory = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  }
};
