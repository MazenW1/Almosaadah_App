// pages/JobsPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  notifyAdminNewJob,
  notifyItemApproved,
  notifyItemRejected,
} from '../lib/notificationHelpers';

/* ─────────────────────────────────────────
   Security Helpers — كود حماية متكامل
───────────────────────────────────────── */

// 1. تنظيف شامل من XSS + SQL Injection + Script Injection
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

// 2. URL Validator — يمنع Open Redirect + SSRF
const BLOCKED_HOSTS   = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254'];
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

const isAllowedUrl = (url: string): boolean => {
  if (!isValidUrl(url)) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !BLOCKED_DOMAINS.some(d => host.includes(d));
  } catch { return false; }
};

// 3. Email Validator
const isValidEmail = (email: string): boolean => {
  if (!email) return true;
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(email);
};

// 4. Saudi Phone Validator
const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s-]/g, '');
  return /^(05\d{8}|5\d{8}|\+9665\d{8}|009665\d{8})$/.test(cleaned);
};

// 5. Rate Limiter — DDoS + Brute Force Protection (Exponential Backoff)
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
const submitRateLimiter = createRateLimiter(3,  120000, 'submit-job');
const searchRateLimiter = createRateLimiter(30, 10000,  'search');

// 6. Input Length Limits
const LIMITS = {
  job_title: 100, job_description: 1000, requirements: 500,
  benefits: 300, city: 80, salary_range: 80, education_level: 100,
  contact_email: 100, contact_phone: 15,
} as const;

// 7. Safe URL opener
const safeOpenUrl = (url: string): void => {
  if (!isValidUrl(url)) return;
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.click();
};

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
type JobStatus = 'draft' | 'pending_proof' | 'pending_admin' | 'active' | 'rejected' | 'closed';
type WorkType   = 'remote' | 'field' | 'hybrid';
type Gender     = 'male' | 'female' | 'both';
type ApplyMethod = 'whatsapp' | 'twitter' | 'link' | 'email';

const APPLY_METHOD_INFO: Record<ApplyMethod, { label: string; icon: string; placeholder: string }> = {
  whatsapp: { label: 'واتساب',  icon: '📱', placeholder: '05xxxxxxxx' },
  twitter:  { label: 'X (تويتر)', icon: '𝕏', placeholder: 'https://x.com/...' },
  link:     { label: 'رابط',    icon: '🔗', placeholder: 'https://...' },
  email:    { label: 'إيميل',   icon: '📧', placeholder: 'hr@org.com' },
};

interface Job {
  id: string; user_id: string; association_name?: string;
  job_title: string; job_description: string; requirements: string;
  benefits?: string; work_type: WorkType; city: string;
  salary_range?: string; gender: Gender; min_experience?: number;
  education_level?: string; vacancies: number; deadline?: string;
  contact_email?: string; contact_phone?: string;
  apply_method?: ApplyMethod; apply_url?: string; apply_phone?: string;
  proof_url?: string; proof_file_name?: string;
  is_verified: boolean; status: JobStatus; created_at: string;
  user?: { association_name: string };
}

const WORK_TYPE: Record<WorkType, { label: string; icon: string; color: string; bg: string; darkBg: string }> = {
  remote: { label: 'عن بُعد', icon: '🏠', color: '#7c3aed', bg: '#f3e8ff',  darkBg: 'rgba(124,58,237,0.18)' },
  field:  { label: 'ميداني',  icon: '🏢', color: '#0891b2', bg: '#e0f2fe',  darkBg: 'rgba(8,145,178,0.18)'  },
  hybrid: { label: 'هجين',    icon: '⚡', color: '#ea580c', bg: '#ffedd5',  darkBg: 'rgba(234,88,12,0.18)'  },
};

const STATUS_INFO: Record<JobStatus, { label: string; color: string; bg: string; darkBg: string }> = {
  draft:         { label: 'مسودة',              color: '#64748b', bg: '#f1f5f9', darkBg: 'rgba(100,116,139,0.15)' },
  pending_proof: { label: 'بانتظار الرابط',     color: '#d97706', bg: '#fef9c3', darkBg: 'rgba(217,119,6,0.15)'  },
  pending_admin: { label: 'قيد مراجعة الإدارة', color: '#0891b2', bg: '#ecfeff', darkBg: 'rgba(8,145,178,0.15)'  },
  active:        { label: 'نشطة',               color: '#16a34a', bg: '#dcfce7', darkBg: 'rgba(22,163,74,0.15)'  },
  rejected:      { label: 'مرفوضة',             color: '#dc2626', bg: '#fee2e2', darkBg: 'rgba(220,38,38,0.15)'  },
  closed:        { label: 'مغلقة',              color: '#64748b', bg: '#f1f5f9', darkBg: 'rgba(100,116,139,0.15)' },
};

const SAUDI_CITIES = [
  'الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الظهران','الطائف','تبوك',
  'بريدة','خميس مشيط','الهفوف','المبرز','حائل','نجران','الجبيل','ينبع','القطيف','عرعر',
  'سكاكا','جازان','أبها','الباحة','بيشة','الدوادمي','الخرج','المجمعة','الزلفي','شقراء',
];

const EDUCATION_LEVELS = [
  'ثانوي',
  'دبلوم',
  'بكالوريوس',
  'ماجستير',
  'دكتوراه',
];

const INITIAL_FORM = {
  job_title: '', job_description: '', requirements: '', benefits: '',
  work_type: 'field' as WorkType, city: '', salary_range: '',
  gender: 'both' as Gender, min_experience: 0, education_level: '',
  vacancies: 1, deadline: '', contact_email: '', contact_phone: '',
  apply_method: 'whatsapp' as ApplyMethod, apply_url: '', apply_phone: '',
  proof_url: '',
};

