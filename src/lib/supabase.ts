// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Environment Validation ═════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── التحقق من وجود المتغيرات ──
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('[Supabase] VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY مطلوبان في ملف .env')
}

// ── التحقق من صحة URL ──
try {
  const parsed = new URL(supabaseUrl)
  if (!parsed.hostname.endsWith('.supabase.co')) {
    throw new Error('[Supabase] VITE_SUPABASE_URL يجب أن ينتهي بـ .supabase.co')
  }
} catch {
  throw new Error('[Supabase] VITE_SUPABASE_URL غير صالح')
}

// ── التحقق من الـ ANON KEY ──
try {
  const parts = supabaseAnonKey.split('.')
  if (parts.length === 3) {
    const payload = JSON.parse(atob(parts[1]))
    if (payload?.role === 'service_role') {
      throw new Error('[Supabase] ⛔ VITE_SUPABASE_ANON_KEY يحتوي على service_role key!')
    }
  }
} catch (e: any) {
  if (e.message.includes('service_role')) throw e
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storageKey: 'sb-session',
  },
  global: {
    headers: {
      'X-Client-Info': 'almosaadah-web/1.0',
    },
    fetch: (url, options) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(timeout));
    },
  },
})

// ── مسح الـ session الفاسدة تلقائياً عند فشل الـ Refresh Token ──
supabase.auth.onAuthStateChange((event) => {
  if ((event as string) === 'TOKEN_REFRESH_FAILED') {
    try {
      supabase.auth.signOut({ scope: 'local' }).catch(() => {})
      Object.keys(localStorage)
        .filter(k => k.startsWith('sb-') || k.startsWith('supabase.auth'))
        .forEach(k => localStorage.removeItem(k))
    } catch {}
  }
})

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Types Definitions (جميع الجداول) ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Notifications ─────────────────────────────────────────────────────────────
export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  body?: string
  data?: Record<string, any>
  is_read: boolean
  created_at: string
}

// ─── News ──────────────────────────────────────────────────────────────────────
export interface News {
  id: string
  title: string
  excerpt: string
  date: string
  image: string
  category: string
  tweet?: string
  device_info?: string
  timestamp?: number
  created_by?: string
  author?: string
  created_at: string
  city_info?: string
}

// ─── Services ─────────────────────────────────────────────────────────────────

// قسم مرن: عنوان + قيمة + أيقونة + لون + بنود داخلية اختيارية
export interface ServiceSection {
  label: string     // مثال: "الهدف" | "ضمان المساعدة"
  value: string     // النص داخل القسم
  icon?: string     // fa-bullseye | fa-shield-alt ...
  color?: string    // لون الحدود والنص مثل #0891b2
  items?: string[]  // قائمة بنود داخل القسم (اختياري)
}

// النوع الأساسي — للتوافق مع الكود القديم
export interface Service {
  service_id: string
  service_name: string
  service_description: string
  category?: string
  icon?: string
  is_active: boolean
  created_at?: string
}

// النوع الكامل مع الأعمدة الجديدة
export interface ServiceFull extends Service {
  badge?: string
  badge_icon?: string
  price?: string
  price_color?: string
  emoji?: string
  highlight?: boolean
  sort_order?: number
  sections?: ServiceSection[]
}

// ─── Service Requests ─────────────────────────────────────────────────────────
export interface ServiceRequest {
  request_id: string
  user_id: string
  service_id?: string
  request_notes?: string
  contract_url?: string
  contract_file_name?: string
  request_status: string
  admin_notes?: string
  employee_id?: string
  assigned_to?: string
  created_at: string
  updated_at?: string
  package_type?: string
  terms_accepted?: boolean
  terms_version?: string
  accepted_at?: string
  user?: { association_name: string; user_email: string; user_phone?: string }
  services?: { service_name: string; service_description?: string }
  employees?: { employee_name: string }
}

// ─── Users ────────────────────────────────────────────────────────────────────
export interface User {
  user_id: string
  association_name: string
  user_email: string
  user_phone?: string
  license_number?: string
  entity_type: string
  created_at?: string
  is_review_blocked?: boolean
}

