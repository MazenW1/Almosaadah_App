// pages/ProjectsPage.tsx
import { useState, useEffect, useRef } from 'react';
const formatBudget = (value: string): string => {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('ar-SA');
};

const parseBudget = (value: string): string => {
  return value.replace(/[^\d]/g, '');
};
import { useNavigate } from 'react-router-dom';
import { 
  supabase, 
  fetchProjects, 
  createProject, 
  deleteProject, 
  uploadProjectFile 
} from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { BackgroundAnimation } from '../components/BackgroundAnimation';
import { Header } from '../components/Header';
import { AdminReviewQueue } from '../components/AdminReviewQueue';
 
const SAUDI_CITIES = [
  'الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الظهران','الطائف','تبوك',
  'بريدة','خميس مشيط','الهفوف','المبرز','حائل','نجران','الجبيل','ينبع','القطيف','عرعر',
  'سكاكا','جازان','أبها','الباحة','بيشة','الدوادمي','الخرج','المجمعة','الزلفي','شقراء',
  'وادي الدواسر','رنية','تربة','القنفذة','الليث','رابغ','ضباء','العقيق','المخواة','سراة عبيدة',
  'الحريق','الأفلاج','حوطة بني تميم','الدوادمي','القريات','عفيف','المذنب','الرس','الأسياح',
];

const PROJECT_TYPES = [
  { id: 'emergency',   label: 'الإغاثة العاجلة',    icon: 'fa-ambulance',     emoji: '🚑', color: '#dc2626', light: '#fef2f2', dark: 'rgba(220,38,38,0.12)' },
  { id: 'development', label: 'مشاريع التنمية',     icon: 'fa-seedling',      emoji: '🌱', color: '#16a34a', light: '#f0fdf4', dark: 'rgba(22,163,74,0.12)' },
  { id: 'social',      label: 'الرعاية الاجتماعية', icon: 'fa-hands-helping', emoji: '🤝', color: '#2563eb', light: '#eff6ff', dark: 'rgba(37,99,235,0.12)' },
  { id: 'seasonal',    label: 'المشاريع الموسمية',  icon: 'fa-calendar-alt',  emoji: '📅', color: '#ea580c', light: '#fff7ed', dark: 'rgba(234,88,12,0.12)' },
  { id: 'endowment',   label: 'المشاريع الوقفية',   icon: 'fa-mosque',        emoji: '🕌', color: '#7c3aed', light: '#faf5ff', dark: 'rgba(124,58,237,0.12)' },
];
 
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; dot: string }> = {
  approved: { label: 'مقبول',        bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  rejected: { label: 'مرفوض',        bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
  pending:  { label: 'قيد المراجعة', bg: '#fef9c3', color: '#a16207', dot: '#eab308' },
};
 
interface Project {
  id: string;
  user_id: string;
  project_name: string;
  duration: string;
  budget: string;
  target_area: string;
  project_type: string;
  project_file_url: string | null;
  file_name: string | null;
  status: string;
  accreditation_body: string | null;
  created_at: string;
  user?: { association_name: string };
}
 
export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, isClient, profileLoading } = useAuth();
  const { showToast } = useToast();
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ project_name: '', duration: '', budget: '', target_area: '', project_type: '' });
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAdminQueue, setShowAdminQueue] = useState(false);
  const [approveModal, setApproveModal] = useState<{ open: boolean; projectId: string; projectName: string }>({ open: false, projectId: '', projectName: '' });
  const [accreditationBody, setAccreditationBody] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [currentUserAssociation, setCurrentUserAssociation] = useState<string>('');
  const [cityFilter, setCityFilter] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [targetAreaInput, setTargetAreaInput] = useState('');
  const [showAreaSuggestions, setShowAreaSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  const isStaff = isAdmin || isEmployee;
  const dm = isDarkMode;

  // جلب اسم الجمعية للمستخدم الحالي
  useEffect(() => {
    const fetchAssociation = async () => {
      if (!user?.email || isStaff) return;
      try {
        const { data } = await supabase
          .from('user')
          .select('association_name')
          .eq('user_email', user.email)
          .maybeSingle();
        if (data?.association_name) setCurrentUserAssociation(data.association_name);
      } catch {}
    };
    fetchAssociation();
  }, [user]);
 
  useEffect(() => { loadProjects(); }, [selectedType]);
 
  const loadProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await fetchProjects(selectedType);
      if (error) throw error;
      setProjects(data || []);
    } catch (err) {
      showToast('حدث خطأ في تحميل المشاريع', 'error');
    } finally {
      setLoading(false);
    }
  };
 
