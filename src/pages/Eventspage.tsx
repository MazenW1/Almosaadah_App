// pages/EventsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  notifyAdminNewEvent,
  notifyItemApproved,
  notifyItemRejected,
} from '../lib/notificationHelpers';

/* ─────────────────────────────────────────
   Security Helpers
───────────────────────────────────────── */
const sanitizeInput = (input: string): string => {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/[<>"'`]/g, c =>
      ({ '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '`': '&#x60;' }[c] ?? c)
    )
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/(['"])\s*(or|and)\s*\1\s*=\s*\1/gi, '')
    .replace(/;\s*(drop|delete|truncate|insert|update|select|exec|union)\s+/gi, '')
    .replace(/--\s*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .trim()
    .slice(0, 2000);
};

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254'];
const BLOCKED_DOMAINS = ['bit.ly', 'tinyurl.com', 't.co', 'goo.gl'];

const isValidUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (BLOCKED_HOSTS.some(h => parsed.hostname.includes(h))) return false;
    if (parsed.href.includes('javascript:') || parsed.href.includes('data:')) return false;
    return true;
  } catch { return false; }
};

const isAllowedRegistrationUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !BLOCKED_DOMAINS.some(d => host.includes(d));
  } catch { return false; }
};

const isValidSaudiPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(05\d{8}|5\d{8}|\+9665\d{8}|009665\d{8})$/.test(cleaned);
};

const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
};

const createRateLimiter = (maxRequests: number, windowMs: number, label = '') => {
  const requests: number[] = [];
  let blockedUntil = 0;
  return {
    canProceed: (): boolean => {
      const now = Date.now();
      if (now < blockedUntil) return false;
      while (requests.length > 0 && requests[0] < now - windowMs) requests.shift();
      if (requests.length >= maxRequests) {
        const penalty = Math.min(windowMs * (requests.length - maxRequests + 1), 300000);
        blockedUntil = now + penalty;
        if (label) console.warn(`[RateLimit] ${label} — blocked for ${penalty / 1000}s`);
        return false;
      }
      requests.push(now);
      return true;
    },
  };
};

const apiRateLimiter    = createRateLimiter(10, 60000,  'api-load');
const submitRateLimiter = createRateLimiter(3,  120000, 'submit-event');
const searchRateLimiter = createRateLimiter(30, 10000,  'search');

const LIMITS = {
  event_name: 100, organizer: 80, description: 500,
  location_detail: 150, contact_name: 80, contact_phone: 15,
  contact_email: 100, notes: 300, registration_link: 500,
} as const;

const safeOpenUrl = (url: string): void => {
  if (!isValidUrl(url)) return;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
};

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
interface Event {
  id: string;
  user_id: string; 
  association_name?: string;
  event_name: string;
  organizer: string;
  description: string;
  event_type: 'توعوية' | 'تطوعية' | 'تدريبية' | 'ترفيهية' | 'أخرى';
  city: string; 
  location_detail: string; 
  event_date: string;
  start_time: string; 
  end_time: string; 
  is_recurring: boolean;
  volunteers_needed: number; 
  volunteer_tasks: string[];
  target_group: 'طلاب' | 'مختصين' | 'الجميع';
  has_training: boolean; 

  volunteer_duration: 'ساعات' | 'يوم كامل' | 'أيام متعددة';
  has_reward: boolean; 
  has_meals: boolean; 
  has_transport: boolean;
  required_equipment?: string; 
  contact_name: string; 
  contact_phone: string;
  contact_email: string; 
  registration_method: 'رابط' | 'نموذج' | 'مباشر';
  registration_link?: string; 
  is_public: boolean; 
  registration_deadline: string;
  notes?: string; 
  is_active: boolean; 
  status: 'new' | 'completed' | 'cancelled';
  proof_url?: string;
  proof_file_name?: string;
  pending_status: 'pending_proof' | 'pending_admin' | 'approved';
  created_at: string;
  user?: { association_name: string };
}
const EVENT_TYPES: Record<string, { label: string; icon: string; color: string; bg: string; darkBg: string }> = {
  'توعوية':    { label: 'توعوية',    icon: '💡', color: '#0891b2', bg: '#e0f2fe',  darkBg: 'rgba(8,145,178,0.18)'   },
  'تطوعية':    { label: 'تطوعية',    icon: '🤝', color: '#16a34a', bg: '#dcfce7',  darkBg: 'rgba(22,163,74,0.18)'   },
  'تدريبية':   { label: 'تدريبية',   icon: '📚', color: '#7c3aed', bg: '#f3e8ff',  darkBg: 'rgba(124,58,237,0.18)'  },
  'ترفيهية':   { label: 'ترفيهية',   icon: '🎉', color: '#ea580c', bg: '#ffedd5',  darkBg: 'rgba(234,88,12,0.18)'   },
  'أخرى':      { label: 'أخرى',      icon: '📌', color: '#64748b', bg: '#f1f5f9',  darkBg: 'rgba(100,116,139,0.18)' },
};

const EVENT_STATUS_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; darkBg: string; dot: string }> = {
  new:       { label: 'جديدة',   icon: '🆕', color: '#0891b2', bg: '#e0f2fe', darkBg: 'rgba(8,145,178,0.18)',   dot: '#06b6d4' },
  completed: { label: 'مكتملة',  icon: '✅', color: '#15803d', bg: '#dcfce7', darkBg: 'rgba(22,163,74,0.18)',   dot: '#22c55e' },
  cancelled: { label: 'ملغية',   icon: '❌', color: '#dc2626', bg: '#fee2e2', darkBg: 'rgba(220,38,38,0.18)',   dot: '#ef4444' },
};

const TASK_OPTIONS = [
  { value: 'تسجيل', label: 'تسجيل' },
  { value: 'تنظيم', label: 'تنظيم' },
  { value: 'إعلام', label: 'إعلام' },
  { value: 'لوجستي', label: 'لوجستي' },
  { value: 'أخرى', label: 'أخرى' },
];

const SAUDI_CITIES = [
  'الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الظهران','الطائف','تبوك',
  'بريدة','خميس مشيط','الهفوف','المبرز','حائل','نجران','الجبيل','ينبع','القطيف','عرعر',
  'سكاكا','جازان','أبها','الباحة','بيشة','الدوادمي','الخرج','المجمعة','الزلفي','شقراء',
];

const INITIAL_FORM = {
  event_name: '', organizer: '', description: '',
  event_type: 'تطوعية' as Event['event_type'], // تم التغيير من volunteer
  city: '', location_detail: '', event_date: '', start_time: '', end_time: '',
  is_recurring: false, volunteers_needed: 10, volunteer_tasks: [] as string[],
  target_group: 'الجميع' as Event['target_group'], // تم التغيير من all
  has_training: false,
  volunteer_duration: 'ساعات' as Event['volunteer_duration'], // تم التغيير من hours
  has_reward: false, has_meals: false, has_transport: false,
  required_equipment: '', contact_name: '', contact_phone: '', contact_email: '',
  registration_method: 'مباشر' as Event['registration_method'], // تم التغيير من direct
  registration_link: '', is_public: true, registration_deadline: '', notes: '',
  proof_url: '',
};

/* ─────────────────────────────────────────
   Hook: useDarkMode — uses localStorage to avoid flicker
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   CSS Variables as a static <style> block
   (replaces the useEffect approach that caused flicker)
───────────────────────────────────────── */
const GLOBAL_STYLE = `

/* ── Modal open: lock scroll without layout shift ── */
body.modal-open { overflow: hidden !important; }
@supports (scrollbar-gutter: stable) {
  body.modal-open { scrollbar-gutter: stable; overflow: hidden !important; }
}
/* Compensate sticky headers for scrollbar width */
/* overlays fill full viewport — no padding compensation needed */
body.modal-open { padding-right: 0 !important; }
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');

/* ── Keyframes ── */
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:translateY(0)} }
@keyframes cardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:translateY(0) scale(1)} }
@keyframes spin      { to{transform:rotate(360deg)} }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } } 100%{background-position:200% 0} }
@keyframes iconBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } } 50%{transform:translateY(-8px) scale(1.1)} }
@keyframes pulseDot { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } } 50%{opacity:0.4} }
@keyframes evModalIn { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:scale(1) translateY(0)} }
@keyframes aeqIn { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:scale(1) translateY(0)} }
@keyframes aeqCardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:translateY(0)} }
@keyframes detailIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } } to{opacity:1;transform:scale(1) translateY(0)} }
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}

/* ── Light Mode Variables ── */
:root {
  --ev-hero-icon-bg:      linear-gradient(135deg,#e0f2fe,#bae6fd);
  --ev-hero-icon-shadow:  0 8px 32px rgba(8,145,178,0.2);
  --ev-title-color:       #0f172a;
  --ev-sub-color:         #64748b;
  --ev-badge-bg:          rgba(8,145,178,0.08);
  --ev-badge-border:      rgba(8,145,178,0.2);
  --ev-lbl-color:         #94a3b8;
  --ev-search-border:     #e2e8f0;
  --ev-search-bg:         rgba(255,255,255,0.9);
  --ev-search-color:      #0f172a;
  --ev-search-icon:       #94a3b8;
  --ev-filter-border:     #e2e8f0;
  --ev-filter-bg:         rgba(255,255,255,0.85);
  --ev-filter-color:      #475569;
  --ev-card-border:       #e2e8f0;
  --ev-card-bg:           rgba(255,255,255,0.98);
  --ev-card-shadow:       0 2px 16px rgba(0,0,0,0.06);
  --ev-card-title:        #0f172a;
  --ev-info-item-bg:      #f8fafc;
  --ev-info-lbl:          #94a3b8;
  --ev-info-val:          #0f172a;
  --ev-org-border:        #f1f5f9;
  --ev-org-name:          #64748b;
  --ev-desc-color:        #64748b;
  --ev-tag-bg:            #f1f5f9;
  --ev-tag-color:         #475569;
  --ev-tag-border:        #e2e8f0;
  --ev-footer-border:     #f0f4f8;
  --ev-empty-text:        #94a3b8;
  --ev-skel-bg:           linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
  --ev-pending-bg:        rgba(234,179,8,0.1);
  --ev-pending-color:     #a16207;
  --ev-modal-bg:          #ffffff;
  --ev-modal-border:      #e2e8f0;
  --ev-modal-shadow:      0 32px 80px rgba(0,0,0,0.18);
  --ev-input-bg:          #f8fafc;
  --ev-input-border:      #e2e8f0;
  --ev-input-color:       #0f172a;
  --ev-input-placeholder: #94a3b8;
  --ev-toggle-row-bg:     #f8fafc;
  --ev-toggle-row-border: #e2e8f0;
  --ev-toggle-label:      #374151;
  --ev-chip-border:       #e2e8f0;
  --ev-chip-color:        #475569;
  --ev-field-label:       #475569;
  --ev-char-count:        #94a3b8;
  --ev-aeq-bg:            #ffffff;
  --ev-aeq-border:        #e2e8f0;
  --ev-aeq-card-bg:       #fafafa;
  --ev-aeq-card-border:   #e2e8f0;
  --ev-aeq-name:          #0f172a;
  --ev-aeq-shimmer:       linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
  --ev-pill-bg:            #f1f5f9;
  --ev-pill-border:        #e2e8f0;
  --ev-pill-color:         #374151;
  --ev-more-bg:            #f8fafc;
  --ev-more-border:        #e2e8f0;
  --ev-more-color:         #475569;
  --ev-detail-lbl:         #64748b;
  --ev-detail-val:         #0f172a;
}

/* ── Dark Mode Variables ── */
.dark {
  --ev-hero-icon-bg:      linear-gradient(135deg,#1e3a5f,#0891b2);
  --ev-hero-icon-shadow:  0 8px 32px rgba(8,145,178,0.4);
  --ev-title-color:       #f1f5f9;
  --ev-sub-color:         #94a3b8;
  --ev-badge-bg:          rgba(8,145,178,0.12);
  --ev-badge-border:      rgba(8,145,178,0.3);
  --ev-lbl-color:         #64748b;
  --ev-search-border:     #334155;
  --ev-search-bg:         rgba(30,41,59,0.9);
  --ev-search-color:      #f1f5f9;
  --ev-search-icon:       #475569;
  --ev-filter-border:     #334155;
  --ev-filter-bg:         rgba(30,41,59,0.8);
  --ev-filter-color:      #94a3b8;
  --ev-card-border:       rgba(51,65,85,0.7);
  --ev-card-bg:           rgba(22,31,48,0.97);
  --ev-card-shadow:       0 2px 20px rgba(0,0,0,0.25);
  --ev-card-title:        #f1f5f9;
  --ev-info-item-bg:      rgba(30,41,59,0.8);
  --ev-info-lbl:          #64748b;
  --ev-info-val:          #e2e8f0;
  --ev-org-border:        rgba(51,65,85,0.5);
  --ev-org-name:          #94a3b8;
  --ev-desc-color:        #94a3b8;
  --ev-tag-bg:            rgba(51,65,85,0.6);
  --ev-tag-color:         #cbd5e1;
  --ev-tag-border:        rgba(71,85,105,0.5);
  --ev-footer-border:     rgba(51,65,85,0.5);
  --ev-empty-text:        #475569;
  --ev-skel-bg:           linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);
  --ev-pending-bg:        rgba(234,179,8,0.08);
  --ev-pending-color:     #fbbf24;
  --ev-modal-bg:          #111827;
  --ev-modal-border:      rgba(51,65,85,0.8);
  --ev-modal-shadow:      0 32px 80px rgba(0,0,0,0.5);
  --ev-input-bg:          #1e293b;
  --ev-input-border:      #334155;
  --ev-input-color:       #f1f5f9;
  --ev-input-placeholder: #475569;
  --ev-toggle-row-bg:     #1e293b;
  --ev-toggle-row-border: #334155;
  --ev-toggle-label:      #cbd5e1;
  --ev-chip-border:       #334155;
  --ev-chip-color:        #94a3b8;
  --ev-field-label:       #94a3b8;
  --ev-char-count:        #475569;
  --ev-aeq-bg:            #111827;
  --ev-aeq-border:        rgba(51,65,85,0.8);
  --ev-aeq-card-bg:       rgba(15,23,42,0.7);
  --ev-aeq-card-border:   #334155;
  --ev-aeq-name:          #f1f5f9;
  --ev-aeq-shimmer:       linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);
  --ev-pill-bg:            rgba(51,65,85,0.55);
  --ev-pill-border:        rgba(71,85,105,0.4);
  --ev-pill-color:         #cbd5e1;
  --ev-more-bg:            rgba(30,41,59,0.8);
  --ev-more-border:        #334155;
  --ev-more-color:         #94a3b8;
  --ev-detail-lbl:         #64748b;
  --ev-detail-val:         #e2e8f0;
}

