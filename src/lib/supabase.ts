import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Admin Client (service_role) ── للعمليات الإدارية فقط (إنشاء مستخدمين)
// ⚠️ أضف VITE_SUPABASE_SERVICE_ROLE_KEY في ملف .env من Supabase Dashboard > Settings > API
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Types Definitions (جميع الجداول) ══════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

// ─── News ─────────────────────────────────────────────────────────────────────
export interface News {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image: string;
  category: string;
  tweet?: string;
  device_info?: string;
  timestamp?: number;
  created_by?: string;
}

// ─── Services ─────────────────────────────────────────────────────────────────
export interface Service {
  service_id: string;
  service_name: string;
  service_description: string;
  category?: string;
  icon?: string;
  is_active: boolean;
  created_at?: string;
}

// ─── Service Requests ─────────────────────────────────────────────────────────
export interface ServiceRequest {
  request_id: string;
  user_id: string;
  service_id?: string;
  request_notes?: string;
  contract_url?: string;
  contract_file_name?: string;
  request_status: string;
  admin_notes?: string;
  employee_id?: string;
  assigned_to?: string;
  created_at: string;
  updated_at?: string;
  package_type?: string;
  terms_accepted?: boolean;
  terms_version?: string;
  accepted_at?: string;
  user?: { association_name: string; user_email: string; user_phone?: string };
  services?: { service_name: string; service_description?: string };
  employees?: { employee_name: string };
}

// ─── Users ────────────────────────────────────────────────────────────────────
export interface User {
  user_id: string;
  association_name: string;
  user_email: string;
  user_phone?: string;
  license_number?: string;
  entity_type: string;
  created_at?: string;
  is_review_blocked?: boolean;
}

// ─── Employees ────────────────────────────────────────────────────────────────
export interface Employee {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_phone?: string;
  employee_role: string;
  is_active: boolean;
  created_at?: string;
  section?: string;
}

// ─── Reviews (جدول جديد) ──────────────────────────────────────────────────────
export interface Review {
  id: string;
  user_id: string;
  rating: number;
  review_text?: string;
  is_active: boolean;
  is_hidden?: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    association_name: string;
  };
}

