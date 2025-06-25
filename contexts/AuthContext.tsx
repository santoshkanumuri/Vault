'use client';

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { User } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { saveUser, getUser, removeUser } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  logout: () => void;
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

  useEffect(() => {
    if (isSupabaseConfigured() && supabase) {
      // Check for existing session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user && supabase) {
          try {
            // Fetch user data from database to get preferences
            const { data: userData, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (error && error.code !== 'PGRST116') { // Not found error
              console.error('Error fetching user data:', error);
            }

            const user: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: userData?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
              showMetadata: userData?.show_metadata ?? true,
              createdAt: userData?.created_at || session.user.created_at || new Date().toISOString(),
            };
            setUser(user);
          } catch (error) {
            console.error('Error loading user preferences:', error);
            // Fallback to basic user data
            const user: User = {
              id: session.user.id,
              email: session.user.email || '',
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
              showMetadata: true,
              createdAt: session.user.created_at || new Date().toISOString(),
            };
            setUser(user);
          }
        }
        setIsLoading(false);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user && supabase) {
            try {
              // Fetch user data from database to get preferences
              const { data: userData, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', session.user.id)
                .single();

              if (error && error.code !== 'PGRST116') { // Not found error
                console.error('Error fetching user data:', error);
              }

              const user: User = {
                id: session.user.id,
                email: session.user.email || '',
                name: userData?.name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
                showMetadata: userData?.show_metadata ?? true,
                createdAt: userData?.created_at || session.user.created_at || new Date().toISOString(),
              };
              setUser(user);
            } catch (error) {
              console.error('Error loading user preferences:', error);
              // Fallback to basic user data
              const user: User = {
                id: session.user.id,
                email: session.user.email || '',
                name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
                showMetadata: true,
                createdAt: session.user.created_at || new Date().toISOString(),
              };
              setUser(user);
            }
          } else {
            setUser(null);
          }
        }
      );

      return () => subscription.unsubscribe();
    } else {
      // Fallback to localStorage if Supabase is not configured
      const savedUser = getUser();
      setUser(savedUser);
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('Login error:', error.message);
          return false;
        }

        return !!data.user;
      } catch (error) {
        console.error('Login error:', error);
        return false;
      }
    } else {
      // Fallback to mock authentication
      if (email && password.length >= 6) {
        const user: User = {
          id: Date.now().toString(),
          email,
          name: email.split('@')[0],
          showMetadata: true,
          createdAt: new Date().toISOString(),
        };
        setUser(user);
        saveUser(user);
        return true;
      }
      return false;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, name: string): Promise<boolean> => {
    if (isSupabaseConfigured() && supabase) {
      try {
        // Starting registration process
        
        // First, sign up the user with Supabase Auth
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
          console.error('Supabase auth signup error:', error);
          return false;
        }

        if (data.user) {
          // Auth user created successfully
          
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
            console.error('User table insert error:', userError);
            // If user table creation fails, we should still return true
            // as the Supabase auth user was created successfully
            // The trigger should handle this, but if it fails, user can still log in
          } else {
            // User record created successfully in users table
          }

          return true;
        }

        console.error('No user returned from signup');
        return false;
      } catch (error) {
        console.error('Registration exception:', error);
        return false;
      }
    } else {
      // Fallback to mock registration
      if (email && password.length >= 6 && name) {
        const user: User = {
          id: Date.now().toString(),
          email,
          name,
          showMetadata: true,
          createdAt: new Date().toISOString(),
        };
        setUser(user);
        saveUser(user);
        return true;
      }
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    } else {
      // Fallback logout
      setUser(null);
      removeUser();
    }
  }, []);

  const updateMetadataPreference = useCallback(async (showMetadata: boolean): Promise<void> => {
    if (!user) return;

    if (isSupabaseConfigured() && supabase) {
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
    } else {
      // Fallback to localStorage
      const updatedUser = { ...user, showMetadata };
      setUser(updatedUser);
      saveUser(updatedUser);
    }
  }, [user]);

  const value = useMemo(() => ({ user, login, register, logout, updateMetadataPreference, isLoading }), [user, isLoading, login, register, logout, updateMetadataPreference]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};