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

  // Helper function to load user data from database
  const loadUserData = useCallback(async (authUser: any): Promise<User> => {
    try {
      if (supabase) {
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
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }

    // Fallback user data
    return {
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
      showMetadata: true,
      createdAt: authUser.created_at || new Date().toISOString(),
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authSubscription: any = null;

    const initializeAuth = async () => {
      try {
        if (isSupabaseConfigured() && supabase) {
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
            if (isMounted) {
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
                setUser(userData);
              } else {
                setUser(null);
              }
            }
          );

          authSubscription = subscription;
        } else {
          // Fallback to localStorage
          const savedUser = getUser();
          if (isMounted) {
            setUser(savedUser);
            setIsLoading(false);
          }
        }
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
