// components/ForgotPasswordModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// نافذة "نسيت كلمة المرور" — ترسل رابط إعادة تعيين كلمة المرور
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
  onSwitchToRegister?: () => void;
}

type Step = 'email' | 'sent' | 'error';

export function ForgotPasswordModal({
  isOpen,
  onClose,
  onSwitchToLogin,
  onSwitchToRegister,
}: ForgotPasswordModalProps) {
  const { requestPasswordReset } = useAuth();

  // ══════════════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════════════
  const [email, setEmail]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [step, setStep]             = useState<Step>('email');
  const [countdown, setCountdown]   = useState(0);

  // ══════════════════════════════════════════════════════════════════════════════
  // Reset on open
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setError(null);
      setStep('email');
      setCountdown(0);
    }
  }, [isOpen]);

  // ══════════════════════════════════════════════════════════════════════════════
  // Countdown timer
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  // ══════════════════════════════════════════════════════════════════════════════
  // ESC to close
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // ══════════════════════════════════════════════════════════════════════════════
  // Submit
  // ══════════════════════════════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }

    setLoading(true);
    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());

      if (!result.success) {
        // ✅ لو البريد مو مسجل يظهر الخطأ في نفس الصفحة بدون ما ينتقل لـ step error
        setError(result.error || 'حدث خطأ أثناء الإرسال');
        setLoading(false);
        return;
      }

      setStep('sent');
      setCountdown(60);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // Resend
  // ══════════════════════════════════════════════════════════════════════════════
  const handleResend = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const result = await requestPasswordReset(email.trim().toLowerCase());
      if (!result.success) {
        setError(result.error || 'فشل في إعادة الإرسال');
        setLoading(false);
        return;
      }
      setCountdown(60);
      setStep('sent');
    } catch {
      setError('فشل في إعادة الإرسال. حاول لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('email');
    setError(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{STYLES}</style>

      <div className="fp-overlay" onClick={onClose}>
        <div className="fp-card" onClick={e => e.stopPropagation()}>

          {/* Close */}
          <button className="fp-close" onClick={onClose} aria-label="إغلاق">
            <i className="fas fa-times" />
          </button>

          {/* ══ STEP 1: إدخال البريد ══ */}
          {step === 'email' && (
            <>
              <div className="fp-icon-wrap">
                <i className="fas fa-key" />
              </div>
              <h2 className="fp-title">نسيت كلمة المرور؟</h2>
              <p className="fp-subtitle">
                أدخل بريدك الإلكتروني وسنرسل لك<br />رابطاً لإعادة تعيين كلمة المرور
              </p>

              <form onSubmit={handleSubmit} className="fp-form">
                <div className="fp-field">
                  <label className="fp-label">
                    <i className="fas fa-envelope" />
                    البريد الإلكتروني
                  </label>
                  <div className="fp-input-wrap">
                    <input
                      type="email"
                      className="fp-input"
                      placeholder="example@domain.com"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError(null); }}
                      autoFocus
                      autoComplete="email"
                      dir="ltr"
                    />
                    <i className="fas fa-envelope fp-input-icon" />
                  </div>
                </div>

                {/* ✅ رسالة الخطأ تظهر هنا (بما فيها "البريد غير مسجل") */}
                {error && (
                  <div className="fp-error">
                    <i className="fas fa-exclamation-circle" />
                    {error}
                  </div>
                )}

                <button type="submit" className="fp-btn-primary" disabled={loading}>
                  {loading ? (
                    <>
                      <div className="fp-spinner" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane" />
                      إرسال رابط الاستعادة
                    </>
                  )}
                </button>
              </form>

              <div className="fp-divider">أو</div>

              <div className="fp-login-link">
                تذكرت كلمة المرور؟
                <button onClick={() => { onClose(); onSwitchToLogin(); }}>
                  سجّل دخولك
                </button>
              </div>

              {onSwitchToRegister && (
                <div className="fp-register-link">
                  ليس لديك حساب؟
                  <button onClick={() => { onClose(); onSwitchToRegister(); }}>
                    إنشاء حساب جديد
                  </button>
                </div>
              )}
            </>
          )}

          {/* ══ STEP 2: تم الإرسال ══ */}
          {step === 'sent' && (
            <>
              <div className="fp-icon-wrap sent">
                <i className="fas fa-envelope-open-text" />
              </div>
              <h2 className="fp-title">تم الإرسال بنجاح!</h2>
              <p className="fp-subtitle">
                تفقّد بريدك الإلكتروني واضغط على الرابط<br />لإعادة تعيين كلمة المرور
              </p>

              <div className="fp-sent-box">
                <p className="fp-sent-email">{email}</p>
                <p className="fp-sent-hint">
                  إذا لم يصلك البريد خلال دقائق:<br />
                  • تحقق من مجلد الرسائل غير المرغوب فيها<br />
                  • تأكد من كتابة البريد بشكل صحيح
                </p>
              </div>

              {error && (
                <div className="fp-error">
                  <i className="fas fa-exclamation-circle" />
                  {error}
                </div>
              )}

              <button
                className="fp-btn-primary"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
              >
                {loading ? (
                  <>
                    <div className="fp-spinner" />
                    جاري الإرسال...
                  </>
                ) : countdown > 0 ? (
                  <>
                    <i className="fas fa-clock" />
                    إعادة الإرسال بعد {countdown} ثانية
                  </>
                ) : (
                  <>
                    <i className="fas fa-redo" />
                    إعادة إرسال الرابط
                  </>
                )}
              </button>

              <button
                className="fp-btn-secondary"
                onClick={() => { onClose(); onSwitchToLogin(); }}
              >
                <i className="fas fa-sign-in-alt" />
                العودة لتسجيل الدخول
              </button>

              <div className="fp-timer-bar">
                <div
                  className="fp-timer-fill"
                  style={{ width: countdown > 0 ? `${((60 - countdown) / 60) * 100}%` : '100%' }}
                />
              </div>
              {countdown > 0 && (
                <p className="fp-timer-hint">يمكنك إعادة المحاولة خلال {countdown} ثانية</p>
              )}
            </>
          )}

          {/* ══ STEP 3: خطأ ══ */}
          {step === 'error' && (
            <>
              <div className="fp-icon-wrap error">
                <i className="fas fa-exclamation-triangle" />
              </div>
              <h2 className="fp-title">حدث خطأ</h2>
              <p className="fp-subtitle">{error || 'تعذّر إرسال البريد. تأكد من البريد وأعد المحاولة'}</p>

              <button className="fp-btn-primary" onClick={handleRetry}>
                <i className="fas fa-redo" />
                إعادة المحاولة
              </button>

              <button className="fp-btn-secondary" onClick={() => { onClose(); onSwitchToLogin(); }}>
                <i className="fas fa-sign-in-alt" />
                العودة لتسجيل الدخول
              </button>
            </>
          )}

        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Styles
// ═══════════════════════════════════════════════════════════════════════════════

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

  .fp-overlay {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 20px;
    overflow-y: auto;
    animation: fp-fadeIn 0.25s ease;
  }

  @keyframes fp-fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .fp-card {
    position: relative;
    width: 100%;
    max-width: 460px;
    margin: auto;
    background: #fff;
    border-radius: 28px;
    padding: 48px 40px 40px;
    box-shadow: 0 40px 100px rgba(0, 80, 180, 0.2), 0 8px 30px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 120, 255, 0.15);
    direction: rtl;
    font-family: 'Tajawal', sans-serif;
    animation: fp-rise 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes fp-rise {
    from { opacity: 0; transform: translateY(30px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .fp-close {
    position: absolute;
    top: 18px;
    left: 18px;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    border: 1px solid rgba(0, 120, 255, 0.15);
    background: rgba(0, 100, 255, 0.04);
    color: rgba(0, 80, 180, 0.5);
    font-size: 16px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    line-height: 1;
  }

  .fp-close:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.3);
    color: #ef4444;
  }

  .fp-icon-wrap {
    width: 88px;
    height: 88px;
    margin: 0 auto 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    position: relative;
    background: linear-gradient(135deg, #0891b2, #06b6d4);
    box-shadow: 0 12px 35px rgba(6, 182, 212, 0.35);
    color: #fff;
  }

  .fp-icon-wrap::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px dashed rgba(6, 182, 212, 0.25);
    animation: fp-spin 8s linear infinite;
  }

  .fp-icon-wrap.sent {
    background: linear-gradient(135deg, #059669, #10b981);
    box-shadow: 0 12px 35px rgba(16, 185, 129, 0.35);
  }

  .fp-icon-wrap.sent::after { border-color: rgba(16, 185, 129, 0.25); }

  .fp-icon-wrap.error {
    background: linear-gradient(135deg, #dc2626, #ef4444);
    box-shadow: 0 12px 35px rgba(239, 68, 68, 0.35);
  }

  .fp-icon-wrap.error::after { border-color: rgba(239, 68, 68, 0.25); }

  @keyframes fp-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .fp-title {
    text-align: center;
    font-size: 24px;
    font-weight: 900;
    color: #0f172a;
    margin: 0 0 10px;
  }

  .fp-subtitle {
    text-align: center;
    font-size: 14px;
    color: #64748b;
    margin: 0 0 32px;
    line-height: 1.7;
  }

  .fp-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .fp-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .fp-label {
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .fp-label i { color: #0891b2; }

  .fp-input-wrap { position: relative; }

  .fp-input {
    width: 100%;
    padding: 15px 20px 15px 48px;
    border: 2px solid rgba(0, 120, 255, 0.18);
    border-radius: 14px;
    font-family: 'Tajawal', sans-serif;
    font-size: 15px;
    color: #0f172a;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s, background 0.25s;
    background: #f8fafc;
    box-sizing: border-box;
    direction: ltr;
    text-align: right;
  }

  .fp-input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.1);
    background: #fff;
  }

  .fp-input-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    font-size: 16px;
    pointer-events: none;
    transition: color 0.25s;
  }

  .fp-input:focus ~ .fp-input-icon { color: #06b6d4; }

  .fp-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 12px;
    font-size: 13px;
    color: #dc2626;
    font-weight: 600;
  }

  .fp-btn-primary {
    width: 100%;
    padding: 16px;
    border-radius: 14px;
    border: none;
    font-family: 'Tajawal', sans-serif;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    background: linear-gradient(135deg, #0891b2, #06b6d4);
    color: #fff;
    box-shadow: 0 8px 24px rgba(6, 182, 212, 0.3);
  }

  .fp-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(6, 182, 212, 0.4);
  }

  .fp-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .fp-btn-secondary {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    border: 1px solid rgba(0, 120, 255, 0.15);
    background: rgba(0, 100, 255, 0.04);
    font-family: 'Tajawal', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: rgba(0, 80, 180, 0.7);
    margin-top: 10px;
  }

  .fp-btn-secondary:hover {
    border-color: rgba(0, 120, 255, 0.35);
    background: rgba(0, 100, 255, 0.08);
    color: rgba(0, 80, 180, 0.9);
  }

  .fp-sent-box {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.07), rgba(5, 150, 105, 0.04));
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 16px;
    padding: 20px;
    text-align: center;
    margin-bottom: 20px;
  }

  .fp-sent-email {
    font-size: 16px;
    font-weight: 800;
    color: #059669;
    direction: ltr;
    margin: 0 0 8px;
  }

  .fp-sent-hint {
    font-size: 13px;
    color: #64748b;
    margin: 0;
    line-height: 1.8;
  }

  .fp-divider {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 24px 0 0;
    color: #94a3b8;
    font-size: 13px;
  }

  .fp-divider::before, .fp-divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: rgba(148, 163, 184, 0.3);
  }

  .fp-login-link {
    text-align: center;
    margin-top: 16px;
    font-size: 14px;
    color: #64748b;
  }

  .fp-login-link button {
    background: none;
    border: none;
    font-family: 'Tajawal', sans-serif;
    font-size: 14px;
    font-weight: 800;
    color: #0891b2;
    cursor: pointer;
    margin-right: 4px;
    padding: 0;
    transition: color 0.2s;
  }

  .fp-login-link button:hover {
    color: #06b6d4;
    text-decoration: underline;
  }

  .fp-register-link {
    text-align: center;
    margin-top: 10px;
    font-size: 13px;
    color: #94a3b8;
  }

  .fp-register-link button {
    background: none;
    border: none;
    font-family: 'Tajawal', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #0891b2;
    cursor: pointer;
    margin-right: 4px;
    padding: 0;
    transition: color 0.2s;
  }

  .fp-register-link button:hover {
    color: #06b6d4;
    text-decoration: underline;
  }

  .fp-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: fp-spin-fast 0.7s linear infinite;
    flex-shrink: 0;
  }

  @keyframes fp-spin-fast {
    to { transform: rotate(360deg); }
  }

  .fp-timer-bar {
    height: 3px;
    background: rgba(0, 120, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 16px;
  }

  .fp-timer-fill {
    height: 100%;
    background: linear-gradient(90deg, #0891b2, #06b6d4);
    transition: width 1s linear;
    border-radius: 2px;
  }

  .fp-timer-hint {
    text-align: center;
    font-size: 12px;
    color: #94a3b8;
    margin: 8px 0 0;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default ForgotPasswordModal;