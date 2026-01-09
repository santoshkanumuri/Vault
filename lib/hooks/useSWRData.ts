'use client';

import useSWR from 'swr';
import * as db from '@/lib/services/database';

// SWR fetchers
const fetchers = {
  folders: (userId: string) => db.getFolders(userId),
  tags: (userId: string) => db.getTags(userId),
  links: (userId: string, page: number = 1) => db.getLinks(userId, page, 50),
  notes: (userId: string, page: number = 1) => db.getNotes(userId, page, 50),
};

export const useFolders = (userId: string | null) => {
  const { data, error, mutate } = useSWR(
    userId ? ['folders', userId] : null,
    () => fetchers.folders(userId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    folders: data || [],
    isLoading: !error && !data,
    error,
    mutate,
  };
};

export const useTags = (userId: string | null) => {
  const { data, error, mutate } = useSWR(
    userId ? ['tags', userId] : null,
    () => fetchers.tags(userId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    tags: data || [],
    isLoading: !error && !data,
    error,
    mutate,
  };
};

export const useLinks = (userId: string | null, page: number = 1) => {
  const { data, error, mutate } = useSWR(
    userId ? ['links', userId, page] : null,
    () => fetchers.links(userId!, page),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  return {
    links: data?.links || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading: !error && !data,
    error,
    mutate,
  };
};

export const useNotes = (userId: string | null, page: number = 1) => {
  const { data, error, mutate } = useSWR(
    userId ? ['notes', userId, page] : null,
    () => fetchers.notes(userId!, page),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
      keepPreviousData: true,
    }
  );

  return {
    notes: data?.notes || [],
    total: data?.total || 0,
    hasMore: data?.hasMore || false,
    isLoading: !error && !data,
    error,
    mutate,
  };
};
