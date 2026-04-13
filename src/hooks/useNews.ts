import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, News } from '../lib/supabase';

interface UseNewsReturn {
  news: News[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  createNews: (news: Omit<News, 'id' | 'created_at'>) => Promise<void>;
  updateNews: (id: string, news: Partial<News>) => Promise<void>;
}

const NEWS_PER_PAGE = 6;

export function useNews(userId?: string, isAdmin?: boolean): UseNewsReturn {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const lastVisibleRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);

  const fetchNews = useCallback(async (isLoadMore = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);

    try {
      let query = supabase
        .from('news')
        .select('*') // جلب جميع الحقول
       .order('timestamp', { ascending: false, nullsFirst: false })
        .limit(NEWS_PER_PAGE);

      if (isLoadMore && lastVisibleRef.current) {
        query = query.lt('created_at', lastVisibleRef.current);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        lastVisibleRef.current = data[data.length - 1].created_at;

        if (isLoadMore) {
          setNews(prev => {
            const existingIds = new Set(prev.map(n => n.id));
            const newItems = data.filter(n => !existingIds.has(n.id));
            return [...prev, ...newItems];
          });
        } else {
          setNews(data);
        }
        setHasMore(data.length >= NEWS_PER_PAGE);
      } else {
        setHasMore(false);
        if (!isLoadMore) setNews([]);
      }
    } catch (error) {
      console.error('Error fetching news:', error);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNews(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingRef.current) return;
    await fetchNews(true);
  }, [hasMore, fetchNews]);

  const refresh = useCallback(async () => {
    lastVisibleRef.current = null;
    setHasMore(true);
    await fetchNews(false);
  }, [fetchNews]);

  const deleteNewsHandler = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;
      setNews(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Error deleting news:', error);
      throw error;
    }
  }, []);

  const createNewsHandler = useCallback(async (newsItem: Omit<News, 'id' | 'created_at'>) => {
    try {
      const { error } = await supabase.from('news').insert([newsItem]);
      if (error) throw error;
      await refresh();
    } catch (error) {
      console.error('Error creating news:', error);
      throw error;
    }
  }, [refresh]);

  const updateNewsHandler = useCallback(async (id: string, updates: Partial<News>) => {
    try {
      const { error } = await supabase.from('news').update(updates).eq('id', id);
      if (error) throw error;
      setNews(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
    } catch (error) {
      console.error('Error updating news:', error);
      throw error;
    }
  }, []);

  return {
    news,
    loading,
    hasMore,
    loadMore,
    refresh,
    deleteNews: deleteNewsHandler,
    createNews: createNewsHandler,
    updateNews: updateNewsHandler,
  };
}
