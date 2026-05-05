// components/RequestsTable.tsx
import { useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'admin' | 'employee' | 'client';
type DateFilter = 'all' | 'today' | 'week' | 'month';
type SearchField = 'all' | 'association' | 'phone' | 'request_id' | 'service';

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
  created_at: string;
  updated_at?: string;
  user?: { association_name: string; user_email: string; user_phone?: string };
  services?: { service_name: string; service_description?: string };
  employees?: { employee_name: string; employee_phone?: string };
}

interface Employee {
  employee_id: string;
  employee_name: string;
  employee_email?: string;
}

interface RequestsTableProps {
  role: Role;
  requests: ServiceRequest[];
  loading?: boolean;
  isDarkMode?: boolean;
  onRefresh?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── الحالات الأربع الرسمية ────────────────────────────────────────────────────
const STATUS_CFG: Record<string, {
  label: string;
  icon: string;
  pill: string;
  dot: string;
  glow: string;
  bg: string;
  description: string;
  step: number;
}> = {
  pending_review: {
    label: 'قيد المراجعة',
    icon: 'fa-hourglass-half',
    pill: 'bg-amber-50 text-amber-700 border-amber-300',
    dot: 'bg-amber-400',
    glow: 'shadow-amber-200',
    bg: 'bg-amber-400',
    description: 'وصل طلبك للنظام بنجاح وهو بانتظار مراجعة المسؤول للتحقق من البيانات وتأكيد الدفع. لم يُتخذ أي إجراء تنفيذي بعد.',
    step: 1,
  },
  in_progress: {
    label: 'قيد التنفيذ',
    icon: 'fa-cogs',
    pill: 'bg-sky-50 text-sky-700 border-sky-300',
    dot: 'bg-sky-400',
    glow: 'shadow-sky-200',
    bg: 'bg-sky-500',
    description: 'تم قبول طلبك والفريق بدأ فعلياً في العمل عليه. الخدمة جارية ولم يتم تجاهل طلبك.',
    step: 2,
  },
  completed: {
    label: 'مكتمل',
    icon: 'fa-flag-checkered',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    dot: 'bg-emerald-500',
    glow: 'shadow-emerald-200',
    bg: 'bg-emerald-500',
    description: 'تم تقديم الخدمة بالكامل وإغلاق ملف الطلب بنجاح. لا يمكن إجراء تعديلات إضافية على هذا الطلب.',
    step: 3,
  },
  cancelled: {
    label: 'ملغى',
    icon: 'fa-ban',
    pill: 'bg-red-50 text-red-600 border-red-300',
    dot: 'bg-red-400',
    glow: 'shadow-red-200',
    bg: 'bg-red-400',
    description: 'توقف هذا الطلب ولم يعد فعالاً. قد يكون بسبب طلب الإلغاء، عدم توفر المنتج، أو رفض عملية الدفع.',
    step: 4,
  },
  // للتوافق مع البيانات القديمة
  approved: {
    label: 'قيد التنفيذ',
    icon: 'fa-cogs',
    pill: 'bg-sky-50 text-sky-700 border-sky-300',
    dot: 'bg-sky-400',
    glow: 'shadow-sky-200',
    bg: 'bg-sky-500',
    description: 'تم قبول طلبك والفريق بدأ فعلياً في العمل عليه.',
    step: 2,
  },
  rejected: {
    label: 'ملغى',
    icon: 'fa-ban',
    pill: 'bg-red-50 text-red-600 border-red-300',
    dot: 'bg-red-400',
    glow: 'shadow-red-200',
    bg: 'bg-red-400',
    description: 'تم رفض هذا الطلب من قبل الإدارة.',
    step: 4,
  },
};

// الحالات التي يمكن للموظف تغييرها — الأربعة الرسمية فقط
const EMP_STATUSES = [
  { v: 'pending_review', label: 'قيد المراجعة' },
  { v: 'in_progress',   label: 'قيد التنفيذ'  },
  { v: 'completed',     label: 'مكتمل'        },
  { v: 'cancelled',     label: 'ملغى'         },
];

// ─── Date Helpers (توقيت محلي) ────────────────────────────────────────────────
const toLocal     = (d: string) => { const v=new Date(d); return new Date(v.getFullYear(),v.getMonth(),v.getDate()); };
const isToday     = (d: string) => { const v=toLocal(d),n=new Date(); return v.getFullYear()===n.getFullYear()&&v.getMonth()===n.getMonth()&&v.getDate()===n.getDate(); };
const isThisWeek  = (d: string) => { const v=toLocal(d),n=new Date(),s=new Date(n.getFullYear(),n.getMonth(),n.getDate()-n.getDay()); return v>=s; };
const isThisMonth = (d: string) => { const v=toLocal(d),n=new Date(); return v.getFullYear()===n.getFullYear()&&v.getMonth()===n.getMonth(); };
const applyDate   = (d: string, f: DateFilter) => f==='all'?true:f==='today'?isToday(d):f==='week'?isThisWeek(d):isThisMonth(d);
const fmtDate     = (d: string) => new Date(d).toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'});

// ─── Status Badge مع Tooltip ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const [show, setShow] = useState(false);
  const s = STATUS_CFG[status] ?? STATUS_CFG.pending_review;

