// pages/ResetPasswordPage.tsx
// ─────────────────────────────────────────────────────────────────────────────
// صفحة تغيير كلمة المرور — يفتحها المستخدم من الرابط في البريد
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { getPasswordStrength } from '../lib/passwordReset';

interface ResetPasswordPageProps {
  onSuccess?: () => void;
  onBack?: () => void;
}

export function ResetPasswordPage({ onSuccess, onBack }: ResetPasswordPageProps) {
  // ══════════════════════════════════════════════════════════════════════════════
  // State
  // ══════════════════════════════════════════════════════════════════════════════
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // ══════════════════════════════════════════════════════════════════════════════
  // ✅ التحقق من الرابط عند فتح الصفحة — مصحَّح
  // ══════════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const verifyToken = async () => {
      try {
        const { supabase } = await import('../lib/supabase');

        // Supabase يضع التوكن في hash fragment بهذا الشكل:
        // https://almosaadah.sa/#access_token=xxx&refresh_token=yyy&type=recovery
        const hash = window.location.hash.replace('#', '');
        const hashParams = new URLSearchParams(hash);

        const accessToken  = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || '';
        const type         = hashParams.get('type');

        if (!accessToken || type !== 'recovery') {
          setTokenValid(false);
          setTokenError('الرابط غير صالح. يرجى طلب رابط جديد من صفحة نسيت كلمة المرور');
          setLoading(false);
          return;
        }

        // نعيّن الـ session يدوياً باستخدام التوكن من الرابط
        const { error: sessionError } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });

        if (sessionError) {
          setTokenValid(false);
          setTokenError('الرابط منتهي الصلاحية. يرجى طلب رابط جديد');
          setLoading(false);
          return;
        }

        // نظّف الـ hash من الـ URL بعد قراءته
        window.history.replaceState(null, '', window.location.pathname + '#/reset-password');

        setTokenValid(true);
        setLoading(false);
      } catch (err: any) {
        console.error('[ResetPasswordPage] verify error:', err);
        setTokenValid(false);
        setTokenError('فشل في التحقق من الرابط');
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  // ══════════════════════════════════════════════════════════════════════════════
  // تحديث كلمة المرور
  // ══════════════════════════════════════════════════════════════════════════════
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const strength = getPasswordStrength(password);
    if (strength.level < 2) {
      setError('يرجى استخدام كلمة مرور أقوى');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتان');
      return;
    }

    setUpdating(true);
    try {
      const { supabase } = await import('../lib/supabase');
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        if (error.message.includes('session') || error.message.includes('Invalid')) {
          setError('الرابط منتهي الصلاحية. يرجى طلب رابط جديد');
        } else {
          setError(error.message || 'فشل في تحديث كلمة المرور');
        }
        setUpdating(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
      setUpdating(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════════════
  // قوة كلمة المرور
  // ══════════════════════════════════════════════════════════════════════════════
  const strength = getPasswordStrength(password);

  // ── Loading ──
  if (loading) {
    return (
      <div className="rp-page">
        <style>{STYLES}</style>
        <div className="rp-card">
          <div className="rp-loading">
            <div className="rp-spinner-lg" />
            <p>جاري التحقق من الرابط...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Invalid Token ──
  if (tokenValid === false) {
    return (
      <div className="rp-page">
        <style>{STYLES}</style>
        <div className="rp-card">
          <div className="rp-icon-wrap error">
            <i className="fas fa-exclamation-triangle" />
          </div>
          <h2 className="rp-title">الرابط غير صالح</h2>
          <p className="rp-subtitle">{tokenError || 'هذا الرابط غير صالح أو منتهي الصلاحية'}</p>
          {onBack && (
            <button className="rp-btn-primary" onClick={onBack} style={{ marginTop: '24px' }}>
              <i className="fas fa-key" />
              طلب رابط جديد
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Success ──
  if (success) {
    return (
      <div className="rp-page">
        <style>{STYLES}</style>
        <div className="rp-card">
          <div className="rp-icon-wrap success">
            <i className="fas fa-check" />
          </div>
          <h2 className="rp-title">تم التحديث بنجاح!</h2>
          <p className="rp-subtitle">تم تغيير كلمة المرور بنجاح. جاري توجيهك...</p>
          <div className="rp-progress">
            <div className="rp-progress-bar" />
          </div>
        </div>
      </div>
    );
  }

  // ── Main Form ──
  return (
    <div className="rp-page">
      <style>{STYLES}</style>
      <div className="rp-card">
        {/* Header */}
        <div className="rp-header">
          <div className="rp-icon-wrap">
            <i className="fas fa-key" />
          </div>
          <h2 className="rp-title">إنشاء كلمة مرور جديدة</h2>
          <p className="rp-subtitle">أدخل كلمة مرور جديدة لحسابك</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rp-form">
          {/* Password */}
          <div className="rp-field">
            <label className="rp-label">
              <i className="fas fa-lock" />
              كلمة المرور الجديدة
            </label>
            <div className="rp-pw-wrap">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="8 أحرف على الأقل"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="rp-input"
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                className="rp-pw-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {password && (
              <>
                <div className="rp-strength-bar">
                  {[1, 2, 3].map(i => (
                    <div
                      key={i}
                      className="rp-strength-seg"
                      style={{ background: i <= strength.level ? strength.color : '#e2e8f0' }}
                    />
                  ))}
                </div>
                <p className="rp-strength-label" style={{ color: strength.color }}>
                  قوة كلمة المرور: {strength.label}
                  {strength.hints.length > 0 && strength.level < 3 && (
                    <span className="rp-hints"> — {strength.hints.join(', ')}</span>
                  )}
                </p>
              </>
            )}
          </div>

          {/* Confirm Password */}
          <div className="rp-field">
            <label className="rp-label">
              <i className="fas fa-lock" />
              تأكيد كلمة المرور
            </label>
            <div className="rp-pw-wrap">
              <input
                type={showConfirm ? 'text' : 'password'}
                placeholder="أعد كتابة كلمة المرور"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="rp-input"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="rp-pw-toggle"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
            {confirmPassword && password !== confirmPassword && (
              <p className="rp-match-error">✗ كلمتا المرور غير متطابقتان</p>
            )}
            {confirmPassword && password === confirmPassword && (
              <p className="rp-match-success">✓ كلمتا المرور متطابقتان</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="rp-error">
              <i className="fas fa-exclamation-circle" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className="rp-btn-primary"
            disabled={updating || password.length < 8 || password !== confirmPassword}
          >
            {updating ? (
              <>
                <div className="rp-spinner" />
                جاري التحديث...
              </>
            ) : (
              <>
                <i className="fas fa-save" />
                حفظ كلمة المرور الجديدة
              </>
            )}
          </button>
        </form>

        {/* Back Link */}
        {onBack && (
          <div className="rp-back">
            <button type="button" onClick={onBack}>
              <i className="fas fa-arrow-right" />
              العودة لتسجيل الدخول
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Styles
// ═══════════════════════════════════════════════════════════════════════════════

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

  .rp-page {
    font-family: 'Tajawal', sans-serif;
    direction: rtl;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f0f4ff 0%, #e0ecff 50%, #d0e4ff 100%);
    padding: 20px;
  }

  .rp-card {
    width: 100%;
    max-width: 460px;
    background: #fff;
    border-radius: 24px;
    padding: 40px 36px;
    box-shadow: 0 20px 60px rgba(0, 100, 255, 0.12), 0 4px 20px rgba(0, 80, 200, 0.08);
    border: 1px solid rgba(0, 120, 255, 0.12);
    animation: rp-rise 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes rp-rise {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .rp-header {
    text-align: center;
    margin-bottom: 32px;
  }

  .rp-icon-wrap {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 20px;
    font-size: 32px;
    background: linear-gradient(135deg, #0891b2, #06b6d4);
    color: #fff;
    box-shadow: 0 12px 35px rgba(6, 182, 212, 0.35);
    position: relative;
  }

  .rp-icon-wrap::after {
    content: '';
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px dashed rgba(6, 182, 212, 0.3);
    animation: rp-spin 10s linear infinite;
  }

  .rp-icon-wrap.success {
    background: linear-gradient(135deg, #059669, #10b981);
    box-shadow: 0 12px 35px rgba(16, 185, 129, 0.35);
  }

  .rp-icon-wrap.success::after {
    border-color: rgba(16, 185, 129, 0.3);
  }

  .rp-icon-wrap.error {
    background: linear-gradient(135deg, #dc2626, #ef4444);
    box-shadow: 0 12px 35px rgba(239, 68, 68, 0.35);
  }

  .rp-icon-wrap.error::after {
    border-color: rgba(239, 68, 68, 0.3);
  }

  @keyframes rp-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .rp-title {
    font-size: 24px;
    font-weight: 900;
    color: #0f172a;
    margin: 0 0 8px;
  }

  .rp-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 0;
    line-height: 1.6;
  }

  .rp-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .rp-field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rp-label {
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rp-label i {
    color: #0891b2;
  }

  .rp-pw-wrap {
    position: relative;
  }

  .rp-input {
    width: 100%;
    padding: 14px 48px 14px 16px;
    border: 2px solid rgba(0, 120, 255, 0.15);
    border-radius: 14px;
    font-family: 'Tajawal', sans-serif;
    font-size: 15px;
    color: #0f172a;
    background: #f8fafc;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s;
    box-sizing: border-box;
  }

  .rp-input:focus {
    border-color: #06b6d4;
    box-shadow: 0 0 0 4px rgba(6, 182, 212, 0.1);
    background: #fff;
  }

  .rp-pw-toggle {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 16px;
    padding: 4px;
    transition: transform 0.2s;
  }

  .rp-pw-toggle:hover {
    transform: translateY(-50%) scale(1.1);
  }

  .rp-strength-bar {
    display: flex;
    gap: 4px;
    margin-top: 4px;
  }

  .rp-strength-seg {
    height: 4px;
    flex: 1;
    border-radius: 2px;
    transition: background 0.3s;
  }

  .rp-strength-label {
    font-size: 12px;
    font-weight: 700;
    margin-top: 4px;
  }

  .rp-hints {
    color: #94a3b8;
    font-weight: 400;
  }

  .rp-match-error {
    font-size: 12px;
    color: #dc2626;
    font-weight: 600;
    margin-top: 4px;
  }

  .rp-match-success {
    font-size: 12px;
    color: #059669;
    font-weight: 600;
    margin-top: 4px;
  }

  .rp-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 12px;
    color: #dc2626;
    font-size: 13px;
    font-weight: 600;
  }

  .rp-btn-primary {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #0891b2, #06b6d4);
    border: none;
    border-radius: 14px;
    color: #fff;
    font-family: 'Tajawal', sans-serif;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: all 0.3s;
    box-shadow: 0 8px 24px rgba(6, 182, 212, 0.3);
  }

  .rp-btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(6, 182, 212, 0.4);
  }

  .rp-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .rp-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-top-color: #fff;
    border-radius: 50%;
    animation: rp-spin-fast 0.7s linear infinite;
  }

  @keyframes rp-spin-fast {
    to { transform: rotate(360deg); }
  }

  .rp-loading {
    text-align: center;
    padding: 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .rp-spinner-lg {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(0, 140, 255, 0.2);
    border-top-color: #0066ff;
    border-radius: 50%;
    animation: rp-spin-fast 0.8s linear infinite;
  }

  .rp-progress {
    width: 100%;
    height: 4px;
    background: rgba(0, 120, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 20px;
  }

  .rp-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #059669, #10b981);
    animation: rp-progress 2s ease-in-out forwards;
  }

  @keyframes rp-progress {
    from { width: 0; }
    to { width: 100%; }
  }

  .rp-back {
    text-align: center;
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid rgba(0, 120, 255, 0.08);
  }

  .rp-back button {
    background: none;
    border: none;
    font-family: 'Tajawal', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0891b2;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 0 auto;
    padding: 8px 16px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .rp-back button:hover {
    background: rgba(0, 140, 255, 0.05);
    color: #06b6d4;
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default ResetPasswordPage;