// ─── Employees ────────────────────────────────────────────────────────────────
export interface Employee {
  employee_id: string
  employee_name: string
  employee_email: string
  employee_phone?: string
  employee_role: string
  is_active: boolean
  created_at?: string
  section?: string
}

// ─── Reviews ──────────────────────────────────────────────────────────────────
export interface Review {
  id: string
  user_id: string
  rating: number
  review_text?: string
  is_active: boolean
  is_hidden?: boolean
  created_at: string
  updated_at?: string
  user?: {
    association_name: string
  }
}

// ─── Contracts ────────────────────────────────────────────────────────────────
export interface Contract {
  contract_id: string
  contract_number: string
  client_name: string
  client_phone?: string
  service_name?: string
  employee_id: string
  employee_name?: string
  contract_status: string
  status_reason?: string
  contract_url?: string
  financial_amount?: number
  financial_notes?: string
  fee_tier1_label?: string
  fee_tier1_value?: string
  fee_tier2_label?: string
  fee_tier2_value?: string
  fee_tier3_label?: string
  fee_tier3_value?: string
  contract_type?: string
  contract_details?: string
  start_date?: string
  end_date?: string
  signed_at?: string
  created_by?: string
  created_at: string
  updated_at?: string
  // علاقات
  employee?: { employee_name: string; employee_phone?: string }
  user?: { association_name: string; user_email?: string }
}


