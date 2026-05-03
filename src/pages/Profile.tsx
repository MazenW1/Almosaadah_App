import { useState, useEffect, useRef, useCallback } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchMyReviews, fetchMyProjects, deleteReview, deleteProject } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

// ─── Security Utilities ───────────────────────────────────────────────────────

/**
 * Sanitize text input to prevent XSS attacks.
 * Strips HTML tags and encodes special characters.
 */
const sanitizeInput = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .trim();
};

/**
 * Validate email format using RFC 5322 simplified regex.
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate password strength:
 * - Min 8 chars
 * - At least 1 uppercase, 1 lowercase, 1 number
 */
const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'ضعيفة', color: '#ef4444' };
  if (score <= 4) return { score, label: 'متوسطة', color: '#f59e0b' };
  return { score, label: 'قوية', color: '#10b981' };
};

/**
 * Simple in-memory rate limiter per action key.
 * Prevents brute-force / spamming form submissions.
 */
const rateLimiter = (() => {
  const attempts: Record<string, { count: number; resetAt: number }> = {};
  return {
    check: (key: string, maxAttempts = 5, windowMs = 60_000): boolean => {
      const now = Date.now();
      if (!attempts[key] || attempts[key].resetAt < now) {
        attempts[key] = { count: 0, resetAt: now + windowMs };
      }
      attempts[key].count++;
      return attempts[key].count <= maxAttempts;
    },
    remaining: (key: string): number => {
      const now = Date.now();
      if (!attempts[key] || attempts[key].resetAt < now) return 5;
      return Math.max(0, 5 - attempts[key].count);
    },
  };
})();