/* ─────────────────────────────────────────
   Hook: useDarkMode
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   Global CSS — Static (no flicker on theme/modal change)
───────────────────────────────────────── */
const GLOBAL_STYLE = `

/* ── Modal open: lock scroll without layout shift ── */
body.modal-open { overflow: hidden !important; }
@supports (scrollbar-gutter: stable) {
  body.modal-open { scrollbar-gutter: stable; overflow: hidden !important; }
}
/* Compensate sticky headers for scrollbar width */
body.modal-open { padding-right: 0 !important; }
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
*{box-sizing:border-box;}

/* ── Keyframes ── */
@keyframes jbFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }to{opacity:1;transform:translateY(0)}}
@keyframes jbCardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes jbModalIn { from { opacity: 0; transform: translateY(22px); } to { opacity: 1; transform: translateY(0); } }to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes jbShim { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }100%{background-position:200% 0}}
@keyframes jbSpin      {to{transform:rotate(360deg)}}
@keyframes jbIconBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }50%{transform:translateY(-8px) scale(1.1)}}
@keyframes pulseDot { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }50%{opacity:.4}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;}}

/* ── Light Mode Variables ── */
:root {
  --jb-hero-icon-bg:      linear-gradient(135deg,#ede9fe,#ddd6fe);
  --jb-hero-icon-shadow:  0 8px 32px rgba(124,58,237,0.2);
  --jb-title-color:       #0f172a;
  --jb-sub-color:         #64748b;
  --jb-badge-bg:          rgba(124,58,237,0.08);
  --jb-badge-border:      rgba(124,58,237,0.2);
  --jb-lbl-color:         #94a3b8;
  --jb-search-border:     #e2e8f0;
  --jb-search-bg:         rgba(255,255,255,0.9);
  --jb-search-color:      #0f172a;
  --jb-search-placeholder:#94a3b8;
  --jb-filter-border:     #e2e8f0;
  --jb-filter-bg:         rgba(255,255,255,0.85);
  --jb-filter-color:      #475569;
  --jb-card-bg:           rgba(255,255,255,0.98);
  --jb-card-border:       #e2e8f0;
  --jb-card-shadow:       0 2px 16px rgba(0,0,0,0.05);
  --jb-card-title:        #0f172a;
  --jb-card-desc:         #64748b;
  --jb-info-bg:           #f8fafc;
  --jb-info-border:       #e2e8f0;
  --jb-info-lbl:          #94a3b8;
  --jb-info-val:          #0f172a;
  --jb-tag-bg:            #f1f5f9;
  --jb-tag-color:         #475569;
  --jb-tag-border:        #e2e8f0;
  --jb-footer-border:     #f1f5f9;
  --jb-nav-tab-bg:        #ffffff;
  --jb-nav-tab-color:     #64748b;
  --jb-nav-tab-border:    #e2e8f0;
  --jb-modal-bg:          #ffffff;
  --jb-modal-border:      #e2e8f0;
  --jb-modal-shadow:      0 32px 80px rgba(0,0,0,0.18);
  --jb-input-bg:          #f8fafc;
  --jb-input-border:      #e2e8f0;
  --jb-input-color:       #0f172a;
  --jb-input-placeholder: #94a3b8;
  --jb-label-color:       #475569;
  --jb-section-line:      #e2e8f0;
  --jb-chip-border:       #e2e8f0;
  --jb-chip-color:        #64748b;
  --jb-char-count:        #94a3b8;
  --jb-my-card-bg:        rgba(255,255,255,0.95);
  --jb-my-card-border:    #e2e8f0;
  --jb-my-divider:        #f1f5f9;
  --jb-my-title:          #0f172a;
  --jb-my-sub:            #94a3b8;
  --jb-skel-bg:           linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
  --jb-empty-color:       #94a3b8;
  --jb-ajq-bg:            #ffffff;
  --jb-ajq-border:        #e2e8f0;
  --jb-ajq-card-bg:       #fafafa;
  --jb-ajq-card-border:   #e2e8f0;
  --jb-ajq-title:         #0f172a;
  --jb-ajq-shimmer:       linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%);
  --jb-pum-bg:            #ffffff;
  --jb-pum-border:        #e2e8f0;
  --jb-pum-input-bg:      #f8fafc;
  --jb-pum-label:         #475569;
  --jb-pum-rule-bg:       #fef9c3;
  --jb-pum-rule-border:   #fde047;
  --jb-pum-rule-color:    #713f12;
}

/* ── Dark Mode Variables ── */
.dark {
  --jb-hero-icon-bg:      linear-gradient(135deg,#1e3a5f,#7c3aed);
  --jb-hero-icon-shadow:  0 8px 32px rgba(124,58,237,0.4);
  --jb-title-color:       #f1f5f9;
  --jb-sub-color:         #94a3b8;
  --jb-badge-bg:          rgba(124,58,237,0.12);
  --jb-badge-border:      rgba(124,58,237,0.3);
  --jb-lbl-color:         #64748b;
  --jb-search-border:     #334155;
  --jb-search-bg:         rgba(30,41,59,0.9);
  --jb-search-color:      #f1f5f9;
  --jb-search-placeholder:#475569;
  --jb-filter-border:     #334155;
  --jb-filter-bg:         rgba(30,41,59,0.8);
  --jb-filter-color:      #94a3b8;
  --jb-card-bg:           rgba(22,31,48,0.97);
  --jb-card-border:       rgba(51,65,85,0.7);
  --jb-card-shadow:       0 2px 20px rgba(0,0,0,0.3);
  --jb-card-title:        #f1f5f9;
  --jb-card-desc:         #94a3b8;
  --jb-info-bg:           rgba(30,41,59,0.8);
  --jb-info-border:       rgba(51,65,85,0.5);
  --jb-info-lbl:          #64748b;
  --jb-info-val:          #e2e8f0;
  --jb-tag-bg:            rgba(51,65,85,0.6);
  --jb-tag-color:         #cbd5e1;
  --jb-tag-border:        rgba(71,85,105,0.5);
  --jb-footer-border:     rgba(51,65,85,0.5);
  --jb-nav-tab-bg:        #1e293b;
  --jb-nav-tab-color:     #94a3b8;
  --jb-nav-tab-border:    #334155;
  --jb-modal-bg:          #111827;
  --jb-modal-border:      rgba(51,65,85,0.8);
  --jb-modal-shadow:      0 32px 80px rgba(0,0,0,0.5);
  --jb-input-bg:          #1e293b;
  --jb-input-border:      #334155;
  --jb-input-color:       #f1f5f9;
  --jb-input-placeholder: #475569;
  --jb-label-color:       #94a3b8;
  --jb-section-line:      #334155;
  --jb-chip-border:       #334155;
  --jb-chip-color:        #94a3b8;
  --jb-char-count:        #475569;
  --jb-my-card-bg:        rgba(22,31,48,0.97);
  --jb-my-card-border:    rgba(51,65,85,0.7);
  --jb-my-divider:        rgba(51,65,85,0.5);
  --jb-my-title:          #f1f5f9;
  --jb-my-sub:            #64748b;
  --jb-skel-bg:           linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);
  --jb-empty-color:       #475569;
  --jb-ajq-bg:            #111827;
  --jb-ajq-border:        rgba(51,65,85,0.8);
  --jb-ajq-card-bg:       rgba(15,23,42,0.7);
  --jb-ajq-card-border:   #334155;
  --jb-ajq-title:         #f1f5f9;
  --jb-ajq-shimmer:       linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);
  --jb-pum-bg:            #111827;
  --jb-pum-border:        rgba(51,65,85,0.8);
  --jb-pum-input-bg:      #1e293b;
  --jb-pum-label:         #94a3b8;
  --jb-pum-rule-bg:       rgba(254,249,195,0.07);
  --jb-pum-rule-border:   rgba(253,224,71,0.25);
  --jb-pum-rule-color:    #fbbf24;
}

/* ══════════════════════════════════════════
   HERO
══════════════════════════════════════════ */
.jb-hero{padding:100px 24px 52px;position:relative;z-index:10;animation:jbFadeUp .7s ease both;}
.jb-hero-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:32px;flex-wrap:wrap;}
.jb-hero-text{flex:1;min-width:240px;}
.jb-hero-icon{width:72px;height:72px;border-radius:22px;background:var(--jb-hero-icon-bg);box-shadow:var(--jb-hero-icon-shadow);display:flex;align-items:center;justify-content:center;font-size:32px;margin-bottom:16px;animation:jbIconBounce 3s ease-in-out infinite;flex-shrink:0;}
.jb-hero-title{font-size:clamp(22px,4vw,38px);font-weight:900;margin:0 0 8px;color:var(--jb-title-color);}
.jb-hero-sub{font-size:14px;margin:0;line-height:1.6;color:var(--jb-sub-color);}
.jb-total-badge{padding:14px 24px;border-radius:18px;text-align:center;backdrop-filter:blur(12px);flex-shrink:0;background:var(--jb-badge-bg);border:1px solid var(--jb-badge-border);}
.jb-total-num{font-size:36px;font-weight:900;color:#7c3aed;line-height:1;}
.jb-total-lbl{font-size:12px;font-weight:700;margin-top:4px;color:var(--jb-lbl-color);}

/* ══════════════════════════════════════════
   AUTH BANNER
══════════════════════════════════════════ */
.jb-auth-banner{max-width:1200px;margin:0 auto 4px;padding:0 24px;position:relative;z-index:10;}
.jb-auth-box{border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:10px;font-size:13px;font-weight:600;background:rgba(124,58,237,.07);border:1px solid rgba(124,58,237,.2);color:#7c3aed;cursor:pointer;transition:background .2s;}
.jb-auth-box:hover{background:rgba(124,58,237,.12);}
.jb-auth-link{font-weight:800;text-decoration:underline;margin-right:auto;}

/* ══════════════════════════════════════════
   NAV TABS
══════════════════════════════════════════ */
.jb-nav{max-width:1200px;margin:20px auto 0;padding:0 24px 4px;position:relative;z-index:10;display:flex;gap:8px;flex-wrap:wrap;}
.jb-nav-tab{padding:10px 20px;border-radius:12px;border:none;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:800;transition:all .2s;}
.jb-nav-tab.active{background:#7c3aed;color:white;box-shadow:0 4px 16px rgba(124,58,237,.35);}
.jb-nav-tab:not(.active){background:var(--jb-nav-tab-bg);color:var(--jb-nav-tab-color);border:1px solid var(--jb-nav-tab-border);}
.jb-nav-tab:not(.active):hover{border-color:#7c3aed;color:#7c3aed;}

/* ══════════════════════════════════════════
   SEARCH
══════════════════════════════════════════ */
.jb-search-wrap{max-width:1200px;margin:16px auto 0;padding:0 24px;position:relative;z-index:10;}
.jb-search-inner{position:relative;}
.jb-search-input{width:100%;padding:12px 20px 12px 44px;border-radius:14px;font-family:'Tajawal',sans-serif;font-size:14px;outline:none;transition:border-color .2s,background .2s,color .2s;backdrop-filter:blur(12px);box-sizing:border-box;border:1.5px solid var(--jb-search-border);background:var(--jb-search-bg);color:var(--jb-search-color);}
.jb-search-input::placeholder{color:var(--jb-search-placeholder);}
.jb-search-input:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12);}
.jb-search-icon{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:#94a3b8;pointer-events:none;}

/* ══════════════════════════════════════════
   FILTER BAR
══════════════════════════════════════════ */
.jb-filter-bar{max-width:1200px;margin:16px auto 0;padding:0 24px;display:flex;gap:8px;flex-wrap:wrap;position:relative;z-index:10;}
.jb-filter-btn{padding:9px 16px;border-radius:50px;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:700;cursor:pointer;transition:all .25s;backdrop-filter:blur(8px);border:1.5px solid var(--jb-filter-border);background:var(--jb-filter-bg);color:var(--jb-filter-color);}
.jb-filter-btn.active{background:#7c3aed;color:white;border-color:transparent;box-shadow:0 4px 14px rgba(124,58,237,.3);transform:translateY(-1px);}
.jb-filter-btn:not(.active):hover{border-color:#7c3aed;color:#7c3aed;}

/* ══════════════════════════════════════════
   GRID
══════════════════════════════════════════ */
.jb-grid{max-width:1200px;margin:28px auto;padding:0 16px 100px;display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:18px;position:relative;z-index:10;}

/* ══════════════════════════════════════════
   JOB CARD
══════════════════════════════════════════ */
.jb-card{
  border-radius:20px;
  overflow:hidden;
  backdrop-filter:blur(12px);
  transition:transform .3s cubic-bezier(.34,1.56,.64,1),box-shadow .3s,border-color .2s;
  animation:jbCardIn .5s ease both;
  position:relative;
  background:var(--jb-card-bg);
  border:1.5px solid var(--jb-card-border);
  box-shadow:var(--jb-card-shadow);
  display:flex;
  flex-direction:column;
}
.jb-card:hover{transform:translateY(-6px);box-shadow:0 20px 50px rgba(0,0,0,.15);border-color:rgba(124,58,237,.4);}
.jb-card-stripe{height:4px;width:100%;flex-shrink:0;}
.jb-card-body-wrap{padding:18px;flex:1;display:flex;flex-direction:column;}
.jb-card-header{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:12px;}
.jb-card-icon-wrap{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
.jb-card-icon{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.jb-card-title{font-size:15px;font-weight:900;margin:0 0 3px;line-height:1.3;color:var(--jb-card-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jb-card-org{font-size:12px;color:#7c3aed;font-weight:700;margin:0;display:flex;align-items:center;gap:4px;}
.jb-card-desc{font-size:13px;margin:0 0 14px;line-height:1.6;color:var(--jb-card-desc);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}

/* Info grid — مستطيلات واضحة */
.jb-info-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:14px;}
.jb-info-item{
  padding:9px 11px;
  border-radius:10px;
  background:var(--jb-info-bg);
  border:1px solid var(--jb-info-border);
}
.jb-info-lbl{font-size:10px;color:var(--jb-info-lbl);font-weight:600;margin-bottom:3px;line-height:1;}
.jb-info-val{font-size:12.5px;font-weight:700;color:var(--jb-info-val);line-height:1.2;}

/* Tags */
.jb-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;}
.jb-tag{
  font-size:11.5px;
  font-weight:700;
  padding:4px 10px;
  border-radius:8px;
  background:var(--jb-tag-bg);
  color:var(--jb-tag-color);
  border:1px solid var(--jb-tag-border);
  white-space:nowrap;
}

/* Footer */
.jb-card-footer{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  padding-top:14px;
  border-top:1px solid var(--jb-footer-border);
  margin-top:auto;
}
.jb-work-badge{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;font-size:12px;font-weight:700;border:1px solid transparent;}
.jb-apply-btn{padding:8px 16px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:800;transition:all .2s;display:flex;align-items:center;gap:6px;white-space:nowrap;}
.jb-apply-btn:hover{opacity:.88;transform:translateY(-2px);box-shadow:0 4px 12px rgba(124,58,237,.3);}
.jb-verified-badge{display:flex;align-items:center;gap:4px;background:rgba(22,163,74,.1);color:#16a34a;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;border:1px solid rgba(22,163,74,.2);white-space:nowrap;}
.jb-deadline-badge{position:absolute;top:14px;left:14px;font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;z-index:2;}
.jb-new-badge{position:absolute;top:14px;right:14px;font-size:10px;font-weight:800;padding:3px 9px;border-radius:6px;background:rgba(124,58,237,.15);color:#7c3aed;border:1px solid rgba(124,58,237,.2);z-index:2;}

/* ══════════════════════════════════════════
   MY JOBS
══════════════════════════════════════════ */
.jb-my-wrap{max-width:760px;margin:28px auto;padding:0 16px 100px;position:relative;z-index:10;}
.jb-my-card{
  border-radius:18px;
  overflow:hidden;
  margin-bottom:14px;
  animation:jbCardIn .35s ease both;
  backdrop-filter:blur(12px);
  background:var(--jb-my-card-bg);
  border:1.5px solid var(--jb-my-card-border);
}
.jb-my-card-header{padding:14px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:10px;border-bottom:1px solid var(--jb-my-divider);}
.jb-my-card-body{padding:12px 18px;}
.jb-my-title{font-weight:800;font-size:15px;color:var(--jb-my-title);margin:0 0 4px;}
.jb-my-sub{font-size:12px;color:var(--jb-my-sub);margin:0;}
.jb-status-badge{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:8px;font-size:11px;font-weight:800;white-space:nowrap;border:1px solid transparent;}

/* ══════════════════════════════════════════
   PROOF BANNER
══════════════════════════════════════════ */
.jb-proof-required{background:rgba(234,179,8,.08);border:1.5px solid rgba(234,179,8,.3);border-radius:14px;padding:14px 18px;margin-bottom:14px;}
.jb-proof-title{font-size:14px;font-weight:800;color:#d97706;margin:0 0 4px;display:flex;align-items:center;gap:7px;}
.jb-proof-text{font-size:12px;color:#92400e;line-height:1.6;margin:0 0 12px;}
.dark .jb-proof-text{color:#fbbf24;}
.jb-proof-upload-btn{padding:9px 18px;border-radius:10px;border:1.5px solid #d97706;cursor:pointer;background:rgba(234,179,8,.1);color:#d97706;font-family:'Tajawal',sans-serif;font-size:13px;font-weight:800;transition:all .2s;display:flex;align-items:center;gap:7px;width:fit-content;}
.jb-proof-upload-btn:hover{background:rgba(234,179,8,.18);}

/* ══════════════════════════════════════════
   FABs
══════════════════════════════════════════ */
.jb-fab{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;cursor:pointer;border-radius:50px;padding:14px 28px;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;box-shadow:0 8px 30px rgba(124,58,237,.45);transition:all .3s cubic-bezier(.34,1.56,.64,1);z-index:40;}
.jb-fab:hover{transform:translateX(-50%) translateY(-3px) scale(1.03);}
.jb-admin-fab{position:fixed;bottom:32px;left:32px;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;border:none;cursor:pointer;font-size:22px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(124,58,237,0.45);transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1);z-index:50;}
.jb-admin-fab:hover{transform:scale(1.12) rotate(10deg);}

/* ══════════════════════════════════════════
   FORM MODAL
══════════════════════════════════════════ */
.jb-overlay{position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.jb-backdrop{position:absolute;inset:0;background:rgba(2,10,20,.72);backdrop-filter:blur(8px);}
.jb-modal{position:relative;width:100%;max-width:680px;max-height:min(92vh,calc(100dvh - 24px));border-radius:20px;box-shadow:var(--jb-modal-shadow);display:flex;flex-direction:column;overflow:hidden;animation:jbModalIn .3s cubic-bezier(.22,.68,0,1.2) both;background:var(--jb-modal-bg);border:1px solid var(--jb-modal-border);}
.jb-modal-header{padding:20px 20px 16px;background:linear-gradient(135deg,#0c1a2e,#1a0a3e);flex-shrink:0;position:relative;}
.jb-modal-title{font-size:18px;font-weight:900;color:white;margin:0 0 4px;}
.jb-modal-subtitle{font-size:12px;color:#94a3b8;margin:0;}
.jb-modal-close{position:absolute;top:14px;left:14px;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#94a3b8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:14px;transition:all .2s;}
.jb-modal-close:hover{background:rgba(239,68,68,.2);color:#fca5a5;}
.jb-modal-body{flex:1;overflow-y:auto;padding:20px;}
.jb-modal-body::-webkit-scrollbar{width:4px;}
.jb-modal-body::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}

/* Form fields */
.jb-section-label{font-size:11px;font-weight:800;letter-spacing:.08em;color:#7c3aed;text-transform:uppercase;margin:0 0 14px;display:flex;align-items:center;gap:6px;}
.jb-section-label::after{content:'';flex:1;height:1px;background:var(--jb-section-line);}
.jb-field{margin-bottom:14px;}
.jb-label{display:block;font-size:13px;font-weight:700;margin-bottom:6px;color:var(--jb-label-color);}
.jb-req{color:#ef4444;margin-left:3px;}
.jb-input,.jb-select,.jb-textarea{width:100%;padding:10px 14px;border-radius:10px;font-size:14px;font-family:'Tajawal',sans-serif;font-weight:500;transition:border-color .2s,background .2s,color .2s;outline:none;box-sizing:border-box;background:var(--jb-input-bg);border:1.5px solid var(--jb-input-border);color:var(--jb-input-color);}
.jb-input::placeholder,.jb-textarea::placeholder{color:var(--jb-input-placeholder);}
.jb-select option{background:var(--jb-modal-bg);color:var(--jb-input-color);}
.jb-input:focus,.jb-select:focus,.jb-textarea:focus{border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.12);}
.jb-textarea{resize:vertical;min-height:80px;}
.jb-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.jb-char-count{font-size:11px;color:var(--jb-char-count);text-align:left;margin-top:4px;}
.jb-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;}
.jb-chip{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;background:transparent;cursor:pointer;font-family:'Tajawal',sans-serif;transition:all .2s;border:1.5px solid var(--jb-chip-border);color:var(--jb-chip-color);}
.jb-chip.selected{background:#7c3aed;border-color:#7c3aed;color:white;}
.jb-chip:hover:not(.selected){border-color:#7c3aed;color:#7c3aed;}
.jb-governance-box{border-radius:14px;padding:14px 16px;margin-bottom:16px;background:linear-gradient(135deg,rgba(234,179,8,.08),rgba(234,88,12,.05));border:1.5px solid rgba(234,179,8,.3);}
.jb-gov-title{font-size:13px;font-weight:800;color:#d97706;margin:0 0 8px;display:flex;align-items:center;gap:8px;}
.jb-gov-steps{margin:0;padding:0;list-style:none;}
.jb-gov-step{font-size:12px;color:#92400e;padding:4px 0;display:flex;align-items:flex-start;gap:8px;line-height:1.5;}
.dark .jb-gov-step{color:#fbbf24;}
.jb-gov-step span{flex-shrink:0;margin-top:1px;}
.jb-submit{width:100%;padding:14px;border-radius:12px;border:none;cursor:pointer;background:linear-gradient(135deg,#7c3aed,#a855f7);color:white;font-family:'Tajawal',sans-serif;font-size:15px;font-weight:800;margin-top:8px;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-shadow:0 4px 20px rgba(124,58,237,.3);}
.jb-submit:hover:not(:disabled){opacity:.88;transform:translateY(-1px);}
.jb-submit:disabled{opacity:.6;cursor:not-allowed;}
.jb-spin{width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:jbSpin .6s linear infinite;display:inline-block;}

/* ══════════════════════════════════════════
   SKELETON & EMPTY
══════════════════════════════════════════ */
.jb-empty{grid-column:1/-1;text-align:center;padding:50px 16px;color:var(--jb-empty-color);}
.jb-skel{border-radius:20px;height:240px;background:var(--jb-skel-bg);background-size:200% 100%;animation:jbShim 1.2s infinite;}

/* ══════════════════════════════════════════
   ADMIN QUEUE
══════════════════════════════════════════ */
.ajq-wrap{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.ajq-backdrop{position:absolute;inset:0;background:rgba(2,10,20,.72);backdrop-filter:blur(8px);}
@keyframes ajqIn{from{opacity:0;transform:scale(.9) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
.ajq-panel{position:relative;width:100%;max-width:640px;max-height:min(88vh,calc(100dvh - 24px));border-radius:20px;background:var(--jb-ajq-bg);border:1px solid var(--jb-ajq-border);box-shadow:var(--jb-modal-shadow);display:flex;flex-direction:column;overflow:hidden;direction:rtl;font-family:'Tajawal',sans-serif;animation:ajqIn .3s cubic-bezier(.22,.68,0,1.2) both;}
.ajq-header{padding:18px 20px 0;flex-shrink:0;background:linear-gradient(135deg,#0c1a2e,#0f2d4a);}
.ajq-header-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.ajq-title{font-size:17px;font-weight:900;color:white;margin:0 0 2px;}
.ajq-sub{font-size:12px;color:#94a3b8;margin:0;}
.ajq-close{width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:#94a3b8;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.ajq-close:hover{background:rgba(239,68,68,.2);color:#fca5a5;}
.ajq-tabs{display:flex;gap:4px;}
.ajq-tab{flex:1;padding:10px 14px;border:none;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:700;border-radius:10px 10px 0 0;transition:all .22s;display:flex;align-items:center;justify-content:center;gap:6px;}
.ajq-tab.active{background:var(--jb-ajq-bg);color:#7c3aed;}
.ajq-tab:not(.active){background:rgba(255,255,255,.06);color:#94a3b8;}
.ajq-badge{min-width:18px;height:18px;border-radius:9px;padding:0 4px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;background:#fee2e2;color:#dc2626;}
.ajq-body{flex:1;overflow-y:auto;padding:16px;}
.ajq-body::-webkit-scrollbar{width:4px;}
.ajq-body::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
@keyframes ajqCardIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.ajq-card{border-radius:14px;border:1.5px solid var(--jb-ajq-card-border);background:var(--jb-ajq-card-bg);padding:14px;margin-bottom:12px;animation:ajqCardIn .3s ease both;}
.ajq-card-title{font-size:14px;font-weight:800;color:var(--jb-ajq-title);margin:0 0 2px;}
.ajq-card-org{font-size:12px;color:#7c3aed;font-weight:600;margin:0 0 8px;}
.ajq-detail{font-size:12px;color:#64748b;margin-bottom:4px;display:flex;align-items:center;gap:6px;}
.ajq-proof-box{background:rgba(254,249,195,0.15);border:1.5px solid rgba(253,224,71,0.3);border-radius:10px;padding:10px 12px;margin:8px 0;font-size:12px;color:#d97706;}
.dark .ajq-proof-box{background:rgba(217,119,6,0.1);color:#fbbf24;}
.ajq-proof-link{color:#d97706;font-weight:700;text-decoration:underline;word-break:break-all;}
.ajq-actions{display:flex;gap:8px;margin-top:10px;}
.ajq-btn{flex:1;padding:9px;border-radius:10px;border:none;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:5px;transition:all .2s;}
.ajq-reject{background:rgba(220,38,38,.1);color:#dc2626;}
.ajq-reject:hover:not(:disabled){background:rgba(220,38,38,.18);}
.ajq-approve{background:linear-gradient(135deg,#16a34a,#22c55e);color:white;}
.ajq-approve:hover:not(:disabled){opacity:.88;}
.ajq-btn:disabled{opacity:.5;cursor:not-allowed;}
.ajq-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:jbSpin .6s linear infinite;display:inline-block;}
.ajq-empty{text-align:center;padding:50px 16px;color:#94a3b8;}
.ajq-counter{display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:10px;background:rgba(124,58,237,.07);border:1px solid rgba(124,58,237,.15);font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:12px;}
.ajq-shimmer{border-radius:14px;height:130px;margin-bottom:12px;background:var(--jb-ajq-shimmer);background-size:200% 100%;animation:jbShim 1.2s infinite;}

/* ══════════════════════════════════════════
   PROOF UPLOAD MODAL
══════════════════════════════════════════ */
.pum-overlay{position:fixed;inset:0;z-index:400;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,12px) 12px env(safe-area-inset-bottom,12px);}
.pum-backdrop{position:absolute;inset:0;background:rgba(2,10,20,.8);backdrop-filter:blur(10px);}
@keyframes pumIn{from{opacity:0;transform:scale(.9) translateY(16px)}to{opacity:1;transform:scale(1) translateY(0)}}
.pum-modal{position:relative;width:100%;max-width:460px;max-height:min(90vh,calc(100dvh - 24px));border-radius:18px;background:var(--jb-pum-bg);border:1px solid var(--jb-pum-border);box-shadow:var(--jb-modal-shadow);overflow-y:auto;direction:rtl;font-family:'Tajawal',sans-serif;animation:pumIn .3s cubic-bezier(.22,.68,0,1.2) both;}
.pum-header{padding:18px 18px 14px;background:linear-gradient(135deg,#451a03,#78350f);}
.pum-title{font-size:16px;font-weight:900;color:white;margin:0 0 3px;}
.pum-sub{font-size:12px;color:#fde68a;margin:0;}
.pum-close{position:absolute;top:12px;left:12px;width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.1);border:none;color:#fde68a;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px;transition:background .2s;}
.pum-close:hover{background:rgba(255,255,255,.2);}
.pum-body{padding:18px;}
.pum-rule{background:var(--jb-pum-rule-bg);border:1.5px solid var(--jb-pum-rule-border);border-radius:12px;padding:12px;font-size:12px;color:var(--jb-pum-rule-color);line-height:1.7;margin-bottom:16px;}
.pum-field{margin-bottom:14px;}
.pum-label{display:block;font-size:13px;font-weight:700;color:var(--jb-pum-label);margin-bottom:5px;}
.pum-input,.pum-textarea{width:100%;padding:10px 12px;border-radius:10px;font-size:13px;font-family:'Tajawal',sans-serif;border:1.5px solid var(--jb-input-border);background:var(--jb-pum-input-bg);color:var(--jb-input-color);outline:none;transition:border-color .2s;box-sizing:border-box;}
.pum-input::placeholder,.pum-textarea::placeholder{color:var(--jb-input-placeholder);}
.pum-input:focus,.pum-textarea:focus{border-color:#d97706;box-shadow:0 0 0 3px rgba(217,119,6,.1);}
.pum-textarea{resize:vertical;min-height:60px;}
.pum-submit{width:100%;padding:12px;border-radius:10px;border:none;cursor:pointer;background:linear-gradient(135deg,#d97706,#f59e0b);color:white;font-family:'Tajawal',sans-serif;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;box-shadow:0 4px 16px rgba(217,119,6,.3);margin-top:6px;}
.pum-submit:hover:not(:disabled){opacity:.88;}
.pum-submit:disabled{opacity:.6;cursor:not-allowed;}
.pum-link-icon{text-align:center;font-size:32px;margin-bottom:12px;}
.pum-spin{width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.3);border-top-color:white;animation:jbSpin .6s linear infinite;display:inline-block;}

/* ══════════════════════════════════════════
   RESPONSIVE
══════════════════════════════════════════ */
@media(max-width:1024px){
  .jb-grid{grid-template-columns:repeat(auto-fill,minmax(260px,1fr));}
}
@media(max-width:768px){
  .jb-hero{padding:85px 16px 40px;}
  .jb-total-badge{display:none;}
  .jb-hero-title{font-size:clamp(20px,5vw,32px);}
  .jb-hero-sub{font-size:13px;}
  .jb-nav,.jb-filter-bar,.jb-search-wrap{padding:0 12px;}
  .jb-grid{grid-template-columns:1fr 1fr;padding:0 12px 100px;gap:14px;}
  .jb-my-wrap{padding:0 12px 100px;}
  .jb-fab{bottom:16px;font-size:13px;padding:12px 20px;}
  .jb-admin-fab{bottom:20px;left:20px;width:52px;height:52px;font-size:20px;}
  .jb-grid-2{grid-template-columns:1fr;}
  .jb-modal{max-height:95vh;border-radius:16px;}
  .jb-modal-body{padding:16px;}
  .jb-card-body-wrap{padding:16px;}
  .ajq-panel,.pum-modal{max-width:95vw;border-radius:14px;}
}
@media(max-width:600px){
  .jb-grid{grid-template-columns:1fr;}
}
@media(max-width:480px){
  .jb-hero{padding:80px 12px 32px;}
  .jb-hero-icon{width:56px;height:56px;font-size:26px;}
  .jb-nav{gap:6px;}
  .jb-nav-tab{padding:8px 14px;font-size:12px;}
  .jb-filter-btn{padding:7px 12px;font-size:12px;}
  .jb-card{border-radius:16px;}
  .jb-card-icon{width:40px;height:40px;font-size:18px;}
  .jb-info-grid{grid-template-columns:1fr;}
  .ajq-body{padding:12px;}
  .ajq-tab{padding:8px 10px;font-size:11px;}
}
@media(max-width:360px){
  .jb-hero{padding:70px 10px 28px;}
  .jb-card-body-wrap{padding:14px;}
  .jb-card-title{font-size:14px;}
  .jb-tags{gap:4px;}
  .jb-tag{font-size:10px;padding:3px 8px;}
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

export default function JobsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, isAdmin, isEmployee } = useAuth();
  const { showToast } = useToast();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const dm = isDarkMode;

  const [jobs, setJobs]                     = useState<Job[]>([]);
  const [myJobs, setMyJobs]                 = useState<Job[]>([]);
  const [loading, setLoading]               = useState(true);
  const [showForm, setShowForm]             = useState(false);
  const [showAdminQueue, setShowAdminQueue] = useState(false);
  const [showProofModal, setShowProofModal] = useState<Job | null>(null);
  const [selectedJob, setSelectedJob]       = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting]     = useState(false);
  const [filterWork, setFilterWork]         = useState<string>('all');
  const [activeTab, setActiveTab]           = useState<'browse' | 'my'>('browse');
  const [searchQuery, setSearchQuery]       = useState('');
  const [form, setForm]                     = useState(INITIAL_FORM);
  const [cityInput, setCityInput]           = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const isStaff = isAdmin || isEmployee;


  // منع اهتزاز الخلفية عند فتح أي مودال
  useEffect(() => {
    const isOpen = !!(showForm || showAdminQueue || showProofModal || selectedJob);
    if (isOpen) {
      document.documentElement.style.setProperty('--scrollbar-w', `${window.innerWidth - document.documentElement.clientWidth}px`);
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => { document.body.classList.remove('modal-open'); };
  }, [showForm, showAdminQueue, showProofModal, selectedJob]);

  const fetchJobsFromDB = useCallback(async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(200);
    console.log('[fetchJobsFromDB] data:', data?.length, 'error:', error);
    if (error) throw error;
    setJobs(data || []);
  }, []);

  // forceLoadJobs — تتجاوز الـ Rate Limiter (للاستخدام بعد الاعتماد مباشرة)
  const forceLoadJobs = useCallback(async () => {
    try {
      setLoading(true);
      await fetchJobsFromDB();
    } catch {
      showToast('حدث خطأ في تحميل الوظائف', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchJobsFromDB, showToast]);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      await fetchJobsFromDB();
    } catch (err) {
      console.error('[loadJobs] error:', err);
      showToast('حدث خطأ في تحميل الوظائف', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchJobsFromDB, showToast]);

  const loadMyJobs = useCallback(async () => {
    if (!user) return;
    if (!apiRateLimiter.canProceed()) return;
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMyJobs(data || []);
    } catch {}
  }, [user]);

  useEffect(() => { if (!authLoading) loadJobs(); }, [authLoading, loadJobs]);
  useEffect(() => { if (!authLoading && user) loadMyJobs(); }, [authLoading, user, loadMyJobs]);

  const resetForm = () => { setForm(INITIAL_FORM); setCityInput(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { showToast('يرجى تسجيل الدخول', 'error'); return; }

    const sanitizedTitle = sanitizeInput(form.job_title).slice(0, LIMITS.job_title);
    const sanitizedDesc  = sanitizeInput(form.job_description).slice(0, LIMITS.job_description);
    const sanitizedCity  = sanitizeInput(form.city).slice(0, LIMITS.city);
    const sanitizedReqs  = sanitizeInput(form.requirements).slice(0, LIMITS.requirements);
    const sanitizedBens  = sanitizeInput(form.benefits || '').slice(0, LIMITS.benefits);
    const sanitizedSal   = sanitizeInput(form.salary_range || '').slice(0, LIMITS.salary_range);
    const sanitizedEdu   = sanitizeInput(form.education_level || '').slice(0, LIMITS.education_level);

    if (!sanitizedTitle.trim()) { showToast('يرجى كتابة المسمى الوظيفي', 'error'); return; }
    if (!sanitizedDesc.trim())  { showToast('يرجى كتابة وصف الوظيفة', 'error'); return; }
    if (!sanitizedCity.trim())  { showToast('يرجى تحديد المدينة', 'error'); return; }

    if (form.contact_email && !isValidEmail(form.contact_email)) {
      showToast('يرجى إدخال بريد إلكتروني صحيح', 'error'); return;
    }
    if (form.contact_phone && !isValidPhone(form.contact_phone)) {
      showToast('يرجى إدخال رقم جوال صحيح (05xxxxxxxx)', 'error'); return;
    }

    const vacancies = Math.max(1, Math.min(999, Number(form.vacancies) || 1));
    const minExp    = Math.max(0, Math.min(30,  Number(form.min_experience) || 0));

    // ✅ يُسجّل فقط بعد نجاح كل التحققات
    if (!submitRateLimiter.canProceed()) {
      showToast('يرجى الانتظار قليلاً قبل إرسال وظيفة أخرى', 'error'); return;
    }

    setIsSubmitting(true);
    try {
      // ── منع التكرار: تحقق من وجود وظيفة نشطة أو قيد مراجعة بنفس العنوان
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', user.id)
        .eq('job_title', sanitizeInput(form.job_title))
        .not('status', 'in', '("rejected","closed")')
        .maybeSingle();
      if (existingJob) {
        showToast('⚠️ لديك وظيفة بنفس العنوان لا تزال نشطة أو قيد المراجعة', 'error');
        setIsSubmitting(false); return;
      }

      // ✅ إصلاح: استخدام .select().single() للحصول على id الوظيفة مباشرة بدل query منفصل
      const { data: insertedJob, error } = await supabase.from('jobs').insert({
        job_title:       sanitizedTitle,
        job_description: sanitizedDesc,
        requirements:    sanitizedReqs,
        benefits:        sanitizedBens,
        work_type:       form.work_type,
        city:            sanitizedCity,
        salary_range:    sanitizedSal,
        gender:          form.gender,
        min_experience:  minExp,
        education_level: sanitizedEdu,
        vacancies,
        deadline:        form.deadline || null,
        contact_email:   form.contact_email || null,
        contact_phone:   form.contact_phone || null,
        apply_method:    form.apply_method,
        apply_url:       form.apply_url || null,
        apply_phone:     form.apply_phone || null,
        user_id:         user.id,
        status:          'pending_proof',
        is_verified:     false,
      })
      .select('id')
      .single();
      if (error) throw error;

      // إشعار الأدمن بالوظيفة الجديدة
      const { data: profile } = await supabase
        .from('user').select('association_name').eq('user_id', user.id).maybeSingle();
      const clientName = (profile as any)?.association_name || user.email || 'عميل';
      // ✅ insertedJob?.id مضمون الآن من نفس الـ insert
      await notifyAdminNewJob({
        clientName,
        jobTitle: sanitizedTitle,
        jobId:    insertedJob?.id || '',
      });

      showToast('✅ تم حفظ الوظيفة — يرجى إرفاق رابط الإعلان الرسمي لتفعيلها', 'success');
      setShowForm(false);
      resetForm();
      loadMyJobs();
      setActiveTab('my');
    } catch (err: any) {
      console.error('[Submit Error]', err);
      showToast('حدث خطأ أثناء الإرسال، حاول مرة أخرى', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdminDeleteJob = async (id: string) => {
    if (!isAdmin) return;
    if (!window.confirm('هل أنت متأكد من حذف هذه الوظيفة؟')) return;
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);
      if (error) throw error;
      setJobs(prev => prev.filter(j => j.id !== id));
      setMyJobs(prev => prev.filter(j => j.id !== id));
      showToast('🗑️ تم حذف الوظيفة بنجاح', 'success');
    } catch {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  /* تصفية الوظائف */
  const filtered = jobs.filter(j => {
    const matchWork = filterWork === 'all' || j.work_type === filterWork;
    if (searchQuery && !searchRateLimiter.canProceed()) return matchWork;
    const q = sanitizeInput(searchQuery).toLowerCase().slice(0, 100);
    const matchSearch = !q ||
      sanitizeInput(j.job_title).toLowerCase().includes(q) ||
      sanitizeInput(j.city).toLowerCase().includes(q) ||
      (sanitizeInput(j.user?.association_name || j.association_name || '')).toLowerCase().includes(q);
    return matchWork && matchSearch;
  });

  return (
    <div style={{ minHeight: '100dvh', overflowX: 'hidden', fontFamily: "'Tajawal',sans-serif", direction: 'rtl' }}>
      {/* Static CSS — no flicker */}
      <style>{GLOBAL_STYLE}</style>



      {/* ── Hero ── */}
      <div className="jb-hero">
        <div className="jb-hero-inner">
          <div className="jb-hero-text">
            <div className="jb-hero-icon">💼</div>
            <h1 className="jb-hero-title">وظائف الجمعيات الخيرية</h1>
            <p className="jb-hero-sub">
              {authLoading
                ? 'فرص عمل من جمعيات موثوقة — كل وظيفة تم التحقق منها'
                : user
                  ? isStaff
                    ? 'راجع الوظائف واعتمدها قبل النشر'
                    : 'فرص عمل حقيقية من جمعيات موثوقة في مجتمعك'
                  : 'فرص عمل من جمعيات موثوقة — كل وظيفة تم التحقق من إعلانها الرسمي'}
            </p>
          </div>
          <div className="jb-total-badge">
            <div className="jb-total-num">{jobs.length}</div>
            <div className="jb-total-lbl">وظيفة نشطة</div>
          </div>
        </div>
      </div>

      {/* Auth Banner */}
      {!authLoading && !user && (
        <div className="jb-auth-banner">
          <div className="jb-auth-box" onClick={() => navigate('/')}>
            <span>🔐</span>
            <span>سجّل دخولك لنشر وظيفة موثّقة والاطلاع على تفاصيل التقديم</span>
            <span className="jb-auth-link">تسجيل الدخول ←</span>
          </div>
        </div>
      )}

      {/* Nav Tabs */}
      <div className="jb-nav">
        <button
          className={`jb-nav-tab${activeTab === 'browse' ? ' active' : ''}`}
          onClick={() => setActiveTab('browse')}
        >
          🔍 تصفح الوظائف
        </button>
        {!authLoading && user && !isStaff && (
          <button
            className={`jb-nav-tab${activeTab === 'my' ? ' active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            📁 وظائفي {myJobs.length > 0 && `(${myJobs.length})`}
          </button>
        )}
      </div>

      {/* ── Browse Tab ── */}
      {activeTab === 'browse' && (
        <>
          {/* Auth Gate — غير المسجلين يرون شاشة تسجيل دخول */}
          {!authLoading && !user && (
            <div style={{
              maxWidth: 480, margin: '60px auto', padding: '48px 32px', textAlign: 'center',
              background: dm ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.97)',
              borderRadius: 24, border: `1.5px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'}`,
              boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
            }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>💼</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: dm ? '#f1f5f9' : '#0f172a', margin: '0 0 10px' }}>
                الوظائف للمسجلين فقط
              </h2>
              <p style={{ fontSize: 14, color: dm ? '#94a3b8' : '#64748b', margin: '0 0 28px', lineHeight: 1.7 }}>
                سجّل دخولك أو أنشئ حسابًا للاطلاع على فرص العمل والتقديم عليها
              </p>
              <button
                onClick={() => navigate('/')}
                style={{
                  width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg,#7c3aed,#6d28d9)', color: '#fff',
                  fontSize: 15, fontWeight: 800, fontFamily: "'Tajawal',sans-serif",
                  boxShadow: '0 4px 18px rgba(124,58,237,0.35)',
                }}
              >
                🔐 تسجيل الدخول / إنشاء حساب
              </button>
            </div>
          )}

          {/* المحتوى للمسجلين فقط */}
          {(!authLoading && user) && (<>
          {/* Search */}
          <div className="jb-search-wrap">
            <div className="jb-search-inner">
              <i className="fas fa-search jb-search-icon" />
              <input
                className="jb-search-input"
                placeholder="ابحث عن وظيفة أو مدينة أو جمعية..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="jb-filter-bar">
            <button
              className={`jb-filter-btn${filterWork === 'all' ? ' active' : ''}`}
              onClick={() => setFilterWork('all')}
            >
              🗂 الكل ({jobs.length})
            </button>
            {Object.entries(WORK_TYPE).map(([k, v]) => (
              <button
                key={k}
                className={`jb-filter-btn${filterWork === k ? ' active' : ''}`}
                style={filterWork === k ? { background: v.color } : {}}
                onClick={() => setFilterWork(k)}
              >
                {v.icon} {v.label} ({jobs.filter(j => j.work_type === k).length})
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="jb-grid">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="jb-skel" style={{ animationDelay: `${i * 0.07}s` }} />
              ))
            ) : filtered.length === 0 ? (
              <div className="jb-empty">
                <div style={{ fontSize: 48, marginBottom: 14 }}>💼</div>
                <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: dm ? '#f1f5f9' : '#0f172a' }}>
                  {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد وظائف حالياً'}
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>
                  {searchQuery ? 'جرّب كلمات بحث مختلفة' : 'كن أول من ينشر وظيفة موثّقة'}
                </p>
              </div>
            ) : (
              filtered.map((job, i) => {
                const wt = WORK_TYPE[job.work_type];
                const daysLeft = job.deadline
                  ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86400000)
                  : null;
                const deadlineColor =
                  daysLeft !== null && daysLeft <= 3  ? '#ef4444' :
                  daysLeft !== null && daysLeft <= 7  ? '#f59e0b' : '#16a34a';
                const isNew = Math.ceil((Date.now() - new Date(job.created_at).getTime()) / 86400000) <= 3;

                return (
                  <div
                    key={job.id}
                    className="jb-card"
                    style={{ animationDelay: `${i * 0.06}s` }}
                  >
                    {/* Stripe */}
                    <div className="jb-card-stripe" style={{ background: `linear-gradient(90deg,${wt.color},${wt.color}88)` }} />

                    {/* Badges */}
                    {isNew && <span className="jb-new-badge">✨ جديد</span>}
                    {daysLeft !== null && daysLeft >= 0 && daysLeft <= 14 && (
                      <span className="jb-deadline-badge" style={{
                        background: `${deadlineColor}18`, color: deadlineColor,
                        border: `1px solid ${deadlineColor}40`,
                      }}>
                        {daysLeft === 0 ? '⏰ آخر يوم' : `⏳ ${daysLeft} يوم`}
                      </span>
                    )}

                    <div className="jb-card-body-wrap">
                      <div className="jb-card-header">
                        <div className="jb-card-icon-wrap">
                          <div className="jb-card-icon" style={{ background: dm ? wt.darkBg : wt.bg }}>
                            {wt.icon}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 className="jb-card-title">{job.job_title}</h3>
                            <p className="jb-card-org">🏢 {job.user?.association_name || job.association_name}</p>
                          </div>
                        </div>
                        {job.is_verified && (
                          <span className="jb-verified-badge">✓ موثقة</span>
                        )}
                      </div>

                      {job.job_description && (
                        <p className="jb-card-desc">{job.job_description}</p>
                      )}

                      {/* Info grid — بيانات واضحة بمستطيلات */}
                      <div className="jb-info-grid">
                        <div className="jb-info-item">
                          <div className="jb-info-lbl">📍 المدينة</div>
                          <div className="jb-info-val">{job.city}</div>
                        </div>
                        {job.salary_range && (
                          <div className="jb-info-item">
                            <div className="jb-info-lbl">💰 الراتب</div>
                            <div className="jb-info-val">{job.salary_range}</div>
                          </div>
                        )}
                        {job.vacancies > 0 && (
                          <div className="jb-info-item">
                            <div className="jb-info-lbl">👥 الشواغر</div>
                            <div className="jb-info-val">{job.vacancies}</div>
                          </div>
                        )}
                        {job.min_experience != null && job.min_experience > 0 && (
                          <div className="jb-info-item">
                            <div className="jb-info-lbl">⏱ الخبرة</div>
                            <div className="jb-info-val">{job.min_experience} سنة</div>
                          </div>
                        )}
                        {job.deadline && (
                          <div className="jb-info-item">
                            <div className="jb-info-lbl">📅 آخر تقديم</div>
                            <div className="jb-info-val">
                              {new Date(job.deadline).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      <div className="jb-tags">
                        {job.gender !== 'both' && (
                          <span className="jb-tag">{job.gender === 'male' ? '👨 ذكور' : '👩 إناث'}</span>
                        )}
                        {job.education_level && (
                          <span className="jb-tag">🎓 {job.education_level}</span>
                        )}
                      </div>

                      <div className="jb-card-footer">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span className="jb-work-badge" style={{
                            background: dm ? wt.darkBg : wt.bg,
                            color: wt.color,
                            border: `1px solid ${wt.color}30`,
                          }}>
                            {wt.icon} {wt.label}
                          </span>
                          {(() => {
                            const st = STATUS_INFO[job.status];
                            return (
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                background: dm ? st.darkBg : st.bg, color: st.color,
                                border: `1px solid ${st.color}30`,
                              }}>
                                {st.label}
                              </span>
                            );
                          })()}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {isAdmin && (
                            <button
                              className="jb-apply-btn"
                              style={{ background: dm ? 'rgba(220,38,38,0.15)' : '#fee2e2', color: '#dc2626', border: '1px solid rgba(220,38,38,0.3)' }}
                              onClick={() => handleAdminDeleteJob(job.id)}
                            >
                              🗑 حذف
                            </button>
                          )}
                          <button
                            className="jb-apply-btn"
                            onClick={() => setSelectedJob(job)}
                          >
                            📋 تقديم الآن
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          </>)}
        </>
      )}

      {/* ── My Jobs Tab ── */}
      {activeTab === 'my' && !authLoading && user && !isStaff && (
        <div className="jb-my-wrap">
          {myJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px 16px', color: dm ? '#475569' : '#94a3b8' }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📋</div>
              <p style={{ fontWeight: 800, fontSize: 16, margin: '0 0 6px', color: dm ? '#f1f5f9' : '#0f172a' }}>
                لم تنشر أي وظيفة بعد
              </p>
              <p style={{ fontSize: 13, margin: 0 }}>اضغط على زر "أضف وظيفة" أدناه للبدء</p>
            </div>
          ) : (
            myJobs.map((job, i) => {
              const st = STATUS_INFO[job.status];
              return (
                <div key={job.id} className="jb-my-card" style={{ animationDelay: `${i * 0.06}s` }}>
                  <div className="jb-my-card-header">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="jb-my-title">{job.job_title}</p>
                      <p className="jb-my-sub">
                        📍 {job.city} · {new Date(job.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="jb-status-badge" style={{
                      background: dm ? st.darkBg : st.bg,
                      color: st.color,
                      border: `1px solid ${st.color}30`,
                    }}>
                      {st.label}
                    </span>
                  </div>
                  <div className="jb-my-card-body">
                    {job.status === 'pending_proof' && (
                      <div className="jb-proof-required">
                        <p className="jb-proof-title">⚠️ مطلوب: رابط الإعلان الرسمي</p>
                        <p className="jb-proof-text">
                          يجب نشر الإعلان عبر القنوات الرسمية للجمعية وإرفاق الرابط قبل إتاحة التقديم.
                        </p>
                        <button className="jb-proof-upload-btn" onClick={() => setShowProofModal(job)}>
                          🔗 إرفاق رابط الإعلان
                        </button>
                      </div>
                    )}
                    {job.status === 'pending_admin' && (
                      <div style={{ background: 'rgba(8,145,178,.07)', border: '1px solid rgba(8,145,178,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#0891b2', fontWeight: 600 }}>
                        🕐 جاري مراجعة الوظيفة من الإدارة...
                      </div>
                    )}
                    {job.status === 'active' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {job.is_verified && (
                          <span style={{ background: 'rgba(22,163,74,.1)', color: '#16a34a', padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, border: '1px solid rgba(22,163,74,.2)' }}>
                            ✅ وظيفة موثّقة
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: dm ? '#64748b' : '#94a3b8', fontWeight: 600 }}>
                          نشطة وتستقبل طلبات التقديم
                        </span>
                      </div>
                    )}
                    {job.status === 'rejected' && (
                      <div style={{ background: 'rgba(220,38,38,.07)', border: '1px solid rgba(220,38,38,.2)', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#dc2626', fontWeight: 600 }}>
                        ❌ تم رفض الوظيفة — تواصل مع الإدارة للمزيد
                      </div>
                    )}
                    {job.status === 'closed' && (
                      <div style={{ background: dm ? 'rgba(51,65,85,.4)' : '#f1f5f9', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: dm ? '#94a3b8' : '#64748b', fontWeight: 600 }}>
                        🔒 الوظيفة مغلقة ولا تستقبل طلبات
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* FABs */}
      {!authLoading && user && !isStaff && (
        <button className="jb-fab" onClick={() => setShowForm(true)}>
          <i className="fas fa-plus" /> أضف وظيفة
        </button>
      )}
      {!authLoading && isStaff && (
        <button className="jb-admin-fab" onClick={() => setShowAdminQueue(true)}>
          <i className="fas fa-shield-alt" />
        </button>
      )}

      {/* ── Job Detail Modal ── */}
      {selectedJob && (() => {
        const job = selectedJob;
        const wt = WORK_TYPE[job.work_type];
        const st = STATUS_INFO[job.status];
        const daysLeft = job.deadline
          ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86400000)
          : null;

        const handleApplyNow = () => {
          const m = job.apply_method;
          if (m === 'whatsapp' && job.apply_phone) {
            safeOpenUrl(`https://wa.me/966${job.apply_phone.replace(/^0/, '')}`);
          } else if (m === 'twitter' && job.apply_url) {
            safeOpenUrl(job.apply_url);
          } else if (m === 'link' && job.apply_url) {
            safeOpenUrl(job.apply_url);
          } else if (m === 'email' && job.apply_url) {
            safeOpenUrl(`mailto:${job.apply_url}?subject=طلب تقديم — ${job.job_title}`);
          } else if (job.contact_email) {
            safeOpenUrl(`mailto:${job.contact_email}?subject=طلب تقديم — ${job.job_title}`);
          } else if (job.contact_phone) {
            safeOpenUrl(`https://wa.me/966${job.contact_phone.replace(/^0/, '')}`);
          }
        };

        const applyIcon = job.apply_method === 'whatsapp' ? '📱' : job.apply_method === 'twitter' ? '𝕏' : job.apply_method === 'link' ? '🔗' : job.apply_method === 'email' ? '📧' : '←';
        const applyLabel = job.apply_method === 'whatsapp' ? 'تقديم عبر واتساب' : job.apply_method === 'twitter' ? 'تقديم عبر X (تويتر)' : job.apply_method === 'link' ? 'تقديم عبر الرابط' : job.apply_method === 'email' ? 'تقديم عبر الإيميل' : 'تقديم الآن';

        return (
          <div className="jb-overlay" style={{ zIndex: 250 }}>
            <div className="jb-backdrop" onClick={() => setSelectedJob(null)} />
            <div className="jb-modal" style={{ maxWidth: 700 }}>
              <div className="jb-modal-header">
                <p className="jb-modal-title">💼 {job.job_title}</p>
                <p className="jb-modal-subtitle">🏢 {job.user?.association_name || job.association_name}</p>
                <button className="jb-modal-close" onClick={() => setSelectedJob(null)}>✕</button>
              </div>

              <div className="jb-modal-body">
                {/* Badges row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    background: dm ? wt.darkBg : wt.bg, color: wt.color, border: `1px solid ${wt.color}30`,
                  }}>
                    {wt.icon} {wt.label}
                  </span>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                    background: dm ? st.darkBg : st.bg, color: st.color, border: `1px solid ${st.color}30`,
                  }}>
                    {st.label}
                  </span>
                  {job.is_verified && (
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(22,163,74,.1)', color: '#16a34a', border: '1px solid rgba(22,163,74,.25)' }}>
                      ✓ موثّقة
                    </span>
                  )}
                  {daysLeft !== null && daysLeft >= 0 && (
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
                      background: daysLeft <= 3 ? 'rgba(239,68,68,.1)' : 'rgba(245,158,11,.1)',
                      color: daysLeft <= 3 ? '#ef4444' : '#f59e0b',
                      border: `1px solid ${daysLeft <= 3 ? 'rgba(239,68,68,.3)' : 'rgba(245,158,11,.3)'}`,
                    }}>
                      ⏳ {daysLeft === 0 ? 'آخر يوم للتقديم' : `${daysLeft} يوم متبقي`}
                    </span>
                  )}
                </div>

                {/* Info grid */}
                <div className="jb-section-label">تفاصيل الوظيفة</div>
                <div className="jb-grid-2" style={{ marginBottom: 18 }}>
                  <div className="jb-info-item">
                    <div className="jb-info-lbl">📍 المدينة</div>
                    <div className="jb-info-val">{job.city}</div>
                  </div>
                  {job.salary_range && (
                    <div className="jb-info-item">
                      <div className="jb-info-lbl">💰 الراتب</div>
                      <div className="jb-info-val">{job.salary_range}</div>
                    </div>
                  )}
                  <div className="jb-info-item">
                    <div className="jb-info-lbl">👥 عدد الشواغر</div>
                    <div className="jb-info-val">{job.vacancies}</div>
                  </div>
                  {job.min_experience != null && job.min_experience > 0 && (
                    <div className="jb-info-item">
                      <div className="jb-info-lbl">⏱ الخبرة المطلوبة</div>
                      <div className="jb-info-val">{job.min_experience} سنة</div>
                    </div>
                  )}
                  {job.education_level && (
                    <div className="jb-info-item">
                      <div className="jb-info-lbl">🎓 المؤهل</div>
                      <div className="jb-info-val">{job.education_level}</div>
                    </div>
                  )}
                  {job.deadline && (
                    <div className="jb-info-item">
                      <div className="jb-info-lbl">📅 آخر موعد للتقديم</div>
                      <div className="jb-info-val">
                        {new Date(job.deadline).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  )}
                  {job.gender !== 'both' && (
                    <div className="jb-info-item">
                      <div className="jb-info-lbl">👤 الجنس</div>
                      <div className="jb-info-val">{job.gender === 'male' ? '👨 ذكور' : '👩 إناث'}</div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {job.job_description && (
                  <>
                    <div className="jb-section-label">وصف الوظيفة</div>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: dm ? '#cbd5e1' : '#334155', marginBottom: 18, whiteSpace: 'pre-wrap' }}>
                      {job.job_description}
                    </p>
                  </>
                )}

                {/* Requirements */}
                {job.requirements && (
                  <>
                    <div className="jb-section-label">المتطلبات</div>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: dm ? '#cbd5e1' : '#334155', marginBottom: 18, whiteSpace: 'pre-wrap' }}>
                      {job.requirements}
                    </p>
                  </>
                )}

                {/* Benefits */}
                {job.benefits && (
                  <>
                    <div className="jb-section-label">المزايا</div>
                    <p style={{ fontSize: 14, lineHeight: 1.8, color: dm ? '#cbd5e1' : '#334155', marginBottom: 18, whiteSpace: 'pre-wrap' }}>
                      {job.benefits}
                    </p>
                  </>
                )}

                {/* Apply Method info box */}
                <div style={{
                  borderRadius: 14, padding: '14px 16px', marginBottom: 20,
                  background: dm ? 'rgba(124,58,237,0.08)' : 'rgba(124,58,237,0.05)',
                  border: '1.5px solid rgba(124,58,237,0.2)',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {applyIcon} طريقة التقديم
                  </p>
                  <p style={{ fontSize: 13, color: dm ? '#94a3b8' : '#64748b', margin: 0, lineHeight: 1.6 }}>
                    {job.apply_method === 'whatsapp' && 'سيتم التواصل معك عبر واتساب'}
                    {job.apply_method === 'email' && 'سيتم إرسال طلبك عبر البريد الإلكتروني'}
                    {job.apply_method === 'link' && 'سيتم تحويلك لرابط التقديم الرسمي'}
                    {job.apply_method === 'twitter' && 'سيتم تحويلك لحساب X (تويتر) الخاص بالجمعية'}
                    {!job.apply_method && 'تواصل مع الجمعية مباشرة للتقديم'}
                  </p>
                </div>

                {/* Apply button */}
                <button
                  className="jb-submit"
                  onClick={handleApplyNow}
                >
                  {applyIcon} {applyLabel}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Admin Queue */}
      {showAdminQueue && (
        <AdminJobsQueue onClose={() => { setShowAdminQueue(false); loadJobs(); }} onJobApproved={forceLoadJobs} />
      )}

      {/* Proof Modal */}
      {showProofModal && (
        <ProofUploadModal
          job={showProofModal}
          onClose={() => setShowProofModal(null)}
          onSuccess={() => {
            setShowProofModal(null);
            loadMyJobs();
            showToast('✅ تم إرسال الرابط للمراجعة', 'success');
          }}
        />
      )}

      {/* ── Add Job Modal ── */}
      {showForm && (
        <div className="jb-overlay">
          <div className="jb-backdrop" onClick={() => { setShowForm(false); resetForm(); }} />
          <div className="jb-modal">
            <div className="jb-modal-header">
              <p className="jb-modal-title">💼 نشر وظيفة جديدة</p>
              <p className="jb-modal-subtitle">ستحتاج لإرفاق رابط الإعلان الرسمي قبل نشر الوظيفة</p>
              <button className="jb-modal-close" onClick={() => { setShowForm(false); resetForm(); }}>✕</button>
            </div>
            <div className="jb-modal-body">

              {/* Governance notice */}
              <div className="jb-governance-box">
                <p className="jb-gov-title">🟢 نظام ضمان الحوكمة</p>
                <ul className="jb-gov-steps">
                  <li className="jb-gov-step"><span>1️⃣</span> أكمل بيانات الوظيفة واحفظها</li>
                  <li className="jb-gov-step"><span>2️⃣</span> انشر الإعلان عبر القنوات الرسمية للجمعية</li>
                  <li className="jb-gov-step"><span>3️⃣</span> ارفع رابط الإعلان الرسمي</li>
                  <li className="jb-gov-step"><span>4️⃣</span> تراجع الإدارة وتمنح شارة "وظيفة موثّقة" ✅</li>
                </ul>
              </div>

              <form onSubmit={handleSubmit}>

                {/* بيانات الوظيفة */}
                <div className="jb-section-label">بيانات الوظيفة</div>

                <div className="jb-field">
                  <label className="jb-label"><span className="jb-req">*</span> المسمى الوظيفي</label>
                  <input
                    className="jb-input"
                    value={form.job_title}
                    onChange={e => setForm(p => ({ ...p, job_title: e.target.value }))}
                    placeholder="مثال: أخصائي اجتماعي"
                    maxLength={100}
                  />
                  <p className="jb-char-count">{form.job_title.length}/100</p>
                </div>

                <div className="jb-field">
                  <label className="jb-label"><span className="jb-req">*</span> وصف الوظيفة</label>
                  <textarea
                    className="jb-textarea"
                    value={form.job_description}
                    onChange={e => setForm(p => ({ ...p, job_description: e.target.value }))}
                    placeholder="اكتب وصفاً تفصيلياً للوظيفة والمهام المطلوبة..."
                    maxLength={1000}
                  />
                  <p className="jb-char-count">{form.job_description.length}/1000</p>
                </div>

                <div className="jb-field">
                  <label className="jb-label">المتطلبات والمؤهلات</label>
                  <textarea
                    className="jb-textarea"
                    style={{ minHeight: 70 }}
                    value={form.requirements}
                    onChange={e => setForm(p => ({ ...p, requirements: e.target.value }))}
                    placeholder="المؤهلات والخبرات المطلوبة..."
                    maxLength={500}
                  />
                </div>

                <div className="jb-grid-2">
                  <div className="jb-field" style={{ position: 'relative' }}>
                    <label className="jb-label"><span className="jb-req">*</span> المدينة</label>
                    <input
                      className="jb-input"
                      value={cityInput}
                      onChange={e => {
                        setCityInput(e.target.value);
                        setForm(p => ({ ...p, city: e.target.value }));
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
                              setForm(p => ({ ...p, city }));
                              setShowCitySuggestions(false);
                            }}
                            style={{
                              display: 'block', width: '100%', textAlign: 'right',
                              padding: '10px 14px', border: 'none', background: 'none',
                              fontFamily: "'Tajawal',sans-serif", fontSize: 13, fontWeight: 600,
                              color: dm ? '#e2e8f0' : '#374151', cursor: 'pointer',
                              borderBottom: `1px solid ${dm ? 'rgba(51,65,85,0.4)' : '#f1f5f9'}`,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = dm ? 'rgba(124,58,237,0.1)' : 'rgba(124,58,237,0.06)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            📍 {city}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="jb-field">
                    <label className="jb-label">الراتب / النطاق</label>
                    <input
                      className="jb-input"
                      value={form.salary_range}
                      onChange={e => setForm(p => ({ ...p, salary_range: e.target.value }))}
                      placeholder="5,000 — 8,000 ر.س"
                    />
                  </div>
                </div>

                <div className="jb-field">
                  <label className="jb-label">نوع العمل</label>
                  <div className="jb-chips">
                    {Object.entries(WORK_TYPE).map(([k, v]) => (
                      <button
                        type="button"
                        key={k}
                        className={`jb-chip${form.work_type === k ? ' selected' : ''}`}
                        onClick={() => setForm(p => ({ ...p, work_type: k as WorkType }))}
                      >
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="jb-grid-2">
                  <div className="jb-field">
                    <label className="jb-label">الجنس المطلوب</label>
                    <select
                      className="jb-select"
                      value={form.gender}
                      onChange={e => setForm(p => ({ ...p, gender: e.target.value as Gender }))}
                    >
                      <option value="both">الجنسين</option>
                      <option value="male">ذكر</option>
                      <option value="female">أنثى</option>
                    </select>
                  </div>
                  <div className="jb-field">
                    <label className="jb-label">سنوات الخبرة (الحد الأدنى)</label>
                    <input
                      type="number"
                      className="jb-input"
                      min={0} max={30}
                      value={form.min_experience}
                      onChange={e => setForm(p => ({ ...p, min_experience: Math.max(0, +e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="jb-field">
                  <label className="jb-label">المستوى التعليمي</label>
                  <select
                    className="jb-select"
                    value={form.education_level}
                    onChange={e => setForm(p => ({ ...p, education_level: e.target.value }))}
                  >
                    <option value="">— اختر المستوى —</option>
                    {EDUCATION_LEVELS.map(lvl => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                </div>

                <div className="jb-grid-2">
                  <div className="jb-field">
                    <label className="jb-label">عدد الشواغر</label>
                    <input
                      type="number"
                      className="jb-input"
                      min={1} max={999}
                      value={form.vacancies}
                      onChange={e => setForm(p => ({ ...p, vacancies: Math.max(1, +e.target.value) }))}
                    />
                  </div>
                  <div className="jb-field">
                    <label className="jb-label">آخر موعد للتقديم</label>
                    <input
                      type="date"
                      className="jb-input"
                      value={form.deadline}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="jb-field">
                  <label className="jb-label">المزايا والمكافآت</label>
                  <textarea
                    className="jb-textarea"
                    style={{ minHeight: 60 }}
                    value={form.benefits}
                    onChange={e => setForm(p => ({ ...p, benefits: e.target.value }))}
                    placeholder="التأمين الصحي / بدل مواصلات / إجازة سنوية..."
                    maxLength={300}
                  />
                </div>

                {/* طريقة التقديم */}
                <div className="jb-section-label" style={{ marginTop: 8 }}>طريقة التقديم</div>

                <div className="jb-field">
                  <label className="jb-label">اختر طريقة التواصل مع المتقدمين *</label>
                  <select
                    className="jb-input"
                    value={form.apply_method}
                    onChange={e => setForm(p => ({ ...p, apply_method: e.target.value as ApplyMethod, apply_url: '', apply_phone: '' }))}
                  >
                    <option value="whatsapp">📱 واتساب</option>
                    <option value="email">📧 إيميل</option>
                    <option value="link">🔗 رابط تقديم</option>
                    <option value="twitter">𝕏 X (تويتر)</option>
                  </select>
                </div>

                {form.apply_method === 'whatsapp' && (
                  <div className="jb-field">
                    <label className="jb-label">رقم الواتساب *</label>
                    <input
                      type="tel"
                      className="jb-input"
                      value={form.apply_phone}
                      onChange={e => setForm(p => ({ ...p, apply_phone: e.target.value }))}
                      placeholder="05xxxxxxxx"
                      maxLength={10}
                    />
                  </div>
                )}

                {(form.apply_method === 'link' || form.apply_method === 'twitter') && (
                  <div className="jb-field">
                    <label className="jb-label">{form.apply_method === 'twitter' ? 'رابط حساب X أو التغريدة *' : 'رابط التقديم *'}</label>
                    <input
                      type="url"
                      className="jb-input"
                      value={form.apply_url}
                      onChange={e => setForm(p => ({ ...p, apply_url: e.target.value }))}
                      placeholder={APPLY_METHOD_INFO[form.apply_method].placeholder}
                    />
                  </div>
                )}

                {form.apply_method === 'email' && (
                  <div className="jb-field">
                    <label className="jb-label">البريد الإلكتروني للتقديم *</label>
                    <input
                      type="email"
                      className="jb-input"
                      value={form.apply_url}
                      onChange={e => setForm(p => ({ ...p, apply_url: e.target.value }))}
                      placeholder="hr@org.com"
                    />
                  </div>
                )}

                {/* بيانات التواصل الإضافية */}
                <div className="jb-section-label" style={{ marginTop: 8 }}>بيانات التواصل الإضافية (اختياري)</div>
                <div className="jb-grid-2">
                  <div className="jb-field">
                    <label className="jb-label">البريد الإلكتروني</label>
                    <input
                      type="email"
                      className="jb-input"
                      value={form.contact_email}
                      onChange={e => setForm(p => ({ ...p, contact_email: e.target.value }))}
                      placeholder="hr@org.com"
                    />
                  </div>
                  <div className="jb-field">
                    <label className="jb-label">رقم الجوال</label>
                    <input
                      type="tel"
                      className="jb-input"
                      value={form.contact_phone}
                      onChange={e => setForm(p => ({ ...p, contact_phone: e.target.value }))}
                      placeholder="05xxxxxxxx"
                      maxLength={10}
                    />
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="jb-submit">
                  {isSubmitting
                    ? <><span className="jb-spin" /> جاري الحفظ...</>
                    : <><i className="fas fa-save" /> حفظ الوظيفة</>
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
   Proof Upload Modal
══════════════════════════════════════════ */
function ProofUploadModal({ job, onClose, onSuccess }: { job: Job; onClose: () => void; onSuccess: () => void }) {
  const [proofUrl,  setProofUrl]  = useState('');
  const [proofNote, setProofNote] = useState('');
  const [uploading, setUploading] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofUrl.trim()) { showToast('يرجى إدخال رابط الإعلان الرسمي', 'error'); return; }
    if (!isValidUrl(proofUrl)) { showToast('يرجى إدخال رابط صحيح يبدأ بـ https://', 'error'); return; }
    if (!isAllowedUrl(proofUrl)) { showToast('هذا الرابط غير مسموح به', 'error'); return; }

    const sanitizedUrl = sanitizeInput(proofUrl);
    if (!isValidUrl(sanitizedUrl)) { showToast('الرابط غير صالح', 'error'); return; }

    setUploading(true);
    try {
      const { error } = await supabase.from('jobs').update({
        proof_url:  sanitizedUrl,
        status:     'pending_admin',
      }).eq('id', job.id);
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الإرسال', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="pum-overlay">
      <div className="pum-backdrop" onClick={onClose} />
      <div className="pum-modal">
        <div className="pum-header">
          <p className="pum-title">🔗 إرفاق رابط الإعلان الرسمي</p>
          <p className="pum-sub">لـ: {job.job_title}</p>
          <button className="pum-close" onClick={onClose}>✕</button>
        </div>
        <div className="pum-body">
          <div className="pum-rule">
            يجب نشر الإعلان الوظيفي عبر <strong>القنوات الرسمية للجمعية</strong> وإرفاق الرابط لضمان الالتزام بمتطلبات الحوكمة.
          </div>
          <form onSubmit={handleSubmit}>
            <div className="pum-link-icon">🔗</div>
            <div className="pum-field">
              <label className="pum-label">رابط الإعلان الرسمي</label>
              <input
                className="pum-input"
                type="url"
                value={proofUrl}
                onChange={e => setProofUrl(e.target.value)}
                placeholder="https://your-association.org/jobs/..."
                required
              />
            </div>
            <div className="pum-field">
              <label className="pum-label">ملاحظة للإدارة (اختياري)</label>
              <textarea
                className="pum-textarea"
                value={proofNote}
                onChange={e => setProofNote(e.target.value)}
                placeholder="أضف أي توضيح للإدارة..."
              />
            </div>
            <button type="submit" disabled={uploading} className="pum-submit">
              {uploading
                ? <><span className="pum-spin" /> جاري الإرسال...</>
                : <>📤 إرسال للمراجعة</>
              }
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Admin Jobs Queue
══════════════════════════════════════════ */
function AdminJobsQueue({ onClose, onJobApproved }: { onClose: () => void; onJobApproved?: () => void }) {
  const { showToast } = useToast();
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const dm = isDarkMode;
  const [items, setItems]           = useState<Job[]>([]);
  const [loading, setLoading]       = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [tab, setTab]               = useState<'all' | 'pending_admin' | 'pending_proof'>('all');
  const [counts, setCounts]         = useState({ all: 0, pending_admin: 0, pending_proof: 0 });

  const fetchCounts = useCallback(async () => {
    try {
      const [{ count: c1 }, { count: c2 }, { count: c3 }] = await Promise.all([
        supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['pending_admin', 'pending_proof']),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending_admin'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending_proof'),
      ]);
      setCounts({ all: c1 || 0, pending_admin: c2 || 0, pending_proof: c3 || 0 });
    } catch (error) { console.error('Error fetching counts:', error); }
  }, []);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('jobs')
        .select('*')
        .order('created_at', { ascending: true });

      if (tab === 'all') {
        query = query.in('status', ['pending_admin', 'pending_proof']);
      } else {
        query = query.eq('status', tab);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[AdminJobsQueue] Supabase error:', JSON.stringify(error));
        throw error;
      }
      setItems(data || []);
    } catch (err) {
      console.error('Load error:', err);
      showToast('حدث خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, showToast]);

  useEffect(() => { loadPending(); fetchCounts(); }, [loadPending, fetchCounts]);

  const handleApprove = async (id: string) => {
    if (processing) return;
    setProcessing(id);
    try {
      const { data, error, count } = await supabase
        .from('jobs')
        .update({ status: 'active', is_verified: true })
        .eq('id', id)
        .select();
      console.log('[handleApprove] data:', data, 'error:', error, 'count:', count);
      if (error) {
        console.error('[handleApprove] Supabase error:', JSON.stringify(error));
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn('[handleApprove] Update succeeded but no rows affected — RLS may be blocking the update');
        showToast('⚠️ تعذّر الاعتماد: صلاحيات Supabase تمنع التحديث', 'error');
        return;
      }
      setItems(prev => prev.filter(j => j.id !== id));
      showToast('✅ تم اعتماد الوظيفة ومنح شارة "موثّقة"', 'success');
      onJobApproved?.();
      await fetchCounts();

      // إشعار العميل باعتماد وظيفته
      const approved = data[0];
      if (approved?.user_id) {
        await notifyItemApproved({
          clientUserId: approved.user_id,
          itemType:     'job',
          itemName:     approved.job_title || 'الوظيفة',
          itemId:       id,
        });
      }
    } catch (err) {
      console.error('[handleApprove] catch:', err);
      showToast('حدث خطأ أثناء الاعتماد', 'error');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    if (processing) return;
    if (!window.confirm('هل أنت متأكد من رفض هذه الوظيفة؟')) return;
    setProcessing(id);
    try {
      // جلب بيانات الوظيفة قبل الرفض
      const { data: jobData } = await supabase
        .from('jobs').select('user_id, job_title').eq('id', id).maybeSingle();

      const { error } = await supabase.from('jobs').update({ status: 'rejected' }).eq('id', id);
      if (error) throw error;
      setItems(prev => prev.filter(j => j.id !== id));
      showToast('❌ تم رفض الوظيفة', 'success');
      await fetchCounts();

      // إشعار العميل بالرفض
      if (jobData?.user_id) {
        await notifyItemRejected({
          clientUserId: jobData.user_id,
          itemType:     'job',
          itemName:     jobData.job_title || 'الوظيفة',
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
    <div className="ajq-wrap">
      <div className="ajq-backdrop" onClick={onClose} />
      <div className="ajq-panel">
        <div className="ajq-header">
          <div className="ajq-header-row">
            <div>
              <p className="ajq-title">🛡️ مراجعة الوظائف</p>
              <p className="ajq-sub">راجع الرابط واعتمد أو ارفض</p>
            </div>
            <button className="ajq-close" onClick={onClose}>✕</button>
          </div>
          <div className="ajq-tabs">
            <button className={`ajq-tab${tab === 'all' ? ' active' : ''}`} onClick={() => setTab('all')}>
              📋 الكل
              <span className="ajq-badge">{counts.all}</span>
            </button>
            <button className={`ajq-tab${tab === 'pending_admin' ? ' active' : ''}`} onClick={() => setTab('pending_admin')}>
              🔍 بانتظار المراجعة
              <span className="ajq-badge">{counts.pending_admin}</span>
            </button>
            <button className={`ajq-tab${tab === 'pending_proof' ? ' active' : ''}`} onClick={() => setTab('pending_proof')}>
              🔗 بانتظار الرابط
              <span className="ajq-badge">{counts.pending_proof}</span>
            </button>
          </div>
        </div>
        <div className="ajq-body">
          {loading ? (
            <><div className="ajq-shimmer" /><div className="ajq-shimmer" style={{ opacity: 0.6 }} /></>
          ) : items.length === 0 ? (
            <div className="ajq-empty">
              <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
              <p style={{ fontWeight: 800, color: dm ? '#e2e8f0' : '#0f172a', margin: '0 0 4px' }}>لا توجد وظائف معلقة</p>
              <p style={{ fontSize: 13, margin: 0 }}>كل الوظائف تمت مراجعتها</p>
            </div>
          ) : (
            <>
              <div className="ajq-counter">🕐 {items.length} وظيفة بانتظار المراجعة</div>
              {items.map((job, i) => {
                const busy = processing === job.id;
                const wt   = WORK_TYPE[job.work_type];
                const st   = STATUS_INFO[job.status];
                return (
                  <div key={job.id} className="ajq-card" style={{ animationDelay: `${i * 0.05}s` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                      <p className="ajq-card-title" style={{ margin: 0 }}>{job.job_title}</p>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                        background: dm ? st.darkBg : st.bg, color: st.color, border: `1px solid ${st.color}30`,
                      }}>
                        {st.label}
                      </span>
                    </div>
                    <p className="ajq-card-org">🏢 {job.user?.association_name || job.association_name}</p>
                    <div className="ajq-detail">
                      📍 {job.city} &nbsp;|&nbsp; {wt?.icon} {wt?.label}
                      {job.vacancies > 1 && <> &nbsp;|&nbsp; 👥 {job.vacancies} شاغر</>}
                    </div>
                    {job.job_description && (
                      <div className="ajq-detail" style={{ display: 'block', lineHeight: 1.5 }}>
                        {job.job_description.slice(0, 140)}{job.job_description.length > 140 ? '...' : ''}
                      </div>
                    )}
                    {job.proof_url ? (
                      <div className="ajq-proof-box">
                        🔗 <strong>رابط الإعلان:</strong>{' '}
                        <a href={job.proof_url} target="_blank" rel="noopener noreferrer" className="ajq-proof-link">
                          {job.proof_url}
                        </a>
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(234,179,8,.07)', border: '1px solid rgba(234,179,8,.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#d97706', margin: '8px 0' }}>
                        ⚠️ لم يتم إرفاق رابط الإعلان — يمكنك الاعتماد بدونه
                      </div>
                    )}
                    <div className="ajq-actions">
                      <button
                        className="ajq-btn ajq-reject"
                        disabled={!!processing}
                        onClick={() => handleReject(job.id)}
                      >
                        {busy ? <span className="ajq-spin" style={{ borderTopColor: '#dc2626' }} /> : '✕'} رفض
                      </button>
                      <button
                        className="ajq-btn ajq-approve"
                        disabled={!!processing}
                        onClick={() => handleApprove(job.id)}
                      >
                        {busy ? <span className="ajq-spin" /> : '✓'} اعتماد ✅
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