export interface Project {
  id: string
  user_id: string
  project_name: string
  duration?: string
  budget?: string
  target_area?: string
  project_type: string
  project_file_url?: string
  file_name?: string
  status: 'pending' | 'approved' | 'rejected'
  is_active: boolean
  created_at: string
  updated_at?: string
  user?: {
    association_name: string
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Auth Helpers ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

export const signIn = (email: string, password: string) => {
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return Promise.resolve({ data: null, error: new Error('صيغة البريد الإلكتروني غير صحيحة') })
  }
  if (password.length < 6 || password.length > 128) {
    return Promise.resolve({ data: null, error: new Error('كلمة المرور غير صالحة') })
  }
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
}

export const signUp = (email: string, password: string) => {
  if (!EMAIL_REGEX.test(email) || email.length > 254) {
    return Promise.resolve({ data: null, error: new Error('صيغة البريد الإلكتروني غير صحيحة') })
  }
  if (password.length < 8 || password.length > 128) {
    return Promise.resolve({ data: null, error: new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل') })
  }
  return supabase.auth.signUp({ email: email.trim().toLowerCase(), password })
}

export const signOut = () => supabase.auth.signOut()
export const getSession = () => supabase.auth.getSession()

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Notifications Operations ════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchNotifications = (userId: string, limit = 50) =>
  supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

export const createNotification = (notification: {
  user_id: string
  type: string
  title: string
  body?: string
  data?: Record<string, any>
}) =>
  supabase.from('notifications').insert([{
    ...notification,
    is_read: false,
    created_at: new Date().toISOString(),
  }])

export const markNotificationAsRead = (id: string) =>
  supabase.from('notifications').update({ is_read: true }).eq('id', id)

export const markAllNotificationsAsRead = (userId: string) =>
  supabase.from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)

export const deleteNotification = (id: string) =>
  supabase.from('notifications').delete().eq('id', id)

export const deleteAllNotifications = (userId: string) =>
  supabase.from('notifications').delete().eq('user_id', userId)



// ═══════════════════════════════════════════════════════════════════════════════
// ═══ News Operations ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchNews = (limit = 6, offset = 0) => {
  const safeLimit = Math.min(Math.max(1, limit), 50)
  const safeOffset = Math.max(0, offset)
  return supabase
    .from('news')
    .select('id, title, excerpt, date, image, category, tweet, timestamp')
    .order('timestamp', { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit - 1)
}

export const createNews = (news: Omit<News, 'id'>) =>
  supabase.from('news').insert([news])

export const deleteNews = (id: string) =>
  supabase.from('news').delete().eq('id', id)

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Services Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchServices = () =>
  supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

export const fetchServiceById = (id: string) =>
  supabase
    .from('services')
    .select('*')
    .eq('service_id', id)
    .eq('is_active', true)
    .single()

export const fetchServiceByName = (name: string) =>
  supabase
    .from('services')
    .select('service_id, service_name, service_description')
    .eq('service_name', name)
    .eq('is_active', true)
    .maybeSingle()

// جلب مع كل الأعمدة الجديدة للصفحة الرئيسية
export const fetchServicesWithSections = async (): Promise<ServiceFull[]> => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data ?? []
}

// إنشاء خدمة أو منتج جديد
export const createService = async (
  service: Omit<ServiceFull, 'created_at'>
): Promise<string> => {
  const { data, error } = await supabase
    .from('services')
    .insert([{ ...service, is_active: true, created_at: new Date().toISOString() }])
    .select('service_id')
    .single()
  if (error) throw error
  return data.service_id
}

// تعديل خدمة أو منتج موجود
export const updateService = async (
  serviceId: string,
  updates: Partial<ServiceFull>
): Promise<void> => {
  const { service_id, created_at, is_active, ...safeUpdates } = updates as any
  console.log('📤 updateService →', serviceId, safeUpdates)
  const { data, error } = await supabase
    .from('services')
    .update(safeUpdates)
    .eq('service_id', serviceId)
    .select()
  console.log('📥 updateService result →', { data, error })
  if (error) throw error
}

// حذف
export const deleteService = (serviceId: string) =>
  supabase.from('services').delete().eq('service_id', serviceId)

// تفعيل / تعطيل
export const toggleServiceActive = (serviceId: string, is_active: boolean) =>
  supabase.from('services').update({ is_active }).eq('service_id', serviceId)

// Real-time — يُعيد تحميل البيانات عند أي تغيير
export const subscribeToServices = (callback: (payload: any) => void, channelId = 'services-changes') =>
  supabase
    .channel(channelId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, callback)
    .subscribe()

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Service Requests Operations ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const createServiceRequest = (request: {
  user_id: string
  service_id?: string
  request_notes?: string
  request_status?: string
  package_type?: string
  terms_accepted?: boolean
  terms_version?: string
  accepted_at?: string
}) =>
  supabase.from('service_requests').insert([{
    ...request,
    request_status: 'pending_review',
  }])

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ User Operations ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchUserProfile = (email: string) =>
  supabase
    .from('user')
    .select('user_id, association_name, user_email, user_phone, entity_type, license_number, is_review_blocked')
    .eq('user_email', email)
    .maybeSingle()

export const fetchUserById = (userId: string) =>
  supabase
    .from('user')
    .select('user_id, association_name, user_email, user_phone, entity_type, license_number, is_review_blocked')
    .eq('user_id', userId)
    .maybeSingle()

export const updateUserBlockStatus = (userId: string, is_blocked: boolean) =>
  supabase
    .from('user')
    .update({ is_review_blocked: is_blocked })
    .eq('user_id', userId)

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Employee Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchEmployeeProfile = (email: string) =>
  supabase
    .from('employees')
    .select('employee_id, employee_name, employee_email, employee_phone, employee_role, is_active, section')
    .eq('employee_email', email)
    .eq('is_active', true)
    .maybeSingle()

export const fetchEmployeeById = (employeeId: string) =>
  supabase
    .from('employees')
    .select('employee_id, employee_name, employee_email, employee_phone, employee_role, is_active, section')
    .eq('employee_id', employeeId)
    .maybeSingle()

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Reviews Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchReviews = () =>
  supabase
    .from('reviews')
    .select('id, user_id, rating, review_text, is_active, created_at, user:user_id(association_name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false })

export const fetchMyReviews = (userId: string) =>
  supabase
    .from('reviews')
    .select('id, rating, review_text, is_active, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5)

export const createReview = (review: {
  user_id: string
  rating: number
  review_text?: string
  is_active?: boolean
}) => {
  const safeRating = Math.min(5, Math.max(1, Math.round(review.rating)))
  return supabase.from('reviews').insert([{
    user_id: review.user_id,
    rating: safeRating,
    review_text: review.review_text?.slice(0, 1000) || null,
    is_active: review.is_active ?? true,
  }])
}

export const deleteReview = (id: string) =>
  supabase.from('reviews').delete().eq('id', id)

export const updateReviewStatus = (id: string, is_active: boolean) =>
  supabase.from('reviews').update({ is_active }).eq('id', id)

export const updateReview = (id: string, updates: Partial<Review>) => {
  const { user_id, created_at, ...safeUpdates } = updates as any
  return supabase.from('reviews').update(safeUpdates).eq('id', id)
}

export const checkUserBlocked = (userId: string) =>
  supabase
    .from('user')
    .select('is_review_blocked')
    .eq('user_id', userId)
    .maybeSingle()

export const toggleUserBlockStatus = (userId: string, is_blocked: boolean) =>
  supabase
    .from('user')
    .update({ is_review_blocked: is_blocked })
    .eq('user_id', userId)

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Projects Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchProjects = (type?: string) => {
  const ALLOWED_TYPES = ['emergency', 'development', 'social', 'seasonal', 'endowment']
  let query = supabase
    .from('projects')
    .select('id, user_id, project_name, project_type, status, is_active, created_at, duration, budget, target_area, project_file_url, file_name, accreditation_body, user:user(association_name)')
    .order('created_at', { ascending: false })

  if (type && type !== 'all') {
    if (!ALLOWED_TYPES.includes(type)) return Promise.resolve({ data: [], error: new Error('نوع مشروع غير صالح') })
    query = query.eq('project_type', type)
  }
  return query
}

export const fetchMyProjects = (userId: string) =>
  supabase
    .from('projects')
    .select('id, project_name, project_type, status, is_active, created_at, duration, budget, target_area')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

export const createProject = (project: {
  user_id: string
  project_name: string
  duration?: string
  budget?: string
  target_area?: string
  project_type: string
  project_file_url?: string | null
  file_name?: string | null
  status?: string
  is_active?: boolean
}) =>
  supabase.from('projects').insert([{
    ...project,
    status: 'pending',
    is_active: project.is_active ?? true,
  }])

export const deleteProject = (id: string) =>
  supabase.from('projects').delete().eq('id', id)

export const updateProjectStatus = (id: string, status: string) => {
  const ALLOWED_STATUSES = ['pending', 'approved', 'rejected']
  if (!ALLOWED_STATUSES.includes(status)) {
    return Promise.resolve({ data: null, error: new Error('حالة مشروع غير صالحة') })
  }
  return supabase.from('projects').update({ status }).eq('id', id)
}

export const updateProject = (id: string, updates: Partial<Project>) => {
  const { user_id, created_at, status, ...safeUpdates } = updates as any
  return supabase.from('projects').update(safeUpdates).eq('id', id)
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Storage Operations ════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_DOC_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'application/zip',
]

export const uploadImage = async (bucket: string, file: File, path: string) => {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new Error('نوع الملف غير مسموح')
  if (file.size > 5 * 1024 * 1024) throw new Error('حجم الصورة يجب أن يكون أقل من 5MB')

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (error) throw error

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return urlData.publicUrl
}

export const getPublicUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path)

export async function uploadProjectFile(file: File, userId: string) {
  if (!ALLOWED_DOC_TYPES.includes(file.type)) {
    throw new Error('نوع الملف غير مسموح')
  }
  if (file.size > 20 * 1024 * 1024) throw new Error('حجم الملف يجب أن يكون أقل من 20MB')

  const ext = file.name.split('.').pop()?.toLowerCase()
  const safeFileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
  const filePath = `projects/${userId}/${safeFileName}`

  const MIME_TYPES: Record<string, string> = {
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt:  'text/plain',
    zip:  'application/zip',
  }
  const contentType = MIME_TYPES[ext || ''] || file.type

  const { data, error } = await supabase.storage
    .from('projects-files')
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType })

