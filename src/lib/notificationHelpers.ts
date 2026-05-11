// lib/notificationHelpers.ts
// ─────────────────────────────────────────────────────────────────────────────
// مركز إرسال الإشعارات — يُستخدم من أي صفحة أو مكوّن
// جميع الدوال تُدرج مباشرةً في جدول notifications في Supabase.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ─── النوع الأساسي ─────────────────────────────────────────────────────────
type NotifType =
  // للأدمن
  | 'new_service_request'
  | 'new_event'
  | 'new_job'
  | 'new_review'
  | 'new_project'
  // للعميل
  | 'request_assigned'
  | 'request_status_changed'
  | 'request_rejected'
  | 'request_approved'
  | 'item_approved'
  | 'item_rejected'
  // للموظف
  | 'task_assigned'
  | 'client_note'
  // عام
  | 'system'

interface SendNotifOptions {
  user_id: string
  type: NotifType
  title: string
  body?: string
  data?: Record<string, any>
}

// ─── دالة إرسال الإشعار الأساسية ──────────────────────────────────────────────
export async function sendNotification(opts: SendNotifOptions): Promise<void> {
  // ✅ إصلاح: تجاهل الإشعار إذا كان user_id فارغاً بدل ما يسبب خطأ في DB
  if (!opts.user_id) {
    console.warn('[Notification] Skipped: user_id is null or empty', opts)
    return
  }
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: opts.user_id,
      type: opts.type,
      title: opts.title,
      body: opts.body || null,
      data: opts.data || null,
      is_read: false,
      created_at: new Date().toISOString(),
    })
    if (error) {
      console.error('[Notification] Insert error:', error.message)
    }
  } catch (err) {
    console.error('[Notification] Unexpected error:', err)
  }
}

// ─── جلب admin IDs ──────────────────────────────────────────────────────────
async function getAdminIds(): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('employees')
      .select('auth_id')
      .eq('employee_role', 'admin')
      .eq('is_active', true)
    // ✅ إصلاح: كان يستخدم e.employee_id بدل e.auth_id فكانت ترجع undefined دائماً
    return (data || []).map((e: any) => e.auth_id).filter(Boolean)
  } catch {
    return []
  }
}

