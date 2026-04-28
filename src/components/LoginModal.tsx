import { useState, useEffect, useRef } from 'react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

export function LoginModal({ isOpen, onClose, onLogin, onSwitchToRegister, onForgotPassword }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && emailRef.current) {
      setTimeout(() => emailRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await onLogin(email, password);
      if (error) {
        setError(error.message);
      } else {
        onClose();
        setEmail('');
        setPassword('');
      }
    } catch (err) {
      setError('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    onForgotPassword();
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.82)',
        padding: '20px',
        overflowY: 'auto',
        isolation: 'isolate',
      }}
    >
      <div
        id="loginContent"
        className="modal-container"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '420px',
          width: '100%',
          padding: '40px',
          borderRadius: '20px',
          position: 'relative',
          margin: 'auto',
          background: '#ffffff',
          border: '1px solid rgba(6,182,212,0.2)',
          boxShadow: '0 32px 80px rgba(6,182,212,0.15), 0 8px 32px rgba(0,0,0,0.1)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
              borderRadius: '50%',
              margin: '0 auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '32px',
              boxShadow: '0 10px 30px rgba(6, 182, 212, 0.3)',
            }}
          >
            <i className="fas fa-fingerprint"></i>
          </div>
          <h3 style={{ color: '#0f172a', marginBottom: '6px', fontSize: '24px', fontWeight: '900' }}>
            بوابة الدخول
          </h3>
          <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic' }}>
            نحو تميّز مؤسسي مستدام
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            ref={emailRef}
            type="email"
            id="adminEmail"
            placeholder="البريد الإلكتروني"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-control mb-4"
            style={{
              width: '100%',
              padding: '16px 20px',
              border: '2px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none',
            }}
          />

          <input
            type="password"
            id="adminPassword"
            placeholder="كلمة المرور"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-control mb-4"
            style={{
              width: '100%',
              padding: '16px 20px',
              border: '2px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '12px',
              fontSize: '16px',
              outline: 'none',
            }}
          />

          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#ef4444',
                padding: '10px 15px',
                borderRadius: '8px',
                marginBottom: '15px',
                fontSize: '14px',
              }}
            >
              {error}
            </div>
          )}

          <div style={{ textAlign: 'right', marginBottom: '20px' }}>
            <a
              href="#"
              onClick={handleForgotPassword}
              style={{
                color: '#0891b2',
                fontSize: '13px',
                fontWeight: '600',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <i className="fas fa-key" style={{ fontSize: '11px' }}></i>
              نسيت كلمة المرور؟
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
            style={{
              width: '100%',
              padding: '16px',
              fontSize: '18px',
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> جاري الدخول...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i> دخول
              </>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '15px' }}>
            <p style={{ fontSize: '14px', color: '#64748b', margin: '0' }}>
              ليس لديك حساب؟
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onClose();
                  onSwitchToRegister();
                }}
                style={{
                  color: '#0891b2',
                  fontWeight: '700',
                  textDecoration: 'none',
                  marginRight: '5px',
                }}
              >
                إنشاء حساب جديد
              </a>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'block',
              margin: '15px auto 0',
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 16px',
            }}
          >
            إلغاء
          </button>
        </form>
      </div>
    </div>
  );
}