/* ══════════════════════════════════════════
   HERO
══════════════════════════════════════════ */
.ev-hero{padding:100px 24px 40px;position:relative;z-index:10;animation:fadeUp .7s ease both;}
.ev-hero-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:32px;flex-wrap:wrap;}
.ev-hero-text{flex:1;min-width:240px;}
.ev-hero-icon{width:72px;height:72px;border-radius:22px;background:var(--ev-hero-icon-bg);display:flex;align-items:center;justify-content:center;font-size:32px;box-shadow:var(--ev-hero-icon-shadow);margin-bottom:16px;animation:iconBounce 3s ease-in-out infinite;}
.ev-hero-title{font-size:clamp(22px,4vw,36px);font-weight:900;color:var(--ev-title-color);margin:0 0 8px;}
.ev-hero-sub{font-size:14px;color:var(--ev-sub-color);margin:0;line-height:1.6;}
.ev-total-badge{padding:14px 24px;border-radius:18px;background:var(--ev-badge-bg);border:1px solid var(--ev-badge-border);text-align:center;backdrop-filter:blur(12px);flex-shrink:0;}
.ev-total-num{font-size:36px;font-weight:900;color:#0891b2;line-height:1;}
.ev-total-lbl{font-size:12px;font-weight:700;color:var(--ev-lbl-color);margin-top:4px;}

/* ══════════════════════════════════════════
   AUTH BANNER / PENDING
══════════════════════════════════════════ */
.ev-auth-banner{max-width:1200px;margin:0 auto;padding:0 24px 12px;position:relative;z-index:10;}
.ev-auth-box{border-radius:14px;padding:13px 18px;display:flex;align-items:center;gap:12px;font-size:13px;font-weight:600;cursor:pointer;transition:background .2s;background:rgba(8,145,178,.07);border:1px solid rgba(8,145,178,.25);color:#0891b2;}
.ev-auth-box:hover{background:rgba(8,145,178,.12);}
.ev-auth-link{font-weight:800;text-decoration:underline;margin-right:auto;}
.ev-pending-notice{max-width:1200px;margin:0 auto;padding:0 24px 16px;position:relative;z-index:10;}
.ev-pending-box{background:var(--ev-pending-bg);border:1px solid rgba(234,179,8,0.3);border-radius:12px;padding:12px 16px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;color:var(--ev-pending-color);}

/* ══════════════════════════════════════════
   CONTROLS & FILTERS
══════════════════════════════════════════ */
.ev-controls{max-width:1200px;margin:0 auto;padding:0 24px 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;position:relative;z-index:10;}
.ev-search-wrap{flex:1;min-width:200px;position:relative;}
.ev-search-input{width:100%;padding:12px 20px 12px 44px;border-radius:14px;border:1.5px solid var(--ev-search-border);background:var(--ev-search-bg);color:var(--ev-search-color);font-family:'Tajawal',sans-serif;font-size:14px;outline:none;transition:border-color .2s,background .2s,color .2s;backdrop-filter:blur(12px);box-sizing:border-box;}
.ev-search-input::placeholder{color:var(--ev-input-placeholder);}
.ev-search-input:focus{border-color:#0891b2;box-shadow:0 0 0 3px rgba(8,145,178,0.12);}
.ev-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--ev-search-icon);pointer-events:none;}
.ev-filters{max-width:1200px;margin:0 auto;padding:0 24px 28px;display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:10;}
.ev-filter-btn{display:flex;align-items:center;gap:7px;padding:9px 16px;border-radius:50px;border:1.5px solid var(--ev-filter-border);background:var(--ev-filter-bg);color:var(--ev-filter-color);font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .2s;backdrop-filter:blur(8px);}
.ev-filter-btn:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,0.08);}
.ev-filter-btn.active{color:white;border-color:transparent;box-shadow:0 4px 14px rgba(0,0,0,0.15);transform:translateY(-1px);}
.ev-type-count{font-size:11px;font-weight:800;padding:1px 7px;border-radius:10px;background:rgba(255,255,255,0.25);}

/* ══════════════════════════════════════════
   GRID
══════════════════════════════════════════ */
.ev-grid{max-width:1200px;margin:0 auto;padding:0 16px 100px;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;position:relative;z-index:10;}

