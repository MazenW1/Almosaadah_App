import { useState, useEffect, useRef, useCallback } from 'react';
import React from 'react';
interface RegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegister?: (email: string, password: string) => Promise<{ error: Error | null }>;
  onSwitchToLogin: () => void;
  onSubmitRegister: (data: RegisterData) => Promise<void>;
}

interface RegisterData {
  associationName: string;
  phone: string;
  license: string;
  email: string;
  entityType: string;
  password: string;
  confirmPassword: string;
}

const ENTITY_TYPES = [
  { value: 'جمعية أهلية', label: 'جمعية أهلية', icon: '🏛️' },
  { value: 'مؤسسة أهلية', label: 'مؤسسة أهلية', icon: '🏢' },
  { value: 'شركة داعمة', label: 'شركة داعمة (مشغلة)', icon: '🤝' },
  { value: 'فرد', label: 'فرد', icon: '👤' },
];

const ENTITY_NAME_PLACEHOLDER: Record<string, string> = {
  'جمعية أهلية': 'اسم الجمعية الأهلية',
  'مؤسسة أهلية': 'اسم المؤسسة الأهلية',
  'شركة داعمة': 'اسم الشركة',
  'فرد': 'الاسم الكامل',
};

const ALLOWED_ENTITY_TYPES = ['جمعية أهلية', 'مؤسسة أهلية', 'شركة داعمة', 'فرد'];
const sanitizeText = (v: string): string => v.replace(/<[^>]*>/g, '').replace(/['"`;]/g, '').trim().slice(0, 200);
const MAX_OTP_ATTEMPTS = 5;
const MAX_RESEND_ATTEMPTS = 3;

export function RegisterModal({
  isOpen,
  onClose,
  onSubmitRegister,
  onSwitchToLogin,
}: RegisterModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // OTP state
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [resendAttempts, setResendAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Real-time duplicate check state ──────────────────────────────────────────
  type FieldStatus = 'idle' | 'checking' | 'ok' | 'taken';
  const [emailStatus,   setEmailStatus]   = useState<FieldStatus>('idle');
  const [licenseStatus, setLicenseStatus] = useState<FieldStatus>('idle');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [formData, setFormData] = useState<RegisterData>({
    associationName: '',
    phone: '',
    license: '',
    email: '',
    entityType: '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
      setStep(1);
      setError(null);
      setOtp(['', '', '', '', '', '']);
      setOtpError(null);
      setVerified(false);
      setEmailStatus('idle');
      setLicenseStatus('idle');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Countdown timer for OTP resend
  useEffect(() => {
    if (step === 3 && resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [step, resendCountdown]);

  // ── Real-time duplicate check via RPC (يتجاوز RLS) ───────────────────────────
  const checkDuplicates = useCallback(async (email: string, license: string, entityType: string) => {
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const licenseToCheck = entityType !== 'فرد' && license.trim().length >= 1 ? license.trim() : null;

    if (!emailValid && !licenseToCheck) {
      setEmailStatus('idle');
      setLicenseStatus('idle');
      return;
    }

    if (emailValid)      setEmailStatus('checking');
    if (licenseToCheck)  setLicenseStatus('checking');

    try {
      const { supabase: sb } = await import('../lib/supabase');
      const { data, error } = await sb.rpc('check_email_license_exists', {
        p_email:   email.trim().toLowerCase(),
        p_license: licenseToCheck,
      });

      if (!error && data) {
        setEmailStatus(emailValid ? (data.email_exists   ? 'taken' : 'ok') : 'idle');
        setLicenseStatus(licenseToCheck ? (data.license_exists ? 'taken' : 'ok') : 'idle');
      }
    } catch {
      // في حال فشل الـ RPC نعود لـ idle ونتحقق عند الإرسال
      setEmailStatus('idle');
      setLicenseStatus('idle');
    }
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      checkDuplicates(formData.email, formData.license, formData.entityType);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.email, formData.license, formData.entityType, step, checkDuplicates]);

  // ── Real-time check للترخيص في step 1 ────────────────────────────────────────
  useEffect(() => {
    if (step !== 1) return;
    if (formData.entityType === 'فرد' || formData.license.trim().length < 1) {
      setLicenseStatus('idle');
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLicenseStatus('checking');
      try {
        const { supabase: sb } = await import('../lib/supabase');
        const { data } = await sb.rpc('check_email_license_exists', {
          p_email:   '',
          p_license: formData.license.trim(),
        });
        setLicenseStatus(data?.license_exists ? 'taken' : 'ok');
      } catch {
        setLicenseStatus('idle');
      }
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [formData.license, formData.entityType, step]);

  const handleChange = (field: keyof RegisterData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const validateStep1 = () => {
    const { associationName, phone, license, entityType } = formData;
    const cleanName = sanitizeText(associationName);
    if (!cleanName) { setError('يرجى إدخال اسم الكيان'); return false; }
    if (!entityType || !ALLOWED_ENTITY_TYPES.includes(entityType)) { setError('يرجى اختيار نوع الكيان'); return false; }
    if (!/^05[0-9]{8}$/.test(phone)) { setError('رقم الجوال غير صحيح (يجب أن يبدأ بـ 05 ويكون 10 أرقام)'); return false; }
    if (entityType !== 'فرد' && (license.trim().length < 1 || license.trim().length > 10)) { setError('رقم الترخيص يجب أن يكون بين 1 و 10 أرقام'); return false; }
    if (licenseStatus === 'taken')    { setError('رقم الترخيص مسجل مسبقاً، يرجى التحقق'); return false; }
    if (licenseStatus === 'checking') { setError('جارٍ التحقق من رقم الترخيص، يرجى الانتظار'); return false; }
    return true;
  };

  const validateStep2 = () => {
    const { email, password, confirmPassword } = formData;
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('يرجى إدخال بريد إلكتروني صحيح');
      return false;
    }
    if (password.length < 8) { setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل'); return false; }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('كلمة المرور يجب أن تحتوي على حروف وأرقام');
      return false;
    }
    if (password !== confirmPassword) { setError('كلمتا المرور غير متطابقتان'); return false; }
    return true;
  };

  const handleNextStep = () => {
    setError(null);
    if (validateStep1()) setStep(2);
  };

  // Step 2 → Step 3: create account then send OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!validateStep2()) return;

    // منع الإرسال إذا كان البريد أو الترخيص مسجلاً (من الـ real-time check)
    if (emailStatus === 'taken') {
      setError('هذا البريد الإلكتروني مسجل مسبقاً');
      return;
    }
    if (licenseStatus === 'taken') {
      setError('رقم الترخيص مسجل مسبقاً');
      return;
    }

    // لو الـ check لم ينتهِ بعد، ننتظر نتيجته أولاً
    if (emailStatus === 'checking' || licenseStatus === 'checking') {
      setError('جارٍ التحقق من البيانات، يرجى الانتظار لحظة...');
      return;
    }

    setLoading(true);
    try {
      // تحقق نهائي عبر RPC قبل الإرسال (طبقة أمان إضافية)
      const { supabase: sb } = await import('../lib/supabase');
      const { data: check } = await sb.rpc('check_email_license_exists', {
        p_email:   formData.email.trim().toLowerCase(),
        p_license: formData.entityType !== 'فرد' && formData.license.trim()
          ? formData.license.trim()
          : null,
      });
      if (check?.email_exists)   { setError('هذا البريد الإلكتروني مسجل مسبقاً'); return; }
      if (check?.license_exists) { setError('رقم الترخيص مسجل مسبقاً');           return; }

      await onSubmitRegister(formData);
      // Account created — now move to OTP verification
      setStep(3);
      setResendCountdown(60);
      setOtp(['', '', '', '', '', '']);
    } catch (err: any) {
      setError(err.message || 'حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    if (isBlocked || otpAttempts >= MAX_OTP_ATTEMPTS) {
      setIsBlocked(true);
      setOtpError('تم إيقاف الحساب مؤقتاً لكثرة المحاولات.');
      return;
    }
    if (!/^\d{6}$/.test(code)) return;
    setOtpLoading(true);
    setOtpError(null);

    try {
      const { supabase } = await import('../lib/supabase');

      const { data, error } = await supabase.auth.verifyOtp({
        email: formData.email,
        token: code,
        type: 'signup',
      });

      if (error) throw error;

      if (data.user) {
        // البيانات تُحفظ تلقائياً عبر useAuth عند SIGNED_IN من sessionStorage
      }

      setVerified(true);
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      const newAtt = otpAttempts + 1;
      setOtpAttempts(newAtt);

      if (newAtt >= MAX_OTP_ATTEMPTS) {
        setIsBlocked(true);
      }

      const msg = err.message?.includes('expired')
        ? 'انتهت صلاحية الرمز، اطلب رمزاً جديداً'
        : 'رمز التحقق غير صحيح، تحقق وأعد المحاولة';

      setOtpError(newAtt >= MAX_OTP_ATTEMPTS ? 'تم إيقاف الحساب مؤقتاً لكثرة المحاولات.' : msg);
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();

    } finally {
      setOtpLoading(false);
    }
  };

  // ✅ إعادة إرسال OTP — نستخدم resend بدل signInWithOtp
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || isBlocked) return;
    if (resendAttempts >= MAX_RESEND_ATTEMPTS) {
      setOtpError('وصلت للحد الأقصى لإعادة الإرسال.');
      return;
    }
    setResendLoading(true);
    try {
      const { supabase } = await import('../lib/supabase');
      // ✅ مُصلح: نستخدم signInWithOtp مع shouldCreateUser: false لإعادة الإرسال فقط
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: formData.email,
      });
      if (error) throw error;
      setResendCountdown(60);
      setResendAttempts(p => p + 1);
      setOtpError(null);
    } catch (err: any) {
      setOtpError('فشل في إرسال الرمز. يرجى المحاولة لاحقاً.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setOtpError(null);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    const complete = newOtp.join('');
    if (complete.length === 6) verifyOtp(complete);
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      verifyOtp(pasted);
    }
  };

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: 'ضعيفة', color: '#cc2244' };
    if (score <= 3) return { level: 2, label: 'متوسطة', color: '#b07800' };
    return { level: 3, label: 'قوية', color: '#007a3d' };
  };

  const strength = getPasswordStrength(formData.password);

  if (!isOpen) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap');

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }

        .rm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 40, 100, 0.82);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 16px;
          animation: rm-fadeIn 0.25s ease;
          isolation: isolate;
        }

        @keyframes rm-fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .rm-card {
          font-family: 'Tajawal', sans-serif;
          background: #ffffff;
          border: 1px solid rgba(0, 140, 255, 0.18);
          border-radius: 28px;
          width: 100%;
          max-width: 520px;
          max-height: 92vh;
          overflow-y: auto;
          position: relative;
          animation: rm-slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow:
            0 0 0 1px rgba(0, 140, 255, 0.08),
            0 40px 80px rgba(0, 80, 180, 0.15),
            0 0 60px rgba(0, 140, 255, 0.08);
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 140, 255, 0.2) transparent;
        }

        .rm-card::-webkit-scrollbar { width: 3px; }
        .rm-card::-webkit-scrollbar-thumb { background: rgba(0, 140, 255, 0.25); border-radius: 3px; }

        @keyframes rm-slideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .rm-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, rgba(0, 140, 255, 0.8), transparent);
          animation: rm-scan 3s ease-in-out infinite;
          z-index: 10;
          border-radius: 28px 28px 0 0;
        }

        @keyframes rm-scan {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }

        .rm-header {
          padding: 32px 32px 24px;
          position: relative;
          border-bottom: 1px solid rgba(0, 140, 255, 0.1);
          background: linear-gradient(180deg, rgba(0, 100, 255, 0.04) 0%, transparent 100%);
        }

        .rm-header-glow {
          position: absolute;
          top: -40px; left: 50%; transform: translateX(-50%);
          width: 200px; height: 120px;
          background: radial-gradient(ellipse, rgba(0, 140, 255, 0.12) 0%, transparent 70%);
          pointer-events: none;
        }

        .rm-logo-ring {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: 2px solid rgba(0, 140, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          position: relative;
          animation: rm-rotate-border 6s linear infinite;
          background: linear-gradient(135deg, rgba(0, 140, 255, 0.08), rgba(0, 80, 200, 0.12));
        }

        .rm-logo-ring::before {
          content: '';
          position: absolute;
          inset: -4px;
          border-radius: 50%;
          border: 1px solid transparent;
          border-top-color: rgba(0, 140, 255, 0.7);
          border-right-color: rgba(0, 140, 255, 0.2);
          animation: rm-rotate-border 2s linear infinite;
        }

        @keyframes rm-rotate-border {
          to { transform: rotate(360deg); }
        }

        .rm-title {
          font-size: 22px;
          font-weight: 900;
          color: #0d2b5e;
          text-align: center;
          margin: 0 0 6px;
          letter-spacing: -0.3px;
        }

        .rm-subtitle {
          font-size: 13px;
          color: rgba(0, 100, 200, 0.7);
          text-align: center;
          margin: 0;
        }

        .rm-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 20px 32px 0;
          direction: rtl;
        }

        .rm-step-dot {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          font-family: 'Tajawal', sans-serif;
          border: 1.5px solid rgba(0, 140, 255, 0.25);
          color: rgba(0, 100, 200, 0.45);
          background: rgba(0, 140, 255, 0.05);
          transition: all 0.3s ease;
          position: relative;
          z-index: 1;
        }

        .rm-step-dot.active {
          border-color: rgba(0, 120, 255, 0.8);
          color: #0066ff;
          background: rgba(0, 120, 255, 0.1);
          box-shadow: 0 0 16px rgba(0, 120, 255, 0.2);
        }

        .rm-step-dot.done {
          border-color: rgba(0, 160, 80, 0.7);
          color: #00a050;
          background: rgba(0, 160, 80, 0.08);
        }

        .rm-step-line {
          flex: 1;
          height: 1px;
          background: rgba(0, 140, 255, 0.12);
          max-width: 60px;
          transition: background 0.3s;
        }

        .rm-step-line.done {
          background: rgba(0, 160, 80, 0.4);
        }

        .rm-body {
          padding: 24px 32px 28px;
          direction: rtl;
        }

        .rm-label {
          display: block;
          font-size: 12px;
          font-weight: 700;
          color: rgba(0, 80, 180, 0.8);
          margin-bottom: 7px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .rm-input {
          width: 100%;
          padding: 12px 14px;
          background: #f4f8ff;
          border: 1px solid rgba(0, 120, 255, 0.18);
          border-radius: 12px;
          font-family: 'Tajawal', sans-serif;
          font-size: 14px;
          color: #1a2d5a;
          outline: none;
          transition: all 0.25s ease;
          box-sizing: border-box;
          direction: rtl;
        }

        .rm-input:focus {
          border-color: rgba(0, 120, 255, 0.55);
          background: #eef4ff;
          box-shadow: 0 0 0 3px rgba(0, 120, 255, 0.1);
        }

        .rm-input::placeholder { color: rgba(0, 80, 180, 0.3); }

        .rm-entity-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .rm-entity-btn {
          padding: 10px 8px;
          border: 1px solid rgba(0, 120, 255, 0.18);
          border-radius: 10px;
          background: #f4f8ff;
          color: rgba(0, 80, 180, 0.65);
          font-family: 'Tajawal', sans-serif;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .rm-entity-btn:hover {
          border-color: rgba(0, 120, 255, 0.4);
          background: #e8f0ff;
          color: rgba(0, 80, 200, 0.9);
        }

        .rm-entity-btn.selected {
          border-color: rgba(0, 120, 255, 0.7);
          background: rgba(0, 120, 255, 0.1);
          color: #0055dd;
          box-shadow: 0 0 12px rgba(0, 120, 255, 0.12);
        }

        .rm-strength-bar {
          display: flex;
          gap: 4px;
          margin-top: 8px;
        }

        .rm-strength-seg {
          height: 3px;
          flex: 1;
          border-radius: 2px;
          transition: background 0.3s;
        }

        .rm-pw-wrap {
          position: relative;
        }

        .rm-pw-toggle {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: rgba(0, 100, 200, 0.45);
          font-size: 14px;
          padding: 4px;
          transition: color 0.2s;
          line-height: 1;
        }

        .rm-pw-toggle:hover { color: rgba(0, 100, 200, 0.9); }

        .rm-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(255, 77, 109, 0.08);
          border: 1px solid rgba(255, 77, 109, 0.25);
          border-radius: 10px;
          color: #cc2244;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 16px;
        }

        .rm-btn-primary {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, rgba(0, 229, 255, 0.9), rgba(0, 150, 255, 0.9));
          border: none;
          border-radius: 14px;
          color: #001a2c;
          font-family: 'Tajawal', sans-serif;
          font-size: 15px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.25s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.3px;
        }

        .rm-btn-primary::before {
          content: '';
          position: absolute;
          top: -50%; left: -50%;
          width: 200%; height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.15) 50%, transparent 70%);
          transform: translateX(-100%);
          transition: transform 0.5s ease;
        }

        .rm-btn-primary:hover:not(:disabled)::before { transform: translateX(100%); }
        .rm-btn-primary:hover:not(:disabled) {
          box-shadow: 0 0 30px rgba(0, 229, 255, 0.4);
          transform: translateY(-1px);
        }
        .rm-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        .rm-btn-back {
          width: 100%;
          padding: 11px;
          background: transparent;
          border: 1px solid rgba(0, 120, 255, 0.18);
          border-radius: 12px;
          color: rgba(0, 80, 180, 0.55);
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 10px;
        }

        .rm-btn-back:hover:not(:disabled) {
          border-color: rgba(0, 120, 255, 0.4);
          color: rgba(0, 80, 200, 0.85);
          background: rgba(0, 120, 255, 0.04);
        }

        .rm-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: rm-spin 0.7s linear infinite;
        }

        @keyframes rm-spin {
          to { transform: rotate(360deg); }
        }

        .rm-close {
          position: absolute;
          top: 20px;
          left: 20px;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: 1px solid rgba(0, 120, 255, 0.2);
          background: rgba(0, 120, 255, 0.05);
          color: rgba(0, 80, 180, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 18px;
          transition: all 0.2s;
          line-height: 1;
          z-index: 20;
        }

        .rm-close:hover {
          border-color: rgba(0, 120, 255, 0.5);
          color: rgba(0, 80, 180, 0.9);
          background: rgba(0, 120, 255, 0.1);
        }

        .rm-divider {
          text-align: center;
          color: rgba(0, 60, 160, 0.5);
          font-size: 13px;
          margin-top: 20px;
        }

        .rm-link {
          color: rgba(0, 100, 220, 0.9);
          font-weight: 700;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
          transition: color 0.2s;
        }

        .rm-link:hover { color: #0044cc; }

        .rm-field-group {
          display: flex;
          flex-direction: column;
          gap: 14px;
          margin-bottom: 20px;
        }

        .rm-otp-title {
          text-align: center;
          color: #0d2b5e;
          font-size: 18px;
          font-weight: 800;
          margin-bottom: 6px;
        }

        .rm-otp-sub {
          text-align: center;
          color: rgba(0, 80, 180, 0.6);
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 28px;
        }

        .rm-otp-phone {
          color: #0055dd;
          font-weight: 700;
          direction: ltr;
          display: inline-block;
        }

        .rm-otp-inputs {
          display: flex;
          justify-content: center;
          gap: clamp(4px, 2vw, 10px);
          margin-bottom: 20px;
          direction: ltr;
        }

        @media (max-width: 400px) {
          .rm-otp-box { width: 40px; height: 48px; font-size: 18px; }
          .rm-body { padding: 16px 16px 20px; }
        }

        .rm-otp-box {
          width: 52px;
          height: 60px;
          border: 1.5px solid rgba(0, 120, 255, 0.2);
          border-radius: 14px;
          background: #f4f8ff;
          text-align: center;
          font-size: 22px;
          font-weight: 800;
          font-family: 'Tajawal', sans-serif;
          color: #0055dd;
          outline: none;
          transition: all 0.2s ease;
          caret-color: transparent;
        }

        .rm-otp-box:focus {
          border-color: rgba(0, 120, 255, 0.7);
          background: #eef4ff;
          box-shadow: 0 0 0 3px rgba(0, 120, 255, 0.12);
        }

        .rm-otp-box.filled {
          border-color: rgba(0, 120, 255, 0.5);
          background: #e8f0ff;
        }

        @keyframes rm-shake {
          0%, 100% { transform: translateX(0); }
          30%, 60%, 90% { transform: translateX(5px); }
        }

        .rm-otp-shake { animation: rm-shake 0.4s ease; }

        .rm-resend {
          text-align: center;
          font-size: 13px;
          color: rgba(0, 80, 180, 0.5);
          margin-top: 16px;
        }

        .rm-resend-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 13px;
          font-weight: 700;
          padding: 0;
          transition: all 0.2s;
        }

        .rm-resend-btn:disabled { color: rgba(0, 80, 180, 0.25); cursor: not-allowed; }
        .rm-resend-btn:not(:disabled) { color: rgba(0, 100, 220, 0.85); }
        .rm-resend-btn:not(:disabled):hover { color: #0044cc; }

        .rm-success {
          text-align: center;
          padding: 20px 0;
        }

        .rm-success-ring {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid rgba(0, 160, 80, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          background: rgba(0, 160, 80, 0.08);
          box-shadow: 0 0 30px rgba(0, 160, 80, 0.15);
          animation: rm-success-pulse 1.5s ease infinite;
        }

        @keyframes rm-success-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(0, 160, 80, 0.15); }
          50% { box-shadow: 0 0 40px rgba(0, 160, 80, 0.3); }
        }

        .rm-success-title {
          color: #007a3d;
          font-size: 20px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .rm-success-sub {
          color: rgba(0, 120, 60, 0.6);
          font-size: 13px;
        }

        .rm-otp-loading {
          display: flex;
          justify-content: center;
          gap: 6px;
          padding: 12px 0;
        }

        .rm-otp-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(0, 120, 255, 0.5);
          animation: rm-dot-bounce 1.2s ease-in-out infinite;
        }

        .rm-otp-dot:nth-child(2) { animation-delay: 0.15s; }
        .rm-otp-dot:nth-child(3) { animation-delay: 0.3s; }

        @keyframes rm-dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }

        .rm-slide-enter {
          animation: rm-slideIn 0.3s ease;
        }

        @keyframes rm-slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="rm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="rm-card" onClick={(e) => e.stopPropagation()}>

          {/* Glow */}
          <div className="rm-header-glow" />

          {/* Close */}
          <button className="rm-close" onClick={onClose} aria-label="إغلاق">×</button>

          {/* Header */}
          <div className="rm-header">
            <div className="rm-logo-ring">
              <i className="fas fa-fingerprint" style={{ color: '#0066ff', fontSize: '24px' }} />
            </div>
            <h2 className="rm-title">
              {step === 3 ? 'تأكيد البريد الإلكتروني' : 'إنشاء حساب جديد'}
            </h2>
            <p className="rm-subtitle">
              {step === 1 && 'الخطوة 1 — بيانات الكيان'}
              {step === 2 && 'الخطوة 2 — بيانات الدخول'}
              {step === 3 && 'الخطوة 3 — التحقق بالرمز'}
            </p>
          </div>

          {/* Progress */}
          <div className="rm-steps">
            {[1, 2, 3].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`rm-step-dot ${step > s ? 'done' : step === s ? 'active' : ''}`}>
                  {step > s ? '✓' : s}
                </div>
                {i < 2 && (
                  <div className={`rm-step-line ${step > s ? 'done' : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className="rm-body">
            <form aria-label="نموذج التسجيل" onSubmit={handleSubmit}>

              {/* ── Step 1 ── */}
              {step === 1 && (
                <div className="rm-slide-enter">
                  <div className="rm-field-group">

                    {/* Entity Type — أولاً حتى يتغير حقل الاسم بناءً على الاختيار */}
                    <div>
                      <span className="rm-label" role="group" aria-label="نوع الكيان">نوع الكيان</span>
                      <div className="rm-entity-grid">
                        {ENTITY_TYPES.map((et) => (
                          <button
                            key={et.value}
                            type="button"
                            className={`rm-entity-btn ${formData.entityType === et.value ? 'selected' : ''}`}
                            onClick={() => {
                              handleChange('entityType', et.value);
                              // امسح الاسم عند تغيير النوع لتجنب بيانات خاطئة
                              handleChange('associationName', '');
                            }}
                          >
                            <span style={{ fontSize: '18px' }}>{et.icon}</span>
                            {et.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Association Name — يظهر بعد اختيار النوع مع label وplaceholder ديناميكيَّين */}
                    <div>
                      <label htmlFor="rm-name" className="rm-label">
                        {formData.entityType === 'فرد'
                          ? 'الاسم الكامل'
                          : formData.entityType
                          ? 'اسم الكيان'
                          : 'الاسم'}
                      </label>
                      <input
                        id="rm-name"
                        ref={firstInputRef}
                        type="text"
                        placeholder={
                          formData.entityType
                            ? ENTITY_NAME_PLACEHOLDER[formData.entityType]
                            : 'اختر نوع الكيان أولاً'
                        }
                        value={formData.associationName}
                        onChange={(e) => handleChange('associationName', e.target.value)}
                        onFocus={() => setFocusedField('name')}
                        onBlur={() => setFocusedField(null)}
                        className="rm-input"
                        autoComplete={formData.entityType === 'فرد' ? 'name' : 'organization'}
                        maxLength={200}
                        disabled={!formData.entityType}
                        style={{ opacity: formData.entityType ? 1 : 0.5 }}
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label htmlFor="rm-phone" className="rm-label">رقم الجوال</label>
                      <input
                        id="rm-phone"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="05xxxxxxxx"
                        value={formData.phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          handleChange('phone', val);
                        }}
                        onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                        onFocus={() => setFocusedField('phone')}
                        onBlur={() => setFocusedField(null)}
                        className="rm-input"
                        style={{ direction: 'ltr', textAlign: 'right',
                          borderColor: formData.phone.length > 0 && formData.phone.length < 10
                            ? 'rgba(239,68,68,0.5)'
                            : formData.phone.length === 10
                            ? 'rgba(34,197,94,0.5)'
                            : undefined
                        }}
                        maxLength={10}
                        autoComplete="tel"
                      />
                    </div>

                    {/* License */}
                    {formData.entityType !== 'فرد' && (
                    <div>
                      <label htmlFor="rm-license" className="rm-label">رقم الترخيص</label>
                      <input
                        id="rm-license"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="أرقام فقط (1-10 أرقام)"
                        value={formData.license}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          handleChange('license', val);
                        }}
                        onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
                        onFocus={() => setFocusedField('license')}
                        onBlur={() => setFocusedField(null)}
                        className="rm-input"
                        maxLength={10}
                        style={{
                          borderColor:
                            licenseStatus === 'taken'    ? 'rgba(255,77,109,0.6)' :
                            licenseStatus === 'ok'       ? 'rgba(0,180,100,0.5)'  :
                            licenseStatus === 'checking' ? 'rgba(0,140,255,0.4)'  : undefined,
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '3px 0 0' }}>
                        {licenseStatus === 'checking' && (
                          <p style={{ fontSize: 11, color: '#0078ff', margin: 0, fontWeight: 600 }}>⏳ جارٍ التحقق...</p>
                        )}
                        {licenseStatus === 'taken' && (
                          <p style={{ fontSize: 11, color: '#cc2244', margin: 0, fontWeight: 700 }}>✗ رقم الترخيص مسجل مسبقاً</p>
                        )}
                        {licenseStatus === 'ok' && (
                          <p style={{ fontSize: 11, color: '#007a3d', margin: 0, fontWeight: 700 }}>✓ رقم الترخيص متاح</p>
                        )}
                        {licenseStatus === 'idle' && <span />}
                        <p style={{ fontSize: 11, color: formData.license.length >= 1 ? '#10b981' : '#94a3b8', margin: 0, textAlign: 'left' }}>
                          {formData.license.length}/10
                        </p>
                      </div>
                    </div>
                    )}

                  </div>

                  {error && (
                    <div className="rm-error">
                      <span>⚠</span>
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="button" className="rm-btn-primary" onClick={handleNextStep}>
                    التالي
                    <span style={{ fontSize: '16px' }}>←</span>
                  </button>
                </div>
              )}

              {/* ── Step 2 ── */}
              {step === 2 && (
                <div className="rm-slide-enter">
                  <div className="rm-field-group">

                    {/* Email */}
                    <div>
                      <label htmlFor="rm-email" className="rm-label">البريد الإلكتروني</label>
                      <input
                        id="rm-email"
                        type="email"
                        placeholder="your@email.com"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        onFocus={() => setFocusedField('email')}
                        onBlur={() => setFocusedField(null)}
                        className="rm-input"
                        style={{
                          direction: 'ltr', textAlign: 'right',
                          borderColor:
                            emailStatus === 'taken'    ? 'rgba(255,77,109,0.6)' :
                            emailStatus === 'ok'       ? 'rgba(0,180,100,0.5)'  :
                            emailStatus === 'checking' ? 'rgba(0,140,255,0.4)'  : undefined,
                        }}
                        autoComplete="email"
                      />
                      {emailStatus === 'checking' && (
                        <p style={{ fontSize: 11, color: '#0078ff', margin: '4px 0 0', fontWeight: 600 }}>⏳ جارٍ التحقق...</p>
                      )}
                      {emailStatus === 'taken' && (
                        <p style={{ fontSize: 11, color: '#cc2244', margin: '4px 0 0', fontWeight: 700 }}>✗ هذا البريد مسجل مسبقاً</p>
                      )}
                      {emailStatus === 'ok' && (
                        <p style={{ fontSize: 11, color: '#007a3d', margin: '4px 0 0', fontWeight: 700 }}>✓ البريد متاح</p>
                      )}
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="rm-password" className="rm-label">كلمة المرور</label>
                      <div className="rm-pw-wrap">
                        <input
                          id="rm-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="8 أحرف على الأقل"
                          value={formData.password}
                          onChange={(e) => handleChange('password', e.target.value)}
                          onFocus={() => setFocusedField('password')}
                          onBlur={() => setFocusedField(null)}
                          className="rm-input"
                          style={{ paddingLeft: '44px' }}
                          autoComplete="new-password"
                        />
                        <button type="button" title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="rm-pw-toggle" onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {formData.password && (
                        <>
                          <div className="rm-strength-bar">
                            {[1, 2, 3].map((i) => (
                              <div
                                key={i}
                                className="rm-strength-seg"
                                style={{ background: i <= strength.level ? strength.color : 'rgba(0,120,255,0.1)' }}
                              />
                            ))}
                          </div>
                          <p style={{ fontSize: '11px', color: strength.color, margin: '5px 0 0', fontWeight: '700' }}>
                            قوة كلمة المرور: {strength.label}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="rm-confirm-password" className="rm-label">تأكيد كلمة المرور</label>
                      <div className="rm-pw-wrap">
                        <input
                          id="rm-confirm-password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="أعد كتابة كلمة المرور"
                          value={formData.confirmPassword}
                          onChange={(e) => handleChange('confirmPassword', e.target.value)}
                          onFocus={() => setFocusedField('confirm')}
                          onBlur={() => setFocusedField(null)}
                          className="rm-input"
                          style={{
                            paddingLeft: '44px',
                            borderColor: formData.confirmPassword && formData.password !== formData.confirmPassword
                              ? 'rgba(255,77,109,0.5)'
                              : undefined
                          }}
                          autoComplete="new-password"
                        />
                        <button type="button" title={showConfirmPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"} className="rm-pw-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                          {showConfirmPassword ? '🙈' : '👁️'}
                        </button>
                      </div>
                      {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                        <p style={{ fontSize: '12px', color: '#cc2244', margin: '5px 0 0', fontWeight: '600' }}>✗ كلمتا المرور غير متطابقتان</p>
                      )}
                      {formData.confirmPassword && formData.password === formData.confirmPassword && (
                        <p style={{ fontSize: '12px', color: '#007a3d', margin: '5px 0 0', fontWeight: '600' }}>✓ كلمتا المرور متطابقتان</p>
                      )}
                    </div>

                  </div>

                  {error && (
                    <div className="rm-error">
                      <span>⚠</span>
                      <span>{error}</span>
                    </div>
                  )}

                  <button type="submit" className="rm-btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <div className="rm-spinner" />
                        جاري إنشاء الحساب...
                      </>
                    ) : (
                      <>
                        <span>✓</span>
                        إنشاء الحساب
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="rm-btn-back"
                    onClick={() => { setStep(1); setError(null); }}
                    disabled={loading}
                  >
                    <span>→</span>
                    العودة للخطوة السابقة
                  </button>
                </div>
              )}

              {/* ── Step 3: OTP ── */}
              {step === 3 && (
                <div className="rm-slide-enter" dir="rtl">
                  {verified ? (
                    <div className="rm-success">
                      <div className="rm-success-ring">
                        <i className="fas fa-check" style={{ color: '#007a3d', fontSize: '32px' }} />
                      </div>
                      <p className="rm-success-title">تم التحقق بنجاح! 🎉</p>
                      <p className="rm-success-sub">جاري إغلاق النافذة...</p>
                    </div>
                  ) : (
                    <>
                      <p className="rm-otp-title">أدخل رمز التحقق</p>
                      <p className="rm-otp-sub">
                        تم إرسال رمز مكوّن من 6 أرقام إلى بريدك الإلكتروني
                        <br />
                        <span className="rm-otp-phone">{formData.email}</span>
                      </p>

                      {/* OTP boxes */}
                      <div className="rm-otp-inputs" onPaste={handleOtpPaste}>
                        {otp.map((digit, i) => (
                          <input
                            key={i}
                            ref={el => { otpRefs.current[i] = el; }}
                            aria-label={`رمز التحقق رقم ${i + 1}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={e => handleOtpChange(i, e.target.value)}
                            onKeyDown={e => handleOtpKeyDown(i, e)}
                            className={`rm-otp-box ${digit ? 'filled' : ''} ${otpError ? 'rm-otp-shake' : ''}`}
                            disabled={otpLoading}
                            autoFocus={i === 0}
                          />
                        ))}
                      </div>

                      {otpError && (
                        <div className="rm-error">
                          <span>⚠</span>
                          <span>{otpError}</span>
                        </div>
                      )}

                      {otpLoading && (
                        <div className="rm-otp-loading">
                          <div className="rm-otp-dot" />
                          <div className="rm-otp-dot" />
                          <div className="rm-otp-dot" />
                        </div>
                      )}

                      <div className="rm-resend">
                        لم تستلم الرمز؟{' '}
                        <button
                          className="rm-resend-btn"
                          onClick={handleResendOtp}
                          disabled={resendCountdown > 0 || resendLoading || otpLoading}
                          type="button"
                        >
                          {resendLoading
                            ? 'جاري الإرسال...'
                            : resendCountdown > 0
                            ? `إعادة الإرسال بعد ${resendCountdown}ث`
                            : 'إعادة إرسال الرمز'}
                        </button>
                      </div>

                      {/* Edit email */}
                      <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button
                          type="button"
                          onClick={() => { setStep(2); setOtp(['', '', '', '', '', '']); setOtpError(null); }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(0,80,180,0.45)', fontSize: '12px',
                            fontFamily: 'Tajawal, sans-serif', fontWeight: 600
                          }}
                        >
                          تعديل البريد الإلكتروني
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Switch to login — only on steps 1 & 2 */}
              {step !== 3 && (
                <div className="rm-divider">
                  لديك حساب بالفعل؟{' '}
                  <span className="rm-link" onClick={() => { onClose(); onSwitchToLogin(); }}>
                    سجّل دخولك
                  </span>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default RegisterModal;