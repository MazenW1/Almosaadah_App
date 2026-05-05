// App.tsx
// ─────────────────────────────────────────────────────────────────────────────
// المكوّن الجذر للتطبيق — يحتوي على الـ Routes والـ Modals والمنطق العام
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AOS from 'aos';
import 'aos/dist/aos.css';

import { useAuth }                        from './hooks/useAuth';
import { useToast, ToastContainer }       from './hooks/useToast';
import { useNews }                        from './hooks/useNews';
import { useDarkMode }                    from './hooks/useDarkMode';
import { supabase }                       from './lib/supabase';
import { notifyAdminNewServiceRequest }   from './lib/notificationHelpers';

import { BackgroundAnimation }  from './components/BackgroundAnimation';
import { Header }               from './components/Header';
import { Hero }                 from './components/Hero';
import { VideoSection }         from './components/VideoSection';
import { Services }             from './components/Services';
import { Products }             from './components/Products';
import { Partners }             from './components/Partners';
import { NewsSection }          from './components/NewsSection';
import { Stats }                from './components/Stats';
import { Footer }               from './components/Footer';
import { LoginModal }           from './components/LoginModal';
import { RegisterModal }        from './components/RegisterModal';
import { ServiceRequestModal }  from './components/ServiceRequestModal';
import { ForgotPasswordModal }  from './components/ForgotPasswordModal';

import Profile           from './pages/Profile';
import Dashboard         from './pages/Dashboard';
import EmailVerification from './pages/EmailVerification';
import ReviewsPage       from './pages/ReviewsPage';
import ProjectsPage      from './pages/ProjectsPage';
import EventsPage        from './pages/EventsPage';
import JobsPage          from './pages/JobsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import Contracts from './pages/Contracts';

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ ProtectedRoute ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, hasSession } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-tajawal text-cyan-600 gap-3">
        <i className="fas fa-spinner fa-spin text-2xl" />
        <span>جاري التحقق...</span>
      </div>
    );
  }

  if (!user || !hasSession) return <Navigate to="/" replace />;

  return <>{children}</>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Error Boundary ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center font-tajawal text-center p-4">
          <i className="fas fa-exclamation-triangle text-6xl text-red-400 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">عذراً، حدث خطأ ما</h1>
          <p className="text-slate-500 mb-4">يرجى تحديث الصفحة أو المحاولة لاحقاً</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-cyan-500 text-white rounded-xl font-bold hover:bg-cyan-600 transition-colors"
          >
            <i className="fas fa-sync-alt mr-2" /> تحديث الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Error Translator ════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const AUTH_ERROR_MAP: Record<string, string> = {
  'User already registered':                              'هذا البريد الإلكتروني مسجل مسبقاً',
  'Invalid login credentials':                            'البريد الإلكتروني أو كلمة المرور غير صحيحة',
  'Email not confirmed':                                  'يرجى تأكيد بريدك الإلكتروني أولاً',
  'Password should be at least 6 characters':             'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
  'Unable to validate email address: invalid format':     'صيغة البريد الإلكتروني غير صحيحة',
  'signup is disabled':                                   'التسجيل معطّل حالياً، تواصل مع الإدارة',
  'Email rate limit exceeded':                            'تم تجاوز الحد المسموح به، حاول لاحقاً',
  'over_email_send_rate_limit':                           'تم إرسال رسائل كثيرة، حاول بعد قليل',
  'Failed to fetch':                                      'تعذّر الاتصال بالخادم، تحقق من الإنترنت',
  'NetworkError':                                         'خطأ في الشبكة، تحقق من الاتصال',
};