/**
 * Debounce helper to throttle rapid function calls.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// ─── Helpers for Events & Jobs in Profile ───
const fetchMyEvents = (userId: string) =>
  supabase.from('events').select('*').eq('user_id', userId).order('created_at', { ascending: false });

const fetchMyJobs = (userId: string) =>
  supabase.from('jobs').select('*').eq('user_id', userId).order('created_at', { ascending: false });

const deleteEvent = (id: string) => supabase.from('events').delete().eq('id', id);
const deleteJob   = (id: string) => supabase.from('jobs').delete().eq('id', id);

interface Review {
  id: string;
  rating: number;
  review_text: string;
  is_active: boolean;
  created_at: string;
}

interface Project {
  id: string;
  project_name: string;
  project_type: string;
  status: string;
  created_at: string;
  duration?: string;
  budget?: string;
  target_area?: string;
}

interface Event {
  id: string;
  user_id: string;
  event_name: string;
  event_type: string;
  city: string;
  event_date: string;
  status: 'new' | 'completed' | 'cancelled';
  is_active: boolean;
  created_at: string;
}

interface Job {
  id: string;
  user_id: string;
  job_title: string;
  work_type: string;
  city: string;
  status: 'draft' | 'pending_proof' | 'pending_admin' | 'active' | 'rejected' | 'closed';
  created_at: string;
}

const EVENT_STATUS_CONFIG = {
  new:       { bg: '#e0f2fe', color: '#0891b2', dot: '#06b6d4', label: 'جديدة' },
  completed: { bg: '#dcfce7', color: '#15803d', dot: '#22c55e', label: 'مكتملة' },
  cancelled: { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444', label: 'ملغية' },
};

const JOB_STATUS_CONFIG = {
  draft:         { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8', label: 'مسودة' },
  pending_proof: { bg: '#fef9c3', color: '#d97706', dot: '#fbbf24', label: 'بانتظار الرابط' },
  pending_admin: { bg: '#ecfeff', color: '#0891b2', dot: '#06b6d4', label: 'قيد المراجعة' },
  active:        { bg: '#dcfce7', color: '#15803d', dot: '#22c55e', label: 'نشطة' },
  rejected:      { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444', label: 'مرفوضة' },
  closed:        { bg: '#f1f5f9', color: '#64748b', dot: '#94a3b8', label: 'مغلقة' },
};

const PROJECT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  emergency:   { label: 'الإغاثة العاجلة',    icon: '🚑', color: '#dc2626', bg: '#fef2f2' },
  development: { label: 'مشاريع التنمية',     icon: '🌱', color: '#16a34a', bg: '#f0fdf4' },
  social:      { label: 'الرعاية الاجتماعية', icon: '🤝', color: '#2563eb', bg: '#eff6ff' },
  seasonal:    { label: 'المشاريع الموسمية',  icon: '📅', color: '#ea580c', bg: '#fff7ed' },
  endowment:   { label: 'المشاريع الوقفية',   icon: '🕌', color: '#7c3aed', bg: '#faf5ff' },
};

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'approved': return { bg: '#dcfce7', color: '#15803d', label: 'مقبول', dot: '#22c55e' };
    case 'rejected': return { bg: '#fee2e2', color: '#dc2626', label: 'مرفوض', dot: '#ef4444' };
    default:         return { bg: '#fef9c3', color: '#a16207', label: 'قيد المراجعة', dot: '#eab308' };
  }
};

type TabType = 'feed' | 'projects' | 'reviews' | 'events' | 'jobs' | 'settings';

export function Profile() {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, isClient } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<TabType>('feed');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingPass, setLoadingPass] = useState(false);
  const [emailMsg, setEmailMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [passMsg, setPassMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [myReviews, setMyReviews] = useState<Review[]>([]);
  const [myProjects, setMyProjects] = useState<Project[]>([]);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myJobs, setMyJobs] = useState<Job[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isStaff = isAdmin || isEmployee;
  // أضف هذا في أي صفحة تحتاج تعرف الوضع:



  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const fetchProfile = async () => {
      // ── [FIX-1] تحديد الحقول المطلوبة فقط بدلاً من select('*') ──
      const { data: emp } = await supabase
        .from('employees')
        .select('employee_id, employee_name, employee_email, employee_role, is_active, section')
        .eq('employee_email', user.email)
        .maybeSingle();
      if (emp) { setProfileData({ ...emp, type: 'employee' }); return; }
      const { data: usr } = await supabase
        .from('user')
        .select('user_id, association_name, user_email, user_phone, entity_type, license_number, is_review_blocked')
        .eq('user_email', user.email)
        .maybeSingle();
      if (usr) setProfileData({ ...usr, type: 'client' });
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user?.id || isStaff) return;
    const fetchUserData = async () => {
      setLoadingReviews(true);
      setLoadingProjects(true);
      setLoadingEvents(true);
      setLoadingJobs(true);
      try {
        const [reviewsRes, projectsRes, eventsRes, jobsRes] = await Promise.all([
          fetchMyReviews(user.id),
          fetchMyProjects(user.id),
          fetchMyEvents(user.id),
          fetchMyJobs(user.id),
        ]);
        if (reviewsRes.data) setMyReviews(reviewsRes.data);
        if (projectsRes.data) setMyProjects(projectsRes.data);
        if (eventsRes.data) setMyEvents(eventsRes.data);
        if (jobsRes.data) setMyJobs(jobsRes.data);
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoadingReviews(false);
        setLoadingProjects(false);
        setLoadingEvents(false);
        setLoadingJobs(false);
      }
    };
    fetchUserData();
  }, [user, isStaff]);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedEmail = sanitizeInput(newEmail.trim()).toLowerCase();
    if (!sanitizedEmail) return;

    // Validate email format
    if (!isValidEmail(sanitizedEmail)) {
      setEmailMsg({ text: 'صيغة البريد الإلكتروني غير صحيحة', ok: false });
      return;
    }

    // ── [FIX-2] منع تغيير الإيميل لنفس الإيميل الحالي ──
    if (sanitizedEmail === user?.email?.toLowerCase()) {
      setEmailMsg({ text: 'البريد الجديد مطابق للبريد الحالي', ok: false });
      return;
    }

    // Rate limit: max 3 attempts per 10 minutes
    if (!rateLimiter.check('update-email', 3, 600_000)) {
      setEmailMsg({ text: 'تم تجاوز الحد المسموح. يرجى الانتظار 10 دقائق قبل المحاولة مجدداً', ok: false });
      return;
    }

    setLoadingEmail(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: sanitizedEmail });
    setLoadingEmail(false);
    if (error) {
      setEmailMsg({ text: 'حدث خطأ أثناء تحديث البريد', ok: false });
    } else {
      setEmailMsg({ text: '✓ تم إرسال رابط تأكيد التغيير إلى بريدك الجديد', ok: true });
      setNewEmail('');
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (newPassword.length < 8) {
      setPassMsg({ text: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', ok: false });
      return;
    }
    // ── [FIX-3] حد أقصى لطول الباسورد لمنع DoS ──
    if (newPassword.length > 128) {
      setPassMsg({ text: 'كلمة المرور طويلة جداً (الحد الأقصى 128 حرف)', ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'كلمتا المرور غير متطابقتان', ok: false });
      return;
    }

    // Enforce minimum password strength
    const strength = getPasswordStrength(newPassword);
    if (strength.score < 3) {
      setPassMsg({ text: 'كلمة المرور ضعيفة جداً. أضف أرقاماً وأحرفاً كبيرة وصغيرة', ok: false });
      return;
    }

    // Rate limit: max 5 attempts per 15 minutes
    if (!rateLimiter.check('update-password', 5, 900_000)) {
      setPassMsg({ text: 'تم تجاوز الحد المسموح. يرجى الانتظار 15 دقيقة قبل المحاولة مجدداً', ok: false });
      return;
    }

    setLoadingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingPass(false);
    if (error) {
      setPassMsg({ text: 'حدث خطأ أثناء تحديث كلمة المرور', ok: false });
    } else {
      setPassMsg({ text: '✓ تم تحديث كلمة المرور بنجاح', ok: true });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteReview = async (id: string) => {
    // Guard: only admin can delete
    if (!isAdmin) return;
    if (!id || typeof id !== 'string' || id.length > 100) return;
    if (!confirm('هل أنت متأكد من حذف هذا الرأي؟')) return;
    try {
      const { error } = await deleteReview(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      setMyReviews(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };

  const handleDeleteProject = async (id: string) => {
    // Guard: only admin can delete
    if (!isAdmin) return;
    if (!id || typeof id !== 'string' || id.length > 100) return;
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    try {
      const { error } = await deleteProject(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      setMyProjects(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    // Guard: only admin can delete
    if (!isAdmin) return;
    if (!id || typeof id !== 'string' || id.length > 100) return;
    if (!confirm('هل أنت متأكد من حذف هذه الفعالية؟')) return;
    try {
      const { error } = await deleteEvent(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      setMyEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };

  const handleDeleteJob = async (id: string) => {
    // Guard: only admin can delete
    if (!isAdmin) return;
    if (!id || typeof id !== 'string' || id.length > 100) return;
    if (!confirm('هل أنت متأكد من حذف هذه الوظيفة؟')) return;
    try {
      const { error } = await deleteJob(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      setMyJobs(prev => prev.filter(j => j.id !== id));
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };

  const getRoleConfig = () => {
    if (isAdmin)    return { label: 'مدير النظام', color: '#0891b2', gradient: 'linear-gradient(135deg,#0c4a6e,#0891b2)', icon: '🛡️', initials: 'AD' };
    if (isEmployee) return { label: 'موظف',        color: '#7c3aed', gradient: 'linear-gradient(135deg,#4c1d95,#7c3aed)', icon: '💼', initials: 'EM' };
    if (isClient)   return { label: 'عميل',         color: '#059669', gradient: 'linear-gradient(135deg,#064e3b,#059669)', icon: '👤', initials: 'CL' };
    return { label: 'مستخدم', color: '#64748b', gradient: 'linear-gradient(135deg,#1e293b,#64748b)', icon: '👤', initials: 'US' };
  };

  const role = getRoleConfig();
  const displayName = profileData?.association_name || profileData?.employee_name || user?.email?.split('@')[0] || 'المستخدم';

  // Combined feed sorted by date
  const feedItems = [
    ...myProjects.map(p => ({ type: 'project' as const, data: p, date: new Date(p.created_at) })),
    ...myReviews.map(r  => ({ type: 'review'  as const, data: r, date: new Date(r.created_at) })),
    ...myEvents.map(e   => ({ type: 'event'   as const, data: e, date: new Date(e.created_at) })),
    ...myJobs.map(j     => ({ type: 'job'     as const, data: j, date: new Date(j.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const { isDarkMode: dm } = useDarkMode();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
        .mobile-drawer,
        .modal-box {
          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 768px) {
          .futuristic-header { contain: layout style paint; }
          .mobile-drawer { contain: layout style paint; }
        }
        
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ===== RESPONSIVE ROOT ===== */
        .profile-root {
          min-height: 100vh;
          font-family: 'Tajawal', sans-serif;
          direction: rtl;
          position: relative;
          -webkit-text-size-adjust: 100%;
          -webkit-tap-highlight-color: transparent;
        }

        /* ===== COVER & AVATAR ===== */
        .profile-cover {
          height: 180px;
          position: relative;
          overflow: hidden;
        }

        @media (min-width: 480px) {
          .profile-cover { height: 200px; }
        }

        .profile-cover-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, #0c4a6e 0%, #0891b2 50%, #06b6d4 100%);
        }

        .profile-cover-pattern {
          position: absolute;
          inset: 0;
          opacity: 0.08;
          background-image: radial-gradient(circle at 25% 25%, white 2px, transparent 2px),
                            radial-gradient(circle at 75% 75%, white 1px, transparent 1px);
          background-size: 60px 60px, 30px 30px;
          animation: patternShift 20s linear infinite;
        }

        @keyframes patternShift {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 60px 60px, 30px 30px; }
        }

        .profile-cover-wave {
          position: absolute;
          bottom: -1px;
          left: 0; right: 0;
          height: 60px;
        }

        .profile-identity {
          position: relative;
          padding: 0 16px 0;
          margin-top: -44px;
          z-index: 10;
        }

        @media (min-width: 480px) {
          .profile-identity {
            padding: 0 24px 0;
            margin-top: -48px;
          }
        }

        .profile-avatar-ring {
          width: 80px; height: 80px;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(135deg, #06b6d4, #7c3aed);
          box-shadow: 0 8px 32px rgba(8,145,178,0.4);
          display: inline-block;
          margin-bottom: 10px;
          animation: avatarEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @media (min-width: 480px) {
          .profile-avatar-ring { width: 96px; height: 96px; margin-bottom: 12px; }
        }

        @keyframes avatarEntrance {
          from { transform: rotate(-180deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg);   opacity: 1; }
        }

        .profile-avatar-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: ${role.gradient};
          display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          color: white;
          border: 3px solid ${dm ? '#0f172a' : '#ffffff'};
        }

        @media (min-width: 480px) {
          .profile-avatar-inner { font-size: 32px; }
        }

        /* ===== STATS BAR ===== */
        .profile-stats {
          display: flex;
          gap: 2px;
          margin-top: 12px;
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .profile-stats::-webkit-scrollbar { display: none; }

        @media (min-width: 480px) {
          .profile-stats { margin-top: 16px; border-radius: 16px; }
        }

        .stat-item {
          flex: 1;
          min-width: 52px;
          padding: 10px 6px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border-bottom: 3px solid transparent;
          user-select: none;
          -webkit-user-select: none;
        }

        @media (min-width: 480px) {
          .stat-item { padding: 14px 8px; min-width: unset; }
        }

        .stat-item:hover { background: ${dm ? 'rgba(51,65,85,0.9)' : 'rgba(240,249,255,0.95)'}; }

        .stat-item.active {
          border-bottom-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.15)' : 'rgba(224,242,254,0.8)'};
        }

        .stat-number {
          font-size: 17px;
          font-weight: 900;
          color: #0891b2;
          line-height: 1;
        }

        @media (min-width: 480px) {
          .stat-number { font-size: 20px; }
        }

        .stat-label {
          font-size: 10px;
          font-weight: 600;
          color: ${dm ? '#94a3b8' : '#64748b'};
          margin-top: 3px;
          white-space: nowrap;
        }

        @media (min-width: 480px) {
          .stat-label { font-size: 11px; }
        }

        /* ===== TAB NAV ===== */
        .tab-nav {
          display: flex;
          gap: 3px;
          padding: 10px 12px;
          border-bottom: 1px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
          background: ${dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)'};
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(12px);
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .tab-nav::-webkit-scrollbar { display: none; }

        @media (min-width: 480px) {
          .tab-nav { gap: 4px; padding: 12px 16px; }
        }

        .tab-btn {
          flex: 1;
          min-width: 56px;
          padding: 9px 4px;
          border: none;
          border-radius: 10px;
          font-family: 'Tajawal', sans-serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          background: transparent;
          color: ${dm ? '#94a3b8' : '#64748b'};
          white-space: nowrap;
          user-select: none;
          -webkit-user-select: none;
          touch-action: manipulation;
        }

        @media (min-width: 480px) {
          .tab-btn { padding: 10px 6px; font-size: 13px; gap: 6px; min-width: unset; border-radius: 12px; }
        }

        .tab-btn.active {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: white;
          box-shadow: 0 4px 14px rgba(8,145,178,0.35);
          transform: translateY(-1px);
        }

        .tab-btn:not(.active):hover {
          background: ${dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.08)'};
          color: #0891b2;
        }

        /* ===== CONTENT AREA ===== */
        .tab-content {
          padding: 16px 12px;
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
        }

        @media (min-width: 480px) {
          .tab-content { padding: 20px 16px; }
        }

        /* ===== FEED POST CARD ===== */
        .post-card {
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          border-radius: 16px;
          margin-bottom: 12px;
          overflow: hidden;
          box-shadow: 0 2px 20px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
          animation: cardSlideIn 0.5s ease both;
          backdrop-filter: blur(12px);
        }

        @media (min-width: 480px) {
          .post-card { border-radius: 20px; margin-bottom: 16px; }
        }

        .post-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transform: translateY(-2px);
          border-color: rgba(8,145,178,0.3);
        }

        @media (hover: none) {
          .post-card:hover { transform: none; }
        }

        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .post-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 16px 10px;
        }

        @media (min-width: 480px) {
          .post-header { gap: 12px; padding: 16px 20px 12px; }
        }

        .post-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px;
          flex-shrink: 0;
        }

        @media (min-width: 480px) {
          .post-avatar { width: 42px; height: 42px; font-size: 18px; }
        }

        .post-meta { flex: 1; min-width: 0; }

        .post-name {
          font-size: 13px;
          font-weight: 800;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        @media (min-width: 480px) {
          .post-name { font-size: 14px; }
        }

        .post-time {
          font-size: 11px;
          color: ${dm ? '#64748b' : '#94a3b8'};
          margin-top: 1px;
        }

        @media (min-width: 480px) {
          .post-time { font-size: 12px; }
        }

        .post-type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 3px;
          flex-shrink: 0;
        }

        @media (min-width: 480px) {
          .post-type-badge { font-size: 11px; padding: 4px 10px; gap: 4px; }
        }

        .post-body { padding: 0 16px 14px; }

        @media (min-width: 480px) {
          .post-body { padding: 0 20px 16px; }
        }

        .post-text {
          font-size: 13px;
          line-height: 1.65;
          color: ${dm ? '#cbd5e1' : '#374151'};
          margin-bottom: 10px;
          word-break: break-word;
          overflow-wrap: break-word;
        }

        @media (min-width: 480px) {
          .post-text { font-size: 14px; margin-bottom: 12px; }
        }

        .post-footer {
          padding: 10px 16px;
          border-top: 1px solid ${dm ? 'rgba(51,65,85,0.5)' : '#f1f5f9'};
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        @media (min-width: 480px) {
          .post-footer { padding: 12px 20px; }
        }

        /* ===== STAR DISPLAY ===== */
        .stars-display { display: flex; gap: 2px; direction: ltr; }
        .star { font-size: 16px; transition: transform 0.1s; }

        @media (min-width: 480px) {
          .star { font-size: 18px; }
        }

        .star:hover { transform: scale(1.2); }

        /* ===== PROJECT INFO GRID ===== */
        .project-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 10px;
        }

        @media (min-width: 480px) {
          .project-info-grid { gap: 8px; margin-bottom: 12px; }
        }

        .project-info-item {
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f8fafc'};
          border-radius: 8px;
          padding: 8px 10px;
        }

        @media (min-width: 480px) {
          .project-info-item { border-radius: 10px; padding: 10px 12px; }
        }

        .project-info-label {
          font-size: 10px;
          color: ${dm ? '#64748b' : '#94a3b8'};
          font-weight: 600;
          margin-bottom: 3px;
        }

        @media (min-width: 480px) {
          .project-info-label { font-size: 11px; }
        }

        .project-info-value {
          font-size: 12px;
          font-weight: 700;
          color: ${dm ? '#e2e8f0' : '#0f172a'};
        }

        @media (min-width: 480px) {
          .project-info-value { font-size: 13px; }
        }

        /* ===== ACTION BUTTONS ===== */
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 9px;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          touch-action: manipulation;
          min-height: 36px;
        }

        @media (min-width: 480px) {
          .action-btn { gap: 6px; padding: 7px 14px; border-radius: 10px; font-size: 12px; }
        }

        .action-btn.danger {
          background: ${dm ? 'rgba(220,38,38,0.15)' : '#fee2e2'};
          color: #dc2626;
        }
        .action-btn.danger:hover { background: #fecaca; transform: scale(1.05); }

        .action-btn.primary {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: white;
        }
        .action-btn.primary:hover { box-shadow: 0 4px 14px rgba(8,145,178,0.4); transform: scale(1.05); }

        @media (hover: none) {
          .action-btn:hover { transform: none !important; }
        }

        /* ===== PROFILE INFO CARD ===== */
        .info-card {
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 14px;
          backdrop-filter: blur(12px);
        }

        @media (min-width: 480px) {
          .info-card { border-radius: 20px; padding: 24px; margin-bottom: 16px; }
        }

        .info-card-title {
          font-size: 14px;
          font-weight: 800;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1.5px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
        }

        @media (min-width: 480px) {
          .info-card-title { font-size: 15px; margin: 0 0 18px; gap: 10px; padding-bottom: 14px; }
        }

        .info-title-icon {
          width: 30px; height: 30px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px;
          flex-shrink: 0;
        }

        @media (min-width: 480px) {
          .info-title-icon { width: 34px; height: 34px; border-radius: 10px; font-size: 15px; }
        }

        .info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f8fafc'};
          font-size: 13px;
          gap: 8px;
        }

        @media (min-width: 480px) {
          .info-row { padding: 11px 0; font-size: 14px; }
        }

        .info-row:last-child { border-bottom: none; padding-bottom: 0; }
        .info-label { color: ${dm ? '#64748b' : '#64748b'}; font-weight: 600; flex-shrink: 0; }
        .info-value {
          color: ${dm ? '#e2e8f0' : '#0f172a'};
          font-weight: 700;
          direction: ltr;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 60%;
        }

        /* ===== FORM INPUTS ===== */
        .form-input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f8fafc'};
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          direction: ltr;
          text-align: right;
          -webkit-appearance: none;
          appearance: none;
        }

        @media (min-width: 480px) {
          .form-input { padding: 13px 16px; border-radius: 12px; }
        }

        .form-input:focus {
          border-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.08)' : '#fff'};
          box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
        }

        /* Prevent iOS zoom on inputs */
        @media (max-width: 480px) {
          .form-input { font-size: 16px; }
        }

        .submit-btn {
          width: 100%;
          padding: 13px;
          border-radius: 10px;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
          transition: all 0.25s ease;
          min-height: 48px;
          touch-action: manipulation;
        }

        @media (min-width: 480px) {
          .submit-btn { padding: 14px; border-radius: 12px; font-size: 15px; margin-top: 16px; }
        }

        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .submit-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }

        @media (hover: none) {
          .submit-btn:not(:disabled):hover { transform: none; }
        }

        .msg-box {
          padding: 10px 14px;
          border-radius: 10px;
          margin-top: 10px;
          font-size: 13px;
          font-weight: 600;
          animation: fadeSlide 0.3s ease;
        }

        @media (min-width: 480px) {
          .msg-box { padding: 11px 15px; }
        }

        .pw-toggle {
          position: absolute;
          left: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #94a3b8;
          font-size: 15px; padding: 6px;
          transition: color 0.2s;
          min-width: 32px; min-height: 32px;
          display: flex; align-items: center; justify-content: center;
        }
        .pw-toggle:hover { color: #0891b2; }

        /* ===== QUICK LINKS ===== */
        .quick-link {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.7)' : '#f8fafc'};
          color: ${dm ? '#cbd5e1' : '#475569'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 10px;
          transition: all 0.25s ease;
          min-height: 48px;
          touch-action: manipulation;
        }

        @media (min-width: 480px) {
          .quick-link { padding: 14px; border-radius: 14px; font-size: 15px; gap: 10px; }
        }

        .quick-link:hover {
          background: ${dm ? 'rgba(8,145,178,0.12)' : '#f0f9ff'};
          border-color: #0891b2;
          color: #0891b2;
          transform: translateY(-1px);
        }

        .quick-link.primary {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: white;
          border: none;
        }
        .quick-link.primary:hover { box-shadow: 0 4px 18px rgba(8,145,178,0.4); color: white; }

        @media (hover: none) {
          .quick-link:hover { transform: none; }
        }

        /* ===== EMPTY STATE ===== */
        .empty-state {
          text-align: center;
          padding: 36px 16px;
          color: ${dm ? '#64748b' : '#94a3b8'};
        }

        @media (min-width: 480px) {
          .empty-state { padding: 48px 24px; }
        }

        .empty-icon {
          font-size: 48px;
          display: block;
          margin-bottom: 14px;
          opacity: 0.5;
          animation: float 3s ease-in-out infinite;
        }

        @media (min-width: 480px) {
          .empty-icon { font-size: 56px; margin-bottom: 16px; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        /* ===== SPINNER ===== */
        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeSlide { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }

        /* ===== BACK BUTTON ===== */
        .back-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 20;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 10px;
          padding: 7px 12px;
          color: white;
          font-family: 'Tajawal', sans-serif;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.2s ease;
          min-height: 38px;
          touch-action: manipulation;
        }

        @media (min-width: 480px) {
          .back-btn { top: 16px; right: 16px; border-radius: 12px; padding: 8px 16px; font-size: 13px; }
        }

        .back-btn:hover { background: rgba(255,255,255,0.25); }

        /* ===== DARK MODE TOGGLE ===== */
        .dm-toggle {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 20;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 10px;
          padding: 7px 10px;
          color: white;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          min-height: 38px;
          touch-action: manipulation;
        }

        @media (min-width: 480px) {
          .dm-toggle { top: 16px; left: 16px; border-radius: 12px; padding: 8px 12px; font-size: 16px; }
        }

        .dm-toggle:hover { background: rgba(255,255,255,0.25); }

        /* ===== ROLE BADGE ===== */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          margin-top: 4px;
        }

        @media (min-width: 480px) {
          .role-badge { gap: 5px; padding: 4px 12px; font-size: 12px; }
        }

        /* ===== LOADING SKELETON ===== */
        .skeleton {
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f1f5f9'};
          border-radius: 8px;
          animation: skeleton-pulse 1.5s ease-in-out infinite;
        }

        @keyframes skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* ===== DARK MODE BASE ===== */
        .dark-bg { background: #0f172a; }
        .light-bg { background: transparent; }

        /* ===== SAFE AREA INSETS (mobile notch/home bar) ===== */
        .profile-root {
          padding-bottom: env(safe-area-inset-bottom, 0px);
        }
      
        @media (max-width: 768px) {
          * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          input, select, textarea { font-size: 16px !important; }
          button { -webkit-tap-highlight-color: transparent; }
        }
        `}</style>

      <div className={`profile-root ${dm ? 'dark-bg' : 'light-bg'}`}>

        <div style={{ position: 'relative', zIndex: 5, maxWidth: '680px', margin: '0 auto' }}>
          {/* Cover */}
          <div className="profile-cover">
            <div className="profile-cover-gradient" />
            <div className="profile-cover-pattern" />
            <svg className="profile-cover-wave" viewBox="0 0 1440 60" preserveAspectRatio="none">
              <path d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z" fill={dm ? '#0f172a' : '#f8fafc'} />
            </svg>

            <button className="back-btn" onClick={() => navigate(-1)}>
              <i className="fas fa-arrow-right" />
              رجوع
            </button>

            <button className="dm-toggle" onClick={() => { document.documentElement.classList.toggle('dark'); localStorage.setItem('darkMode', String(!dm)); window.dispatchEvent(new Event('darkmode-change')); }}>
              {dm ? '☀️' : '🌙'}
            </button>
          </div>

          {/* Identity */}
          <div className="profile-identity">
            <div className="profile-avatar-ring">
              <div className="profile-avatar-inner">
                {role.icon}
              </div>
            </div>

            <div style={{ marginRight: '12px', display: 'inline-block', verticalAlign: 'bottom', marginBottom: '18px' }}>
              <h1 style={{ fontSize: '20px', fontWeight: 900, color: dm ? '#f1f5f9' : '#0f172a', margin: 0 }}>
                {displayName}
              </h1>
              <p style={{ fontSize: '13px', color: dm ? '#64748b' : '#94a3b8', margin: '2px 0', direction: 'ltr' }}>
                {user?.email}
              </p>
              <span className="role-badge" style={{ background: `${role.color}20`, color: role.color }}>
                {role.icon} {role.label}
              </span>
            </div>
          </div>

          {/* Stats */}
          {isClient && (
            <div className="profile-stats" style={{ margin: '0 16px 0' }}>
              <div
                className={`stat-item ${activeTab === 'feed' ? 'active' : ''}`}
                onClick={() => setActiveTab('feed')}
              >
                <div className="stat-number">{myProjects.length + myReviews.length + myEvents.length + myJobs.length}</div>
                <div className="stat-label">المنشورات</div>
              </div>
              <div
                className={`stat-item ${activeTab === 'projects' ? 'active' : ''}`}
                onClick={() => setActiveTab('projects')}
              >
                <div className="stat-number">{myProjects.length}</div>
                <div className="stat-label">المشاريع</div>
              </div>
              <div
                className={`stat-item ${activeTab === 'events' ? 'active' : ''}`}
                onClick={() => setActiveTab('events')}
              >
                <div className="stat-number">{myEvents.length}</div>
                <div className="stat-label">الفعاليات</div>
              </div>
              <div
                className={`stat-item ${activeTab === 'jobs' ? 'active' : ''}`}
                onClick={() => setActiveTab('jobs')}
              >
                <div className="stat-number">{myJobs.length}</div>
                <div className="stat-label">الوظائف</div>
              </div>
              <div
                className={`stat-item ${activeTab === 'reviews' ? 'active' : ''}`}
                onClick={() => setActiveTab('reviews')}
              >
                <div className="stat-number">{myReviews.length}</div>
                <div className="stat-label">الآراء</div>
              </div>
              <div
                className={`stat-item ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <div className="stat-number">⚙️</div>
                <div className="stat-label">الإعدادات</div>
              </div>
            </div>
          )}

          {/* Tab Nav */}
          <div className="tab-nav" style={{ marginTop: isClient ? '16px' : '0' }}>
            {isClient ? (
              <>
                <button className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
                  <i className="fas fa-stream" /> الكل
                </button>
                <button className={`tab-btn ${activeTab === 'projects' ? 'active' : ''}`} onClick={() => setActiveTab('projects')}>
                  <i className="fas fa-folder" /> المشاريع
                </button>
                <button className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
                  <i className="fas fa-calendar-alt" /> الفعاليات
                </button>
                <button className={`tab-btn ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
                  <i className="fas fa-briefcase" /> الوظائف
                </button>
                <button className={`tab-btn ${activeTab === 'reviews' ? 'active' : ''}`} onClick={() => setActiveTab('reviews')}>
                  <i className="fas fa-feather" /> الآراء
                </button>
                <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                  <i className="fas fa-cog" /> الإعدادات
                </button>
              </>
            ) : (
              <>
                <button className={`tab-btn ${activeTab === 'feed' ? 'active' : ''}`} onClick={() => setActiveTab('feed')}>
                  <i className="fas fa-id-card" /> الملف الشخصي
                </button>
                <button className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                  <i className="fas fa-cog" /> الإعدادات
                </button>
              </>
            )}
          </div>

          {/* ======= TAB CONTENT ======= */}
          <div className="tab-content">

            {/* ===== FEED TAB ===== */}
            {activeTab === 'feed' && isClient && (
              <div>
                {(loadingReviews || loadingProjects || loadingEvents || loadingJobs) ? (
                  <div>
                    {[1, 2, 3].map(i => (
                      <div key={i} className="post-card" style={{ padding: '20px', animationDelay: `${i * 0.1}s` }}>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <div className="skeleton" style={{ width: 42, height: 42, borderRadius: '50%' }} />
                          <div style={{ flex: 1 }}>
                            <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8, borderRadius: 6 }} />
                            <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 6 }} />
                          </div>
                        </div>
                        <div className="skeleton" style={{ height: 60, borderRadius: 10 }} />
                      </div>
                    ))}
                  </div>
                ) : feedItems.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <p style={{ fontWeight: 700, fontSize: '16px', marginBottom: 8 }}>لا توجد منشورات بعد</p>
                    <p style={{ fontSize: 14 }}>أضف مشروعًا أو رأيًا أو فعالية أو وظيفة وسيظهر هنا</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
                      <button className="action-btn primary" onClick={() => navigate('/projects')}>
                        <i className="fas fa-plus" /> مشروع جديد
                      </button>
                      <button className="action-btn primary" onClick={() => navigate('/reviews')} style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                        <i className="fas fa-feather" /> رأي جديد
                      </button>
                    </div>
                  </div>
                ) : (
                  feedItems.map((item, idx) => (
                    <div key={`${item.type}-${item.data.id}`} className="post-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                      <div className="post-header">
                        <div className="post-avatar" style={{
                          background:
                            item.type === 'project' ? '#dbeafe' :
                            item.type === 'review'  ? '#fef9c3' :
                            item.type === 'event'   ? '#dcfce7' : '#f3e8ff'
                        }}>
                          {item.type === 'project' ? '📁' : item.type === 'review' ? '✍️' : item.type === 'event' ? '📅' : '💼'}
                        </div>
                        <div className="post-meta">
                          <div className="post-name">{displayName}</div>
                          <div className="post-time">
                            {item.date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        {item.type === 'project' ? (
                          <span className="post-type-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>📁 مشروع</span>
                        ) : item.type === 'review' ? (
                          <span className="post-type-badge" style={{ background: '#fef9c3', color: '#a16207' }}>✍️ رأي</span>
                        ) : item.type === 'event' ? (
                          <span className="post-type-badge" style={{ background: '#dcfce7', color: '#15803d' }}>📅 فعالية</span>
                        ) : (
                          <span className="post-type-badge" style={{ background: '#f3e8ff', color: '#7c3aed' }}>💼 وظيفة</span>
                        )}
                      </div>

                      <div className="post-body">
                        {item.type === 'project' ? (() => {
                          const p = item.data as Project;
                          const typeInfo = PROJECT_TYPES[p.project_type] || { label: p.project_type, icon: '📋', color: '#64748b', bg: '#f8fafc' };
                          const statusInfo = getStatusConfig(p.status);
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <span style={{ fontSize: 24 }}>{typeInfo.icon}</span>
                                <div>
                                  <p className="post-text" style={{ margin: 0, fontWeight: 800, fontSize: 16, color: dm ? '#f1f5f9' : '#0f172a' }}>
                                    {p.project_name}
                                  </p>
                                  <span style={{ fontSize: 12, color: typeInfo.color, fontWeight: 700 }}>{typeInfo.label}</span>
                                </div>
                              </div>
                              {(p.duration || p.budget || p.target_area) && (
                                <div className="project-info-grid">
                                  {p.duration && (
                                    <div className="project-info-item">
                                      <div className="project-info-label">⏱ مدة التنفيذ</div>
                                      <div className="project-info-value">{p.duration}</div>
                                    </div>
                                  )}
                                  {p.budget && (
                                    <div className="project-info-item">
                                      <div className="project-info-label">💰 الميزانية</div>
                                      <div className="project-info-value">{p.budget}</div>
                                    </div>
                                  )}
                                  {p.target_area && (
                                    <div className="project-info-item" style={{ gridColumn: p.duration && p.budget ? '1 / -1' : 'auto' }}>
                                      <div className="project-info-label">📍 المنطقة</div>
                                      <div className="project-info-value">{p.target_area}</div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })() : item.type === 'review' ? (() => {
                          const r = item.data as Review;
                          return (
                            <>
                              <div className="stars-display" style={{ marginBottom: 10 }}>
                                {[1, 2, 3, 4, 5].map(s => (
                                  <span key={s} className="star" style={{ color: s <= r.rating ? '#fbbf24' : (dm ? '#374151' : '#d1d5db') }}>★</span>
                                ))}
                              </div>
                              {r.review_text && (
                                <p className="post-text">"{r.review_text}"</p>
                              )}
                            </>
                          );
                        })() : item.type === 'event' ? (() => {
                          const e = item.data as Event;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <p className="post-text" style={{ margin: 0, fontWeight: 800, fontSize: 16, color: dm ? '#f1f5f9' : '#0f172a' }}>
                                {e.event_name}
                              </p>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {e.city && <span style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b' }}>📍 {e.city}</span>}
                                {e.event_date && <span style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b' }}>🗓 {new Date(e.event_date).toLocaleDateString('ar-SA')}</span>}
                                {e.event_type && <span style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b' }}>🏷 {e.event_type}</span>}
                              </div>
                            </div>
                          );
                        })() : (() => {
                          const j = item.data as Job;
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <p className="post-text" style={{ margin: 0, fontWeight: 800, fontSize: 16, color: dm ? '#f1f5f9' : '#0f172a' }}>
                                {j.job_title}
                              </p>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {j.city && <span style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b' }}>📍 {j.city}</span>}
                                {j.work_type && <span style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b' }}>💼 {j.work_type}</span>}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="post-footer">
                        {item.type === 'project' ? (() => {
                          const statusInfo = getStatusConfig((item.data as Project).status);
                          return (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: statusInfo.bg, color: statusInfo.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusInfo.dot, display: 'inline-block' }} />
                              {statusInfo.label}
                            </span>
                          );
                        })() : item.type === 'review' ? (() => {
                          const r = item.data as Review;
                          return (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: r.is_active ? '#dcfce7' : '#fef9c3', color: r.is_active ? '#15803d' : '#a16207' }}>
                              {r.is_active ? '✓ منشور' : '⏳ قيد المراجعة'}
                            </span>
                          );
                        })() : item.type === 'event' ? (() => {
                          const cfg = EVENT_STATUS_CONFIG[(item.data as Event).status] || EVENT_STATUS_CONFIG.new;
                          return (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                              {cfg.label}
                            </span>
                          );
                        })() : (() => {
                          const cfg = JOB_STATUS_CONFIG[(item.data as Job).status] || JOB_STATUS_CONFIG.draft;
                          return (
                            <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: cfg.bg, color: cfg.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dot, display: 'inline-block' }} />
                              {cfg.label}
                            </span>
                          );
                        })()}
                        {isAdmin && (
                          <button
                            className="action-btn danger"
                            onClick={() =>
                              item.type === 'project' ? handleDeleteProject(item.data.id) :
                              item.type === 'review'  ? handleDeleteReview(item.data.id)  :
                              item.type === 'event'   ? handleDeleteEvent(item.data.id)   :
                              handleDeleteJob(item.data.id)
                            }
                          >
                            <i className="fas fa-trash-alt" /> حذف
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ===== PROFILE INFO TAB (staff) ===== */}
            {activeTab === 'feed' && !isClient && (
              <div>
                {profileData && (
                  <div className="info-card">
                    <h2 className="info-card-title">
                      <div className="info-title-icon" style={{ background: '#f0f9ff' }}>📋</div>
                      بيانات الحساب
                    </h2>
                    {profileData.type === 'employee' && (
                      <>
                        <div className="info-row">
                          <span className="info-label">الاسم</span>
                          <span className="info-value">{profileData.employee_name || '—'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">الدور</span>
                          <span className="info-value">
                            {profileData.employee_role === 'admin' ? '🛡️ مدير النظام' : '💼 موظف'}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="info-row">
                      <span className="info-label">البريد الإلكتروني</span>
                      <span className="info-value" style={{ fontSize: 13 }}>{user?.email}</span>
                    </div>
                  </div>
                )}
                <div className="info-card">
                  <h2 className="info-card-title">
                    <div className="info-title-icon" style={{ background: '#fef3c7' }}>🔗</div>
                    روابط سريعة
                  </h2>
                  <button className="quick-link" onClick={() => navigate('/reviews')}>
                    <i className="fas fa-star" /> آراء العملاء
                  </button>
                  <button className="quick-link" onClick={() => navigate('/projects')}>
                    <i className="fas fa-folder" /> المشاريع
                  </button>
                  {isStaff && (
                    <button className="quick-link primary" onClick={() => navigate('/dashboard')}>
                      <i className="fas fa-tachometer-alt" /> لوحة التحكم
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ===== PROJECTS TAB ===== */}
            {activeTab === 'projects' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: dm ? '#f1f5f9' : '#0f172a' }}>
                    مشاريعي ({myProjects.length})
                  </h2>
                  <button className="action-btn primary" onClick={() => navigate('/projects')}>
                    <i className="fas fa-plus" /> مشروع جديد
                  </button>
                </div>

                {loadingProjects ? (
                  [1, 2].map(i => (
                    <div key={i} className="post-card" style={{ padding: 20 }}>
                      <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
                    </div>
                  ))
                ) : myProjects.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📂</span>
                    <p style={{ fontWeight: 700 }}>لا توجد مشاريع بعد</p>
                    <button className="action-btn primary" onClick={() => navigate('/projects')} style={{ margin: '12px auto 0' }}>
                      <i className="fas fa-plus" /> أضف مشروعك الأول
                    </button>
                  </div>
                ) : (
                  myProjects.map((p, idx) => {
                    const typeInfo = PROJECT_TYPES[p.project_type] || { label: p.project_type, icon: '📋', color: '#64748b', bg: '#f8fafc' };
                    const statusInfo = getStatusConfig(p.status);
                    return (
                      <div key={p.id} className="post-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                        <div className="post-header">
                          <div className="post-avatar" style={{ background: typeInfo.bg, fontSize: 22 }}>{typeInfo.icon}</div>
                          <div className="post-meta">
                            <div className="post-name">{p.project_name}</div>
                            <div className="post-time">{new Date(p.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: typeInfo.color }}>{typeInfo.label}</span>
                        </div>
                        <div className="post-footer">
                          <span style={{ fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: statusInfo.bg, color: statusInfo.color, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusInfo.dot, display: 'inline-block' }} />
                            {statusInfo.label}
                          </span>
                          {isAdmin && (
                            <button className="action-btn danger" onClick={() => handleDeleteProject(p.id)}>
                              <i className="fas fa-trash-alt" /> حذف
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ===== EVENTS TAB ===== */}
            {activeTab === 'events' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: dm ? '#f1f5f9' : '#0f172a' }}>
                    فعالياتي ({myEvents.length})
                  </h2>
                  <button className="action-btn primary" onClick={() => navigate('/events')}
                    style={{ background: 'linear-gradient(135deg,#0891b2,#06b6d4)' }}>
                    <i className="fas fa-plus" /> فعالية جديدة
                  </button>
                </div>

                {loadingEvents ? (
                  [1, 2].map(i => (
                    <div key={i} className="post-card" style={{ padding: 20 }}>
                      <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
                    </div>
                  ))
                ) : myEvents.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">📅</span>
                    <p style={{ fontWeight: 700 }}>لا توجد فعاليات بعد</p>
                    <button className="action-btn primary" onClick={() => navigate('/events')} style={{ margin: '12px auto 0' }}>
                      <i className="fas fa-plus" /> أضف فعاليتك الأولى
                    </button>
                  </div>
                ) : (
                  myEvents.map((ev, idx) => {
                    const evStatus = EVENT_STATUS_CONFIG[ev.status] ?? EVENT_STATUS_CONFIG['new'];
                    return (
                      <div key={ev.id} className="post-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                        <div className="post-header">
                          <div className="post-avatar" style={{ background: '#e0f2fe', fontSize: 22 }}>📅</div>
                          <div className="post-meta">
                            <div className="post-name">{ev.event_name}</div>
                            <div className="post-time">
                              {ev.city} · {ev.event_date
                                ? new Date(ev.event_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
                                : new Date(ev.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#0891b2' }}>{ev.event_type}</span>
                        </div>
                        <div className="post-footer">
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                            background: evStatus.bg, color: evStatus.color,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: evStatus.dot, display: 'inline-block' }} />
                            {evStatus.label}
                          </span>
                          {isAdmin && (
                            <button className="action-btn danger" onClick={() => handleDeleteEvent(ev.id)}>
                              <i className="fas fa-trash-alt" /> حذف
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ===== JOBS TAB ===== */}
            {activeTab === 'jobs' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: dm ? '#f1f5f9' : '#0f172a' }}>
                    وظائفي ({myJobs.length})
                  </h2>
                  <button className="action-btn primary" onClick={() => navigate('/jobs')}
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                    <i className="fas fa-plus" /> وظيفة جديدة
                  </button>
                </div>

                {loadingJobs ? (
                  [1, 2].map(i => (
                    <div key={i} className="post-card" style={{ padding: 20 }}>
                      <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: 10, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 40, borderRadius: 8 }} />
                    </div>
                  ))
                ) : myJobs.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">💼</span>
                    <p style={{ fontWeight: 700 }}>لا توجد وظائف بعد</p>
                    <button className="action-btn primary" onClick={() => navigate('/jobs')} style={{ margin: '12px auto 0', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                      <i className="fas fa-plus" /> أضف وظيفتك الأولى
                    </button>
                  </div>
                ) : (
                  myJobs.map((job, idx) => {
                    const jobStatus = JOB_STATUS_CONFIG[job.status] ?? JOB_STATUS_CONFIG['draft'];
                    const workLabels: Record<string, string> = { remote: 'عن بُعد', field: 'ميداني', hybrid: 'هجين' };
                    return (
                      <div key={job.id} className="post-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                        <div className="post-header">
                          <div className="post-avatar" style={{ background: '#f3e8ff', fontSize: 22 }}>💼</div>
                          <div className="post-meta">
                            <div className="post-name">{job.job_title}</div>
                            <div className="post-time">
                              {job.city} · {workLabels[job.work_type] ?? job.work_type}
                            </div>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}>
                            {new Date(job.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className="post-footer">
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                            background: jobStatus.bg, color: jobStatus.color,
                            display: 'flex', alignItems: 'center', gap: 5,
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: jobStatus.dot, display: 'inline-block' }} />
                            {jobStatus.label}
                          </span>
                          {isAdmin && (
                            <button className="action-btn danger" onClick={() => handleDeleteJob(job.id)}>
                              <i className="fas fa-trash-alt" /> حذف
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ===== REVIEWS TAB ===== */}
            {activeTab === 'reviews' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: dm ? '#f1f5f9' : '#0f172a' }}>
                    آرائي ({myReviews.length})
                  </h2>
                  <button className="action-btn primary" onClick={() => navigate('/reviews')} style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                    <i className="fas fa-feather" /> رأي جديد
                  </button>
                </div>

                {loadingReviews ? (
                  [1, 2].map(i => (
                    <div key={i} className="post-card" style={{ padding: 20 }}>
                      <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: 10, borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 50, borderRadius: 8 }} />
                    </div>
                  ))
                ) : myReviews.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-icon">✍️</span>
                    <p style={{ fontWeight: 700 }}>لا توجد آراء بعد</p>
                    <button className="action-btn primary" onClick={() => navigate('/reviews')} style={{ margin: '12px auto 0', background: 'linear-gradient(135deg,#7c3aed,#6d28d9)' }}>
                      <i className="fas fa-feather" /> شارك رأيك
                    </button>
                  </div>
                ) : (
                  myReviews.map((r, idx) => (
                    <div key={r.id} className="post-card" style={{ animationDelay: `${idx * 0.06}s` }}>
                      <div className="post-header">
                        <div className="post-avatar" style={{ background: '#fef9c3', fontSize: 20 }}>✍️</div>
                        <div className="post-meta">
                          <div className="post-name">{displayName}</div>
                          <div className="post-time">{new Date(r.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                        </div>
                        <div className="stars-display">
                          {[1, 2, 3, 4, 5].map(s => (
                            <span key={s} style={{ fontSize: 16, color: s <= r.rating ? '#fbbf24' : (dm ? '#374151' : '#d1d5db') }}>★</span>
                          ))}
                        </div>
                      </div>
                      {r.review_text && (
                        <div className="post-body">
                          <p className="post-text">"{r.review_text}"</p>
                        </div>
                      )}
                      <div className="post-footer">
                        <span style={{
                          fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                          background: r.is_active ? '#dcfce7' : '#fef9c3',
                          color: r.is_active ? '#15803d' : '#a16207',
                        }}>
                          {r.is_active ? '✓ منشور' : '⏳ قيد المراجعة'}
                        </span>
                        {isAdmin && (
                          <button className="action-btn danger" onClick={() => handleDeleteReview(r.id)}>
                            <i className="fas fa-trash-alt" /> حذف
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ===== SETTINGS TAB ===== */}
            {activeTab === 'settings' && (
              <div>
                {/* Profile Info */}
                {profileData && (
                  <div className="info-card">
                    <h2 className="info-card-title">
                      <div className="info-title-icon" style={{ background: '#f0f9ff' }}>📋</div>
                      بيانات الحساب
                    </h2>
                    {profileData.type === 'client' && (
                      <>
                        {profileData.association_name && (
                          <div className="info-row">
                            <span className="info-label">اسم الكيان</span>
                            <span className="info-value">{profileData.association_name}</span>
                          </div>
                        )}
                        {profileData.entity_type && (
                          <div className="info-row">
                            <span className="info-label">نوع الكيان</span>
                            <span className="info-value">{profileData.entity_type}</span>
                          </div>
                        )}
                        {profileData.user_phone && (
                          <div className="info-row">
                            <span className="info-label">رقم الجوال</span>
                            <span className="info-value">{profileData.user_phone}</span>
                          </div>
                        )}
                        {profileData.license_number && (
                          <div className="info-row">
                            <span className="info-label">رقم الترخيص</span>
                            <span className="info-value">{profileData.license_number}</span>
                          </div>
                        )}
                      </>
                    )}
                    {profileData.type === 'employee' && (
                      <>
                        <div className="info-row">
                          <span className="info-label">الاسم</span>
                          <span className="info-value">{profileData.employee_name || '—'}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">الدور الوظيفي</span>
                          <span className="info-value">{profileData.employee_role === 'admin' ? '🛡️ مدير النظام' : '💼 موظف'}</span>
                        </div>
                      </>
                    )}
                    <div className="info-row">
                      <span className="info-label">البريد الإلكتروني</span>
                      <span className="info-value" style={{ fontSize: 13 }}>{user?.email}</span>
                    </div>
                  </div>
                )}

                {/* Quick Links */}
                <div className="info-card">
                  <h2 className="info-card-title">
                    <div className="info-title-icon" style={{ background: '#fef3c7' }}>🔗</div>
                    روابط سريعة
                  </h2>
                  <button className="quick-link" onClick={() => navigate('/reviews')}>
                    <i className="fas fa-star" style={{ color: '#f59e0b' }} /> آراء العملاء
                  </button>
                  <button className="quick-link" onClick={() => navigate('/projects')}>
                    <i className="fas fa-folder" style={{ color: '#3b82f6' }} /> المشاريع
                  </button>
                  {isStaff && (
                    <button className="quick-link primary" onClick={() => navigate('/dashboard')}>
                      <i className="fas fa-tachometer-alt" /> لوحة التحكم
                    </button>
                  )}
                </div>

                {/* Update Email */}
                <div className="info-card">
                  <h2 className="info-card-title">
                    <div className="info-title-icon" style={{ background: '#ecfeff' }}>✉️</div>
                    تغيير البريد الإلكتروني
                  </h2>
                  <form onSubmit={handleUpdateEmail} noValidate>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', marginBottom: 7, fontWeight: 700, fontSize: 13, color: dm ? '#cbd5e1' : '#374151' }}>
                        البريد الإلكتروني الجديد
                      </label>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className="form-input"
                        autoComplete="email"
                        maxLength={254}
                        spellCheck={false}
                        required
                      />
                    </div>
                    {emailMsg && (
                      <div className="msg-box" style={{ background: emailMsg.ok ? '#d1fae5' : '#fee2e2', color: emailMsg.ok ? '#065f46' : '#b91c1c' }}>
                        {emailMsg.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loadingEmail}
                      className="submit-btn"
                      style={{ background: 'linear-gradient(135deg,#0891b2,#06b6d4)', color: '#fff', boxShadow: '0 4px 14px rgba(8,145,178,0.3)' }}
                    >
                      {loadingEmail ? <><span className="spinner" /> جاري التحديث...</> : <><i className="fas fa-save" /> تحديث البريد</>}
                    </button>
                  </form>
                </div>

                {/* Update Password */}
                <div className="info-card">
                  <h2 className="info-card-title">
                    <div className="info-title-icon" style={{ background: '#faf5ff' }}>🔐</div>
                    تغيير كلمة المرور
                  </h2>
                  <form onSubmit={handleUpdatePassword} noValidate>
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <label style={{ display: 'block', marginBottom: 7, fontWeight: 700, fontSize: 13, color: dm ? '#cbd5e1' : '#374151' }}>
                        كلمة المرور الجديدة
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="8 أحرف على الأقل"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="form-input"
                          style={{ paddingLeft: 42 }}
                          autoComplete="new-password"
                          maxLength={128}
                          required
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {/* Password strength meter */}
                      {newPassword && (() => {
                        const strength = getPasswordStrength(newPassword);
                        return (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                              {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} style={{
                                  flex: 1, height: 4, borderRadius: 4,
                                  background: i <= strength.score ? strength.color : (dm ? '#334155' : '#e2e8f0'),
                                  transition: 'background 0.3s ease',
                                }} />
                              ))}
                            </div>
                            <p style={{ fontSize: 12, color: strength.color, margin: 0, fontWeight: 700 }}>
                              قوة كلمة المرور: {strength.label}
                            </p>
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <label style={{ display: 'block', marginBottom: 7, fontWeight: 700, fontSize: 13, color: dm ? '#cbd5e1' : '#374151' }}>
                        تأكيد كلمة المرور
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input
                          type={showConfirm ? 'text' : 'password'}
                          placeholder="أعد كتابة كلمة المرور"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="form-input"
                          autoComplete="new-password"
                          maxLength={128}
                          style={{
                            paddingLeft: 42,
                            borderColor: confirmPassword && newPassword !== confirmPassword ? '#ef4444' : undefined,
                          }}
                          required
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowConfirm(!showConfirm)}>
                          {showConfirm ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {confirmPassword && newPassword !== confirmPassword && (
                        <p style={{ fontSize: 12, color: '#ef4444', margin: '4px 0 0' }}>❌ كلمتا المرور غير متطابقتان</p>
                      )}
                      {confirmPassword && newPassword === confirmPassword && newPassword && (
                        <p style={{ fontSize: 12, color: '#10b981', margin: '4px 0 0' }}>✅ كلمتا المرور متطابقتان</p>
                      )}
                    </div>
                    {passMsg && (
                      <div className="msg-box" style={{ background: passMsg.ok ? '#d1fae5' : '#fee2e2', color: passMsg.ok ? '#065f46' : '#b91c1c' }}>
                        {passMsg.text}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={loadingPass}
                      className="submit-btn"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
                    >
                      {loadingPass ? <><span className="spinner" /> جاري التحديث...</> : <><i className="fas fa-key" /> تحديث كلمة المرور</>}
                    </button>
                  </form>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}

export default Profile;