// pages/WhatsAppPage.tsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useDarkMode } from '../hooks/useDarkMode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { triggerEdgeCleanup } from '../lib/cleanup-media';

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
    .replace(/on\w+\s*=/gi, '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .trim()
    .slice(0, 4000);
};

const createRateLimiter = (max: number, windowMs: number, label = '') => {
  const reqs: number[] = []; let blocked = 0;
  return {
    canProceed: (): boolean => {
      const now = Date.now();
      if (now < blocked) return false;
      while (reqs.length && reqs[0] < now - windowMs) reqs.shift();
      if (reqs.length >= max) {
        blocked = now + Math.min(windowMs * 2, 300000);
        if (label) console.warn('[RateLimit]', label);
        return false;
      }
      reqs.push(now); return true;
    },
  };
};
const sendRateLimiter   = createRateLimiter(30, 10000,  'send-msg');
const bulkRateLimiter   = createRateLimiter(3,  60000,  'bulk-send');

/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */
type Tab = 'inbox' | 'bulk' | 'templates' | 'settings' | 'gallery';
type InboxFilter = 'all' | 'unread' | 'pending' | 'closed';
type MediaType = 'image' | 'file' | 'location';
type MediaViewTab = 'all' | 'images' | 'videos' | 'files';

interface WaContact {
  id: string;
  name: string;
  phone: string;
  lastMsg: string;
  lastTime: string;
  unread: number;
  status: 'active' | 'pending' | 'closed';
  avatar: string;
  avatarBg: string;
}

interface WaMessage {
  id: string;
  from: 'agent' | 'contact';
  text: string;
  time: string;

  status?: 'sent' | 'delivered' | 'read';

  mediaType?: 'image' | 'file' | 'location';
  mediaUrl?: string;
  fileName?: string;

  employee_name?: string;
  message_type?: string;
  media_url?: string;

  location?: {
    lat: number;
    lng: number;
    label: string;
  };
}

interface WaTemplate {
  id: string;
  name: string;
  text: string;
  category: string;
  approved: boolean;
}

interface WaMediaItem {
  id: string;
  phone: string;
  contactName: string;
  type: 'image' | 'video' | 'file';
  url: string;
  fileName: string;
  caption?: string;
  createdAt: string;
  direction: 'inbound' | 'outbound';
}

/* ─────────────────────────────────────────
   Mock Data (يُستبدل بـ API فعلي)
───────────────────────────────────────── */
const MOCK_CONTACTS: WaContact[] = [];

const MOCK_MESSAGES: Record<string, WaMessage[]> = {};

const MOCK_TEMPLATES: WaTemplate[] = [];

/* ─────────────────────────────────────────
   Component
───────────────────────────────────────── */

/* ─────────────────────────────────────────
   SettingsTab — خارجي مستقل لمنع إعادة Mount عند الكتابة
───────────────────────────────────────── */
interface SettingsTabProps {
  dm: boolean;
  profileName: string; setProfileName: (v: string) => void;
  profileAbout: string; setProfileAbout: (v: string) => void;
  profileAvatar: string | null; setProfileAvatar: (v: string) => void;
  savingProfile: boolean; handleSaveProfile: () => void;
  avatarInputRef: React.RefObject<HTMLInputElement>;
  apiToken: string; setApiToken: (v: string) => void;
  phoneNumberId: string; setPhoneNumberId: (v: string) => void;
  wabaId: string; setWabaId: (v: string) => void;
  webhookSecret: string; setWebhookSecret: (v: string) => void;
  showToken: boolean; setShowToken: (v: (p: boolean) => boolean) => void;
  showWebhook: boolean; setShowWebhook: (v: (p: boolean) => boolean) => void;
  apiStatus: 'idle' | 'valid' | 'invalid'; setApiStatus: (v: 'idle' | 'valid' | 'invalid') => void;
  verifyingApi: boolean; savingApi: boolean;
  displayPhone: string; verifiedName: string;
  handleVerifyApi: () => void; handleSaveApi: () => void;
}

function SettingsTabComponent(props: SettingsTabProps) {
  const {
    dm, profileName, setProfileName, profileAbout, setProfileAbout,
    profileAvatar, setProfileAvatar, savingProfile, handleSaveProfile, avatarInputRef,
    apiToken, setApiToken, phoneNumberId, setPhoneNumberId,
    wabaId, setWabaId, webhookSecret, setWebhookSecret,
    showToken, setShowToken, showWebhook, setShowWebhook,
    apiStatus, setApiStatus, verifyingApi, savingApi,
    displayPhone, verifiedName, handleVerifyApi, handleSaveApi,
  } = props;

  const card   = dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
  const border = dm ? 'rgba(8,145,178,0.2)' : 'rgba(8,145,178,0.15)';
  const txt1   = dm ? '#f1f5f9' : '#0f172a';
  const txt2   = dm ? '#94a3b8' : '#64748b';
  const txt3   = dm ? '#475569' : '#94a3b8';
  const inputBg = dm ? 'rgba(30,41,59,0.8)' : 'rgba(248,250,252,1)';

  const fieldStyle: React.CSSProperties = {
    width: '100%', border: `1px solid ${border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: 14, fontFamily: "'Tajawal', sans-serif",
    background: inputBg, color: txt1, outline: 'none', direction: 'ltr',
    boxSizing: 'border-box', letterSpacing: 0.3,
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 700, color: txt2, marginBottom: 6,
  };

  const SCard = ({ children, title, icon, accent = '#0891b2' }: { children: React.ReactNode; title: string; icon: string; accent?: string }) => (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 22, marginBottom: 18 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: txt1, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 9, paddingBottom: 14, borderBottom: `1px solid ${border}` }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={icon} style={{ color: accent, fontSize: 15 }} />
        </div>
        {title}
      </div>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>

        <SCard title="معلومات الحساب" icon="fas fa-user-circle" accent="#0891b2">
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 22 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #1e3a5f, #0891b2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(8,145,178,0.4)', overflow: 'hidden' }}>
                {profileAvatar ? <img src={profileAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>م</span>}
              </div>
              <button aria-label="تغيير الصورة الشخصية" onClick={() => avatarInputRef.current?.click()} style={{ position: 'absolute', bottom: 0, left: 0, width: 24, height: 24, borderRadius: '50%', background: '#0891b2', border: '2px solid ' + card, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <i className="fas fa-camera" style={{ fontSize: 10, color: '#fff' }} />
              </button>
              <input ref={avatarInputRef} type="file" accept="image/*" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) setProfileAvatar(URL.createObjectURL(f)); }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: txt1 }}>{profileName}</div>
              <div style={{ fontSize: 12, color: txt2, marginTop: 3 }}>اضغط على الصورة لتغييرها</div>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="profileNameInput" style={labelStyle}>اسم الحساب</label>
            <input id="profileNameInput" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="اسم الحساب على واتساب" style={{ ...fieldStyle, direction: 'rtl' }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="profileAboutInput" style={labelStyle}>وصف الحساب</label>
            <input id="profileAboutInput" value={profileAbout} onChange={e => setProfileAbout(e.target.value)} placeholder="نبذة عن الخدمة" style={{ ...fieldStyle, direction: 'rtl' }} />
          </div>
          <button onClick={handleSaveProfile} disabled={savingProfile} style={{ width: '100%', padding: '11px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #0891b2, #0e7490)', color: '#fff', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 16px rgba(8,145,178,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {savingProfile ? <><i className="fas fa-spinner fa-spin" /> جاري الحفظ...</> : <><i className="fas fa-save" /> حفظ معلومات الحساب</>}
          </button>
        </SCard>

        <SCard title="بيانات Meta Cloud API" icon="fab fa-meta" accent="#7c3aed">
          {apiStatus !== 'idle' && (
            <div style={{ marginBottom: 18, padding: '12px 16px', borderRadius: 12, fontSize: 13, display: 'flex', alignItems: 'center', gap: 10, background: apiStatus === 'valid' ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${apiStatus === 'valid' ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, color: apiStatus === 'valid' ? '#16a34a' : '#dc2626' }}>
              <i className={`fas ${apiStatus === 'valid' ? 'fa-check-circle' : 'fa-times-circle'}`} style={{ fontSize: 16, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700 }}>{apiStatus === 'valid' ? '✓ الاتصال بـ Meta API يعمل' : 'بيانات الـ API غير صحيحة'}</div>
                {apiStatus === 'valid' && (displayPhone || verifiedName) && (
                  <div style={{ fontSize: 12, marginTop: 3, opacity: 0.85 }}>
                    {verifiedName && <span style={{ marginLeft: 12 }}>{verifiedName}</span>}
                    {displayPhone && <span dir="ltr">{displayPhone}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="apiTokenInput" style={labelStyle}>
              Access Token (Permanent)
              <a href="https://developers.facebook.com/tools/accesstoken/" target="_blank" rel="noopener noreferrer" style={{ marginRight: 8, fontSize: 11, color: '#0891b2', fontWeight: 600 }}>كيف أحصل عليه؟ ↗</a>
            </label>
            <div style={{ position: 'relative' }}>
              <input id="apiTokenInput" type={showToken ? 'text' : 'password'} value={apiToken} onChange={e => { setApiToken(e.target.value); setApiStatus('idle'); }} placeholder="EAAxxxxxxxxxxxxxxxx..." title="Access Token لـ Meta WhatsApp API" aria-label="Access Token لـ Meta WhatsApp API" style={{ ...fieldStyle, paddingLeft: 44 }} autoComplete="off" spellCheck={false} />
              <button aria-label={showToken ? 'إخفاء التوكن' : 'إظهار التوكن'} onClick={() => setShowToken(p => !p)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: txt3, padding: 4 }}>
                <i className={`fas ${showToken ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: 15 }} />
              </button>
            </div>
            {apiToken && <div style={{ marginTop: 6, fontSize: 11, color: txt3 }}>{apiToken.startsWith('EAA') ? '✓ صيغة التوكن صحيحة' : '⚠ التوكن عادةً يبدأ بـ EAA'}</div>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="phoneNumberIdInput" style={labelStyle}>Phone Number ID</label>
            <input id="phoneNumberIdInput" type="text" value={phoneNumberId} onChange={e => { setPhoneNumberId(e.target.value.replace(/\D/g, '')); setApiStatus('idle'); }} placeholder="1234567890123456" style={fieldStyle} autoComplete="off" />
            <div style={{ marginTop: 5, fontSize: 11, color: txt3 }}>تجده في: Meta Business → WhatsApp → API Setup → Phone Number ID</div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="wabaIdInput" style={labelStyle}>WhatsApp Business Account ID (WABA)</label>
            <input id="wabaIdInput" type="text" value={wabaId} onChange={e => setWabaId(e.target.value.replace(/\D/g, ''))} placeholder="9876543210987654" style={fieldStyle} autoComplete="off" />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="webhookSecretInput" style={labelStyle}>Webhook Verify Token</label>
            <div style={{ position: 'relative' }}>
              <input id="webhookSecretInput" type={showWebhook ? 'text' : 'password'} value={webhookSecret} onChange={e => setWebhookSecret(e.target.value)} placeholder="رمز سري تختاره أنت للـ Webhook" title="Webhook Verify Token" aria-label="Webhook Verify Token" style={{ ...fieldStyle, paddingLeft: 44 }} autoComplete="off" />
              <button aria-label={showWebhook ? 'إخفاء رمز Webhook' : 'إظهار رمز Webhook'} onClick={() => setShowWebhook(p => !p)} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', cursor: 'pointer', color: txt3, padding: 4 }}>
                <i className={`fas ${showWebhook ? 'fa-eye-slash' : 'fa-eye'}`} style={{ fontSize: 15 }} />
              </button>
            </div>
          </div>

          <div style={{ marginBottom: 20, background: dm ? 'rgba(8,145,178,0.08)' : 'rgba(8,145,178,0.05)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0891b2', marginBottom: 6 }}><i className="fas fa-link" style={{ marginLeft: 6 }} />Webhook URL الخاص بنظامك</div>
            <div style={{ fontSize: 12, color: txt2, fontFamily: 'monospace', direction: 'ltr', wordBreak: 'break-all' }}>https://almosaadah.sa/api/whatsapp/webhook</div>
            <div style={{ fontSize: 11, color: txt3, marginTop: 6 }}>أضف هذا الرابط في إعدادات Webhook في Meta Developer Console</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleVerifyApi} disabled={verifyingApi || !apiToken || !phoneNumberId} style={{ flex: 1, padding: '11px', borderRadius: 12, border: `1px solid ${(!apiToken || !phoneNumberId) ? border : 'rgba(124,58,237,0.5)'}`, background: (!apiToken || !phoneNumberId) ? 'transparent' : 'rgba(124,58,237,0.1)', color: (!apiToken || !phoneNumberId) ? txt3 : '#7c3aed', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 700, cursor: (!apiToken || !phoneNumberId) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {verifyingApi ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 13 }} /> جاري التحقق...</> : <><i className="fas fa-plug" style={{ fontSize: 13 }} /> اختبار الاتصال</>}
            </button>
            <button onClick={handleSaveApi} disabled={savingApi || !apiToken || !phoneNumberId} style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', background: (!apiToken || !phoneNumberId) ? (dm ? 'rgba(30,41,59,0.6)' : '#e2e8f0') : 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: (!apiToken || !phoneNumberId) ? txt3 : '#fff', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 800, cursor: (!apiToken || !phoneNumberId) ? 'default' : 'pointer', boxShadow: (!apiToken || !phoneNumberId) ? 'none' : '0 4px 16px rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {savingApi ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 13 }} /> جاري الحفظ...</> : <><i className="fas fa-shield-alt" style={{ fontSize: 13 }} /> حفظ بيانات API</>}
            </button>
          </div>
        </SCard>

      </div>
    </div>
  );
}