  return (
    <div className="relative inline-flex items-center" dir="rtl">
      {/* Badge — يفتح الـ tooltip عند hover أو tap */}
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow(v => !v)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold border shadow-sm cursor-pointer select-none transition-all ${s.pill} ${s.glow}`}
      >
        {/* النقطة النابضة */}
        <span className="relative flex-shrink-0 w-2.5 h-2.5">
          <span className={`absolute inset-0 rounded-full ${s.dot} animate-ping opacity-60`} />
          <span className={`relative block w-2.5 h-2.5 rounded-full ${s.dot}`} />
        </span>
        <i className={`fas ${s.icon} text-xs`} />
        {s.label}
      </button>

      {/* Tooltip */}
      {show && (
        <div
          className="absolute z-50 bottom-full mb-2 right-0 w-64 rounded-xl border shadow-xl text-right"
          style={{
            background: 'white',
            borderColor: '#e2e8f0',
            animation: 'fadeInUp 0.15s ease',
          }}
        >
          {/* رأس الـ tooltip بلون الحالة */}
          <div className={`${s.bg} rounded-t-xl px-3.5 py-2.5 flex items-center gap-2`}>
            <i className={`fas ${s.icon} text-white text-xs`} />
            <span className="text-white font-extrabold text-xs">{s.label}</span>
            <span className="text-white/70 text-[10px] mr-auto">المرحلة {s.step} / 3</span>
          </div>

          {/* محتوى الـ tooltip */}
          <div className="px-3.5 py-3">
            {/* شريط التقدم */}
            <div className="flex gap-1 mb-3">
              {[1, 2, 3].map(i => (
                <div key={i} className={`flex-1 h-1 rounded-full transition-all ${
                  i <= (s.step === 4 ? 0 : s.step)
                    ? s.bg
                    : 'bg-slate-100'
                }`} />
              ))}
            </div>
            <p className="text-slate-600 text-[11px] leading-relaxed">{s.description}</p>
          </div>

          {/* مثلث الـ tooltip */}
          <div className="absolute top-full right-4 w-0 h-0"
            style={{
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid #e2e8f0',
            }}
          />
          <div className="absolute top-full right-4 w-0 h-0 mt-[-1px]"
            style={{
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid white',
              marginRight: '1px',
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>
  );
}


// ─── Status Cards للموظف (بديل الجدول العادي) ────────────────────────────────
function StatusLegend({ isDark }: { isDark: boolean }) {
  const statuses = [
    { key: 'pending_review', ...STATUS_CFG.pending_review },
    { key: 'in_progress',   ...STATUS_CFG.in_progress    },
    { key: 'completed',     ...STATUS_CFG.completed      },
    { key: 'cancelled',     ...STATUS_CFG.cancelled      },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      {statuses.map(s => (
        <div key={s.key}
          className={`rounded-xl border px-3 py-2.5 flex items-start gap-2.5 transition-all
            ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-100 shadow-sm'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0 shadow-sm ${s.bg}`}>
            <i className={`fas ${s.icon} text-xs`} />
          </div>
          <div>
            <div className={`text-xs font-extrabold ${isDark ? 'text-white' : 'text-slate-700'}`}>{s.label}</div>
            <div className={`text-[10px] mt-0.5 leading-tight ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
              {s.key === 'pending_review' && 'بانتظار الموافقة'}
              {s.key === 'in_progress'   && 'العمل جارٍ الآن'}
              {s.key === 'completed'     && 'تم بنجاح'}
              {s.key === 'cancelled'     && 'لن يكتمل'}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Contract Cell ────────────────────────────────────────────────────────────
function ContractCell({ requestId, contractUrl, onRefresh, showToast, role = 'admin' }:
  { requestId: string; contractUrl?: string; onRefresh: () => void; showToast: (m: string, t?: any) => void; role?: Role }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('الملف أكبر من 10MB', 'error'); return; }
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop();
      const path = `contracts/${requestId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('contracts').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(path);
      const { error: dbErr } = await supabase.from('service_requests')
        .update({ contract_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      if (dbErr) throw dbErr;
      showToast('تم رفع العقد بنجاح ✓');
      onRefresh();
    } catch (err: any) { showToast('خطأ في الرفع: ' + (err.message || ''), 'error'); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const remove = async () => {
    if (!confirm('هل تريد حذف العقد الحالي؟')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('service_requests')
        .update({ contract_url: null, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      if (error) throw error;
      showToast('تم حذف العقد');
      onRefresh();
    } catch (err: any) { showToast('خطأ في الحذف: ' + (err.message || ''), 'error'); }
    finally { setDeleting(false); }
  };

  if (role === 'client') {
    return (
      <div className="min-w-[90px]">
        {contractUrl ? (
          <a href={contractUrl} target="_blank" rel="noopener noreferrer" title="عرض العقد"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold
              bg-emerald-50 text-emerald-600 border border-emerald-200
              hover:bg-emerald-600 hover:text-white transition-all">
            <i className="fas fa-eye text-[11px]" /> عرض العقد
          </a>
        ) : (
          <span className="text-[11px] text-slate-400 italic">لا يوجد عقد بعد</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-[110px]">
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden"
        onChange={upload} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} />
      {contractUrl ? (
        <>
          <a href={contractUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold
              bg-emerald-50 text-emerald-600 border border-emerald-200
              hover:bg-emerald-600 hover:text-white transition-all">
            <i className="fas fa-eye text-[10px]" /> عرض العقد
          </a>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold
              bg-sky-50 text-sky-600 border border-sky-200
              hover:bg-sky-600 hover:text-white transition-all disabled:opacity-50 disabled:cursor-wait">
            {uploading
              ? <><i className="fas fa-spinner fa-spin text-[10px]" /> جاري الرفع...</>
              : <><i className="fas fa-arrow-up-from-bracket text-[10px]" /> استبدال</>}
          </button>
          <button onClick={remove} disabled={deleting}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold
              bg-red-50 text-red-500 border border-red-200
              hover:bg-red-500 hover:text-white transition-all disabled:opacity-50">
            {deleting ? <i className="fas fa-spinner fa-spin text-[10px]" /> : <i className="fas fa-trash text-[10px]" />}
            حذف العقد
          </button>
        </>
      ) : (
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold border-2 border-dashed transition-all
            ${uploading
              ? 'border-cyan-300 text-cyan-400 cursor-wait'
              : 'border-slate-300 text-slate-400 hover:border-cyan-500 hover:text-cyan-600 hover:bg-cyan-50'}`}>
          {uploading
            ? <><i className="fas fa-spinner fa-spin text-[10px]" /> جاري الرفع...</>
            : <><i className="fas fa-cloud-upload-alt text-[10px]" /> رفع عقد</>}
        </button>
      )}
    </div>
  );
}

// ─── Assign Dropdown ──────────────────────────────────────────────────────────
function AssignDropdown({ requestId, currentAssigned, onRefresh, showToast, isDark }:
  { requestId: string; currentAssigned?: string; onRefresh: () => void; showToast: (m: string, t?: any) => void; isDark: boolean }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [selected,  setSelected]  = useState(currentAssigned || '');
  const [open,      setOpen]      = useState(false);
  const [pos,       setPos]       = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top - 4, right: window.innerWidth - r.right });
    }
    if (employees.length) { setOpen(true); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from('employees')
        .select('employee_id, employee_name').eq('is_active', true);
      setEmployees(data || []);
      setOpen(true);
    } finally { setLoading(false); }
  }, [employees.length]);

  const assign = async (empId: string) => {
    if (!empId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('service_requests')
        .update({ assigned_to: empId, employee_id: empId, updated_at: new Date().toISOString() })
        .eq('request_id', requestId);
      if (error) throw error;
      setSelected(empId);
      setOpen(false);
      showToast('تم الإسناد بنجاح ✓');
      onRefresh();
    } catch (err: any) { showToast('خطأ: '+(err.message||''),'error'); }
    finally { setSaving(false); }
  };

  const empName = employees.find(e => e.employee_id === selected)?.employee_name;

  return (
    <div className="relative">
      <button ref={btnRef} onClick={load} disabled={loading || saving}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all min-w-[130px] justify-between
          ${selected
            ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
            : (isDark ? 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100')}`}>
        <span className="flex items-center gap-1.5">
          {loading || saving
            ? <i className="fas fa-spinner fa-spin text-[10px]" />
            : <i className="fas fa-user-tie text-[10px]" />}
          {empName || 'اختر موظف'}
        </span>
        <i className="fas fa-chevron-down text-[9px] opacity-60" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`fixed z-50 rounded-xl border shadow-xl overflow-hidden min-w-[180px]
              ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
            style={{ top: pos.top, right: pos.right, transform: 'translateY(-100%)' }}
          >
            {employees.length === 0 ? (
              <div className={`px-4 py-3 text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>لا يوجد موظفون</div>
            ) : employees.map(emp => (
              <button key={emp.employee_id} onClick={() => assign(emp.employee_id)}
                className={`w-full text-right px-4 py-2.5 text-xs font-semibold transition-colors flex items-center gap-2
                  ${selected === emp.employee_id
                    ? 'bg-sky-600 text-white'
                    : (isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}`}>
                <i className="fas fa-user-circle text-[11px] opacity-60" />
                {emp.employee_name}
                {selected === emp.employee_id && <i className="fas fa-check mr-auto text-[10px]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Employee Status Dropdown (مبهج بصرياً) ────────────────────────────────────
function StatusDropdown({ requestId, currentStatus, onRefresh, showToast, isDark }:
  { requestId: string; currentStatus: string; onRefresh: () => void; showToast: (m: string, t?: any) => void; isDark: boolean }) {
  const [saving, setSaving] = useState(false);
  const [open,   setOpen]   = useState(false);
  const [pos,    setPos]    = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const change = async (val: string) => {
    if (val === currentStatus) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      const { error } = await supabase.from('service_requests')
        .update({ request_status: val, updated_at: new Date().toISOString() }).eq('request_id', requestId);
      if (error) throw error;
      showToast('تم تحديث الحالة ✓');
      onRefresh();
    } catch (err: any) { showToast('خطأ: '+(err.message||''),'error'); }
    finally { setSaving(false); }
  };

  const handleOpen = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.top - 4, right: window.innerWidth - r.right });
    }
    setOpen(v => !v);
  };

  const s = STATUS_CFG[currentStatus] ?? STATUS_CFG.pending_review;

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-400">
        <i className="fas fa-spinner fa-spin" /> يحفظ...
      </span>
    );
  }

  return (
    <div className="relative">
      <button ref={btnRef} onClick={handleOpen}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border shadow-sm cursor-pointer
          hover:opacity-80 transition-all ${s.pill}`}>
        <span className="relative flex-shrink-0 w-1.5 h-1.5">
          <span className={`absolute inset-0 rounded-full ${s.dot} animate-ping opacity-50`} />
          <span className={`relative block w-1.5 h-1.5 rounded-full ${s.dot}`} />
        </span>
        <i className={`fas ${s.icon} text-[10px]`} />
        {s.label}
        <i className="fas fa-pen text-[8px] opacity-50 mr-0.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className={`fixed z-50 rounded-2xl border shadow-2xl overflow-hidden min-w-[200px] p-1.5
              ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}
            style={{ top: pos.top, right: pos.right, transform: 'translateY(-100%)' }}
          >
            <div className={`px-3 py-2 text-[10px] font-bold uppercase tracking-widest mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              تغيير الحالة
            </div>
            {EMP_STATUSES.map(opt => {
              const cfg = STATUS_CFG[opt.v];
              const isActive = currentStatus === opt.v;
              return (
                <button key={opt.v} onClick={() => change(opt.v)}
                  className={`w-full text-right px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 mb-0.5
                    ${isActive
                      ? `${cfg.bg} text-white shadow-sm`
                      : (isDark ? 'text-slate-200 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-50')}`}>
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0
                    ${isActive ? 'bg-white/20' : cfg.bg + ' text-white'}`}>
                    <i className={`fas ${cfg.icon} text-[10px]`} />
                  </span>
                  {opt.label}
                  {isActive && <i className="fas fa-check mr-auto text-[10px]" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════
export default function RequestsTable({
  role, requests, loading = false, isDarkMode = false, onRefresh, showToast: _showToast,
}: RequestsTableProps) {

  const showToast = _showToast ?? ((m: string) => console.log(m));
  const refresh   = onRefresh  ?? (() => {});

  // ── Filters ────────────────────────────────────────────────────────────
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatus]     = useState('all');
  const [dateFilter,   setDate]       = useState<DateFilter>('all');

  // ── فلترة الطلبات للموظف: يرى فقط الطلبات المسندة له (assigned_to) ────────
  // ملاحظة: التصفية تتم في loadEmpRequests بـ .eq('assigned_to', userId)
  // لكن هنا نضيف فلتر إضافي للتأكد من عرض الحالات الأربع الرسمية فقط للموظف
  const visibleRequests = useMemo(() => {
    if (role === 'employee') {
      // الموظف يرى فقط الحالات الأربع الرسمية
      return requests.filter(r =>
        ['pending_review', 'in_progress', 'completed', 'cancelled'].includes(r.request_status)
      );
    }
    return requests;
  }, [requests, role]);

  // ── Filtered Data ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleRequests.filter(r => {
      const matchStatus = statusFilter === 'all' || r.request_status === statusFilter;
      const matchDate   = applyDate(r.created_at, dateFilter);
      let   matchSearch = true;
      if (q) {
        const inAssociation = r.user?.association_name?.toLowerCase().includes(q);
        const inPhone       = r.user?.user_phone?.toLowerCase().includes(q);
        const inId          = r.request_id?.toLowerCase().includes(q);
        const srvData = Array.isArray(r.services) ? r.services[0] : r.services;
        const inService = srvData?.service_name?.toLowerCase().includes(q) || false;
        if      (searchField === 'association') matchSearch = !!inAssociation;
        else if (searchField === 'phone')       matchSearch = !!inPhone;
        else if (searchField === 'request_id')  matchSearch = !!inId;
        else if (searchField === 'service')     matchSearch = !!inService;
        else matchSearch = !!(inAssociation || inPhone || inId || inService);
      }
      return matchStatus && matchDate && matchSearch;
    });
  }, [visibleRequests, searchQuery, searchField, statusFilter, dateFilter]);

  // ── Stats للحالات الأربع ──────────────────────────────────────────────
  const stats = useMemo(() => ({
    total:          visibleRequests.length,
    pending_review: visibleRequests.filter(r => r.request_status === 'pending_review').length,
    in_progress:    visibleRequests.filter(r => ['in_progress','approved'].includes(r.request_status)).length,
    completed:      visibleRequests.filter(r => r.request_status === 'completed').length,
    cancelled:      visibleRequests.filter(r => ['cancelled','rejected'].includes(r.request_status)).length,
  }), [visibleRequests]);

  const hasFilters = searchQuery || statusFilter !== 'all' || dateFilter !== 'all';
  const clearAll   = () => { setSearchQuery(''); setStatus('all'); setDate('all'); setSearchField('all'); };

  // ── Styles ─────────────────────────────────────────────────────────────
  const dk     = isDarkMode;
  const card   = dk ? 'bg-slate-800/80 border-slate-700'   : 'bg-white border-slate-200/80';
  const text   = dk ? 'text-slate-100'                     : 'text-slate-800';
  const muted  = dk ? 'text-slate-400'                     : 'text-slate-500';
  const divider= dk ? 'border-slate-700'                   : 'border-slate-100';
  const inputC = dk
    ? 'bg-slate-700/80 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-cyan-900/30'
    : 'bg-slate-50 border-slate-200 text-slate-700 placeholder-slate-400 focus:border-cyan-400 focus:ring-cyan-100';

  // ── الأعمدة حسب الدور ─────────────────────────────────────────────────
  const cols = {
    admin:    ['#', 'رقم الطلب', 'اسم الجمعية', 'نوع الخدمة', 'الحالة', 'إسناد الموظف', 'العقد', 'التاريخ'],
    employee: ['#', 'رقم الطلب', 'اسم الجمعية', 'جوال التواصل', 'نوع الخدمة', 'الحالة', 'العقد', 'التاريخ'],
    client:   ['#', 'رقم الطلب', 'نوع الخدمة', 'الموظف المسؤول', 'جوال الموظف', 'الحالة', 'العقد', 'التاريخ'],
  }[role];

  return (
    <div className="space-y-4 font-tajawal" dir="rtl">

      {/* ── دليل الحالات (للموظف والعميل) ────────────────────────────────── */}
      {(role === 'employee' || role === 'client') && (
        <StatusLegend isDark={dk} />
      )}

      {/* ── Stats Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: 'إجمالي الطلبات',
            val: stats.total,
            icon: 'fa-layer-group',
            from: 'from-slate-600', to: 'to-slate-500',
            filter: 'all',
          },
          {
            label: 'قيد المراجعة',
            val: stats.pending_review,
            icon: 'fa-hourglass-half',
            from: 'from-amber-500', to: 'to-amber-400',
            filter: 'pending_review',
          },
          {
            label: 'قيد التنفيذ',
            val: stats.in_progress,
            icon: 'fa-cogs',
            from: 'from-sky-600', to: 'to-sky-400',
            filter: 'in_progress',
          },
          {
            label: 'مكتملة',
            val: stats.completed,
            icon: 'fa-flag-checkered',
            from: 'from-emerald-600', to: 'to-emerald-400',
            filter: 'completed',
          },
        ].map(s => {
          const isActive = statusFilter === s.filter;
          return (
            <button key={s.label}
              onClick={() => setStatus(isActive ? 'all' : s.filter)}
              style={{ outline: 'none' }}
              className={`relative overflow-hidden rounded-2xl border-2 p-4 shadow-sm text-right transition-colors
                ${isActive
                  ? (dk ? `bg-slate-700/80 border-transparent` : `bg-white border-transparent`)
                  : (dk ? 'bg-slate-800/80 border-slate-700 hover:border-slate-500' : 'bg-white border-slate-200 hover:border-slate-300')
                }`}>
              {/* شريط اللون الجانبي */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-none rounded-r-2xl bg-gradient-to-b ${s.from} ${s.to}`} />
              {/* خلفية شفافة عند التفعيل */}
              {isActive && (
                <div className={`absolute inset-0 bg-gradient-to-br ${s.from} ${s.to} opacity-10 pointer-events-none`} />
              )}
              <div className="flex items-center gap-3 pr-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.from} ${s.to} text-white text-sm shadow-sm flex-shrink-0
                  ${isActive ? 'scale-110 shadow-md' : ''} transition-transform`}>
                  <i className={`fas ${s.icon}`} />
                </div>
                <div>
                  <div className={`text-2xl font-black tabular-nums ${text}`}>{s.val}</div>
                  <div className={`text-[11px] mt-0.5 ${muted}`}>{s.label}</div>
                </div>
              </div>
              {/* نقطة نابضة عند التفعيل */}
              {isActive && (
                <div className={`absolute top-2.5 left-3 w-2 h-2 rounded-full bg-gradient-to-br ${s.from} ${s.to} animate-pulse`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────────── */}
      <div className={`rounded-2xl border shadow-sm p-4 space-y-3 ${card}`}>

        {/* صف البحث */}
        {role !== 'client' && (
          <div className="flex flex-col sm:flex-row gap-2">
            {/* أزرار حقل البحث */}
            <div className={`flex items-center rounded-xl overflow-hidden border divide-x divide-x-reverse text-xs font-bold flex-shrink-0
              ${dk ? 'border-slate-600 divide-slate-600' : 'border-slate-200 divide-slate-200'}`}>
              {([
                { v: 'all',        icon: 'fa-search',   label: 'الكل'    },
                { v: 'association',icon: 'fa-building', label: 'الجمعية' },
                { v: 'phone',      icon: 'fa-phone',    label: 'الجوال'  },
                { v: 'request_id', icon: 'fa-hashtag',  label: 'الرقم'   },
                { v: 'service',    icon: 'fa-wrench',   label: 'الخدمة'  },
              ] as { v: SearchField; icon: string; label: string }[]).map(f => (
                <button key={f.v} onClick={() => setSearchField(f.v)}
                  className={`flex items-center gap-1 px-3 py-2 transition-colors whitespace-nowrap
                    ${searchField === f.v
                      ? 'bg-cyan-600 text-white'
                      : (dk ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-slate-200' : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
                  <i className={`fas ${f.icon} text-[10px]`} />
                  <span className="hidden sm:inline">{f.label}</span>
                </button>
              ))}
            </div>

            <div className="relative flex-1">
              <i className={`fas fa-search absolute right-3.5 top-1/2 -translate-y-1/2 text-xs ${muted}`} />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                placeholder={
                  searchField === 'association' ? 'ابحث باسم الجمعية...' :
                  searchField === 'phone'       ? 'ابحث برقم الجوال...' :
                  searchField === 'request_id'  ? 'ابحث برقم الطلب...' :
                  searchField === 'service'     ? 'ابحث بنوع الخدمة...' :
                  'ابحث في كل الحقول...'
                }
                className={`w-full pr-10 pl-10 py-2 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 ${inputC}`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs hover:text-red-400 transition-colors ${muted}`}>
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* صف الفلاتر — الحالات الأربع الرسمية */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 flex-wrap">
            {[
              { v: 'all',            label: 'الكل',          count: stats.total,          dot: 'bg-slate-400',   active: 'bg-slate-600 text-white border-slate-600 shadow-slate-200/60'   },
              { v: 'pending_review', label: 'قيد المراجعة',  count: stats.pending_review, dot: 'bg-amber-400',   active: 'bg-amber-500 text-white border-amber-500 shadow-amber-200/60'   },
              { v: 'in_progress',    label: 'قيد التنفيذ',   count: stats.in_progress,    dot: 'bg-sky-400',     active: 'bg-sky-500 text-white border-sky-500 shadow-sky-200/60'         },
              { v: 'completed',      label: 'مكتملة',         count: stats.completed,      dot: 'bg-emerald-400', active: 'bg-emerald-500 text-white border-emerald-500 shadow-emerald-200/60' },
              { v: 'cancelled',      label: 'ملغاة',          count: stats.cancelled,      dot: 'bg-red-400',     active: 'bg-red-500 text-white border-red-400 shadow-red-200/60'         },
            ].map(f => {
              const isActive = statusFilter === f.v;
              return (
                <button key={f.v} onClick={() => setStatus(f.v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all shadow-sm
                    ${isActive
                      ? `${f.active} shadow-sm`
                      : (dk ? 'bg-slate-700/60 text-slate-400 border-slate-600 hover:border-slate-400 hover:text-slate-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700')}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? 'bg-white/80' : f.dot}`} />
                  {f.label}
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full
                    ${isActive ? 'bg-white/25 text-white' : (dk ? 'bg-slate-600 text-slate-300' : 'bg-slate-100 text-slate-500')}`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* فاصل */}
          <div className={`w-px h-6 ${dk ? 'bg-slate-600' : 'bg-slate-200'}`} />

          {/* فلتر التاريخ */}
          <div className={`flex items-center rounded-xl p-0.5 gap-0.5 ${dk ? 'bg-slate-700' : 'bg-slate-100'}`}>
            {([
              { v: 'all',   l: 'الكل',      color: 'bg-slate-600 text-white' },
              { v: 'today', l: 'اليوم',     color: 'bg-cyan-600 text-white'  },
              { v: 'week',  l: 'الأسبوع',  color: 'bg-violet-600 text-white' },
              { v: 'month', l: 'الشهر',    color: 'bg-indigo-600 text-white' },
            ] as { v: DateFilter; l: string; color: string }[]).map(o => (
              <button key={o.v} onClick={() => setDate(o.v)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all
                  ${dateFilter === o.v
                    ? `${o.color} shadow-sm`
                    : (dk ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}>
                {o.l}
              </button>
            ))}
          </div>

          {/* مسح الكل */}
          {hasFilters && (
            <button onClick={clearAll}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-red-400 border border-red-200 hover:bg-red-50 transition-all mr-auto">
              <i className="fas fa-times text-[9px]" /> مسح
            </button>
          )}

          <span className={`text-[11px] mr-auto font-semibold ${muted}`}>
            {filtered.length} نتيجة
          </span>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${card}`}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">

            <thead>
              <tr className={dk ? 'bg-slate-700' : 'bg-gradient-to-l from-slate-700 via-slate-700 to-slate-600'}>
                {cols.map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-right text-[11px] font-bold text-white/85 whitespace-nowrap tracking-wide
                    ${i === 0 ? 'rounded-tr-2xl w-10' : ''} ${i === cols.length-1 ? 'rounded-tl-2xl' : ''}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr><td colSpan={cols.length} className="text-center py-20">
                  <i className="fas fa-spinner fa-spin text-3xl text-cyan-400 block mb-2" />
                  <span className={`text-sm ${muted}`}>جاري التحميل...</span>
                </td></tr>
              ) : visibleRequests.length === 0 ? (
                <tr><td colSpan={cols.length} className="text-center py-20">
                  <i className="fas fa-inbox text-5xl block mb-3 opacity-20 text-slate-300" />
                  <p className={`text-sm font-semibold ${muted}`}>
                    {role === 'employee' ? 'لا توجد مهام مسندة لك حالياً' : 'لا توجد طلبات'}
                  </p>
                </td></tr>
              ) : filtered.length === 0 && hasFilters ? (
                <tr><td colSpan={cols.length} className="text-center py-20">
                  <i className="fas fa-search text-5xl block mb-3 opacity-20 text-slate-300" />
                  <p className={`text-sm font-semibold ${muted}`}>لا توجد نتائج تطابق البحث</p>
                  <button onClick={clearAll} className="mt-2 text-xs text-cyan-500 hover:underline">مسح الفلاتر</button>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={cols.length} className="text-center py-20">
                  <i className="fas fa-inbox text-5xl block mb-3 opacity-20 text-slate-300" />
                  <p className={`text-sm font-semibold ${muted}`}>لا توجد طلبات</p>
                </td></tr>
              ) : filtered.map((r, idx) => {
                const isEven = idx % 2 === 0;
                const rowBg = dk
                  ? `border-slate-700/60 hover:bg-slate-700/40 ${!isEven ? 'bg-slate-800/30' : ''}`
                  : `border-slate-100 hover:bg-cyan-50/30 ${!isEven ? 'bg-slate-50/50' : ''}`;

                const employee = (r as any).employee || (Array.isArray((r as any).employees) ? (r as any).employees[0] : (r as any).employees);
                const service  = (r as any).service  || (Array.isArray((r as any).services)  ? (r as any).services[0]  : (r as any).services);
                const adminService  = (r as any).services  && !Array.isArray((r as any).services)  ? (r as any).services  : service;
                const adminEmployee = (r as any).employees && !Array.isArray((r as any).employees) ? (r as any).employees : employee;

                return (
                  <tr key={r.request_id} className={`border-b transition-colors ${rowBg}`}>

                    {/* # */}
                    <td className={`px-4 py-3 text-center text-[11px] font-bold ${muted}`}>{idx+1}</td>

                    {/* رقم الطلب */}
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-cyan-500">
                        #{r.request_id?.substring(0,8).toUpperCase() ?? '—'}
                      </span>
                    </td>

                    {/* ─── Admin Columns ─── */}
                    {role === 'admin' && <>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-bold ${text}`}>{r.user?.association_name || '—'}</div>
                        <div className={`text-[11px] ${muted}`}>{r.user?.user_email || ''}</div>
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${text}`}>
                        {adminService?.service_name || service?.service_name || (r.services as any)?.service_name || '—'}
                      </td>
                      {/* الحالة مع dropdown للأدمن والموظف */}
                      <td className="px-4 py-3">
                        {role === 'admin' ? (
                          <StatusDropdown
                            requestId={r.request_id}
                            currentStatus={r.request_status}
                            onRefresh={refresh}
                            showToast={showToast}
                            isDark={dk}
                          />
                        ) : (
                          <StatusBadge status={r.request_status} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AssignDropdown requestId={r.request_id} currentAssigned={r.assigned_to}
                          onRefresh={refresh} showToast={showToast} isDark={dk} />
                      </td>
                      <td className="px-4 py-3">
                        <ContractCell requestId={r.request_id} contractUrl={r.contract_url}
                          onRefresh={refresh} showToast={showToast} role="admin" />
                      </td>
                      <td className={`px-4 py-3 text-xs ${muted} whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                    </>}

                    {/* ─── Employee Columns ─── */}
                    {role === 'employee' && <>
                      <td className="px-4 py-3">
                        <div className={`text-sm font-bold ${text}`}>{r.user?.association_name || '—'}</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.user?.user_phone ? (
                          <a href={`tel:${r.user.user_phone}`}
                            className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
                            <i className="fas fa-phone text-[10px]" />{r.user.user_phone}
                          </a>
                        ) : <span className={`text-xs ${muted}`}>—</span>}
                      </td>
                      <td className={`px-4 py-3 text-sm font-semibold ${text}`}>
                        {service?.service_name || (r.services as any)?.service_name || '—'}
                      </td>
                      {/* الحالة مع dropdown للموظف */}
                      <td className="px-4 py-3">
                        <StatusDropdown
                          requestId={r.request_id}
                          currentStatus={r.request_status}
                          onRefresh={refresh}
                          showToast={showToast}
                          isDark={dk}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <ContractCell requestId={r.request_id} contractUrl={r.contract_url}
                          onRefresh={refresh} showToast={showToast} role="employee" />
                      </td>
                      <td className={`px-4 py-3 text-xs ${muted} whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                    </>}

                    {/* ─── Client Columns ─── */}
                    {role === 'client' && <>
                      <td className={`px-4 py-3 text-sm font-semibold ${text}`}>
                        {service?.service_name || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {employee?.employee_name ? (
                          <span className={`flex items-center gap-1.5 text-sm font-semibold ${dk ? 'text-sky-400' : 'text-sky-700'}`}>
                            <i className="fas fa-user-tie text-[10px]" />{employee.employee_name}
                          </span>
                        ) : (
                          <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${dk ? 'bg-slate-700 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                            لم يُسند بعد
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.assigned_to && employee?.employee_phone ? (
                          <a href={`tel:${employee.employee_phone}`}
                            className="flex items-center gap-1 text-xs font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
                            <i className="fas fa-phone text-[10px]" />{employee.employee_phone}
                          </a>
                        ) : <span className={`text-xs ${muted}`}>—</span>}
                      </td>
                      {/* الحالة مع tooltip للعميل (عرض فقط) */}
                      <td className="px-4 py-3"><StatusBadge status={r.request_status} /></td>
                      <td className="px-4 py-3">
                        <ContractCell requestId={r.request_id} contractUrl={r.contract_url}
                          onRefresh={refresh} showToast={showToast} role="client" />
                      </td>
                      <td className={`px-4 py-3 text-xs ${muted} whitespace-nowrap`}>{fmtDate(r.created_at)}</td>
                    </>}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div className={`px-5 py-2.5 border-t flex items-center justify-between ${divider} ${dk ? 'bg-slate-800/40' : 'bg-slate-50/60'}`}>
            <span className={`text-[11px] font-semibold ${muted}`}>
              عرض <span className={`font-extrabold ${text}`}>{filtered.length}</span> من أصل {visibleRequests.length} طلب
            </span>
            <span className={`text-[11px] ${muted}`}>
              <i className="fas fa-clock text-[9px] ml-1 opacity-60" />
              {new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}