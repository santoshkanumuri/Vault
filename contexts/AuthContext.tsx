'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '@/lib/types';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateMetadataPreference: (showMetadata: boolean) => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to load user data from database
  const loadUserData = useCallback(async (authUser: any): Promise<User | null> => {
    if (!supabase) {
      console.error('Supabase is not configured');
      return null;
    }

    try {
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user data:', error);
      }

      return {
        id: authUser.id,
        email: authUser.email || '',
        name: userData?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
        showMetadata: userData?.show_metadata ?? true,
        createdAt: userData?.created_at || authUser.created_at || new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error loading user data:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      if (!supabase) {
        console.error('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local');
        setIsLoading(false);
        return;
      }

      try {
        // Get initial session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!isMounted) return;

        if (error) {
          console.error('Session error:', error);
          setIsLoading(false);
          return;
        }

        // Set user if session exists
        if (session?.user) {
          const userData = await loadUserData(session.user);
          if (isMounted && userData) {
            setUser(userData);
          }
        }

        if (isMounted) {
          setIsLoading(false);
        }

        // Set up auth state listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (!isMounted) return;

            if (session?.user) {
              const userData = await loadUserData(session.user);
              if (userData) {
                setUser(userData);
              }
            } else {
              setUser(null);
            }
          }
        );

        authSubscription = subscription;
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted && isLoading) {
        console.warn('Auth initialization timeout');
        setIsLoading(false);
      }
    }, 10000);

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [loadUserData]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error);
        return { success: false, error: error.message };
      }

      return { success: !!data.user };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string): Promise<{ success: boolean; error?: string }> => {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      // Sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (error) {
        console.error('Signup error:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        // Create the user record in our custom users table
        const { error: userError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: data.user.email || email,
            name: name,
            show_metadata: true,
          });

        if (userError) {
          console.warn('User table insert error:', userError);
          // Don't fail registration if user table insert fails - the trigger should handle it
        }

        return { success: true };
      }

      return { success: false, error: 'Registration failed - no user returned' };
    } catch (error: any) {
      console.error('Registration error:', error);
      return { success: false, error: error.message || 'Registration failed' };
    }
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const updateMetadataPreference = useCallback(async (showMetadata: boolean): Promise<void> => {
    if (!user || !supabase) return;

    try {
      const { error } = await supabase
        .from('users')
        .update({ show_metadata: showMetadata })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating metadata preference:', error);
        throw error;
      }

      // Update local state
      setUser({ ...user, showMetadata });
    } catch (error) {
      console.error('Failed to update metadata preference:', error);
      throw error;
    }
  }, [user]);

  const value = useMemo(() => ({ 
    user, 
    login, 
    register, 
    logout, 
    updateMetadataPreference, 
    isLoading 
  }), [user, isLoading, login, register, logout, updateMetadataPreference]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
