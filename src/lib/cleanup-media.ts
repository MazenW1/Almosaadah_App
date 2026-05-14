// src/lib/cleanup-media.ts
import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-media`;
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** استدعاء التنظيف من الواجهة */
export const triggerEdgeCleanup = async (limit = 50) => {
  try {
    const res = await fetch(`${FUNCTION_URL}?action=cleanup&limit=${limit}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'فشل التنظيف');
    return { success: true, ...data };
  } catch (err: any) {
    console.error('Cleanup error:', err);
    return { success: false, error: err.message };
  }
};

/** إحصائيات الملفات */
export const getMediaStats = async () => {
  try {
    const res = await fetch(`${FUNCTION_URL}?action=stats`, {
      headers: { Authorization: `Bearer ${ANON_KEY}` },
    });
    const data = await res.json();
    return data;
  } catch {
    return { total: 0, expired: 0 };
  }
};