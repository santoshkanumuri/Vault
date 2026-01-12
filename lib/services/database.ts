import { supabase } from '@/lib/supabase';
import { User, Folder, Tag, Link, Note } from '@/lib/types';
import { logger } from '@/lib/utils/logger';

// Helper to ensure Supabase is configured
const requireSupabase = () => {
  if (!supabase) {
    const error = new Error('Supabase is not configured. Please check your environment variables.');
    logger.error('requireSupabase: Supabase not configured', {}, error);
    throw error;
  }
  return supabase;
};

// Helper to handle Supabase errors
const handleSupabaseError = (operation: string, error: any, context?: Record<string, any>) => {
  const errorMessage = error?.message || 'Unknown error';
  const errorCode = error?.code || 'UNKNOWN';
  
  logger.error(`Database ${operation}: Supabase error`, {
    ...context,
    errorCode,
    errorMessage
  }, error);
  
  // Provide user-friendly error messages
  if (errorCode === 'PGRST116') {
    return new Error(`Item not found`);
  }
  if (errorCode === '23505') {
    return new Error(`Duplicate entry: ${errorMessage}`);
  }
  if (errorCode === '23503') {
    return new Error(`Referenced item does not exist`);
  }
  
  return new Error(`Database operation failed: ${errorMessage}`);
};

// User operations
export const createUser = async (email: string, name: string): Promise<User | null> => {
  const client = requireSupabase();
  
  try {
    const { data, error } = await client.auth.signUp({
      email,
      password: 'temp-password', // This will be handled by Supabase auth
    });

    if (error) throw error;

    if (data.user) {
      // The trigger function should handle user creation, but let's verify
      const { data: userData, error: userError } = await client
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        // If user doesn't exist and it's not a "not found" error, create manually
        const { data: createdUser, error: createError } = await client
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
    throw error;
  }
  return null;
};

export const signInUser = async (email: string, password: string): Promise<User | null> => {
  const client = requireSupabase();
  
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    if (data.user) {
      const { data: userData, error: userError } = await client
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
    throw error;
  }
  return null;
};

export const signOutUser = async (): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error signing out user:', error);
    throw error;
  }
};

export const updateUserMetadataPreference = async (userId: string, showMetadata: boolean): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
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
  const client = requireSupabase();
  
  try {
    const { data, error } = await client
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
    throw error;
  }
};

export const createFolder = async (name: string, color: string, userId: string): Promise<Folder | null> => {
  const client = requireSupabase();
  
  try {
    const { data, error } = await client
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
    throw error;
  }
};

export const updateFolder = async (id: string, name: string): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
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
  const client = requireSupabase();
  
  try {
    const { error } = await client
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
  const client = requireSupabase();
  
  try {
    const { data, error } = await client
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
    throw error;
  }
};

export const createTag = async (name: string, color: string, userId: string): Promise<Tag | null> => {
  const client = requireSupabase();
  
  try {
    const { data, error } = await client
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
    throw error;
  }
};

