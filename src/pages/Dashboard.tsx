// pages/Dashboard.tsx
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useTransition } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';

/* ── Rate Limiters ── */
const createRateLimiter = (max: number, windowMs: number, label = '') => {
  const reqs: number[] = []; let blocked = 0;
  return { canProceed: (): boolean => {
    const now = Date.now();
    if (now < blocked) return false;
    while (reqs.length && reqs[0] < now - windowMs) reqs.shift();
    if (reqs.length >= max) { blocked = now + Math.min(windowMs * (reqs.length - max + 1), 300000); if (label) console.warn('[RateLimit]', label); return false; }
    reqs.push(now); return true;
  }};
};
const apiRateLimiter    = createRateLimiter(15, 60000, 'dashboard-api');
const submitRateLimiter = createRateLimiter(5,  60000, 'dashboard-submit');
import AOS from 'aos';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import RequestsTable from '../components/RequestsTable';
import {
  notifyAdminNewServiceRequest,
  notifyAssignment,
  notifyStatusChange,
  notifyRequestRejected,
} from '../lib/notificationHelpers';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'employee' | 'client' | null;
type DateFilter = 'all' | 'today' | 'week' | 'month';

interface ServiceRequest {
  request_id: string;
  user_id?: string;
  service_id?: string;
  request_status: string;
  assigned_to?: string;
  employee_id?: string;
  admin_notes?: string;
  request_notes?: string;
  contract_url?: string;
  package_type?: string;
  created_at: string;
  updated_at?: string;
  terms_accepted?: boolean;
  terms_version?: string;
  accepted_at?: string;
  user?: { association_name: string; user_email: string; user_phone?: string };
  services?: { service_name: string; service_description?: string };
  employees?: { employee_name: string; employee_phone?: string };
}

interface Employee {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_phone?: string;
  employee_role: string;
  is_active: boolean;
}

interface CurrentUser {
  id: string;
  email: string;
  name: string;
}



// ─── Constants — الحالات الأربع الرسمية ─────────────────────────────────────
const STATUS_MAP: Record<string, { text: string; icon: string; colors: string; dot: string }> = {
  pending_review: { text: 'قيد المراجعة',  icon: 'fa-hourglass-half',  colors: 'bg-amber-50 text-amber-700 border border-amber-300',   dot: 'bg-amber-400'   },
  in_progress:    { text: 'قيد التنفيذ',   icon: 'fa-cogs',            colors: 'bg-sky-50 text-sky-700 border border-sky-300',         dot: 'bg-sky-400'     },
  completed:      { text: 'مكتمل',          icon: 'fa-flag-checkered',  colors: 'bg-emerald-50 text-emerald-700 border border-emerald-300', dot: 'bg-emerald-500' },
  cancelled:      { text: 'ملغى',           icon: 'fa-ban',             colors: 'bg-red-50 text-red-600 border border-red-300',         dot: 'bg-red-400'     },
  // توافق مع البيانات القديمة
  approved:       { text: 'قيد التنفيذ',   icon: 'fa-cogs',            colors: 'bg-sky-50 text-sky-700 border border-sky-300',         dot: 'bg-sky-400'     },
  rejected:       { text: 'ملغى',           icon: 'fa-ban',             colors: 'bg-red-50 text-red-600 border border-red-300',         dot: 'bg-red-400'     },
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────
function isToday(dateStr: string) {
  const d = new Date(dateStr), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
function isThisWeek(dateStr: string) {
  const d = new Date(dateStr), now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  return d >= startOfWeek;
}
function isThisMonth(dateStr: string) {
  const d = new Date(dateStr), now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function applyDateFilter(dateStr: string, filter: DateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'today') return isToday(dateStr);
  if (filter === 'week') return isThisWeek(dateStr);
  if (filter === 'month') return isThisMonth(dateStr);
  return true;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface Toast { id: number; msg: string; type: 'success' | 'error' | 'info' }

function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[2000] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
    </div>
  );
}
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  useEffect(() => { const t = setTimeout(() => onRemove(toast.id), 4500); return () => clearTimeout(t); }, [toast.id, onRemove]);
  const color = toast.type === 'success' ? 'border-emerald-500' : toast.type === 'error' ? 'border-red-500' : 'border-cyan-500';
  const icon  = toast.type === 'success' ? 'fa-check-circle text-emerald-500' : toast.type === 'error' ? 'fa-exclamation-circle text-red-500' : 'fa-info-circle text-cyan-500';
  return (
    <div className={`flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg min-w-[260px] border-r-4 ${color} pointer-events-auto`}>
      <i className={`fas ${icon}`} />
      <span className="text-slate-700 font-semibold text-sm">{toast.msg}</span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.pending_review;
  return (
    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${s.colors}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} flex-shrink-0`} />
      <i className={`fas ${s.icon} text-[10px]`} />
      {s.text}
    </span>
  );
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
  label, active, count, onClick, accent = 'cyan',
}: { label: string; active: boolean; count?: number; onClick: () => void; accent?: string }) {
  const accentMap: Record<string, { on: string; off: string; badge: string }> = {
    cyan:    { on: 'bg-cyan-600 text-white border-cyan-600 shadow shadow-cyan-200',      off: 'bg-white text-slate-500 border-slate-200 hover:border-cyan-300 hover:text-cyan-700',    badge: 'bg-white/25 text-white' },
    amber:   { on: 'bg-amber-500 text-white border-amber-500 shadow shadow-amber-200',   off: 'bg-white text-slate-500 border-slate-200 hover:border-amber-300 hover:text-amber-600',  badge: 'bg-white/25 text-white' },
    violet:  { on: 'bg-violet-600 text-white border-violet-600 shadow shadow-violet-200',off: 'bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:text-violet-600',badge: 'bg-white/25 text-white' },
    sky:     { on: 'bg-sky-600 text-white border-sky-600 shadow shadow-sky-200',         off: 'bg-white text-slate-500 border-slate-200 hover:border-sky-300 hover:text-sky-600',      badge: 'bg-white/25 text-white' },
    emerald: { on: 'bg-emerald-600 text-white border-emerald-600 shadow shadow-emerald-200',off:'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-600',badge:'bg-white/25 text-white'},
    red:     { on: 'bg-red-500 text-white border-red-500 shadow shadow-red-200',         off: 'bg-white text-slate-500 border-slate-200 hover:border-red-300 hover:text-red-500',      badge: 'bg-white/25 text-white' },
    slate:   { on: 'bg-slate-700 text-white border-slate-700 shadow',                    off: 'bg-white text-slate-500 border-slate-200 hover:border-slate-400 hover:text-slate-700',  badge: 'bg-white/25 text-white' },
  };
  const c = accentMap[accent] || accentMap.cyan;
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold border transition-all duration-150 ${active ? c.on : c.off}`}>
      {label}
      {count !== undefined && (
        <span className={`text-[11px] font-extrabold px-1.5 py-0.5 rounded-full ${active ? c.badge : 'bg-slate-100 text-slate-500'}`}>{count}</span>
      )}
    </button>
  );
}

// ─── Date Segment ─────────────────────────────────────────────────────────────
function DateSegment({ value, onChange }: { value: DateFilter; onChange: (v: DateFilter) => void }) {
  const opts: { v: DateFilter; label: string }[] = [
    { v: 'all',   label: 'الكل'      },
    { v: 'today', label: 'اليوم'     },
    { v: 'week',  label: 'الأسبوع'  },
    { v: 'month', label: 'الشهر'    },
  ];
  return (
    <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-0.5">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all duration-150
            ${value === o.v ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Contract Upload Cell ─────────────────────────────────────────────────────
function ContractCell({ requestId, contractUrl, onView, onUploaded, showToast }:
  { requestId: string; contractUrl?: string; onView: (url: string) => void; onUploaded: () => void; showToast: (msg: string, type?: 'success'|'error'|'info') => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('الملف أكبر من 10MB', 'error'); return; }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `contracts/${requestId}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('contracts').upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
      const { error: updateErr } = await supabase.from('service_requests')
        .update({ contract_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('request_id', requestId);
      if (updateErr) throw updateErr;
      showToast('تم رفع العقد بنجاح ✓');
      onUploaded();
    } catch (err: any) { showToast('خطأ في رفع الملف: ' + (err.message || ''), 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={handleUpload} />
      {contractUrl ? (
        <div className="flex flex-col gap-1 w-full">
          <button onClick={() => onView(contractUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-200">
            <i className="fas fa-eye" /> عرض
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 text-slate-500 hover:bg-slate-200 transition-all border border-slate-200">
            <i className="fas fa-arrow-up-from-bracket text-[10px]" /> استبدال
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-dashed transition-all
            ${uploading ? 'border-cyan-300 text-cyan-400 cursor-wait' : 'border-slate-200 text-slate-400 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50'}`}>
          {uploading ? <><i className="fas fa-spinner fa-spin" /> جاري الرفع...</> : <><i className="fas fa-file-arrow-up" /> رفع الملف</>}
        </button>
      )}
    </div>
  );
}