function GalleryTab({ tab, mediaItems, mediaViewTab, mediaLoading, mediaViewerOpen, mediaViewerIndex, dm, border, txt1, txt2, txt3, card, loadMediaGallery, setMediaViewTab, setMediaViewerOpen, setMediaViewerIndex, setMediaItems, supabase }: any) {

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode,  setSelectMode]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  useEffect(() => {
    if (tab === 'gallery' && mediaItems.length === 0) {
      loadMediaGallery();
    }
  }, [tab]);

  // إلغاء تحديد الكل عند تغيير الفلتر
  useEffect(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [mediaViewTab]);

  const filteredMedia = mediaViewTab === 'all'
    ? mediaItems
    : mediaItems.filter((m: any) => {
        if (mediaViewTab === 'images') return m.type === 'image';
        if (mediaViewTab === 'videos') return m.type === 'video';
        return m.type === 'file';
      });

  const openViewer = (index: number) => {
    setMediaViewerIndex(index);
    setMediaViewerOpen(true);
  };

  const prevMedia = () => setMediaViewerIndex((i: number) => (i - 1 + filteredMedia.length) % filteredMedia.length);
  const nextMedia = () => setMediaViewerIndex((i: number) => (i + 1) % filteredMedia.length);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // تجميع الوسائط حسب التاريخ
  const groupedMedia: Record<string, typeof filteredMedia> = {};
  filteredMedia.forEach((item: any) => {
    const dateKey = formatDate(item.createdAt);
    if (!groupedMedia[dateKey]) groupedMedia[dateKey] = [];
    groupedMedia[dateKey].push(item);
  });

  const handleDelete = async (item: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('هل تريد حذف هذه الوسيطة؟')) return;
    try {
      // حذف من Supabase Storage إذا كان من bucket whatsapp-media
      const url = item.url || '';
      const bucketPath = url.includes('/whatsapp-media/') ? url.split('/whatsapp-media/')[1]?.split('?')[0] : null;
      if (bucketPath) {
        await supabase.storage.from('whatsapp-media').remove([bucketPath]);
      }
      // حذف media_url من الرسالة في DB
      await supabase.from('messages').update({ media_url: null }).eq('id', item.id);
      // حذف من الـ UI
      setMediaItems((prev: any[]) => prev.filter(m => m.id !== item.id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredMedia.map((m: any) => m.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`هل تريد حذف ${selectedIds.size} وسيطة؟`)) return;
    setDeleting(true);
    try {
      const toDelete = filteredMedia.filter((m: any) => selectedIds.has(m.id));
      for (const item of toDelete) {
        const url = item.url || '';
        const bucketPath = url.includes('/whatsapp-media/') ? url.split('/whatsapp-media/')[1]?.split('?')[0] : null;
        if (bucketPath) await supabase.storage.from('whatsapp-media').remove([bucketPath]);
        await supabase.from('messages').update({ media_url: null }).eq('id', item.id);
      }
      setMediaItems((prev: any[]) => prev.filter(m => !selectedIds.has(m.id)));
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch (err) {
      console.error('Bulk delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: txt1 }}>
            <i className="fas fa-images" style={{ color: '#0891b2', marginLeft: 8 }} />
            مستودع الوسائط
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* زر تحديد */}
            <button onClick={() => { setSelectMode(p => !p); setSelectedIds(new Set()); }} style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${selectMode ? '#0891b2' : border}`,
              background: selectMode ? 'rgba(8,145,178,0.1)' : 'transparent',
              cursor: 'pointer', fontSize: 12,
              color: selectMode ? '#0891b2' : txt2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className="fas fa-check-square" style={{ fontSize: 11 }} />
              {selectMode ? 'إلغاء التحديد' : 'تحديد'}
            </button>
            {/* زر حذف المحدد */}
            {selectMode && selectedIds.size > 0 && (
              <button onClick={handleBulkDelete} disabled={deleting} style={{
                padding: '6px 14px', borderRadius: 8,
                border: '1px solid #dc2626',
                background: 'rgba(220,38,38,0.1)',
                cursor: 'pointer', fontSize: 12, color: '#dc2626',
                display: 'flex', alignItems: 'center', gap: 6,
                fontWeight: 700,
              }}>
                {deleting
                  ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 11 }} /> جاري الحذف...</>
                  : <><i className="fas fa-trash" style={{ fontSize: 11 }} /> حذف ({selectedIds.size})</>
                }
              </button>
            )}
            {/* تحديد الكل */}
            {selectMode && (
              <button onClick={selectAll} style={{
                padding: '6px 14px', borderRadius: 8,
                border: `1px solid ${border}`,
                background: 'transparent',
                cursor: 'pointer', fontSize: 12, color: txt2,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {selectedIds.size === filteredMedia.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
            )}
            <button onClick={loadMediaGallery} disabled={mediaLoading} style={{
              padding: '6px 14px', borderRadius: 8, border: `1px solid ${border}`,
              background: 'transparent', cursor: 'pointer', fontSize: 12, color: txt2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas fa-sync-alt ${mediaLoading ? 'fa-spin' : ''}`} style={{ fontSize: 11 }} />
              تحديث
            </button>
          </div>
        </div>
        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {([
            { id: 'all',    label: 'الكل',      icon: 'fa-th-large',  count: mediaItems.length },
            { id: 'images', label: 'الصور',      icon: 'fa-image',     count: mediaItems.filter(m => m.type === 'image').length },
            { id: 'videos', label: 'الفيديو',    icon: 'fa-video',     count: mediaItems.filter(m => m.type === 'video').length },
            { id: 'files',  label: 'الملفات',     icon: 'fa-file',     count: mediaItems.filter(m => m.type === 'file').length },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setMediaViewTab(f.id)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontFamily: "'Tajawal', sans-serif", fontSize: 12, fontWeight: 700,
              background: mediaViewTab === f.id ? '#0891b2' : (dm ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
              color: mediaViewTab === f.id ? '#fff' : txt2,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <i className={`fas ${f.icon}`} style={{ fontSize: 11 }} />
              {f.label}
              <span style={{
                background: mediaViewTab === f.id ? 'rgba(255,255,255,0.2)' : 'rgba(8,145,178,0.15)',
                color: mediaViewTab === f.id ? '#fff' : '#0891b2',
                borderRadius: 99, padding: '1px 7px', fontSize: 10,
              }}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Media Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {mediaLoading && mediaItems.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: txt3 }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: 24 }} />
            <span style={{ marginRight: 10 }}>جاري تحميل الوسائط...</span>
          </div>
        ) : filteredMedia.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: txt3 }}>
            <i className="fas fa-images" style={{ fontSize: 48, opacity: 0.2, display: 'block', marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 700 }}>لا توجد وسائط</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>ستظهر الصور والملفات هنا عند استلامها أو إرسالها</div>
          </div>
        ) : (
          <div>
            {Object.entries(groupedMedia).map(([dateKey, items]) => (
              <div key={dateKey} style={{ marginBottom: 24 }}>
                {/* تاريخ المجموعة */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  marginBottom: 10,
                }}>
                  <div style={{ flex: 1, height: 1, background: border }} />
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: txt3,
                    background: dm ? 'rgba(15,23,42,0.8)' : '#f8fafc',
                    padding: '3px 12px', borderRadius: 99,
                    border: `1px solid ${border}`,
                  }}>{dateKey}</span>
                  <div style={{ flex: 1, height: 1, background: border }} />
                </div>

                {/* Grid للمجموعة */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: 8,
                }}>
                  {(items as any[]).map((item: any) => {
                    const globalIdx = filteredMedia.indexOf(item);
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectMode ? toggleSelect(item.id, { stopPropagation: () => {} } as any) : openViewer(globalIdx)}
                        style={{
                          position: 'relative', borderRadius: 12, overflow: 'hidden',
                          cursor: 'pointer', aspectRatio: '1',
                          background: dm ? 'rgba(30,41,59,0.5)' : '#f1f5f9',
                          border: selectedIds.has(item.id) ? '2px solid #0891b2' : `1px solid ${border}`,
                          transition: 'transform 0.15s, box-shadow 0.15s',
                          boxShadow: selectedIds.has(item.id) ? '0 0 0 3px rgba(8,145,178,0.25)' : 'none',
                        }}
                        onMouseEnter={e => {
                          if (!selectedIds.has(item.id)) {
                            (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02)';
                            (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.2)';
                          }
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.transform = 'scale(1)';
                          if (!selectedIds.has(item.id)) (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                        }}
                      >
                        {item.type === 'image' ? (
                          <img
                            src={item.url}
                            alt={item.caption || 'صورة'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : item.type === 'video' ? (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                            <i className="fas fa-play-circle" style={{ fontSize: 36, color: '#fff' }} />
                          </div>
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                            <i className="fas fa-file-alt" style={{ fontSize: 32, color: '#7c3aed' }} />
                            <div style={{ fontSize: 10, color: txt2, textAlign: 'center', marginTop: 6, wordBreak: 'break-all', maxHeight: 40, overflow: 'hidden' }}>
                              {item.fileName}
                            </div>
                          </div>
                        )}

                        {/* Checkbox */}
                        <div
                          onClick={e => { e.stopPropagation(); toggleSelect(item.id, e); }}
                          style={{
                            position: 'absolute', top: 7, right: 7, zIndex: 10,
                            width: 22, height: 22, borderRadius: 6,
                            background: selectedIds.has(item.id) ? '#0891b2' : 'rgba(0,0,0,0.4)',
                            border: `2px solid ${selectedIds.has(item.id) ? '#0891b2' : 'rgba(255,255,255,0.75)'}`,
                            display: selectMode || selectedIds.has(item.id) ? 'flex' : 'none',
                            alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                          }}
                        >
                          {selectedIds.has(item.id) && <i className="fas fa-check" style={{ fontSize: 10, color: '#fff' }} />}
                        </div>

                        {/* Overlay — الاسم والنوع */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                          padding: '20px 8px 6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: 10, color: '#fff' }}>{item.contactName.slice(0, 12)}</span>
                          <span style={{
                            fontSize: 9, color: '#fff', padding: '1px 6px', borderRadius: 4,
                            background: item.direction === 'inbound' ? 'rgba(34,197,94,0.7)' : 'rgba(8,145,178,0.7)',
                          }}>
                            {item.direction === 'inbound' ? 'وارد' : 'صادر'}
                          </span>
                        </div>

                        {/* زر حذف */}
                        <button
                          aria-label="حذف الوسيطة"
                          onClick={e => handleDelete(item, e)}
                          title="حذف"
                          style={{
                            position: 'absolute', top: 6, left: 6,
                            width: 26, height: 26, borderRadius: '50%',
                            background: 'rgba(220,38,38,0.85)', border: 'none',
                            cursor: 'pointer', color: '#fff', fontSize: 11,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.15s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                        >
                          <i className="fas fa-trash" />
                        </button>

                        {item.type === 'video' && (
                          <div style={{ position: 'absolute', top: 6, right: 6 }}>
                            <i className="fas fa-video" style={{ fontSize: 14, color: '#fff' }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* شريط الحذف السفلي */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{
          borderTop: `1px solid ${border}`, padding: '12px 18px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: dm ? 'rgba(15,23,42,0.97)' : '#fff',
        }}>
          <span style={{ fontSize: 13, color: txt2, fontWeight: 700 }}>
            تم تحديد {selectedIds.size} وسيطة
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setSelectedIds(new Set())} style={{
              padding: '7px 16px', borderRadius: 8, border: `1px solid ${border}`,
              background: 'transparent', cursor: 'pointer', fontSize: 13, color: txt2,
            }}>إلغاء</button>
            <button onClick={handleBulkDelete} disabled={deleting} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: '#dc2626', cursor: 'pointer', fontSize: 13, color: '#fff',
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {deleting
                ? <><i className="fas fa-spinner fa-spin" /> جاري الحذف...</>
                : <><i className="fas fa-trash" /> حذف ({selectedIds.size})</>}
            </button>
          </div>
        </div>
      )}

      {/* Media Viewer Modal */}
      {mediaViewerOpen && filteredMedia[mediaViewerIndex] && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.92)', zIndex: 1000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setMediaViewerOpen(false)}
        >
          {/* Close Button */}
          <button
            aria-label="إغلاق العارض"
            onClick={() => setMediaViewerOpen(false)}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              cursor: 'pointer', color: '#fff', fontSize: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <i className="fas fa-times" />
          </button>

          {/* Navigation */}
          {filteredMedia.length > 1 && (
            <>
              <button aria-label="السابق" onClick={e => { e.stopPropagation(); prevMedia(); }} style={{
                position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                cursor: 'pointer', color: '#fff', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="fas fa-chevron-right" />
              </button>
              <button aria-label="التالي" onClick={e => { e.stopPropagation(); nextMedia(); }} style={{
                position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
                width: 48, height: 48, borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                cursor: 'pointer', color: '#fff', fontSize: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="fas fa-chevron-left" />
              </button>
            </>
          )}

          {/* Media Content */}
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: '90vw', maxHeight: '80vh' }}>
            {filteredMedia[mediaViewerIndex].type === 'image' ? (
              <img
                src={filteredMedia[mediaViewerIndex].url}
                alt="صورة"
                style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 12, display: 'block' }}
              />
            ) : filteredMedia[mediaViewerIndex].type === 'video' ? (
              <video
                src={filteredMedia[mediaViewerIndex].url}
                controls
                style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: 12 }}
              />
            ) : (
              <div style={{ background: card, borderRadius: 16, padding: 32, textAlign: 'center', minWidth: 300 }}>
                <i className="fas fa-file-alt" style={{ fontSize: 64, color: '#7c3aed', marginBottom: 16 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: txt1, marginBottom: 8 }}>
                  {filteredMedia[mediaViewerIndex].fileName}
                </div>
                <div style={{ fontSize: 13, color: txt2, marginBottom: 20 }}>
                  {formatDate(filteredMedia[mediaViewerIndex].createdAt)}
                </div>
                <a
                  href={filteredMedia[mediaViewerIndex].url}
                  download={filteredMedia[mediaViewerIndex].fileName}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '10px 24px', borderRadius: 12,
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    color: '#fff', fontSize: 14, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  <i className="fas fa-download" /> تحميل الملف
                </a>
              </div>
            )}
          </div>

          {/* Caption & Info */}
          {filteredMedia[mediaViewerIndex].type !== 'file' && (
            <div onClick={e => e.stopPropagation()} style={{ marginTop: 16, textAlign: 'center' }}>
              {filteredMedia[mediaViewerIndex].caption && (
                <div style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>{filteredMedia[mediaViewerIndex].caption}</div>
              )}
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                {filteredMedia[mediaViewerIndex].contactName} • {formatDate(filteredMedia[mediaViewerIndex].createdAt)}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 4 }}>
                {mediaViewerIndex + 1} من {filteredMedia.length}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} // end GalleryTab

export default function WhatsAppPage() {
  const navigate   = useNavigate();
  const { user, isAdmin, isEmployee, isAdminOrEmployee, employeeProfile } = useAuth();
  const { showToast }  = useToast();
  const [isCleaning, setIsCleaning] = useState(false);

  const handleManualCleanup = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في بدء تنظيف الوسائط منتهية الصلاحية الآن؟')) return;
    
    setIsCleaning(true);
    try {
      const result = await triggerEdgeCleanup(50); // تنظيف 50 ملف
      if (result.success) {
        showToast(result.message, "success");
      } else {
        showToast(result.error || "خطأ", "error");
      }
    } catch (error) {
      showToast("فشل الاتصال بخادم التنظيف", "error");
    } finally {
      setIsCleaning(false);
    }
  };
  const { isDarkMode } = useDarkMode();
  const dm = isDarkMode;

  /* ── State ── */
  const [tab,            setTab]           = useState<Tab>('inbox');
  const [inboxFilter,    setInboxFilter]   = useState<InboxFilter>('all');
  const [contacts,       setContacts]      = useState<WaContact[]>(MOCK_CONTACTS);
  const [activeContact,  setActiveContact] = useState<WaContact | null>(null);
  const [messages,       setMessages]      = useState<Record<string, WaMessage[]>>(MOCK_MESSAGES);
  const [inputText,      setInputText]     = useState('');
  const [showMediaMenu,  setShowMediaMenu] = useState(false);
  const [showTemplatesPicker, setShowTemplatesPicker] = useState(false);
  const [templates,      setTemplates]     = useState<WaTemplate[]>(MOCK_TEMPLATES);
  const [searchQ,        setSearchQ]       = useState('');
  const [typingContacts, setTypingContacts] = useState<Set<string>>(new Set());
  const [editingName,    setEditingName]   = useState(false);
  const [editNameVal,    setEditNameVal]   = useState('');
  // wa_contacts: phone → name
  const [waContacts,     setWaContacts]    = useState<Record<string, string>>({});

  /* Bulk Send State */
  const [bulkNumbers,    setBulkNumbers]   = useState('');
  const [bulkTemplate,   setBulkTemplate]  = useState('');
  const [bulkVars,       setBulkVars]      = useState<Record<string, string>>({});
  const [bulkFile,       setBulkFile]      = useState<File | null>(null);
  const [bulkParsed,     setBulkParsed]    = useState<string[]>([]);
  const [bulkSending,    setBulkSending]   = useState(false);
  const [bulkProgress,   setBulkProgress]  = useState(0);
  const [bulkCategory,   setBulkCategory]  = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION' | 'SERVICE'>('MARKETING');
  const [metaTemplateId, setMetaTemplateId] = useState('');

  /* Settings State */
  const [profileName,    setProfileName]   = useState('المساعدة الإدارية');
  const [profileAbout,   setProfileAbout]  = useState('خدمات متكاملة لدعم الجمعيات الأهلية');
  const [profileAvatar,  setProfileAvatar] = useState<string | null>(null);
  const [savingProfile,  setSavingProfile] = useState(false);

  /* API Credentials State */
  const [apiToken,         setApiToken]        = useState('');
  const [phoneNumberId,    setPhoneNumberId]    = useState('');
  const [wabaId,           setWabaId]           = useState('');
  const [webhookSecret,    setWebhookSecret]    = useState('');
  const [showToken,        setShowToken]        = useState(false);
  const [showWebhook,      setShowWebhook]      = useState(false);
  const [verifyingApi,     setVerifyingApi]     = useState(false);
  const [apiStatus,        setApiStatus]        = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [savingApi,        setSavingApi]        = useState(false);
  const [configLoaded,     setConfigLoaded]     = useState(false);
  const [displayPhone,     setDisplayPhone]     = useState('');
  const [verifiedName,     setVerifiedName]     = useState('');

  /* Media Gallery State */
  const [mediaItems,       setMediaItems]       = useState<WaMediaItem[]>([]);
  const [mediaViewTab,     setMediaViewTab]     = useState<MediaViewTab>('all');
  const [mediaViewerOpen,  setMediaViewerOpen] = useState(false);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);
  const [mediaLoading,     setMediaLoading]     = useState(false);
  const [lastRefresh,      setLastRefresh]      = useState(Date.now());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const excelInputRef  = useRef<HTMLInputElement>(null);
  const mediaPollingRef = useRef<number | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const prevMsgCount = useRef(0);
  useEffect(() => {
    const count = activeContact ? (messages[activeContact.id]?.length ?? 0) : 0;
    if (count !== prevMsgCount.current) {
      prevMsgCount.current = count;
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeContact]);

  // ── Realtime: استقبال رسائل جديدة ──
  useEffect(() => {
    if (!isAdminOrEmployee) return;

    // ── Polling fallback: يضمن تحديث الرسائل حتى لو فشلت realtime ──
    const startPolling = () => {
      if (mediaPollingRef.current) {
  clearInterval(mediaPollingRef.current);
    }
      mediaPollingRef.current = setInterval(async () => {
        if (!configLoaded) return;
        try {
          const { data: newMsgs } = await supabase
            .from('messages')
            .select('*')
            .gte('created_at', new Date(Date.now() - 60000).toISOString()) // آخر دقيقة
            .not('message_type', 'eq', 'template');

          if (newMsgs && newMsgs.length > 0) {
            // تحديث المحادثات فقط (الرسائل الجديدة تُضاف بـ realtime)
            const contactMap: Record<string, WaContact> = {};
            newMsgs.forEach(m => {
              const phone = m.phone_number;
              const msgId = m.id;
              const waMsg: WaMessage = {
                id: msgId,
                from: m.direction === 'inbound' ? 'contact' : 'agent',
                text: m.body || '',
                time: new Date(m.created_at).toLocaleTimeString(
                  'ar-SA',
                  {
                    hour: '2-digit',
                    minute: '2-digit'
                  }
                ),

                status: (m.status as any) || 'sent',

                mediaType:
                  m.message_type === 'image'
                    ? 'image'
                    : m.message_type === 'file'
                    ? 'file'
                    : m.message_type === 'video'
                    ? 'file'
                    : m.message_type === 'audio'
                    ? 'file'
                    : undefined,

                mediaUrl: m.media_url || undefined,

                fileName: m.media_url
                  ? m.media_url.split('/').pop()
                  : undefined,

                employee_name: m.employee_name || '',
                message_type: m.message_type || '',
                media_url: m.media_url || '',
              };

              // أضف للرسائل إذا ما كانت موجودة
              setMessages(prev => {
                const existing = prev[phone]?.find(x => x.id === msgId);
                if (existing) return prev;
                return { ...prev, [phone]: [...(prev[phone] || []), waMsg] };
              });

              if (!contactMap[phone]) {
                const name = m.contact_name || phone;
                contactMap[phone] = {
                  id: phone, name, phone,
                  lastMsg: m.body || '',
                  lastTime: waMsg.time,
                  unread: 1,
                  status: 'active',
                  avatar: name.slice(0, 2),
                  avatarBg: ['#1e3a5f','#3a1c5f','#1a3a2f','#3a2a0f','#1c2a3a'][phone.length % 5],
                };
              }
            });

            // أضف جهات اتصال جديدة
            if (Object.keys(contactMap).length > 0) {
              setContacts(prev => {
                const existingPhones = new Set(prev.map(c => c.id));
                const newContacts = Object.values(contactMap).filter(c => !existingPhones.has(c.id));
                if (newContacts.length === 0) return prev;
                return [...newContacts, ...prev];
              });
            }
          }
        } catch (err) {
          console.error('[Polling] Error:', err);
        }
      }, 3000); // كل 3 ثواني
    };

    startPolling();

    // ── Supabase Realtime ──
    const channel = supabase
      .channel('messages-realtime-v2')
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const phone = payload?.phone;
        if (!phone) return;
        setTypingContacts(prev => new Set([...prev, phone]));
        setTimeout(() => setTypingContacts(prev => { const n = new Set(prev); n.delete(phone); return n; }), 3000);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const m = payload.new as any;
        const phone = m.phone_number;

        // تجاهل الرسائل الصادرة — تُضاف يدوياً في handleSend/handleFileUpload
        if (m.direction === 'outbound') {
          // فقط حدّث حالة آخر رسالة في قائمة المحادثات
          const newTime = new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          setContacts(prev => prev.map(c => c.id === phone
            ? { ...c, lastMsg: m.body || (m.media_url ? '📎 مرفق' : ''), lastTime: newTime }
            : c
          ));
          return;
        }

        // تأكد إن الرسالة ما كانت موجودة بالفعل
        setMessages(prev => {
          const existing = prev[phone]?.find(x => x.id === m.id);
          if (existing) return prev;

          const newMsg: WaMessage = {
  id: m.id,

  from:
    m.direction === 'inbound'
      ? 'contact'
      : 'agent',

  text: m.body || '',

  time: new Date(m.created_at)
    .toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    }),

  status: m.status || 'sent',

  mediaType:
    m.message_type === 'image'
      ? 'image'
      : m.message_type === 'file'
      ? 'file'
      : m.message_type === 'video'
      ? 'file'
      : m.message_type === 'audio'
      ? 'file'
      : undefined,

  mediaUrl: m.media_url || undefined,

  fileName: m.media_url
    ? m.media_url.split('/').pop()
    : undefined,

  employee_name: m.employee_name || '',
  message_type: m.message_type || '',
  media_url: m.media_url || '',
};

          const updated = { ...prev, [phone]: [...(prev[phone] || []), newMsg] };

          // Scroll to bottom when new message arrives
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

          return updated;
        });

        setContacts(prev => {
          const exists = prev.find(c => c.id === phone);
          const newTime = new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          if (exists) {
            return prev.map(c => c.id === phone ? { ...c, lastMsg: m.body || '', lastTime: newTime, unread: c.unread + (m.direction === 'inbound' ? 1 : 0) } : c);
          }
          const waName = waContacts[phone] || null;
          const name   = waName || m.contact_name || phone;
          const colors = ['#1e3a5f','#3a1c5f','#1a3a2f','#3a2a0f','#1c2a3a'];
          return [{ id: phone, name, phone, lastMsg: m.body || '', lastTime: newTime, unread: 1, status: 'active', avatar: name.slice(0, 2), avatarBg: colors[phone.length % colors.length] }, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (mediaPollingRef.current) clearInterval(mediaPollingRef.current);
    };
  }, [isAdminOrEmployee, configLoaded]);

  // ── تحميل البيانات عند فتح الصفحة ──
  useEffect(() => {
    if (!isAdminOrEmployee || configLoaded) return;
    const loadAll = async () => {
      try {
        // تحميل إعدادات API
        const { data: cfg } = await supabase
          .from('whatsapp_config')
          .select('display_phone, verified_name, quality_rating, is_active')
          .eq('config_key', 'main')
          .maybeSingle();
        if (cfg) {
          setDisplayPhone(cfg.display_phone || '');
          setVerifiedName(cfg.verified_name || '');
          if (cfg.is_active) setApiStatus('valid');
        }

        // تحميل المحادثات من messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('*')
          .order('created_at', { ascending: false });

        if (msgs && msgs.length > 0) {
          const contactMap: Record<string, WaContact> = {};
          const messageMap: Record<string, WaMessage[]> = {};
          // نحتاج نتتبع آخر timestamp لكل محادثة لترتيب القائمة
          const lastTimeMap: Record<string, number> = {};
          const colors = ['#1e3a5f','#3a1c5f','#1a3a2f','#3a2a0f','#1c2a3a'];

          // msgs مرتبة descending — أول رسالة لكل phone هي الأحدث
          msgs.forEach(m => {
            const phone = m.phone_number;
            const ts = new Date(m.created_at).getTime();
            const waMsg: WaMessage = {
              id: m.id,
              from: m.direction === 'inbound' ? 'contact' : 'agent',
              text: m.body || '',
              time: new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
              status: (m.status as any) || 'sent',
              mediaType: ['image'].includes(m.message_type) ? 'image'
                : ['file','document','video','audio'].includes(m.message_type) ? 'file'
                : undefined,
              mediaUrl: m.media_url || undefined,
              fileName: m.media_url ? decodeURIComponent(m.media_url.split('/').pop() || '') : undefined,
              isVideo: m.message_type === 'video',
            } as WaMessage;

            if (!messageMap[phone]) messageMap[phone] = [];
            messageMap[phone].push(waMsg);

            // آخر timestamp لهذه المحادثة
            if (!lastTimeMap[phone] || ts > lastTimeMap[phone]) {
              lastTimeMap[phone] = ts;
            }

            if (!contactMap[phone]) {
              // الأولوية: wa_contacts > contact_name > phone
              const waName    = waContacts[phone] || null;
              const savedName = m.contact_name && !/^\d+$/.test(m.contact_name) ? m.contact_name : null;
              const name      = waName || savedName || phone;
              contactMap[phone] = {
                id: phone,
                name,
                phone,
                lastMsg: m.body || (m.media_url ? '📎 مرفق' : ''),
                lastTime: new Date(m.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
                unread: 0,
                status: 'active',
                avatar: name.slice(0, 2),
                avatarBg: colors[phone.length % colors.length],
              };
            } else {
              // لو لقينا اسم أفضل، حدّثه (wa_contacts له الأولوية)
              const waName    = waContacts[phone] || null;
              const savedName = m.contact_name && !/^\d+$/.test(m.contact_name) ? m.contact_name : null;
              const bestName  = waName || savedName;
              if (bestName && /^\d+$/.test(contactMap[phone].name)) {
                contactMap[phone].name   = bestName;
                contactMap[phone].avatar = bestName.slice(0, 2);
              }
            }
          });

          // ترتيب رسائل كل محادثة تصاعدياً بالتاريخ الحقيقي
          Object.keys(messageMap).forEach(phone => {
            messageMap[phone].sort((a, b) =>
              new Date('1970/01/01 ' + a.time).getTime() - new Date('1970/01/01 ' + b.time).getTime()
            );
            // آخر رسالة لكل محادثة
            const last = messageMap[phone][messageMap[phone].length - 1];
            contactMap[phone].lastMsg = last.text || (last.mediaUrl ? '📎 مرفق' : '');
            contactMap[phone].lastTime = last.time;
          });

          // ترتيب المحادثات بالأحدث أولاً
          const sortedContacts = Object.values(contactMap).sort(
            (a, b) => (lastTimeMap[b.id] || 0) - (lastTimeMap[a.id] || 0)
          );

          setContacts(sortedContacts);
          setMessages(messageMap);
        }

        // تحميل القوالب
        const { data: tpls } = await supabase
          .from('messages')
          .select('template_name')
          .not('template_name', 'is', null)
          .limit(50);

        // تحميل wa_contacts — الأسماء المحفوظة لكل رقم
        const { data: waCons } = await supabase
          .from('wa_contacts')
          .select('phone, name');
        if (waCons) {
          const map: Record<string, string> = {};
          waCons.forEach(c => { if (c.name) map[c.phone] = c.name; });
          setWaContacts(map);
          // حدّث أسماء المحادثات الموجودة
          setContacts(prev => prev.map(c =>
            map[c.phone] ? { ...c, name: map[c.phone], avatar: map[c.phone].slice(0, 2) } : c
          ));
        }

      } catch (err) {
        console.error('loadAll error:', err);
      }
      setConfigLoaded(true);
    };
    loadAll();
  }, [isAdminOrEmployee, configLoaded]);

  /* ── Helpers ── */
  const currentMsgs = activeContact ? (messages[activeContact.id] || []) : [];

  const filteredContacts = contacts.filter(c => {
    const matchFilter =
      inboxFilter === 'all'     ? true :
      inboxFilter === 'unread'  ? c.unread > 0 :
      inboxFilter === 'pending' ? c.status === 'pending' :
      c.status === 'closed';
    const matchSearch = !searchQ || c.name.includes(searchQ) || c.phone.includes(searchQ);
    return matchFilter && matchSearch;
  });

  const now = () => new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  /* ── Load Media Gallery ── */
  const loadMediaGallery = useCallback(async () => {
    if (!isAdminOrEmployee) return;
    setMediaLoading(true);
    try {
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, phone_number, contact_name, message_type, media_url, body, created_at, direction')
        .in('message_type', ['image', 'video', 'file', 'document', 'audio'])
        .not('media_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

      if (msgs) {
        const items: WaMediaItem[] = msgs.map(m => ({
          id: m.id,
          phone: m.phone_number,
          contactName: m.contact_name || m.phone_number,
          type: (m.message_type === 'image' ? 'image' : m.message_type === 'audio' ? 'file' : m.message_type === 'video' ? 'video' : 'file') as 'image' | 'video' | 'file',
          url: m.media_url,
          fileName: m.media_url.split('/').pop() || 'file',
          caption: m.body || undefined,
          createdAt: m.created_at,
          direction: m.direction as 'inbound' | 'outbound',
        }));
        setMediaItems(items);
      }
    } catch (err) {
      console.error('[MediaGallery] Error:', err);
    } finally {
      setMediaLoading(false);
    }
  }, [isAdminOrEmployee]);

  /* ── Send Text — عبر Edge Function (التشفير في السيرفر) ── */
  const handleSend = async () => {
    if (!inputText.trim() || !activeContact) return;
    if (!sendRateLimiter.canProceed()) { showToast('أرسلت كثيراً، انتظر قليلاً', 'error'); return; }
    const clean = sanitizeInput(inputText);

    // أضف الرسالة للـ UI فوراً (Optimistic Update)
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, lastMsg: clean, lastTime: now() } : c));
    setInputText('');
    setShowTemplatesPicker(false);

    try {
      // إرسال عبر Edge Function — تفك التشفير وترسل لميتا وتحفظ في Supabase
      const sendRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp?action=send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            to:         activeContact.phone.replace(/^\+/, ''),
            message:    clean,
            employeeId: employeeProfile?.employee_id,
          }),
        }
      );
      const data = await sendRes.json();

      if (!sendRes.ok || data?.error) {
        console.warn('Send failed:', data?.error);
        showToast('فشل الإرسال — تحقق من إعدادات API', 'error');
        return;
      }
    } catch (err) {
      console.error('Send error:', err);
      showToast('خطأ في الإرسال', 'error');
    }
  };

  /* ── Send Media ── */
  const handleMediaSend = (type: MediaType) => {
    setShowMediaMenu(false);
    if (type === 'location') {
      if (!activeContact) return;
      const msg: WaMessage = {
        id: Date.now().toString(), from: 'agent', time: now(), status: 'sent',
        text: '', mediaType: 'location',
        location: { lat: 21.3891, lng: 39.8579, label: 'جدة، المملكة العربية السعودية' },
      };
      setMessages(prev => ({ ...prev, [activeContact.id]: [...(prev[activeContact.id] || []), msg] }));
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];

  if (!file || !activeContact) return;

  const isImage = file.type.startsWith('image/');
  const localUrl = URL.createObjectURL(file);
  const tempId = `temp_${Date.now()}`;

  // رسالة مؤقتة داخل الـ UI
  const tempMessage: WaMessage = {
    id: tempId,
    from: 'agent',
    time: now(),
    status: 'sent',

    text: '',
    message_type: isImage ? 'image' : 'document',

    media_url: localUrl,
    fileName: file.name,

    employee_name:
      employeeProfile?.employee_name ||
      employeeProfile?.employee_name ||
      'الموظف',
  };

  // تحديث الرسائل مباشرة
  setMessages(prev => ({
    ...prev,
    [activeContact.id]: [
      ...(prev[activeContact.id] || []),
      tempMessage,
    ],
  }));

  e.target.value = '';

  try {
    // رفع الملف إلى Supabase Storage
    const ext = file.name.split('.').pop();
    const filePath = `whatsapp/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    // جلب الرابط العام
    const { data: publicData } = supabase.storage
      .from('whatsapp-media')
      .getPublicUrl(filePath);

    const publicUrl = publicData.publicUrl;

    // إرسال عبر Edge Function
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp?action=send-media`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },

        body: JSON.stringify({
          to: activeContact.phone.replace(/^\+/, ''),

          mediaType: isImage ? 'image' : 'document',

          mediaUrl: publicUrl,

          fileName: file.name,

          employeeId: employeeProfile?.employee_id,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok || data?.error) {
      throw new Error(data?.error || 'فشل إرسال الملف');
    }

    // حدّث الرسالة المؤقتة بالـ ID الحقيقي
    setMessages(prev => ({
      ...prev,
      [activeContact.id]: (prev[activeContact.id] || []).map(msg =>
        msg.id === tempId
          ? { ...msg, id: data?.waMessageId || tempId, media_url: publicUrl, mediaUrl: publicUrl, status: 'delivered' }
          : msg
      ),
    }));

    showToast('✅ تم إرسال الملف', 'success');
  } catch (err: any) {
    console.error(err);

    showToast(
      err?.message || 'فشل إرسال الملف',
      'error'
    );

    // حذف الرسالة المؤقتة عند الفشل
    setMessages(prev => ({
      ...prev,

      [activeContact.id]: (
        prev[activeContact.id] || []
      ).filter(msg => msg.id !== tempId),
    }));
  }
};

  /* ── Template Pick ── */
  const pickTemplate = (t: WaTemplate) => {
    setInputText(t.text);
    setShowTemplatesPicker(false);
  };

  /* ── Close Conversation ── */
  const closeConversation = () => {
    if (!activeContact) return;
    setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, status: 'closed' } : c));
    setActiveContact(prev => prev ? { ...prev, status: 'closed' } : null);
    showToast('تم إغلاق المحادثة', 'success');
  };

  /* ── Bulk: Parse Numbers ── */
  const parseBulkNumbers = useCallback((raw: string): string[] => {
    return raw
      .split(/[\n,،\t;]+/)
      .map(n => n.trim().replace(/[\s-]/g, ''))
      .filter(n => /^(\+966|00966|05)\d{8,9}$/.test(n));
  }, []);

  useEffect(() => {
    setBulkParsed(parseBulkNumbers(bulkNumbers));
  }, [bulkNumbers, parseBulkNumbers]);

  /* ── Bulk: Excel ── */
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n').slice(1);
    const nums: string[] = [];
    for (const line of lines) {
      const cells = line.split(',');
      for (const cell of cells) {
        const n = cell.trim().replace(/[\s-"]/g, '');
        if (/^(\+966|00966|05)\d{8,9}$/.test(n)) nums.push(n);
      }
    }
    setBulkNumbers(nums.join('\n'));
    showToast(`تم استيراد ${nums.length} رقم من الملف`, 'success');
    e.target.value = '';
  };

  /* ── Bulk Send — عبر Edge Function ── */
  const handleBulkSend = async () => {
    if (!bulkRateLimiter.canProceed()) { showToast('انتظر قبل إرسال حملة جديدة', 'error'); return; }
    if (bulkParsed.length === 0) { showToast('لا توجد أرقام صالحة', 'error'); return; }
    if (!bulkTemplate.trim() && !metaTemplateId.trim()) { showToast('اكتب نص القالب أو أدخل Template Name', 'error'); return; }

    setBulkSending(true);
    setBulkProgress(10);

    try {
      const bulkRes = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp?action=bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            numbers:      bulkParsed.map(n => n.replace(/^\+/, '')),
            templateName: metaTemplateId.trim() || undefined,
            languageCode: bulkCategory === 'MARKETING' ? 'ar' : 'en',
            employeeId:   employeeProfile?.employee_id,
            freeText:     !metaTemplateId.trim() ? bulkTemplate.trim() : undefined,
          }),
        }
      );
      const data = await bulkRes.json();
      const error = !bulkRes.ok ? data : null;

      setBulkProgress(100);

      if (error || data?.error) {
        showToast(data?.error || 'فشل إطلاق الحملة', 'error');
      } else {
        showToast(`✅ تم إطلاق الحملة — ${bulkParsed.length} رسالة قيد الإرسال`, 'success');
        setBulkNumbers('');
        setBulkTemplate('');
        setMetaTemplateId('');
      }
    } catch (err: any) {
      showToast(err.message || 'خطأ في الإرسال', 'error');
    } finally {
      setBulkSending(false);
      setBulkProgress(0);
    }
  };

  /* ── Settings Save ── */
  const handleSaveProfile = async () => {
    setSavingProfile(true);
    await new Promise(r => setTimeout(r, 900));
    setSavingProfile(false);
    showToast('تم حفظ إعدادات الحساب', 'success');
  };

  /* ── API Verify — مباشر لـ Meta API ── */
  const handleVerifyApi = async () => {
    if (!apiToken.trim() || !phoneNumberId.trim()) {
      showToast('أدخل الـ Token ورقم الهاتف أولاً', 'error');
      return;
    }
    setVerifyingApi(true);
    setApiStatus('idle');
    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneNumberId.trim()}`,
        { headers: { Authorization: `Bearer ${apiToken.trim()}` } }
      );
      const json = await res.json();
      if (!res.ok || json.error) {
        const msg = json.error?.message || 'بيانات الـ API غير صحيحة';
        throw new Error(msg);
      }
      setApiStatus('valid');
      setDisplayPhone(json.display_phone_number || '');
      setVerifiedName(json.verified_name || '');
      showToast('✅ تم التحقق من بيانات الـ API بنجاح', 'success');
    } catch (err: any) {
      setApiStatus('invalid');
      showToast(err.message || '❌ بيانات الـ API غير صحيحة', 'error');
    } finally {
      setVerifyingApi(false);
    }
  };

  /* ── API Save — يحفظ عبر Edge Function (AES-GCM) ── */
  const handleSaveApi = async () => {
    if (!apiToken.trim() || !phoneNumberId.trim()) {
      showToast('أدخل البيانات المطلوبة أولاً', 'error');
      return;
    }
    setSavingApi(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            action:        'save-config',
            apiToken:      apiToken.trim(),
            phoneNumberId: phoneNumberId.trim(),
            wabaId:        wabaId.trim() || undefined,
            webhookSecret: webhookSecret.trim() || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || data?.error) throw new Error(data?.error || 'فشل الحفظ');

      setApiStatus('valid');
      setDisplayPhone(data.displayPhone || '');
      setVerifiedName(data.verifiedName || '');
      setApiToken('');
      setPhoneNumberId('');
      setWabaId('');
      setWebhookSecret('');
      showToast('✅ تم حفظ إعدادات API بأمان', 'success');
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
    } finally {
      setSavingApi(false);
    }
  };

  /* ── Meta WhatsApp pricing per message (SAR) — SA market rates ── */
  const META_PRICES_SAR: Record<string, number> = {
    MARKETING:      0.3375,  // ~$0.09 × 3.75
    UTILITY:        0.1125,  // ~$0.03 × 3.75
    AUTHENTICATION: 0.1313,  // ~$0.035 × 3.75
    SERVICE:        0.0,     // Free within 24h window
  };
  const pricePerMsg = META_PRICES_SAR[bulkCategory] ?? 0.3375;
  const totalCostSAR = (bulkParsed.length * pricePerMsg).toFixed(4);

  /* ── Preview bulk template ── */
  const previewTemplate = bulkTemplate
    .replace(/\{\{الاسم\}\}/g,     bulkVars['الاسم']     || 'أحمد')
    .replace(/\{\{المدينة\}\}/g,   bulkVars['المدينة']   || 'جدة')
    .replace(/\{\{التاريخ\}\}/g,   bulkVars['التاريخ']   || '١ يناير')
    .replace(/\{\{الرابط\}\}/g,    bulkVars['الرابط']    || 'almosaadah.sa');

  /* ─────────────────────────────────────────
     Styles
  ───────────────────────────────────────── */
  const bg     = dm ? '#0b1120' : '#f0f4f8';
  const card   = dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
  const border = dm ? 'rgba(8,145,178,0.2)' : 'rgba(8,145,178,0.15)';
  const txt1   = dm ? '#f1f5f9' : '#0f172a';
  const txt2   = dm ? '#94a3b8' : '#64748b';
  const txt3   = dm ? '#475569' : '#94a3b8';
  const hover  = dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)';
  const active = dm ? 'rgba(8,145,178,0.18)' : 'rgba(8,145,178,0.1)';
  const inputBg = dm ? 'rgba(30,41,59,0.8)' : 'rgba(248,250,252,1)';

  /* ─────────────────────────────────────────
     Render Helpers
  ───────────────────────────────────────── */

  /* NAV SIDEBAR */
  const renderNavItem = (_id: Tab, _icon: string, _label: string) => (
    <button
      aria-label={_label}
      onClick={() => setTab(_id)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '10px 0', border: 'none', background: 'transparent',
        cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", width: '100%',
        color: tab === _id ? '#0891b2' : txt3,
        borderRight: tab === _id ? '3px solid #0891b2' : '3px solid transparent',
        transition: 'all 0.2s',
      }}
    >
      <i className={_icon} style={{ fontSize: 20 }} />
      <span style={{ fontSize: 11, fontWeight: tab === _id ? 700 : 500 }}>{_label}</span>
    </button>
  );

  /* MESSAGE BUBBLE */
  const renderMsgBubble = (msg: WaMessage) => {
  const isOut = msg.from === 'agent';

  return (
    <div
      style={{
        alignSelf: isOut ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
      }}
    >
      <div
        style={{
          background: isOut
            ? 'linear-gradient(135deg, rgba(8,145,178,0.22), rgba(8,145,178,0.12))'
            : (dm
                ? 'rgba(30,41,59,0.9)'
                : '#fff'),

          border: `1px solid ${
            isOut
              ? 'rgba(8,145,178,0.35)'
              : border
          }`,

          borderRadius: isOut
            ? '16px 4px 16px 16px'
            : '4px 16px 16px 16px',

          padding: '10px 14px',
          fontSize: 14,
          lineHeight: 1.6,
          color: txt1,
        }}
      >
        {/* اسم الموظف */}
        {msg.employee_name && (
          <div
            style={{
              fontSize: 11,
              color: '#38bdf8',
              marginBottom: 4,
              fontWeight: 'bold',
            }}
          >
            {msg.employee_name}
          </div>
        )}

        {/* صورة */}
        {msg.message_type === 'image' &&
          msg.media_url && (
            <img
              src={msg.media_url}
              alt="صورة"
              onClick={() =>
                window.open(msg.media_url, '_blank')
              }
              style={{
                maxWidth: 240,
                borderRadius: 12,
                cursor: 'pointer',
                display: 'block',
              }}
            />
          )}

        {/* فيديو */}
        {msg.message_type === 'video' &&
          msg.media_url && (
            <video
              controls
              style={{
                maxWidth: 240,
                borderRadius: 12,
              }}
            >
              <source src={msg.media_url} />
            </video>
          )}

        {/* صوت */}
        {msg.message_type === 'audio' &&
          msg.media_url && (
            <audio controls>
              <source src={msg.media_url} />
            </audio>
          )}

        {/* ملف */}
        {msg.message_type === 'document' &&
          msg.media_url && (
            <a
              href={msg.media_url}
              target="_blank"
              rel="noreferrer"
              style={{
                color: '#38bdf8',
                textDecoration: 'underline',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <i className="fas fa-file" />
              {msg.fileName || 'تحميل الملف'}
            </a>
          )}

        {/* موقع */}
        {msg.message_type === 'location' &&
          msg.location && (
            <div
              onClick={() =>
                window.open(
                  `https://maps.google.com/?q=${msg.location!.lat},${msg.location!.lng}`,
                  '_blank'
                )
              }
              style={{
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  background:
                    'rgba(8,145,178,0.15)',
                  height: 80,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <i
                  className="fas fa-map-marker-alt"
                  style={{
                    fontSize: 32,
                    color: '#0891b2',
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {msg.location?.label}
              </div>
            </div>
          )}

        {/* نص */}
        {(!msg.message_type ||
          msg.message_type === 'text') && (
          <span>{msg.text}</span>
        )}
      </div>

      {/* الوقت والحالة */}
      <div
        style={{
          fontSize: 11,
          color: txt3,
          marginTop: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          justifyContent: isOut
            ? 'flex-end'
            : 'flex-start',
        }}
      >
        {msg.time}

        {isOut &&
          msg.status === 'read' && (
            <i
              className="fas fa-check-double"
              style={{
                color: '#0891b2',
                fontSize: 11,
              }}
            />
          )}

        {isOut &&
          msg.status === 'delivered' && (
            <i
              className="fas fa-check-double"
              style={{
                color: txt3,
                fontSize: 11,
              }}
            />
          )}

        {isOut &&
          msg.status === 'sent' && (
            <i
              className="fas fa-check"
              style={{
                color: txt3,
                fontSize: 11,
              }}
            />
          )}
      </div>
    </div>
  );
};

  /* ── INBOX TAB ── */
  const renderInboxTab = () => (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Contacts List */}
      <div style={{ width: 280, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '14px 12px 10px', borderBottom: `1px solid ${border}` }}>
          {/* Search + Refresh */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: inputBg, border: `1px solid ${border}`, borderRadius: 12, padding: '7px 12px' }}>
              <i className="fas fa-search" style={{ color: txt3, fontSize: 13 }} />
              <input
                aria-label="بحث في المحادثات"
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="بحث في المحادثات..."
                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, color: txt1, fontFamily: "'Tajawal', sans-serif", width: '100%', direction: 'rtl' }}
              />
            </div>
            <button onClick={() => setConfigLoaded(false)} title="تحديث المحادثات" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: txt3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fas fa-sync-alt" style={{ fontSize: 12 }} />
            </button>
          </div>
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: 5, overflowX: 'auto' }}>
            {([
              { id: 'all', label: 'الكل' }, { id: 'unread', label: 'غير مقروء' },
              { id: 'pending', label: 'انتظار' }, { id: 'closed', label: 'مغلقة' },
            ] as const).map(f => (
              <button key={f.id} onClick={() => setInboxFilter(f.id)} style={{
                padding: '4px 11px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontFamily: "'Tajawal', sans-serif", fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                background: inboxFilter === f.id ? '#0891b2' : (dm ? 'rgba(255,255,255,0.06)' : '#f1f5f9'),
                color: inboxFilter === f.id ? '#fff' : txt2,
              }}>{f.label}</button>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredContacts.map(c => (
            <div key={c.id} onClick={async () => {
              setActiveContact(c);
              setContacts(prev => prev.map(x => x.id === c.id ? { ...x, unread: 0 } : x));
              // تحديث حالة الرسائل كـ "مقروءة" في Supabase
              try {
                await supabase
                  .from('messages')
                  .update({ status: 'read' })
                  .eq('phone_number', c.phone)
                  .eq('direction', 'inbound')
                  .neq('status', 'read');
              } catch {}
            }} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
              borderBottom: `1px solid ${border}`, cursor: 'pointer',
              background: activeContact?.id === c.id ? active : 'transparent',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (activeContact?.id !== c.id) (e.currentTarget as HTMLDivElement).style.background = hover; }}
            onMouseLeave={e => { if (activeContact?.id !== c.id) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{c.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: txt1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ fontSize: 12, color: txt2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{c.lastMsg}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: txt3 }}>{c.lastTime}</div>
                {c.unread > 0 && (
                  <div style={{ background: '#0891b2', color: '#fff', borderRadius: 99, fontSize: 11, fontWeight: 700, minWidth: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' }}>{c.unread}</div>
                )}
              </div>
            </div>
          ))}
          {filteredContacts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: txt3 }}>
              <i className="fas fa-inbox" style={{ fontSize: 36, opacity: 0.25, display: 'block', marginBottom: 10 }} />
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>لا توجد محادثات</div>
              <div style={{ fontSize: 11 }}>ستظهر المحادثات هنا عند وصول رسائل عبر Webhook</div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      {activeContact ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Chat Header */}
          <div style={{ padding: '12px 18px', borderBottom: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: activeContact.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>{activeContact.avatar}</div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {editingName ? (
                    <input
                      aria-label="تعديل اسم جهة الاتصال"
                      autoFocus
                      value={editNameVal}
                      onChange={e => setEditNameVal(e.target.value)}
                      onBlur={async () => {
                        const newName = editNameVal.trim();
                        if (newName && newName !== activeContact.name) {
                          // حدّث الـ UI فوراً
                          setContacts(prev => prev.map(c => c.id === activeContact.id ? { ...c, name: newName, avatar: newName.slice(0,2) } : c));
                          setActiveContact(prev => prev ? { ...prev, name: newName, avatar: newName.slice(0,2) } : null);
                          setWaContacts(prev => ({ ...prev, [activeContact.phone]: newName }));
                          try {
                            // 1) احفظ في wa_contacts (upsert بالرقم)
                            await supabase.from('wa_contacts').upsert(
                              { phone: activeContact.phone, name: newName },
                              { onConflict: 'phone' }
                            );
                            // 2) حدّث contact_name في كل رسائل هذا الرقم
                            await supabase.from('messages')
                              .update({ contact_name: newName })
                              .eq('phone_number', activeContact.phone);
                            showToast('✅ تم حفظ الاسم', 'success');
                          } catch (e) {
                            showToast('فشل حفظ الاسم', 'error');
                          }
                        }
                        setEditingName(false);
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingName(false); }}
                      style={{ fontSize: 15, fontWeight: 700, color: txt1, background: 'transparent', border: 'none', borderBottom: `2px solid #0891b2`, outline: 'none', fontFamily: "'Tajawal', sans-serif", minWidth: 120, direction: 'rtl' }}
                    />
                  ) : (
                    <div style={{ fontSize: 15, fontWeight: 700, color: txt1 }}>{activeContact.name}</div>
                  )}
                  <button
                    aria-label="تعديل الاسم"
                    onClick={() => { setEditNameVal(activeContact.name); setEditingName(true); }}
                    title="تعديل الاسم"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: txt3, padding: 2 }}
                  >
                    <i className="fas fa-pen" style={{ fontSize: 10 }} />
                  </button>
                </div>
                <div style={{ fontSize: 12, color: txt2, display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: activeContact.status === 'active' ? '#22c55e' : activeContact.status === 'pending' ? '#f59e0b' : '#64748b' }} />
                  {activeContact.status === 'active' ? 'نشط' : activeContact.status === 'pending' ? 'بانتظار رد' : 'مغلق'}
                  <span style={{ marginRight: 4, color: txt3 }}>•</span>
                  <span style={{ color: txt3 }}>{activeContact.phone}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowTemplatesPicker(p => !p)} title="القوالب" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: txt2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-layer-group" style={{ fontSize: 15 }} />
              </button>
              <button onClick={closeConversation} title="إغلاق المحادثة" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: txt2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-check" style={{ fontSize: 15 }} />
              </button>
            </div>
          </div>

          {/* Templates Picker */}
          {showTemplatesPicker && (
            <div style={{ borderBottom: `1px solid ${border}`, padding: '10px 14px', background: dm ? 'rgba(15,23,42,0.6)' : 'rgba(240,244,248,0.8)', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: txt2, marginBottom: 8, fontWeight: 700 }}>اختر قالباً:</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {templates.filter(t => t.approved).map(t => (
                  <button key={t.id} onClick={() => pickTemplate(t)} style={{
                    padding: '6px 14px', borderRadius: 20, border: `1px solid ${border}`,
                    background: inputBg, cursor: 'pointer', fontFamily: "'Tajawal', sans-serif",
                    fontSize: 13, color: txt1, whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all 0.15s',
                  }}>{t.name}</button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, background: dm ? 'rgba(7,15,30,0.5)' : 'rgba(240,244,248,0.6)' }}>
            {currentMsgs.map(msg => <div key={msg.id}>{renderMsgBubble(msg)}</div>)}
            {activeContact && typingContacts.has(activeContact.id) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: activeContact.avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, flexShrink: 0 }}>{activeContact.avatar}</div>
                <div style={{ background: dm ? 'rgba(30,41,59,0.9)' : '#fff', borderRadius: '4px 16px 16px 16px', padding: '10px 14px', display: 'flex', gap: 4, alignItems: 'center' }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: `typing-dot 1.2s ${i*0.2}s infinite ease-in-out` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>

              {/* Media Button */}
              <div style={{ position: 'relative' }}>
                <button aria-label="إرفاق ملف أو وسائط" title="إرفاق" onClick={() => setShowMediaMenu(p => !p)} style={{ width: 38, height: 38, borderRadius: '50%', border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: txt2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fas fa-paperclip" style={{ fontSize: 16 }} />
                </button>
                {showMediaMenu && (
                  <div style={{ position: 'absolute', bottom: 46, right: 0, background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 8, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 50, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', minWidth: 150 }}>
                    {[
                      { icon: 'fa-image',           label: 'صورة',   color: '#0891b2', action: () => handleMediaSend('image') },
                      { icon: 'fa-file-alt',         label: 'ملف',    color: '#7c3aed', action: () => handleMediaSend('file') },
                      { icon: 'fa-map-marker-alt',   label: 'الموقع', color: '#16a34a', action: () => handleMediaSend('location') },
                    ].map(item => (
                      <button key={item.icon} onClick={item.action} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", fontSize: 13, color: txt1, textAlign: 'right', width: '100%' }}
                        onMouseEnter={e => (e.currentTarget.style.background = hover)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <i className={`fas ${item.icon}`} style={{ fontSize: 16, color: item.color, width: 20, textAlign: 'center' }} />
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <input type="file" ref={fileInputRef} aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleFileUpload} />


              <textarea
                aria-label="اكتب رسالتك هنا"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="اكتب ردك هنا... (Enter للإرسال)"
                rows={1}
                style={{
                  flex: 1,
                  border: `1px solid ${border}`,
                  borderRadius: 14,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontFamily: "'Tajawal', sans-serif",
                  background: inputBg,
                  color: txt1,
                  resize: 'none',
                  outline: 'none',
                  direction: 'rtl',
                  lineHeight: 1.5,
                  maxHeight: 100,
                  overflowY: 'auto',
                }}
              />

              <button aria-label="إرسال الرسالة" title="إرسال" onClick={handleSend} disabled={!inputText.trim()} style={{
                width: 40, height: 40, borderRadius: '50%',
                background: inputText.trim() ? 'linear-gradient(135deg, #0891b2, #0e7490)' : (dm ? 'rgba(30,41,59,0.6)' : '#e2e8f0'),
                border: 'none', cursor: inputText.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                transition: 'all 0.2s', boxShadow: inputText.trim() ? '0 4px 16px rgba(8,145,178,0.4)' : 'none',
              }}>
                <i className="fas fa-paper-plane" style={{ fontSize: 15, color: inputText.trim() ? '#fff' : txt3, transform: 'rotate(180deg)' }} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: txt3, flexDirection: 'column', gap: 12 }}>
          <i className="fas fa-comments" style={{ fontSize: 48, opacity: 0.3 }} />
          <div style={{ fontSize: 14 }}>اختر محادثة من القائمة</div>
        </div>
      )}
    </div>
  );

  /* ── BULK TAB ── */
  const renderBulkTab = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* Recipients Card */}
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: txt1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-users" style={{ color: '#0891b2', fontSize: 16 }} />
            قائمة المستلمين
          </div>

          {/* Upload Excel */}
          <input type="file" ref={excelInputRef} accept=".xlsx,.xls,.csv" aria-hidden="true" tabIndex={-1} style={{ display: 'none' }} onChange={handleExcelUpload} />
          <div
            onClick={() => excelInputRef.current?.click()}
            style={{ border: '2px dashed rgba(8,145,178,0.4)', borderRadius: 12, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', background: dm ? 'rgba(8,145,178,0.05)' : 'rgba(8,145,178,0.03)', marginBottom: 14, transition: 'all 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#0891b2')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(8,145,178,0.4)')}
          >
            <i className="fas fa-file-excel" style={{ fontSize: 28, color: '#16a34a', display: 'block', marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 700, color: txt1, marginBottom: 4 }}>ارفع ملف Excel / CSV</div>
            <div style={{ fontSize: 11, color: txt3 }}>.xlsx أو .csv — العمود الأول يحتوي الأرقام</div>
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: txt3, marginBottom: 12 }}>— أو —</div>

          <textarea
            aria-label="أرقام الهواتف للإرسال الجماعي"
            value={bulkNumbers}
            onChange={e => setBulkNumbers(e.target.value)}
            placeholder={`الصق الأرقام هنا (رقم في كل سطر)\n+966501234567\n+966509876543`}
            rows={5}
            style={{ width: '100%', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: "'Tajawal', sans-serif", background: inputBg, color: txt1, resize: 'vertical', outline: 'none', direction: 'rtl', boxSizing: 'border-box' }}
          />

          {/* Parsed Preview */}
          {bulkParsed.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: txt2, marginBottom: 8, fontWeight: 700 }}>
                <i className="fas fa-check-circle" style={{ color: '#22c55e', marginLeft: 6 }} />
                {bulkParsed.length} رقم صالح
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {bulkParsed.slice(0, 6).map((n, i) => (
                  <span key={i} style={{ background: 'rgba(8,145,178,0.12)', color: '#0891b2', borderRadius: 99, fontSize: 11, padding: '3px 10px', border: '1px solid rgba(8,145,178,0.3)' }}>{n}</span>
                ))}
                {bulkParsed.length > 6 && (
                  <span style={{ background: dm ? 'rgba(30,41,59,0.6)' : '#f1f5f9', color: txt2, borderRadius: 99, fontSize: 11, padding: '3px 10px', border: `1px solid ${border}` }}>+{bulkParsed.length - 6} آخرين</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Template Card */}
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: txt1, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-layer-group" style={{ color: '#7c3aed', fontSize: 16 }} />
            نص القالب
          </div>

          {/* ── نوع الرسالة ── */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: txt2, marginBottom: 8, fontWeight: 700 }}>نوع الرسالة:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {([
                { key: 'MARKETING',      label: 'تسويقية',   icon: 'fas fa-bullhorn',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border2: 'rgba(245,158,11,0.4)'  },
                { key: 'UTILITY',        label: 'خدمة / إشعار', icon: 'fas fa-bell',      color: '#0891b2', bg: 'rgba(8,145,178,0.1)',   border2: 'rgba(8,145,178,0.4)'   },
                { key: 'AUTHENTICATION', label: 'مصادقة (OTP)', icon: 'fas fa-shield-alt', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)',  border2: 'rgba(124,58,237,0.4)'  },
                { key: 'SERVICE',        label: 'محادثة (مجاني)', icon: 'fas fa-comments', color: '#16a34a', bg: 'rgba(22,163,74,0.1)',   border2: 'rgba(22,163,74,0.4)'   },
              ] as const).map(c => (
                <button
                  key={c.key}
                  onClick={() => setBulkCategory(c.key)}
                  style={{
                    padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: "'Tajawal', sans-serif", fontSize: 12, fontWeight: bulkCategory === c.key ? 800 : 600,
                    border: `2px solid ${bulkCategory === c.key ? c.border2 : border}`,
                    background: bulkCategory === c.key ? c.bg : 'transparent',
                    color: bulkCategory === c.key ? c.color : txt2,
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                    transition: 'all 0.18s',
                  }}
                >
                  <i className={c.icon} style={{ fontSize: 13 }} />
                  {c.label}
                </button>
              ))}
            </div>
            {/* Price hint */}
            <div style={{ marginTop: 8, fontSize: 11, color: txt3, background: dm ? 'rgba(30,41,59,0.5)' : '#f8fafc', borderRadius: 8, padding: '6px 10px', border: `1px solid ${border}` }}>
              <i className="fas fa-info-circle" style={{ marginLeft: 5, color: '#0891b2' }} />
              سعر الرسالة الواحدة:{' '}
              <strong style={{ color: txt1 }}>
                {bulkCategory === 'SERVICE' ? 'مجاناً (ضمن 24 ساعة)' : `${META_PRICES_SAR[bulkCategory]?.toFixed(4)} ريال`}
              </strong>
              {' '}— أسعار ميتا للسوق السعودي
            </div>
          </div>

          {/* Meta Template ID */}
          <div style={{ marginBottom: 12 }}>
  <div style={{ fontSize: 12, color: txt2, marginBottom: 6, fontWeight: 700 }}>
    Template ID من ميتا{' '}
    <span style={{ fontWeight: 400, color: txt3 }}>(اختياري — لو عندك قالب معتمد)</span>
  </div>
  <input
    type="text"
    value={metaTemplateId}
    /* تم حذف الـ replace لتسمح بدخول النصوص والأرقام */
    onChange={e => setMetaTemplateId(e.target.value)} 
    placeholder="أدخل معرف القالب هنا"
    aria-label="Template ID من ميتا"
    title="Template ID من ميتا"
    style={{ 
      width: '100%', 
      border: `1px solid ${border}`, 
      borderRadius: 10, 
      padding: '8px 12px', 
      fontSize: 13, 
      fontFamily: "'Tajawal', sans-serif", 
      background: inputBg, 
      color: txt1, 
      outline: 'none', 
      direction: 'ltr', 
      boxSizing: 'border-box' 
    }}
  />
</div>

          {/* Quick Templates */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: txt2, marginBottom: 6 }}>قوالب معتمدة:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {templates.filter(t => t.approved).map(t => (
                <button key={t.id} onClick={() => { setBulkTemplate(t.text); setBulkCategory(t.category as any); }} style={{ padding: '4px 12px', borderRadius: 20, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", fontSize: 12, color: txt1 }}>{t.name}</button>
              ))}
            </div>
          </div>

          {/* Var chips */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {['{{الاسم}}', '{{المدينة}}', '{{التاريخ}}', '{{الرابط}}'].map(v => (
              <button key={v} onClick={() => setBulkTemplate(p => p + v)} style={{ padding: '3px 10px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 99, fontSize: 12, border: '1px solid rgba(124,58,237,0.25)', cursor: 'pointer', fontFamily: "'Tajawal', sans-serif" }}>{v}</button>
            ))}
          </div>

          <textarea
            aria-label="نص قالب الرسالة الجماعية"
            value={bulkTemplate}
            onChange={e => setBulkTemplate(e.target.value)}
            placeholder="اكتب نص القالب هنا..."
            rows={6}
            style={{ width: '100%', border: `1px solid ${border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: "'Tajawal', sans-serif", background: inputBg, color: txt1, resize: 'none', outline: 'none', direction: 'rtl', boxSizing: 'border-box', marginBottom: 12 }}
          />

          {/* Preview */}
          {previewTemplate && (
            <div>
              <div style={{ fontSize: 12, color: txt2, marginBottom: 6, fontWeight: 700 }}>معاينة:</div>
              <div style={{ background: 'rgba(8,145,178,0.1)', border: '1px solid rgba(8,145,178,0.25)', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: dm ? '#7dd3fc' : '#0e7490', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{previewTemplate}</div>
            </div>
          )}
        </div>

        {/* Summary + Send */}
        <div style={{ gridColumn: '1 / -1', background: card, border: `1px solid ${border}`, borderRadius: 18, padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { label: 'عدد المستلمين', value: bulkParsed.length, color: txt1 },
              { label: 'التكلفة الإجمالية (ريال)', value: bulkCategory === 'SERVICE' ? 'مجاناً' : totalCostSAR, color: '#0891b2' },
              { label: 'وقت الإرسال', value: 'فوري', color: '#f59e0b' },
            ].map(s => (
              <div key={s.label} style={{ background: dm ? 'rgba(30,41,59,0.6)' : '#f8fafc', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 12, color: txt2, marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {bulkSending && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13, color: txt2 }}>
                <span>جاري الإرسال...</span>
                <span style={{ fontWeight: 700, color: '#0891b2' }}>{bulkProgress}%</span>
              </div>
              <div style={{ height: 8, background: dm ? 'rgba(30,41,59,0.8)' : '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${bulkProgress}%`, background: 'linear-gradient(90deg, #0891b2, #0e7490)', borderRadius: 99, transition: 'width 0.1s' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => { setBulkNumbers(''); setBulkTemplate(''); setBulkParsed([]); }} style={{ padding: '10px 20px', borderRadius: 12, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 700, color: txt2 }}>
              مسح
            </button>
            <button onClick={handleBulkSend} disabled={bulkSending || bulkParsed.length === 0 || (!bulkTemplate.trim() && !metaTemplateId.trim())} style={{
              padding: '10px 28px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 800,
              background: (bulkSending || bulkParsed.length === 0 || (!bulkTemplate.trim() && !metaTemplateId.trim())) ? (dm ? 'rgba(30,41,59,0.6)' : '#e2e8f0') : 'linear-gradient(135deg, #0891b2, #0e7490)',
              color: (bulkSending || bulkParsed.length === 0 || (!bulkTemplate.trim() && !metaTemplateId.trim())) ? txt3 : '#fff',
              boxShadow: (bulkSending || bulkParsed.length === 0 || (!bulkTemplate.trim() && !metaTemplateId.trim())) ? 'none' : '0 4px 16px rgba(8,145,178,0.4)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {bulkSending ? <><i className="fas fa-spinner fa-spin" style={{ fontSize: 14 }} /> جاري الإرسال...</> : <><i className="fas fa-rocket" style={{ fontSize: 14 }} /> إطلاق الحملة</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  /* ── TEMPLATES TAB ── */
  const renderTemplatesTab = () => (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#fff', fontFamily: "'Tajawal', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fas fa-plus" /> قالب جديد
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {templates.map(t => (
            <div key={t.id} style={{ background: card, border: `1px solid ${border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: txt1 }}>{t.name}</div>
                  <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99, background: t.approved ? 'rgba(22,163,74,0.1)' : 'rgba(234,179,8,0.1)', color: t.approved ? '#16a34a' : '#d97706', border: `1px solid ${t.approved ? 'rgba(22,163,74,0.3)' : 'rgba(234,179,8,0.3)'}`, fontWeight: 700 }}>
                    {t.approved ? '✓ معتمد' : '⏳ قيد المراجعة'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button aria-label={`تعديل قالب ${t.name}`} title="تعديل" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${border}`, background: 'transparent', cursor: 'pointer', color: txt2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-edit" style={{ fontSize: 14 }} />
                  </button>
                  <button aria-label={`حذف قالب ${t.name}`} title="حذف" style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', cursor: 'pointer', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-trash" style={{ fontSize: 14 }} />
                  </button>
                </div>
              </div>
              <div style={{ fontSize: 13, color: txt2, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: dm ? 'rgba(30,41,59,0.4)' : '#f8fafc', padding: '10px 12px', borderRadius: 10, border: `1px solid ${border}` }}>{t.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ── GALLERY TAB — مستودع الوسائط مثل الواتساب ── */
  const renderGalleryTab = () => {
    return <GalleryTab
      tab={tab} mediaItems={mediaItems} mediaViewTab={mediaViewTab}
      mediaLoading={mediaLoading} mediaViewerOpen={mediaViewerOpen}
      mediaViewerIndex={mediaViewerIndex} dm={dm} border={border}
      txt1={txt1} txt2={txt2} txt3={txt3} card={card}
      loadMediaGallery={loadMediaGallery}
      setMediaViewTab={setMediaViewTab}
      setMediaViewerOpen={setMediaViewerOpen}
      setMediaViewerIndex={setMediaViewerIndex}
      setMediaItems={setMediaItems}
      supabase={supabase}
    />;
  };

  // ─── GalleryTab كـ Component حقيقي لتجنب مشكلة الـ hooks ───

  /* ── SETTINGS TAB ── */
  const renderSettingsTab = () => (
    <SettingsTabComponent
      dm={dm}
      profileName={profileName} setProfileName={setProfileName}
      profileAbout={profileAbout} setProfileAbout={setProfileAbout}
      profileAvatar={profileAvatar} setProfileAvatar={setProfileAvatar}
      savingProfile={savingProfile} handleSaveProfile={handleSaveProfile}
      avatarInputRef={avatarInputRef}
      apiToken={apiToken} setApiToken={setApiToken}
      phoneNumberId={phoneNumberId} setPhoneNumberId={setPhoneNumberId}
      wabaId={wabaId} setWabaId={setWabaId}
      webhookSecret={webhookSecret} setWebhookSecret={setWebhookSecret}
      showToken={showToken} setShowToken={setShowToken}
      showWebhook={showWebhook} setShowWebhook={setShowWebhook}
      apiStatus={apiStatus} setApiStatus={setApiStatus}
      verifyingApi={verifyingApi} savingApi={savingApi}
      displayPhone={displayPhone} verifiedName={verifiedName}
      handleVerifyApi={handleVerifyApi} handleSaveApi={handleSaveApi}
    />
  );

  /* ─────────────────────────────────────────
     Main Render
  ───────────────────────────────────────── */
  return (
    <div style={{ minHeight: '100dvh', fontFamily: "'Tajawal', sans-serif", direction: 'rtl', background: bg, overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes typing-dot { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-6px); opacity: 1; } }
        @keyframes bounce { 0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fa-spin { animation: spin 1s linear infinite; }
        * { box-sizing: border-box; }
        textarea, input { font-family: 'Tajawal', sans-serif !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(8,145,178,0.3); border-radius: 99px; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ padding: '100px 24px 32px', position: 'relative', zIndex: 10,  }}>
        <div style={{ maxWidth: 1300, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: dm ? 'linear-gradient(135deg,#1e3a5f,#0891b2)' : 'linear-gradient(135deg,#e0f2fe,#bae6fd)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 14, boxShadow: dm ? '0 8px 32px rgba(8,145,178,0.4)' : '0 8px 32px rgba(8,145,178,0.2)' }}>
              <i className="fab fa-whatsapp" style={{ color: '#0891b2' }} />
            </div>
            <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, margin: '0 0 8px', color: dm ? '#f1f5f9' : '#0f172a', lineHeight: 1.2 }}>منصة تواصل واتساب</h1>
            <p style={{ fontSize: 14, color: dm ? '#94a3b8' : '#64748b', margin: 0 }}>راسل عملاء الجمعيات وأرسل حملات جماعية بكل أمان</p>
          </div>
          <div style={{ display: 'flex', gap: 12, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {[
              { label: 'محادثات نشطة', value: contacts.filter(c => c.status !== 'closed').length, color: '#0891b2', icon: 'fas fa-comments' },
              { label: 'رسائل غير مقروءة', value: contacts.reduce((a, c) => a + c.unread, 0), color: '#7c3aed', icon: 'fas fa-envelope' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 20px', borderRadius: 16, background: dm ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.85)', border: `1px solid ${border}`, textAlign: 'center', backdropFilter: 'blur(12px)', minWidth: 110 }}>
                <div style={{ fontSize: 32, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: dm ? '#94a3b8' : '#64748b', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
            <div style={{ padding: '14px 20px', borderRadius: 16, background: dm ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.85)', border: `1px solid ${border}`, textAlign: 'center', backdropFilter: 'blur(12px)', minWidth: 110 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: apiStatus === 'valid' ? '#22c55e' : apiStatus === 'invalid' ? '#ef4444' : txt3, lineHeight: 1, marginBottom: 4 }}>
                <i className={`fas ${apiStatus === 'valid' ? 'fa-circle' : 'fa-circle'}`} style={{ fontSize: 10, marginLeft: 5, color: apiStatus === 'valid' ? '#22c55e' : apiStatus === 'invalid' ? '#ef4444' : '#94a3b8' }} />
                {apiStatus === 'valid' ? 'متصل' : apiStatus === 'invalid' ? 'خطأ' : 'غير محدد'}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: dm ? '#94a3b8' : '#64748b' }}>حالة API</div>
              {verifiedName && <div style={{ fontSize: 10, color: txt3, marginTop: 2 }}>{verifiedName}</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Panel ── */}
      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '0 24px 40px',  }}>
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 20, overflow: 'hidden', display: 'flex', height: 'calc(100dvh - 260px)', minHeight: 500, boxShadow: dm ? '0 24px 80px rgba(0,0,0,0.4)' : '0 8px 48px rgba(8,145,178,0.1)' }}>

          {/* Vertical Nav */}
          <div style={{ width: 72, borderLeft: `1px solid ${border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, background: dm ? 'rgba(7,15,30,0.6)' : 'rgba(240,244,248,0.6)', flexShrink: 0 }}>
            {renderNavItem("inbox",     "fas fa-inbox",        "الرسائل")}
            {renderNavItem("bulk",      "fas fa-rocket",       "جماعي")}
            {renderNavItem("templates", "fas fa-layer-group",  "القوالب")}
            {renderNavItem("gallery",   "fas fa-images",       "الوسائط")}
            {renderNavItem("settings",  "fas fa-sliders-h",    "الحساب")}
          </div>

          {/* Content */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {tab === 'inbox'     && renderInboxTab()}
            {tab === 'bulk'      && renderBulkTab()}
            {tab === 'templates' && renderTemplatesTab()}
            {tab === 'gallery'   && renderGalleryTab()}
            {tab === 'settings'  && renderSettingsTab()}
          </div>
        </div>
      </div>
    </div>
  );
}