  if (error) {
    console.error('Upload error:', error.message)
    throw new Error('فشل رفع الملف')
  }

  const { data: urlData } = supabase.storage
    .from('projects-files')
    .getPublicUrl(filePath)

  return { url: urlData.publicUrl, name: file.name }
}

export const deleteStorageFile = async (bucket: string, path: string) => {
  if (!path || path.includes('..') || path.startsWith('/')) {
    throw new Error('مسار الملف غير صالح')
  }
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Contracts Operations ══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const ALLOWED_CONTRACT_STATUSES = [
  'draft',
  'pending_signature',
  'pending_admin_review',
  'approved',
  'completed',
  'cancelled',
  'expired',
]

export const fetchContracts = () =>
  supabase
    .from('contracts')
    .select(`
      contract_id, contract_number, client_name, client_phone,
      service_name, employee_id, employee_name, contract_status,
      status_reason, contract_url, financial_amount, financial_notes,
      fee_tier1_label, fee_tier1_value,
      fee_tier2_label, fee_tier2_value,
      fee_tier3_label, fee_tier3_value,
      contract_type, contract_details,
      start_date, end_date, signed_at,
      created_by, created_at, updated_at,
      employee:employee_id(employee_name, employee_phone),
      user:created_by(association_name, user_email)
    `)
    .order('created_at', { ascending: false })
    .limit(200)

export const createContract = (contract: {
  contract_number: string
  client_name: string
  client_phone?: string
  service_name?: string
  employee_id: string
  employee_name?: string
  contract_type?: string
  contract_details?: string
  financial_amount?: number | null
  financial_notes?: string
  fee_tier1_label?: string
  fee_tier1_value?: string
  fee_tier2_label?: string
  fee_tier2_value?: string
  fee_tier3_label?: string
  fee_tier3_value?: string
  start_date?: string
  end_date?: string
  created_by?: string
}) =>
  supabase.from('contracts').insert([{
    ...contract,
    contract_status: 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }])

export const updateContract = (id: string, updates: Partial<Contract>) => {
  const { contract_id, created_at, created_by, ...safeUpdates } = updates as any
  return supabase
    .from('contracts')
    .update({ ...safeUpdates, updated_at: new Date().toISOString() })
    .eq('contract_id', id)
}

export const updateContractStatus = (
  id: string,
  status: string,
  reason?: string
) => {
  if (!ALLOWED_CONTRACT_STATUSES.includes(status))
    return Promise.resolve({ data: null, error: new Error('حالة عقد غير صالحة') })

  const payload: Record<string, any> = {
    contract_status: status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'completed') payload.signed_at = new Date().toISOString()
  if (reason) payload.status_reason = reason

  return supabase.from('contracts').update(payload).eq('contract_id', id)
}

export const deleteContract = (id: string) =>
  supabase.from('contracts').delete().eq('contract_id', id)

export const uploadContractFile = async (file: File, contractId: string) => {
  const ALLOWED = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ]
  if (!ALLOWED.includes(file.type)) throw new Error('نوع الملف غير مسموح (PDF أو Word أو صورة)')
  if (file.size > 10 * 1024 * 1024) throw new Error('حجم الملف يجب أن يكون أقل من 10MB')

  const ext = file.name.split('.').pop()?.toLowerCase()
  const path = `contracts/${contractId}_${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('contracts')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) throw upErr

  const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path)

  const { error: updateErr } = await supabase
    .from('contracts')
    .update({ contract_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq('contract_id', contractId)
  if (updateErr) throw updateErr

  return urlData.publicUrl
}

export const subscribeToContracts = (callback: (payload: any) => void) =>
  supabase
    .channel('contracts-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, callback)
    .subscribe()

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Real-time Subscriptions ═══════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════

export const subscribeToReviews = (callback: (payload: any) => void) => {
  return supabase
    .channel('reviews-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, callback)
    .subscribe()
}

export const subscribeToProjects = (callback: (payload: any) => void) => {
  return supabase
    .channel('projects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, callback)
    .subscribe()
}
// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Events Operations ═════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchEvents = () =>
  supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })

export const fetchMyEvents = (userId: string) =>
  supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

export const createEvent = (event: Record<string, any>) =>
  supabase.from('events').insert([{ ...event, is_active: true }]).select('id').single()

export const deleteEvent = (id: string) =>
  supabase.from('events').delete().eq('id', id)

export const updateEventStatus = (id: string, status: string) =>
  supabase.from('events').update({ status }).eq('id', id)

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Jobs Operations ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchJobs = () =>
  supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })

export const fetchMyJobs = (userId: string) =>
  supabase
    .from('jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

export const createJob = (job: Record<string, any>) =>
  supabase.from('jobs').insert([job]).select('id').single()

export const deleteJob = (id: string) =>
  supabase.from('jobs').delete().eq('id', id)

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Real-time: Events & Jobs ══════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const subscribeToNotifications = (userId: string, callback: (payload: any) => void) =>
  supabase
    .channel('notifs_live_' + userId)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, callback)
    .subscribe()

export const subscribeToEvents = (callback: (payload: any) => void) =>
  supabase
    .channel('events-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, callback)
    .subscribe()

export const subscribeToJobs = (callback: (payload: any) => void) =>
  supabase
    .channel('jobs-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, callback)
    .subscribe()

// ─── Supabase Admin Client (Service Role) ────────────────────
// ─── Supabase Admin (اختياري) ─────────────────────────────────────────────────
export const supabaseAdmin = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL as string,
      import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
  : null

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WhatsApp Types ═════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export type WaDirection      = 'inbound' | 'outbound'
export type WaMessageType    = 'text' | 'image' | 'file' | 'location' | 'template'
export type WaStatus         = 'sent' | 'delivered' | 'read' | 'failed'
export type WaCampaignStatus = 'pending' | 'running' | 'done' | 'failed'

// Config — مشترك للنظام كله (ليس per-user)
export interface WhatsAppConfig {
  id:                  string
  config_key:          string   // 'main' دائماً
  display_phone?:      string   // رقم العرض (غير مشفر)
  verified_name?:      string
  quality_rating?:     string
  is_active:           boolean
  created_at:          string
  updated_at:          string
  // الحقول المشفرة لا تُرجع للواجهة مباشرة
}

export interface WaMessage {
  id:               string
  employee_id?:     string
  phone_number:     string
  contact_name?:    string
  direction:        WaDirection
  message_type:     WaMessageType
  body?:            string
  media_url?:       string
  media_mime_type?: string
  template_name?:   string
  wa_message_id?:   string
  status:           WaStatus
  error_message?:   string
  reply_to_id?:     string
  is_bulk:          boolean
  bulk_campaign_id?:string
  created_at:       string
  updated_at:       string
}

export interface WaBulkCampaign {
  id:            string
  employee_id?:  string
  template_name: string
  template_body: string
  total_count:   number
  sent_count:    number
  failed_count:  number
  status:        WaCampaignStatus
  created_at:    string
  updated_at:    string
}

export interface WaConversation {
  phone_number:      string
  contact_name?:     string
  last_message:      string
  last_direction:    WaDirection
  last_message_at:   string
  last_status:       WaStatus
  last_employee_id?: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WhatsApp Config Operations ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** جلب إعدادات الحساب (display_phone, verified_name فقط — بدون credentials) */
export const fetchWhatsAppConfig = () =>
  supabase
    .from('whatsapp_config')
    .select('id, config_key, display_phone, verified_name, quality_rating, is_active, updated_at')
    .eq('config_key', 'main')
    .eq('is_active', true)
    .maybeSingle()

/** حفظ credentials — يمر عبر Edge Function عشان التشفير يصير في السيرفر */
export const upsertWhatsAppConfig = (config: {
  apiToken:       string
  phoneNumberId:  string
  wabaId?:        string
  webhookSecret?: string
}) => callWaFunction('save-config', config)

// ─── Helper: استدعاء Edge Function ───────────────────────────────────────────
const callWaFunction = async (action: string, body: object) => {
  const { data, error } = await supabase.functions.invoke('whatsapp', {
    body: { action, ...body },
  })
  if (error) throw new Error(error.message || 'خطأ في الاتصال بـ Edge Function')
  if (data?.error) throw new Error(data.error)
  return data
}

/** اختبار الاتصال بـ Meta API — يمر عبر Edge Function */
export const verifyWhatsAppApi = async (apiToken: string, phoneNumberId: string) => {
  const data = await callWaFunction('verify', { apiToken, phoneNumberId })
  return data as { valid: boolean; displayPhone: string; verifiedName: string; qualityRating: string }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WhatsApp Messages Operations ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** جلب المحادثات */
export const fetchWaConversations = () =>
  supabase
    .from('conversations')
    .select('*')
    .order('last_message_at', { ascending: false })

/** جلب رسائل محادثة معينة */
export const fetchWaMessages = (phone: string, limit = 50) =>
  supabase
    .from('messages')
    .select('*')
    .eq('phone_number', phone)
    .order('created_at', { ascending: true })
    .limit(limit)

/** إرسال رسالة نصية */
export const sendWaText = async (payload: {
  employeeId?: string; to: string; message: string
}) => {
  const data = await callWaFunction('send', payload)
  return data as { success: boolean; messageId: string; waMessageId: string }
}

/** إرسال وسائط */
export const sendWaMedia = async (payload: {
  employeeId?: string; to: string
  mediaType: 'image' | 'document' | 'audio' | 'video'
  mediaUrl: string; caption?: string; fileName?: string
}) => callWaFunction('send-media', payload)

/** إرسال موقع */
export const sendWaLocation = async (payload: {
  employeeId?: string; to: string
  lat: number; lng: number; name?: string; address?: string
}) => callWaFunction('send-location', payload)

/** إرسال قالب */
export const sendWaTemplate = async (payload: {
  employeeId?: string; to: string
  templateName: string; languageCode?: string; components?: object[]
}) => callWaFunction('send-template', payload)

/** إرسال جماعي */
export const sendWaBulk = async (payload: {
  employeeId?: string; numbers: string[]
  templateName: string; languageCode?: string; components?: object[]
}) => {
  const data = await callWaFunction('bulk', payload)
  return data as { success: boolean; campaignId: string; total: number }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WhatsApp Realtime ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/** الاستماع للرسائل الجديدة */
export const subscribeToWaMessages = (
  onMessage: (msg: WaMessage) => void
) =>
  supabase
    .channel('wa_messages')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      payload => onMessage(payload.new as WaMessage)
    )
    .subscribe()

/** الاستماع لتحديثات الحالة */
export const subscribeToWaStatuses = (
  onUpdate: (msg: Partial<WaMessage>) => void
) =>
  supabase
    .channel('wa_statuses')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages' },
      payload => onUpdate(payload.new as Partial<WaMessage>)
    )
    .subscribe()

/** الاستماع لتحديثات الحملة */
export const subscribeToWaCampaign = (
  campaignId: string,
  onUpdate: (c: Partial<WaBulkCampaign>) => void
) =>
  supabase
    .channel(`wa_campaign_${campaignId}`)
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'bulk_campaigns', filter: `id=eq.${campaignId}` },
      payload => onUpdate(payload.new as Partial<WaBulkCampaign>)
    )
    .subscribe()

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ WhatsApp Media Upload ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const uploadWaMedia = async (file: File, employeeId: string): Promise<string> => {
  const ALLOWED = ['image/jpeg','image/png','image/webp','application/pdf',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  if (!ALLOWED.includes(file.type)) throw new Error('نوع الملف غير مدعوم')
  if (file.size > 16 * 1024 * 1024) throw new Error('الحجم أكبر من 16MB')

  const ext      = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const filePath = `whatsapp-media/${employeeId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('whatsapp-media')
    .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (error) throw new Error('فشل رفع الملف: ' + error.message)

  const { data: urlData } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath)
  return urlData.publicUrl
}