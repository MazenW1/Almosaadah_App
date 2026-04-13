import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin: () => void;
}

type Step = 'email' | 'sent';

export function ForgotPasswordModal({ isOpen, onClose, onSwitchToLogin }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('email');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setError(null);
      setStep('email');
      setCountdown(0);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setStep('sent');
      setCountdown(60);
    } catch (err: any) {
      setError('حدث خطأ، تحقق من البريد الإلكتروني وحاول مجدداً');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setCountdown(60);
    } catch {
      setError('فشل إعادة الإرسال، حاول لاحقاً');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

        .fp-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          padding: 20px;
          overflow-y: auto;
        }

        .fp-card {
          position: relative;
          width: 100%;
          max-width: 440px;
          margin: auto;
          background: #fff;
          border-radius: 28px;
          padding: 48px 40px 40px;
          box-shadow: 0 40px 100px rgba(8, 145, 178, 0.18), 0 8px 30px rgba(0,0,0,0.08);
          border: 1px solid rgba(6, 182, 212, 0.15);
          direction: rtl;
          font-family: 'Tajawal', sans-serif;
          animation: fp-rise 0.35s cubic-bezier(0.34,1.56,0.64,1);
        }

        @keyframes fp-rise {
          from { opacity: 0; transform: translateY(30px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .fp-close {
          position: absolute;
          top: 18px;
          left: 18px;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(100, 116, 139, 0.08);
          color: #94a3b8;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .fp-close:hover { background: rgba(239,68,68,0.1); color: #ef4444; }

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
        }
        .fp-icon-wrap.key {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          box-shadow: 0 12px 35px rgba(6,182,212,0.35);
        }
        .fp-icon-wrap.sent {
          background: linear-gradient(135deg, #059669, #10b981);
          box-shadow: 0 12px 35px rgba(16,185,129,0.35);
        }
        .fp-icon-wrap::after {
          content: '';
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px dashed rgba(6,182,212,0.25);
          animation: fp-spin 8s linear infinite;
        }
        .fp-icon-wrap.sent::after { border-color: rgba(16,185,129,0.25); }

        @keyframes fp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        .fp-title {
          text-align: center;
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          margin-bottom: 8px;
        }

        .fp-subtitle {
          text-align: center;
          font-size: 14px;
          color: #64748b;
          margin-bottom: 32px;
          line-height: 1.7;
        }

        .fp-label {
          font-size: 13px;
          font-weight: 700;
          color: #334155;
          margin-bottom: 8px;
          display: block;
        }

        .fp-input-wrap {
          position: relative;
          margin-bottom: 20px;
        }

        .fp-input {
          width: 100%;
          padding: 15px 20px 15px 44px;
          border: 2px solid rgba(6,182,212,0.2);
          border-radius: 14px;
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.25s, box-shadow 0.25s;
          background: #f8fafc;
          box-sizing: border-box;
          direction: ltr;
          text-align: right;
        }
        .fp-input:focus {
          border-color: #06b6d4;
          box-shadow: 0 0 0 4px rgba(6,182,212,0.12);
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
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          color: #dc2626;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 16px;
        }

        .fp-btn {
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
        }
        .fp-btn-primary {
          background: linear-gradient(135deg, #0891b2, #06b6d4);
          color: #fff;
          box-shadow: 0 8px 24px rgba(6,182,212,0.3);
        }
        .fp-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(6,182,212,0.4);
        }
        .fp-btn-primary:disabled { opacity: 0.65; cursor: not-allowed; }

        .fp-btn-ghost {
          background: rgba(100,116,139,0.07);
          color: #64748b;
          margin-top: 10px;
          font-size: 14px;
        }
        .fp-btn-ghost:hover { background: rgba(100,116,139,0.13); color: #334155; }

        .fp-sent-box {
          background: linear-gradient(135deg, rgba(16,185,129,0.07), rgba(5,150,105,0.04));
          border: 1px solid rgba(16,185,129,0.2);
          border-radius: 16px;
          padding: 20px;
          text-align: center;
          margin-bottom: 24px;
        }
        .fp-sent-email {
          font-size: 15px;
          font-weight: 800;
          color: #059669;
          direction: ltr;
        }
        .fp-sent-hint {
          font-size: 13px;
          color: #64748b;
          margin-top: 6px;
          line-height: 1.6;
        }

        .fp-resend {
          text-align: center;
          font-size: 13px;
          color: #64748b;
          margin-top: 16px;
        }
        .fp-resend-btn {
          background: none;
          border: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          color: #0891b2;
          padding: 0;
          margin-right: 4px;
          transition: color 0.2s;
        }
        .fp-resend-btn:disabled { color: #94a3b8; cursor: default; }
        .fp-resend-btn:not(:disabled):hover { color: #06b6d4; }

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
          background: rgba(148,163,184,0.3);
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
        }
        .fp-login-link button:hover { color: #06b6d4; text-decoration: underline; }

        .fp-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: fp-spin-fast 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes fp-spin-fast {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div className="fp-overlay" onClick={onClose}>
        <div className="fp-card" onClick={e => e.stopPropagation()}>
          <button className="fp-close" onClick={onClose} aria-label="إغلاق">
            <i className="fas fa-times" />
          </button>

          {/* ── Email Step ── */}
          {step === 'email' && (
            <>
              <div className={`fp-icon-wrap key`}>
                🔑
              </div>
              <h2 className="fp-title">نسيت كلمة المرور؟</h2>
              <p className="fp-subtitle">
                أدخل بريدك الإلكتروني وسنرسل لك رابطاً<br />لإعادة تعيين كلمة المرور
              </p>

              <form onSubmit={handleSubmit}>
                <label className="fp-label">
                  <i className="fas fa-envelope" style={{ color: '#0891b2', marginLeft: '6px' }} />
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

                {error && (
                  <div className="fp-error">
                    <i className="fas fa-exclamation-circle" />
                    {error}
                  </div>
                )}

                <button type="submit" className="fp-btn fp-btn-primary" disabled={loading}>
                  {loading ? (
                    <><div className="fp-spinner" /> جاري الإرسال...</>
                  ) : (
                    <><i className="fas fa-paper-plane" /> إرسال رابط الاستعادة</>
                  )}
                </button>

                <button type="button" className="fp-btn fp-btn-ghost" onClick={onClose}>
                  إلغاء
                </button>
              </form>

              <div className="fp-divider">أو</div>
              <div className="fp-login-link">
                تذكرت كلمة المرور؟
                <button onClick={() => { onClose(); onSwitchToLogin(); }}>
                  سجّل دخولك
                </button>
              </div>
            </>
          )}

          {/* ── Sent Step ── */}
          {step === 'sent' && (
            <>
              <div className="fp-icon-wrap sent">
                ✉️
              </div>
              <h2 className="fp-title">تم الإرسال بنجاح!</h2>
              <p className="fp-subtitle">
                تفقّد بريدك الإلكتروني واضغط على الرابط<br />لإعادة تعيين كلمة المرور
              </p>

              <div className="fp-sent-box">
                <p className="fp-sent-email">{email}</p>
                <p className="fp-sent-hint">
                  إذا لم يصلك البريد، تحقق من مجلد الـ Spam<br />
                  أو الرسائل غير المرغوب فيها
                </p>
              </div>

              {error && (
                <div className="fp-error">
                  <i className="fas fa-exclamation-circle" />
                  {error}
                </div>
              )}

              <button
                className="fp-btn fp-btn-primary"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
              >
                {loading ? (
                  <><div className="fp-spinner" /> جاري الإرسال...</>
                ) : countdown > 0 ? (
                  <><i className="fas fa-clock" /> إعادة الإرسال بعد {countdown}ث</>
                ) : (
                  <><i className="fas fa-redo" /> إعادة إرسال الرابط</>
                )}
              </button>

              <button className="fp-btn fp-btn-ghost" onClick={() => { onClose(); onSwitchToLogin(); }}>
                <i className="fas fa-sign-in-alt" style={{ fontSize: '14px' }} />
                العودة لتسجيل الدخول
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}