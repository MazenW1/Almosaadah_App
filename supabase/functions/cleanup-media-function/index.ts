// supabase/functions/cleanup-media-function/index.ts
// ─────────────────────────────────────────────────────────────
//  حذف الوسائط المنتهية الصلاحية (بعد 15 يوم)
// ─────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-supabase-client',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const url = new URL(req.url)
  const supabase = getSupabase()

  try {
    const action = url.searchParams.get('action') || 'cleanup'

    // ══ حذف الملفات المنتهية ══
    if (action === 'cleanup') {
      const limit = parseInt(url.searchParams.get('limit') || '50')

      const { data: expiredFiles, error: fetchErr } = await supabase
        .from('media_files')
        .select('id, file_path, file_name')
        .eq('is_deleted', false)
        .lt('expires_at', new Date().toISOString())
        .limit(limit)

      if (fetchErr) throw fetchErr
      if (!expiredFiles || expiredFiles.length === 0) {
        return json({ success: true, message: 'لا توجد ملفات منتهية', deletedCount: 0 })
      }

      const deleted: string[] = []
      for (const file of expiredFiles) {
        // حذف من Storage
        await supabase.storage.from('whatsapp-media').remove([file.file_path])
        // تحديث السجل
        await supabase.from('media_files').update({ is_deleted: true }).eq('id', file.id)
        deleted.push(file.file_name)
      }

      return json({
        success: true,
        message: `تم حذف ${deleted.length} ملف منتهي`,
        deletedCount: deleted.length,
        deletedFiles: deleted,
      })
    }

    // ══ إحصائيات ══
    if (action === 'stats') {
      const { count: total } = await supabase
        .from('media_files').select('*', { count: 'exact', head: true }).eq('is_deleted', false)

      const { count: expired } = await supabase
        .from('media_files').select('*', { count: 'exact', head: true })
        .eq('is_deleted', false).lt('expires_at', new Date().toISOString())

      return json({ total: total || 0, expired: expired || 0 })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})