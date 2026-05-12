// components/AdminReviewQueue.tsx
// واجهة الأدمن لمراجعة الآراء والتقييمات قبل نشرها
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

interface PendingItem {
  id: string;
  user_id: string;
  type: 'review' | 'project';
  title?: string;
  review_text?: string;
  rating?: number;
  project_file_url?: string | null;
  file_name?: string | null;
  project_type?: string;
  created_at: string;
  user?: { association_name: string };
}

interface AdminReviewQueueProps {
  /** 'review' | 'project' | 'all' */
  mode?: 'review' | 'project' | 'all';
  onClose?: () => void;
}

const PROJECT_TYPE_LABELS: Record<string, string> = {
  emergency:   '🚑 الإغاثة العاجلة',
  development: '🌱 مشاريع التنمية',
  social:      '🤝 الرعاية الاجتماعية',
  seasonal:    '📅 المشاريع الموسمية',
  endowment:   '🕌 المشاريع الوقفية',
};

export function AdminReviewQueue({ mode = 'all', onClose }: AdminReviewQueueProps) {
  const { user, isAdmin, isEmployee } = useAuth();
  const { showToast } = useToast();

  const [items, setItems]           = useState<PendingItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'review' | 'project'>(mode === 'project' ? 'project' : 'review');
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<PendingItem | null>(null);

  const isStaff = isAdmin || isEmployee;

  useEffect(() => {
    if (isStaff) loadPending();
  }, [isStaff, activeTab]);

  /* ───────── fetch ───────── */
  const loadPending = async () => {
    setLoading(true);
    try {
      if (activeTab === 'review') {
        const { data, error } = await supabase
          .from('reviews')
          .select('*, user:user(association_name)')
          .eq('is_active', false)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setItems((data || []).map(r => ({ ...r, type: 'review' as const })));
      } else {
        const { data, error } = await supabase
          .from('projects')
          .select('*, user:user(association_name)')
          .eq('status', 'pending')
          .order('created_at', { ascending: true });

        if (error) throw error;
        setItems((data || []).map(p => ({
          id: p.id,
          user_id: p.user_id,
          type: 'project' as const,
          title: p.project_name,
          project_type: p.project_type,
          project_file_url: p.project_file_url,
          file_name: p.file_name,
          created_at: p.created_at,
          user: p.user,
        })));
      }
    } catch (err) {
      showToast('حدث خطأ في تحميل البيانات', 'error');
    } finally {
      setLoading(false);
    }
  };

  /* ───────── approve ───────── */
  const handleApprove = async (item: PendingItem) => {
    setProcessing(item.id);
    try {
      if (item.type === 'review') {
        const { error } = await supabase
          .from('reviews')
          .update({ is_active: true })
          .eq('id', item.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('projects')
          .update({ status: 'approved' })
          .eq('id', item.id);
        if (error) throw error;
      }
      showToast('✅ تم الاعتماد ونُشر للمستخدمين', 'success');
      setPreviewItem(null);
      loadPending();
    } catch (err) {
      showToast('حدث خطأ أثناء الاعتماد', 'error');
    } finally {
      setProcessing(null);
    }
  };

  /* ───────── reject / delete ───────── */
  const handleReject = async (item: PendingItem) => {
    setProcessing(item.id);
    try {
      const table = item.type === 'review' ? 'reviews' : 'projects';
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      showToast('🗑️ تم الرفض وحذف العنصر نهائياً', 'success');
      setPreviewItem(null);
      loadPending();
    } catch (err) {
      showToast('حدث خطأ أثناء الرفض', 'error');
    } finally {
      setProcessing(null);
    }
  };

  if (!isStaff) return null;

  const reviewCount  = activeTab === 'review'  ? items.length : 0;
  const projectCount = activeTab === 'project' ? items.length : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

        .arq-wrap * { font-family: 'Tajawal', sans-serif; box-sizing: border-box; }

        /* ── Container ── */
        .arq-wrap {
          position: fixed; inset: 0; z-index: 300;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          direction: rtl;
        }
        .arq-backdrop {
          position: absolute; inset: 0;
          background: rgba(2,10,20,0.72);
          backdrop-filter: blur(8px);
        }
        .arq-panel {
          position: relative;
          width: 100%; max-width: 700px;
          max-height: 90vh;
          border-radius: 24px;
          background: #fff;
          box-shadow: 0 32px 80px rgba(0,0,0,0.28);
          display: flex; flex-direction: column;
          overflow: hidden;
          animation: arqIn 0.32s cubic-bezier(.22,.68,0,1.2) both;
        }
        @keyframes arqIn {
          from { opacity:0; transform:scale(0.88) translateY(24px); }
          to   { opacity:1; transform:scale(1)   translateY(0);     }
        }

        /* ── Header ── */
        .arq-header {
          padding: 22px 24px 0;
          background: linear-gradient(135deg,#0c1a2e,#0f2d4a);
          position: relative;
          flex-shrink: 0;
        }
        .arq-header-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 18px;
        }
        .arq-logo {
          display: flex; align-items: center; gap: 10px;
        }
        .arq-logo-icon {
          width: 44px; height: 44px; border-radius: 14px;
          background: linear-gradient(135deg,#0891b2,#06b6d4);
          display: flex; align-items: center; justify-content: center;
          font-size: 20px; color: white;
          box-shadow: 0 4px 16px rgba(8,145,178,0.5);
        }
        .arq-title { font-size: 18px; font-weight: 900; color: white; margin: 0; }
        .arq-subtitle { font-size: 12px; color: #94a3b8; margin: 2px 0 0; }
        .arq-close {
          width: 36px; height: 36px; border-radius: 50%;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          color: #94a3b8; font-size: 14px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .arq-close:hover { background: rgba(239,68,68,0.2); color: #fca5a5; }

        /* ── Tabs ── */
        .arq-tabs {
          display: flex; gap: 4px;
        }
        .arq-tab {
          flex: 1; padding: 11px 16px;
          border: none; cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px; font-weight: 700;
          border-radius: 12px 12px 0 0;
          transition: all 0.22s;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          position: relative;
        }
        .arq-tab.active {
          background: #fff; color: #0891b2;
        }
        .arq-tab:not(.active) {
          background: rgba(255,255,255,0.06);
          color: #94a3b8;
        }
        .arq-tab:not(.active):hover {
          background: rgba(255,255,255,0.12);
          color: #cbd5e1;
        }
        .arq-badge {
          min-width: 20px; height: 20px; border-radius: 10px;
          padding: 0 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 800;
        }
        .arq-tab.active .arq-badge   { background: #fee2e2; color: #dc2626; }
        .arq-tab:not(.active) .arq-badge { background: rgba(255,255,255,0.12); color: #94a3b8; }

        /* ── Body ── */
        .arq-body {
          flex: 1; overflow-y: auto; padding: 20px;
          background: #f8fafc;
        }
        .arq-body::-webkit-scrollbar { width: 4px; }
        .arq-body::-webkit-scrollbar-track { background: transparent; }
        .arq-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

        /* ── Empty ── */
        .arq-empty {
          text-align: center; padding: 60px 20px;
          color: #94a3b8;
        }
        .arq-empty-icon {
          font-size: 48px; margin-bottom: 12px;
          animation: arqBounce 2s ease-in-out infinite;
        }
        @keyframes arqBounce {
          0%,100% { transform: translateY(0) }
          50%      { transform: translateY(-8px) }
        }
        .arq-empty p { font-size: 15px; font-weight: 700; margin: 0 0 4px; color: #64748b; }
        .arq-empty span { font-size: 13px; color: #94a3b8; }

        /* ── Cards ── */
        .arq-card {
          background: #fff;
          border-radius: 16px;
          border: 1.5px solid #e2e8f0;
          padding: 18px;
          margin-bottom: 14px;
          animation: arqCardIn 0.3s ease both;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .arq-card:hover {
          border-color: #bae6fd;
          box-shadow: 0 4px 20px rgba(8,145,178,0.08);
        }
        @keyframes arqCardIn {
          from { opacity:0; transform:translateY(10px) }
          to   { opacity:1; transform:translateY(0)     }
        }

        .arq-card-top {
          display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px;
        }
        .arq-avatar {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          background: linear-gradient(135deg,#e0f2fe,#bae6fd);
          display: flex; align-items: center; justify-content: center;
          color: #0891b2; font-size: 17px;
        }
        .arq-card-meta { flex: 1; min-width: 0; }
        .arq-card-name { font-size: 14px; font-weight: 800; color: #0f172a; margin: 0 0 3px; }
        .arq-card-date { font-size: 11px; color: #94a3b8; margin: 0; }
        .arq-type-tag {
          font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
          background: #e0f2fe; color: #0891b2; white-space: nowrap; flex-shrink: 0;
        }

        /* stars */
        .arq-stars { display: flex; gap: 2px; margin-bottom: 10px; }
        .arq-star { font-size: 16px; }

        /* text */
        .arq-text {
          font-size: 13px; color: #334155; line-height: 1.65;
          background: #f8fafc; border-radius: 10px; padding: 10px 14px;
          margin-bottom: 12px; border-right: 3px solid #bae6fd;
        }

        /* media thumb */
        .arq-media-thumb {
          width: 100%; max-height: 200px; object-fit: cover;
          border-radius: 10px; cursor: pointer;
          transition: opacity 0.2s;
        }
        .arq-media-thumb:hover { opacity: 0.88; }

        /* file link */
        .arq-file-link {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 10px;
          background: #f0fdf4; color: #15803d; font-size: 12px; font-weight: 700;
          text-decoration: none; border: 1px solid #bbf7d0;
          transition: all 0.2s; cursor: pointer;
        }
        .arq-file-link:hover { background: #dcfce7; }

        /* actions row */
        .arq-actions {
          display: flex; gap: 8px; margin-top: 14px;
          padding-top: 14px; border-top: 1px solid #f1f5f9;
        }
        .arq-btn {
          flex: 1; padding: 11px 16px; border-radius: 12px; border: none;
          font-family: 'Tajawal', sans-serif; font-size: 14px; font-weight: 800;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
          transition: all 0.2s;
        }
        .arq-btn-approve {
          background: linear-gradient(135deg,#0891b2,#06b6d4);
          color: white;
          box-shadow: 0 4px 14px rgba(8,145,178,0.35);
        }
        .arq-btn-approve:hover:not(:disabled) {
          box-shadow: 0 6px 20px rgba(8,145,178,0.5); transform: translateY(-1px);
        }
        .arq-btn-reject {
          background: #fef2f2; color: #dc2626;
          border: 1.5px solid #fecaca;
        }
        .arq-btn-reject:hover:not(:disabled) {
          background: #fee2e2;
        }
        .arq-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none !important; }

        /* preview overlay */
        .arq-preview-overlay {
          position: absolute; inset: 0; z-index: 10;
          background: rgba(2,10,20,0.82);
          display: flex; align-items: center; justify-content: center;
          padding: 16px; animation: arqIn 0.2s ease both;
        }
        .arq-preview-img {
          max-width: 100%; max-height: 80vh; border-radius: 12px;
          cursor: pointer;
        }

        /* spinner */
        .arq-spin {
          width: 16px; height: 16px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          animation: arqSpinAnim 0.6s linear infinite; display: inline-block;
        }
        @keyframes arqSpinAnim { to { transform: rotate(360deg) } }

        /* shimmer loader */
        .arq-shimmer {
          border-radius: 14px; height: 120px; margin-bottom: 12px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: arqShimmer 1.2s infinite;
        }
        @keyframes arqShimmer {
          from { background-position: 200% 0 }
          to   { background-position: -200% 0 }
        }

        /* ── counter banner ── */
        .arq-counter {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 14px; border-radius: 10px; margin-bottom: 16px;
          background: linear-gradient(135deg,rgba(8,145,178,0.08),rgba(6,182,212,0.05));
          border: 1px solid rgba(8,145,178,0.15);
          font-size: 13px; font-weight: 700; color: #0891b2;
        }
      `}</style>

      <div className="arq-wrap">
        {/* Backdrop */}
        <div className="arq-backdrop" onClick={onClose} />

        {/* Panel */}
        <div className="arq-panel">

          {/* Header */}
          <div className="arq-header">
            <div className="arq-header-row">
              <div className="arq-logo">
                <div className="arq-logo-icon">
                  🛡️
                </div>
                <div>
                  <p className="arq-title">طابور مراجعة المحتوى</p>
                  <p className="arq-subtitle">الأدمن فقط — اعتمد أو ارفض قبل النشر</p>
                </div>
              </div>
              {onClose && (
                <button className="arq-close" onClick={onClose}>
                  ✕
                </button>
              )}
            </div>

            {/* Tabs */}
            {mode === 'all' && (
              <div className="arq-tabs">
                <button
                  className={`arq-tab ${activeTab === 'review' ? 'active' : ''}`}
                  onClick={() => setActiveTab('review')}
                >
                  ⭐
                  الآراء والتقييمات
                  <span className="arq-badge">{reviewCount}</span>
                </button>
                <button
                  className={`arq-tab ${activeTab === 'project' ? 'active' : ''}`}
                  onClick={() => setActiveTab('project')}
                >
                  📁
                  المشاريع
                  <span className="arq-badge">{projectCount}</span>
                </button>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="arq-body">
            {loading ? (
              <>
                <div className="arq-shimmer" />
                <div className="arq-shimmer" style={{ opacity: 0.6 }} />
                <div className="arq-shimmer" style={{ opacity: 0.35 }} />
              </>
            ) : items.length === 0 ? (
              <div className="arq-empty">
                <div className="arq-empty-icon">✅</div>
                <p>لا يوجد محتوى معلق</p>
                <span>
                  {activeTab === 'review'
                    ? 'كل الآراء والتقييمات مراجعة'
                    : 'كل المشاريع مراجعة'}
                </span>
              </div>
            ) : (
              <>
                <div className="arq-counter">
                  🕐
                  {items.length} عنصر بانتظار المراجعة
                </div>
                {items.map((item, idx) => (
                  <PendingCard
                    key={item.id}
                    item={item}
                    processing={processing}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    animDelay={idx * 0.05}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   Pending Card — sub-component
══════════════════════════════════════════ */
function PendingCard({
  item,
  processing,
  onApprove,
  onReject,
  animDelay,
}: {
  item: PendingItem;
  processing: string | null;
  onApprove: (item: PendingItem) => void;
  onReject: (item: PendingItem) => void;
  animDelay: number;
}) {
  const busy = processing === item.id;

  return (
    <div className="arq-card" style={{ animationDelay: `${animDelay}s`, position: 'relative' }}>

      {/* Top row */}
      <div className="arq-card-top">
        <div className="arq-avatar">
          {item.type === 'review' ? '👤' : '📁'}
        </div>
        <div className="arq-card-meta">
          <p className="arq-card-name">
            {item.user?.association_name || 'مستخدم'}
          </p>
          <p className="arq-card-date">
            {new Date(item.created_at).toLocaleDateString('ar-SA', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit',
            })}
          </p>
        </div>
        <span className="arq-type-tag">
          {item.type === 'review' ? '⭐ تقييم' : '📁 مشروع'}
        </span>
      </div>

      {/* Project name */}
      {item.title && (
        <div className="arq-text" style={{ fontWeight: 800, fontSize: 14 }}>
          {item.title}
          {item.project_type && (
            <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.7, marginRight: 8 }}>
              — {PROJECT_TYPE_LABELS[item.project_type] || item.project_type}
            </span>
          )}
        </div>
      )}

      {/* Stars */}
      {item.rating !== undefined && (
        <div className="arq-stars">
          {[1, 2, 3, 4, 5].map(s => (
            <span key={s} className="arq-star" style={{ color: s <= (item.rating || 0) ? '#fbbf24' : '#e2e8f0' }}>★</span>
          ))}
          <span style={{ fontSize: 12, color: '#94a3b8', marginRight: 6, marginTop: 2 }}>
            {['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'][item.rating || 0]}
          </span>
        </div>
      )}

      {/* Review text */}
      {item.review_text && (
        <div className="arq-text">"{item.review_text}"</div>
      )}

      {/* Project file */}
      {item.project_file_url && (
        <div style={{ marginBottom: 12 }}>
          <a
            href={item.project_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="arq-file-link"
          >
            📥
            {item.file_name || 'عرض ملف المشروع'}
          </a>
        </div>
      )}

      {/* Action buttons */}
      <div className="arq-actions">
        <button
          className="arq-btn arq-btn-reject"
          disabled={!!processing}
          onClick={() => onReject(item)}
        >
          {busy ? <span className="arq-spin" style={{ borderTopColor: '#dc2626' }} /> : '✕'}
          رفض وحذف
        </button>
        <button
          className="arq-btn arq-btn-approve"
          disabled={!!processing}
          onClick={() => onApprove(item)}
        >
          {busy ? <span className="arq-spin" /> : '✓'}
          موافق — نشر الآن
        </button>
      </div>
    </div>
  );
}

export default AdminReviewQueue;