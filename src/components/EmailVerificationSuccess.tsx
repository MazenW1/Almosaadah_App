// components/EmailVerificationSuccess.tsx
// ─────────────────────────────────────────────────────────────────────────────
// صفحة تأكيد نجاح التحقق من البريد الإلكتروني
// تُعرض بعد التحقق بنجاح من رمز OTP
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';

interface EmailVerificationSuccessProps {
  email?: string;
  onContinue?: () => void;
  onLogin?: () => void;
  autoRedirectDelay?: number; // بالثواني، الافتراضي 5
}

export function EmailVerificationSuccess({
  email,
  onContinue,
  onLogin,
  autoRedirectDelay = 5,
}: EmailVerificationSuccessProps) {
  const [countdown, setCountdown] = useState(autoRedirectDelay);

  useEffect(() => {
    if (countdown <= 0) {
      onContinue?.();
      return;
    }

    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onContinue]);

  return (
    <>
      <style>{STYLES}</style>
      <div className="evs-page">
        <div className="evs-card">
          {/* Animated success ring */}
          <div className="evs-success-ring">
            <div className="evs-inner-ring" />
            <i className="fas fa-check evs-icon" />
          </div>

          {/* Text */}
          <h1 className="evs-title">تم التحقق بنجاح!</h1>
          <p className="evs-subtitle">
            {email ? (
              <>
                تم تفعيل حسابك المرتبط بـ
                <br />
                <span className="evs-email">{email}</span>
              </>
            ) : (
              'تم التحقق من بريدك الإلكتروني بنجاح'
            )}
          </p>

          {/* Confetti effect */}
          <div className="evs-confetti">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="evs-confetti-piece" style={{ '--i': i } as any} />
            ))}
          </div>

          {/* Progress */}
          <div className="evs-progress-section">
            <div className="evs-progress-bar">
              <div
                className="evs-progress-fill"
                style={{ animationDuration: `${autoRedirectDelay}s` }}
              />
            </div>
            <p className="evs-countdown">
              سيتم التوجيه تلقائياً خلال <strong>{countdown}</strong> ثانية
            </p>
          </div>

          {/* Actions */}
          <div className="evs-actions">
            {onContinue && (
              <button className="evs-btn-primary" onClick={onContinue}>
                <i className="fas fa-arrow-left" />
                متابعة
              </button>
            )}
            {onLogin && (
              <button className="evs-btn-secondary" onClick={onLogin}>
                <i className="fas fa-sign-in-alt" />
                تسجيل الدخول
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Styles ══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

  .evs-page {
    font-family: 'Tajawal', sans-serif;
    direction: rtl;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 50%, #d1fae5 100%);
    padding: 20px;
    position: relative;
    overflow: hidden;
  }

  .evs-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 480px;
    background: #fff;
    border-radius: 28px;
    padding: 48px 40px;
    text-align: center;
    box-shadow: 0 20px 60px rgba(16, 185, 129, 0.15), 0 4px 20px rgba(5, 150, 105, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.15);
    animation: evs-rise 0.5s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes evs-rise {
    from { opacity: 0; transform: translateY(30px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .evs-success-ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 3px solid rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 28px;
    position: relative;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.05));
    animation: evs-pulse 2s ease-in-out infinite;
  }

  @keyframes evs-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2); }
    50% { box-shadow: 0 0 0 20px rgba(16, 185, 129, 0); }
  }

  .evs-inner-ring {
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px dashed rgba(16, 185, 129, 0.25);
    animation: evs-spin 10s linear infinite;
  }

  @keyframes evs-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .evs-icon {
    font-size: 48px;
    color: #059669;
    animation: evs-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both;
  }

  @keyframes evs-pop {
    from { transform: scale(0); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .evs-title {
    font-size: 28px;
    font-weight: 900;
    color: #065f46;
    margin: 0 0 12px;
    animation: evs-slideUp 0.5s ease 0.3s both;
  }

  .evs-subtitle {
    font-size: 15px;
    color: #6b7280;
    margin: 0 0 32px;
    line-height: 1.8;
    animation: evs-slideUp 0.5s ease 0.4s both;
  }

  .evs-email {
    color: #059669;
    font-weight: 700;
    direction: ltr;
    display: inline-block;
  }

  @keyframes evs-slideUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .evs-progress-section {
    margin-bottom: 28px;
    animation: evs-slideUp 0.5s ease 0.5s both;
  }

  .evs-progress-bar {
    height: 5px;
    background: rgba(16, 185, 129, 0.15);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  .evs-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #059669, #10b981, #34d399);
    border-radius: 3px;
    animation: evs-progress linear forwards;
  }

  @keyframes evs-progress {
    from { width: 0; }
    to { width: 100%; }
  }

  .evs-countdown {
    font-size: 13px;
    color: #9ca3af;
    margin: 0;
  }

  .evs-countdown strong {
    color: #059669;
    font-weight: 800;
  }

  .evs-actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    animation: evs-slideUp 0.5s ease 0.6s both;
  }

  .evs-btn-primary {
    width: 100%;
    padding: 16px;
    background: linear-gradient(135deg, #059669, #10b981);
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
    box-shadow: 0 8px 24px rgba(16, 185, 129, 0.3);
  }

  .evs-btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 32px rgba(16, 185, 129, 0.4);
  }

  .evs-btn-secondary {
    width: 100%;
    padding: 14px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 12px;
    color: #059669;
    font-family: 'Tajawal', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }

  .evs-btn-secondary:hover {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.4);
  }

  /* Confetti */
  .evs-confetti {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
  }

  .evs-confetti-piece {
    position: absolute;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    animation: evs-confetti-fall 1.5s ease-out calc(var(--i) * 0.1s) both;
  }

  .evs-confetti-piece:nth-child(odd) {
    background: #10b981;
  }

  .evs-confetti-piece:nth-child(even) {
    background: #06b6d4;
  }

  .evs-confetti-piece:nth-child(3n) {
    background: #f59e0b;
  }

  @keyframes evs-confetti-fall {
    0% {
      transform: translate(0, 0) rotate(0deg) scale(0);
      opacity: 1;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translate(
        calc(cos(calc(var(--i) * 30deg)) * 80px),
        calc(sin(calc(var(--i) * 30deg)) * 80px - 100px)
      ) rotate(720deg) scale(1);
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default EmailVerificationSuccess;