// ─── Projects (جدول جديد) ─────────────────────────────────────────────────────
export interface Project {
  id: string;
  user_id: string;
  project_name: string;
  duration?: string;
  budget?: string;
  target_area?: string;
  project_type: string;
  project_file_url?: string;
  file_name?: string;
  status: 'pending' | 'approved' | 'rejected';
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  user?: {
    association_name: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Auth Helpers ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const signIn = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const signUp = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signOut = () => supabase.auth.signOut();

export const getSession = () => supabase.auth.getSession();

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ News Operations ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchNews = (limit = 6, offset = 0) =>
  supabase
    .from('news')
    .select('*')
    .order('timestamp', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);

export const createNews = (news: Omit<News, 'id'>) =>
  supabase.from('news').insert([news]);

export const deleteNews = (id: string) =>
  supabase.from('news').delete().eq('id', id);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Services Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchServices = () =>
  supabase
    .from('services')
    .select('*')
    .eq('is_active', true);

export const fetchServiceById = (id: string) =>
  supabase
    .from('services')
    .select('*')
    .eq('service_id', id)
    .eq('is_active', true)
    .single();

export const fetchServiceByName = (name: string) =>
  supabase
    .from('services')
    .select('service_id, service_name, service_description')
    .eq('service_name', name)
    .eq('is_active', true)
    .maybeSingle();

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Service Requests Operations ═══════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const createServiceRequest = (request: {
  user_id: string;
  service_id?: string;
  request_notes?: string;
  request_status?: string;
  package_type?: string;
  terms_accepted?: boolean;
  terms_version?: string;
  accepted_at?: string;
}) =>
  supabase.from('service_requests').insert([{
    ...request,
    request_status: request.request_status || 'pending_review',
  }]);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ User Operations ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchUserProfile = (email: string) =>
  supabase
    .from('user')
    .select('*')
    .eq('user_email', email)
    .maybeSingle();

export const fetchUserById = (userId: string) =>
  supabase
    .from('user')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

export const updateUserBlockStatus = (userId: string, is_blocked: boolean) =>
  supabase
    .from('user')
    .update({ is_review_blocked: is_blocked })
    .eq('user_id', userId);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Employee Operations ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export const fetchEmployeeProfile = (email: string) =>
  supabase
    .from('employees')
    .select('*')
    .eq('employee_email', email)
    .eq('is_active', true)
    .maybeSingle();

export const fetchEmployeeById = (employeeId: string) =>
  supabase
    .from('employees')
    .select('*')
    .eq('employee_id', employeeId)
    .maybeSingle();

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Reviews Operations (جديد) ═════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب جميع الآراء النشطة
 */
export const fetchReviews = () =>
  supabase
    .from('reviews')
    .select('*, user:user(association_name)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
/**
 * جلب آراء مستخدم معين
 */
export const fetchMyReviews = (userId: string) =>
  supabase
    .from('reviews')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

/**
 * إضافة رأي جديد
 */
export const createReview = (review: {
  user_id: string;
  rating: number;
  review_text?: string;
  is_active?: boolean;
}) =>
  supabase.from('reviews').insert([{
    ...review,
    is_active: review.is_active ?? true,
  }]);

/**
 * حذف رأي
 */
export const deleteReview = (id: string) =>
  supabase.from('reviews').delete().eq('id', id);

/**
 * تحديث حالة الرأي (تفعيل/إخفاء)
 */
export const updateReviewStatus = (id: string, is_active: boolean) =>
  supabase.from('reviews').update({ is_active }).eq('id', id);

/**
 * تحديث نص الرأي
 */
export const updateReview = (id: string, updates: Partial<Review>) =>
  supabase.from('reviews').update(updates).eq('id', id);

/**
 * التحقق إذا كان المستخدم محظور من إضافة آراء
 */
export const checkUserBlocked = (userId: string) =>
  supabase
    .from('user')
    .select('is_review_blocked')
    .eq('user_id', userId)
    .single();

/**
 * تبديل حالة حظر المستخدم
 */
export const toggleUserBlockStatus = (userId: string, is_blocked: boolean) =>
  supabase
    .from('user')
    .update({ is_review_blocked: is_blocked })
    .eq('user_id', userId);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Projects Operations (جديد) ════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * جلب المشاريع مع فلترة اختيارية بالنوع
 */
// lib/supabase.ts — تأكد إن fetchProjects هكذا
export const fetchProjects = (type?: string) => {
  let query = supabase
    .from('projects')
    .select('*, user:user(association_name)')  // ← user مو users
    .order('created_at', { ascending: false });

  if (type && type !== 'all') {
    query = query.eq('project_type', type);
  }
  return query;
};
/**
 * جلب مشاريع مستخدم معين
 */
export const fetchMyProjects = (userId: string) =>
  supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

/**
 * إضافة مشروع جديد
 */
export const createProject = (project: {
  user_id: string;
  project_name: string;
  duration?: string;
  budget?: string;
  target_area?: string;
  project_type: string;
  project_file_url?: string | null;
  file_name?: string | null;
  status?: string;
  is_active?: boolean;
}) =>
  supabase.from('projects').insert([{
    ...project,
    status: project.status || 'pending',
    is_active: project.is_active ?? true,
  }]);

/**
 * حذف مشروع
 */
export const deleteProject = (id: string) =>
  supabase.from('projects').delete().eq('id', id);

/**
 * تحديث حالة المشروع
 */
export const updateProjectStatus = (id: string, status: string) =>
  supabase.from('projects').update({ status }).eq('id', id);

/**
 * تحديث بيانات المشروع
 */
export const updateProject = (id: string, updates: Partial<Project>) =>
  supabase.from('projects').update(updates).eq('id', id);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Storage Operations ════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * رفع صورة عامة
 */
export const uploadImage = async (bucket: string, file: File, path: string) => {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { cacheControl: '3600', upsert: false });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return urlData.publicUrl;
};

/**
 * الحصول على رابط عام
 */
export const getPublicUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path);

/**
 * رفع ملف للـ Projects (PDF, Word, Excel, إلخ)
 */
export async function uploadProjectFile(file: File, userId: string) {
  const timestamp = Date.now();
  const ext = file.name.split('.').pop()?.toLowerCase();
  const safeFileName = `${timestamp}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = `projects/${safeFileName}`;

  const mimeTypes: Record<string, string> = {
    pdf:  'application/pdf',
    doc:  'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls:  'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt:  'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    txt:  'text/plain',
    zip:  'application/zip',
  };
  const contentType = mimeTypes[ext || ''] || file.type;

  const { data, error } = await supabase.storage
    .from('projects-files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

  if (error) {
    console.error('Upload error:', error);
    throw error;
  }

  const { data: urlData } = supabase.storage
    .from('projects-files')
    .getPublicUrl(filePath);

  return { url: urlData.publicUrl, name: file.name };
}

/**
 * حذف ملف من Storage
 */
export const deleteStorageFile = async (bucket: string, path: string) => {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
};

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Real-time Subscriptions (اختياري) ════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * الاشتراك في تغييرات الآراء
 */
export const subscribeToReviews = (callback: (payload: any) => void) => {
  return supabase
    .channel('reviews-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reviews' }, callback)
    .subscribe();
};

/**
 * الاشتراك في تغييرات المشاريع
 */
export const subscribeToProjects = (callback: (payload: any) => void) => {
  return supabase
    .channel('projects-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, callback)
    .subscribe();
};