function translateAuthError(message: string): string {
  for (const [key, value] of Object.entries(AUTH_ERROR_MAP)) {
    if (message.includes(key)) return value;
  }
  return message;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ AppInner ════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

function AppInner() {
  const navigate = useNavigate();

  const {
    user,
    userProfile,
    isAdmin,
    isEmployee,
    signIn,
    signOut,
    loading: authLoading,
    profileLoading,
  } = useAuth();

  const { toasts, showToast, removeToast } = useToast();

  const {
    news, loading: newsLoading,
    hasMore, loadMore,
    deleteNews, createNews, updateNews,
  } = useNews(user?.id, isAdmin || isEmployee);

  // ── Modal states ──
  const [isLoginModalOpen,    setIsLoginModalOpen]    = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isServiceModalOpen,  setIsServiceModalOpen]  = useState(false);
  const [isForgotPasswordOpen,setIsForgotPasswordOpen]= useState(false);

  // ── Service/Product selection ──
  const [selectedService,     setSelectedService]     = useState('');
  const [selectedProductType, setSelectedProductType] = useState<string | undefined>();
  const [isProduct,           setIsProduct]           = useState(false);

  // ── Dark mode ──
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const isAnyModalOpen = isLoginModalOpen || isRegisterModalOpen || isServiceModalOpen || isForgotPasswordOpen;

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    AOS.init({
      duration: prefersReducedMotion ? 0 : 800,
      once:     true,
      offset:   100,
      disable:  prefersReducedMotion,
    });
  }, []);

  // ─── Handle Login ─────────────────────────────────────────────────────────────
  const handleLogin = async (email: string, password: string) => {
    try {
      const { error } = await signIn(email, password);
      if (error) {
        showToast(translateAuthError(error.message), 'error');
        return { error };
      }
      showToast('تم تسجيل الدخول بنجاح! 🎉', 'success');
      setIsLoginModalOpen(false);
      return { error: null };
    } catch (err: any) {
      const msg = translateAuthError(err.message || 'خطأ في تسجيل الدخول');
      showToast(msg, 'error');
      return { error: err };
    }
  };

  // ─── Handle Sign Out ──────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      console.error('SignOut error (ignored):', err);
    } finally {
      navigate('/', { replace: true });
    }
  };

  // ─── Handle Register ──────────────────────────────────────────────────────────
  const handleSubmitRegister = async (data: any) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    data.email,
        password: data.password,
        options: {
          data: {
            association_name: data.associationName,
            entity_type:      data.entityType,
          },
        },
      });

      if (authError) throw new Error(translateAuthError(authError.message));
      if (!authData.user) throw new Error('فشل إنشاء الحساب، حاول مرة أخرى');

      // حفظ بيانات التسجيل مؤقتاً لإدراجها في جدول user بعد التحقق
      sessionStorage.setItem('pending_registration', JSON.stringify({
        user_id:          authData.user.id,
        association_name: data.associationName,
        user_phone:       data.phone,
        user_email:       data.email,
        license_number:   data.license,
        entity_type:      data.entityType,
      }));

    } catch (err: any) {
      const msg = translateAuthError(err.message || 'فشل إنشاء الحساب');
      showToast(msg, 'error');
      throw new Error(msg);
    }
  };

  // ─── Handle Service / Product Selection ───────────────────────────────────────
  const handleServiceSelect = (serviceName: string, type?: string) => {
    if (!user) {
      showToast('يرجى تسجيل الدخول أولاً لطلب الخدمة', 'error');
      setIsLoginModalOpen(true);
      return;
    }
    setSelectedService(serviceName);
    // type يأتي الآن كاسم المنتج مباشرة من service_name
    const isAwnType = type === 'عون' || (typeof type === 'string' && type.includes('عون'));
    const isProductType = type === 'منتج' || type === 'product' || isAwnType;
    setSelectedProductType(isAwnType ? 'عون' : undefined);
    setIsProduct(isProductType);
    setIsServiceModalOpen(true);
  };

  // ─── Handle Service Submit ────────────────────────────────────────────────────
  const handleServiceSubmit = async (data: any) => {
    if (!user) { showToast('يرجى تسجيل الدخول أولاً', 'error'); return; }

    try {
      // جلب service_id من اسم الخدمة
      let serviceId: string | null = null;
      if (data.serviceName) {
        const { data: svc } = await supabase
          .from('services')
          .select('service_id')
          .eq('service_name', data.serviceName)
          .maybeSingle();
        serviceId = svc?.service_id ?? null;
      }

      // إدراج الطلب وإرجاع الـ ID الجديد
      const { data: inserted, error } = await supabase
        .from('service_requests')
        .insert([{
          user_id:        user.id,
          service_id:     serviceId,
          request_notes:  data.notes       || null,
          request_status: 'pending_review',
          package_type:   data.packageType || null,
        }])
        .select('request_id')
        .single();

      if (error) throw error;

      // ✅ إشعار الأدمن فور إرسال الطلب
      const clientName =
        userProfile?.association_name ||
        user.email?.split('@')[0]     ||
        'عميل';

      await notifyAdminNewServiceRequest({
        clientName,
        serviceName: data.serviceName || 'خدمة',
        requestId:   inserted.request_id,
      });

    } catch (err: any) {
      showToast(err.message || 'حدث خطأ غير متوقع', 'error');
      throw err;
    }
  };

  // ─── Handle News Delete ───────────────────────────────────────────────────────
  const handleDeleteNews = async (id: string) => {
    if (!isAdmin) { showToast('غير مصرح لك بالحذف!', 'error'); return; }
    if (!confirm('هل أنت متأكد من حذف هذا الخبر نهائياً؟')) return;
    try {
      await deleteNews(id);
      showToast('تم الحذف بنجاح ✓', 'success');
    } catch {
      showToast('حدث خطأ أثناء الحذف', 'error');
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <div className="min-h-screen font-tajawal app-root">

        <BackgroundAnimation isDarkMode={isDarkMode} isPaused={isAnyModalOpen} />
        <ToastContainer toasts={toasts} onRemove={removeToast} />

        <Header
          onLoginClick={    () => setIsLoginModalOpen(true)}
          onRegisterClick={ () => setIsRegisterModalOpen(true)}
          onSignOut={handleSignOut}
          isAdmin={isAdmin}
          isEmployee={isEmployee}
          user={user}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />

        <Routes>
          <Route
            path="/"
            element={
              <main>
                <Hero />
                <VideoSection />
                <Services onServiceSelect={handleServiceSelect} />
                <Products onProductSelect={handleServiceSelect} />
                <Partners />
                <NewsSection
                  news={news}
                  loading={newsLoading}
                  hasMore={hasMore}
                  onLoadMore={loadMore}
                  onDeleteNews={handleDeleteNews}
                  isAdmin={isAdmin}
                />
                <Stats />
                <Footer />
              </main>
            }
          />
          <Route path="/events"   element={<EventsPage />} />
          <Route path="/jobs"     element={<JobsPage />} />
          <Route path="/reviews"  element={<ReviewsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/verify-email" element={<EmailVerification />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/profile"   element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>

        {/* ── Modals ── */}
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLogin={handleLogin}
          onSwitchToRegister={() => { setIsLoginModalOpen(false); setIsRegisterModalOpen(true); }}
          onForgotPassword={()  => { setIsLoginModalOpen(false); setIsForgotPasswordOpen(true); }}
        />

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onSwitchToLogin={() => { setIsRegisterModalOpen(false); setIsLoginModalOpen(true); }}
          onSubmitRegister={handleSubmitRegister}
        />

        <ServiceRequestModal
          isOpen={isServiceModalOpen}
          serviceName={selectedService}
          onClose={() => {
            setIsServiceModalOpen(false);
            setSelectedProductType(undefined);
            setIsProduct(false);
          }}
          onSubmit={handleServiceSubmit}
          userId={user?.id}
          isProduct={isProduct}
          productType={selectedProductType}
        />

        <ForgotPasswordModal
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          onSwitchToLogin={() => { setIsForgotPasswordOpen(false); setIsLoginModalOpen(true); }}
        />

      </div>
    </ErrorBoundary>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ App (Root) ══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
  return <AppInner />;
}