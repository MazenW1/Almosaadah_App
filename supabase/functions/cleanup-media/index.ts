// supabase/functions/cleanup-media/index.ts
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'cleanup'

    if (action === 'cleanup') {
      const limit = parseInt(url.searchParams.get('limit') || '50')
      const { data: expiredFiles, error: fetchErr } = await supabase
        .from('media_files')
        .select('id, file_path, file_name')
        .eq('is_deleted', false)
        .lt('expires_at', new Date().toISOString())
        .limit(limit)

      if (fetchErr) throw fetchErr
      if (!expiredFiles?.length) return json({ success: true, message: 'لا يوجد ملفات للتحليل', deletedCount: 0 })

      const deleted: string[] = []
      for (const file of expiredFiles) {
        await supabase.storage.from('whatsapp-media').remove([file.file_path])
        await supabase.from('media_files').update({ is_deleted: true }).eq('id', file.id)
        deleted.push(file.file_name)
      }

      return json({ success: true, message: `تم حذف ${deleted.length} ملف`, deletedCount: deleted.length })
    }
    
    return json({ error: 'Action not found' }, 400)
  } catch (err: any) {
    return json({ error: err.message }, 500)
  }
})