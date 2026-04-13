// pages/ReviewsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  supabase, 
  fetchReviews, 
  createReview, 
  deleteReview, 
  updateReviewStatus,
  checkUserBlocked,
  toggleUserBlockStatus 
} from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { BackgroundAnimation } from '../components/BackgroundAnimation';
import { AdminReviewQueue } from '../components/AdminReviewQueue';
import { Header } from '../components/Header';

interface Review {
  id: string;
  user_id: string;
  user_name?: string;
  rating: number;
  review_text: string;
  is_active: boolean;
  created_at: string;
  user?: {
    association_name: string;
  };
}

export default function ReviewsPage() {
  const navigate = useNavigate();
  const { user, isAdmin, isEmployee } = useAuth();
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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAdminQueue, setShowAdminQueue] = useState(false);
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');


  const [currentUserAssociation, setCurrentUserAssociation] = useState<string>('');
  const isStaff = isAdmin || isEmployee;
  const dm = isDarkMode;

  // جلب اسم الجمعية للمستخدم الحالي
  useEffect(() => {
    const fetchAssociation = async () => {
      if (!user?.email) return;
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

  useEffect(() => {
    loadReviews();
    if (user && !isStaff) checkIfBlocked();
  }, [user, isStaff]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await fetchReviews();
      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      showToast('حدث خطأ في تحميل الآراء', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkIfBlocked = async () => {
    if (!user) return;
    try {
      const { data, error } = await checkUserBlocked(user.id);
      if (error) throw error;
      setIsBlocked(data?.is_review_blocked || false);
    } catch (err) {
      console.error('Error checking block status:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. التحقق من وجود المستخدم
    if (!user || !user.id) { 
      showToast('يرجى تسجيل الدخول أولاً لإضافة رأيك', 'error'); 
      return; 
    }

    // 2. التحقق من التقييم
    if (rating === 0) { 
      showToast('يرجى تحديد عدد النجوم للتقييم', 'error'); 
      return; 
    }

    // 3. التحقق من الحظر
    if (isBlocked) { 
      showToast('نعتذر، حسابك محظور من إضافة الآراء حالياً', 'error'); 
      return; 
    }

    setIsSubmitting(true);

    try {
      let mediaUrl = null;
      let mediaType = null;

      // 5. إرسال البيانات لقاعدة البيانات
      // تأكدنا هنا من إرسال user_id بشكل صريح
      const reviewData = {
        user_id: user.id,
        user_name: currentUserAssociation || undefined,
        rating: rating,
        review_text: reviewText.trim(),
        media_url: mediaUrl,
        media_type: mediaType,
        is_active: false // نجعلها false للمراجعة كما في الـ Policy
      };

      const { error } = await createReview(reviewData);

      if (error) {
        // إذا كان الخطأ 403 فهذا يعني أن الـ RLS Policy منعت الإدخال
        if (error.code === '42501') {
          throw new Error('ليس لديك صلاحية لإضافة تقييم. تأكد من أنك لست محظوراً.');
        }
        throw error;
      }

      // 6. نجاح العملية
      showToast('تم إرسال رأيك بنجاح وهو قيد المراجعة! 🎉', 'success');
      
      setRating(0);
      setReviewText('');
      setShowForm(false);
      
      // تحديث القائمة
      loadReviews();

    } catch (err: any) {
      console.error("Submission Error:", err);
      showToast(err.message || 'حدث خطأ أثناء إرسال البيانات', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الرأي؟')) return;
    try {
      const { error } = await deleteReview(id);
      if (error) throw error;
      showToast('تم الحذف بنجاح', 'success');
      loadReviews();
    } catch (err) {
      showToast('حدث خطأ في الحذف', 'error');
    }
  };

  const toggleReviewStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await updateReviewStatus(id, !currentStatus);
      if (error) throw error;
      showToast(currentStatus ? 'تم إخفاء الرأي' : 'تم إظهار الرأي', 'success');
      loadReviews();
    } catch (err) {
      showToast('حدث خطأ', 'error');
    }
  };

  const toggleUserBlock = async (userId: string, currentBlock: boolean) => {
    try {
      const { error } = await toggleUserBlockStatus(userId, !currentBlock);
      if (error) throw error;
      showToast(currentBlock ? 'تم إلغاء حظر العميل' : 'تم حظر العميل من إضافة آراء', 'success');
      loadReviews();
    } catch (err) {
      showToast('حدث خطأ', 'error');
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
    : '0';

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');

        /* ===== PAGE ENTRANCE ===== */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.92); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes featherFloat {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50%       { transform: translateY(-10px) rotate(8deg); }
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes starPop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.4); }
          100% { transform: scale(1); }
        }

        /* ===== HERO SECTION ===== */
        .reviews-hero {
          padding: 100px 24px 48px;
          text-align: center;
          position: relative;
          z-index: 10;
          animation: fadeUp 0.7s ease both;
        }

        .hero-feather-wrap {
          position: relative;
          display: inline-block;
          margin-bottom: 24px;
        }

        .hero-feather-icon {
          width: 80px; height: 80px;
          border-radius: 24px;
          background: ${dm ? 'linear-gradient(135deg,#1e3a5f,#0891b2)' : 'linear-gradient(135deg,#e0f2fe,#bae6fd)'};
          display: flex; align-items: center; justify-content: center;
          font-size: 36px;
          box-shadow: ${dm ? '0 8px 32px rgba(8,145,178,0.4)' : '0 8px 32px rgba(8,145,178,0.2)'};
          position: relative;
          animation: featherFloat 4s ease-in-out infinite;
        }

        .hero-feather-ring {
          position: absolute;
          inset: -8px;
          border-radius: 32px;
          border: 2px solid rgba(8,145,178,0.3);
          animation: pulse-ring 2s ease-out infinite;
        }

        .hero-title {
          font-size: clamp(28px, 5vw, 42px);
          font-weight: 900;
          margin: 0 0 12px;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          line-height: 1.2;
        }

        .hero-subtitle {
          font-size: 16px;
          color: ${dm ? '#94a3b8' : '#64748b'};
          margin: 0 0 32px;
        }

        /* ===== STATS ROW ===== */
        .stats-row {
          display: flex;
          gap: 12px;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 0;
        }

        .stat-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 50px;
          font-size: 14px;
          font-weight: 700;
          backdrop-filter: blur(12px);
          border: 1px solid ${dm ? 'rgba(8,145,178,0.3)' : 'rgba(8,145,178,0.2)'};
          background: ${dm ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.8)'};
          color: ${dm ? '#67e8f9' : '#0c4a6e'};
          animation: scaleIn 0.5s ease both;
        }

        .stat-pill .stat-num {
          font-size: 18px;
          font-weight: 900;
          color: #0891b2;
        }

        /* ===== FORM MODAL ===== */
        .form-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .form-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(8px);
        }

        .form-modal {
          position: relative;
          width: 100%;
          max-width: 540px;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 24px;
          padding: 28px;
          background: ${dm ? 'rgba(15,23,42,0.98)' : 'rgba(255,255,255,0.98)'};
          border: 1px solid ${dm ? 'rgba(8,145,178,0.3)' : 'rgba(8,145,178,0.2)'};
          box-shadow: 0 24px 80px rgba(0,0,0,0.3);
          animation: scaleIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 900;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding-bottom: 16px;
          border-bottom: 1.5px solid ${dm ? 'rgba(51,65,85,0.6)' : '#f1f5f9'};
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 13px;
          color: ${dm ? '#94a3b8' : '#374151'};
        }

        .form-textarea {
          width: 100%;
          padding: 13px 16px;
          border-radius: 14px;
          border: 1.5px solid ${dm ? '#334155' : '#e2e8f0'};
          background: ${dm ? 'rgba(51,65,85,0.4)' : '#f8fafc'};
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          resize: none;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .form-textarea:focus {
          border-color: #0891b2;
          background: ${dm ? 'rgba(8,145,178,0.08)' : '#fff'};
          box-shadow: 0 0 0 3px rgba(8,145,178,0.12);
        }

        /* ===== STAR RATING INTERACTIVE ===== */
        .star-rating-wrap { display: flex; gap: 6px; direction: ltr; }

        .star-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 32px;
          line-height: 1;
          transition: all 0.15s ease;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .star-btn:hover { transform: scale(1.3) rotate(10deg); }
        .star-btn.selected { animation: starPop 0.3s ease; }

        /* ===== SUBMIT BTN ===== */
        .form-submit {
          width: 100%;
          padding: 15px;
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
        }
        .form-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(8,145,178,0.45); }
        .form-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        /* ===== REVIEWS GRID ===== */
        .reviews-grid {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px 80px;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .review-card {
          border-radius: 22px;
          padding: 22px;
          border: 1px solid ${dm ? 'rgba(51,65,85,0.7)' : '#e2e8f0'};
          background: ${dm ? 'rgba(30,41,59,0.85)' : 'rgba(255,255,255,0.9)'};
          backdrop-filter: blur(12px);
          transition: all 0.3s ease;
          animation: cardIn 0.5s ease both;
          position: relative;
          overflow: hidden;
        }

        .review-card::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 60px; height: 60px;
          background: radial-gradient(circle, rgba(8,145,178,0.08) 0%, transparent 70%);
          border-radius: 0 22px 0 100%;
        }

        .review-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.12);
          border-color: rgba(8,145,178,0.35);
        }

        .card-user-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }

        .card-avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: ${dm ? 'rgba(8,145,178,0.15)' : 'rgba(8,145,178,0.1)'};
          display: flex; align-items: center; justify-content: center;
          color: #0891b2;
          font-size: 18px;
          flex-shrink: 0;
          border: 2px solid ${dm ? 'rgba(8,145,178,0.3)' : 'rgba(8,145,178,0.2)'};
        }

        .card-name {
          font-weight: 800;
          font-size: 15px;
          color: ${dm ? '#f1f5f9' : '#0f172a'};
          margin: 0 0 2px;
        }

        .card-date {
          font-size: 12px;
          color: ${dm ? '#64748b' : '#94a3b8'};
        }

        .card-stars {
          display: flex;
          gap: 2px;
          direction: ltr;
          margin-bottom: 12px;
        }

        .card-star {
          font-size: 17px;
          transition: transform 0.1s;
        }

        .card-text {
          font-size: 14px;
          line-height: 1.7;
          color: ${dm ? '#cbd5e1' : '#374151'};
          margin-bottom: 14px;
          font-style: italic;
        }

        .card-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 20px;
        }

        .card-actions {
          display: flex;
          gap: 6px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid ${dm ? 'rgba(51,65,85,0.5)' : '#f1f5f9'};
          flex-wrap: wrap;
        }

        .card-action-btn {
          flex: 1;
          min-width: 80px;
          padding: 8px 6px;
          border-radius: 10px;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .card-action-btn:hover { transform: scale(1.04); filter: brightness(0.95); }

        /* ===== BLOCKED NOTICE ===== */
        .blocked-notice {
          max-width: 600px;
          margin: 0 auto 24px;
          padding: 14px 20px;
          border-radius: 14px;
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.3);
          text-align: center;
          color: #dc2626;
          font-weight: 700;
          font-size: 14px;
          animation: fadeUp 0.4s ease;
        }

        /* ===== EMPTY STATE ===== */
        .empty-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 64px 24px;
          color: ${dm ? '#475569' : '#94a3b8'};
        }

        .empty-feather {
          font-size: 64px;
          display: block;
          margin-bottom: 16px;
          animation: featherFloat 3s ease-in-out infinite;
          opacity: 0.6;
        }

        /* ===== LOADING SKELETON ===== */
        .skel {
          background: linear-gradient(90deg, ${dm ? '#1e293b' : '#f1f5f9'} 25%, ${dm ? '#334155' : '#e2e8f0'} 50%, ${dm ? '#1e293b' : '#f1f5f9'} 75%);
          background-size: 200% 100%;
          border-radius: 8px;
          animation: shimmer 1.5s infinite;
        }

        /* ===== FAB (Floating Action Button) ===== */
        .fab {
          position: fixed;
          bottom: 32px;
          left: 32px;
          z-index: 50;
          width: 60px; height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: white;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          box-shadow: 0 6px 24px rgba(124,58,237,0.5);
          transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }

        .fab:hover {
          transform: scale(1.15) rotate(15deg);
          box-shadow: 0 10px 32px rgba(124,58,237,0.6);
        }

        .fab-tooltip {
          position: absolute;
          right: 72px;
          bottom: 50%;
          transform: translateY(50%);
          background: ${dm ? '#1e293b' : '#0f172a'};
          color: white;
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
        }
        .fab:hover .fab-tooltip { opacity: 1; }

        /* ===== SPINNER ===== */
        .btn-spinner {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.4);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }

        /* ===== LOGIN PROMPT ===== */
        .login-prompt {
          max-width: 400px;
          margin: 0 auto 32px;
          padding: 20px 24px;
          border-radius: 18px;
          text-align: center;
          background: ${dm ? 'rgba(30,41,59,0.8)' : 'rgba(255,255,255,0.8)'};
          border: 1px solid ${dm ? 'rgba(51,65,85,0.6)' : '#e2e8f0'};
          backdrop-filter: blur(12px);
          animation: fadeUp 0.4s ease;
        }

        .section-wrapper {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }

        /* ===== RESPONSIVE ===== */
        @media (max-width: 600px) {
          .reviews-grid { grid-template-columns: 1fr; }
          .stats-row { gap: 8px; }
          .fab { bottom: 20px; left: 20px; }
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
      <div className="reviews-hero">
        <div className="hero-feather-wrap">
          <div className="hero-feather-icon">
            <i className="fas fa-feather" style={{ color: '#0891b2' }} />
          </div>
          <div className="hero-feather-ring" />
        </div>

        <h1 className="hero-title">آراء عملائنا</h1>
        <p className="hero-subtitle">شاهد ما يقوله عملاؤنا عن خدماتنا</p>

        <div className="stats-row">
          <div className="stat-pill" style={{ animationDelay: '0.1s' }}>
            <i className="fas fa-feather" style={{ color: '#0891b2' }} />
            <span>إجمالي الآراء</span>
            <span className="stat-num">{reviews.length}</span>
          </div>
          <div className="stat-pill" style={{ animationDelay: '0.2s' }}>
            <span style={{ color: '#fbbf24' }}>★</span>
            <span>متوسط التقييم</span>
            <span className="stat-num">{avgRating}</span>
          </div>
        </div>
      </div>

      {/* Blocked / Login */}
      <div className="section-wrapper">
        {isBlocked && (
          <div className="blocked-notice">
            <i className="fas fa-ban" style={{ marginLeft: 8 }} />
            تم منعك من إضافة آراء جديدة
          </div>
        )}

        {!user && (
          <div className="login-prompt">
            <i className="fas fa-feather" style={{ fontSize: 28, color: '#0891b2', display: 'block', marginBottom: 12 }} />
            <p style={{ margin: '0 0 12px', fontWeight: 700, color: dm ? '#cbd5e1' : '#374151' }}>
              شارك تجربتك مع خدماتنا
            </p>
            <p style={{ margin: 0, fontSize: 14, color: dm ? '#64748b' : '#94a3b8' }}>
              يرجى{' '}
              <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#0891b2', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, padding: 0 }}>
                تسجيل الدخول
              </button>
              {' '}لإضافة رأيك
            </p>
          </div>
        )}
      </div>

      {/* Reviews Grid */}
      <div className="reviews-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 22, padding: 22, background: dm ? 'rgba(30,41,59,0.7)' : 'rgba(255,255,255,0.7)', animationDelay: `${i * 0.08}s` }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                <div className="skel" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                <div style={{ flex: 1 }}>
                  <div className="skel" style={{ height: 14, width: '55%', marginBottom: 8 }} />
                  <div className="skel" style={{ height: 12, width: '35%' }} />
                </div>
              </div>
              <div className="skel" style={{ height: 14, width: '45%', marginBottom: 12 }} />
              <div className="skel" style={{ height: 60 }} />
            </div>
          ))
        ) : reviews.length === 0 ? (
          <div className="empty-state">
            <span className="empty-feather"><i className="fas fa-feather" /></span>
            <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 8px' }}>لا توجد آراء بعد</p>
            <p style={{ fontSize: 14, margin: 0 }}>كن أول من يشارك تجربته</p>
          </div>
        ) : (
          reviews.map((review, index) => (
            <div
              key={review.id}
              className="review-card"
              style={{ animationDelay: `${index * 0.06}s` }}
            >
              {/* User Row */}
              <div className="card-user-row">
                <div className="card-avatar">
                  <i className="fas fa-user" />
                </div>
                <div>
                  <p className="card-name">
                    {review.user?.association_name || review.user_name ||
                      (user?.id === review.user_id && currentUserAssociation
                        ? currentUserAssociation
                        : 'عميل كريم')}
                  </p>
                  <p className="card-date">{new Date(review.created_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>

                <span className="card-status" style={{
                  marginRight: 'auto',
                  background: review.is_active ? '#dcfce7' : '#fef9c3',
                  color: review.is_active ? '#15803d' : '#a16207',
                }}>
                  <i className={`fas ${review.is_active ? 'fa-check' : 'fa-clock'}`} />
                  {review.is_active ? 'منشور' : 'قيد المراجعة'}
                </span>
              </div>

              {/* Stars */}
              <div className="card-stars">
                {[1, 2, 3, 4, 5].map(s => (
                  <span key={s} className="card-star" style={{ color: s <= review.rating ? '#fbbf24' : (dm ? '#374151' : '#d1d5db') }}>★</span>
                ))}
              </div>

              {/* Text */}
              {review.review_text && (
                <p className="card-text">"{review.review_text}"</p>
              )}

              {/* Admin Actions */}
              {isStaff && (
                <div className="card-actions">
                  <button
                    className="card-action-btn"
                    onClick={() => toggleReviewStatus(review.id, review.is_active)}
                    style={{ background: review.is_active ? 'rgba(234,179,8,0.12)' : 'rgba(34,197,94,0.12)', color: review.is_active ? '#a16207' : '#15803d' }}
                  >
                    <i className={`fas ${review.is_active ? 'fa-eye-slash' : 'fa-eye'}`} />
                    {review.is_active ? 'إخفاء' : 'إظهار'}
                  </button>
                  <button
                    className="card-action-btn"
                    onClick={() => handleDelete(review.id)}
                    style={{ background: 'rgba(220,38,38,0.1)', color: '#dc2626' }}
                  >
                    <i className="fas fa-trash" />
                    حذف
                  </button>
                  <button
                    className="card-action-btn"
                    onClick={() => toggleUserBlock(review.user_id, false)}
                    style={{ background: 'rgba(234,88,12,0.1)', color: '#c2410c' }}
                  >
                    <i className="fas fa-ban" />
                    حظر
                  </button>
                </div>
              )}

              {/* User own actions — العميل لا يملك صلاحية الحذف */}
            </div>
          ))
        )}
      </div>

      {/* Admin Queue Button */}
      {isStaff && (
        <button
          onClick={() => setShowAdminQueue(true)}
          style={{
            position: 'fixed', bottom: 32, left: 32, zIndex: 50,
            width: 60, height: 60, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'linear-gradient(135deg,#7c3aed,#a855f7)',
            color: 'white', border: 'none', cursor: 'pointer',
            fontSize: 22,
            boxShadow: '0 6px 24px rgba(124,58,237,0.45)',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <i className="fas fa-shield-alt" />
        </button>
      )}

      {/* Admin Queue Modal */}
      {showAdminQueue && (
        <AdminReviewQueue mode="review" onClose={() => setShowAdminQueue(false)} />
      )}

      {/* FAB - Add Review */}
      {user && !isStaff && !isBlocked && (
        <button className="fab" onClick={() => setShowForm(true)}>
          <i className="fas fa-feather" />
          <span className="fab-tooltip">أضف رأيك</span>
        </button>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="form-overlay">
          <div className="form-backdrop" onClick={() => setShowForm(false)} />
          <div className="form-modal">
            <button
              onClick={() => setShowForm(false)}
              style={{
                position: 'absolute', top: 16, left: 16,
                width: 32, height: 32, borderRadius: '50%',
                background: dm ? '#334155' : '#f1f5f9',
                border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: dm ? '#94a3b8' : '#64748b',
                fontSize: 14, transition: 'all 0.2s',
              }}
            >
              <i className="fas fa-times" />
            </button>

            <h2 className="modal-title">
              <span style={{ fontSize: 22 }}><i className="fas fa-feather" style={{ color: '#0891b2' }} /></span>
              أضف رأيك
            </h2>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label className="form-label">التقييم *</label>
                <div className="star-rating-wrap">
                  {[1, 2, 3, 4, 5].map(s => (
                    <button
                      key={s}
                      type="button"
                      className={`star-btn ${s <= rating ? 'selected' : ''}`}
                      onClick={() => setRating(s)}
                      onMouseEnter={() => setHoverRating(s)}
                      onMouseLeave={() => setHoverRating(0)}
                    >
                      <span style={{ color: s <= (hoverRating || rating) ? '#fbbf24' : (dm ? '#374151' : '#d1d5db'), filter: s <= (hoverRating || rating) ? 'drop-shadow(0 0 4px rgba(251,191,36,0.6))' : 'none' }}>
                        ★
                      </span>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p style={{ marginTop: 6, fontSize: 12, color: '#0891b2', fontWeight: 700 }}>
                    {['', 'سيء', 'مقبول', 'جيد', 'جيد جداً', 'ممتاز'][rating]}
                  </p>
                )}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label className="form-label">رأيك (اختياري)</label>
                <textarea
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  rows={4}
                  className="form-textarea"
                  placeholder="شارك تجربتك معنا..."
                />
              </div>

              <button type="submit" disabled={isSubmitting || rating === 0} className="form-submit">
                {isSubmitting ? (
                  <><span className="btn-spinner" /> جاري الإرسال...</>
                ) : (
                  <><i className="fas fa-feather" /> إرسال الرأي</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}