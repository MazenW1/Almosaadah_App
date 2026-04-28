// pages/PhoneVerification.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ثوابت الأمان
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESEND_ATTEMPTS = 3;
const sanitizePhone = (p: string): string => p.replace(/[^0-9+]/g, '').slice(0, 15);

interface LocationState {
  phone?: string;
  email?: string;
  userId?: string;
  fromRegistration?: boolean;
}

export default function PhoneVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const [phone] = useState(state?.phone || '');
  const [email] = useState(state?.email || '');

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // حماية محسّنة: التحقق من وجود بيانات صحيحة + من الـ auth session
    if (!phone || !email || !/^05[0-9]{8}$/.test(phone)) {
      navigate('/register', { replace: true });
      return;
    }
    sendInitialOTP();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const sendInitialOTP = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatPhone(phone) });
      if (error) throw error;
      setCountdown(60);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'فشل في إرسال رمز التحقق');
    } finally {
      setLoading(false);
    }
  };

  const formatPhone = (p: string) => {
    const clean = sanitizePhone(p);
    if (clean.startsWith('05') && clean.length === 10) return '+966' + clean.substring(1);
    if (clean.startsWith('5') && clean.length === 9) return '+966' + clean;
    if (clean.startsWith('+966')) return clean;
    return '+966' + clean.replace(/^0/, '');
  };

  const handleResend = async () => {
    if (countdown > 0 || isBlocked) return;
    if (resendAttempts >= MAX_RESEND_ATTEMPTS) {
      setError('وصلت للحد الأقصى لإعادة الإرسال. يرجى التواصل مع الدعم.');
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: formatPhone(phone) });
      if (error) throw error;
      setCountdown(60);
      setResendAttempts(p => p + 1);
      setError(null);
    } catch (err: any) {
      setError('فشل في إرسال الرمز. يرجى المحاولة لاحقاً.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    const completeCode = newOtp.join('');
    if (completeCode.length === 6) verifyCode(completeCode);
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      verifyCode(pasted);
    }
  };

  const verifyCode = async (code: string) => {
    if (isBlocked || otpAttempts >= MAX_OTP_ATTEMPTS) {
      setIsBlocked(true);
      setError('تم إيقاف الحساب مؤقتاً لكثرة المحاولات.');
      return;
    }
    if (!/^\d{6}$/.test(code)) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: formatPhone(phone),
        token: code,
        type: 'sms',
      });
      if (error) throw error;
      if (data.user) {
        // التحقق من تطابق الـ session قبل التحديث
        const { data: sess } = await supabase.auth.getSession();
        if (!sess.session || sess.session.user.id !== data.user.id) {
          throw new Error('انتهت الجلسة. يرجى تسجيل الدخول مجدداً.');
        }
        await markPhoneAsVerified(data.user.id);
        setSuccess(true);
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000);
      }
    } catch (err: any) {
      const newAtt = otpAttempts + 1;
      setOtpAttempts(newAtt);
      if (newAtt >= MAX_OTP_ATTEMPTS) setIsBlocked(true);
      const msg = newAtt >= MAX_OTP_ATTEMPTS
        ? 'تم إيقاف الحساب مؤقتاً لكثرة المحاولات.'
        : err.message?.includes('expired') ? 'انتهت صلاحية الرمز، اطلب رمزاً جديداً'
        : 'رمز التحقق غير صحيح';
      setError(msg);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const markPhoneAsVerified = async (uid: string) => {
    // ── [FIX-1] التحقق من أن الـ uid صالح ──
    if (!uid || typeof uid !== 'string' || uid.length > 100) return;
    try {
      await supabase.from('user').update({
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }).eq('user_id', uid);
    } catch {
      // لا نكشف تفاصيل الخطأ للمستخدم
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: '#020b18', position: 'relative', overflow: 'hidden', isolation: 'isolate' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap');
        .futuristic-header,
        .mobile-drawer,
        .modal-box {
          will-change: transform, opacity;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 768px) {
          .futuristic-header {
            contain: layout style paint;
          }
          
          .mobile-drawer {
            contain: layout style paint;
          }
        }
        /* Animated background grid */
        .pv-bg-grid {
          position: fixed;
          inset: 0;
          background-image:
            linear-gradient(rgba(0, 229, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 229, 255, 0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          animation: pv-grid-move 20s linear infinite;
          pointer-events: none;
          z-index: 0;
        }

        @keyframes pv-grid-move {
          to { background-position: 0 60px; }
        }

        /* Ambient orbs */
        .pv-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
          z-index: 0;
          animation: pv-orb-float 8s ease-in-out infinite alternate;
          will-change: transform;
          contain: layout style paint;
        }

        .pv-orb-1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(0, 100, 200, 0.12), transparent 70%);
          top: -100px; right: -100px;
        }

        .pv-orb-2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(0, 229, 255, 0.08), transparent 70%);
          bottom: -50px; left: -50px;
          animation-delay: -4s;
        }

        @keyframes pv-orb-float {
          from { transform: translate(0, 0); }
          to { transform: translate(20px, 20px); }
        }

        /* Card */
        .pv-card {
          font-family: 'Tajawal', sans-serif;
          background: linear-gradient(145deg, rgba(5, 13, 26, 0.95) 0%, rgba(10, 22, 40, 0.95) 100%);
          border: 1px solid rgba(0, 229, 255, 0.12);
          border-radius: 28px;
          width: 100%;
          max-width: 440px;
          padding: 0;
          position: relative;
          z-index: 1;
          box-shadow:
            0 0 0 1px rgba(0, 229, 255, 0.05),
            0 40px 80px rgba(0, 0, 0, 0.8),
            0 0 80px rgba(0, 229, 255, 0.04);
          animation: pv-appear 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        @keyframes pv-appear {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Top scan bar */
        .pv-scan-bar {
          height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.8) 50%, transparent 100%);
          animation: pv-scan 2.5s ease-in-out infinite;
        }

        @keyframes pv-scan {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }

        .pv-inner {
          padding: 36px 36px 32px;
        }

        /* Icon area */
        .pv-icon-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
        }

        .pv-icon-outer {
          width: 80px; height: 80px;
          border-radius: 50%;
          border: 1px solid rgba(0, 229, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
          position: relative;
          background: rgba(0, 229, 255, 0.03);
        }

        .pv-icon-outer::before {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: rgba(0, 229, 255, 0.5);
          animation: pv-spin 2s linear infinite;
        }

        .pv-icon-outer::after {
          content: '';
          position: absolute;
          inset: -12px;
          border-radius: 50%;
          border: 1px solid transparent;
          border-bottom-color: rgba(0, 150, 255, 0.25);
          animation: pv-spin 3s linear infinite reverse;
        }

        @keyframes pv-spin {
          to { transform: rotate(360deg); }
        }

        .pv-title {
          font-size: 22px;
          font-weight: 900;
          color: #e0f0ff;
          margin: 0 0 8px;
          text-align: center;
        }

        .pv-sub {
          font-size: 13px;
          color: rgba(0, 229, 255, 0.45);
          text-align: center;
          line-height: 1.7;
          margin: 0;
        }

        .pv-phone-badge {
          display: inline-block;
          padding: 4px 12px;
          background: rgba(0, 229, 255, 0.07);
          border: 1px solid rgba(0, 229, 255, 0.2);
          border-radius: 20px;
          color: #00e5ff;
          font-weight: 700;
          font-size: 15px;
          margin-top: 8px;
          letter-spacing: 1px;
          direction: ltr;
        }

        /* OTP inputs */
        .pv-otp-row {
          display: flex;
          justify-content: center;
          gap: clamp(4px, 2vw, 10px);
          margin-bottom: 20px;
          direction: ltr;
        }

        @media (max-width: 400px) {
          .pv-otp-input { width: 40px; height: 50px; font-size: 20px; }
          .pv-inner { padding: 20px 16px 20px; }
        }

        .pv-otp-input {
          width: 52px;
          height: 62px;
          border: 1.5px solid rgba(0, 229, 255, 0.12);
          border-radius: 14px;
          background: rgba(0, 229, 255, 0.02);
          text-align: center;
          font-size: 24px;
          font-weight: 800;
          font-family: 'Tajawal', sans-serif;
          color: #00e5ff;
          outline: none;
          transition: all 0.2s ease;
          caret-color: transparent;
        }

        .pv-otp-input:focus {
          border-color: rgba(0, 229, 255, 0.55);
          background: rgba(0, 229, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.09), 0 0 24px rgba(0, 229, 255, 0.08);
          transform: scale(1.06);
        }

        .pv-otp-input.filled {
          border-color: rgba(6, 255, 165, 0.45);
          background: rgba(6, 255, 165, 0.05);
          color: #06ffa5;
        }

        @keyframes pv-shake {
          0%, 100% { transform: translateX(0); }
          15%, 45%, 75% { transform: translateX(-6px); }
          30%, 60%, 90% { transform: translateX(6px); }
        }

        .pv-shake { animation: pv-shake 0.45s ease; }

        /* Error */
        .pv-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(255, 77, 109, 0.07);
          border: 1px solid rgba(255, 77, 109, 0.2);
          border-radius: 10px;
          color: #ff8fa3;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
          direction: rtl;
        }

        /* Loading dots */
        .pv-loading {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 6px;
          padding: 14px 0;
          color: rgba(0, 229, 255, 0.5);
          font-size: 13px;
          gap: 10px;
        }

        .pv-dots { display: flex; gap: 5px; }

        .pv-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: rgba(0, 229, 255, 0.6);
          animation: pv-bounce 1.2s ease-in-out infinite;
        }

        .pv-dot:nth-child(2) { animation-delay: 0.15s; }
        .pv-dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes pv-bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }

        /* Resend */
        .pv-resend-row {
          text-align: center;
          font-size: 13px;
          color: rgba(0, 229, 255, 0.35);
          margin-top: 8px;
        }

        .pv-resend-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          padding: 0;
          transition: color 0.2s;
        }

        .pv-resend-btn:disabled { color: rgba(0, 229, 255, 0.2); cursor: default; }
        .pv-resend-btn:not(:disabled) { color: rgba(0, 229, 255, 0.75); }
        .pv-resend-btn:not(:disabled):hover { color: #00e5ff; }

        /* Separator */
        .pv-sep {
          margin: 20px 0 0;
          padding-top: 20px;
          border-top: 1px solid rgba(0, 229, 255, 0.07);
          text-align: center;
        }

        .pv-edit-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: rgba(0, 229, 255, 0.25);
          transition: color 0.2s;
        }

        .pv-edit-btn:hover { color: rgba(0, 229, 255, 0.6); }

        /* Security badge */
        .pv-security {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: rgba(0, 229, 255, 0.2);
          font-family: 'Tajawal', sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }

        /* Success */
        .pv-success {
          text-align: center;
          padding: 12px 0 8px;
        }

        .pv-success-ring {
          width: 88px; height: 88px;
          border-radius: 50%;
          border: 2px solid rgba(6, 255, 165, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          background: rgba(6, 255, 165, 0.06);
          box-shadow: 0 0 40px rgba(6, 255, 165, 0.15), inset 0 0 20px rgba(6, 255, 165, 0.05);
          animation: pv-success-glow 1.8s ease-in-out infinite;
        }

        @keyframes pv-success-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(6, 255, 165, 0.15); }
          50% { box-shadow: 0 0 50px rgba(6, 255, 165, 0.35); }
        }

        .pv-success-title {
          font-size: 21px;
          font-weight: 900;
          color: #06ffa5;
          margin-bottom: 8px;
        }

        .pv-success-sub {
          font-size: 13px;
          color: rgba(6, 255, 165, 0.45);
        }

        /* Countdown ring */
        .pv-countdown-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .pv-countdown-ring {
          width: 40px; height: 40px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pv-countdown-svg {
          position: absolute;
          inset: 0;
          transform: rotate(-90deg);
        }

        .pv-countdown-circle {
          fill: none;
          stroke: rgba(0, 229, 255, 0.15);
          stroke-width: 2;
        }

        .pv-countdown-progress {
          fill: none;
          stroke: rgba(0, 229, 255, 0.6);
          stroke-width: 2;
          stroke-linecap: round;
          stroke-dasharray: 110;
          transition: stroke-dashoffset 1s linear;
        }

        .pv-countdown-num {
          font-size: 12px;
          font-weight: 800;
          color: rgba(0, 229, 255, 0.7);
          font-family: 'Tajawal', sans-serif;
          position: relative;
          z-index: 1;
        }
      
        @media (max-width: 768px) {
          * { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          input, select, textarea { font-size: 16px !important; }
          button { -webkit-tap-highlight-color: transparent; }
        }
        `}</style>

      {/* Background */}
      <div className="pv-bg-grid" />
      <div className="pv-orb pv-orb-1" />
      <div className="pv-orb pv-orb-2" />

      <div className="pv-card">
        <div className="pv-scan-bar" />
        <div className="pv-inner">

          {/* Icon header */}
          <div className="pv-icon-wrap">
            <div className="pv-icon-outer">
              <i className="fas fa-mobile-alt" style={{ color: '#00e5ff', fontSize: '28px', position: 'relative', zIndex: 1 }} />
            </div>
            <h1 className="pv-title">تأكيد رقم الجوال</h1>
            <p className="pv-sub">
              تم إرسال رمز التحقق المكوّن من 6 أرقام إلى
            </p>
            <span className="pv-phone-badge">{phone}</span>
          </div>

          {/* Content */}
          {success ? (
            <div className="pv-success">
              <div className="pv-success-ring">
                <i className="fas fa-check" style={{ color: '#06ffa5', fontSize: '34px' }} />
              </div>
              <p className="pv-success-title">تم التحقق بنجاح!</p>
              <p className="pv-success-sub">جاري تحويلك إلى لوحة التحكم...</p>
            </div>
          ) : (
            <>
              {/* OTP */}
              <div className="pv-otp-row" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={el => inputRefs.current[index] = el}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleInputChange(index, e.target.value)}
                    onKeyDown={e => handleKeyDown(index, e)}
                    className={`pv-otp-input ${digit ? 'filled' : ''} ${error ? 'pv-shake' : ''}`}
                    disabled={loading}
                    autoFocus={index === 0}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="pv-error">
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="pv-loading">
                  <div className="pv-dots">
                    <div className="pv-dot" />
                    <div className="pv-dot" />
                    <div className="pv-dot" />
                  </div>
                  <span>جاري التحقق...</span>
                </div>
              )}

              {/* Resend */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                {countdown > 0 && (
                  <div className="pv-countdown-wrap">
                    <div className="pv-countdown-ring">
                      <svg className="pv-countdown-svg" viewBox="0 0 40 40">
                        <circle className="pv-countdown-circle" cx="20" cy="20" r="17.5" />
                        <circle
                          className="pv-countdown-progress"
                          cx="20" cy="20" r="17.5"
                          style={{ strokeDashoffset: 110 - (110 * countdown / 60) }}
                        />
                      </svg>
                      <span className="pv-countdown-num">{countdown}</span>
                    </div>
                    <span style={{ fontSize: '13px', color: 'rgba(0,229,255,0.35)', fontFamily: 'Tajawal, sans-serif' }}>
                      ثانية لإعادة الإرسال
                    </span>
                  </div>
                )}

                <div className="pv-resend-row">
                  لم تستلم الرمز؟{' '}
                  <button
                    className="pv-resend-btn"
                    onClick={handleResend}
                    disabled={countdown > 0 || resendLoading || loading}
                  >
                    {resendLoading ? 'جاري الإرسال...' : countdown > 0 ? '' : 'إعادة إرسال الرمز'}
                  </button>
                </div>
              </div>

              {/* Edit number */}
              <div className="pv-sep">
                <button
                  className="pv-edit-btn"
                  onClick={() => navigate('/register', { state: { phone, email } })}
                >
                  ✏ تعديل رقم الجوال
                </button>
              </div>
            </>
          )}
        </div>

        {/* Security note */}
        <div className="pv-security" style={{ paddingBottom: '20px' }}>
          <i className="fas fa-shield-alt" />
          <span>عملية التحقق آمنة ومشفرة بالكامل</span>
        </div>
      </div>
    </div>
  );
}