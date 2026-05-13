// supabase/functions/whatsapp/index.ts
// ─────────────────────────────────────────────────────────────
//  WhatsApp Edge Function — يعمل داخل Supabase مباشرة
//  يغطي: Webhook + Send + Bulk + Verify
// ─────────────────────────────────────────────────────────────

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Constants ──
const META_VERSION = 'v19.0'
const META_BASE    = `https://graph.facebook.com/${META_VERSION}`

// ── CORS Headers ──
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey, x-supabase-client',
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

// ═══════════════════════════════════════════════════════════════
//  Supabase Client (Service Role — يكتب بدون RLS)
// ═══════════════════════════════════════════════════════════════
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  )
}

// ═══════════════════════════════════════════════════════════════
//  Helper: جلب إعدادات API مفككة التشفير (config مشترك للنظام)
// ═══════════════════════════════════════════════════════════════
async function getConfig(supabase: ReturnType<typeof getSupabase>) {
  const { data, error } = await supabase
    .from('whatsapp_config')
    .select('api_token_enc, phone_number_id_enc, waba_id_enc, webhook_secret_enc')
    .eq('config_key', 'main')
    .eq('is_active', true)
    .maybeSingle()

  if (error || !data) throw new Error('لم يتم العثور على إعدادات API — أضفها من صفحة الإعدادات')

  const encKey = Deno.env.get('WA_ENCRYPTION_KEY') || ''

  // يدعم base64 بسيط وAES-GCM معاً
  const decrypt = async (enc: string): Promise<string> => {
    if (!enc) return ''
    // جرب AES-GCM أولاً إذا عندنا مفتاح
    if (encKey) {
      try {
        const keyData   = new TextEncoder().encode(encKey.padEnd(32, '0').slice(0, 32))
        const key       = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['decrypt'])
        const combined  = Uint8Array.from(atob(enc), c => c.charCodeAt(0))
        const iv        = combined.slice(0, 12)
        const cipher    = combined.slice(12)
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
        return new TextDecoder().decode(decrypted)
      } catch {
        // إذا فشل AES-GCM جرب base64 عادي
      }
    }
    // base64 بسيط (btoa)
    try { return atob(enc) } catch { return enc }
  }

  return {
    api_token:       await decrypt(data.api_token_enc),
    phone_number_id: await decrypt(data.phone_number_id_enc),
    waba_id:         data.waba_id_enc        ? await decrypt(data.waba_id_enc)        : null,
    webhook_secret:  data.webhook_secret_enc ? await decrypt(data.webhook_secret_enc) : null,
  }
}

// ═══════════════════════════════════════════════════════════════
//  Helper: إرسال عبر Meta Cloud API
// ═══════════════════════════════════════════════════════════════
async function metaSend(phoneNumberId: string, token: string, payload: object) {
  const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'فشل الإرسال')
  return data
}

// ═══════════════════════════════════════════════════════════════
//  Helper: حفظ رسالة في messages
// ═══════════════════════════════════════════════════════════════
async function saveMsg(supabase: ReturnType<typeof getSupabase>, msg: {
  employee_id?: string; phone_number: string
  contact_name?: string; direction: string; message_type?: string
  body?: string; media_url?: string; media_mime_type?: string
  template_name?: string; wa_message_id?: string; status?: string
  is_bulk?: boolean; bulk_campaign_id?: string
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ message_type: 'text', status: 'sent', is_bulk: false, ...msg })
    .select('id')
    .single()
  if (error) throw error
  return data.id as string
}

