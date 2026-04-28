import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, News } from '../lib/supabase';

// ─── Security helpers ────────────────────────────────────────────────────────

const NEWS_PER_PAGE = 6;
const MAX_RETRIES = 3;

/** التحقق من صحة UUID لمنع SQL injection */
const isValidId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_\-]{1,64}$/.test(id);

/** تنظيف بيانات الخبر قبل الإرسال لقاعدة البيانات */
const sanitizeNewsInput = (input: Partial<News>): Partial<News> => {
  const clean: Partial<News> = {};

  if (input.title !== undefined)
    clean.title = String(input.title).slice(0, 300).trim();

  if (input.excerpt !== undefined)
    clean.excerpt = String(input.excerpt).slice(0, 2000).trim();

  if (input.category !== undefined)
    clean.category = String(input.category).slice(0, 100).trim();

  if (input.author !== undefined)
    clean.author = String(input.author).slice(0, 150).trim();

  if (input.image !== undefined) {
    const url = String(input.image).trim();
    clean.image = /^https?:\/\//i.test(url) ? url : '';
  }

  if (input.tweet !== undefined) {
    const url = String(input.tweet).trim();
    clean.tweet = /^https?:\/\//i.test(url) ? url : '';
  }

  if (input.date !== undefined)
    clean.date = String(input.date).slice(0, 30).trim();

  return clean;
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface UseNewsReturn {
  news: News[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  deleteNews: (id: string) => Promise<void>;
  createNews: (news: Omit<News, 'id' | 'created_at'>) => Promise<void>;
  updateNews: (id: string, news: Partial<News>) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useNews(_userId?: string, _isAdmin?: boolean): UseNewsReturn {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastCursorRef = useRef<string | null>(null);
  const isLoadingRef = useRef(false);
  const mountedRef = useRef(true);

  // تنظيف عند إلغاء تحميل المكوّن
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchNews = useCallback(async (isLoadMore = false, attempt = 1) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;

    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      let query = supabase
        .from('news')
        .select(
          'id, title, excerpt, category, author, image, tweet, date, created_at, timestamp, city_info, device_info'
        )
        .order('timestamp', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(NEWS_PER_PAGE);

      if (isLoadMore && lastCursorRef.current) {
        query = query.lt('created_at', lastCursorRef.current);
      }

      const { data, error: supaError } = await query;

      if (supaError) {
        // إعادة المحاولة عند خطأ الشبكة
        if (attempt < MAX_RETRIES && supaError.code === 'PGRST301') {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          isLoadingRef.current = false;
          return fetchNews(isLoadMore, attempt + 1);
        }
        throw supaError;
      }

      if (!mountedRef.current) return;

      if (data && data.length > 0) {
        lastCursorRef.current = data[data.length - 1].created_at;

        if (isLoadMore) {
          setNews((prev) => {
            const existingIds = new Set(prev.map((n) => n.id));
            const newItems = data.filter((n) => !existingIds.has(n.id));
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
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'حدث خطأ في تحميل الأخبار';
      setError(msg);
      console.error('[useNews] fetchNews error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchNews(false);
  }, [fetchNews]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingRef.current) return;
    await fetchNews(true);
  }, [hasMore, fetchNews]);

  const refresh = useCallback(async () => {
    lastCursorRef.current = null;
    setHasMore(true);
    await fetchNews(false);
  }, [fetchNews]);

  const deleteNews = useCallback(async (id: string) => {
    if (!isValidId(id)) throw new Error('معرف الخبر غير صالح');

    try {
      const { error } = await supabase.from('news').delete().eq('id', id);
      if (error) throw error;

      if (mountedRef.current) {
        setNews((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('[useNews] deleteNews error:', err);
      throw err;
    }
  }, []);

  const createNews = useCallback(
    async (newsItem: Omit<News, 'id' | 'created_at'>) => {
      const cleanItem = sanitizeNewsInput(newsItem as Partial<News>);

      if (!cleanItem.title?.trim()) {
        throw new Error('عنوان الخبر مطلوب');
      }

      try {
        const { error } = await supabase.from('news').insert([cleanItem]);
        if (error) throw error;
        await refresh();
      } catch (err) {
        console.error('[useNews] createNews error:', err);
        throw err;
      }
    },
    [refresh]
  );

  const updateNews = useCallback(
    async (id: string, updates: Partial<News>) => {
      if (!isValidId(id)) throw new Error('معرف الخبر غير صالح');

      const cleanUpdates = sanitizeNewsInput(updates);

      // إزالة الحقول الثابتة من التحديث
      const { id: _id, created_at: _ca, ...safeUpdates } = cleanUpdates as News;

      try {
        const { error } = await supabase
          .from('news')
          .update(safeUpdates)
          .eq('id', id);
        if (error) throw error;

        if (mountedRef.current) {
          setNews((prev) =>
            prev.map((n) => (n.id === id ? { ...n, ...safeUpdates } : n))
          );
        }
      } catch (err) {
        console.error('[useNews] updateNews error:', err);
        throw err;
      }
    },
    []
  );

  return {
    news,
    loading,
    hasMore,
    error,
    loadMore,
    refresh,
    deleteNews,
    createNews,
    updateNews,
  };
}