// ─── Table Components ─────────────────────────────────────────────────────────
function TableWrapper({ children, isDarkMode }: { children: React.ReactNode; isDarkMode: boolean }) {
  return (
    <div className={`rounded-2xl overflow-hidden shadow-sm border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
      <div className="overflow-x-auto -mx-0">
       <table className="w-full border-collapse min-w-[600px]">{children}</table>
      </div>
    </div>
  );
}
function THead({ cols, isDarkMode }: { cols: string[]; isDarkMode?: boolean }) {
  return (
    <thead>
      <tr className={isDarkMode ? 'bg-slate-700/80' : 'bg-gradient-to-l from-slate-700 to-slate-600'}>
        {cols.map((h, i) => (
          <th key={h} className={`px-5 py-3.5 text-right text-xs font-bold text-white/90 whitespace-nowrap tracking-wide uppercase
            ${i === 0 ? 'rounded-tr-2xl' : ''} ${i === cols.length - 1 ? 'rounded-tl-2xl' : ''}`}>
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}
function EmptyState({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-20 text-slate-300">
        <i className="fas fa-inbox text-5xl block mb-3 opacity-30" />
        <span className="text-sm font-semibold text-slate-400">لا توجد بيانات</span>
      </td>
    </tr>
  );
}
function LoadingState({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-center py-20">
        <i className="fas fa-spinner fa-spin text-4xl text-cyan-400 block mb-3" />
        <span className="text-sm text-slate-400">جاري التحميل...</span>
      </td>
    </tr>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, count, color = 'text-cyan-600', isDarkMode = false }: { icon: string; title: string; count?: number; color?: string; isDarkMode?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <i className={`fas ${icon} ${color} text-lg`} />
      <h2 className={`text-lg font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{title}</h2>
      {count !== undefined && <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>{count}</span>}
    </div>
  );
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ label, val, icon, bg, color, isDarkMode }: { label: string; val: number; icon: string; bg: string; color: string; isDarkMode: boolean }) {
  return (
    <div className={`rounded-2xl p-4 border flex items-center gap-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default
      ${isDarkMode ? 'bg-slate-800/80 border-slate-700/80 hover:border-slate-600' : 'bg-white border-slate-100 shadow-sm hover:shadow-slate-200/80'}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg flex-shrink-0 shadow-sm ${bg} ${color}`}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-black tabular-nums leading-none ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{val}</div>
        <div className={`text-[11px] mt-1 font-medium truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</div>
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────
function FilterBar({ isDarkMode, children }: { isDarkMode: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex gap-3 flex-wrap items-center rounded-2xl px-5 py-4 border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
      {children}
    </div>
  );
}

// ─── Table Row Bg ─────────────────────────────────────────────────────────────
const rowCls = (idx: number, isDarkMode: boolean) =>
  `transition-colors border-b ${isDarkMode ? 'hover:bg-slate-700/50 border-slate-700' : 'hover:bg-slate-50/80 border-slate-100'}` +
  (idx % 2 !== 0 ? (isDarkMode ? ' bg-slate-800/20' : ' bg-slate-50/40') : '');

// ════════════════════════════════════════════════════════════════════════════
// ─── MAIN DASHBOARD ─────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export default function Dashboard() {
  // ... كل الـ Hooks (useState, useEffect) تكون هنا في البداية
  // ── Loading Screen ── (تأكد أنها داخل الدالة)
  
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee, isClient, loading: authLoading, profileLoading } = useAuth();

  const [, startTransition] = useTransition();
  const { isDarkMode: dm } = useDarkMode();
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTab, setActiveTab] = useState('');
  // أضف هذا في أي صفحة تحتاج تعرف الوضع:



  // ── Data State ─────────────────────────────────────────────────────────
  const [clientRequests, setClientRequests] = useState<ServiceRequest[]>([]);
  const [empRequests, setEmpRequests] = useState<ServiceRequest[]>([]);
  const [adminRequests, setAdminRequests] = useState<ServiceRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adminStats, setAdminStats] = useState({ pending: 0, in_progress: 0, completed: 0, total: 0, trends: { pending: 0, in_progress: 0, completed: 0 } });
  const [assignedRequests, setAssignedRequests] = useState<ServiceRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Filter States ──────────────────────────────────────────────────────
  const [clientStatusFilter, setClientStatusFilter] = useState('all');
  const [clientDateFilter, setClientDateFilter] = useState<DateFilter>('all');
  const [empStatusFilter, setEmpStatusFilter] = useState('all');
  const [empDateFilter, setEmpDateFilter] = useState<DateFilter>('all');
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');
  const [adminDateFilter, setAdminDateFilter] = useState<DateFilter>('all');
  const [assignedStatusFilter, setAssignedStatusFilter] = useState('all');
  const [assignedDateFilter, setAssignedDateFilter] = useState<DateFilter>('all');

  // ── Modal State ────────────────────────────────────────────────────────
  const [modals, setModals] = useState({ reject: false, assign: false, updateStatus: false, empNote: false, pdf: false, addEmp: false, newRequest: false, news: false });

  // Prevent body scroll & header shake when any modal is open
  useEffect(() => {
    const anyOpen = Object.values(modals).some(Boolean);
    if (anyOpen) {
      document.documentElement.style.setProperty('--scrollbar-w', `${window.innerWidth - document.documentElement.clientWidth}px`);
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [modals]);
  const [currentReqId, setCurrentReqId] = useState('');
  const [rejectNotes, setRejectNotes] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [activeEmployees, setActiveEmployees] = useState<Employee[]>([]);
  const [newStatus, setNewStatus] = useState('in_progress');
  const [empNote, setEmpNote] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [empForm, setEmpForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [empFormLoading, setEmpFormLoading] = useState(false);
  const [requestForm, setRequestForm] = useState({ serviceName: '', serviceDesc: '', notes: '' });
  const [requestFormLoading, setRequestFormLoading] = useState(false);
  const [newsForm, setNewsForm] = useState({ title: '', excerpt: '', image: '', category: 'عام', date: new Date().toISOString().split('T')[0], tweet: '', author: '', device_info: '', city_info: '' });
  const [newsFormLoading, setNewsFormLoading] = useState(false);
  const [newsImageUploading, setNewsImageUploading] = useState(false);
  const newsImageRef = useRef<HTMLInputElement>(null);
  const [loadingStates, setLoadingStates] = useState({ client: false, emp: false, admin: false, employees: false });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);
  const realtimeChannel = useRef<any>(null);

  // ── Toast ─────────────────────────────────────────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = ++toastId.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  }, []);
  const removeToast = useCallback((id: number) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  // ── AOS Refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    AOS.refresh();
  }, [loading, activeTab]);

  // ── Data Loaders ───────────────────────────────────────────────────────
  const loadClientRequests = useCallback(async (userId: string) => {
    setLoadingStates(s => ({ ...s, client: true }));
    try {
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          request_id, 
          service_id, 
          request_status, 
          created_at, 
          admin_notes, 
          assigned_to,
          contract_url,
          service:service_id(service_name, service_description), 
          employee:assigned_to(employee_name, employee_phone)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setClientRequests((data as any) || []);
    } catch (err) {
      console.error("Client Load Error:", err);
      showToast('خطأ في تحميل الطلبات', 'error');
    } finally {
      setLoadingStates(s => ({ ...s, client: false }));
    }
  }, [showToast]);

  const loadEmpRequests = useCallback(async (userId: string) => {
    setLoadingStates(s => ({ ...s, emp: true }));
    try {
      // الموظف يرى فقط الطلبات المسندة إليه + الحالات الأربع الرسمية
      const { data, error } = await supabase
        .from('service_requests')
        .select(`
          request_id, 
          service_id, 
          contract_url, 
          request_status, 
          request_notes, 
          created_at, 
          user:user_id(association_name, user_phone, user_email), 
          service:service_id(service_name, service_description)
        `)
        .eq('assigned_to', userId)
        .in('request_status', ['pending_review', 'in_progress', 'completed', 'cancelled', 'approved'])
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      // تحويل الحالات القديمة إلى الجديدة
      const normalized = (data || []).map((r: any) => ({
        ...r,
        request_status: r.request_status === 'approved' ? 'in_progress'
          : r.request_status === 'rejected' ? 'cancelled'
          : r.request_status,
      }));
      setEmpRequests(normalized as any);
    } catch (err) {
      console.error("Employee Load Error:", err);
      showToast('خطأ في تحميل المهام', 'error');
    } finally {
      setLoadingStates(s => ({ ...s, emp: false }));
    }
  }, [showToast]);

  const loadAdminStats = useCallback(async () => {
    try {
      const { data: allRequests } = await supabase.from('service_requests').select('request_status');
      if (allRequests) {
        setAdminStats({
          pending: allRequests.filter(r => r.request_status === 'pending_review').length,
          in_progress: allRequests.filter(r => r.request_status === 'in_progress').length,
          completed: allRequests.filter(r => r.request_status === 'completed').length,
          total: allRequests.length,
          trends: { pending: 0, in_progress: 0, completed: 0 }
        });
      }
    } catch (err) { console.error('Stats error:', err); }
  }, []);

  const loadAdminRequests = useCallback(async () => {
    setLoadingStates(s => ({ ...s, admin: true }));
    try {
      // الخطوة 1: جلب الطلبات مع الخدمات والموظفين
      const { data: requests, error: reqErr } = await supabase
        .from('service_requests')
        .select(`
          request_id,
          user_id,
          service_id,
          request_status,
          created_at,
          updated_at,
          contract_url,
          admin_notes,
          assigned_to,
          services:service_id(service_name),
          employees:assigned_to(employee_name, employee_phone)
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (reqErr) throw reqErr;
      if (!requests || requests.length === 0) { setAdminRequests([]); return; }

      // الخطوة 2: جلب بيانات المستخدمين منفصلة
      // (جدول 'user' لا يدعم الـ join المباشر في Supabase بسبب اسمه المحجوز)
      const userIds = [...new Set(requests.map((r: any) => r.user_id).filter(Boolean))];
      const usersMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('user')
          .select('user_id, association_name, user_email, user_phone')
          .in('user_id', userIds);
        if (users) {
          users.forEach((u: any) => { usersMap[u.user_id] = u; });
        }
      }

      // الخطوة 3: دمج بيانات المستخدمين مع الطلبات
      const merged = requests.map((r: any) => ({
        ...r,
        user: r.user_id ? (usersMap[r.user_id] ?? null) : null,
      }));

      setAdminRequests(merged as any);
      // الطلبات المسندة لموظفين — للجدول الثاني
      setAssignedRequests(merged.filter((r: any) => r.assigned_to) as any);
    } catch (err) {
      console.error('Admin load error:', err);
      showToast('خطأ في تحميل الطلبات', 'error');
    } finally {
      setLoadingStates(s => ({ ...s, admin: false }));
    }
  }, [showToast]);

  const loadEmployees = useCallback(async () => {
    setLoadingStates(s => ({ ...s, employees: true }));
    try {
      const { data, error } = await supabase
        .from('employees').select('employee_id, employee_name, employee_email, employee_phone, employee_role, is_active')
        .eq('employee_role', 'employee').order('employee_name', { ascending: true });
      if (error) throw error;
      setEmployees(data || []);
    } catch { showToast('خطأ في تحميل الموظفين', 'error'); }
    finally { setLoadingStates(s => ({ ...s, employees: false })); }
  }, [showToast]);

  const handleSearch = useCallback((query: string) => { startTransition(() => setSearchQuery(query)); }, []);

  // ── Init ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) { navigate('/'); return; }

    const initRole = async () => {
      if (isAdmin) {
        const { data: emp } = await supabase.from('employees').select('employee_id, employee_name').eq('employee_email', user.email).maybeSingle();
        const adminId = emp?.employee_id || user.id;
        const adminName = emp?.employee_name || 'الأدمن';
        setRole('admin');
        setCurrentUser({ id: adminId, email: user.email!, name: adminName });
        setActiveTab('admin-requests');
        await Promise.all([
          loadAdminRequests(),
          loadAdminStats(),
        ]);
      } else if (isEmployee) {
        const { data: emp } = await supabase.from('employees').select('employee_id, employee_name').eq('employee_email', user.email).maybeSingle();
        setRole('employee');
        setCurrentUser({ id: emp?.employee_id || user.id, email: user.email!, name: emp?.employee_name || 'الموظف' });
        setActiveTab('employee-tasks');
        if (emp?.employee_id) {
          await loadEmpRequests(emp.employee_id);
        }
      } else if (isClient) {
        const { data: usr } = await supabase.from('user').select('user_id, association_name, user_email').eq('user_email', user.email).maybeSingle();
        if (usr) {
          setRole('client');
          setCurrentUser({ id: user.id, email: usr.user_email, name: usr.association_name });
          setActiveTab('client-requests');
          await loadClientRequests(user.id);
        } else { showToast('غير مصرح لك بالوصول', 'error'); setTimeout(() => navigate('/'), 2000); }
      } else { showToast('غير مصرح لك بالوصول', 'error'); setTimeout(() => navigate('/'), 2000); }
      setLoading(false);
    };
    initRole();
  }, [authLoading, profileLoading, user, isAdmin, isEmployee, isClient, navigate, showToast, loadAdminRequests, loadAdminStats, loadEmpRequests, loadClientRequests]);

  // ── Realtime ───────────────────────────────────────────────────────────
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const handleRealtimeUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (role === 'client' && currentUser) loadClientRequests(currentUser.id);
        if (role === 'employee' && currentUser) loadEmpRequests(currentUser.id);
        if (role === 'admin') { loadAdminRequests(); loadAdminStats(); }
        showToast('تم تحديث البيانات', 'info');
      }, 1000);
    };
    realtimeChannel.current = supabase.channel('dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, handleRealtimeUpdate)
      .subscribe();
    return () => { clearTimeout(debounceTimer); if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current); };
  }, [role, currentUser, loadClientRequests, loadEmpRequests, loadAdminRequests, loadAdminStats, showToast]);

  // ── Tab Change ─────────────────────────────────────────────────────────
  const handleTabChange = useCallback((tab: string) => {
    startTransition(() => {
      setActiveTab(tab);
      if (tab === 'employees') loadEmployees();
      if (tab === 'employee-tasks' && currentUser) loadEmpRequests(currentUser.id);
      if (tab === 'admin-requests') { loadAdminRequests(); loadAdminStats(); }
    });
  }, [currentUser, loadEmployees, loadEmpRequests, loadAdminRequests, loadAdminStats]);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  const handleReject = async () => {
    if (!rejectNotes.trim()) { showToast('اكتب سبب الرفض', 'error'); return; }
    try {
      const { data: reqData } = await supabase
        .from('service_requests')
        .select('user_id, service:service_id(service_name)')
        .eq('request_id', currentReqId)
        .maybeSingle();

      const { error } = await supabase.from('service_requests')
        .update({ request_status: 'rejected', admin_notes: rejectNotes, updated_at: new Date().toISOString() }).eq('request_id', currentReqId);
      if (error) throw error;
      setModals(m => ({ ...m, reject: false })); setRejectNotes('');
      showToast('تم رفض الطلب');
      loadAdminRequests(); loadAdminStats();

      if (reqData?.user_id) {
        const serviceName = (reqData as any).service?.service_name || 'الخدمة';
        await notifyRequestRejected({ clientUserId: reqData.user_id, serviceName, requestId: currentReqId, reason: rejectNotes });
      }
    } catch (err: any) { showToast('خطأ: ' + err.message, 'error'); }
  };

  const openAssignModal = async (id: string) => {
    setCurrentReqId(id);
    try {
      const { data, error } = await supabase.from('employees').select('employee_id, employee_name, employee_email').eq('is_active', true).eq('employee_role', 'employee');
      if (error || !data?.length) { showToast('لا يوجد موظفون مفعلون', 'error'); return; }
      setActiveEmployees(data); setSelectedEmployee('');
      setModals(m => ({ ...m, assign: true }));
    } catch { showToast('خطأ في تحميل الموظفين', 'error'); }
  };

  const handleAssign = async () => {
    if (!selectedEmployee) { showToast('اختر موظفاً', 'error'); return; }
    const emp = activeEmployees.find(e => e.employee_id === selectedEmployee);
    try {
      const { data: reqData } = await supabase
        .from('service_requests')
        .select('user_id, service:service_id(service_name)')
        .eq('request_id', currentReqId)
        .maybeSingle();

      const { error } = await supabase.from('service_requests')
        .update({ assigned_to: selectedEmployee, employee_id: selectedEmployee, request_status: 'approved', updated_at: new Date().toISOString() }).eq('request_id', currentReqId);
      if (error) throw error;
      setModals(m => ({ ...m, assign: false }));
      showToast(`تم الإسناد لـ ${emp?.employee_name || ''} ✓`);
      loadAdminRequests(); loadAdminStats();

      if (reqData?.user_id && emp) {
        const serviceName = (reqData as any).service?.service_name || 'الخدمة';
        await notifyAssignment({ clientUserId: reqData.user_id, employeeUserId: emp.employee_id, employeeName: emp.employee_name, serviceName, requestId: currentReqId });
      }
    } catch (err: any) { showToast('خطأ: ' + err.message, 'error'); }
  };

  const openUpdateStatus = (id: string) => { setCurrentReqId(id); setEmpNote(''); setNewStatus('in_progress'); setModals(m => ({ ...m, updateStatus: true })); };

  const handleUpdateStatus = async () => {
    try {
      // جلب user_id واسم الخدمة بشكل منفصل لتجنب مشاكل الـ join
      const { data: reqData, error: reqError } = await supabase
        .from('service_requests')
        .select('user_id, service_id')
        .eq('request_id', currentReqId)
        .maybeSingle();

      if (reqError) console.error('[UpdateStatus] fetch req error:', reqError.message);

      let serviceName = 'الخدمة';
      if (reqData?.service_id) {
        const { data: svcData } = await supabase
          .from('services')
          .select('service_name')
          .eq('service_id', reqData.service_id)
          .maybeSingle();
        if (svcData?.service_name) serviceName = svcData.service_name;
      }

      const upd: any = { request_status: newStatus, updated_at: new Date().toISOString() };
      if (empNote.trim()) upd.admin_notes = empNote.trim();
      const { error } = await supabase.from('service_requests').update(upd).eq('request_id', currentReqId);
      if (error) throw error;

      setModals(m => ({ ...m, updateStatus: false }));
      showToast('تم تحديث الحالة ✓');
      if (currentUser) loadEmpRequests(currentUser.id);

      if (reqData?.user_id) {
        await notifyStatusChange({
          clientUserId: reqData.user_id,
          newStatus,
          serviceName,
          requestId: currentReqId,
          note: empNote.trim() || undefined,
        });
      } else {
        console.warn('[UpdateStatus] لم يتم العثور على user_id للطلب:', currentReqId);
      }
    } catch (err: any) { showToast('خطأ: ' + err.message, 'error'); }
  };

  const handleToggleEmployee = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase.from('employees').update({ is_active: active }).eq('employee_id', id);
      if (error) throw error;
      showToast(active ? 'تم تفعيل الحساب ✓' : 'تم تعطيل الحساب');
      loadEmployees();
    } catch { showToast('خطأ في التحديث', 'error'); }
  };

  const handleCreateEmployee = async () => {
  if (!empForm.name || !empForm.email || !empForm.password) {
    showToast('يرجى تعبئة الحقول المطلوبة *', 'error'); return;
  }
  if (empForm.password.length < 8) {
    showToast('كلمة المرور 8 أحرف على الأقل', 'error'); return;
  }
  if (!supabaseAdmin) {
    showToast('خطأ: VITE_SUPABASE_SERVICE_ROLE_KEY غير مضبوط في .env', 'error'); return;
  }
  setEmpFormLoading(true);
  try {
    // 1) أنشئ المستخدم في Auth عبر Admin API (يضمن تشفير كلمة المرور بشكل صحيح)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: empForm.email,
      password: empForm.password,
      email_confirm: true,
      user_metadata: {
        name: empForm.name,
        entity_type: 'employee',
      },
    });

    if (authError) throw authError;

    // 2) أضف السجل في جدول employees بنفس الـ UUID
    const { error: empError } = await supabaseAdmin
      .from('employees')
      .insert({
        employee_id: authData.user.id,
        employee_name: empForm.name,
        employee_email: empForm.email,
        employee_phone: empForm.phone || null,
        employee_role: 'employee',
        is_active: true,
      });

    if (empError) {
      // إذا فشل إضافة الموظف، احذف المستخدم من Auth عشان ما يبقى معلق
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw empError;
    }

    setModals(m => ({ ...m, addEmp: false }));
    setEmpForm({ name: '', email: '', phone: '', password: '' });
    showToast(`تم إنشاء حساب ${empForm.name} بنجاح ✓`);
    loadEmployees();
  } catch (err: any) {
    let msg = err.message || 'فشل الإنشاء';
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('duplicate'))
      msg = 'هذا البريد مسجل مسبقاً';
    showToast('خطأ: ' + msg, 'error');
  } finally {
    setEmpFormLoading(false);
  }
};

  const handleSubmitRequest = async () => {
    if (!requestForm.serviceName) { showToast('يرجى تعبئة اسم الخدمة', 'error'); return; }
    if (!submitRateLimiter.canProceed()) { showToast('يرجى الانتظار قبل إرسال طلب آخر', 'error'); return; }
    setRequestFormLoading(true);
    try {
      const { data: svcData } = await supabase.from('services').select('service_id').eq('service_name', requestForm.serviceName).maybeSingle();

      // ── منع التكرار: تحقق من وجود طلب نشط لنفس الخدمة
      if (svcData?.service_id) {
        const { data: existingReq } = await supabase
          .from('service_requests')
          .select('request_id, request_status')
          .eq('user_id', currentUser?.id)
          .eq('service_id', svcData.service_id)
          .in('request_status', ['pending_review', 'in_progress', 'approved'])
          .maybeSingle();
        if (existingReq) {
          showToast('⚠️ لديك طلب نشط لهذه الخدمة بالفعل — يرجى انتظار إتمامه أو إلغائه أولاً', 'error');
          setRequestFormLoading(false); return;
        }
      }

      const { error } = await supabase.from('service_requests').insert([{ user_id: currentUser?.id, service_id: svcData?.service_id || null, request_notes: requestForm.notes || null, request_status: 'pending_review' }]);
      if (error) throw error;
      setModals(m => ({ ...m, newRequest: false }));
      setRequestForm({ serviceName: '', serviceDesc: '', notes: '' });
      showToast('تم إرسال الطلب بنجاح ✓');
      if (currentUser) loadClientRequests(currentUser.id);

      await notifyAdminNewServiceRequest({
        clientName:  currentUser?.name || 'عميل',
        serviceName: requestForm.serviceName,
        requestId:   '',
      });
    } catch (err: any) { showToast('خطأ في إرسال الطلب: ' + (err.message || ''), 'error'); }
    finally { setRequestFormLoading(false); }
  };

  const handleAddNews = async () => {
    if (!newsForm.title || !newsForm.excerpt) { showToast('يرجى تعبئة الحقول المطلوبة', 'error'); return; }
    setNewsFormLoading(true);
    try {
      const { error } = await supabase.from('news').insert([{ title: newsForm.title, excerpt: newsForm.excerpt, image: newsForm.image || null, category: newsForm.category || 'عام', date: newsForm.date || new Date().toISOString().split('T')[0], tweet: newsForm.tweet || null, device_info: newsForm.device_info || null, timestamp: Date.now(), created_by: currentUser?.id || null }]);
      if (error) throw error;
      setModals(m => ({ ...m, news: false }));
     setNewsForm({ title: '', excerpt: '', image: '', category: 'عام', date: new Date().toISOString().split('T')[0], tweet: '', author: '', device_info: '', city_info: '' });
      if (newsImageRef.current) newsImageRef.current.value = '';
      showToast('تم نشر الخبر بنجاح ✓');
    } catch (err: any) { showToast('خطأ في نشر الخبر: ' + (err.message || ''), 'error'); }
    finally { setNewsFormLoading(false); }
  };
  const handleNewsImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('حجم الصورة يجب أن يكون أقل من 5MB', 'error');
    return;
  }
  if (!file.type.startsWith('image/')) {
    showToast('الملف المحدد ليس صورة', 'error');
    return;
  }
  setNewsImageUploading(true);
  try {
    const ext = file.name.split('.').pop();
    const path = `news/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('news-images')
      .upload(path, file, { upsert: false, contentType: file.type });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('news-images').getPublicUrl(path);
    setNewsForm(f => ({ ...f, image: urlData.publicUrl }));
    showToast('تم رفع الصورة بنجاح ✓');
  } catch (err: any) {
    showToast('خطأ في رفع الصورة: ' + (err.message || ''), 'error');
  } finally {
    setNewsImageUploading(false);
    if (newsImageRef.current) newsImageRef.current.value = '';
  }
};

  // ── Loading Screen (after all hooks) ───────────────────────────────────
  if (authLoading || profileLoading || loading) {
    return (
      <div className={`fixed inset-0 flex flex-col items-center justify-center z-[9999]
        ${dm ? 'bg-slate-900' : 'bg-gradient-to-br from-slate-50 to-cyan-50'}`}>
        <div className="relative">
          <i className={`fas fa-spinner fa-spin text-6xl mb-4 ${dm ? 'text-cyan-400' : 'text-cyan-500'}`} />
          <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400 opacity-20" />
        </div>
        <p className={`font-semibold animate-pulse mt-4 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>جاري تحميل لوحة التحكم...</p>
      </div>
    );
  }

  // ── Filtered Lists ─────────────────────────────────────────────────────
 // ── الفلترة لطلبات العميل ─────────────────────────────────────────────────────
  const filteredClientReqs = clientRequests.filter(r => {
    const matchesStatus = clientStatusFilter === 'all' || r.request_status === clientStatusFilter;
    const matchesDate = applyDateFilter(r.created_at, clientDateFilter);
    // التصحيح: استخدمنا r.service (مفرد) بدلاً من services
    const matchesSearch = !searchQuery || 
      (r as any).service?.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.request_id?.includes(searchQuery);
    return matchesStatus && matchesDate && matchesSearch;
  });

  // ── الفلترة لمهام الموظف ─────────────────────────────────────────────────────
  const filteredEmpReqs = empRequests.filter(r => {
    const matchesStatus = empStatusFilter === 'all' || r.request_status === empStatusFilter;
    const matchesDate = applyDateFilter(r.created_at, empDateFilter);
    // التصحيح: استخدمنا r.service (مفرد) والبحث يشمل اسم الجمعية أيضاً
    const matchesSearch = !searchQuery || 
      (r as any).service?.service_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.user?.association_name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDate && matchesSearch;
  });

  // ── الفلترة لطلبات الأدمن ─────────────────────────────────────────────────────
  const filteredAdminReqs = adminRequests.filter(r => {
    const matchesStatus = adminStatusFilter === 'all' || r.request_status === adminStatusFilter;
    const matchesDate = applyDateFilter(r.created_at, adminDateFilter);
    
    // التصحيح الشامل للأدمن: البحث في اسم الجمعية، رقم الطلب، اسم الخدمة، واسم الموظف
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      r.user?.association_name?.toLowerCase().includes(searchLower) || 
      r.request_id?.includes(searchQuery) || 
      (r as any).service?.service_name?.toLowerCase().includes(searchLower) || 
      (r as any).employee?.employee_name?.toLowerCase().includes(searchLower);

    return matchesStatus && matchesDate && matchesSearch;
  });

  // ── الفلترة لجدول متابعة الموظفين ──────────────────────────────────────────
  const filteredAssignedReqs = assignedRequests.filter(r => {
    const matchesStatus = assignedStatusFilter === 'all' || r.request_status === assignedStatusFilter;
    const matchesDate = applyDateFilter(r.created_at, assignedDateFilter);
    return matchesStatus && matchesDate;
  });

  // ── إحصائيات جدول متابعة الموظفين ─────────────────────────────────────────
  const assignedStats = {
    total:          assignedRequests.length,
    pending_review: assignedRequests.filter(r => r.request_status === 'pending_review').length,
    in_progress:    assignedRequests.filter(r => ['in_progress','approved'].includes(r.request_status)).length,
    completed:      assignedRequests.filter(r => r.request_status === 'completed').length,
    cancelled:      assignedRequests.filter(r => ['cancelled','rejected'].includes(r.request_status)).length,
  };

  // ── إحصائيات العميل ─────────────────────────────────────────────────────
  const clientStats = {
    pending: clientRequests.filter(r => r.request_status === 'pending_review').length,
    in_progress: clientRequests.filter(r => r.request_status === 'in_progress').length,
    completed: clientRequests.filter(r => r.request_status === 'completed').length,
    total: clientRequests.length,
    today: clientRequests.filter(r => isToday(r.created_at)).length,
  };

  // ── إحصائيات الموظف — الحالات الأربع الرسمية ─────────────────────────────
  const empStats = {
    pending_review: empRequests.filter(r => r.request_status === 'pending_review').length,
    in_progress:    empRequests.filter(r => r.request_status === 'in_progress').length,
    completed:      empRequests.filter(r => r.request_status === 'completed').length,
    cancelled:      empRequests.filter(r => r.request_status === 'cancelled').length,
    total:          empRequests.length,
  };

  // ── إحصائيات الأدمن (بناءً على البيانات المفلترة حالياً) ────────────────────────
  const adminStatsFiltered = {
    pending: adminRequests.filter(r => r.request_status === 'pending_review').length,
    in_progress: adminRequests.filter(r => r.request_status === 'in_progress').length,
    completed: adminRequests.filter(r => r.request_status === 'completed').length,
    total: adminRequests.length,
    today: adminRequests.filter(r => isToday(r.created_at)).length,
  };
  const roleLabel = { admin: 'أدمن', employee: 'موظف', client: 'عميل' }[role || 'client'] || '';
  const tabsConfig = {
    admin: [{ key: 'admin-requests', label: 'إدارة الطلبات', icon: 'fa-file-alt' }, { key: 'employees', label: 'إدارة الموظفين', icon: 'fa-users-cog' }],
    employee: [{ key: 'employee-tasks', label: 'مهامي', icon: 'fa-tasks' }],
    client: [{ key: 'client-requests', label: 'طلباتي', icon: 'fa-file-alt' }],
  };
  const tabs = tabsConfig[role || 'client'] || [];
  const openPdf = (url: string) => { setPdfUrl(url); setModals(m => ({ ...m, pdf: true })); };
  

  // ════════════════════════════════════════════════════════════════════════
  // ─── RENDER ──────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="relative min-h-dvh font-tajawal overflow-x-hidden" dir="rtl">

      {/* ── مسافة تحت الهيدر الرئيسي ─────────────────────────────────── */}
      <div className="pt-20" />

      {/* ── Tabs Bar ─────────────────────────────────────────────────────── */}
      <div className={`border-b sticky top-0 z-20 backdrop-blur-md
        ${dm ? 'bg-slate-900/90 border-slate-700/80' : 'bg-white/90 border-slate-200'}`}>
        <div className="max-w-[1400px] mx-auto px-6 flex gap-0.5 flex-wrap pt-1">
          {tabs.map((tab, idx) => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)}
              data-aos="fade-up" data-aos-delay={idx * 100}
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold border-b-2 -mb-px transition-all duration-150
                ${activeTab === tab.key
                  ? (dm ? 'text-cyan-400 border-cyan-400' : 'text-cyan-600 border-cyan-600')
                  : (dm ? 'text-slate-500 border-transparent hover:text-cyan-400 hover:border-slate-600' : 'text-slate-400 border-transparent hover:text-cyan-600 hover:border-slate-200')}`}>
              <i className={`fas ${tab.icon} text-[13px]`} />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── CLIENT TAB ────────────────────────────────────────────────── */}
      {activeTab === 'client-requests' && (
      <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-5 overflow-x-hidden" data-aos="fade-up">
          <RequestsTable
            role="client"
            requests={clientRequests}
            loading={loadingStates.client}
            isDarkMode={dm}
            onRefresh={() => currentUser && loadClientRequests(currentUser.id)}
            showToast={showToast}
          />
        </div>
      )}

      {/* ── EMPLOYEE TAB ──────────────────────────────────────────────── */}
      {activeTab === 'employee-tasks' && (
  <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-5 overflow-x-hidden" data-aos="fade-up">
          <RequestsTable
            role="employee"
            requests={empRequests}
            loading={loadingStates.emp}
            isDarkMode={dm}
            onRefresh={() => currentUser && loadEmpRequests(currentUser.id)}
            showToast={showToast}
          />
        </div>
      )}

      {/* ── ADMIN REQUESTS TAB ────────────────────────────────────────── */}
      {activeTab === 'admin-requests' && (
  <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-6 space-y-5 overflow-x-hidden" data-aos="fade-up">
          <RequestsTable
            role="admin"
            requests={adminRequests.filter(r => !r.assigned_to)}
            loading={loadingStates.admin}
            isDarkMode={dm}
            onRefresh={() => { loadAdminRequests(); loadAdminStats(); }}
            showToast={showToast}
          />

          {/* ── جدول تتبع الموظفين ─────────────────────────────────────── */}
          <div className={`rounded-2xl overflow-hidden shadow-sm border mt-8 ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`px-6 py-4 border-b flex items-center gap-2.5 ${dm ? 'border-slate-700 bg-slate-800/80' : 'border-slate-100 bg-slate-50/60'}`}>
              <i className="fas fa-user-clock text-violet-500 text-lg" />
              <h2 className={`text-base font-extrabold ${dm ? 'text-white' : 'text-slate-800'}`}>
                متابعة الموظفين
              </h2>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ms-1 ${dm ? 'bg-violet-900/40 text-violet-400 border border-violet-700' : 'bg-violet-50 text-violet-700 border border-violet-200'}`}>
                {assignedRequests.length} طلب مسند
              </span>
              <span className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-400'} ms-auto`}>
                الطلبات التي تم إسنادها لموظفين
              </span>
            </div>

            {/* ── شريط فلاتر جدول متابعة الموظفين ─────────────────────── */}
            <div className={`px-5 py-3 border-b ${dm ? 'border-slate-700 bg-slate-800/40' : 'border-slate-100 bg-slate-50/40'}`}>
              <div className="flex flex-wrap gap-2 items-center">
                {/* فلتر الحالة */}
                <div className="flex gap-1 flex-wrap">
                  {[
                    { v: 'all',            label: 'الكل',         count: assignedStats.total,          dot: 'bg-slate-400',   active: 'bg-slate-600 text-white border-slate-600'   },
                    { v: 'pending_review', label: 'قيد المراجعة', count: assignedStats.pending_review, dot: 'bg-amber-400',   active: 'bg-amber-500 text-white border-amber-500'   },
                    { v: 'in_progress',    label: 'قيد التنفيذ',  count: assignedStats.in_progress,    dot: 'bg-sky-400',     active: 'bg-sky-500 text-white border-sky-500'         },
                    { v: 'completed',      label: 'مكتملة',        count: assignedStats.completed,      dot: 'bg-emerald-400', active: 'bg-emerald-500 text-white border-emerald-500' },
                    { v: 'cancelled',      label: 'ملغاة',         count: assignedStats.cancelled,      dot: 'bg-red-400',     active: 'bg-red-500 text-white border-red-400'         },
                  ].map(f => {
                    const isActive = assignedStatusFilter === f.v;
                    return (
                      <button key={f.v} onClick={() => setAssignedStatusFilter(f.v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all shadow-sm
                          ${isActive
                            ? `${f.active} shadow-sm`
                            : (dm ? 'bg-slate-700/60 text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700')}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/80' : f.dot}`} />
                        {f.label}
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full
                          ${isActive ? 'bg-white/25 text-white' : (dm ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-500')}`}>
                          {f.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* فاصل */}
                <div className={`w-px h-6 ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />

                {/* فلتر التاريخ */}
                <div className={`flex items-center rounded-xl p-0.5 gap-0.5 ${dm ? 'bg-slate-700' : 'bg-slate-100'}`}>
                  {([
                    { v: 'all',   l: 'الكل',     color: 'bg-slate-600 text-white'   },
                    { v: 'today', l: 'اليوم',    color: 'bg-violet-600 text-white'  },
                    { v: 'week',  l: 'الأسبوع', color: 'bg-violet-600 text-white'  },
                    { v: 'month', l: 'الشهر',   color: 'bg-violet-600 text-white'  },
                  ] as { v: DateFilter; l: string; color: string }[]).map(o => (
                    <button key={o.v} onClick={() => setAssignedDateFilter(o.v)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all
                        ${assignedDateFilter === o.v
                          ? `${o.color} shadow-sm`
                          : (dm ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}>
                      {o.l}
                    </button>
                  ))}
                </div>

                {/* مسح الفلاتر */}
                {(assignedStatusFilter !== 'all' || assignedDateFilter !== 'all') && (
                  <button onClick={() => { setAssignedStatusFilter('all'); setAssignedDateFilter('all'); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-red-400 border border-red-200 hover:bg-red-50 transition-all">
                    <i className="fas fa-times text-[9px]" /> مسح
                  </button>
                )}

                <span className={`text-[11px] mr-auto font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                  {filteredAssignedReqs.length} نتيجة
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className={dm ? 'bg-slate-700/80' : 'bg-gradient-to-l from-violet-700 to-violet-500'}>
                    {['#', 'اسم الخدمة', 'اسم العميل', 'اسم الموظف', 'الحالة', 'العقد', 'التاريخ'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-right text-[11px] font-bold text-white/90 whitespace-nowrap tracking-wide
                        ${i === 0 ? 'rounded-tr-2xl w-10' : ''} ${i === 6 ? 'rounded-tl-2xl' : ''}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingStates.admin ? (
                    <tr><td colSpan={7} className="text-center py-16">
                      <i className="fas fa-spinner fa-spin text-3xl text-violet-400 block mb-2" />
                      <span className={`text-sm ${dm ? 'text-slate-400' : 'text-slate-400'}`}>جاري التحميل...</span>
                    </td></tr>
                  ) : assignedRequests.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-16">
                      <i className="fas fa-inbox text-5xl block mb-3 opacity-20 text-slate-300" />
                      <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-400'}`}>لا توجد طلبات مسندة بعد</p>
                    </td></tr>
                  ) : filteredAssignedReqs.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-16">
                      <i className="fas fa-search text-5xl block mb-3 opacity-20 text-slate-300" />
                      <p className={`text-sm font-semibold ${dm ? 'text-slate-400' : 'text-slate-400'}`}>لا توجد نتائج تطابق الفلتر</p>
                      <button onClick={() => { setAssignedStatusFilter('all'); setAssignedDateFilter('all'); }}
                        className="mt-2 text-xs text-violet-500 hover:underline">مسح الفلاتر</button>
                    </td></tr>
                  ) : filteredAssignedReqs.map((r, idx) => {
                    const isEven = idx % 2 === 0;
                    const rowBg = dm
                      ? `border-slate-700/60 hover:bg-slate-700/40 ${!isEven ? 'bg-slate-800/30' : ''}`
                      : `border-slate-100 hover:bg-violet-50/20 ${!isEven ? 'bg-slate-50/50' : ''}`;
                    const emp = (r as any).employees || (r as any).employee;
                    const svc = (r as any).services || (r as any).service;
                    const statusCfg: Record<string, { label: string; pill: string; dot: string; icon: string }> = {
                      pending_review: { label: 'قيد المراجعة', icon: 'fa-hourglass-half', pill: dm ? 'bg-amber-900/30 text-amber-400 border-amber-700' : 'bg-amber-50 text-amber-700 border-amber-300', dot: 'bg-amber-400' },
                      in_progress:    { label: 'قيد التنفيذ',  icon: 'fa-cogs',           pill: dm ? 'bg-sky-900/30 text-sky-400 border-sky-700'   : 'bg-sky-50 text-sky-700 border-sky-300',     dot: 'bg-sky-400' },
                      approved:       { label: 'قيد التنفيذ',  icon: 'fa-cogs',           pill: dm ? 'bg-sky-900/30 text-sky-400 border-sky-700'   : 'bg-sky-50 text-sky-700 border-sky-300',     dot: 'bg-sky-400' },
                      completed:      { label: 'مكتمل',        icon: 'fa-flag-checkered', pill: dm ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700' : 'bg-emerald-50 text-emerald-700 border-emerald-300', dot: 'bg-emerald-500' },
                      cancelled:      { label: 'ملغى',         icon: 'fa-ban',            pill: dm ? 'bg-red-900/30 text-red-400 border-red-700'   : 'bg-red-50 text-red-600 border-red-300',     dot: 'bg-red-400' },
                      rejected:       { label: 'ملغى',         icon: 'fa-ban',            pill: dm ? 'bg-red-900/30 text-red-400 border-red-700'   : 'bg-red-50 text-red-600 border-red-300',     dot: 'bg-red-400' },
                    };
                    const sc = statusCfg[r.request_status] ?? statusCfg.pending_review;
                    return (
                      <tr key={r.request_id} className={`border-b transition-colors ${rowBg}`}>
                        <td className={`px-4 py-3 text-center text-[11px] font-bold ${dm ? 'text-slate-500' : 'text-slate-400'}`}>{idx + 1}</td>
                        <td className={`px-4 py-3 text-sm font-semibold ${dm ? 'text-white' : 'text-slate-800'}`}>
                          {svc?.service_name || '—'}
                        </td>
                        <td className={`px-4 py-3 text-sm font-bold ${dm ? 'text-slate-200' : 'text-slate-700'}`}>
                          {r.user?.association_name || '—'}
                        </td>
                        <td className="px-4 py-3">
                          {emp?.employee_name ? (
                            <span className={`flex items-center gap-1.5 text-sm font-semibold ${dm ? 'text-violet-400' : 'text-violet-700'}`}>
                              <i className="fas fa-user-tie text-[10px]" />{emp.employee_name}
                            </span>
                          ) : <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border ${sc.pill}`}>
                            <span className="relative flex-shrink-0 w-2 h-2">
                              <span className={`absolute inset-0 rounded-full ${sc.dot} animate-ping opacity-60`} />
                              <span className={`relative block w-2 h-2 rounded-full ${sc.dot}`} />
                            </span>
                            <i className={`fas ${sc.icon} text-[10px]`} />
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {r.contract_url ? (
                            <button
                              onClick={() => { setPdfUrl(r.contract_url!); setModals(m => ({ ...m, pdf: true })); }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                ${dm ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700 hover:bg-emerald-700 hover:text-white' : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-600 hover:text-white'}`}>
                              <i className="fas fa-eye" /> عرض العقد
                            </button>
                          ) : (
                            <span className={`text-xs ${dm ? 'text-slate-500' : 'text-slate-400'}`}>لم يُرفع بعد</span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-xs whitespace-nowrap ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                          {new Date(r.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {assignedRequests.length > 0 && (
              <div className={`px-5 py-2.5 border-t flex items-center justify-between ${dm ? 'border-slate-700 bg-slate-800/40' : 'border-slate-100 bg-slate-50/60'}`}>
                <span className={`text-[11px] font-semibold ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                  عرض <span className={`font-extrabold ${dm ? 'text-white' : 'text-slate-800'}`}>{filteredAssignedReqs.length}</span> من أصل {assignedRequests.length} طلب مسند
                </span>
                <span className={`text-[11px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
                  مكتمل: <span className="font-bold text-emerald-500">{assignedRequests.filter(r => r.request_status === 'completed').length}</span>
                  {' · '}
                  قيد التنفيذ: <span className="font-bold text-sky-500">{assignedRequests.filter(r => ['in_progress','approved'].includes(r.request_status)).length}</span>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── EMPLOYEES TAB ─────────────────────────────────────────────── */}
      {activeTab === 'employees' && (
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6" data-aos="fade-up">
          <div className="flex justify-between items-center mb-6">
            <h2 className={`text-lg font-extrabold flex items-center gap-2 ${dm ? 'text-white' : 'text-slate-800'}`}>
              <i className="fas fa-users-cog text-cyan-600" />الموظفون
              <span className={`text-sm font-normal ${dm ? 'text-slate-400' : 'text-slate-400'}`}>({employees.length})</span>
            </h2>
          </div>

          {loadingStates.employees ? (
            <div className="text-center py-20 text-slate-400"><i className="fas fa-spinner fa-spin text-4xl text-cyan-400 block mb-3" /></div>
          ) : employees.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <i className="fas fa-users text-5xl block mb-3 opacity-20" />
              <p className="font-semibold">لا يوجد موظفون — اضغط "موظف جديد" لإضافة أول موظف</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {employees.map((e, idx) => (
                <div key={e.employee_id}
                  data-aos="fade-up" data-aos-delay={idx * 80}
                  className={`rounded-2xl p-6 shadow-sm border-r-4 flex flex-col gap-4 transition-all hover:shadow-md
                    ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white'}
                    ${e.is_active ? 'border-cyan-500' : 'border-red-400 opacity-70'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-600 to-cyan-400 flex items-center justify-center text-white text-lg flex-shrink-0">
                      <i className="fas fa-user" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-extrabold text-base truncate ${dm ? 'text-white' : 'text-slate-800'}`}>{e.employee_name}</div>
                      <div className={`text-xs flex items-center gap-1 mt-0.5 ${dm ? 'text-slate-400' : 'text-slate-400'}`}>
                        <i className="fas fa-user-tie text-cyan-500" /> موظف
                      </div>
                    </div>
                    {!e.is_active && <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-50 text-red-500 flex-shrink-0">معطّل</span>}
                  </div>
                  <div className={`text-sm space-y-1.5 ${dm ? 'text-slate-400' : 'text-slate-500'}`}>
                    <div className="flex items-center gap-2"><i className="fas fa-envelope text-cyan-500 w-4" />{e.employee_email}</div>
                    {e.employee_phone && <div className="flex items-center gap-2"><i className="fas fa-phone text-cyan-500 w-4" />{e.employee_phone}</div>}
                  </div>
                  <div className="flex gap-2 mt-1">
                    {e.is_active ? (
                      <button onClick={() => handleToggleEmployee(e.employee_id, false)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-red-200">
                        <i className="fas fa-ban" /> تعطيل
                      </button>
                    ) : (
                      <button onClick={() => handleToggleEmployee(e.employee_id, true)}
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-emerald-200">
                        <i className="fas fa-check" /> تفعيل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Floating News Button ──────────────────────────────────────────── */}
      {(role === 'admin' || role === 'employee') && (
        <button onClick={() => setModals(m => ({ ...m, news: true }))} title="إضافة خبر جديد"
          className="fixed bottom-8 left-8 w-14 h-14 rounded-full shadow-xl flex items-center justify-center text-white text-xl z-50 transition-all hover:scale-110 hover:shadow-2xl bg-gradient-to-br from-orange-500 to-orange-600">
          <i className="fas fa-bullhorn" />
        </button>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════════════════ */}

      {/* Reject Modal */}
      {modals.reject && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, reject: false }))}>
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-times-circle text-red-500" />رفض الطلب</h3>
              <button onClick={() => setModals(m => ({ ...m, reject: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5">
              <label className={`block mb-2 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>سبب الرفض (ستظهر للعميل)</label>
              <textarea className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-red-500 focus:ring-red-900/30' : 'border-slate-200 focus:border-red-400 focus:ring-red-100'}`}
                rows={4} placeholder="اكتب سبب الرفض..." value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} />
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <button onClick={() => setModals(m => ({ ...m, reject: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleReject} className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                <i className="fas fa-times" /> تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {modals.assign && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, assign: false }))}>
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-user-check text-violet-500" />إسناد موظف</h3>
              <button onClick={() => setModals(m => ({ ...m, assign: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {activeEmployees.map(emp => (
                <button key={emp.employee_id} onClick={() => setSelectedEmployee(emp.employee_id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-right
                    ${selectedEmployee === emp.employee_id
                      ? 'bg-violet-50 border-violet-300 shadow-sm'
                      : (dm ? 'bg-slate-700 border-slate-600 hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-violet-200')}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm flex-shrink-0
                    ${selectedEmployee === emp.employee_id ? 'bg-violet-500' : 'bg-slate-400'}`}>
                    <i className="fas fa-user" />
                  </div>
                  <div className="flex-1">
                    <div className={`font-bold text-sm ${dm ? 'text-white' : 'text-slate-800'}`}>{emp.employee_name}</div>
                    <div className={`text-xs ${dm ? 'text-slate-400' : 'text-slate-400'}`}>{emp.employee_email}</div>
                  </div>
                  {selectedEmployee === emp.employee_id && <i className="fas fa-check-circle text-violet-500" />}
                </button>
              ))}
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <button onClick={() => setModals(m => ({ ...m, assign: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleAssign} disabled={!selectedEmployee} className="px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                <i className="fas fa-check" /> تأكيد الإسناد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {modals.updateStatus && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, updateStatus: false }))}>
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-exchange-alt text-sky-500" />تحديث الحالة</h3>
              <button onClick={() => setModals(m => ({ ...m, updateStatus: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={`block mb-2 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>الحالة الجديدة</label>
                <select value={newStatus} onChange={e => setNewStatus(e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white focus:border-sky-500 focus:ring-sky-900/30' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}>
                  <option value="in_progress">قيد التنفيذ</option>
                  <option value="completed">مكتمل</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
              <div>
                <label className={`block mb-2 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>ملاحظات (اختياري)</label>
                <textarea className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                  ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-sky-500 focus:ring-sky-900/30' : 'border-slate-200 focus:border-sky-400 focus:ring-sky-100'}`}
                  rows={3} placeholder="اكتب ملاحظاتك..." value={empNote} onChange={e => setEmpNote(e.target.value)} />
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <button onClick={() => setModals(m => ({ ...m, updateStatus: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleUpdateStatus} className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                <i className="fas fa-check" /> تحديث
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer Modal */}
      {modals.pdf && pdfUrl && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, pdf: false }))}>
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-extrabold flex items-center gap-2 text-base text-slate-800"><i className="fas fa-file-pdf text-red-500" />عرض العقد</h3>
              <div className="flex gap-2">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-50 text-cyan-600 hover:bg-cyan-100 transition-colors border border-cyan-200">
                  <i className="fas fa-external-link-alt" /> فتح في صفحة جديدة
                </a>
                <button onClick={() => setModals(m => ({ ...m, pdf: false }))} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"><i className="fas fa-times" /></button>
              </div>
            </div>
            <div className="flex-1">
              <iframe src={pdfUrl} className="w-full h-full border-0" title="Contract Viewer" />
            </div>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {modals.addEmp && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, addEmp: false }))}>
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-user-plus text-cyan-500" />إضافة موظف جديد</h3>
              <button onClick={() => setModals(m => ({ ...m, addEmp: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {[
                { key: 'name', label: 'الاسم *', icon: 'fa-user', type: 'text', placeholder: 'اسم الموظف' },
                { key: 'email', label: 'البريد الإلكتروني *', icon: 'fa-envelope', type: 'email', placeholder: 'email@example.com' },
                { key: 'phone', label: 'رقم الجوال', icon: 'fa-phone', type: 'tel', placeholder: '05xxxxxxxx' },
                { key: 'password', label: 'كلمة المرور *', icon: 'fa-lock', type: 'password', placeholder: '8 أحرف على الأقل' },
              ].map(field => (
                <div key={field.key}>
                  <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>{field.label}</label>
                  <div className="relative">
                    <i className={`fas ${field.icon} absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400`} />
                    <input
                      inputMode={field.key === 'phone' ? 'numeric' : 'text'}
                      maxLength={field.key === 'phone' ? 10 : undefined}
                      type={field.type}
                      value={empForm[field.key as keyof typeof empForm]}
                      onChange={e => {
                      const val = field.key === 'phone'
                        ? e.target.value.replace(/\D/g, '').slice(0, 10)
                        : e.target.value;
                      setEmpForm(f => ({ ...f, [field.key]: val }));
                    }}
                    onKeyPress={field.key === 'phone' ? (e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); } : undefined}
                      placeholder={field.placeholder}
                      className={`w-full pr-10 pl-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                        ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-900/30' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <button onClick={() => setModals(m => ({ ...m, addEmp: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleCreateEmployee} disabled={empFormLoading} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                {empFormLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
                إنشاء الحساب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {modals.newRequest && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, newRequest: false }))}>
          <div className={`rounded-2xl w-full max-w-lg shadow-2xl border ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-plus-circle text-cyan-500" />طلب خدمة جديدة</h3>
              <button onClick={() => setModals(m => ({ ...m, newRequest: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>اسم الخدمة *</label>
                <input type="text" value={requestForm.serviceName} onChange={e => setRequestForm(f => ({ ...f, serviceName: e.target.value }))}
                  placeholder="مثل: استشارة قانونية" className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-900/30' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} />
              </div>
              <div>
                <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>ملاحظات (اختياري)</label>
                <textarea value={requestForm.notes} onChange={e => setRequestForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="أي تفاصيل إضافية..." rows={3} className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-900/30' : 'border-slate-200 focus:border-cyan-400 focus:ring-cyan-100'}`} />
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end ${dm ? 'border-slate-700' : 'border-slate-100'}`}>
              <button onClick={() => setModals(m => ({ ...m, newRequest: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleSubmitRequest} disabled={requestFormLoading} className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                {requestFormLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                إرسال الطلب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add News Modal */}
      {modals.news && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[1000] flex items-center justify-center p-4 sm:p-5"
          onClick={e => e.target === e.currentTarget && setModals(m => ({ ...m, news: false }))}>
         <div className={`rounded-2xl w-full max-w-lg shadow-2xl border max-h-[min(92vh,calc(100dvh-32px))] overflow-y-auto mx-2 sm:mx-0 ${dm ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
            <div className={`flex items-center justify-between px-6 py-4 border-b sticky top-0 z-10 ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
              <h3 className={`font-extrabold flex items-center gap-2 text-base ${dm ? 'text-white' : 'text-slate-800'}`}><i className="fas fa-bullhorn text-orange-500" />نشر خبر جديد</h3>
              <button onClick={() => setModals(m => ({ ...m, news: false }))} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${dm ? 'text-slate-400 hover:bg-slate-700 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}><i className="fas fa-times" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
             <div>
  <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>
    صورة الخبر (اختياري)
  </label>
  <input
    ref={newsImageRef}
    type="file"
    accept="image/*"
    className="hidden"
    onChange={handleNewsImageUpload}
  />
  {newsForm.image ? (
    <div className="space-y-2">
      <img
        src={newsForm.image}
        alt="معاينة الصورة"
        className="w-full h-32 object-cover rounded-xl border-2 border-orange-200"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => newsImageRef.current?.click()}
          disabled={newsImageUploading}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 border-dashed transition-all
            ${dm
              ? 'border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400'
              : 'border-slate-200 text-slate-500 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50'}`}
        >
          <i className="fas fa-redo text-xs" /> تغيير الصورة
        </button>
        <button
          type="button"
          onClick={() => setNewsForm(f => ({ ...f, image: '' }))}
          className="px-3 py-2.5 rounded-xl text-sm font-bold bg-red-50 text-red-500 border border-red-200 hover:bg-red-500 hover:text-white transition-all"
        >
          <i className="fas fa-trash text-xs" />
        </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => newsImageRef.current?.click()}
            disabled={newsImageUploading}
            className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed transition-all
              ${newsImageUploading
                ? 'border-orange-300 bg-orange-50/30 cursor-wait'
                : dm
                  ? 'border-slate-600 text-slate-400 hover:border-orange-500 hover:text-orange-400 hover:bg-orange-900/10'
                  : 'border-slate-200 text-slate-400 hover:border-orange-400 hover:text-orange-500 hover:bg-orange-50'}`}
          >
            {newsImageUploading ? (
              <>
                <i className="fas fa-spinner fa-spin text-xl text-orange-400" />
                <span className="text-xs font-bold">جاري الرفع...</span>
              </>
            ) : (
              <>
                <i className="fas fa-cloud-upload-alt text-2xl" />
                <span className="text-xs font-bold">اضغط لرفع صورة</span>
                <span className="text-[10px] opacity-60">PNG, JPG, WEBP — حد أقصى 5MB</span>
              </>
            )}
          </button>
        )}
      </div>
              <div>
                <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>عنوان الخبر *</label>
                <input type="text" value={newsForm.title} onChange={e => setNewsForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="اكتب عنوان الخبر..." className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-900/30' : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'}`} />
              </div>
              <div>
                <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>المحتوى *</label>
                <textarea value={newsForm.excerpt} onChange={e => setNewsForm(f => ({ ...f, excerpt: e.target.value }))}
                  placeholder="محتوى الخبر..." rows={4} className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-900/30' : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'}`} />
              </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>التصنيف</label>
                  <select value={newsForm.category} onChange={e => setNewsForm(f => ({ ...f, category: e.target.value }))}
                    className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                      ${dm ? 'bg-slate-700 border-slate-600 text-white focus:border-orange-500 focus:ring-orange-900/30' : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'}`}>
                    <option value="عام">عام</option>
                    <option value="إعلان">إعلان</option>
                    <option value="تحديث">تحديث</option>
                    <option value="فعالية">فعالية</option>
                  </select>
                </div>
                <div>
                  <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>التاريخ</label>
                  <input type="date" value={newsForm.date} onChange={e => setNewsForm(f => ({ ...f, date: e.target.value }))}
                    className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                      ${dm ? 'bg-slate-700 border-slate-600 text-white focus:border-orange-500 focus:ring-orange-900/30' : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'}`} />
                </div>
              </div>
              <div>
                <label className={`block mb-1.5 font-bold text-sm ${dm ? 'text-slate-300' : 'text-slate-700'}`}>رابط (اختياري)</label>
                <input type="url" value={newsForm.tweet} onChange={e => setNewsForm(f => ({ ...f, tweet: e.target.value }))}
                  placeholder="https://... (رابط تغريدة أو صفحة)" className={`w-full px-4 py-3 border-2 rounded-xl font-tajawal text-sm focus:outline-none focus:ring-2 transition-all
                    ${dm ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500 focus:border-orange-500 focus:ring-orange-900/30' : 'border-slate-200 focus:border-orange-400 focus:ring-orange-100'}`} />
              </div>
            </div>
            <div className={`px-6 py-4 border-t flex gap-3 justify-end sticky bottom-0 ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-100 bg-white'}`}>
              <button onClick={() => setModals(m => ({ ...m, news: false }))} className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors ${dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'}`}>إلغاء</button>
              <button onClick={handleAddNews} disabled={newsFormLoading} className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors">
                {newsFormLoading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-bullhorn" />}
                نشر الخبر
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}