// ═══════════════════════════════════════════════════════════════
//  MAIN HANDLER
// ═══════════════════════════════════════════════════════════════
serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  const url      = new URL(req.url)
  const supabase = getSupabase()

  try {

    // ─────────────────────────────────────────────────────────
    //  1. WEBHOOK — GET (التحقق عند إعداد ميتا)
    // ─────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const mode      = url.searchParams.get('hub.mode')
      const token     = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')
      const expected  = Deno.env.get('WEBHOOK_VERIFY_TOKEN') || ''

      if (mode === 'subscribe' && token === expected && challenge) {
        console.log('[Webhook] ✓ تم التحقق')
        return new Response(challenge, { status: 200, headers: CORS })
      }
      return new Response('Forbidden', { status: 403, headers: CORS })
    }

    // قراءة الـ body أولاً
    const body   = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    // action يُقبل من URL params أو من body
    const action = url.searchParams.get('action') || body.action || null

    // ─────────────────────────────────────────────────────────
    //  2. WEBHOOK — POST (استقبال رسائل من ميتا — بدون action)
    // ─────────────────────────────────────────────────────────
    if (req.method === 'POST' && !action) {
      handleWebhook(supabase, body).catch(e => console.error('[Webhook]', e.message))
      return new Response('OK', { status: 200, headers: CORS })
    }

    // ─────────────────────────────────────────────────────────
    //  3. VERIFY — اختبار صحة الـ API Key
    // ─────────────────────────────────────────────────────────
    if (action === 'verify') {
      const { apiToken, phoneNumberId } = body
      if (!apiToken || !phoneNumberId) return json({ error: 'بيانات ناقصة' }, 400)

      const res = await fetch(
        `${META_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      )
      const data = await res.json()
      if (!res.ok) return json({ error: data?.error?.message || 'بيانات غير صحيحة' }, 400)

      return json({
        valid:         true,
        displayPhone:  data.display_phone_number,
        verifiedName:  data.verified_name,
        qualityRating: data.quality_rating,
      })
    }

    // ─────────────────────────────────────────────────────────
    //  4. SAVE-CONFIG — حفظ credentials مشفرة في Supabase
    //     يعمل بدون userId لأن الـ config مشترك للنظام
    // ─────────────────────────────────────────────────────────
    if (action === 'save-config') {
      const { apiToken, phoneNumberId, wabaId, webhookSecret } = body
      if (!apiToken || !phoneNumberId) return json({ error: 'بيانات ناقصة' }, 400)

      // التحقق من صحة البيانات مع ميتا أولاً
      const verifyRes = await fetch(
        `${META_BASE}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${apiToken}` } }
      )
      const metaData = await verifyRes.json()
      if (!verifyRes.ok) return json({ error: metaData?.error?.message || 'بيانات API غير صحيحة' }, 400)

      // التشفير عبر pg functions + upsert
      const encKey = Deno.env.get('WA_ENCRYPTION_KEY') || ''
      if (!encKey) return json({ error: 'مفتاح التشفير غير محدد' }, 500)

      // تشفير بسيط بـ AES عبر Web Crypto (Deno يدعمه)
      const encrypt = async (text: string): Promise<string> => {
        const keyData  = new TextEncoder().encode(encKey.padEnd(32, '0').slice(0, 32))
        const key      = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt'])
        const iv       = crypto.getRandomValues(new Uint8Array(12))
        const encoded  = new TextEncoder().encode(text)
        const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
        const combined = new Uint8Array(iv.length + encrypted.byteLength)
        combined.set(iv)
        combined.set(new Uint8Array(encrypted), iv.length)
        return btoa(String.fromCharCode(...combined))
      }

      const { error: dbErr } = await supabase
        .from('whatsapp_config')
        .upsert({
          config_key:          'main',
          api_token_enc:       await encrypt(apiToken),
          phone_number_id_enc: await encrypt(phoneNumberId),
          waba_id_enc:         wabaId         ? await encrypt(wabaId)         : null,
          webhook_secret_enc:  webhookSecret  ? await encrypt(webhookSecret)  : null,
          display_phone:       metaData.display_phone_number,
          verified_name:       metaData.verified_name,
          quality_rating:      metaData.quality_rating,
          is_active:           true,
          updated_at:          new Date().toISOString(),
        }, { onConflict: 'config_key' })

      if (dbErr) throw new Error(dbErr.message)

      return json({
        success:       true,
        displayPhone:  metaData.display_phone_number,
        verifiedName:  metaData.verified_name,
        qualityRating: metaData.quality_rating,
      })
    }

    // من هنا نحتاج config الجمعية
    // ← هذا هو ضمان الفصل: كل عملية تجلب config الجمعية بـ userId الخاص بها فقط
    const config = await getConfig(supabase)

    // ─────────────────────────────────────────────────────────
    //  4. SEND — إرسال رسالة نصية
    // ─────────────────────────────────────────────────────────
    if (action === 'send') {
      const { employeeId, to, message } = body
      if (!to || !message?.trim()) return json({ error: 'بيانات ناقصة' }, 400)

      const result      = await metaSend(config.phone_number_id, config.api_token, {
        to, type: 'text', text: { body: message.trim(), preview_url: false },
      })
      const waMessageId = result.messages?.[0]?.id

      const msgId = await saveMsg(supabase, {
        employee_id: employeeId,
        phone_number: to, direction: 'outbound',
        body: message.trim(), wa_message_id: waMessageId,
      })

      return json({ success: true, messageId: msgId, waMessageId })
    }

    // ─────────────────────────────────────────────────────────
    //  5. SEND-MEDIA — إرسال صورة أو ملف
    // ─────────────────────────────────────────────────────────
    if (action === 'send-media') {
      const { employeeId, to, mediaType, mediaUrl, caption, fileName } = body
      if (!to || !mediaUrl || !mediaType) return json({ error: 'بيانات ناقصة' }, 400)

      const result = await metaSend(config.phone_number_id, config.api_token, {
        to, type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          ...(caption  && { caption }),
          ...(fileName && mediaType === 'document' && { filename: fileName }),
        },
      })
      const waMessageId = result.messages?.[0]?.id

      await saveMsg(supabase, {
        employee_id: employeeId,
        phone_number: to, direction: 'outbound',
        message_type: mediaType === 'document' ? 'file' : mediaType,
        body: caption, media_url: mediaUrl, wa_message_id: waMessageId,
      })

      return json({ success: true, waMessageId })
    }

    // ─────────────────────────────────────────────────────────
    //  6. SEND-LOCATION — إرسال موقع
    // ─────────────────────────────────────────────────────────
    if (action === 'send-location') {
      const { employeeId, to, lat, lng, name, address } = body
      if (!to || !lat || !lng) return json({ error: 'بيانات ناقصة' }, 400)

      const result = await metaSend(config.phone_number_id, config.api_token, {
        to, type: 'location',
        location: { latitude: lat, longitude: lng, name, address },
      })
      const waMessageId = result.messages?.[0]?.id

      await saveMsg(supabase, {
        employee_id: employeeId,
        phone_number: to, direction: 'outbound',
        message_type: 'location',
        body: JSON.stringify({ lat, lng, name }),
        wa_message_id: waMessageId,
      })

      return json({ success: true, waMessageId })
    }

    // ─────────────────────────────────────────────────────────
    //  7. SEND-TEMPLATE — إرسال قالب معتمد
    // ─────────────────────────────────────────────────────────
    if (action === 'send-template') {
      const { employeeId, to, templateName, languageCode = 'ar', components = [] } = body
      if (!to || !templateName) return json({ error: 'بيانات ناقصة' }, 400)

      const result = await metaSend(config.phone_number_id, config.api_token, {
        to, type: 'template',
        template: { name: templateName, language: { code: languageCode }, components },
      })
      const waMessageId = result.messages?.[0]?.id

      await saveMsg(supabase, {
        employee_id: employeeId,
        phone_number: to, direction: 'outbound',
        message_type: 'template', template_name: templateName,
        wa_message_id: waMessageId,
      })

      return json({ success: true, waMessageId })
    }

    // ─────────────────────────────────────────────────────────
    //  8. BULK — إرسال جماعي
    //  يُنشئ حملة ويُرسل بشكل تدريجي آمن
    // ─────────────────────────────────────────────────────────
    if (action === 'bulk') {
      const { employeeId, numbers, templateName, languageCode = 'ar', components = [], freeText } = body
      if (!numbers?.length) return json({ error: 'لا توجد أرقام' }, 400)
      if (!templateName && !freeText) return json({ error: 'بيانات ناقصة' }, 400)

      // إنشاء سجل الحملة
      const { data: campaign, error: campErr } = await supabase
        .from('bulk_campaigns')
        .insert({
          employee_id:   employeeId,
          template_name: templateName || 'free_text',
          template_body: freeText || JSON.stringify(components),
          total_count:   numbers.length,
          status:        'running',
        })
        .select('id').single()

      if (campErr) throw campErr
      const campaignId = campaign.id

      // رد فوري — الإرسال يكمل في الخلفية
      const responsePromise = json({ success: true, campaignId, total: numbers.length })

      // إرسال تدريجي في الخلفية
      ;(async () => {
        let sent = 0, failed = 0

        for (const number of numbers) {
          try {
            let payload: any

            if (freeText) {
              // نص حر — يشتغل داخل نافذة 24 ساعة فقط
              payload = { to: number, type: 'text', text: { body: freeText } }
            } else {
              // قالب معتمد
              payload = { to: number, type: 'template', template: { name: templateName, language: { code: languageCode }, components } }
            }

            const result = await metaSend(config.phone_number_id, config.api_token, payload)
            const waMessageId = result.messages?.[0]?.id

            await saveMsg(supabase, {
              employee_id:     employeeId,
              phone_number:    number,
              direction:       'outbound',
              message_type:    freeText ? 'text' : 'template',
              template_name:   templateName,
              body:            freeText,
              wa_message_id:   waMessageId,
              is_bulk:         true,
              bulk_campaign_id: campaignId,
            })
            sent++
          } catch (e: any) {
            console.error(`[Bulk] فشل ${number}:`, e.message)
            await saveMsg(supabase, {
              employee_id:     employeeId,
              phone_number:    number,
              direction:       'outbound',
              message_type:    freeText ? 'text' : 'template',
              template_name:   templateName,
              status:          'failed',
              is_bulk:         true,
              bulk_campaign_id: campaignId,
            })
            failed++
          }
          await new Promise(r => setTimeout(r, 15))
        }

        await supabase
          .from('bulk_campaigns')
          .update({ sent_count: sent, failed_count: failed, status: 'done' })
          .eq('id', campaignId)

        console.log(`[Bulk] ✓ ${campaignId} — أُرسل: ${sent} فشل: ${failed}`)
      })()

      return responsePromise
    }

    return json({ error: 'action غير معروف' }, 400)

  } catch (err: any) {
    console.error('[WhatsApp Function]', err.message)
    return json({ error: err.message }, 500)
  }
})

// ═══════════════════════════════════════════════════════════════
//  Webhook Handler — يعمل في الخلفية بعد إرجاع 200 لميتا
//  الفصل مضمون: كل جمعية عندها waba_id مختلف في whatsapp_config
// ═══════════════════════════════════════════════════════════════
async function handleWebhook(supabase: ReturnType<typeof getSupabase>, body: any) {
  if (body.object !== 'whatsapp_business_account') return

  for (const entry of body.entry || []) {
    const wabaId = entry.id

    // جلب api_token من config الموحد
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('api_token_enc')
      .eq('config_key', 'main')
      .eq('is_active', true)
      .maybeSingle()

    if (!config) {
      console.warn('[Webhook] لا يوجد config نشط')
      continue
    }

    // فك تشفير الـ token
    let apiToken = ''
    try {
      const encKey  = Deno.env.get('WA_ENCRYPTION_KEY') || ''
      const keyData = new TextEncoder().encode(encKey.padEnd(32, '0').slice(0, 32))
      const key     = await crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['decrypt'])
      const combined = Uint8Array.from(atob(config.api_token_enc), c => c.charCodeAt(0))
      const iv      = combined.slice(0, 12)
      const cipher  = combined.slice(12)
      const dec     = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
      apiToken      = new TextDecoder().decode(dec)
    } catch (e) {
      console.error('[Webhook] فشل فك التشفير:', e)
      continue
    }

    for (const change of entry.changes || []) {
      const value = change.value
      if (!value) continue

      // ── رسائل واردة ──
      for (const msg of value.messages || []) {
        const from        = msg.from
        const waMessageId = msg.id
        const profileName = value.contacts?.find((c: any) => c.wa_id === from)?.profile?.name

        // تجنب التكرار
        const { data: exists } = await supabase
          .from('messages')
          .select('id')
          .eq('wa_message_id', waMessageId)
          .maybeSingle()

        if (exists) continue

        let messageType = msg.type === 'document' ? 'file' : msg.type
        let msgBody     = null
        let mediaUrl    = null
        let mediaMime   = null

        if (msg.type === 'text') {
          msgBody = msg.text?.body
        } else if (['image', 'document', 'audio', 'video'].includes(msg.type)) {
          const mediaObj = msg[msg.type]
          mediaMime      = mediaObj.mime_type
          msgBody        = mediaObj.caption || null
          try {
            const r = await fetch(`${META_BASE}/${mediaObj.id}`, {
              headers: { Authorization: `Bearer ${apiToken}` },
            })
            const d = await r.json()
            mediaUrl = d.url || null
          } catch {}
        } else if (msg.type === 'location') {
          msgBody     = JSON.stringify({ lat: msg.location.latitude, lng: msg.location.longitude })
          messageType = 'location'
        }

        await saveMsg(supabase, {
          phone_number:    from,
          contact_name:    profileName,
          direction:       'inbound',
          message_type:    messageType,
          body:            msgBody,
          media_url:       mediaUrl,
          media_mime_type: mediaMime,
          wa_message_id:   waMessageId,
          status:          'sent',
        })

        console.log(`[Webhook] ✓ رسالة واردة من ${from}`)
      }

      // ── تحديث حالة الرسائل الصادرة ──
      for (const statusUpdate of value.statuses || []) {
        const { id: waId, status } = statusUpdate
        if (!['delivered', 'read', 'failed'].includes(status)) continue

        await supabase
          .from('messages')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('wa_message_id', waId)
      }
    }
  }
}