export const updateTag = async (id: string, name: string, color: string): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
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
  const client = requireSupabase();
  
  try {
    const { error } = await client
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
export const getLinks = async (
  userId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ links: Link[]; total: number; hasMore: boolean }> => {
  const client = requireSupabase();
  
  try {
    const offset = (page - 1) * limit;
    
    const { data, error, count } = await client
      .from('links')
      .select(`
        *,
        link_tags(tag_id)
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    const links = data.map(link => ({
      id: link.id,
      name: link.name,
      url: link.url,
      description: link.description,
      folderId: link.folder_id,
      userId: link.user_id,
      favicon: link.favicon || undefined,
      metadata: link.metadata as any,
      fullContent: link.full_content || undefined,
      contentType: link.content_type || undefined,
      author: link.author || undefined,
      tagIds: link.link_tags.map((lt: any) => lt.tag_id),
      createdAt: link.created_at,
      embedding: link.embedding || undefined,
      wordCount: link.word_count || undefined,
      isPinned: link.is_pinned || false,
      clickCount: link.click_count || 0,
    }));

    return {
      links,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error: any) {
    logger.error('getLinks: Failed', { 
      userId, 
      error: error.message 
    }, error);
    throw error;
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
  const client = requireSupabase();
  
  try {
    // Start a transaction-like operation using RPC or single atomic operations
    const { data, error } = await client
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
          full_content: metadata?.content || null,
          content_type: metadata?.type || null,
          author: metadata?.author || null,
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Add tag associations if successful
    if (tagIds.length > 0) {
      const { error: tagError } = await client
        .from('link_tags')
        .insert(
          tagIds.map(tagId => ({
            link_id: data.id,
            tag_id: tagId,
          }))
        );

      if (tagError) {
        // If tag insertion fails, delete the created link to maintain consistency
        await client.from('links').delete().eq('id', data.id);
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
      fullContent: data.full_content || undefined,
      contentType: data.content_type || undefined,
      author: data.author || undefined,
      tagIds,
      createdAt: data.created_at,
      isPinned: data.is_pinned || false,
    };
  } catch (error: any) {
    logger.error('createLink: Failed', { 
      name, 
      url, 
      error: error.message 
    }, error);
    throw error;
  }
};

// Helper function to update link content fields only
export const updateLinkContent = async (
  id: string,
  fullContent?: string,
  contentType?: string,
  author?: string,
  wordCount?: number
): Promise<void> => {
  const client = requireSupabase();
  
  try {
    logger.info('updateLinkContent: Updating link content', { id });
    
    const updateData: any = {};
    if (fullContent !== undefined) updateData.full_content = fullContent;
    if (contentType !== undefined) updateData.content_type = contentType;
    if (author !== undefined) updateData.author = author;
    if (wordCount !== undefined) updateData.word_count = wordCount;
    
    const { error } = await client
      .from('links')
      .update(updateData)
      .eq('id', id);
    
    if (error) {
      throw handleSupabaseError('updateLinkContent', error, { id });
    }
    
    logger.info('updateLinkContent: Success', { id });
  } catch (error: any) {
    logger.error('updateLinkContent: Failed', { id, error: error.message }, error);
    throw error;
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
  const client = requireSupabase();
  
  try {
    logger.info('updateLink: Updating link', { 
      id, 
      name, 
      url, 
      folderId,
      tagCount: tagIds.length 
    });

    // Validate inputs
    if (!id || !name || !url || !folderId) {
      throw new Error('Missing required fields for link update');
    }

    // Prepare update data - handle both old and new metadata formats
    const updateData: any = {
      name: name.trim(),
      url: url.trim(),
      description: description?.trim() || '',
      folder_id: folderId,
      favicon: favicon?.trim() || null,
      metadata: metadata ? { ...metadata } : null,
    };

    // Handle full_content, content_type, and author from various sources
    if (metadata) {
      // New format: metadata.fullContent
      if (metadata.fullContent?.fullText) {
        updateData.full_content = metadata.fullContent.fullText;
        updateData.content_type = metadata.fullContent.contentType || null;
        updateData.author = metadata.fullContent.author || null;
      }
      // Old format: metadata.content
      else if (metadata.content) {
        updateData.full_content = metadata.content;
        updateData.content_type = metadata.type || null;
        updateData.author = metadata.author || null;
      }
      // Explicit fields
      else {
        updateData.full_content = metadata.full_content || null;
        updateData.content_type = metadata.content_type || metadata.contentType || metadata.type || null;
        updateData.author = metadata.author || null;
      }
    }

    // Update link data first
    const { error: linkError } = await client
      .from('links')
      .update(updateData)
      .eq('id', id);

    if (linkError) {
      throw handleSupabaseError('updateLink', linkError, { id });
    }

    logger.debug('updateLink: Link updated, updating tags', { id });

    // Get existing tags to compare
    const { data: existingTagsData, error: existingTagsError } = await client
      .from('link_tags')
      .select('tag_id')
      .eq('link_id', id);

    if (existingTagsError) {
      throw handleSupabaseError('updateLink (get existing tags)', existingTagsError, { id });
    }

    const existingTagIds = existingTagsData?.map(t => t.tag_id) || [];
    const newTagIds = tagIds;

    // Check if tags actually changed
    const tagsChanged = existingTagIds.length !== newTagIds.length ||
      !existingTagIds.every(id => newTagIds.includes(id));

    if (tagsChanged) {
      // Only delete tags that were removed
      const tagsToRemove = existingTagIds.filter(id => !newTagIds.includes(id));
      const tagsToAdd = newTagIds.filter(id => !existingTagIds.includes(id));

      // Delete removed tags
      if (tagsToRemove.length > 0) {
        const { error: deleteTagsError } = await client
          .from('link_tags')
          .delete()
          .eq('link_id', id)
          .in('tag_id', tagsToRemove);

        if (deleteTagsError) {
          throw handleSupabaseError('updateLink (delete tags)', deleteTagsError, { id });
        }
      }

      // Insert new tags
      if (tagsToAdd.length > 0) {
        const { error: insertTagsError } = await client
          .from('link_tags')
          .insert(
            tagsToAdd.map(tagId => ({
              link_id: id,
              tag_id: tagId,
            }))
          );

        if (insertTagsError) {
          throw handleSupabaseError('updateLink (insert tags)', insertTagsError, { id });
        }
      }
    }

    logger.info('updateLink: Success', { id });
  } catch (error: any) {
    logger.error('updateLink: Failed', { 
      id, 
      error: error.message 
    }, error);
    throw error;
  }
};

export const deleteLink = async (id: string): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
      .from('links')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    logger.error('deleteLink: Failed', { 
      id, 
      error: error.message 
    }, error);
    throw error;
  }
};

// Note operations
export const getNotes = async (
  userId: string,
  page: number = 1,
  limit: number = 50
): Promise<{ notes: Note[]; total: number; hasMore: boolean }> => {
  const client = requireSupabase();
  
  try {
    const offset = (page - 1) * limit;
    
    // First get paginated notes for the user
    const { data: notesData, error: notesError, count } = await client
      .from('notes')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (notesError) throw notesError;

    // Then get all note-tag relationships for these notes
    const noteIds = notesData.map(note => note.id);
    let noteTagsData: any[] = [];
    
    if (noteIds.length > 0) {
      const { data: tagRelations, error: tagError } = await client
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
    const notes = notesData.map((note: any) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      folderId: note.folder_id,
      tagIds: noteTagsData
        .filter((nt: any) => nt.note_id === note.id)
        .map((nt: any) => nt.tag_id),
      createdAt: note.created_at,
      userId: note.user_id,
      isPinned: note.is_pinned || false,
    }));

    return {
      notes,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  } catch (error: any) {
    logger.error('getNotes: Failed', { 
      userId, 
      error: error.message 
    }, error);
    throw error;
  }
};

export const createNote = async (
  title: string,
  content: string,
  folderId: string,
  tagIds: string[],
  userId: string
): Promise<Note | null> => {
  const client = requireSupabase();
  
  try {
    // Create the note first
    const { data: noteData, error: noteError } = await client
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

      const { error: tagError } = await client
        .from('note_tags')
        .insert(tagRelations);

      if (tagError) {
        // If tag insertion fails, delete the created note to maintain consistency
        await client.from('notes').delete().eq('id', noteData.id);
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
      isPinned: noteData.is_pinned || false,
    };
  } catch (error: any) {
    logger.error('createNote: Failed', { 
      title, 
      error: error.message 
    }, error);
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
  const client = requireSupabase();
  
  try {
    // Update the note first
    const { error: noteError } = await client
      .from('notes')
      .update({
        title,
        content,
        folder_id: folderId,
      })
      .eq('id', id);

    if (noteError) throw noteError;

    // Get existing tags to compare
    const { data: existingTagsData, error: existingTagsError } = await client
      .from('note_tags')
      .select('tag_id')
      .eq('note_id', id);

    if (existingTagsError) throw existingTagsError;

    const existingTagIds = existingTagsData?.map(t => t.tag_id) || [];
    const newTagIds = tagIds;

    // Check if tags actually changed
    const tagsChanged = existingTagIds.length !== newTagIds.length ||
      !existingTagIds.every(tagId => newTagIds.includes(tagId));

    if (tagsChanged) {
      // Only delete tags that were removed
      const tagsToRemove = existingTagIds.filter(tagId => !newTagIds.includes(tagId));
      const tagsToAdd = newTagIds.filter(tagId => !existingTagIds.includes(tagId));

      // Delete removed tags
      if (tagsToRemove.length > 0) {
        const { error: deleteTagError } = await client
          .from('note_tags')
          .delete()
          .eq('note_id', id)
          .in('tag_id', tagsToRemove);

        if (deleteTagError) throw deleteTagError;
      }

      // Add new tags
      if (tagsToAdd.length > 0) {
        const tagRelations = tagsToAdd.map(tagId => ({
          note_id: id,
          tag_id: tagId,
        }));

        const { error: tagError } = await client
          .from('note_tags')
          .insert(tagRelations);

        if (tagError) throw tagError;
      }
    }
  } catch (error: any) {
    logger.error('updateNote: Failed', { 
      id, 
      error: error.message 
    }, error);
    throw error;
  }
};

export const deleteNote = async (id: string): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error: any) {
    logger.error('deleteNote: Failed', { 
      id, 
      error: error.message 
    }, error);
    throw error;
  }
};

// ============================================
// Embedding operations
// ============================================

interface TextChunkWithEmbedding {
  id: string;
  text: string;
  index: number;
  embedding?: number[];
}

export const updateLinkEmbeddings = async (
  linkId: string,
  embedding: number[],
  chunks: TextChunkWithEmbedding[]
): Promise<void> => {
  const client = requireSupabase();
  
  try {
    logger.info('updateLinkEmbeddings: Starting', { 
      linkId, 
      embeddingLength: embedding.length, 
      chunksCount: chunks.length
    });
    
    // Update the link's main embedding and word count
    const wordCount = chunks.reduce((acc, c) => acc + c.text.split(/\s+/).length, 0);
    
    logger.debug('updateLinkEmbeddings: Saving to database', { 
      dimensions: embedding.length,
      wordCount
    });
    
    // pgvector expects array directly, not JSON string
    const { error: linkError } = await client
      .from('links')
      .update({ 
        embedding: embedding, // Pass array directly for pgvector
        word_count: wordCount
      })
      .eq('id', linkId);

    if (linkError) {
      throw handleSupabaseError('updateLinkEmbeddings (link)', linkError, { linkId });
    }
    logger.info('updateLinkEmbeddings: Link embedding updated', { linkId });

    // Delete existing chunks for this link
    const { error: deleteError } = await client
      .from('link_chunks')
      .delete()
      .eq('link_id', linkId);

    if (deleteError && deleteError.code !== 'PGRST116') {
      logger.warn('updateLinkEmbeddings: Error deleting existing chunks', { 
        linkId, 
        error: deleteError.message 
      });
    }

    // Insert new chunks with embeddings
    if (chunks.length > 0) {
      const chunkRows = chunks
        .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
        .map((chunk, index) => ({
          link_id: linkId,
          chunk_index: chunk.index !== undefined ? chunk.index : index,
          chunk_text: chunk.text.slice(0, 10000),
          embedding: chunk.embedding, // Pass array directly for pgvector (Supabase handles conversion)
        }));

      if (chunkRows.length > 0) {
        logger.info('updateLinkEmbeddings: Inserting chunks', { 
          linkId, 
          count: chunkRows.length,
          firstChunkEmbeddingLength: chunkRows[0]?.embedding?.length
        });
        
        const { error: chunksError, data: insertedChunks } = await client
          .from('link_chunks')
          .insert(chunkRows)
          .select('id');

        if (chunksError) {
          logger.error('updateLinkEmbeddings: Error inserting chunks', { 
            linkId, 
            error: chunksError.message,
            errorCode: chunksError.code,
            errorDetails: chunksError.details
          }, chunksError);
          // Don't throw - chunks are optional, main embedding is what matters
        } else {
          logger.info('updateLinkEmbeddings: Chunks inserted successfully', { 
            linkId, 
            count: chunkRows.length,
            insertedIds: insertedChunks?.map(c => c.id)
          });
        }
      } else {
        logger.warn('updateLinkEmbeddings: No valid chunks to insert', { 
          linkId,
          totalChunks: chunks.length,
          validChunks: chunks.filter(c => c.embedding && c.embedding.length > 0).length
        });
      }
    }

    logger.info('updateLinkEmbeddings: SUCCESS', { linkId });
  } catch (error: any) {
    logger.error('updateLinkEmbeddings: FAILED', { 
      linkId, 
      error: error.message 
    }, error);
    throw error;
  }
};

export const updateNoteEmbeddings = async (
  noteId: string,
  embedding: number[],
  chunks: TextChunkWithEmbedding[]
): Promise<void> => {
  const client = requireSupabase();
  
  try {
    logger.info('updateNoteEmbeddings: Starting', { 
      noteId, 
      embeddingLength: embedding.length, 
      chunksCount: chunks.length 
    });
    
    // Update the note's main embedding - pgvector expects array directly
    logger.debug('updateNoteEmbeddings: Saving to database', {
      noteId,
      dimensions: embedding.length
    });
    
    const { error: noteError } = await client
      .from('notes')
      .update({ embedding: embedding }) // Pass array directly for pgvector
      .eq('id', noteId);

    if (noteError) {
      throw handleSupabaseError('updateNoteEmbeddings (note)', noteError, { noteId });
    }
    logger.info('updateNoteEmbeddings: Note embedding updated', { noteId });

    // Delete existing chunks for this note
    const { error: deleteError } = await client
      .from('note_chunks')
      .delete()
      .eq('note_id', noteId);

    if (deleteError && deleteError.code !== 'PGRST116') {
      logger.warn('updateNoteEmbeddings: Error deleting existing chunks', { 
        noteId, 
        error: deleteError.message 
      });
    }

    // Insert new chunks with embeddings
    if (chunks.length > 0) {
      const chunkRows = chunks
        .filter(chunk => chunk.embedding && chunk.embedding.length > 0)
        .map((chunk, index) => ({
          note_id: noteId,
          chunk_index: chunk.index !== undefined ? chunk.index : index,
          chunk_text: chunk.text.slice(0, 10000),
          embedding: chunk.embedding, // Pass array directly for pgvector (Supabase handles conversion)
        }));

      if (chunkRows.length > 0) {
        logger.info('updateNoteEmbeddings: Inserting chunks', { 
          noteId, 
          count: chunkRows.length,
          firstChunkEmbeddingLength: chunkRows[0]?.embedding?.length
        });
        
        const { error: chunksError, data: insertedChunks } = await client
          .from('note_chunks')
          .insert(chunkRows)
          .select('id');

        if (chunksError) {
          logger.error('updateNoteEmbeddings: Error inserting chunks', { 
            noteId, 
            error: chunksError.message,
            errorCode: chunksError.code,
            errorDetails: chunksError.details
          }, chunksError);
          // Don't throw - chunks are optional
        } else {
          logger.info('updateNoteEmbeddings: Chunks inserted successfully', { 
            noteId, 
            count: chunkRows.length,
            insertedIds: insertedChunks?.map(c => c.id)
          });
        }
      } else {
        logger.warn('updateNoteEmbeddings: No valid chunks to insert', { 
          noteId,
          totalChunks: chunks.length,
          validChunks: chunks.filter(c => c.embedding && c.embedding.length > 0).length
        });
      }
    }

    logger.info('updateNoteEmbeddings: SUCCESS', { noteId });
  } catch (error: any) {
    logger.error('updateNoteEmbeddings: FAILED', { 
      noteId, 
      error: error.message 
    }, error);
    throw error;
  }
};

// Update link pinned status
export const updateLinkPinned = async (linkId: string, isPinned: boolean): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
      .from('links')
      .update({ is_pinned: isPinned })
      .eq('id', linkId);
    
    if (error) throw handleSupabaseError('updateLinkPinned', error, { linkId, isPinned });
    
    logger.debug('updateLinkPinned: Success', { linkId, isPinned });
  } catch (error: any) {
    logger.error('updateLinkPinned: FAILED', { linkId, error: error.message }, error);
    throw error;
  }
};

// Update note pinned status
export const updateNotePinned = async (noteId: string, isPinned: boolean): Promise<void> => {
  const client = requireSupabase();
  
  try {
    const { error } = await client
      .from('notes')
      .update({ is_pinned: isPinned })
      .eq('id', noteId);
    
    if (error) throw handleSupabaseError('updateNotePinned', error, { noteId, isPinned });
    
    logger.debug('updateNotePinned: Success', { noteId, isPinned });
  } catch (error: any) {
    logger.error('updateNotePinned: FAILED', { noteId, error: error.message }, error);
    throw error;
  }
};

// ============ Link Analytics Functions ============

export interface LinkAnalytics {
  linkId: string;
  linkName: string;
  linkUrl: string;
  totalClicks: number;
  lastClicked: string | null;
}

// Track a link click/open
export const trackLinkClick = async (
  linkId: string, 
  userId: string, 
  source: 'direct' | 'search' | 'quicklook' | 'external' = 'direct'
): Promise<void> => {
  const client = requireSupabase();
  
  try {
    // Use the RPC function if available, otherwise fallback to direct insert
    const { error: rpcError } = await client.rpc('track_link_click', {
      p_link_id: linkId,
      p_user_id: userId,
      p_source: source,
    });

    if (rpcError) {
      // Fallback: direct insert if RPC doesn't exist
      logger.debug('trackLinkClick: RPC failed, using fallback', { error: rpcError.message });
      
      // Insert analytics record
      const { error: insertError } = await client
        .from('link_analytics')
        .insert({
          link_id: linkId,
          user_id: userId,
          source,
        });
      
      if (insertError && !insertError.message.includes('does not exist')) {
        throw insertError;
      }

      // Update click count - try RPC first, fall back to manual update
      try {
        const { error: rpcError } = await client.rpc('increment_click_count', {
          row_id: linkId,
        });
        
        if (rpcError) {
          // If increment function doesn't exist, do manual update
          const { error: updateError } = await client
            .from('links')
            .update({ click_count: 1 })
            .eq('id', linkId);
          
          if (updateError && !updateError.message.includes('does not exist')) {
            logger.warn('trackLinkClick: Could not update click count', { error: updateError.message });
          }
        }
      } catch {
        // Silently fail if click_count column doesn't exist yet
        logger.warn('trackLinkClick: Could not update click count');
      }
    }

    logger.debug('trackLinkClick: Success', { linkId, source });
  } catch (error: any) {
    // Don't throw - analytics should never break the app
    logger.warn('trackLinkClick: Failed (non-critical)', { 
      linkId, 
      error: error.message 
    });
  }
};

// Get most clicked links for a user
export const getMostClickedLinks = async (
  userId: string,
  limit: number = 10,
  days: number = 30
): Promise<LinkAnalytics[]> => {
  const client = requireSupabase();
  
  try {
    // Try using the RPC function first
    const { data: rpcData, error: rpcError } = await client.rpc('get_most_clicked_links', {
      p_user_id: userId,
      p_limit: limit,
      p_days: days,
    });

    if (!rpcError && rpcData) {
      return rpcData.map((item: any) => ({
        linkId: item.link_id,
        linkName: item.link_name,
        linkUrl: item.link_url,
        totalClicks: parseInt(item.total_clicks) || 0,
        lastClicked: item.last_clicked,
      }));
    }

    // Fallback: direct query
    logger.debug('getMostClickedLinks: RPC failed, using fallback', { error: rpcError?.message });
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await client
      .from('links')
      .select('id, name, url, click_count')
      .eq('user_id', userId)
      .gt('click_count', 0)
      .order('click_count', { ascending: false })
      .limit(limit);

    if (error) {
      // If click_count doesn't exist, return empty array
      if (error.message.includes('does not exist')) {
        return [];
      }
      throw error;
    }

    return (data || []).map((item: any) => ({
      linkId: item.id,
      linkName: item.name,
      linkUrl: item.url,
      totalClicks: item.click_count || 0,
      lastClicked: null,
    }));
  } catch (error: any) {
    logger.warn('getMostClickedLinks: Failed', { 
      userId, 
      error: error.message 
    });
    return [];
  }
};

// Get click analytics for a specific link
export const getLinkClickAnalytics = async (
  linkId: string,
  userId: string,
  days: number = 30
): Promise<{ totalClicks: number; clicksByDay: { date: string; count: number }[] }> => {
  const client = requireSupabase();
  
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const { data, error } = await client
      .from('link_analytics')
      .select('clicked_at')
      .eq('link_id', linkId)
      .eq('user_id', userId)
      .gte('clicked_at', cutoffDate.toISOString())
      .order('clicked_at', { ascending: true });

    if (error) {
      if (error.message.includes('does not exist')) {
        return { totalClicks: 0, clicksByDay: [] };
      }
      throw error;
    }

    // Group by day
    const clicksByDay: Record<string, number> = {};
    (data || []).forEach((item: any) => {
      const date = new Date(item.clicked_at).toISOString().split('T')[0];
      clicksByDay[date] = (clicksByDay[date] || 0) + 1;
    });

    return {
      totalClicks: data?.length || 0,
      clicksByDay: Object.entries(clicksByDay).map(([date, count]) => ({ date, count })),
    };
  } catch (error: any) {
    logger.warn('getLinkClickAnalytics: Failed', { 
      linkId, 
      error: error.message 
    });
    return { totalClicks: 0, clicksByDay: [] };
  }
};
