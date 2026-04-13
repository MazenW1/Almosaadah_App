import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchMyReviews, fetchMyProjects, deleteReview, deleteProject } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { BackgroundAnimation } from '../components/BackgroundAnimation';

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

type TabType = 'feed' | 'projects' | 'reviews' | 'settings';

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
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isStaff = isAdmin || isEmployee;
  // أضف هذا في أي صفحة تحتاج تعرف الوضع:
const [isDarkMode, setIsDarkMode] = useState(
  document.documentElement.classList.contains('dark')
);

useEffect(() => {
  const observer = new MutationObserver(() => {
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  });
  observer.observe(document.documentElement, { attributeFilter: ['class'] });
  return () => observer.disconnect();
}, []);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const fetchProfile = async () => {
      const { data: emp } = await supabase.from('employees').select('*').eq('employee_email', user.email).maybeSingle();
      if (emp) { setProfileData({ ...emp, type: 'employee' }); return; }
      const { data: usr } = await supabase.from('user').select('*').eq('user_email', user.email).maybeSingle();
      if (usr) setProfileData({ ...usr, type: 'client' });
    };
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user?.id || isStaff) return;
    const fetchUserData = async () => {
      setLoadingReviews(true);
      setLoadingProjects(true);
      try {
        const [reviewsRes, projectsRes] = await Promise.all([fetchMyReviews(user.id), fetchMyProjects(user.id)]);
        if (reviewsRes.data) setMyReviews(reviewsRes.data);
        if (projectsRes.data) setMyProjects(projectsRes.data);
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoadingReviews(false);
        setLoadingProjects(false);
      }
    };
    fetchUserData();
  }, [user, isStaff]);

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    setLoadingEmail(true);
    setEmailMsg(null);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoadingEmail(false);
    if (error) {
      setEmailMsg({ text: error.message || 'حدث خطأ أثناء تحديث البريد', ok: false });
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
    if (newPassword !== confirmPassword) {
      setPassMsg({ text: 'كلمتا المرور غير متطابقتان', ok: false });
      return;
    }
    setLoadingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoadingPass(false);
    if (error) {
      setPassMsg({ text: error.message || 'حدث خطأ أثناء تحديث كلمة المرور', ok: false });
    } else {
      setPassMsg({ text: '✓ تم تحديث كلمة المرور بنجاح', ok: true });
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleDeleteReview = async (id: string) => {
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
    ...myReviews.map(r => ({ type: 'review' as const, data: r, date: new Date(r.created_at) })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const dm = isDarkMode;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
        
        * { box-sizing: border-box; }

        .profile-root {
          min-height: 100vh;
          font-family: 'Tajawal', sans-serif;
          direction: rtl;
          position: relative;
        }

        /* ===== COVER & AVATAR ===== */
        .profile-cover {
          height: 200px;
          position: relative;
          overflow: hidden;
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
          padding: 0 24px 0;
          margin-top: -48px;
          z-index: 10;
        }

        .profile-avatar-ring {
          width: 96px; height: 96px;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(135deg, #06b6d4, #7c3aed);
          box-shadow: 0 8px 32px rgba(8,145,178,0.4);
          display: inline-block;
          margin-bottom: 12px;
          animation: avatarEntrance 0.6s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        @keyframes avatarEntrance {
          from { transform: scale(0) rotate(-180deg); opacity: 0; }
          to   { transform: scale(1) rotate(0deg);   opacity: 1; }
        }

        .profile-avatar-inner {
          width: 100%; height: 100%;
          border-radius: 50%;
          background: ${role.gradient};
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          color: white;
          border: 3px solid ${dm ? '#0f172a' : '#ffffff'};
        }

        /* ===== STATS BAR ===== */
        .profile-stats {
          display: flex;
          gap: 2px;
          margin-top: 16px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 16px rgba(0,0,0,0.06);
        }

        .stat-item {
          flex: 1;
          padding: 14px 8px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border-bottom: 3px solid transparent;
        }

        .stat-item:hover { background: ${dm ? 'rgba(51,65,85,0.9)' : 'rgba(240,249,255,0.95)'}; }

        .stat-item.active {
          border-bottom-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.15)' : 'rgba(224,242,254,0.8)'};
        }

        .stat-number {
          font-size: 20px;
          font-weight: 900;
          color: #0891b2;
          line-height: 1;
        }

        .stat-label {
          font-size: 11px;
          font-weight: 600;
          color: ${dm ? '#94a3b8' : '#64748b'};
          margin-top: 3px;
        }

        /* ===== TAB NAV ===== */
        .tab-nav {
          display: flex;
          gap: 4px;
          padding: 12px 16px;
          border-bottom: 1px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
          background: ${dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)'};
          position: sticky;
          top: 0;
          z-index: 20;
          backdrop-filter: blur(12px);
        }

        .tab-btn {
          flex: 1;
          padding: 10px 6px;
          border: none;
          border-radius: 12px;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          color: ${dm ? '#94a3b8' : '#64748b'};
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
          padding: 20px 16px;
          max-width: 680px;
          margin: 0 auto;
        }

        /* ===== FEED POST CARD ===== */
        .post-card {
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          border-radius: 20px;
          margin-bottom: 16px;
          overflow: hidden;
          box-shadow: 0 2px 20px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
          animation: cardSlideIn 0.5s ease both;
          backdrop-filter: blur(12px);
        }

        .post-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transform: translateY(-2px);
          border-color: rgba(8,145,178,0.3);
        }

        @keyframes cardSlideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .post-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px 20px 12px;
        }

        .post-avatar {
          width: 42px; height: 42px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
        }

        .post-meta { flex: 1; min-width: 0; }

        .post-name {
          font-size: 14px;
          font-weight: 800;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
        }

        .post-time {
          font-size: 12px;
          color: ${dm ? '#64748b' : '#94a3b8'};
          margin-top: 1px;
        }

        .post-type-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .post-body { padding: 0 20px 16px; }

        .post-text {
          font-size: 14px;
          line-height: 1.65;
          color: ${dm ? '#cbd5e1' : '#374151'};
          margin-bottom: 12px;
        }

        .post-footer {
          padding: 12px 20px;
          border-top: 1px solid ${dm ? 'rgba(51,65,85,0.5)' : '#f1f5f9'};
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        /* ===== STAR DISPLAY ===== */
        .stars-display { display: flex; gap: 3px; direction: ltr; }
        .star { font-size: 18px; transition: transform 0.1s; }
        .star:hover { transform: scale(1.2); }

        /* ===== PROJECT INFO GRID ===== */
        .project-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 12px;
        }

        .project-info-item {
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f8fafc'};
          border-radius: 10px;
          padding: 10px 12px;
        }

        .project-info-label {
          font-size: 11px;
          color: ${dm ? '#64748b' : '#94a3b8'};
          font-weight: 600;
          margin-bottom: 3px;
        }

        .project-info-value {
          font-size: 13px;
          font-weight: 700;
          color: ${dm ? '#e2e8f0' : '#0f172a'};
        }

        /* ===== ACTION BUTTONS ===== */
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 10px;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
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

        /* ===== PROFILE INFO CARD ===== */
        .info-card {
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.95)'};
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 16px;
          backdrop-filter: blur(12px);
        }

        .info-card-title {
          font-size: 15px;
          font-weight: 800;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 18px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 14px;
          border-bottom: 1.5px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
        }

        .info-title-icon {
          width: 34px; height: 34px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
        }

        .info-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 11px 0;
          border-bottom: 1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f8fafc'};
          font-size: 14px;
        }
        .info-row:last-child { border-bottom: none; padding-bottom: 0; }
        .info-label { color: ${dm ? '#64748b' : '#64748b'}; font-weight: 600; }
        .info-value { color: ${dm ? '#e2e8f0' : '#0f172a'}; font-weight: 700; direction: ltr; }

        /* ===== FORM INPUTS ===== */
        .form-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 12px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f8fafc'};
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          direction: ltr;
          text-align: right;
        }

        .form-input:focus {
          border-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.08)' : '#fff'};
          box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
        }

        .submit-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 16px;
          transition: all 0.25s ease;
        }

        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .submit-btn:not(:disabled):hover { transform: translateY(-1px); filter: brightness(1.05); }

        .msg-box {
          padding: 11px 15px;
          border-radius: 10px;
          margin-top: 12px;
          font-size: 13px;
          font-weight: 600;
          animation: fadeSlide 0.3s ease;
        }

        .pw-toggle {
          position: absolute;
          left: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #94a3b8;
          font-size: 15px; padding: 4px;
          transition: color 0.2s;
        }
        .pw-toggle:hover { color: #0891b2; }

        /* ===== QUICK LINKS ===== */
        .quick-link {
          width: 100%;
          padding: 14px;
          border-radius: 14px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.7)' : '#f8fafc'};
          color: ${dm ? '#cbd5e1' : '#475569'};
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 10px;
          transition: all 0.25s ease;
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

        /* ===== EMPTY STATE ===== */
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: ${dm ? '#64748b' : '#94a3b8'};
        }

        .empty-icon {
          font-size: 56px;
          display: block;
          margin-bottom: 16px;
          opacity: 0.5;
          animation: float 3s ease-in-out infinite;
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
          top: 16px;
          right: 16px;
          z-index: 20;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          padding: 8px 16px;
          color: white;
          font-family: 'Tajawal', sans-serif;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s ease;
        }
        .back-btn:hover { background: rgba(255,255,255,0.25); }

        /* ===== DARK MODE TOGGLE ===== */
        .dm-toggle {
          position: absolute;
          top: 16px;
          left: 16px;
          z-index: 20;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 12px;
          padding: 8px 12px;
          color: white;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
        }
        .dm-toggle:hover { background: rgba(255,255,255,0.25); }

        /* ===== ROLE BADGE ===== */
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 700;
          margin-top: 4px;
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
      `}</style>

      <div className={`profile-root ${dm ? 'dark-bg' : 'light-bg'}`}>
        <BackgroundAnimation isDarkMode={dm} />

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

            <button className="dm-toggle" onClick={() => setIsDarkMode(!dm)}>
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
                <div className="stat-number">{myProjects.length + myReviews.length}</div>
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
                {(loadingReviews || loadingProjects) ? (
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
                    <p style={{ fontSize: 14 }}>أضف مشروعًا أو رأيًا وسيظهر هنا</p>
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
                        <div className="post-avatar" style={{ background: item.type === 'project' ? '#dbeafe' : '#fef9c3' }}>
                          {item.type === 'project' ? '📁' : '✍️'}
                        </div>
                        <div className="post-meta">
                          <div className="post-name">{displayName}</div>
                          <div className="post-time">
                            {item.date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </div>
                        </div>
                        {item.type === 'project' ? (
                          <span className="post-type-badge" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                            📁 مشروع
                          </span>
                        ) : (
                          <span className="post-type-badge" style={{ background: '#fef9c3', color: '#a16207' }}>
                            ✍️ رأي
                          </span>
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
                        })() : (() => {
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
                        })()}
                      </div>

                      <div className="post-footer">
                        {item.type === 'project' ? (() => {
                          const statusInfo = getStatusConfig((item.data as Project).status);
                          return (
                            <span style={{
                              fontSize: 12, fontWeight: 700,
                              padding: '5px 12px', borderRadius: 20,
                              background: statusInfo.bg, color: statusInfo.color,
                              display: 'flex', alignItems: 'center', gap: 5,
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: statusInfo.dot, display: 'inline-block' }} />
                              {statusInfo.label}
                            </span>
                          );
                        })() : (
                          <span style={{
                            fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                            background: (item.data as Review).is_active ? '#dcfce7' : '#fef9c3',
                            color: (item.data as Review).is_active ? '#15803d' : '#a16207',
                          }}>
                            {(item.data as Review).is_active ? '✓ منشور' : '⏳ قيد المراجعة'}
                          </span>
                        )}
                        <button
                          className="action-btn danger"
                          onClick={() => item.type === 'project' ? handleDeleteProject(item.data.id) : handleDeleteReview(item.data.id)}
                        >
                          <i className="fas fa-trash-alt" /> حذف
                        </button>
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
                          <button className="action-btn danger" onClick={() => handleDeleteProject(p.id)}>
                            <i className="fas fa-trash-alt" /> حذف
                          </button>
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
                        <button className="action-btn danger" onClick={() => handleDeleteReview(r.id)}>
                          <i className="fas fa-trash-alt" /> حذف
                        </button>
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
                          required
                        />
                        <button type="button" className="pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
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