// ─── إشعار جميع الأدمن ─────────────────────────────────────────────────────
async function notifyAllAdmins(opts: Omit<SendNotifOptions, 'user_id'>): Promise<void> {
  const adminIds = await getAdminIds()
  if (adminIds.length === 0) {
    console.warn('[Notification] notifyAllAdmins: لا يوجد أدمن نشط في قاعدة البيانات')
    return
  }
  await Promise.all(adminIds.map(id => sendNotification({ ...opts, user_id: id })))
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. عميل أرسل طلب خدمة جديد
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAdminNewServiceRequest({
  clientName,
  serviceName,
  requestId,
}: {
  clientName: string
  serviceName: string
  requestId: string
}) {
  await notifyAllAdmins({
    type: 'new_service_request',
    title: `📋 طلب خدمة جديد`,
    body: `${clientName} أرسل طلبًا جديدًا للخدمة: ${serviceName}`,
    data: { request_id: requestId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. عميل أضاف فعالية
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAdminNewEvent({
  clientName,
  eventName,
  eventId,
}: {
  clientName: string
  eventName: string
  eventId: string
}) {
  await notifyAllAdmins({
    type: 'new_event',
    title: `📅 فعالية جديدة بانتظار المراجعة`,
    body: `${clientName} أضاف فعالية: ${eventName}`,
    data: { event_id: eventId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. عميل أضاف وظيفة
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAdminNewJob({
  clientName,
  jobTitle,
  jobId,
}: {
  clientName: string
  jobTitle: string
  jobId: string
}) {
  await notifyAllAdmins({
    type: 'new_job',
    title: `💼 وظيفة جديدة بانتظار المراجعة`,
    body: `${clientName} أضاف وظيفة: ${jobTitle}`,
    data: { job_id: jobId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. عميل أضاف رأي
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAdminNewReview({
  clientName,
  reviewId,
  rating,
}: {
  clientName: string
  reviewId: string
  rating: number
}) {
  await notifyAllAdmins({
    type: 'new_review',
    title: `✍️ رأي جديد بانتظار المراجعة`,
    body: `${clientName} أضاف رأيًا جديدًا — التقييم: ${'★'.repeat(rating)}`,
    data: { review_id: reviewId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. عميل أضاف مشروع
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAdminNewProject({
  clientName,
  projectName,
  projectId,
}: {
  clientName: string
  projectName: string
  projectId: string
}) {
  await notifyAllAdmins({
    type: 'new_project',
    title: `📁 مشروع جديد بانتظار المراجعة`,
    body: `${clientName} أضاف مشروعًا: ${projectName}`,
    data: { project_id: projectId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. الأدمن أسند طلب لموظف
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyAssignment({
  clientUserId,
  employeeUserId,
  employeeName,
  serviceName,
  requestId,
}: {
  clientUserId: string
  employeeUserId: string
  employeeName: string
  serviceName: string
  requestId: string
}) {
  // للعميل
  await sendNotification({
    user_id: clientUserId,
    type: 'request_assigned',
    title: `👤 تم تعيين موظف لطلبك`,
    body: `تم إسناد طلبك "${serviceName}" إلى الموظف ${employeeName}، وسيتواصل معك قريبًا.`,
    data: { request_id: requestId, employee_name: employeeName },
  })
  // للموظف
  await sendNotification({
    user_id: employeeUserId,
    type: 'task_assigned',
    title: `📋 مهمة جديدة أُسندت إليك`,
    body: `تم إسناد طلب الخدمة "${serviceName}" إليك — يرجى المتابعة من لوحة التحكم.`,
    data: { request_id: requestId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. الأدمن/الموظف غيّر حالة الطلب
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyStatusChange({
  clientUserId,
  newStatus,
  serviceName,
  requestId,
  note,
}: {
  clientUserId: string
  newStatus: string
  serviceName: string
  requestId: string
  note?: string
}) {
  const statusLabels: Record<string, { icon: string; label: string }> = {
    pending_review: { icon: '⏳', label: 'قيد المراجعة' },
    in_progress: { icon: '⚙️', label: 'قيد التنفيذ' },
    completed: { icon: '✅', label: 'مكتمل' },
    cancelled: { icon: '❌', label: 'ملغى' },
    approved: { icon: '✅', label: 'تم القبول' },
    rejected: { icon: '❌', label: 'مرفوض' },
  }
  const st = statusLabels[newStatus] || { icon: '🔔', label: newStatus }

  await sendNotification({
    user_id: clientUserId,
    type: 'request_status_changed',
    title: `${st.icon} تحديث على طلبك`,
    body: `طلبك "${serviceName}" أصبح الآن: ${st.label}${note ? `\nملاحظة: ${note}` : ''}`,
    data: { request_id: requestId, new_status: newStatus },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. الأدمن رفض طلب
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyRequestRejected({
  clientUserId,
  serviceName,
  requestId,
  reason,
}: {
  clientUserId: string
  serviceName: string
  requestId: string
  reason: string
}) {
  await sendNotification({
    user_id: clientUserId,
    type: 'request_rejected',
    title: `❌ تم رفض طلبك`,
    body: `طلبك "${serviceName}" مرفوض للسبب التالي: ${reason}`,
    data: { request_id: requestId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. الأدمن اعتمد عنصر
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyItemApproved({
  clientUserId,
  itemType,
  itemName,
  itemId,
}: {
  clientUserId: string
  itemType: 'event' | 'job' | 'review' | 'project'
  itemName: string
  itemId: string
}) {
  const typeLabels: Record<string, string> = {
    event: 'الفعالية',
    job: 'الوظيفة',
    review: 'الرأي',
    project: 'المشروع',
  }
  const label = typeLabels[itemType] || itemType

  await sendNotification({
    user_id: clientUserId,
    type: 'item_approved',
    title: `✅ تم اعتماد ${label}`,
    body: `${label} "${itemName}" تم اعتماده ونشره بنجاح.`,
    data: { item_type: itemType, item_id: itemId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. الأدمن رفض عنصر
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyItemRejected({
  clientUserId,
  itemType,
  itemName,
  itemId,
  reason,
}: {
  clientUserId: string
  itemType: 'event' | 'job' | 'review' | 'project'
  itemName: string
  itemId: string
  reason?: string
}) {
  const typeLabels: Record<string, string> = {
    event: 'الفعالية',
    job: 'الوظيفة',
    review: 'الرأي',
    project: 'المشروع',
  }
  const label = typeLabels[itemType] || itemType

  await sendNotification({
    user_id: clientUserId,
    type: 'item_rejected',
    title: `❌ لم يتم اعتماد ${label}`,
    body: `${label} "${itemName}" لم يتم اعتماده${reason ? `.\nالسبب: ${reason}` : '.'}`,
    data: { item_type: itemType, item_id: itemId },
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// 11. الأدمن أرسل ملاحظة للموظف
// ═══════════════════════════════════════════════════════════════════════════
export async function notifyEmployeeNote({
  employeeUserId,
  serviceName,
  requestId,
  note,
}: {
  employeeUserId: string
  serviceName: string
  requestId: string
  note: string
}) {
  await sendNotification({
    user_id: employeeUserId,
    type: 'client_note',
    title: `📝 ملاحظة جديدة على مهمتك`,
    body: `طلب "${serviceName}": ${note}`,
    data: { request_id: requestId },
  })
}