/* ══════════════════════════════════════════
   CARD
══════════════════════════════════════════ */
.ev-card{
  border-radius:22px;
  border:1.5px solid var(--ev-card-border);
  background:var(--ev-card-bg);
  box-shadow:var(--ev-card-shadow);
  backdrop-filter:blur(16px);
  overflow:hidden;
  transition:transform .3s cubic-bezier(.22,.68,0,1.2),box-shadow .3s,border-color .2s;
  animation:cardIn .5s ease both;
  position:relative;
  cursor:pointer;
  display:flex;
  flex-direction:column;
}
.ev-card:hover{transform:translateY(-6px) scale(1.012);box-shadow:0 20px 55px rgba(0,0,0,0.12);border-color:rgba(8,145,178,0.4);}
.ev-card:active{transform:translateY(-3px) scale(1.006);}
.ev-card-head{padding:18px 18px 14px;position:relative;overflow:hidden;flex-shrink:0;}
.ev-card-head-content{position:relative;z-index:1;display:flex;align-items:flex-start;gap:14px;}
.ev-card-icon-wrap{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;box-shadow:0 4px 14px rgba(0,0,0,0.1);transition:transform .3s;}
.ev-card:hover .ev-card-icon-wrap{transform:rotate(-6deg) scale(1.12);}
.ev-card-title-wrap{flex:1;min-width:0;}
.ev-card-title{font-size:15px;font-weight:900;color:var(--ev-card-title);margin:0 0 5px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ev-card-type-badge{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:800;padding:3px 10px;border-radius:20px;}

/* Org row */
.ev-card-org{display:flex;align-items:center;gap:8px;padding:8px 18px 10px;border-top:1px solid var(--ev-org-border);flex-shrink:0;}
.ev-org-dot{width:7px;height:7px;border-radius:50%;animation:pulseDot 2s ease-in-out infinite;flex-shrink:0;}
.ev-org-name{font-size:12px;font-weight:700;color:var(--ev-org-name);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

/* Card body */
.ev-card-body{padding:0 18px 14px;flex:1;display:flex;flex-direction:column;gap:0;}
.ev-card-desc{font-size:12.5px;color:var(--ev-desc-color);line-height:1.65;margin:10px 0 12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}

/* Pills — بيانات الكارد بشكل واضح */
.ev-card-pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.ev-pill{
  display:inline-flex;
  align-items:center;
  gap:5px;
  font-size:12px;
  font-weight:700;
  padding:5px 10px;
  border-radius:8px;
  background:var(--ev-pill-bg);
  border:1px solid var(--ev-pill-border);
  color:var(--ev-pill-color);
  line-height:1;
  white-space:nowrap;
}
.ev-pill-icon{font-size:12px;line-height:1;}

/* Tags */
.ev-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;}
.ev-tag{
  font-size:11.5px;
  font-weight:700;
  padding:4px 10px;
  border-radius:8px;
  background:var(--ev-tag-bg);
  color:var(--ev-tag-color);
  border:1px solid var(--ev-tag-border);
  white-space:nowrap;
}

/* Footer */
.ev-card-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:10px 18px 14px;
  border-top:1px solid var(--ev-footer-border);
  margin-top:auto;
  flex-shrink:0;
}
.ev-volunteers-badge{display:flex;align-items:center;gap:6px;background:rgba(8,145,178,0.09);color:#0891b2;padding:6px 12px;border-radius:10px;font-size:12px;font-weight:800;border:1px solid rgba(8,145,178,0.18);}
.ev-detail-hint{font-size:11px;font-weight:700;color:#0891b2;opacity:.75;display:flex;align-items:center;gap:4px;}

/* Badges */
.ev-recurring-tag{position:absolute;top:14px;left:14px;font-size:10px;background:rgba(124,58,237,0.15);color:#7c3aed;padding:3px 8px;border-radius:6px;font-weight:800;border:1px solid rgba(124,58,237,0.2);z-index:2;}
.ev-days-badge{position:absolute;font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;z-index:2;}
.ev-new-badge{font-size:10px;font-weight:800;padding:2px 7px;border-radius:6px;background:rgba(8,145,178,0.15);color:#0891b2;}

/* ── More Details Button (زر المزيد) ── */
.ev-more-btn{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  width:100%;
  padding:9px 14px;
  border-radius:10px;
  border:1.5px solid var(--ev-more-border);
  background:var(--ev-more-bg);
  color:var(--ev-more-color);
  font-family:'Tajawal',sans-serif;
  font-size:13px;
  font-weight:700;
  cursor:pointer;
  margin-bottom:4px;
  transition:all .2s;
}
.ev-more-btn:hover{border-color:#0891b2;color:#0891b2;background:rgba(8,145,178,0.06);}

/* Empty / skeleton */
.ev-empty{grid-column:1/-1;text-align:center;padding:60px 16px;color:var(--ev-empty-text);}
.ev-empty-icon{font-size:52px;margin-bottom:14px;}
.ev-skel{border-radius:22px;height:280px;background:var(--ev-skel-bg);background-size:200% 100%;animation:shimmer 1.3s infinite;}

/* FABs */
.ev-fab{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#0891b2,#0284c7);color:white;border:none;cursor:pointer;border-radius:50px;padding:14px 26px;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;box-shadow:0 8px 30px rgba(8,145,178,.45);transition:all .3s cubic-bezier(0.34,1.56,0.64,1);z-index:40;}
.ev-fab:hover{transform:translateX(-50%) translateY(-3px) scale(1.03);}
.ev-admin-fab{position:fixed;bottom:32px;left:32px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(124,58,237,0.45);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);z-index:50;}
.ev-admin-fab:hover{transform:scale(1.12) rotate(10deg);}

/* ══════════════════════════════════════════
   NAV TABS
══════════════════════════════════════════ */
.ev-nav{max-width:1200px;margin:16px auto 0;padding:0 24px;display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:10;}
.ev-nav-tab{padding:10px 20px;border-radius:12px;border:none;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:800;transition:all .2s;}
.ev-nav-tab.active{background:#0891b2;color:white;box-shadow:0 4px 16px rgba(8,145,178,.35);}
.ev-nav-tab:not(.active){background:var(--ev-modal-bg);color:var(--ev-sub-color);border:1px solid var(--ev-input-border);}
.ev-nav-tab:not(.active):hover{border-color:#0891b2;color:#0891b2;}

/* ══════════════════════════════════════════
   MY EVENTS
══════════════════════════════════════════ */
.ev-my-wrap{max-width:760px;margin:28px auto;padding:0 16px 100px;position:relative;z-index:10;}
.ev-my-card{border-radius:18px;overflow:hidden;margin-bottom:14px;animation:cardIn .35s ease both;backdrop-filter:blur(12px);background:var(--ev-card-bg);border:1.5px solid var(--ev-card-border);}
.ev-my-card-header{padding:14px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-bottom:1px solid var(--ev-footer-border);}
.ev-my-card-body{padding:12px 18px;}
.ev-my-title{font-weight:800;font-size:15px;color:var(--ev-card-title);margin:0 0 4px;}
.ev-my-sub{font-size:12px;color:var(--ev-sub-color);margin:0;}
.ev-status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;white-space:nowrap;border:1px solid transparent;}

/* ══════════════════════════════════════════
   PROOF BANNER (My Events)
══════════════════════════════════════════ */
.ev-proof-required{background:rgba(234,179,8,.08);border:1.5px solid rgba(234,179,8,.3);border-radius:14px;padding:14px 18px;margin-bottom:14px;}
.ev-proof-title{font-size:14px;font-weight:800;color:#d97706;margin:0 0 4px;display:flex;align-items:center;gap:7px;}
.ev-proof-text{font-size:12px;color:#92400e;line-height:1.6;margin:0 0 12px;}
.dark .ev-proof-text{color:#fbbf24;}
.ev-proof-upload-btn{padding:9px 18px;border-radius:10px;border:1.5px solid #d97706;cursor:pointer;background:rgba(234,179,8,.1);color:#d97706;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:800;transition:all .2s;display:flex;align-items:center;gap:7px;width:fit-content;}
.ev-proof-upload-btn:hover{background:rgba(234,179,8,.18);}

/* ══════════════════════════════════════════
   FORM MODAL
══════════════════════════════════════════ */
.ev-governance-box{border-radius:14px;padding:14px 16px;margin-bottom:16px;background:linear-gradient(135deg,rgba(234,179,8,.08),rgba(234,88,12,.05));border:1.5px solid rgba(234,179,8,.3);}
.ev-gov-title{font-size:13px;font-weight:800;color:#d97706;margin:0 0 8px;display:flex;align-items:center;gap:8px;}
.ev-gov-steps{margin:0;padding:0;list-style:none;}
.ev-gov-step{font-size:12px;color:#92400e;padding:4px 0;display:flex;align-items:flex-start;gap:8px;line-height:1.5;}
.dark .ev-gov-step{color:#fbbf24;}
.ev-gov-step span{flex-shrink:0;margin-top:1px;}
.ev-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.ev-backdrop{position:absolute;inset:0;background:rgba(2,10,20,0.72);backdrop-filter:blur(8px);}
.ev-modal{position:relative;width:100%;max-width:680px;max-height:min(92vh,calc(100dvh - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px) - 24px));border-radius:20px;background:var(--ev-modal-bg);border:1px solid var(--ev-modal-border);box-shadow:var(--ev-modal-shadow);display:flex;flex-direction:column;overflow:hidden;animation:evModalIn .3s cubic-bezier(.22,.68,0,1.2) both;}
.ev-modal-header{padding:20px 20px 16px;background:linear-gradient(135deg,#0c1a2e,#0f2d4a);flex-shrink:0;position:relative;}
.ev-modal-title{font-size:18px;font-weight:900;color:white;margin:0 0 4px;}
.ev-modal-sub{font-size:12px;color:#94a3b8;margin:0;}
.ev-modal-close{position:absolute;top:14px;left:14px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.1);border:none;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s;}
.ev-modal-close:hover{background:rgba(239,68,68,0.2);color:#fca5a5;}
.ev-modal-body{flex:1;overflow-y:auto;padding:20px;}
.ev-modal-body::-webkit-scrollbar{width:4px;}
.ev-modal-body::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}

/* Form fields */
.ev-section-lbl{font-size:11px;font-weight:800;letter-spacing:0.08em;color:#0891b2;text-transform:uppercase;margin:0 0 14px;display:flex;align-items:center;gap:6px;}
.ev-section-lbl::after{content:'';flex:1;height:1px;background:var(--ev-input-border);}
.ev-field{margin-bottom:14px;}
.ev-label{display:block;font-size:13px;font-weight:700;color:var(--ev-field-label);margin-bottom:6px;}
.ev-required{color:#ef4444;margin-right:3px;}
.ev-input,.ev-select,.ev-textarea{width:100%;padding:10px 14px;border-radius:10px;font-size:14px;font-family:'Tajawal',sans-serif;font-weight:500;background:var(--ev-input-bg);border:1.5px solid var(--ev-input-border);color:var(--ev-input-color);transition:border-color .2s,background .2s,color .2s;outline:none;box-sizing:border-box;}
.ev-input::placeholder,.ev-textarea::placeholder{color:var(--ev-input-placeholder);}
.ev-select option{background:var(--ev-modal-bg);color:var(--ev-input-color);}
.ev-input:focus,.ev-select:focus,.ev-textarea:focus{border-color:#0891b2;box-shadow:0 0 0 3px rgba(8,145,178,0.12);}
.ev-textarea{resize:vertical;min-height:80px;}
.ev-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ev-grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
.ev-toggle-row{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-radius:10px;background:var(--ev-toggle-row-bg);border:1.5px solid var(--ev-toggle-row-border);margin-bottom:10px;}
.ev-toggle-label{font-size:13px;font-weight:600;color:var(--ev-toggle-label);}
.ev-toggle{position:relative;width:40px;height:22px;flex-shrink:0;}
.ev-toggle input{opacity:0;width:0;height:0;}
.ev-slider{position:absolute;cursor:pointer;inset:0;border-radius:22px;background:#334155;transition:.25s;}
.ev-slider::before{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:white;left:3px;top:3px;transition:.25s;}
.ev-toggle input:checked+.ev-slider{background:#0891b2;}
.ev-toggle input:checked+.ev-slider::before{transform:translateX(18px);}
.ev-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
.ev-chip{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;border:1.5px solid var(--ev-chip-border);background:transparent;cursor:pointer;font-family:'Tajawal',sans-serif;color:var(--ev-chip-color);transition:all .2s;}
.ev-chip.selected{background:#0891b2;border-color:#0891b2;color:white;}
.ev-chip:hover:not(.selected){border-color:#0891b2;color:#0891b2;}
.ev-submit{width:100%;padding:14px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#0891b2,#0284c7);color:white;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:800;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-shadow:0 4px 20px rgba(8,145,178,0.3);}
.ev-submit:hover:not(:disabled){opacity:.88;transform:translateY(-1px);}
.ev-submit:disabled{opacity:.6;cursor:not-allowed;}
.ev-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:spin .6s linear infinite;display:inline-block;}
.ev-char-count{font-size:11px;color:var(--ev-char-count);text-align:left;margin-top:4px;}

/* ══════════════════════════════════════════
   EVENT DETAIL MODAL
══════════════════════════════════════════ */
.evd-overlay{position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,16px);}
.evd-backdrop{position:absolute;inset:0;background:rgba(2,10,20,0.78);backdrop-filter:blur(12px);}
.evd-modal{position:relative;width:100%;max-width:600px;max-height:min(90vh,calc(100dvh - 32px));border-radius:24px;overflow:hidden;display:flex;flex-direction:column;background:var(--ev-modal-bg);border:1px solid var(--ev-modal-border);box-shadow:var(--ev-modal-shadow);animation:detailIn .35s cubic-bezier(.22,.68,0,1.2) both;}
.evd-header{padding:0;flex-shrink:0;position:relative;overflow:hidden;min-height:110px;display:flex;align-items:flex-end;}
.evd-header-bg{position:absolute;inset:0;opacity:.15;}
.evd-header-content{position:relative;z-index:1;padding:20px 20px 18px;width:100%;}
.evd-type-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;}
.evd-type-icon{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.evd-type-label{font-size:12px;font-weight:800;padding:3px 12px;border-radius:20px;}
.evd-title{font-size:19px;font-weight:900;color:var(--ev-card-title);margin:0 0 4px;line-height:1.3;}
.evd-org{font-size:13px;font-weight:700;color:#0891b2;margin:0;}
.evd-close{position:absolute;top:14px;left:14px;z-index:10;width:32px;height:32px;border-radius:50%;background:var(--ev-input-bg);border:1px solid var(--ev-input-border);color:var(--ev-sub-color);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s;}
.evd-close:hover{background:rgba(239,68,68,.15);color:#ef4444;border-color:#ef4444;}
.evd-body{flex:1;overflow-y:auto;padding:20px;}
.evd-body::-webkit-scrollbar{width:4px;}
.evd-body::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}

/* Info grid — بيانات واضحة بمستطيلات */
.evd-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px;}
.evd-info-card{
  padding:12px 14px;
  border-radius:12px;
  background:var(--ev-info-item-bg);
  border:1.5px solid var(--ev-input-border);
}
.evd-info-lbl{font-size:11px;color:var(--ev-detail-lbl);font-weight:600;margin-bottom:5px;line-height:1;}
.evd-info-val{font-size:13.5px;font-weight:800;color:var(--ev-detail-val);line-height:1.35;}

.evd-section-title{font-size:11px;font-weight:800;letter-spacing:.07em;color:#0891b2;margin:0 0 10px;text-transform:uppercase;display:flex;align-items:center;gap:6px;}
.evd-section-title::after{content:'';flex:1;height:1px;background:var(--ev-input-border);}
.evd-desc-text{font-size:13.5px;color:var(--ev-desc-color);line-height:1.75;margin:0;}
.evd-perks{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;}
.evd-perk{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:10px;font-size:12px;font-weight:700;background:rgba(8,145,178,0.08);color:#0891b2;border:1px solid rgba(8,145,178,0.2);}
.evd-tasks{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:18px;}
.evd-task{padding:5px 12px;border-radius:9px;font-size:12px;font-weight:700;background:var(--ev-tag-bg);color:var(--ev-tag-color);border:1.5px solid var(--ev-tag-border);}
.evd-contact-box{padding:14px 16px;border-radius:14px;background:var(--ev-info-item-bg);border:1.5px solid var(--ev-input-border);margin-bottom:18px;}
.evd-contact-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.evd-contact-row:last-child{margin-bottom:0;}
.evd-contact-icon{width:30px;height:30px;border-radius:8px;background:rgba(8,145,178,.1);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.evd-contact-info{flex:1;}
.evd-contact-lbl{font-size:10px;color:var(--ev-info-lbl);font-weight:600;}
.evd-contact-val{font-size:13px;font-weight:700;color:var(--ev-detail-val);}
.evd-footer{padding:14px 20px;border-top:1px solid var(--ev-footer-border);display:flex;gap:10px;flex-shrink:0;}
.evd-btn-primary{flex:1;padding:12px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#0891b2,#0284c7);color:white;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-shadow:0 4px 16px rgba(8,145,178,.3);text-decoration:none;}
.evd-btn-primary:hover{opacity:.88;transform:translateY(-1px);}
.evd-btn-secondary{padding:12px 16px;border-radius:12px;cursor:pointer;background:var(--ev-input-bg);border:1.5px solid var(--ev-input-border);color:var(--ev-info-val);font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px;transition:all .2s;}
.evd-btn-secondary:hover{border-color:#0891b2;color:#0891b2;}

/* ══════════════════════════════════════════
   ADMIN QUEUE
══════════════════════════════════════════ */
.aeq-wrap{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.aeq-backdrop{position:absolute;inset:0;background:rgba(2,10,20,.72);backdrop-filter:blur(8px);}
.aeq-panel{position:relative;width:100%;max-width:640px;max-height:min(88vh,calc(100dvh - 24px));border-radius:20px;background:var(--ev-aeq-bg);border:1px solid var(--ev-aeq-border);box-shadow:var(--ev-modal-shadow);display:flex;flex-direction:column;overflow:hidden;direction:rtl;font-family:'Tajawal',sans-serif;animation:aeqIn .3s cubic-bezier(.22,.68,0,1.2) both;}
.aeq-header{padding:18px 20px;flex-shrink:0;background:linear-gradient(135deg,#0c1a2e,#0f2d4a);display:flex;align-items:center;justify-content:space-between;}
.aeq-title{font-size:17px;font-weight:900;color:white;margin:0;}
.aeq-sub{font-size:12px;color:#94a3b8;margin:2px 0 0;}
.aeq-close{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#94a3b8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.aeq-close:hover{background:rgba(239,68,68,.2);color:#fca5a5;}
.aeq-body{flex:1;overflow-y:auto;padding:16px;}
.aeq-body::-webkit-scrollbar{width:4px;}
.aeq-body::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
.aeq-card{border-radius:14px;border:1.5px solid var(--ev-aeq-card-border);background:var(--ev-aeq-card-bg);padding:16px;margin-bottom:12px;animation:aeqCardIn .3s ease both;}
.aeq-card-top{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px;}
.aeq-name{font-size:14px;font-weight:800;color:var(--ev-aeq-name);margin:0 0 2px;}
.aeq-org{font-size:12px;color:#0891b2;font-weight:600;margin:0;}
.aeq-type-tag{font-size:11px;font-weight:800;padding:4px 10px;border-radius:8px;background:rgba(8,145,178,.1);color:#0891b2;white-space:nowrap;}
.aeq-detail{font-size:12px;color:#64748b;margin-bottom:5px;display:flex;align-items:center;gap:6px;}
.aeq-actions{display:flex;gap:8px;margin-top:12px;}
.aeq-btn{flex:1;padding:10px;border-radius:10px;border:none;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .2s;}
.aeq-reject{background:rgba(220,38,38,.1);color:#dc2626;}
.aeq-reject:hover:not(:disabled){background:rgba(220,38,38,.18);}
.aeq-approve{background:linear-gradient(135deg,#0891b2,#06b6d4);color:white;}
.aeq-approve:hover:not(:disabled){opacity:.88;}
.aeq-btn:disabled{opacity:.5;cursor:not-allowed;}
.aeq-empty{text-align:center;padding:50px 16px;color:#94a3b8;}
.aeq-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:spin .6s linear infinite;display:inline-block;}
.aeq-counter{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:10px;background:rgba(8,145,178,.07);border:1px solid rgba(8,145,178,.15);font-size:12px;font-weight:700;color:#0891b2;margin-bottom:12px;}
.aeq-shimmer{border-radius:14px;height:130px;margin-bottom:12px;background:var(--ev-aeq-shimmer);background-size:200% 100%;animation:shimmer 1.2s infinite;}

/* ══════════════════════════════════════════
   PROOF MODAL
══════════════════════════════════════════ */
.epm-overlay{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.epm-backdrop{position:absolute;inset:0;background:rgba(2,10,20,.8);backdrop-filter:blur(10px);}
.epm-modal{position:relative;width:100%;max-width:460px;max-height:min(90vh,calc(100dvh - 24px));border-radius:18px;background:var(--ev-modal-bg);box-shadow:var(--ev-modal-shadow);overflow-y:auto;direction:rtl;font-family:'Tajawal',sans-serif;animation:evModalIn .3s cubic-bezier(.22,.68,0,1.2) both;border:1px solid var(--ev-modal-border);}
.epm-header{padding:18px 18px 14px;background:linear-gradient(135deg,#0c4a6e,#0891b2);}
.epm-title{font-size:16px;font-weight:900;color:white;margin:0 0 3px;}
.epm-sub{font-size:12px;color:#bae6fd;margin:0;}
.epm-close{position:absolute;top:12px;left:12px;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#bae6fd;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;}
.epm-close:hover{background:rgba(255,255,255,.2);}
.epm-body{padding:18px;}
.epm-rule{background:rgba(8,145,178,.06);border:1.5px solid rgba(8,145,178,.2);border-radius:12px;padding:12px;font-size:12px;color:var(--ev-sub-color);line-height:1.7;margin-bottom:16px;}
.epm-field{margin-bottom:14px;}
.epm-label{display:block;font-size:13px;font-weight:700;color:var(--ev-field-label);margin-bottom:5px;}
.epm-input,.epm-textarea{width:100%;padding:10px 12px;border-radius:10px;font-size:13px;font-family:'Tajawal',sans-serif;border:1.5px solid var(--ev-input-border);background:var(--ev-input-bg);color:var(--ev-input-color);outline:none;transition:border-color .2s;box-sizing:border-box;}
.epm-input::placeholder,.epm-textarea::placeholder{color:var(--ev-input-placeholder);}
.epm-input:focus,.epm-textarea:focus{border-color:#0891b2;box-shadow:0 0 0 3px rgba(8,145,178,.1);}
.epm-textarea{resize:vertical;min-height:60px;}
.epm-submit{width:100%;padding:12px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#0891b2,#06b6d4);color:white;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-shadow:0 4px 16px rgba(8,145,178,.3);}
.epm-submit:hover:not(:disabled){opacity:.88;}
.epm-submit:disabled{opacity:.6;cursor:not-allowed;}
.epm-link-icon{text-align:center;font-size:32px;margin-bottom:12px;}
.epm-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:spin .6s linear infinite;display:inline-block;}

/* ══════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════ */
@media (max-width:1024px){
  .ev-grid{grid-template-columns:repeat(auto-fill,minmax(280px,1fr));}
}
@media (max-width:768px){
  .ev-grid{grid-template-columns:1fr 1fr;padding:0 12px 100px;gap:14px;}
  .ev-fab{bottom:16px;font-size:13px;padding:12px 20px;}
  .ev-admin-fab{bottom:20px;left:20px;width:52px;height:52px;font-size:20px;}
  .ev-hero{padding:85px 16px 32px;}
  .ev-total-badge{display:none;}
  .ev-controls,.ev-filters{padding-right:12px;padding-left:12px;}
  .ev-grid-2,.ev-grid-3{grid-template-columns:1fr;}
  .ev-modal,.evd-modal{max-height:95vh;border-radius:16px;}
  .evd-info-grid{grid-template-columns:1fr 1fr;}
  .aeq-panel,.epm-modal{max-width:95vw;border-radius:14px;}
}
@media (max-width:600px){
  .ev-grid{grid-template-columns:1fr;}
}
@media (max-width:480px){
  .ev-hero{padding:80px 12px 28px;}
  .ev-hero-icon{width:56px;height:56px;font-size:26px;}
  .ev-hero-title{font-size:clamp(18px,5vw,28px);}
  .ev-card{border-radius:18px;}
  .ev-filter-btn{padding:7px 12px;font-size:12px;}
  .evd-footer{flex-direction:column;}
  .evd-info-grid{grid-template-columns:1fr;}
}
@media (max-width:360px){
  .ev-card-body{padding:0 14px 12px;}
  .ev-card-title{font-size:13px;}
  .ev-grid{gap:10px;}
}

        /* ══ Mobile Performance ══ */
        @media (max-width: 768px) {
          /* إلغاء backdrop-filter من كل العناصر */
          [class*="-card"], [class*="-modal"], [class*="-backdrop"],
          [class*="-overlay"] > *, [class*="-panel"],
          [class*="-search-input"], [class*="-filter-btn"],
          [class*="-total-badge"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }

          /* منع iOS zoom على inputs */
          input, select, textarea { font-size: 16px !important; touch-action: manipulation; }

          /* إلغاء hover transforms على الجوال */
          [class*="-card"]:hover { transform: none !important; }
          [class*="-hero-icon"] { animation-duration: 4s !important; }

          /* إبطاء shimmer */
          [class*="-skel"], [class*="-shimmer"] { animation-duration: 2.5s !important; }

          /* tap highlight */
          button, [role="button"] {
            -webkit-tap-highlight-color: transparent;
            user-select: none; -webkit-user-select: none;
          }

          /* المودالات من الأسفل */
          .ev-overlay, .modal-overlay, [class*="-overlay"]:not([class*="-close"]):not([class*="-backdrop"]) {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .ev-modal, .jb-modal, .modal-box, .aeq-panel, .epm-modal {
            max-width: 100% !important;
            border-radius: 22px 22px 0 0 !important;
            position: fixed !important;
            bottom: 0 !important; left: 0 !important; right: 0 !important; top: auto !important;
            max-height: 93dvh !important;
            animation: none !important;
          }
        }
        @media (max-width: 380px) {
          [class*="-grid"]:not([class*="form"]):not([class*="info"]):not([class*="type"]) {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
        }

`;

export default function EventsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isEmployee } = useAuth();
  const { showToast } = useToast();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const dm = isDarkMode;

  const [events, setEvents]                 = useState<Event[]>([]);
  const [myEvents, setMyEvents]             = useState<Event[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [showAdminQueue, setShowAdminQueue] = useState(false);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [filterType, setFilterType]         = useState<string>('all');
  const [activeTab, setActiveTab]           = useState<'browse' | 'my'>('browse');
  const [searchQuery, setSearchQuery]       = useState('');
  const [cityInput, setCityInput]           = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [form, setForm]                     = useState(INITIAL_FORM);
  const [showProofModal, setShowProofModal] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent]  = useState<Event | null>(null);

  // Lock body scroll when modals open — NO paddingRight (causes header shake on mobile)
  useEffect(() => {
    const isOpen = !!(showForm || selectedEvent || showAdminQueue || showProofModal);
    if (isOpen) {
      document.documentElement.style.setProperty('--scrollbar-w', `${window.innerWidth - document.documentElement.clientWidth}px`);
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [showForm, selectedEvent, showAdminQueue, showProofModal]);

  const isStaff = isAdmin || isEmployee;


  const fetchEventsFromDB = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('is_active', true)
      .eq('is_public', true)
      .order('event_date', { ascending: true })
      .limit(200);
    if (error) throw error;
    const safeData = (data || []).map(ev => ({
      ...ev,
      event_name:      sanitizeInput(ev.event_name),
      organizer:       sanitizeInput(ev.organizer),
      description:     sanitizeInput(ev.description || ''),
      city:            sanitizeInput(ev.city),
      location_detail: sanitizeInput(ev.location_detail || ''),
      contact_name:    sanitizeInput(ev.contact_name || ''),
      notes:           sanitizeInput(ev.notes || ''),
    }));
    setEvents(safeData);
  }, []);

  const loadEvents = useCallback(async () => {
    if (!apiRateLimiter.canProceed()) {
      showToast('يرجى الانتظار قليلاً قبل إعادة التحميل', 'error');
      return;
    }
    try {
      setLoading(true);
      await fetchEventsFromDB();
    } catch {
      showToast('حدث خطأ في تحميل الفعاليات', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchEventsFromDB, showToast]);

  const forceLoadEvents = useCallback(async () => {
    try {
      setLoading(true);
      await fetchEventsFromDB();
    } catch {
      showToast('حدث خطأ في تحميل الفعاليات', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchEventsFromDB, showToast]);

  useEffect(() => { if (!authLoading) loadEvents(); }, [authLoading, loadEvents]);

  const loadMyEvents = useCallback(async () => {
    if (!user) return;
    if (!apiRateLimiter.canProceed()) return;
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyEvents(data || []);
    } catch {}
  }, [user]);

  useEffect(() => { if (!authLoading && user) loadMyEvents(); }, [authLoading, user, loadMyEvents]);

  const handleTaskToggle = (task: string) =>
    setForm(prev => ({
      ...prev,
      volunteer_tasks: prev.volunteer_tasks.includes(task)
        ? prev.volunteer_tasks.filter(t => t !== task)
        : [...prev.volunteer_tasks, task],
    }));

  const resetForm = () => { setForm(INITIAL_FORM); setCityInput(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { showToast('يرجى تسجيل الدخول أولاً', 'error'); return; }
    if (!submitRateLimiter.canProceed()) {
      showToast('يرجى الانتظار قبل إرسال فعالية أخرى', 'error'); return;
    }
    const sanitizedName      = sanitizeInput(form.event_name).slice(0, LIMITS.event_name);
    const sanitizedCity      = sanitizeInput(form.city);
    const sanitizedOrganizer = sanitizeInput(form.organizer).slice(0, LIMITS.organizer);
    const sanitizedDesc      = sanitizeInput(form.description).slice(0, LIMITS.description);
    const sanitizedLocation  = sanitizeInput(form.location_detail).slice(0, LIMITS.location_detail);
    const sanitizedContact   = sanitizeInput(form.contact_name).slice(0, LIMITS.contact_name);
    const sanitizedNotes     = sanitizeInput(form.notes || '').slice(0, LIMITS.notes);

    if (!sanitizedName.trim())      { showToast('يرجى كتابة اسم الفعالية', 'error'); return; }
    if (!form.event_date)           { showToast('يرجى تحديد تاريخ الفعالية', 'error'); return; }
    if (!sanitizedCity.trim())      { showToast('يرجى تحديد المدينة', 'error'); return; }
    if (!sanitizedOrganizer.trim()) { showToast('يرجى كتابة اسم الجهة المنظِّمة', 'error'); return; }
    if (new Date(form.event_date) < new Date(new Date().toDateString())) {
      showToast('تاريخ الفعالية لا يمكن أن يكون في الماضي', 'error'); return;
    }
    if (form.contact_phone && !isValidSaudiPhone(form.contact_phone)) {
      showToast('يرجى إدخال رقم جوال سعودي صحيح (05xxxxxxxx)', 'error'); return;
    }
    if (form.contact_email && !isValidEmail(form.contact_email)) {
      showToast('يرجى إدخال بريد إلكتروني صحيح', 'error'); return;
    }
    if (form.registration_link && !isAllowedRegistrationUrl(form.registration_link)) {
      showToast('الرابط غير مسموح به أو يحتوي على نطاق محظور', 'error'); return;
    }
    if (form.proof_url && !isValidUrl(form.proof_url)) {
      showToast('رابط الإثبات غير صحيح — يجب أن يبدأ بـ https://', 'error'); return;
    }
    const volunteers = Math.max(1, Math.min(10000, Number(form.volunteers_needed) || 10));
    setIsSubmitting(true);
    try {
      // ── منع التكرار: تحقق من وجود فعالية بنفس الاسم والتاريخ لنفس المستخدم
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_name', sanitizedName)
        .eq('event_date', form.event_date)
        .not('status', 'in', '("cancelled")')
        .maybeSingle();
      if (existing) {
        showToast('⚠️ لديك فعالية بنفس الاسم والتاريخ بالفعل', 'error');
        setIsSubmitting(false); return;
      }

      const { error } = await supabase.from('events').insert({
        event_name: sanitizedName, organizer: sanitizedOrganizer,
        description: sanitizedDesc, event_type: form.event_type,
        city: sanitizedCity, location_detail: sanitizedLocation,
        event_date: form.event_date, start_time: form.start_time,
        end_time: form.end_time, is_recurring: form.is_recurring,
        volunteers_needed: volunteers, volunteer_tasks: form.volunteer_tasks,
        target_group: form.target_group, has_training: form.has_training,
        volunteer_duration: form.volunteer_duration, has_reward: form.has_reward,
        has_meals: form.has_meals, has_transport: form.has_transport,
        required_equipment: sanitizeInput(form.required_equipment || ''),
        contact_name: sanitizedContact, contact_phone: form.contact_phone,
        contact_email: form.contact_email, registration_method: form.registration_method,
        registration_link: form.registration_link || null, is_public: form.is_public,
        registration_deadline: form.registration_deadline || null,
        notes: sanitizedNotes, user_id: user.id, is_active: false,
        proof_url: form.proof_url.trim() || null,
        pending_status: form.proof_url.trim() ? 'pending_admin' : 'pending_proof',
      });
      if (error) throw error;

      // إشعار الأدمن بالفعالية الجديدة
      const { data: insertedEvent } = await supabase
        .from('events').select('id').eq('user_id', user.id).eq('event_name', sanitizedName)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { data: profile } = await supabase
        .from('user').select('association_name').eq('user_id', user.id).maybeSingle();
      const clientName = (profile as any)?.association_name || user.email || 'عميل';
      await notifyAdminNewEvent({
        clientName,
        eventName: sanitizedName,
        eventId:   insertedEvent?.id || '',
      });

      showToast(
        form.proof_url.trim()
          ? '✅ تم إرسال الفعالية مع رابط الإثبات — بانتظار موافقة الإدارة'
          : '✅ تم إرسال الفعالية — يرجى إرفاق رابط الإثبات من صفحة "فعالياتي"',
        'success'
      );
      setShowForm(false);
      resetForm();
      loadMyEvents();
    } catch (err: any) {
      console.error('[Submit Error]', err);
      showToast('حدث خطأ أثناء الإرسال، حاول مرة أخرى', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminDelete = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الفعالية؟')) return;
    try {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setEvents(prev => prev.filter(ev => ev.id !== id));
      setMyEvents(prev => prev.filter(ev => ev.id !== id));
      showToast('🗑️ تم حذف الفعالية بنجاح', 'success');
    } catch {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  const filtered = events.filter(ev => {
    const matchType = filterType === 'all' || ev.event_type === filterType;
    if (searchQuery && !searchRateLimiter.canProceed()) return matchType;
    const q = sanitizeInput(searchQuery).toLowerCase().slice(0, 100);
    const matchSearch = !q ||
      ev.event_name.toLowerCase().includes(q) ||
      ev.city.toLowerCase().includes(q) ||
      (ev.user?.association_name || ev.organizer).toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  const eventCounts = Object.keys(EVENT_TYPES).reduce((acc, key) => {
    acc[key] = events.filter(e => e.event_type === key).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={{ minHeight: '100dvh', fontFamily: "'Tajawal', sans-serif", direction: 'rtl', overflowX: 'hidden' }}>
      {/* Static style — no flicker on theme change */}
      <style>{GLOBAL_STYLE}</style>

      {/* Background */}


      {/* Hero */}
      <div className="ev-hero">
        <div className="ev-hero-inner">
          <div className="ev-hero-text">
            <div className="ev-hero-icon">📅</div>
            <h1 className="ev-hero-title">الفعاليات</h1>
            <p className="ev-hero-sub">
              {authLoading
                ? 'اكتشف الفعاليات التطوعية في مدينتك'
                : user
                  ? isStaff
                    ? 'راجع الفعاليات واعتمدها قبل النشر'
                    : 'اكتشف الفعاليات القادمة وشارك كمتطوع في مجتمعك'
                  : 'اكتشف الفعاليات التطوعية في مدينتك'}
            </p>
          </div>
          <div className="ev-total-badge">
            <div className="ev-total-num">{events.length}</div>
            <div className="ev-total-lbl">إجمالي الفعاليات</div>
          </div>
        </div>
      </div>

      {/* Auth Banner */}
      {!authLoading && !user && (
        <div className="ev-auth-banner">
          <div className="ev-auth-box" onClick={() => navigate('/')}>
            <span>🔐</span>
            <span>سجّل دخولك لإضافة فعالية والمشاركة في المجتمع</span>
            <span className="ev-auth-link">تسجيل الدخول ←</span>
          </div>
        </div>
      )}

      {/* Pending notice */}
      {!authLoading && user && !isStaff && (
        <div className="ev-pending-notice">
          <div className="ev-pending-box">
            <i className="fas fa-clock" />
            الفعاليات التي تضيفها تحتاج موافقة الإدارة قبل النشر
          </div>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="ev-nav">
        <button
          className={`ev-nav-tab${activeTab === 'browse' ? ' active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          🔍 تصفح الفعاليات
        </button>
        {!authLoading && user && !isStaff && (
          <button
            className={`ev-nav-tab${activeTab === 'my' ? ' active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            📅 فعالياتي {myEvents.length > 0 && `(${myEvents.length})`}
          </button>
        )}
      </div>

      {/* ── Browse Tab ── */}
      {activeTab === 'browse' && (
        <>
          {/* Controls */}
      <div className="ev-controls">
        <div className="ev-search-wrap">
          <i className="fas fa-search ev-search-icon" />
          <input
            className="ev-search-input"
            placeholder="ابحث عن فعالية أو مدينة أو جهة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="ev-filters">
        <button
          className={`ev-filter-btn${filterType === 'all' ? ' active' : ''}`}
          style={filterType === 'all' ? { background: '#0891b2' } : {}}
          onClick={() => setFilterType('all')}
        >
          🗂 الكل <span className="ev-type-count">{events.length}</span>
        </button>
        {Object.entries(EVENT_TYPES).map(([key, { label, icon, color }]) => (
          <button
            key={key}
            className={`ev-filter-btn${filterType === key ? ' active' : ''}`}
            style={filterType === key ? { background: color } : {}}
            onClick={() => setFilterType(key)}
          >
            {icon} {label} <span className="ev-type-count">{eventCounts[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="ev-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="ev-skel" style={{ animationDelay: `${i * 0.07}s` }} />
          ))
        ) : filtered.length === 0 ? (
          <div className="ev-empty">
            <div className="ev-empty-icon">📅</div>
            <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: dm ? '#e2e8f0' : '#0f172a' }}>
              {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد فعاليات حالياً'}
            </p>
            <p style={{ fontSize: 13, margin: 0, color: dm ? '#94a3b8' : '#64748b' }}>
              {searchQuery ? 'جرّب كلمات بحث مختلفة' : user && !isStaff ? 'كن أول من يضيف فعالية' : 'جرّب تغيير الفلتر'}
            </p>
          </div>
        ) : (
          filtered.map((ev, i) => {
            const typeInfo = EVENT_TYPES[ev.event_type] || EVENT_TYPES['أخرى'];
            const daysLeft = Math.ceil((new Date(ev.event_date).getTime() - Date.now()) / 86400000);
            const daysColor = daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#16a34a';
            const isNew = Math.ceil((Date.now() - new Date(ev.created_at).getTime()) / 86400000) <= 3;

            return (
              <div
                key={ev.id}
                className="ev-card"
                style={{ animationDelay: `${i * 0.06}s` }}
                onClick={() => setSelectedEvent(ev)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedEvent(ev)}
                aria-label={`عرض تفاصيل ${ev.event_name}`}
              >
                {ev.is_recurring && <span className="ev-recurring-tag">🔁 متكررة</span>}
                {daysLeft >= 0 && daysLeft <= 30 && (
                  <span className="ev-days-badge" style={{
                    background: `${daysColor}18`, color: daysColor,
                    border: `1px solid ${daysColor}40`,
                    top: ev.is_recurring ? '38px' : '14px', right: '14px',
                  }}>
                    {daysLeft === 0 ? '📌 اليوم' : `⏳ ${daysLeft} يوم`}
                  </span>
                )}

                {/* Header */}
                <div className="ev-card-head" style={{ background: dm ? typeInfo.darkBg : typeInfo.bg }}>
                  <div className="ev-card-head-content">
                    <div className="ev-card-icon-wrap" style={{ background: dm ? `${typeInfo.color}25` : '#fff' }}>
                      {typeInfo.icon}
                    </div>
                    <div className="ev-card-title-wrap">
                      <h3 className="ev-card-title">{ev.event_name}</h3>
                      <span className="ev-card-type-badge" style={{ background: `${typeInfo.color}18`, color: typeInfo.color }}>
                        {typeInfo.label}
                        {isNew && <span className="ev-new-badge" style={{ marginRight: 4 }}>✨</span>}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Org */}
                <div className="ev-card-org">
                  <div className="ev-org-dot" style={{ background: typeInfo.color }} />
                  <span className="ev-org-name">{ev.user?.association_name || ev.organizer}</span>
                </div>

                {/* Body */}
                <div className="ev-card-body">
                  {ev.description && <p className="ev-card-desc">{ev.description}</p>}

                  {/* Pills — كل بيان بصندوق واضح */}
                  <div className="ev-card-pills">
                    <span className="ev-pill">
                      <span className="ev-pill-icon">📍</span>{ev.city}
                    </span>
                    <span className="ev-pill">
                      <span className="ev-pill-icon">📆</span>
                      {new Date(ev.event_date).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                    </span>
                    {ev.start_time && (
                      <span className="ev-pill">
                        <span className="ev-pill-icon">🕐</span>{ev.start_time}
                      </span>
                    )}
                    <span className="ev-pill">
                      <span className="ev-pill-icon">🎯</span>
                      {ev.target_group}
                    </span>
                  </div>

                  {/* Tags */}
                  {(ev.has_reward || ev.has_meals || ev.has_transport || ev.has_training) && (
                    <div className="ev-tags">
                      {ev.has_reward    && <span className="ev-tag">🎖 شهادة</span>}
                      {ev.has_meals     && <span className="ev-tag">🍽 وجبات</span>}
                      {ev.has_transport && <span className="ev-tag">🚌 مواصلات</span>}
                      {ev.has_training  && <span className="ev-tag">📚 تدريب</span>}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="ev-card-footer">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div className="ev-volunteers-badge">👥 {ev.volunteers_needed} متطوع</div>
                    {(() => {
                      const sc = EVENT_STATUS_CONFIG[ev.status] ?? EVENT_STATUS_CONFIG['new'];
                      return (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: dm ? sc.darkBg : sc.bg, color: sc.color,
                          border: `1px solid ${sc.color}40`,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                          {sc.label}
                        </span>
                      );
                    })()}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {isAdmin && (
                      <button
                        className="ev-more-btn"
                        style={{ width: 'auto', padding: '6px 12px', marginBottom: 0, background: dm ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}
                        onClick={e => { e.stopPropagation(); handleAdminDelete(ev.id); }}
                        aria-label="حذف الفعالية"
                      >
                        🗑 حذف
                      </button>
                    )}
                    <button
                      className="ev-more-btn"
                      style={{ width: 'auto', padding: '6px 12px', marginBottom: 0 }}
                      onClick={e => { e.stopPropagation(); setSelectedEvent(ev); }}
                      aria-label="عرض التفاصيل"
                    >
                      المزيد ←
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}

      {/* ── My Events Tab ── */}
      {activeTab === 'my' && !authLoading && user && !isStaff && (
        <div className="ev-my-wrap">
          {myEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 16px', color: dm ? '#475569' : '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📅</div>
              <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: dm ? '#f1f5f9' : '#0f172a' }}>
                لم تضف أي فعالية بعد
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>اضغط على زر "أضف فعالية" أدناه للبدء</p>
            </div>
          ) : (
            myEvents.map((ev, i) => {
              const typeInfo = EVENT_TYPES[ev.event_type] || EVENT_TYPES['أخرى'];
              const sc = EVENT_STATUS_CONFIG[ev.status] ?? EVENT_STATUS_CONFIG['new'];
              return (
                <div key={ev.id} className="ev-my-card" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="ev-my-card-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="ev-my-title">{ev.event_name}</p>
                      <p className="ev-my-sub">
                        📍 {ev.city} · {new Date(ev.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                      <span className="ev-status-badge" style={{
                        background: ev.is_active ? dm ? 'rgba(22,163,74,0.15)' : '#dcfce7' : dm ? 'rgba(234,179,8,0.15)' : '#fef9c3',
                        color: ev.is_active ? '#16a34a' : '#d97706',
                        border: `1px solid ${ev.is_active ? 'rgba(22,163,74,0.3)' : 'rgba(234,179,8,0.3)'}`,
                      }}>
                        {ev.is_active ? '✅ منشورة' : '⏳ قيد المراجعة'}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                        background: dm ? sc.darkBg : sc.bg, color: sc.color,
                        border: `1px solid ${sc.color}40`,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <div className="ev-my-card-body">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span className="ev-type-tag" style={{ fontSize: 11 }}>{typeInfo.icon} {typeInfo.label}</span>
                      <span style={{ fontSize: 12, color: dm ? '#64748b' : '#94a3b8' }}>📆 {ev.event_date}</span>
                      <span style={{ fontSize: 12, color: dm ? '#64748b' : '#94a3b8' }}>👥 {ev.volunteers_needed} متطوع</span>
                    </div>
                    {ev.is_active ? (
                      <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>✅ الفعالية منشورة وتستقبل المتطوعين</span>
                    ) : ev.pending_status === 'pending_proof' ? (
                      <div>
                        <div style={{ fontSize: 12, color: '#d97706', fontWeight: 600, marginBottom: 8 }}>
                          🖼 يرجى إرفاق إثبات الفعالية (صورة أو رابط) لإتمام المراجعة
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setShowProofModal(ev); }}
                          style={{
                            padding: '7px 14px', borderRadius: 10, border: '1.5px solid #d97706',
                            background: 'rgba(234,179,8,0.1)', color: '#d97706',
                            fontFamily: "'Tajawal',sans-serif", fontSize: 12, fontWeight: 800,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          📤 رفع إثبات الفعالية
                        </button>
                      </div>
                    ) : ev.pending_status === 'pending_admin' ? (
                      <span style={{ fontSize: 12, color: '#0891b2', fontWeight: 600 }}>🔍 تم إرسال الإثبات — بانتظار موافقة الإدارة</span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d97706', fontWeight: 600 }}>⏳ بانتظار موافقة الإدارة للنشر</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FAB */}
      {!authLoading && user && !isStaff && (
        <button className="ev-fab" onClick={() => setShowForm(true)}>
          <i className="fas fa-plus" /> أضف فعالية
        </button>
      )}
      {!authLoading && isStaff && (
        <button className="ev-admin-fab" onClick={() => setShowAdminQueue(true)}>
          <i className="fas fa-shield-alt" />
        </button>
      )}

      {/* Admin Queue */}
      {showAdminQueue && (
        <AdminEventsQueue
          isDarkMode={dm}
          onClose={() => { setShowAdminQueue(false); forceLoadEvents(); }}
          onEventApproved={forceLoadEvents}
        />
      )}

      {/* Proof Modal */}
      {showProofModal && (
        <EventProofModal
          event={showProofModal}
          onClose={() => setShowProofModal(null)}
          onSuccess={() => {
            setShowProofModal(null);
            loadMyEvents();
            showToast('✅ تم إرسال الإثبات — سيراجعه الأدمن قريباً', 'success');
          }}
        />
      )}

      {/* ══ Event Detail Modal ══ */}
      {selectedEvent && (() => {
        const ev = selectedEvent;
        const typeInfo  = EVENT_TYPES[ev.event_type] || EVENT_TYPES['أخرى'];
        const daysLeft  = Math.ceil((new Date(ev.event_date).getTime() - Date.now()) / 86400000);
        const daysColor = daysLeft <= 3 ? '#ef4444' : daysLeft <= 7 ? '#f59e0b' : '#16a34a';
        const targetLabel   = ev.target_group;
        const durationLabel = ev.volunteer_duration;
        const TASK_LABELS: Record<string, string> = { 'تسجيل': 'تسجيل', 'تنظيم': 'تنظيم', 'إعلام': 'إعلام', 'لوجستي': 'لوجستي', 'أخرى': 'أخرى' };
        return (
          <div className="evd-overlay">
            <div className="evd-backdrop" onClick={() => setSelectedEvent(null)} />
            <div className="evd-modal">
              <div className="evd-header">
                <div className="evd-header-bg" style={{ background: `linear-gradient(135deg,${typeInfo.color},${typeInfo.color}66)` }} />
                <div className="evd-header-content">
                  <div className="evd-type-row">
                    <div className="evd-type-icon" style={{ background: dm ? typeInfo.darkBg : typeInfo.bg }}>{typeInfo.icon}</div>
                    <span className="evd-type-label" style={{ background: `${typeInfo.color}20`, color: typeInfo.color }}>{typeInfo.label}</span>
                    {daysLeft >= 0 && daysLeft <= 30 && (
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8, background: `${daysColor}18`, color: daysColor, border: `1px solid ${daysColor}40` }}>
                        {daysLeft === 0 ? '📌 اليوم' : `⏳ ${daysLeft} يوم`}
                      </span>
                    )}
                    {ev.is_recurring && <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 9px', borderRadius: 8, background: 'rgba(124,58,237,0.15)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.25)' }}>🔁 متكررة</span>}
                  </div>
                  <h2 className="evd-title">{ev.event_name}</h2>
                  <p className="evd-org">🏢 {ev.user?.association_name || ev.organizer}</p>
                </div>
                <button className="evd-close" onClick={() => setSelectedEvent(null)}>✕</button>
              </div>

              <div className="evd-body">
                {/* Info Grid — مستطيلات واضحة لكل بيان */}
                <div className="evd-info-grid">
                  <div className="evd-info-card">
                    <div className="evd-info-lbl">📍 المدينة</div>
                    <div className="evd-info-val">{ev.city}{ev.location_detail ? ` — ${ev.location_detail}` : ''}</div>
                  </div>
                  <div className="evd-info-card">
                    <div className="evd-info-lbl">📆 التاريخ</div>
                    <div className="evd-info-val">
                      {new Date(ev.event_date).toLocaleDateString('ar-SA', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                  {ev.start_time && (
                    <div className="evd-info-card">
                      <div className="evd-info-lbl">🕐 الوقت</div>
                      <div className="evd-info-val">{ev.start_time}{ev.end_time ? ` — ${ev.end_time}` : ''}</div>
                    </div>
                  )}
                  {ev.registration_deadline && (
                    <div className="evd-info-card">
                      <div className="evd-info-lbl">⏰ آخر تسجيل</div>
                      <div className="evd-info-val">
                        {new Date(ev.registration_deadline).toLocaleDateString('ar-SA', { month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  )}
                  <div className="evd-info-card">
                    <div className="evd-info-lbl">👥 المتطوعون</div>
                    <div className="evd-info-val">{ev.volunteers_needed} متطوع مطلوب</div>
                  </div>
                  <div className="evd-info-card">
                    <div className="evd-info-lbl">🎯 الفئة المستهدفة</div>
                    <div className="evd-info-val">{targetLabel}</div>
                  </div>
                  <div className="evd-info-card">
                    <div className="evd-info-lbl">⏱ مدة التطوع</div>
                    <div className="evd-info-val">{durationLabel}</div>
                  </div>
                </div>

                {ev.description && (
                  <div style={{ marginBottom: 18 }}>
                    <p className="evd-section-title">📝 عن الفعالية</p>
                    <p className="evd-desc-text">{ev.description}</p>
                  </div>
                )}

                {(ev.has_reward || ev.has_meals || ev.has_transport || ev.has_training) && (
                  <div style={{ marginBottom: 18 }}>
                    <p className="evd-section-title">🎁 المزايا</p>
                    <div className="evd-perks">
                      {ev.has_reward    && <span className="evd-perk">🎖 شهادة / مكافأة</span>}
                      {ev.has_meals     && <span className="evd-perk">🍽 وجبات</span>}
                      {ev.has_transport && <span className="evd-perk">🚌 مواصلات</span>}
                      {ev.has_training  && <span className="evd-perk">📚 تدريب مسبق</span>}
                    </div>
                  </div>
                )}

                {ev.volunteer_tasks?.length > 0 && (
                  <div style={{ marginBottom: 18 }}>
                    <p className="evd-section-title">🛠 مهام المتطوعين</p>
                    <div className="evd-tasks">
                      {ev.volunteer_tasks.map(t => <span key={t} className="evd-task">{TASK_LABELS[t] || t}</span>)}
                    </div>
                  </div>
                )}

                {ev.notes && (
                  <div style={{ marginBottom: 18 }}>
                    <p className="evd-section-title">💬 ملاحظات</p>
                    <p className="evd-desc-text">{ev.notes}</p>
                  </div>
                )}

                {(ev.contact_name || ev.contact_phone || ev.contact_email) && (
                  <div style={{ marginBottom: 18 }}>
                    <p className="evd-section-title">📞 التواصل</p>
                    <div className="evd-contact-box">
                      {ev.contact_name && (
                        <div className="evd-contact-row">
                          <div className="evd-contact-icon">👤</div>
                          <div className="evd-contact-info">
                            <div className="evd-contact-lbl">المسؤول</div>
                            <div className="evd-contact-val">{ev.contact_name}</div>
                          </div>
                        </div>
                      )}
                      {ev.contact_phone && (
                        <div className="evd-contact-row">
                          <div className="evd-contact-icon">📱</div>
                          <div className="evd-contact-info">
                            <div className="evd-contact-lbl">الجوال</div>
                            <div className="evd-contact-val">{ev.contact_phone}</div>
                          </div>
                        </div>
                      )}
                      {ev.contact_email && (
                        <div className="evd-contact-row">
                          <div className="evd-contact-icon">📧</div>
                          <div className="evd-contact-info">
                            <div className="evd-contact-lbl">البريد</div>
                            <div className="evd-contact-val">{ev.contact_email}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="evd-footer">
                {ev.registration_method === 'رابط' && ev.registration_link ? (
                  <a
                    className="evd-btn-primary"
                    href={ev.registration_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => {
                      if (!isAllowedRegistrationUrl(ev.registration_link!)) {
                        e.preventDefault();
                        showToast('الرابط غير آمن', 'error');
                      }
                    }}
                  >
                    📝 سجّل الآن
                  </a>
                ) : ev.contact_phone ? (
                  <button
                    className="evd-btn-primary"
                    onClick={() => safeOpenUrl(`https://wa.me/966${ev.contact_phone.replace(/^0/, '')}`)}
                  >
                    💬 تواصل واتساب
                  </button>
                ) : null}
                <button className="evd-btn-secondary" onClick={() => setSelectedEvent(null)}>✕ إغلاق</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ Add Event Modal ══ */}
      {showForm && (
        <div className="ev-overlay">
          <div className="ev-backdrop" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="ev-modal">
            <div className="ev-modal-header">
              <h2 className="ev-modal-title">إضافة فعالية جديدة</h2>
              <p className="ev-modal-sub">ستُراجع الفعالية من قِبل الإدارة قبل النشر</p>
              <button className="ev-modal-close" onClick={() => { setShowForm(false); resetForm(); }}>
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="ev-modal-body">
              <form onSubmit={handleSubmit}>

                {/* Governance notice */}
                <div className="ev-governance-box">
                  <p className="ev-gov-title">🟢 نظام ضمان الحوكمة</p>
                  <ul className="ev-gov-steps">
                    <li className="ev-gov-step"><span>1️⃣</span> أكمل بيانات الفعالية</li>
                    <li className="ev-gov-step"><span>2️⃣</span> أرفق رابط الإثبات الرسمي (اختياري — أو من صفحة فعالياتي)</li>
                    <li className="ev-gov-step"><span>3️⃣</span> تراجع الإدارة التفاصيل وتوافق على النشر</li>
                    <li className="ev-gov-step"><span>4️⃣</span> تُنشر الفعالية وتصبح متاحة للمتطوعين</li>
                  </ul>
                </div>

                {/* معلومات الفعالية */}
                <p className="ev-section-lbl"><i className="fas fa-calendar-alt" /> معلومات الفعالية</p>

                <div className="ev-field">
                  <label className="ev-label">اسم الفعالية <span className="ev-required">*</span></label>
                  <input
                    className="ev-input"
                    value={form.event_name}
                    onChange={e => setForm({ ...form, event_name: e.target.value })}
                    placeholder="مثال: حملة التوعية بالصحة النفسية"
                    maxLength={100}
                  />
                  <p className="ev-char-count">{form.event_name.length}/100</p>
                </div>

                <div className="ev-grid-2">
                  <div className="ev-field">
                    <label className="ev-label">الجهة المنظِّمة <span className="ev-required">*</span></label>
                    <input
                      className="ev-input"
                      value={form.organizer}
                      onChange={e => setForm({ ...form, organizer: e.target.value })}
                      placeholder="اسم الجمعية أو الجهة"
                    />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">نوع الفعالية</label>
                    <select
                      className="ev-select"
                      value={form.event_type}
                      onChange={e => setForm({ ...form, event_type: e.target.value as Event['event_type'] })}
                    >
                      {Object.entries(EVENT_TYPES).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="ev-field">
                  <label className="ev-label">وصف الفعالية</label>
                  <textarea
                    className="ev-textarea"
                    value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="اكتب وصفاً مختصراً يشرح هدف الفعالية..."
                    maxLength={500}
                  />
                  <p className="ev-char-count">{form.description.length}/500</p>
                </div>

                {/* الموقع والتوقيت */}
                <p className="ev-section-lbl" style={{ marginTop: 8 }}>
                  <i className="fas fa-map-marker-alt" /> الموقع والتوقيت
                </p>

                <div className="ev-grid-2">
                  <div className="ev-field" style={{ position: 'relative' }}>
                    <label className="ev-label">المدينة <span className="ev-required">*</span></label>
                    <input
                      className="ev-input"
                      value={cityInput}
                      onChange={e => {
                        setCityInput(e.target.value);
                        setForm({ ...form, city: e.target.value });
                        setShowCitySuggestions(true);
                      }}
                      onFocus={() => setShowCitySuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                      placeholder="اكتب اسم المدينة..."
                    />
                    {showCitySuggestions && cityInput && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 200,
                        background: dm ? '#1e293b' : '#fff',
                        border: `1.5px solid ${dm ? '#334155' : '#e2e8f0'}`,
                        borderRadius: 12, marginTop: 4,
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        maxHeight: 200, overflowY: 'auto',
                      }}>
                        {SAUDI_CITIES.filter(c => c.includes(cityInput)).slice(0, 8).map(city => (
                          <button
                            key={city}
                            type="button"
                            onMouseDown={() => {
                              setCityInput(city);
                              setForm({ ...form, city });
                              setShowCitySuggestions(false);
                            }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'right',
                              padding: '10px 14px', border: 'none', background: 'none',
                              fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 600,
                              color: dm ? '#e2e8f0' : '#374151', cursor: 'pointer',
                              borderBottom: `1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f1f5f9'}`,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            📍 {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">تفاصيل الموقع</label>
                    <input
                      className="ev-input"
                      value={form.location_detail}
                      onChange={e => setForm({ ...form, location_detail: e.target.value })}
                      placeholder="اسم المبنى / القاعة..."
                    />
                  </div>
                </div>

                <div className="ev-grid-3">
                  <div className="ev-field">
                    <label className="ev-label">تاريخ الفعالية <span className="ev-required">*</span></label>
                    <input
                      type="date"
                      className="ev-input"
                      value={form.event_date}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm({ ...form, event_date: e.target.value })}
                    />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">وقت البدء</label>
                    <input
                      type="time"
                      className="ev-input"
                      value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })}
                    />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">وقت الانتهاء</label>
                    <input
                      type="time"
                      className="ev-input"
                      value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="ev-field">
                  <label className="ev-label">آخر موعد للتسجيل</label>
                  <input
                    type="date"
                    className="ev-input"
                    value={form.registration_deadline}
                    min={new Date().toISOString().split('T')[0]}
                    max={form.event_date || undefined}
                    onChange={e => setForm({ ...form, registration_deadline: e.target.value })}
                  />
                </div>

                {/* التطوع */}
                <p className="ev-section-lbl" style={{ marginTop: 8 }}>
                  <i className="fas fa-hands-helping" /> التطوع
                </p>

                <div className="ev-grid-2">
                  <div className="ev-field">
                    <label className="ev-label">عدد المتطوعين المطلوبين</label>
                    <input
                      type="number"
                      className="ev-input"
                      min={1}
                      max={10000}
                      value={form.volunteers_needed}
                      onChange={e => setForm({ ...form, volunteers_needed: Math.max(1, +e.target.value) })}
                    />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">الفئة المستهدفة</label>
                    <select
                      className="ev-select"
                      value={form.target_group}
                      onChange={e => setForm({ ...form, target_group: e.target.value as Event['target_group'] })}
                    >
                      <option value="الجميع">الجميع</option>
                      <option value="طلاب">طلاب</option>
                      <option value="مختصين">مختصين</option>
                    </select>
                  </div>
                </div>

                <div className="ev-field">
                  <label className="ev-label">مهام المتطوعين</label>
                  <div className="ev-chips">
                    {TASK_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`ev-chip${form.volunteer_tasks.includes(t.value) ? ' selected' : ''}`}
                        onClick={() => handleTaskToggle(t.value)}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ev-field">
                  <label className="ev-label">مدة التطوع</label>
                  <select
                    className="ev-select"
                    value={form.volunteer_duration}
                    onChange={e => setForm({ ...form, volunteer_duration: e.target.value as Event['volunteer_duration'] })}
                  >
                    <option value="ساعات">ساعات</option>
                    <option value="يوم كامل">يوم كامل</option>
                    <option value="أيام متعددة">أيام متعددة</option>
                  </select>
                </div>

                {/* المزايا */}
                <p className="ev-section-lbl" style={{ marginTop: 8 }}>
                  <i className="fas fa-gift" /> المزايا والخدمات
                </p>

                {[
                  { key: 'has_reward',    label: '🎖 شهادة مشاركة / مكافأة' },
                  { key: 'has_meals',     label: '🍽 وجبات للمتطوعين' },
                  { key: 'has_transport', label: '🚌 مواصلات' },
                  { key: 'has_training',  label: '📚 تدريب مسبق' },
                  { key: 'is_recurring',  label: '🔁 فعالية متكررة' },
                ].map(({ key, label }) => (
                  <div key={key} className="ev-toggle-row">
                    <span className="ev-toggle-label">{label}</span>
                    <label className="ev-toggle">
                      <input
                        type="checkbox"
                        checked={!!(form as any)[key]}
                        onChange={e => setForm({ ...form, [key]: e.target.checked })}
                      />
                      <span className="ev-slider" />
                    </label>
                  </div>
                ))}

                {/* التواصل */}
                <p className="ev-section-lbl" style={{ marginTop: 8 }}>
                  <i className="fas fa-phone" /> التواصل والتسجيل
                </p>

                <div className="ev-grid-2">
                  <div className="ev-field">
                    <label className="ev-label">اسم جهة الاتصال</label>
                    <input
                      className="ev-input"
                      value={form.contact_name}
                      onChange={e => setForm({ ...form, contact_name: e.target.value })}
                      placeholder="المسؤول عن التواصل"
                    />
                  </div>
                  <div className="ev-field">
                    <label className="ev-label">رقم الجوال</label>
                    <input
                      className="ev-input"
                      value={form.contact_phone}
                      onChange={e => setForm({ ...form, contact_phone: e.target.value })}
                      placeholder="05xxxxxxxx"
                      type="tel"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="ev-field">
                  <label className="ev-label">طريقة التسجيل</label>
                  <select
                    className="ev-select"
                    value={form.registration_method}
                    onChange={e => setForm({ ...form, registration_method: e.target.value as Event['registration_method'] })}
                  >
                    <option value="مباشر">تواصل مباشر</option>
                    <option value="رابط">رابط تسجيل</option>
                    <option value="نموذج">نموذج إلكتروني</option>
                  </select>
                </div>

                {form.registration_method === 'رابط' && (
                  <div className="ev-field">
                    <label className="ev-label">رابط التسجيل</label>
                    <input
                      className="ev-input"
                      value={form.registration_link}
                      onChange={e => setForm({ ...form, registration_link: e.target.value })}
                      placeholder="https://..."
                      type="url"
                    />
                  </div>
                )}

                <div className="ev-field">
                  <label className="ev-label">ملاحظات إضافية</label>
                  <textarea
                    className="ev-textarea"
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    placeholder="أي معلومات إضافية..."
                    maxLength={300}
                  />
                </div>

                {/* إثبات الفعالية */}
                <p className="ev-section-lbl" style={{ marginTop: 8 }}>
                  <i className="fas fa-link" /> إثبات الفعالية (اختياري)
                </p>
                <div className="ev-governance-box" style={{ marginBottom: 12 }}>
                  <p className="ev-gov-title">🔗 ما هو رابط الإثبات؟</p>
                  <ul className="ev-gov-steps">
                    <li className="ev-gov-step"><span>📌</span> رابط الإعلان الرسمي للفعالية على موقع الجمعية أو وسائل التواصل</li>
                    <li className="ev-gov-step"><span>✅</span> يساعد الإدارة على اعتماد الفعالية بشكل أسرع</li>
                    <li className="ev-gov-step"><span>⏳</span> يمكنك إضافته لاحقاً من صفحة "فعالياتي" أيضاً</li>
                  </ul>
                </div>
                <div className="ev-field">
                  <label className="ev-label">رابط الإثبات</label>
                  <input
                    className="ev-input"
                    value={form.proof_url}
                    onChange={e => setForm({ ...form, proof_url: e.target.value })}
                    placeholder="https://... (رابط الإعلان الرسمي)"
                    type="url"
                  />
                  {form.proof_url && !isValidUrl(form.proof_url) && (
                    <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠️ يرجى إدخال رابط صحيح يبدأ بـ https://</p>
                  )}
                </div>

                <button type="submit" disabled={isSubmitting} className="ev-submit">
                  {isSubmitting
                    ? <><span className="ev-spin" /> جاري الإرسال...</>
                    : <><i className="fas fa-paper-plane" /> إرسال للمراجعة</>
                  }
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════
   Event Proof Modal
══════════════════════════════════════════ */
function EventProofModal({ event, onClose, onSuccess }: { event: Event; onClose: () => void; onSuccess: () => void }) {
  const [proofType, setProofType] = useState<'image' | 'link'>('image');
  const [proofUrl,  setProofUrl]  = useState('');
  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState('');
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { showToast('الحد الأقصى للصورة 5MB', 'error'); return; }
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(f.type)) {
      showToast('يُسمح فقط بصور JPG أو PNG أو GIF أو WEBP', 'error'); return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    try {
      let finalUrl = '';
      let fileName = '';

      if (proofType === 'image' && file) {
        const ext = file.name.split('.').pop();
        const path = `event-proofs/${event.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('job-proofs').upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from('job-proofs').getPublicUrl(path);
        finalUrl = urlData.publicUrl;
        fileName = file.name;
      } else if (proofType === 'link') {
        if (!proofUrl.trim()) { showToast('يرجى إدخال رابط', 'error'); setUploading(false); return; }
        if (!isValidUrl(proofUrl)) { showToast('الرابط غير صالح', 'error'); setUploading(false); return; }
        finalUrl = proofUrl.trim();
        fileName = '';
      } else {
        showToast('يرجى اختيار صورة أو إدخال رابط', 'error'); setUploading(false); return;
      }

      const { error } = await supabase.from('events').update({
        proof_url: finalUrl,
        proof_file_name: fileName || null,
        pending_status: 'pending_admin',
      }).eq('id', event.id);
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الرفع', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="epm-overlay">
      <div className="epm-backdrop" onClick={onClose} />
      <div className="epm-modal">
        <div className="epm-header">
          <p className="epm-title">🖼 إثبات الفعالية</p>
          <p className="epm-sub">لـ: {event.event_name}</p>
          <button className="epm-close" onClick={onClose}>✕</button>
        </div>
        <div className="epm-body">
          <div className="epm-rule">
            أرفق صورة إعلان الفعالية أو رابط تغريدة/منشور رسمي لتتمكن الإدارة من التحقق منها.
          </div>

          {/* Toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {(['image', 'link'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => { setProofType(t); setFile(null); setPreview(''); setProofUrl(''); }}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 10, border: '1.5px solid',
                  borderColor: proofType === t ? '#7c3aed' : 'rgba(100,116,139,0.2)',
                  background: proofType === t ? 'rgba(124,58,237,0.1)' : 'transparent',
                  color: proofType === t ? '#7c3aed' : '#64748b',
                  fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}>
                {t === 'image' ? '🖼 رفع صورة' : '🔗 رابط تغريدة/منشور'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            {proofType === 'image' ? (
              <div className="epm-field">
                <label className="epm-label">صورة الإعلان (JPG/PNG — حتى 5MB)</label>
                <input type="file" accept="image/*" onChange={handleFileChange}
                  style={{ width: '100%', padding: '8px', borderRadius: 10, border: '1.5px dashed rgba(100,116,139,0.35)',
                    background: 'transparent', fontFamily: "'Tajawal',sans-serif", cursor: 'pointer' }} />
                {preview && (
                  <img src={preview} alt="معاينة"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />
                )}
              </div>
            ) : (
              <div className="epm-field">
                <label className="epm-label">رابط التغريدة / المنشور / الإعلان</label>
                <input className="epm-input" type="url" value={proofUrl}
                  onChange={e => setProofUrl(e.target.value)}
                  placeholder="https://twitter.com/..." />
              </div>
            )}

            <button type="submit" disabled={uploading} className="epm-submit">
              {uploading
                ? <><span className="epm-spin" /> جاري الرفع...</>
                : <>📤 إرسال للمراجعة</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Admin Events Queue
══════════════════════════════════════════ */
function AdminEventsQueue({ isDarkMode = false, onClose, onEventApproved }: { isDarkMode?: boolean; onClose: () => void; onEventApproved?: () => void }) {
  const { showToast } = useToast();
  const dm = isDarkMode;
  const [items, setItems]           = useState<Event[]>([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab]               = useState<'all' | 'pending_proof' | 'pending_admin'>('all');
  const [counts, setCounts]         = useState({ all: 0, pending_proof: 0, pending_admin: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('is_active', false),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('pending_status', 'pending_proof').eq('is_active', false),
        supabase.from('events').select('*', { count: 'exact', head: true }).eq('pending_status', 'pending_admin').eq('is_active', false),
      ]);
      setCounts({ all: c1 || 0, pending_proof: c2 || 0, pending_admin: c3 || 0 });
    } catch {}
  }, []);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('events')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: true });
      if (tab === 'pending_proof') {
        query = query.eq('pending_status', 'pending_proof');
      } else if (tab === 'pending_admin') {
        query = query.eq('pending_status', 'pending_admin');
      }
      const { data, error } = await query;
      if (error) throw error;
      setItems(data || []);
    } catch {
      showToast('حدث خطأ في التحميل', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, tab]);

  useEffect(() => { loadPending(); fetchCounts(); }, [loadPending, fetchCounts]);

  const handleApprove = async (id: string) => {
    if (processing) return;
    setProcessing(id);
    try {
      const { data, error } = await supabase
        .from('events')
        .update({ is_active: true, pending_status: 'approved' })
        .eq('id', id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        showToast('⚠️ تعذّر الاعتماد: تحقق من صلاحيات Supabase', 'error');
        return;
      }
      setItems(prev => prev.filter(ev => ev.id !== id));
      showToast('✅ تم اعتماد الفعالية ونشرها', 'success');
      onEventApproved?.();
      await fetchCounts();

      // إشعار العميل باعتماد فعاليته
      const approved = data[0];
      if (approved?.user_id) {
        await notifyItemApproved({
          clientUserId: approved.user_id,
          itemType:     'event',
          itemName:     approved.event_name || 'الفعالية',
          itemId:       id,
        });
      }
    } catch {
      showToast('حدث خطأ', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    if (processing) return;
    if (!window.confirm('هل أنت متأكد من رفض وحذف هذه الفعالية؟')) return;
    setProcessing(id);
    try {
      // جلب بيانات الفعالية قبل الحذف
      const { data: evData } = await supabase
        .from('events').select('user_id, event_name').eq('id', id).maybeSingle();

      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(ev => ev.id !== id));
      showToast('🗑️ تم رفض الفعالية وحذفها', 'success');
      await fetchCounts();

      // إشعار العميل بالرفض
      if (evData?.user_id) {
        await notifyItemRejected({
          clientUserId: evData.user_id,
          itemType:     'event',
          itemName:     evData.event_name || 'الفعالية',
          itemId:       id,
        });
      }
    } catch {
      showToast('حدث خطأ', 'error');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="aeq-wrap">
      <div className="aeq-backdrop" onClick={onClose} />
      <div className="aeq-panel">
        <div className="aeq-header">
          <div className="aeq-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <p className="aeq-title">🛡️ مراجعة الفعاليات</p>
              <p className="aeq-sub">راجع الإثبات واعتمد أو ارفض</p>
            </div>
            <button className="aeq-close" onClick={onClose}>✕</button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {([
              { key: 'all',           label: '📋 الكل',              count: counts.all },
              { key: 'pending_admin', label: '🔍 بانتظار المراجعة',  count: counts.pending_admin },
              { key: 'pending_proof', label: '🖼 بانتظار الإثبات',   count: counts.pending_proof },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '6px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontFamily: "'Tajawal',sans-serif", fontSize: 12, fontWeight: 700,
                  background: tab === t.key ? '#7c3aed' : dm ? 'rgba(255,255,255,0.06)' : '#f1f5f9',
                  color: tab === t.key ? '#fff' : dm ? '#94a3b8' : '#475569',
                  display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0,
                }}
              >
                {t.label}
                <span style={{
                  background: tab === t.key ? 'rgba(255,255,255,0.25)' : dm ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                  color: tab === t.key ? '#fff' : dm ? '#cbd5e1' : '#64748b',
                  borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 800,
                }}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="aeq-body">
          {loading ? (
            <><div className="aeq-shimmer" /><div className="aeq-shimmer" style={{ opacity: 0.6 }} /></>
          ) : items.length === 0 ? (
            <div className="aeq-empty">
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <p style={{ fontWeight: 800, margin: '0 0 4px', color: dm ? '#e2e8f0' : '#0f172a' }}>لا توجد فعاليات معلقة</p>
              <p style={{ fontSize: 13, margin: 0 }}>كل الفعاليات تمت مراجعتها</p>
            </div>
          ) : (
            <>
              <div className="aeq-counter">🕐 {items.length} فعالية بانتظار المراجعة</div>
              {items.map((ev, i) => {
                const typeInfo = EVENT_TYPES[ev.event_type] || EVENT_TYPES['أخرى'];
                const busy = processing === ev.id;
                const ps = ev.pending_status;
                const psColor = ps === 'pending_proof' ? '#d97706' : '#0891b2';
                const psLabel = ps === 'pending_proof' ? 'بانتظار الإثبات' : 'بانتظار المراجعة';
                return (
                  <div key={ev.id} className="aeq-card" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="aeq-card-top">
                      <div>
                        <p className="aeq-name">{ev.event_name}</p>
                        <p className="aeq-org">🏢 {ev.organizer}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                        <span className="aeq-type-tag">{typeInfo.icon} {typeInfo.label}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${psColor}18`, color: psColor, border: `1px solid ${psColor}30` }}>
                          {psLabel}
                        </span>
                      </div>
                    </div>
                    <div className="aeq-detail">📍 {ev.city}{ev.location_detail ? ` — ${ev.location_detail}` : ''}</div>
                    <div className="aeq-detail">
                      📆 {new Date(ev.event_date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="aeq-detail">👥 {ev.volunteers_needed} متطوع مطلوب</div>
                    {ev.description && (
                      <div className="aeq-detail" style={{ display: 'block', lineHeight: 1.5 }}>
                        {ev.description.slice(0, 140)}{ev.description.length > 140 ? '...' : ''}
                      </div>
                    )}
                    {/* Proof Section */}
                    {ev.proof_url ? (
                      <div style={{ background: dm ? 'rgba(8,145,178,0.08)' : '#ecfeff', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 8, padding: '8px 12px', margin: '8px 0' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#0891b2', marginBottom: 4 }}>🖼 إثبات الفعالية:</div>
                        {ev.proof_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <img src={ev.proof_url} alt="إثبات" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 6, cursor: 'pointer' }}
                            onClick={() => window.open(ev.proof_url, '_blank')} />
                        ) : (
                          <a href={ev.proof_url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 12, color: '#0891b2', fontWeight: 600, wordBreak: 'break-all' }}>
                            🔗 {ev.proof_file_name || ev.proof_url}
                          </a>
                        )}
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#d97706', margin: '8px 0' }}>
                        ⚠️ لم يتم إرفاق إثبات — يمكنك الاعتماد بدونه
                      </div>
                    )}
                    <div className="aeq-actions">
                      <button className="aeq-btn aeq-reject" disabled={!!processing} onClick={() => handleReject(ev.id)}>
                        {busy ? <span className="aeq-spin" style={{ borderTopColor: '#dc2626' }} /> : '✕'} رفض وحذف
                      </button>
                      <button className="aeq-btn aeq-approve" disabled={!!processing} onClick={() => handleApprove(ev.id)}>
                        {busy ? <span className="aeq-spin" /> : '✓'} اعتماد ✅
                      </button>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}