const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // DEBUG مؤقت
    console.log('DEBUG SUBMIT:', { userId: user?.id, isAdmin, isEmployee, isClient, isStaff, profileLoading });

    // التحقق من البيانات والملف
    if (!user) { showToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (isStaff) { showToast('هذه الميزة للعملاء فقط', 'error'); return; }
    if (!formData.project_name.trim()) { showToast('يرجى إدخال اسم المشروع', 'error'); return; }
    if (!projectFile) { showToast('يرجى إرفاق ملف المشروع أولاً', 'error'); return; }

    setIsSubmitting(true);
    try {
      // 1. رفع الملف أولاً
      const uploaded = await uploadProjectFile(projectFile, user.id);
      
      if (!uploaded || !uploaded.url) {
        throw new Error('فشل رفع الملف، حاول مرة أخرى');
      }

      // 2. إرسال البيانات (بدون حقل id)
      const { error } = await createProject({
        user_id: user.id, // لضمان تخطي سياسة RLS
        project_name: formData.project_name,
        duration: formData.duration || '',
        budget: formData.budget || '',
        target_area: formData.target_area || '',
        project_type: formData.project_type,
        project_file_url: uploaded.url,
        file_name: uploaded.name,
        status: 'pending',
        is_active: true,
      });

      if (error) throw error;

      // 3. في حالة النجاح
      showToast('تم إضافة المشروع بنجاح! 🎉', 'success');
      setShowForm(false);
      setProjectFile(null);
      setFormData({ project_name: '', duration: '', budget: '', target_area: '', project_type: '' });
      loadProjects();

    } catch (err: any) {
      console.error("SQL/DB Error:", err);
      showToast(err.message || 'حدث خطأ في قاعدة البيانات', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };
 
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;
    try {
      const { error } = await deleteProject(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      loadProjects();
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };
 
  const handleApprove = async () => {
    if (!accreditationBody.trim()) { showToast('يرجى إدخال اسم جهة الاعتماد', 'error'); return; }
    setIsApproving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: 'approved', accreditation_body: accreditationBody.trim() })
        .eq('id', approveModal.projectId);
      if (error) throw error;
      showToast('تم اعتماد المشروع بنجاح ✅', 'success');
      setApproveModal({ open: false, projectId: '', projectName: '' });
      setAccreditationBody('');
      loadProjects();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    // visibility: non-approved projects only for owner, admin, employee
    if (p.status !== 'approved') {
      if (!user) return false;
      if (!isStaff && user.id !== p.user_id) return false;
    }
    // العميل: يشوف مشاريعه + المشاريع المقبولة للآخرين
    // (هذا مفروض بالشرط فوق بالفعل)

    const matchSearch =
      p.project_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.target_area || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchCity = !cityFilter ||
      (p.target_area || '').toLowerCase().includes(cityFilter.toLowerCase());

    return matchSearch && matchCity;
  });
 
  const getTypeInfo = (typeId: string) => PROJECT_TYPES.find(t => t.id === typeId) || { label: typeId, icon: 'fa-folder', emoji: '📋', color: '#64748b', light: '#f8fafc', dark: 'rgba(100,116,139,0.1)' };
 
  const projectCounts = PROJECT_TYPES.reduce((acc, t) => {
    acc[t.id] = projects.filter(p => p.project_type === t.id).length;
    return acc;
  }, {} as Record<string, number>);
 
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
 
        @keyframes fadeUp   { from { opacity:0; transform:translateY(24px) } to { opacity:1; transform:translateY(0) } }
        @keyframes scaleIn  { from { opacity:0; transform:scale(0.92)      } to { opacity:1; transform:scale(1)     } }
        @keyframes cardIn   { from { opacity:0; transform:translateY(16px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes spin     { to { transform: rotate(360deg) } }
        @keyframes shimmer  { 0%{ background-position:-200% 0 } 100%{ background-position:200% 0 } }
        @keyframes accred-shine { 0%{ left:-100% } 60%{ left:150% } 100%{ left:150% } }
        @keyframes iconBounce { 0%,100%{ transform:translateY(0) scale(1) } 50%{ transform:translateY(-8px) scale(1.1) } }
        @keyframes pulse-dot  { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
 
        /* ===== HERO ===== */
        .proj-hero {
          padding: 100px 24px 40px;
          position: relative;
          z-index: 10;
          animation: fadeUp 0.7s ease both;
        }
 
        .proj-hero-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
        }
 
        .proj-hero-text { flex: 1; min-width: 240px; }
 
        .proj-hero-icon {
          width: 72px; height: 72px;
          border-radius: 22px;
          background: ${dm ? 'linear-gradient(135deg,#1e3a5f,#0891b2)' : 'linear-gradient(135deg,#e0f2fe,#bae6fd)'};
          display: flex; align-items: center; justify-content: center;
          font-size: 32px;
          box-shadow: ${dm ? '0 8px 32px rgba(8,145,178,0.4)' : '0 8px 32px rgba(8,145,178,0.2)'};
          margin-bottom: 16px;
          animation: iconBounce 3s ease-in-out infinite;
        }
 
        .proj-hero-title {
          font-size: clamp(26px, 4vw, 40px);
          font-weight: 900;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 8px;
        }
 
        .proj-hero-sub {
          font-size: 15px;
          color: ${dm ? '#94a3b8' : '#64748b'};
          margin: 0;
        }
 
        /* ===== TOTAL BADGE ===== */
        .total-badge {
          padding: 14px 24px;
          border-radius: 18px;
          background: ${dm ? 'rgba(8,145,178,0.12)' : 'rgba(8,145,178,0.08)'};
          border: 1px solid ${dm ? 'rgba(8,145,178,0.3)' : 'rgba(8,145,178,0.2)'};
          text-align: center;
          backdrop-filter: blur(12px);
          flex-shrink: 0;
        }
 
        .total-num {
          font-size: 36px;
          font-weight: 900;
          color: #0891b2;
          line-height: 1;
        }
 
        .total-label {
          font-size: 12px;
          font-weight: 700;
          color: ${dm ? '#64748b' : '#94a3b8'};
          margin-top: 4px;
        }
 
        /* ===== CONTROLS BAR ===== */
        .controls-bar {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 24px;
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          position: relative;
          z-index: 10;
        }
 
        .search-wrap {
          flex: 1;
          min-width: 200px;
          position: relative;
        }
 
        .search-input {
          width: 100%;
          padding: 12px 20px 12px 44px;
          border-radius: 14px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)'};
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          backdrop-filter: blur(12px);
          box-sizing: border-box;
        }
 
        .search-input:focus {
          border-color: #0891b2;
          box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
        }
 
        .search-icon {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          color: ${dm ? '#475569' : '#94a3b8'};
          pointer-events: none;
        }
 
        /* ===== TYPE FILTERS ===== */
        .type-filters {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 28px;
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          position: relative;
          z-index: 10;
        }
 
        .type-filter-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 16px;
          border-radius: 50px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.85)'};
          color: ${dm ? '#94a3b8' : '#475569'};
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
        }
 
        .type-filter-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
 
        .type-filter-btn.active {
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
          transform: translateY(-1px);
        }
 
        .type-count {
          font-size: 11px;
          font-weight: 800;
          padding: 1px 7px;
          border-radius: 10px;
          background: rgba(255,255,255,0.25);
        }
 
        /* ===== PROJECTS GRID ===== */
        .projects-grid {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 100px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
 
        /* ===== PROJECT CARD ===== */
        .proj-card {
          border-radius: 22px;
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.88)' : 'rgba(255,255,255,0.92)'};
          backdrop-filter: blur(12px);
          overflow: hidden;
          transition: all 0.3s ease;
          animation: cardIn 0.5s ease both;
          position: relative;
        }
 
        .proj-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 48px rgba(0,0,0,0.12);
          border-color: rgba(8,145,178,0.35);
        }
 
        .proj-card-top {
          height: 6px;
          width: 100%;
        }
 
        .proj-card-body {
          padding: 20px;
        }
 
        .proj-card-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          margin-bottom: 16px;
        }
 
        .proj-type-icon {
          width: 48px; height: 48px;
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          flex-shrink: 0;
        }
 
        .proj-name {
          font-size: 16px;
          font-weight: 900;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 4px;
          line-height: 1.3;
        }
 
        .proj-type-label {
          font-size: 12px;
          font-weight: 700;
        }
 
        .proj-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 16px;
        }
 
        .proj-info-item {
          padding: 10px 12px;
          border-radius: 12px;
          background: ${dm ? 'rgba(51,65,85,0.4)' : '#f8fafc'};
        }
 
        .proj-info-lbl {
          font-size: 11px;
          color: ${dm ? '#64748b' : '#94a3b8'};
          font-weight: 600;
          margin-bottom: 3px;
        }
 
        .proj-info-val {
          font-size: 13px;
          font-weight: 800;
          color: ${dm ? '#e2e8f0' : '#0f172a'};
        }
 
        /* ===== AUTHOR ===== */
        .proj-author {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          padding-bottom: 14px;
          border-bottom: 1px solid ${dm ? 'rgba(51,65,85,0.5)' : '#f1f5f9'};
        }
 
        .author-dot {
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #0891b2;
          animation: pulse-dot 2s ease-in-out infinite;
          flex-shrink: 0;
        }
 
        .author-name {
          font-size: 13px;
          font-weight: 700;
          color: ${dm ? '#94a3b8' : '#64748b'};
        }
 
        .proj-date {
          font-size: 11px;
          color: ${dm ? '#475569' : '#94a3b8'};
          margin-right: 'auto';
        }
 
        /* ===== CARD FOOTER ===== */
        .proj-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }
 
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 800;
          padding: 5px 12px;
          border-radius: 20px;
        }
 
        .status-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
        }
 
        .file-link {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          color: #0891b2;
          text-decoration: none;
          padding: 5px 10px;
          border-radius: 8px;
          background: ${dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.08)'};
          transition: all 0.2s;
        }
        .file-link:hover { background: rgba(8,145,178,0.2); }
 
        .del-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 700;
          color: #dc2626;
          background: rgba(220,38,38,0.1);
          border: none;
          cursor: pointer;
          padding: 5px 12px;
          border-radius: 8px;
          font-family: 'Tajawal', sans-serif;
          transition: all 0.2s;
        }
        .del-btn:hover { background: rgba(220,38,38,0.18); transform: scale(1.04); }
 
        /* ===== SKELETON ===== */
        .skel {
          background: linear-gradient(90deg, ${dm ? '#1e293b' : '#f1f5f9'} 25%, ${dm ? '#334155' : '#e2e8f0'} 50%, ${dm ? '#1e293b' : '#f1f5f9'} 75%);
          background-size: 200% 100%;
          border-radius: 8px;
          animation: shimmer 1.5s infinite;
        }
 
        /* ===== EMPTY STATE ===== */
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 64px 24px;
          color: ${dm ? '#475569' : '#94a3b8'};
        }
 
        .empty-icon {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
          opacity: 0.6;
          animation: iconBounce 3s ease-in-out infinite;
        }
 
        /* ===== FAB ===== */
        .fab-proj {
          position: fixed;
          bottom: 32px;
          left: 32px;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 22px 0 0;
          height: 56px;
          border-radius: 28px;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: white;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          font-weight: 800;
          box-shadow: 0 6px 24px rgba(8,145,178,0.45);
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
 
        .fab-proj:hover {
          transform: translateY(-3px) scale(1.05);
          box-shadow: 0 10px 32px rgba(8,145,178,0.55);
        }
 
        .fab-circle {
          width: 56px; height: 56px;
          border-radius: 28px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.2);
          font-size: 20px;
          flex-shrink: 0;
        }
 
        /* ===== MODAL ===== */
        .modal-overlay {
          position: fixed; inset: 0; z-index: 100;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
        }
 
        .modal-backdrop {
          position: absolute; inset: 0;
          background: rgba(0,0,0,0.65);
          backdrop-filter: blur(8px);
        }
 
        .modal-box {
          position: relative;
          z-index: 101;
          width: 100%;
          max-width: 600px;
          max-height: 92vh;
          overflow-y: auto;
          border-radius: 26px;
          padding: 28px;
          background: ${dm ? 'rgba(13,20,33,0.98)' : 'rgba(255,255,255,0.99)'};
          border: 1px solid ${dm ? 'rgba(8,145,178,0.25)' : 'rgba(8,145,178,0.15)'};
          box-shadow: 0 24px 80px rgba(0,0,0,0.35);
          animation: scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }
 
        .modal-title {
          font-size: 20px;
          font-weight: 900;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 24px;
          padding-bottom: 16px;
          border-bottom: 1.5px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
          display: flex;
          align-items: center;
          gap: 10px;
        }
 
        .form-group { margin-bottom: 18px; }
 
        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 13px;
          color: ${dm ? '#94a3b8' : '#374151'};
        }
 
        .form-input {
          width: 100%;
          padding: 13px 16px;
          border-radius: 13px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(51,65,85,0.5)' : '#f8fafc'};
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .form-input::placeholder {
          color: ${dm ? '#475569' : '#94a3b8'};
        }

        .form-input:focus {
          border-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.08)' : '#fff'};
          box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
        }
 
        /* ===== TYPE SELECTOR ===== */
        .type-selector-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
        }
 
        .type-selector-btn {
          padding: 12px 10px;
          border-radius: 14px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.7)' : '#f8fafc'};
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: ${dm ? '#94a3b8' : '#475569'};
          transition: all 0.2s ease;
        }
 
        .type-selector-btn:hover { transform: translateY(-1px); }
 
        .type-selector-btn.selected {
          color: white;
          border-color: transparent;
          box-shadow: 0 4px 14px rgba(0,0,0,0.15);
        }
 
        /* ===== UPLOAD ===== */
        .upload-zone {
          border: 2px dashed ${dm ? '#334155' : '#cbd5e1'};
          border-radius: 14px;
          padding: 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.25s ease;
          color: ${dm ? '#64748b' : '#94a3b8'};
          font-weight: 600;
        }
        .upload-zone:hover {
          border-color: #0891b2;
          color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.05)' : 'rgba(8,145,178,0.04)'};
        }
 
        .file-selected {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-radius: 13px;
          background: ${dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)'};
          border: 1px solid rgba(8,145,178,0.2);
        }
 
        /* ===== GRID 2 ===== */
        .form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
 
        /* ===== SUBMIT ===== */
        .modal-submit {
          width: 100%;
          padding: 16px;
          border-radius: 14px;
          border: none;
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: white;
          font-family: 'Tajawal', sans-serif;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.25s ease;
          box-shadow: 0 4px 20px rgba(8,145,178,0.35);
          margin-top: 8px;
        }
        .modal-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(8,145,178,0.45); }
        .modal-submit:disabled { opacity: 0.6; cursor: not-allowed; }
 
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
 
        /* ===== CLOSE BTN ===== */
        .modal-close {
          position: absolute; top: 16px; left: 16px;
          width: 32px; height: 32px;
          border-radius: 50%;
          background: ${dm ? '#334155' : '#f1f5f9'};
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          color: ${dm ? '#94a3b8' : '#64748b'};
          font-size: 13px;
          transition: all 0.2s;
        }
        .modal-close:hover { background: #fee2e2; color: #dc2626; }
 
        @media (max-width: 640px) {
          .projects-grid { grid-template-columns: 1fr; padding: 0 16px 100px; }
          .form-grid-2   { grid-template-columns: 1fr; }
          .fab-proj      { bottom: 20px; left: 16px; }
          .type-selector-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
 
      <BackgroundAnimation isDarkMode={dm} />
 
      <Header
        onLoginClick={() => navigate('/')}
        onRegisterClick={() => navigate('/')}
        onSignOut={() => {}}
        isAdmin={isAdmin}
        isEmployee={isEmployee}
        user={user}
        isDarkMode={dm}
        onToggleDarkMode={() => setIsDarkMode(!dm)}
      />
 
      {/* Hero */}
      <div className="proj-hero">
        <div className="proj-hero-inner">
          <div className="proj-hero-text">
            <div className="proj-hero-icon">
              <i className="fas fa-folder-open" style={{ color: '#0891b2' }} />
            </div>
            <h1 className="proj-hero-title">المشاريع</h1>
            <p className="proj-hero-sub">استعرض المشاريع المتاحة أو أضف مشروعك الخاص</p>
          </div>
 
          <div className="total-badge">
            <div className="total-num">{projects.length}</div>
            <div className="total-label">إجمالي المشاريع</div>
          </div>
        </div>
      </div>
 
      {/* Controls */}
      <div className="controls-bar">
        <div className="search-wrap">
          <i className="fas fa-search search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="ابحث في المشاريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* فلتر المدينة — للأدمن والموظف فقط */}
        {isStaff && (
          <div style={{ position: 'relative', minWidth: 200 }}>
            <i className="fas fa-map-marker-alt" style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
              color: dm ? '#475569' : '#94a3b8', pointerEvents: 'none', zIndex: 1,
            }} />
            <input
              type="text"
              className="search-input"
              style={{ paddingRight: 40, paddingLeft: cityFilter ? 36 : 16 }}
              placeholder="فلتر بالمدينة..."
              value={cityInput}
              onChange={e => {
                setCityInput(e.target.value);
                setCityFilter(e.target.value);
                setShowCitySuggestions(true);
              }}
              onFocus={() => setShowCitySuggestions(true)}
              onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
            />
            {cityFilter && (
              <button onClick={() => { setCityFilter(''); setCityInput(''); }} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: dm ? '#64748b' : '#94a3b8', fontSize: 13, padding: 2,
              }}>✕</button>
            )}
            {showCitySuggestions && cityInput && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 100,
                background: dm ? '#1e293b' : '#fff',
                border: `1.5px solid ${dm ? '#334155' : '#e2e8f0'}`,
                borderRadius: 12, marginTop: 4,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                maxHeight: 200, overflowY: 'auto',
              }}>
                {SAUDI_CITIES.filter(c => c.includes(cityInput)).slice(0, 8).map(city => (
                  <button key={city} onMouseDown={() => { setCityFilter(city); setCityInput(city); setShowCitySuggestions(false); }}
                    style={{
                      display: 'block', width: '100%', textAlign: 'right',
                      padding: '10px 14px', border: 'none', background: 'none',
                      fontFamily: "'Tajawal', sans-serif", fontSize: 13, fontWeight: 600,
                      color: dm ? '#e2e8f0' : '#374151', cursor: 'pointer',
                      borderBottom: `1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f1f5f9'}`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <i className="fas fa-map-marker-alt" style={{ color: '#0891b2', marginLeft: 8, fontSize: 11 }} />
                    {city}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
 
      {/* Type Filters */}
      <div className="type-filters">
        <button
          className={`type-filter-btn ${selectedType === 'all' ? 'active' : ''}`}
          style={selectedType === 'all' ? { background: 'linear-gradient(135deg,#0891b2,#06b6d4)' } : {}}
          onClick={() => setSelectedType('all')}
        >
          🗂 الكل
          <span className="type-count" style={selectedType !== 'all' ? { background: 'rgba(8,145,178,0.15)', color: '#0891b2' } : {}}>
            {projects.length}
          </span>
        </button>
        {PROJECT_TYPES.map(t => (
          <button
            key={t.id}
            className={`type-filter-btn ${selectedType === t.id ? 'active' : ''}`}
            style={selectedType === t.id ? { background: `linear-gradient(135deg,${t.color}dd,${t.color})` } : {}}
            onClick={() => setSelectedType(t.id)}
          >
            {t.emoji} {t.label}
            {projectCounts[t.id] > 0 && (
              <span className="type-count" style={selectedType !== t.id ? { background: `${t.color}20`, color: t.color } : {}}>
                {projectCounts[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>
 
      {/* Grid */}
      <div className="projects-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 22, overflow: 'hidden', background: dm ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.7)', animationDelay: `${i * 0.07}s` }}>
              <div className="skel" style={{ height: 6 }} />
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                  <div className="skel" style={{ width: 48, height: 48, borderRadius: 14 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skel" style={{ height: 15, width: '65%', marginBottom: 8 }} />
                    <div className="skel" style={{ height: 12, width: '40%' }} />
                  </div>
                </div>
                <div className="skel" style={{ height: 70, marginBottom: 14 }} />
                <div className="skel" style={{ height: 14, width: '50%' }} />
              </div>
            </div>
          ))
        ) : filteredProjects.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">📂</span>
            <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 8px' }}>
              {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد مشاريع بعد'}
            </p>
            <p style={{ fontSize: 14, margin: '0 0 20px' }}>
              {searchQuery ? 'جرب كلمات بحث مختلفة' : 'كن أول من يضيف مشروعاً'}
            </p>
            {!searchQuery && !profileLoading && user && !isStaff && (
              <button
                onClick={() => setShowForm(true)}
                style={{ padding: '12px 24px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#0891b2,#06b6d4)', color: 'white', fontFamily: 'Tajawal', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}
              >
                <i className="fas fa-plus" style={{ marginLeft: 8 }} />
                أضف مشروعك الأول
              </button>
            )}
          </div>
        ) : (
          filteredProjects.map((project, index) => {
            const typeInfo = getTypeInfo(project.project_type);
            const statusInfo = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending;
            const isOwn = !isStaff && user?.id === project.user_id;
            return (
              <div key={project.id} className="proj-card" style={{
                animationDelay: `${index * 0.06}s`,
                ...(isOwn ? {
                  border: `1.5px solid ${dm ? 'rgba(8,145,178,0.5)' : 'rgba(8,145,178,0.35)'}`,
                  boxShadow: dm ? '0 0 0 1px rgba(8,145,178,0.15), 0 4px 20px rgba(8,145,178,0.12)' : '0 0 0 1px rgba(8,145,178,0.1), 0 4px 20px rgba(8,145,178,0.08)',
                } : {}),
              }}>
                {/* بادج الاعتماد — يظهر فوق البطاقة كاملاً */}
                {project.status === 'approved' && project.accreditation_body && (
                  <div style={{
                    position: 'relative', overflow: 'hidden',
                    background: 'linear-gradient(135deg, #064e3b 0%, #065f46 40%, #047857 100%)',
                    padding: '10px 16px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    {/* تأثير لمعة متحركة */}
                    <div style={{
                      position: 'absolute', top: 0, left: '-100%', width: '60%', height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                      animation: 'accred-shine 3s ease-in-out infinite',
                    }} />
                    {/* أيقونة الختم */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(255,255,255,0.15)',
                      border: '1.5px solid rgba(255,255,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 0 10px rgba(16,185,129,0.5)',
                    }}>
                      <i className="fas fa-shield-alt" style={{ color: '#6ee7b7', fontSize: 14 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(167,243,208,0.8)', letterSpacing: '0.08em', marginBottom: 2 }}>مشروع معتمد رسمياً</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {project.accreditation_body}
                      </div>
                    </div>
                    <div style={{
                      flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.6)',
                    }}>
                      <i className="fas fa-check" style={{ color: '#fff', fontSize: 11 }} />
                    </div>
                  </div>
                )}
                <div className="proj-card-top" style={{ background: `linear-gradient(90deg, ${typeInfo.color}, ${typeInfo.color}88)` }} />
                {/* شارة "مشروعي" للعميل */}
                {isOwn && (
                  <div style={{
                    position: 'absolute', top: 14, left: 12, zIndex: 2,
                    background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
                    color: '#fff', fontSize: 10, fontWeight: 800,
                    padding: '3px 10px', borderRadius: 20,
                    boxShadow: '0 2px 8px rgba(8,145,178,0.4)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <i className="fas fa-user" style={{ fontSize: 9 }} />
                    مشروعي
                  </div>
                )}
                <div className="proj-card-body">
                  {/* Header */}
                  <div className="proj-card-header">
                    <div className="proj-type-icon" style={{ background: dm ? typeInfo.dark : typeInfo.light }}>
                      {typeInfo.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="proj-name">{project.project_name}</p>
                      <span className="proj-type-label" style={{ color: typeInfo.color }}>{typeInfo.label}</span>
                    </div>
                  </div>
 
                  {/* Author */}
                  {(project.user?.association_name || (user?.id === project.user_id && currentUserAssociation)) && (
                    <div className="proj-author">
                      <div className="author-dot" />
                      <span className="author-name">
                        {project.user?.association_name || currentUserAssociation}
                      </span>
                      <span className="proj-date" style={{ marginRight: 'auto' }}>
                        {new Date(project.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  )}
 
                  {/* Info grid */}
                  {(project.duration || project.budget || project.target_area) && (
                    <div className="proj-info-grid">
                      {project.duration && (
                        <div className="proj-info-item">
                          <div className="proj-info-lbl">⏱ مدة التنفيذ</div>
                          <div className="proj-info-val">{project.duration}</div>
                        </div>
                      )}
                      {/* الميزانية: تظهر فقط للأدمن والموظف وصاحب المشروع */}
                      {project.budget && (isStaff || user?.id === project.user_id) && (
                        <div className="proj-info-item">
                          <div className="proj-info-lbl">💰 الميزانية</div>
                          <div className="proj-info-val">
                            {Number(project.budget.replace(/[^\d]/g, '') || project.budget).toLocaleString('ar-SA')} ر.س
                          </div>
                        </div>
                      )}
                      {project.target_area && (
                        <div className="proj-info-item" style={{ gridColumn: project.duration && (project.budget && (isStaff || user?.id === project.user_id)) ? '1/-1' : 'auto' }}>
                          <div className="proj-info-lbl">📍 المنطقة</div>
                          <div className="proj-info-val">{project.target_area}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="proj-card-footer">
                    <span className="status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
                      <span className="status-dot" style={{ background: statusInfo.dot }} />
                      {statusInfo.label}
                    </span>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* ملف PDF: يظهر فقط للأدمن والموظف وصاحب المشروع */}
                      {project.project_file_url && (isStaff || user?.id === project.user_id) && (
                        <a href={project.project_file_url} target="_blank" rel="noopener noreferrer" className="file-link">
                          <i className="fas fa-file-download" />
                          ملف
                        </a>
                      )}
                      {/* زر الاعتماد: للأدمن فقط على المشاريع غير المعتمدة */}
                      {isAdmin && project.status !== 'approved' && (
                        <button
                          onClick={() => { setApproveModal({ open: true, projectId: project.id, projectName: project.project_name }); setAccreditationBody(''); }}
                          style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#15803d', background: 'rgba(22,163,74,0.12)', border: 'none', cursor: 'pointer', padding: '5px 12px', borderRadius: 8, fontFamily: "'Tajawal', sans-serif", transition: 'all 0.2s' }}
                          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,163,74,0.22)'}
                          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(22,163,74,0.12)'}
                        >
                          <i className="fas fa-check-circle" />
                          اعتماد
                        </button>
                      )}
                      {/* زر الحذف: للأدمن فقط */}
                      {isAdmin && (
                        <button className="del-btn" onClick={() => handleDelete(project.id)}>
                          <i className="fas fa-trash-alt" />
                          حذف
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
 
      {/* Admin Queue Button */}
      {isStaff && (
        <button
          onClick={() => setShowAdminQueue(true)}
          title="مراجعة المشاريع"
          style={{
            position: 'fixed', bottom: 32, left: 32, zIndex: 50,
            width: 62, height: 62, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            color: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 6px 28px rgba(124,58,237,0.5)',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12) translateY(-3px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1) translateY(0)'; }}
        >
          ☰
        </button>
      )}
 
      {/* Admin Queue Modal */}
      {showAdminQueue && (
        <AdminReviewQueue mode="project" onClose={() => setShowAdminQueue(false)} />
      )}
 
      {/* FAB — any logged-in non-staff user */}
      {!profileLoading && user && !isStaff && (
        <button
          onClick={() => setShowForm(true)}
          title="تقديم مشروع جديد"
          style={{
            position: 'fixed', bottom: 32, left: 32, zIndex: 50,
            width: 62, height: 62, borderRadius: '50%',
            background: 'linear-gradient(135deg,#0891b2,#06b6d4)',
            color: 'white', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26,
            boxShadow: '0 6px 28px rgba(8,145,178,0.55)',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12) translateY(-3px)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1) translateY(0)';
          }}
        >
          ✦
        </button>
      )}
 
      {/* Add Project Modal */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={() => setShowForm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }} />
          <div style={{ position: "relative", zIndex: 1001, width: "100%", maxWidth: 600, maxHeight: "92vh", overflowY: "auto", borderRadius: 26, padding: 28, background: dm ? "rgba(13,20,33,0.98)" : "#fff", border: "1px solid rgba(8,145,178,0.15)", boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
            <button onClick={() => setShowForm(false)} style={{ position: "absolute", top: 16, left: 16, width: 36, height: 36, borderRadius: "50%", background: "#fee2e2", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626", fontSize: 18, fontWeight: 700, lineHeight: 1, fontFamily: "Arial, sans-serif" }}>
              &times;
            </button>

 
            <h2 className="modal-title">
              <i className="fas fa-folder-plus" style={{ color: '#0891b2', fontSize: 22 }} />
              إضافة مشروع جديد
            </h2>
 
            <form onSubmit={handleSubmit}>
              {/* Project Name */}
              <div className="form-group">
                <label className="form-label">اسم المشروع <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => setFormData({ ...formData, project_name: e.target.value })}
                  required
                  className="form-input"
                  placeholder="أدخل اسم المشروع"
                />
              </div>
 
              {/* Project Type */}
              <div className="form-group">
                <label className="form-label">نوع المشروع <span style={{ color: '#ef4444' }}>*</span></label>
                <div className="type-selector-grid">
                  {PROJECT_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, project_type: type.id })}
                      className={`type-selector-btn ${formData.project_type === type.id ? 'selected' : ''}`}
                      style={formData.project_type === type.id ? { background: `linear-gradient(135deg,${type.color}dd,${type.color})`, borderColor: 'transparent' } : {}}
                    >
                      <span style={{ fontSize: 18 }}>{type.emoji}</span>
                      <span style={{ fontSize: 12 }}>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
 
              {/* Duration & Budget */}
              <div className="form-grid-2">
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">مدة التنفيذ</label>
                  <input
                    type="text"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    className="form-input"
                    placeholder="مثال: 3 أشهر"
                    maxLength={50}
                  />
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    {['شهر', '3 أشهر', '6 أشهر', 'سنة', 'أكثر من سنة'].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setFormData({ ...formData, duration: d })}
                        style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          border: `1px solid ${formData.duration === d ? '#0891b2' : 'rgba(8,145,178,0.2)'}`,
                          background: formData.duration === d ? 'rgba(8,145,178,0.1)' : 'transparent',
                          color: formData.duration === d ? '#0891b2' : '#64748b',
                          cursor: 'pointer', fontFamily: "'Tajawal', sans-serif",
                          transition: 'all 0.2s'
                        }}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">الميزانية (ريال سعودي)</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        // نستخدم "inputMode" لمساعدة مستخدمي الجوال، و "type="text" للسماح بالفواصل
                        inputMode="numeric"
                        // تأكد أن formatBudget لا تسبب تعليق للكود، جرب استبدالها بـ .toLocaleString() مؤقتاً للتأكد
                        value={formData.budget ? Number(formData.budget).toLocaleString('en-US') : ''}
                        onChange={(e) => {
                          // 1. استخراج الأرقام فقط (حذف الفواصل والنقاط وأي حرف غير رقمي)
                          const rawValue = e.target.value.replace(/\D/g, '');
                          
                          // 2. تحديث الحالة بالقيمة الصافية كـ string من الأرقام
                          setFormData({ ...formData, budget: rawValue });
                        }}
                        className="form-input"
                        placeholder="مثال: 50,000"
                        style={{ paddingLeft: 52 }}
                      />
                      <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 12, fontWeight: 700, color: '#64748b', pointerEvents: 'none'
                      }}>
                        ر.س
                      </span>
                    </div>
                    {formData.budget && (
                      <p style={{ fontSize: 11, color: '#0891b2', margin: '4px 0 0', fontWeight: 600 }}>
                        {/* العرض باللغة العربية أسفل الحقل */}
                        {Number(formData.budget).toLocaleString('ar-SA')} ريال سعودي
                      </p>
                    )}
                </div>
              </div>
 
              {/* Target Area */}
              <div className="form-group" style={{ marginTop: 14 }}>
                <label className="form-label">المنطقة / المدينة المستهدفة</label>
                <div style={{ position: 'relative' }}>
                  <i className="fas fa-map-marker-alt" style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    color: '#0891b2', pointerEvents: 'none', fontSize: 13,
                  }} />
                  <input
                    type="text"
                    value={targetAreaInput}
                    onChange={e => {
                      setTargetAreaInput(e.target.value);
                      setFormData({ ...formData, target_area: e.target.value });
                      setShowAreaSuggestions(true);
                    }}
                    onFocus={() => setShowAreaSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowAreaSuggestions(false), 150)}
                    className="form-input"
                    placeholder="اكتب اسم المدينة أو اختر..."
                    style={{ paddingRight: 40 }}
                  />
                  {showAreaSuggestions && targetAreaInput && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 200,
                      background: dm ? '#1e293b' : '#fff',
                      border: `1.5px solid ${dm ? '#334155' : '#e2e8f0'}`,
                      borderRadius: 12, marginTop: 4,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                      maxHeight: 220, overflowY: 'auto',
                    }}>
                      {SAUDI_CITIES.filter(c => c.includes(targetAreaInput)).slice(0, 10).map(city => (
                        <button key={city} type="button"
                          onMouseDown={() => {
                            setTargetAreaInput(city);
                            setFormData({ ...formData, target_area: city });
                            setShowAreaSuggestions(false);
                          }}
                          style={{
                            display: 'block', width: '100%', textAlign: 'right',
                            padding: '10px 14px', border: 'none', background: 'none',
                            fontFamily: "'Tajawal', sans-serif", fontSize: 13, fontWeight: 600,
                            color: dm ? '#e2e8f0' : '#374151', cursor: 'pointer',
                            borderBottom: `1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f1f5f9'}`,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <i className="fas fa-map-marker-alt" style={{ color: '#0891b2', marginLeft: 8, fontSize: 11 }} />
                          {city}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
 
              {/* File Upload */}
              <div className="form-group">
                <label className="form-label">ملف المشروع <span style={{color:'#ef4444'}}>*</span></label>
                <input ref={fileInputRef} type="file" onChange={(e) => setProjectFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
 
                {!projectFile ? (
                  <div className="upload-zone" onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-cloud-upload-alt" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                    اضغط لرفع ملف المشروع
                    <br />
                    <span style={{ fontSize: 12, opacity: 0.7, marginTop: 4, display: 'block' }}>PDF، Word، Excel وغيرها</span>
                  </div>
                ) : (
                  <div className="file-selected">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <i className="fas fa-file" style={{ color: '#0891b2', fontSize: 20 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: dm ? '#f1f5f9' : '#0f172a', wordBreak: 'break-all' }}>
                        {projectFile.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setProjectFile(null)}
                      style={{ background: 'none', border: 'none', color: '#0e88f2', cursor: 'pointer', fontSize: 16, padding: 4 }}
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>
 
              <button type="submit" disabled={isSubmitting} className="modal-submit">
                {isSubmitting ? (
                  <><span className="btn-spinner" /> جاري الإضافة...</>
                ) : (
                  <><i className="fas fa-plus" /> إضافة المشروع</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Approve Modal */}
      {approveModal.open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={() => setApproveModal({ open: false, projectId: '', projectName: '' })} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }} />
          <div style={{ position: 'relative', zIndex: 201, width: '100%', maxWidth: 440, borderRadius: 24, padding: 28, background: dm ? 'rgba(13,20,33,0.98)' : '#fff', border: '1px solid rgba(22,163,74,0.25)', boxShadow: '0 24px 80px rgba(0,0,0,0.35)' }}>
            <button onClick={() => setApproveModal({ open: false, projectId: '', projectName: '' })} style={{ position: 'absolute', top: 14, left: 14, width: 32, height: 32, borderRadius: '50%', background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>
              &times;
            </button>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <h3 style={{ margin: '0 0 6px', fontWeight: 900, fontSize: 18, color: dm ? '#f1f5f9' : '#0f172a', fontFamily: "'Tajawal', sans-serif" }}>اعتماد المشروع</h3>
              <p style={{ margin: 0, fontSize: 13, color: dm ? '#94a3b8' : '#64748b', fontFamily: "'Tajawal', sans-serif" }}>{approveModal.projectName}</p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: dm ? '#cbd5e1' : '#374151', marginBottom: 8, fontFamily: "'Tajawal', sans-serif" }}>
                اسم جهة الاعتماد <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={accreditationBody}
                onChange={e => setAccreditationBody(e.target.value)}
                placeholder="مثال: وزارة الموارد البشرية"
                autoFocus
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: `1.5px solid ${dm ? '#334155' : '#e2e8f0'}`, background: dm ? 'rgba(30,41,59,0.9)' : '#f8fafc', color: dm ? '#f1f5f9' : '#0f172a', fontFamily: "'Tajawal', sans-serif", fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                onFocus={e => e.target.style.borderColor = '#16a34a'}
                onBlur={e => e.target.style.borderColor = dm ? '#334155' : '#e2e8f0'}
                onKeyDown={e => e.key === 'Enter' && handleApprove()}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setApproveModal({ open: false, projectId: '', projectName: '' })} style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1.5px solid ${dm ? '#334155' : '#e2e8f0'}`, background: 'transparent', color: dm ? '#94a3b8' : '#64748b', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                إلغاء
              </button>
              <button onClick={handleApprove} disabled={isApproving} style={{ flex: 2, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#16a34a,#22c55e)', color: 'white', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 800, cursor: isApproving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: isApproving ? 0.7 : 1 }}>
                {isApproving ? <><span className="btn-spinner" /> جاري الاعتماد...</> : <><i className="fas fa-check-circle" /> تأكيد الاعتماد</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}