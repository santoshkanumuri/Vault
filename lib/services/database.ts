import { supabase } from '@/lib/supabase';
import { User, Folder, Tag, Link, Note } from '@/lib/types';

// User operations
export const createUser = async (email: string, name: string): Promise<User | null> => {
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 'temp-password', // This will be handled by Supabase auth
    });

    if (error) throw error;

    if (data.user) {
      // The trigger function should handle user creation, but let's verify
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        // If user doesn't exist and it's not a "not found" error, create manually
        const { data: createdUser, error: createError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email,
            name,
            show_metadata: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        
        return {
          id: createdUser.id,
          email: createdUser.email,
          name: createdUser.name,
          showMetadata: createdUser.show_metadata,
          createdAt: createdUser.created_at,
        };
      }

      if (userData) {
        return {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          showMetadata: userData.show_metadata,
          createdAt: userData.created_at,
        };
      }
    }
  } catch (error) {
    console.error('Error creating user:', error);
  }
  return null;
};

export const signInUser = async (email: string, password: string): Promise<User | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError) throw userError;

      return {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        showMetadata: userData.show_metadata,
        createdAt: userData.created_at,
      };
    }
  } catch (error) {
    console.error('Error signing in user:', error);
  }
  return null;
};

export const signOutUser = async (): Promise<void> => {
  if (!supabase) return;
  
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out user:', error);
    throw error;
  }
};

export const updateUserMetadataPreference = async (userId: string, showMetadata: boolean): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('users')
      .update({ show_metadata: showMetadata })
      .eq('id', userId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating user metadata preference:', error);
    throw error;
  }
};

// Folder operations
export const getFolders = async (userId: string): Promise<Folder[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('folders')
      .select(`
        *,
        links(count)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(folder => ({
      id: folder.id,
      name: folder.name,
      color: folder.color,
      userId: folder.user_id,
      createdAt: folder.created_at,
      linkCount: folder.links?.[0]?.count || 0,
    }));
  } catch (error) {
    console.error('Error fetching folders:', error);
    return [];
  }
};

export const createFolder = async (name: string, color: string, userId: string): Promise<Folder | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('folders')
      .insert({
        name,
        color,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      color: data.color,
      userId: data.user_id,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error creating folder:', error);
    return null;
  }
};

export const updateFolder = async (id: string, name: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('folders')
      .update({ name })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating folder:', error);
    throw error;
  }
};

export const deleteFolder = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting folder:', error);
    throw error;
  }
};

// Tag operations
export const getTags = async (userId: string): Promise<Tag[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return data.map(tag => ({
      id: tag.id,
      name: tag.name,
      color: tag.color,
      userId: tag.user_id,
      createdAt: tag.created_at,
    }));
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
};

export const createTag = async (name: string, color: string, userId: string): Promise<Tag | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        name,
        color,
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      color: data.color,
      userId: data.user_id,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error creating tag:', error);
    return null;
  }
};

export const updateTag = async (id: string, name: string, color: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('tags')
      .update({ name, color })
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating tag:', error);
    throw error;
  }
};

export const deleteTag = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting tag:', error);
    throw error;
  }
};

// Link operations
export const getLinks = async (userId: string): Promise<Link[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('links')
      .select(`
        *,
        link_tags(tag_id)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(link => ({
      id: link.id,
      name: link.name,
      url: link.url,
      description: link.description,
      folderId: link.folder_id,
      userId: link.user_id,
      favicon: link.favicon || undefined,
      metadata: link.metadata as any,
      tagIds: link.link_tags.map((lt: any) => lt.tag_id),
      createdAt: link.created_at,
    }));
  } catch (error) {
    console.error('Error fetching links:', error);
    return [];
  }
};

