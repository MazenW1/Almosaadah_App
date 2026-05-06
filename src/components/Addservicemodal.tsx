import { useState } from 'react';
import { createService, updateService } from '../lib/supabase';
import type { ServiceFull, ServiceSection } from '../lib/supabase';

// ── نوع داخلي: قسم مع معرف UUID فريد مضمون ──────────────────────────────────
type SectionWithId = ServiceSection & { _sid: string };

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toSectionsWithId(sections: ServiceSection[]): SectionWithId[] {
  return sections.map(s => ({
    ...s,
    items: Array.isArray(s.items) ? [...s.items] : [],
    _sid: uid(),
  }));
}

function stripSid(sections: SectionWithId[]): ServiceSection[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return sections.map(({ _sid, ...rest }) => rest);
}

function initSections(initialData?: ServiceFull): SectionWithId[] {
  if (initialData?.sections && initialData.sections.length > 0) {
    return toSectionsWithId(initialData.sections);
  }
  return [{ label: 'الهدف', value: '', icon: 'fa-bullseye', color: '#0891b2', items: [], _sid: uid() }];
}

// ── قائمة الأيقونات الكاملة ─────────────────────────────────────────────────
const ICON_GROUPS: { label: string; icons: string[] }[] = [
  {
    label: 'إدارة وأعمال',
    icons: [
      'fa-chart-line','fa-chart-bar','fa-chart-pie','fa-briefcase','fa-building',
      'fa-landmark','fa-sitemap','fa-tasks','fa-clipboard-list','fa-file-alt',
      'fa-file-contract','fa-file-signature','fa-folder-open','fa-inbox',
      'fa-calendar-check','fa-user-tie','fa-users','fa-user-shield',
    ],
  },
  {
    label: 'مالي وتمويل',
    icons: [
      'fa-hand-holding-usd','fa-hand-holding-heart','fa-donate','fa-coins',
      'fa-money-bill-wave','fa-percentage','fa-balance-scale','fa-piggy-bank',
      'fa-tag','fa-receipt','fa-calculator','fa-cash-register',
    ],
  },
  {
    label: 'مشاريع وتنمية',
    icons: [
      'fa-project-diagram','fa-handshake','fa-globe','fa-compass',
      'fa-map-marked-alt','fa-road','fa-seedling','fa-tree',
      'fa-leaf','fa-hands-helping','fa-heart','fa-star',
    ],
  },
  {
    label: 'تقنية وأمان',
    icons: [
      'fa-shield-alt','fa-lock','fa-key','fa-cogs','fa-tools',
      'fa-laptop-code','fa-database','fa-server','fa-wifi',
      'fa-satellite','fa-robot','fa-lightbulb',
    ],
  },
  {
    label: 'تعليم وإنجاز',
    icons: [
      'fa-graduation-cap','fa-book','fa-book-open','fa-certificate',
      'fa-medal','fa-trophy','fa-crown','fa-award','fa-flag',
      'fa-rocket','fa-bullseye','fa-check-double',
    ],
  },
  {
    label: 'تنبيه وملاحظات',
    icons: [
      'fa-exclamation-triangle','fa-info-circle','fa-bell','fa-gift',
      'fa-thumbs-up','fa-check-circle','fa-times-circle','fa-question-circle',
      'fa-comment-dots','fa-envelope','fa-paper-plane','fa-list-check',
    ],
  },
];

// ── قائمة الإيموجي ─────────────────────────────────────────────────────────────
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  { label: 'أرقام ورموز', emojis: ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟','🔢','🔑','🏷️','📌','📍','🔖'] },
  { label: 'نجاح وإنجاز', emojis: ['🚀','🎯','🏆','🥇','🎖️','🏅','⭐','🌟','💫','✨','🔥','💡','🎓','📜','🎗️','🎪'] },
  { label: 'مال وأعمال', emojis: ['💰','💵','💴','💶','💷','💳','📈','📊','🏦','🤝','💼','📋','🗂️','📂','🧾','💎'] },
  { label: 'بناء وتطوير', emojis: ['🏗️','🏢','🌱','🌿','🌳','🌍','🔧','⚙️','🛠️','🔩','🧱','🏛️','🏠','🔬','🧪','🪴'] },
  { label: 'تواصل ودعم', emojis: ['🤲','🙌','👏','🫱','🤜','💬','📣','📢','📞','📩','✉️','📬','🗣️','👥','🫂','❤️'] },
  { label: 'متنوع', emojis: ['🌈','⚡','💥','🎁','🎀','🎊','🎉','🧩','🔮','🪄','🌙','☀️','🌊','🍀','🦋','🎭'] },
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const allEmojis = EMOJI_GROUPS.flatMap(g => g.emojis);
  const filtered = search ? allEmojis.filter(e => e.includes(search)) : null;
  const btnStyle = (selected: boolean): React.CSSProperties => ({
    border: 'none', borderRadius: '8px', padding: '7px',
    cursor: 'pointer', fontSize: '1.2rem', transition: 'all .15s',
    background: selected ? '#c5a05922' : 'rgba(0,0,0,.03)',
    outline: selected ? '2px solid #c5a059' : 'none',
  });
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input aria-label="الإيموجي المختار" value={value} onChange={e => onChange(e.target.value)}
          style={{ ...inp, flex: 1 }} maxLength={8} placeholder="اكتب أو اختر..." />
        <button type="button" onClick={() => setOpen(o => !o)}
          style={{
            padding: '10px 14px', borderRadius: '10px',
            border: `1.5px solid ${open ? '#c5a059' : '#e2e8f0'}`,
            background: open ? '#c5a05915' : '#f8fafc',
            cursor: 'pointer', fontSize: '1.2rem', transition: 'all .2s',
          }} title="اختر من القائمة">
          {value || '😊'}
        </button>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
          background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px',
          padding: '12px', width: '320px', maxWidth: '90vw',
          boxShadow: '0 16px 48px rgba(0,0,0,.14)',
          maxHeight: '300px', overflowY: 'auto',
        }}>
          <input aria-label="بحث في الإيموجي" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1.5px solid #e2e8f0', marginBottom: '10px',
              fontFamily: 'Tajawal,sans-serif', fontSize: '.85rem',
              outline: 'none', boxSizing: 'border-box',
            }} />
          {filtered
            ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '4px' }}>
                {filtered.map((em, i) => (
                  <button key={i} type="button" style={btnStyle(value===em)}
                    onClick={() => { onChange(em); setOpen(false); setSearch(''); }}>{em}</button>
                ))}
              </div>
            : EMOJI_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '.7rem', fontWeight: 700, color: '#94a3b8', marginBottom: '6px', fontFamily: 'Tajawal,sans-serif' }}>
                  {group.label}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,1fr)', gap: '4px' }}>
                  {group.emojis.map((em, i) => (
                    <button key={i} type="button" style={btnStyle(value===em)}
                      onClick={() => { onChange(em); setOpen(false); }}>{em}</button>
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

// ── أيقونة بيكر ────────────────────────────────────────────────────────────────
function IconPicker({
  value, onChange, accentColor = '#0ea5e9', allowClear = false,
}: {
  value: string; onChange: (v: string) => void; accentColor?: string; allowClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const allIcons = ICON_GROUPS.flatMap(g => g.icons);
  const filtered = search
    ? allIcons.filter(ic => ic.includes(search.toLowerCase()))
    : null;

  return (
    <div style={{ position:'relative' }}>
      <div style={{ display:'flex', gap:'6px' }}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1, padding:'10px 14px', borderRadius:'10px',
            border:`1.5px solid ${open ? accentColor : '#e2e8f0'}`,
            display:'flex', alignItems:'center', gap:'10px',
            cursor:'pointer', background:'#f8fafc',
            fontFamily:'Tajawal,sans-serif', fontSize:'.9rem', color:'#0f172a',
            justifyContent:'space-between', transition:'border .2s',
          }}
        >
          <span>
            {value
              ? <><i className={`fas ${value}`} style={{ color:accentColor, marginLeft:'8px' }} />{value}</>
              : <span style={{ color:'#94a3b8' }}>اختر أيقونة</span>}
          </span>
          <i className={`fas fa-chevron-${open?'up':'down'}`} style={{ color:'#94a3b8', fontSize:'.75rem' }} />
        </button>

        {/* ── زر المسح: يظهر فقط إذا allowClear=true وفيه قيمة ── */}
        {allowClear && value && (
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            title="مسح الأيقونة"
            style={{
              padding:'10px 12px', borderRadius:'10px',
              border:'1.5px solid #fecaca',
              background:'#fef2f2', cursor:'pointer',
              color:'#dc2626', fontSize:'.85rem',
              transition:'all .2s', flexShrink: 0,
            }}
          >
            <i className="fas fa-times" />
          </button>
        )}
      </div>

      {open && (
        <div style={{
          position:'absolute', top:'calc(100% + 6px)', right:0, zIndex:200,
          background:'#fff', border:'1px solid #e2e8f0', borderRadius:'16px',
          padding:'12px', width:'340px', maxWidth:'90vw',
          boxShadow:'0 16px 48px rgba(0,0,0,.14)',
          maxHeight:'320px', overflowY:'auto',
        }}>
          <input
            aria-label="بحث في الأيقونات"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث..."
            style={{
              width:'100%', padding:'8px 12px', borderRadius:'8px',
              border:'1.5px solid #e2e8f0', marginBottom:'10px',
              fontFamily:'Tajawal,sans-serif', fontSize:'.85rem',
              outline:'none', boxSizing:'border-box',
            }}
          />

          {/* ── زر "بدون أيقونة" في الـ dropdown إذا allowClear ── */}
          {allowClear && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              style={{
                width:'100%', marginBottom:'10px', padding:'7px 12px',
                borderRadius:'8px', border:'1.5px dashed #e2e8f0',
                background: value==='' ? '#fee2e2' : '#f8fafc',
                color: value==='' ? '#dc2626' : '#94a3b8',
                cursor:'pointer', fontFamily:'Tajawal,sans-serif',
                fontSize:'.8rem', display:'flex', alignItems:'center', gap:'6px',
              }}
            >
              <i className="fas fa-ban" /> بدون أيقونة
            </button>
          )}

          {filtered
            ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'6px' }}>
                {filtered.map(ic => (
                  <IconBtn key={ic} ic={ic} selected={value===ic} accent={accentColor}
                    onSelect={v => { onChange(v); setOpen(false); setSearch(''); }} />
                ))}
              </div>
            )
            : ICON_GROUPS.map(group => (
              <div key={group.label} style={{ marginBottom:'12px' }}>
                <div style={{ fontSize:'.7rem', fontWeight:700, color:'#94a3b8', marginBottom:'6px', fontFamily:'Tajawal,sans-serif' }}>
                  {group.label}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:'6px' }}>
                  {group.icons.map(ic => (
                    <IconBtn key={ic} ic={ic} selected={value===ic} accent={accentColor}
                      onSelect={v => { onChange(v); setOpen(false); }} />
                  ))}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

function IconBtn({ ic, selected, accent, onSelect }: {
  ic: string; selected: boolean; accent: string; onSelect: (v: string) => void;
}) {
  return (
    <button
      type="button" title={ic}
      onClick={() => onSelect(ic)}
      style={{
        border:'none', borderRadius:'8px', padding:'8px', cursor:'pointer',
        fontSize:'1rem', transition:'all .15s',
        background: selected ? `${accent}22` : 'rgba(0,0,0,.03)',
        color: selected ? accent : '#475569',
        outline: selected ? `2px solid ${accent}` : 'none',
      }}
    >
      <i className={`fas ${ic}`} />
    </button>
  );
}

// ── حقل نصي مساعد ──────────────────────────────────────────────────────────────
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <span style={{ display:'block', fontWeight:700, fontSize:'.82rem', color:'#475569', marginBottom:'5px', fontFamily:'Tajawal,sans-serif' }}>
        {label}
      </span>
      {children}
      {hint && <p style={{ margin:'4px 0 0', fontSize:'.75rem', color:'#94a3b8', fontFamily:'Tajawal,sans-serif' }}>{hint}</p>}
    </div>
  );
}

const inp: React.CSSProperties = {
  width:'100%', padding:'10px 14px', borderRadius:'10px',
  border:'1.5px solid #e2e8f0', fontFamily:'Tajawal,sans-serif',
  fontSize:'.9rem', color:'#0f172a', outline:'none',
  background:'#fff', boxSizing:'border-box',
};

// ── AddServiceModal ─────────────────────────────────────────────────────────────
interface AddServiceModalProps {
  defaultCategory: 'خدمة' | 'منتج';
  onClose: () => void;
  onSaved: () => void;
  initialData?: ServiceFull;
}

export function AddServiceModal({ defaultCategory, onClose, onSaved, initialData }: AddServiceModalProps) {
  const isEditMode = !!initialData;

  // ── حقول أساسية
  const [serviceId,   setServiceId]   = useState(initialData?.service_id ?? '');
  const [name,        setName]        = useState(initialData?.service_name ?? '');
  const [category,    setCategory]    = useState<'خدمة'|'منتج'>((initialData?.category as 'خدمة'|'منتج') ?? defaultCategory);
  const [description, setDescription] = useState(initialData?.service_description ?? '');
  const [icon,        setIcon]        = useState<string>(initialData?.icon ?? 'fa-star');
  const [emoji,       setEmoji]       = useState<string>(initialData?.emoji ?? '');
  const [highlight,   setHighlight]   = useState(initialData?.highlight ?? false);
  const [sortOrder,   setSortOrder]   = useState(initialData?.sort_order ?? 0);

  // ── Badge
  const [badge,     setBadge]     = useState(initialData?.badge ?? '' as string);
  const [badgeIcon, setBadgeIcon] = useState(initialData?.badge_icon ?? '' as string);

  // ── أقسام مرنة — كل قسم له _sid ثابت لتجنب خلط المؤشرات في React
  const [sections, setSections] = useState<SectionWithId[]>(() => initSections(initialData));

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // ── handler الشارة: إذا امتحى النص تتصفر الأيقونة تلقائياً ──────────────
  const handleBadgeChange = (val: string) => {
    setBadge(val);
    if (!val.trim()) {
      setBadgeIcon('');
    }
  };

  // ── handlers الأقسام (تعمل بالـ _sid لا بالمؤشر) ──────────────────────────
  const addSection = () =>
    setSections(p => [...p, { label:'', value:'', icon:'fa-star', color:'#0891b2', items:[], _sid: uid() }]);

  const removeSection = (sid: string) =>
    setSections(p => p.filter(s => s._sid !== sid));

  const updateSection = (sid: string, key: keyof ServiceSection, val: any) =>
    setSections(p => p.map(s => s._sid === sid ? { ...s, [key]: val } : s));

  const addItem = (sid: string) =>
    setSections(p => p.map(s => {
      if (s._sid !== sid) return s;
      return { ...s, items: [...(Array.isArray(s.items) ? s.items : []), ''] };
    }));

  const updateItem = (sid: string, ii: number, val: string) =>
    setSections(p => p.map(s => {
      if (s._sid !== sid) return s;
      const items = Array.isArray(s.items) ? [...s.items] : [];
      items[ii] = val;
      return { ...s, items };
    }));

  const removeItem = (sid: string, ii: number) =>
    setSections(p => p.map(s => {
      if (s._sid !== sid) return s;
      const items = Array.isArray(s.items) ? s.items.filter((_, j) => j !== ii) : [];
      return { ...s, items };
    }));

  // ── حفظ
  const handleSave = async () => {
    if (!serviceId.trim()) { setError('الرمز (ID) مطلوب — مثال: S11 أو P09'); return; }
    if (!name.trim())      { setError('الاسم مطلوب'); return; }
    if (!description.trim()){ setError('الوصف مطلوب'); return; }
    setSaving(true); setError('');
    try {
      const cleanSections = stripSid(sections.filter(s => s.label.trim() && (s.value.trim() || (Array.isArray(s.items) && s.items.length > 0))));

      if (isEditMode) {
        // ✅ الإصلاح: نستخدم service_id الأصلي من قاعدة البيانات مباشرة
        // بدلاً من serviceId.trim().toUpperCase() الذي قد يُنتج قيمة مختلفة
        const originalId = initialData!.service_id;

        const editPayload: Record<string, any> = {
          service_name:        name.trim(),
          service_description: description.trim(),
          category,
          icon:       category === 'خدمة' ? icon  : undefined,
          emoji:      category === 'منتج' ? emoji : undefined,
          badge:      badge.trim() || undefined,
          badge_icon: badge.trim() ? (badgeIcon || undefined) : undefined,
          highlight,
          sort_order: sortOrder,
        };

        // الأقسام فقط للمنتجات
        if (category === 'منتج') {
          editPayload.sections = cleanSections.length ? cleanSections : undefined;
        }

        await updateService(originalId, editPayload);
      } else {
        const sid = serviceId.trim().toUpperCase();
        const payload = {
          service_id:          sid,
          service_name:        name.trim(),
          service_description: description.trim(),
          category,
          icon:       category === 'خدمة' ? icon  : undefined,
          emoji:      category === 'منتج' ? emoji : undefined,
          badge:      badge.trim() || undefined,
          badge_icon: badge.trim() ? (badgeIcon || undefined) : undefined,
          highlight,
          sort_order: sortOrder,
          sections:   cleanSections.length ? cleanSections : undefined,
          is_active:  true,
        };
        await createService(payload);
      }

      onSaved(); onClose();
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    finally { setSaving(false); }
  };

  const isService = category === 'خدمة';
  const accent = isService ? '#0ea5e9' : '#c5a059';

  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'rgba(0,0,0,.6)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'16px',
      }}
      onClick={e => e.target===e.currentTarget && onClose()}
    >
      <div style={{
        background:'#fff', borderRadius:'24px', padding:'32px',
        maxWidth:'680px', width:'100%', maxHeight:'92vh', overflowY:'auto',
        direction:'rtl', fontFamily:'Tajawal,sans-serif',
        boxShadow:'0 32px 80px rgba(0,0,0,.22)',
      }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
          <h2 style={{ margin:0, fontSize:'1.35rem', fontWeight:900, color:'#0f172a' }}>
            <i
              className={`fas ${isEditMode ? 'fa-edit' : 'fa-plus-circle'}`}
              style={{ color:accent, marginLeft:'8px' }}
            />
            {isEditMode ? `تعديل ${category}` : `إضافة ${category} جديد`}
          </h2>
          <button onClick={onClose} title="إغلاق"
            style={{ background:'none', border:'none', fontSize:'1.4rem', cursor:'pointer', color:'#94a3b8' }}>
            <i className="fas fa-times" />
          </button>
        </div>

        {isEditMode && (
          <div style={{
            background:`${accent}12`, border:`1px solid ${accent}40`,
            borderRadius:'10px', padding:'10px 14px', marginBottom:'16px',
            fontSize:'.85rem', color:accent, fontFamily:'Tajawal,sans-serif',
            display:'flex', alignItems:'center', gap:'8px',
          }}>
            <i className="fas fa-info-circle" />
            أنت في وضع التعديل — الرمز (ID) لا يمكن تغييره
          </div>
        )}

        {error && (
          <div style={{
            background:'#fee2e2', color:'#dc2626', padding:'10px 14px',
            borderRadius:'8px', marginBottom:'16px', fontSize:'.88rem',
          }}>
            <i className="fas fa-exclamation-circle" style={{ marginLeft:'6px' }} />{error}
          </div>
        )}

        <div style={{ display:'grid', gap:'16px' }}>

          {/* ── الصف الأول: ID + الاسم + النوع ── */}
          <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 130px', gap:'12px' }}>
            <Field label="الرمز (ID)" hint="مثال: S11 أو P09">
              <input
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                placeholder="S11"
                style={{ ...inp, background: isEditMode ? '#f1f5f9' : '#fff', color: isEditMode ? '#94a3b8' : '#0f172a' }}
                maxLength={10}
                disabled={isEditMode}
              />
            </Field>
            <Field label="الاسم">
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="اسم الخدمة أو المنتج" style={inp} />
            </Field>
            <Field label="النوع">
              <select
                aria-label="نوع الخدمة أو المنتج"
                value={category}
                onChange={e=>setCategory(e.target.value as 'خدمة'|'منتج')}
                style={{ ...inp, cursor:'pointer' }}
                disabled={isEditMode}
              >
                <option value="خدمة">خدمة</option>
                <option value="منتج">منتج</option>
              </select>
            </Field>
          </div>

          {/* ── الوصف ── */}
          <Field label="الوصف">
            <textarea value={description} onChange={e=>setDescription(e.target.value)}
              rows={3} placeholder="وصف مختصر واضح..." style={{ ...inp, resize:'vertical' }} />
          </Field>

          {/* ── الأيقونة (للخدمة) أو الإيموجي (للمنتج) + ترتيب الظهور ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 140px', gap:'12px' }}>
            {isService
              ? <Field label="أيقونة الخدمة">
                  <IconPicker value={icon} onChange={setIcon} accentColor={accent} />
                </Field>
              : <Field label="الإيموجي (للمنتج)" hint="مثال: 🚀 أو 1️⃣">
                  <EmojiPicker value={emoji} onChange={setEmoji} />
                </Field>
            }
            <Field label="ترتيب الظهور">
              <input type="number" aria-label="ترتيب الظهور" value={sortOrder} onChange={e=>setSortOrder(+e.target.value)}
                style={inp} min={0} />
            </Field>
          </div>

          {/* ── حقول المنتج فقط ── */}
          {!isService && (<>

            {/* Badge */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 180px', gap:'12px' }}>
              <Field label="الشارة (Badge) — اختياري" hint="تظهر أسفل العنوان بلون مميز">
                <input
                  value={badge}
                  onChange={e => handleBadgeChange(e.target.value)}
                  placeholder="مثال: منتج للحصول على دعم الصندوق"
                  style={inp}
                />
              </Field>
              {/* أيقونة الشارة — تظهر فقط إذا فيه نص في الشارة */}
              <Field label="أيقونة الشارة">
                {badge.trim() ? (
                  <IconPicker
                    value={badgeIcon}
                    onChange={setBadgeIcon}
                    accentColor={accent}
                    allowClear
                  />
                ) : (
                  <div style={{
                    ...inp, display:'flex', alignItems:'center',
                    color:'#cbd5e1', fontSize:'.82rem', background:'#f8fafc',
                    userSelect:'none', pointerEvents:'none',
                  }}>
                    أدخل نص الشارة أولاً
                  </div>
                )}
              </Field>
            </div>

            {/* تمييز */}
            <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', fontSize:'.9rem', color:'#475569' }}>
              <input type="checkbox" checked={highlight} onChange={e=>setHighlight(e.target.checked)}
                style={{ width:'18px', height:'18px', accentColor:accent }} />
              تمييز هذا المنتج (highlight — يضيف border مميزة)
            </label>

          </>)}

          {/* الأقسام المرنة — للمنتجات فقط */}
          {!isService && <div>
            <div style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              marginBottom:'10px', paddingBottom:'10px',
              borderBottom:'1.5px solid #f1f5f9',
            }}>
              <span style={{ fontWeight:800, fontSize:'.9rem', color:'#0f172a', fontFamily:'Tajawal,sans-serif' }}>
                <i className="fas fa-layer-group" style={{ color:accent, marginLeft:'6px' }} />
                الأقسام (الهدف، الملاحظات، المميزات…)
              </span>
              <button
                type="button" onClick={addSection}
                style={{
                  background:`${accent}15`, border:`1.5px solid ${accent}`,
                  borderRadius:'8px', padding:'6px 14px', cursor:'pointer',
                  color:accent, fontSize:'.8rem', fontWeight:700,
                  fontFamily:'Tajawal,sans-serif', display:'flex', gap:'6px', alignItems:'center',
                }}
              >
                <i className="fas fa-plus" /> إضافة قسم
              </button>
            </div>

            {sections.map((sec, si) => (
              <div key={sec._sid} style={{
                background:'#f8fafc', borderRadius:'12px', padding:'16px',
                marginBottom:'12px', border:'1px solid #e2e8f0',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                  <span style={{ fontSize:'.78rem', fontWeight:700, color:'#94a3b8', fontFamily:'Tajawal,sans-serif' }}>
                    القسم {si+1}
                  </span>
                  {sections.length > 1 && (
                    <button
                      type="button"
                      title="حذف القسم"
                      onClick={e => { e.stopPropagation(); removeSection(sec._sid); }}
                      style={{ background:'#fee2e2', border:'none', borderRadius:'6px', padding:'4px 10px', cursor:'pointer', color:'#dc2626', fontSize:'.8rem' }}
                    >
                      <i className="fas fa-trash-alt" />
                    </button>
                  )}
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                  <Field label="عنوان القسم">
                    <input value={sec.label} onChange={e=>updateSection(sec._sid,'label',e.target.value)}
                      placeholder="مثال: الهدف" style={inp} />
                  </Field>
                  <Field label="أيقونة القسم">
                    <IconPicker value={sec.icon||''} onChange={v=>updateSection(sec._sid,'icon',v)} accentColor={sec.color||'#0891b2'} />
                  </Field>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:'10px', marginBottom:'10px' }}>
                  <Field label="نص القسم">
                    <textarea value={sec.value} onChange={e=>updateSection(sec._sid,'value',e.target.value)}
                      rows={2} placeholder="نص القسم..." style={{ ...inp, resize:'vertical' }} />
                  </Field>
                  <Field label="اللون">
                    <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                      <input type="color" aria-label="لون القسم" value={sec.color||'#0891b2'} onChange={e=>updateSection(sec._sid,'color',e.target.value)}
                        style={{ width:'100%', height:'42px', borderRadius:'8px', border:'1.5px solid #e2e8f0', cursor:'pointer', padding:'2px' }} />
                      <input aria-label="قيمة لون القسم" value={sec.color||''} onChange={e=>updateSection(sec._sid,'color',e.target.value)}
                        style={{ ...inp, fontSize:'.78rem' }} maxLength={20} />
                    </div>
                  </Field>
                </div>

                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
                    <span style={{ fontSize:'.75rem', color:'#64748b', fontFamily:'Tajawal,sans-serif', fontWeight:700 }}>
                      بنود داخل القسم (اختياري)
                    </span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); addItem(sec._sid); }}
                      style={{
                        background:'transparent', border:`1px dashed ${sec.color||'#0ea5e9'}`,
                        borderRadius:'6px', padding:'3px 10px', cursor:'pointer',
                        color:sec.color||'#0ea5e9', fontSize:'.75rem',
                        fontFamily:'Tajawal,sans-serif',
                      }}
                    >
                      <i className="fas fa-plus" style={{ marginLeft:'4px' }} /> بند
                    </button>
                  </div>
                  {(sec.items||[]).map((item, ii) => (
                    <div key={`${sec._sid}-${ii}`} style={{ display:'flex', gap:'6px', marginBottom:'6px', alignItems:'center' }}>
                      <input value={item} onChange={e=>updateItem(sec._sid, ii, e.target.value)}
                        placeholder={`البند ${ii+1}`} style={{ ...inp, flex:1, fontSize:'.85rem' }} />
                      <button
                        type="button"
                        title="حذف البند"
                        onClick={e => { e.stopPropagation(); removeItem(sec._sid, ii); }}
                        style={{ background:'#fee2e2', border:'none', borderRadius:'6px', padding:'8px 10px', cursor:'pointer', color:'#dc2626' }}
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>}
        </div>

        {/* ── أزرار الحفظ والإلغاء ── */}
        <div style={{ display:'flex', gap:'12px', marginTop:'28px', justifyContent:'flex-end' }}>
          <button onClick={onClose}
            style={{
              padding:'11px 24px', borderRadius:'10px',
              border:'1px solid #e2e8f0', background:'#f8fafc',
              cursor:'pointer', fontFamily:'Tajawal,sans-serif',
              fontWeight:700, color:'#64748b',
            }}>
            إلغاء
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{
              padding:'11px 28px', borderRadius:'10px', border:'none',
              background: saving ? '#94a3b8' : `linear-gradient(135deg,${accent},${isService?'#0284c7':'#b8860b'})`,
              color:'#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily:'Tajawal,sans-serif', fontWeight:700, fontSize:'.95rem',
              display:'flex', alignItems:'center', gap:'8px',
            }}>
            {saving
              ? <><i className="fas fa-spinner fa-spin" />جاري الحفظ...</>
              : <><i className={`fas ${isEditMode ? 'fa-check' : 'fa-save'}`} />{isEditMode ? 'حفظ التعديلات' : `حفظ ${category}`}</>}
          </button>
        </div>
      </div>
    </div>
  );
}