export const createLink = async (
  name: string,
  url: string,
  description: string,
  folderId: string,
  userId: string,
  tagIds: string[],
  favicon: string | null | undefined,
  metadata: any
): Promise<Link | null> => {
  if (!supabase) return null;
  
  try {
    // Start a transaction-like operation using RPC or single atomic operations
    const { data, error } = await supabase
      .from('links')
      .insert([
        {
          name,
          url,
          description,
          folder_id: folderId,
          user_id: userId,
          favicon,
          metadata: metadata ? { ...metadata } : null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Add tag associations if successful
    if (tagIds.length > 0) {
      const { error: tagError } = await supabase
        .from('link_tags')
        .insert(
          tagIds.map(tagId => ({
            link_id: data.id,
            tag_id: tagId,
          }))
        );

      if (tagError) {
        // If tag insertion fails, delete the created link to maintain consistency
        await supabase.from('links').delete().eq('id', data.id);
        throw tagError;
      }
    }

    return {
      id: data.id,
      name: data.name,
      url: data.url,
      description: data.description,
      folderId: data.folder_id,
      userId: data.user_id,
      favicon: data.favicon || undefined,
      metadata: data.metadata,
      tagIds,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Error creating link:', error);
    return null;
  }
};

export const updateLink = async (
  id: string,
  name: string,
  url: string,
  description: string,
  folderId: string,
  tagIds: string[],
  favicon?: string,
  metadata?: any
): Promise<void> => {
  if (!supabase) return;
  
  try {
    // Update link data first
    const { error: linkError } = await supabase
      .from('links')
      .update({
        name,
        url,
        description,
        folder_id: folderId,
        favicon,
        metadata: metadata ? { ...metadata } : null,
      })
      .eq('id', id);

    if (linkError) throw linkError;

    // Update tag associations atomically
    // Delete existing tags first
    const { error: deleteTagsError } = await supabase
      .from('link_tags')
      .delete()
      .eq('link_id', id);

    if (deleteTagsError) throw deleteTagsError;

    // Insert new tags if any
    if (tagIds.length > 0) {
      const { error: insertTagsError } = await supabase
        .from('link_tags')
        .insert(
          tagIds.map(tagId => ({
            link_id: id,
            tag_id: tagId,
          }))
        );

      if (insertTagsError) throw insertTagsError;
    }
  } catch (error) {
    console.error('Error updating link:', error);
    throw error;
  }
};

export const deleteLink = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('links')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting link:', error);
    throw error;
  }
};

// Note operations
export const getNotes = async (userId: string): Promise<Note[]> => {
  if (!supabase) return [];
  try {
    // First get all notes for the user
    const { data: notesData, error: notesError } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    // Then get all note-tag relationships for these notes
    const noteIds = notesData.map(note => note.id);
    let noteTagsData: any[] = [];
    
    if (noteIds.length > 0) {
      const { data: tagRelations, error: tagError } = await supabase
        .from('note_tags')
        .select(`
          note_id,
          tag_id,
          tags (*)
        `)
        .in('note_id', noteIds);

      if (tagError) throw tagError;
      noteTagsData = tagRelations || [];
    }

    // Combine the data
    return notesData.map((note: any) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      folderId: note.folder_id,
      tagIds: noteTagsData
        .filter((nt: any) => nt.note_id === note.id)
        .map((nt: any) => nt.tag_id),
      createdAt: note.created_at,
      userId: note.user_id,
    }));
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

export const createNote = async (
  title: string,
  content: string,
  folderId: string,
  tagIds: string[],
  userId: string
): Promise<Note | null> => {
  if (!supabase) return null;
  
  try {
    // Create the note first
    const { data: noteData, error: noteError } = await supabase
      .from('notes')
      .insert({
        title,
        content,
        folder_id: folderId,
        user_id: userId,
      })
      .select()
      .single();

    if (noteError) throw noteError;

    // Add tags if any and if note creation was successful
    if (tagIds.length > 0) {
      const tagRelations = tagIds.map(tagId => ({
        note_id: noteData.id,
        tag_id: tagId,
      }));

      const { error: tagError } = await supabase
        .from('note_tags')
        .insert(tagRelations);

      if (tagError) {
        // If tag insertion fails, delete the created note to maintain consistency
        await supabase.from('notes').delete().eq('id', noteData.id);
        throw tagError;
      }
    }

    return {
      id: noteData.id,
      title: noteData.title,
      content: noteData.content,
      folderId: noteData.folder_id,
      tagIds,
      createdAt: noteData.created_at,
      userId: noteData.user_id,
    };
  } catch (error) {
    console.error('Error creating note:', error);
    throw error;
  }
};

export const updateNote = async (
  id: string,
  title: string,
  content: string,
  folderId: string,
  tagIds: string[]
): Promise<void> => {
  if (!supabase) return;
  
  try {
    // Update the note first
    const { error: noteError } = await supabase
      .from('notes')
      .update({
        title,
        content,
        folder_id: folderId,
      })
      .eq('id', id);

    if (noteError) throw noteError;

    // Delete existing tag relations
    const { error: deleteTagError } = await supabase
      .from('note_tags')
      .delete()
      .eq('note_id', id);

    if (deleteTagError) throw deleteTagError;

    // Add new tag relations if any
    if (tagIds.length > 0) {
      const tagRelations = tagIds.map(tagId => ({
        note_id: id,
        tag_id: tagId,
      }));

      const { error: tagError } = await supabase
        .from('note_tags')
        .insert(tagRelations);

      if (tagError) throw tagError;
    }
  } catch (error) {
    console.error('Error updating note:', error);
    throw error;
  }
};

export const deleteNote = async (id: string): Promise<void> => {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};