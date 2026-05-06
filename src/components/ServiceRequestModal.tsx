import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface ServiceData {
  description: string;
  contract_pdf_url: string;
}

interface ServiceRequestModalProps {
  isOpen: boolean;
  serviceName: string;
  onClose: () => void;
  onSubmit: (data: ServiceRequestData) => Promise<void>;
  userId: string | undefined;
  isProduct?: boolean;
  productType?: string;
}

interface ServiceRequestData {
  serviceName: string;
  serviceId?: string;
  serviceDescription: string;
  contractUrl: string;
  notes: string;
  file: File | null;
  packageType?: string;
}

const AWN_PACKAGES = [
  { name: 'الماسية', icon: '💎', color: '#0ea5e9', gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)' },
  { name: 'الذهبية', icon: '🥇', color: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { name: 'الفضية',  icon: '🥈', color: '#64748b', gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' },
  { name: 'مرنة',    icon: '🔄', color: '#10b981', gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)' },
];

export function ServiceRequestModal({
  isOpen,
  serviceName,
  onClose,
  onSubmit,
  userId,
  isProduct = false,
  productType,
}: ServiceRequestModalProps) {
  const { isAdmin, isEmployee } = useAuth();
  const isStaff = isAdmin || isEmployee;

  const [loading, setLoading] = useState(false);
  const [service, setService] = useState<ServiceData | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [packageError, setPackageError] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState<{ show: boolean; statusText: string }>({ show: false, statusText: '' });
  const [successScreen, setSuccessScreen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAwnProduct = isProduct && productType === 'عون';

  const selectedPackageInfo = isAwnProduct && selectedPackage
    ? AWN_PACKAGES.find(p => p.name === selectedPackage) ?? null
    : null;

  useEffect(() => {
    const fetchServiceData = async () => {
      if (!isOpen || !serviceName) return;

      const { data, error } = await supabase
        .from('services')
        .select('service_description')
        .eq('service_name', serviceName)
        .eq('is_active', true)
        .maybeSingle();

      if (!error && data) {
        setService({ description: data.service_description || '', contract_pdf_url: '' });
      } else {
        setService(null);
      }
    };

    fetchServiceData();
  }, [isOpen, serviceName]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId) {
      alert('يرجى تسجيل الدخول أولاً');
      return;
    }

    if (isAwnProduct && !selectedPackage) {
      setPackageError(true);
      return;
    }

    setLoading(true);

    try {
      const { data: serviceData } = await supabase
        .from('services')
        .select('service_id')
        .eq('service_name', serviceName)
        .maybeSingle();

      if (serviceData?.service_id) {
        const { data: existingRequest } = await supabase
          .from('service_requests')
          .select('request_id, request_status')
          .eq('user_id', userId)
          .eq('service_id', serviceData.service_id)
          .in('request_status', ['pending_review', 'in_progress', 'approved'])
          .maybeSingle();

        if (existingRequest) {
          const statusText =
            existingRequest.request_status === 'pending_review' ? 'قيد المراجعة'
            : existingRequest.request_status === 'in_progress' ? 'قيد التنفيذ'
            : 'نشط';
          setDuplicateAlert({ show: true, statusText });
          setLoading(false);
          return;
        }
      }

      await onSubmit({
        serviceName,
        serviceId:          serviceData?.service_id || undefined,
        serviceDescription: service?.description || '',
        contractUrl:        service?.contract_pdf_url || '',
        notes:              '',
        file:               null,
        packageType:        isAwnProduct ? selectedPackage : undefined,
        terms_accepted:     true,
        terms_version:      '1.0',
        accepted_at:        new Date().toISOString(),
      } as ServiceRequestData & Record<string, unknown>);

      setSuccessScreen(true);
      setTimeout(() => {
        setSuccessScreen(false);
        setSelectedPackage('');
        onClose();
      }, 3200);

    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── شاشة تنبيه الطلب المكرر ──────────────────────────────────────────────
  if (duplicateAlert.show) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed, #ffedd5)',
          border: '2px solid #fed7aa',
          borderRadius: '28px',
          padding: '48px 40px',
          width: '90%', maxWidth: '460px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(234,88,12,0.25)',
          animation: 'successPop 0.45s cubic-bezier(.4,1.4,.6,1) both',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(234,88,12,0.07)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(234,88,12,0.05)' }} />

          <div style={{
            width: '90px', height: '90px',
            background: 'linear-gradient(135deg, #ea580c, #f97316)',
            borderRadius: '50%', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(234,88,12,0.35)',
            animation: 'checkBounce 0.5s 0.2s cubic-bezier(.4,1.4,.6,1) both',
          }}>
            <i className="fas fa-exclamation" style={{ color: '#fff', fontSize: '38px' }} />
          </div>

          <h2 style={{ fontFamily: "'Tajawal', sans-serif", fontSize: '22px', fontWeight: '900', color: '#9a3412', margin: '0 0 10px' }}>
            يوجد طلب نشط لهذه الخدمة
          </h2>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: '#ea580c', borderRadius: '50px',
            padding: '7px 20px', margin: '0 0 16px',
          }}>
            <i className="fas fa-circle" style={{ color: '#fde68a', fontSize: '8px' }} />
            <span style={{ fontFamily: "'Tajawal', sans-serif", fontWeight: '800', fontSize: '14px', color: '#fff' }}>
              الحالة الحالية: {duplicateAlert.statusText}
            </span>
          </div>

          <p style={{ fontFamily: "'Tajawal', sans-serif", fontSize: '14px', color: '#c2410c', fontWeight: '600', lineHeight: '1.8', margin: '0 0 24px' }}>
            لا يمكن تقديم طلب جديد لنفس الخدمة<br />
            حتى يتم إغلاق الطلب الحالي.
          </p>

          <div style={{
            background: 'rgba(234,88,12,0.08)', border: '1.5px solid #fed7aa',
            borderRadius: '14px', padding: '12px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginBottom: '28px',
          }}>
            <span style={{ fontSize: '18px' }}>💡</span>
            <p style={{ margin: 0, fontFamily: "'Tajawal', sans-serif", fontSize: '13px', color: '#9a3412', fontWeight: '600' }}>
              يمكنك متابعة طلبك من لوحة التحكم أو التواصل مع الإدارة
            </p>
          </div>

          <button
            type="button"
            title="إغلاق التنبيه"
            onClick={() => setDuplicateAlert({ show: false, statusText: '' })}
            style={{
              background: 'linear-gradient(135deg, #ea580c, #f97316)',
              border: 'none', borderRadius: '14px',
              padding: '14px 40px', color: '#fff',
              fontFamily: "'Tajawal', sans-serif",
              fontSize: '15px', fontWeight: '800',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(234,88,12,0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            حسناً، فهمت
          </button>
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  // ── شاشة الحجب للأدمن / الموظف ───────────────────────────────────────────
  if (isStaff) {
    const roleLabel = isAdmin ? 'المدير' : 'الموظف';
    const roleIcon  = isAdmin ? 'fa-shield-alt' : 'fa-user-tie';
    const itemLabel = isProduct ? 'المنتج' : 'الخدمة';
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(7,15,30,0.92)',
        backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <div style={{
          background: 'linear-gradient(145deg, #0c2340, #0a3a5c)',
          border: '1.5px solid rgba(14,165,233,0.35)',
          borderRadius: '28px', padding: '44px 40px 40px',
          width: '90%', maxWidth: '460px', textAlign: 'center',
          boxShadow: '0 40px 100px rgba(8,145,178,0.35), inset 0 1px 0 rgba(255,255,255,0.07)',
          animation: 'staffBlockPop 0.45s cubic-bezier(.4,1.4,.6,1) both',
          position: 'relative', overflow: 'hidden', direction: 'rtl',
        }}>
          {/* زخارف خلفية */}
          <div style={{ position:'absolute', top:'-60px', right:'-60px', width:'200px', height:'200px', borderRadius:'50%', background:'radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%)', pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:'-50px', left:'-50px', width:'180px', height:'180px', borderRadius:'50%', background:'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)', pointerEvents:'none' }} />

          {/* شارة الدور */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)',
            borderRadius: '50px', padding: '5px 16px', marginBottom: '26px',
          }}>
            <i className={`fas ${roleIcon}`} style={{ color: '#38bdf8', fontSize: '11px' }} />
            <span style={{ fontFamily:"'Tajawal',sans-serif", fontSize:'12px', fontWeight:'700', color:'#7dd3fc' }}>
              وضع {roleLabel}
            </span>
          </div>

          {/* أيقونة القفل */}
          <div style={{ position:'relative', width:'90px', height:'90px', margin:'0 auto 26px' }}>
            <div style={{
              position:'absolute', inset:'-10px', borderRadius:'50%',
              background:'rgba(14,165,233,0.15)',
              animation:'staffRingPulse 2.2s ease-in-out infinite',
            }} />
            <div style={{
              width:'90px', height:'90px',
              background:'linear-gradient(135deg, #0ea5e9, #0284c7)',
              borderRadius:'50%', position:'relative',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 16px 48px rgba(8,145,178,0.5)',
            }}>
              <i className="fas fa-lock" style={{ color:'#fff', fontSize:'30px' }} />
            </div>
          </div>

          {/* النص */}
          <h2 style={{
            fontFamily:"'Tajawal',sans-serif", fontSize:'20px', fontWeight:'900',
            color:'#e0f2fe', margin:'0 0 12px', lineHeight:1.4,
          }}>
            هذه الميزة للعملاء فقط
          </h2>
          <p style={{
            fontFamily:"'Tajawal',sans-serif", fontSize:'14px',
            color:'#7dd3fc', fontWeight:'500', lineHeight:1.8, margin:'0 0 26px',
          }}>
            طلب {itemLabel} متاح للعملاء المسجّلين.<br />
            بإمكانك إدارة الطلبات من{' '}
            <strong style={{ color:'#bae6fd' }}>لوحة التحكم</strong>.
          </p>

          {/* بطاقة تلميح */}
          <div style={{
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(14,165,233,0.2)',
            borderRadius:'14px', padding:'14px 18px', marginBottom:'28px',
            display:'flex', alignItems:'center', gap:'12px', textAlign:'right',
          }}>
            <i className="fas fa-lightbulb" style={{ color:'#fbbf24', fontSize:'18px', flexShrink:0 }} />
            <p style={{ margin:0, fontFamily:"'Tajawal',sans-serif", fontSize:'13px', color:'#7dd3fc', fontWeight:'500', lineHeight:1.7 }}>
              يمكنك إضافة طلب يدوياً للعميل مباشرةً من لوحة إدارة الطلبات
            </p>
          </div>

          {/* زر الإغلاق */}
          <button
            type="button"
            title="إغلاق"
            onClick={onClose}
            style={{
              width:'100%', padding:'14px',
              background:'linear-gradient(135deg, #0ea5e9, #0284c7)', border:'none',
              borderRadius:'14px', color:'#fff',
              fontFamily:"'Tajawal',sans-serif", fontSize:'15px', fontWeight:'800',
              cursor:'pointer', boxShadow:'0 8px 28px rgba(8,145,178,0.45)',
              transition:'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 12px 36px rgba(8,145,178,0.6)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='0 8px 28px rgba(8,145,178,0.45)'; }}
          >
            <i className="fas fa-arrow-right" style={{ marginLeft:'8px' }} />
            حسناً، فهمت
          </button>
        </div>

        <style>{`
          @keyframes staffBlockPop {
            from { opacity: 0; transform: scale(0.88) translateY(20px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);    }
          }
          @keyframes staffRingPulse {
            0%, 100% { transform: scale(1);    opacity: 0.5; }
            50%       { transform: scale(1.18); opacity: 1;   }
          }
        `}</style>
      </div>
    );
  }
  if (successScreen) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
          border: '2px solid #86efac',
          borderRadius: '28px',
          padding: '48px 40px',
          width: '90%', maxWidth: '480px',
          textAlign: 'center',
          boxShadow: '0 30px 80px rgba(16,185,129,0.25)',
          animation: 'successPop 0.45s cubic-bezier(.4,1.4,.6,1) both',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'rgba(16,185,129,0.08)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(16,185,129,0.06)' }} />

          <div style={{
            width: '90px', height: '90px',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            borderRadius: '50%', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 12px 40px rgba(16,185,129,0.4)',
            animation: 'checkBounce 0.5s 0.3s cubic-bezier(.4,1.4,.6,1) both',
          }}>
            <i className="fas fa-check" style={{ color: '#fff', fontSize: '36px' }} />
          </div>

          <h2 style={{ fontFamily: "'Tajawal', sans-serif", fontSize: '24px', fontWeight: '900', color: '#065f46', margin: '0 0 12px' }}>
            تم استلام طلبك بنجاح! 🎉
          </h2>
          <p style={{ fontFamily: "'Tajawal', sans-serif", fontSize: '15px', color: '#047857', fontWeight: '600', lineHeight: '1.7', margin: '0 0 28px' }}>
            شكراً لثقتك بنا.<br />
            سيقوم فريقنا المتخصص بمراجعة طلبك والتواصل معك في أقرب وقت.
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
            {[
              { icon: '📋', text: 'طلبك قيد المراجعة' },
              { icon: '📞', text: 'سنتواصل معك قريباً' },
            ].map((b, i) => (
              <div key={i} style={{
                background: 'rgba(16,185,129,0.1)',
                border: '1.5px solid #6ee7b7',
                borderRadius: '50px', padding: '8px 16px',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontFamily: "'Tajawal', sans-serif",
                fontSize: '13px', fontWeight: '700', color: '#065f46',
              }}>
                <span>{b.icon}</span><span>{b.text}</span>
              </div>
            ))}
          </div>

          <div style={{ background: 'rgba(16,185,129,0.15)', borderRadius: '50px', height: '6px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #10b981, #059669)',
              borderRadius: '50px',
              animation: 'progressBar 3.2s linear forwards',
            }} />
          </div>
          <p style={{ fontFamily: "'Tajawal', sans-serif", fontSize: '12px', color: '#6ee7b7', marginTop: '10px', fontWeight: '600' }}>
            سيتم إغلاق هذه النافذة تلقائياً...
          </p>

          <style>{`
            @keyframes successPop {
              from { opacity: 0; transform: scale(0.85) translateY(20px); }
              to   { opacity: 1; transform: scale(1) translateY(0); }
            }
            @keyframes checkBounce {
              from { opacity: 0; transform: scale(0.4); }
              to   { opacity: 1; transform: scale(1); }
            }
            @keyframes progressBar {
              from { width: 0%; }
              to   { width: 100%; }
            }
          `}</style>
        </div>
      </div>
    );
  }

  // ── المودال الرئيسي ───────────────────────────────────────────────────────
  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px', overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #fff, #ecfeff)',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: '24px',
          padding: '40px',
          width: '90%', maxWidth: '520px',
          margin: 'auto',
          boxShadow: '0 25px 80px rgba(6,182,212,0.3)',
          position: 'relative',
        }}
      >
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          title="إغلاق"
          style={{
            position: 'absolute', top: '18px', left: '18px',
            background: 'rgba(6,182,212,0.1)', border: 'none',
            width: '36px', height: '36px', borderRadius: '50%',
            cursor: 'pointer', fontSize: '16px', color: '#0891b2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: '.3s',
          }}
        >
          <i className="fas fa-times"></i>
        </button>

        {/* رأس المودال */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '70px', height: '70px',
            background: selectedPackageInfo
              ? selectedPackageInfo.gradient
              : 'linear-gradient(135deg, #0891b2, #06b6d4)',
            borderRadius: '50%', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '28px',
            boxShadow: '0 10px 30px rgba(6,182,212,0.3)',
          }}>
            {selectedPackageInfo
              ? <span>{selectedPackageInfo.icon}</span>
              : <i className="fas fa-check-circle"></i>
            }
          </div>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 6px', fontFamily: "'Tajawal', sans-serif" }}>
            تأكيد {isProduct ? 'المنتج' : 'الخدمة'}
          </h3>
          <h2 style={{ fontSize: '22px', fontWeight: '900', color: '#0f172a', margin: 0, fontFamily: "'Tajawal', sans-serif" }}>
            {serviceName}
          </h2>
        </div>

        {/* وصف الخدمة / المنتج */}
        {service?.description && (
          <div style={{
            background: 'rgba(6,182,212,0.06)',
            border: '1.5px solid rgba(6,182,212,0.2)',
            borderRadius: '16px',
            padding: '22px 24px',
            marginBottom: '28px',
            textAlign: 'right',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <i className="fas fa-info-circle" style={{ color: '#0891b2', fontSize: '16px' }}></i>
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#0891b2', fontFamily: "'Tajawal', sans-serif" }}>
                وصف {isProduct ? 'المنتج' : 'الخدمة'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.85', fontFamily: "'Tajawal', sans-serif", fontWeight: '500' }}>
              {service.description}
            </p>
          </div>
        )}

        {/* اختيار الباقة لمنتج عون */}
        {isAwnProduct && (
          <div style={{ marginBottom: '28px' }}>
            <label style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', display: 'block', marginBottom: '10px', fontFamily: "'Tajawal', sans-serif" }}>
              <i className="fas fa-gem" style={{ color: '#0891b2', marginLeft: '6px' }}></i>
              اختر الباقة <span style={{ color: '#ef4444' }}>*</span>
            </label>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                title="اختر الباقة"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  width: '100%', padding: '14px 18px',
                  background: selectedPackageInfo ? selectedPackageInfo.gradient : '#f8fafc',
                  border: selectedPackageInfo ? 'none' : packageError ? '2px dashed #ef4444' : '2px dashed rgba(6,182,212,0.4)',
                  borderRadius: '14px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedPackageInfo ? '0 4px 20px ' + (selectedPackageInfo.color + '40') : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {selectedPackageInfo ? (
                    <>
                      <span style={{ fontSize: '22px' }}>{selectedPackageInfo.icon}</span>
                      <span style={{ fontWeight: '800', fontSize: '15px', color: '#fff', fontFamily: "'Tajawal', sans-serif" }}>
                        باقة {selectedPackage}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-chevron-down" style={{ color: '#0891b2', fontSize: '14px' }}></i>
                      <span style={{ color: '#64748b', fontSize: '14px', fontFamily: "'Tajawal', sans-serif" }}>
                        اضغط لاختيار الباقة المناسبة
                      </span>
                    </>
                  )}
                </div>
                {selectedPackageInfo && (
                  <i className="fas fa-chevron-down" style={{ color: '#fff', fontSize: '14px' }}></i>
                )}
              </button>

              {isDropdownOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                  background: '#fff', borderRadius: '16px',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                  zIndex: 100, overflow: 'hidden',
                  border: '1px solid rgba(6,182,212,0.2)',
                  animation: 'dropdownSlide 0.3s ease',
                }}>
                  {AWN_PACKAGES.map((pkg) => (
                    <button
                      key={pkg.name}
                      type="button"
                      title={pkg.name}
                      onClick={() => { setSelectedPackage(pkg.name); setIsDropdownOpen(false); setPackageError(false); }}
                      style={{
                        width: '100%', padding: '16px 20px',
                        border: 'none',
                        background: selectedPackage === pkg.name ? 'rgba(6,182,212,0.08)' : '#fff',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '14px',
                        transition: 'all 0.2s ease',
                        borderBottom: '1px solid rgba(226,232,240,0.5)',
                      }}
                    >
                      <div style={{
                        width: '44px', height: '44px', borderRadius: '12px',
                        background: pkg.gradient,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '20px', flexShrink: 0,
                        boxShadow: '0 4px 12px ' + pkg.color + '40',
                      }}>
                        {pkg.icon}
                      </div>
                      <div style={{ textAlign: 'right', flex: 1 }}>
                        <div style={{ fontWeight: '800', fontSize: '14px', color: '#0f172a', fontFamily: "'Tajawal', sans-serif" }}>
                          باقة {pkg.name}
                        </div>
                      </div>
                      {selectedPackage === pkg.name && (
                        <i className="fas fa-check-circle" style={{ color: pkg.color, fontSize: '20px' }}></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {packageError && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                marginTop: '8px', color: '#ef4444',
                fontSize: '13px', fontWeight: '700',
                fontFamily: "'Tajawal', sans-serif",
                animation: 'shakeX 0.4s ease',
              }}>
                <i className="fas fa-exclamation-circle"></i>
                يرجى اختيار الباقة قبل تأكيد الطلب
              </div>
            )}
          </div>
        )}

        {/* زر التأكيد */}
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={loading || (isAwnProduct && !selectedPackage)}
            style={{
              width: '100%', padding: '18px',
              background: selectedPackageInfo
                ? selectedPackageInfo.gradient
                : 'linear-gradient(135deg, #0891b2, #06b6d4)',
              color: '#fff', border: 'none', borderRadius: '14px',
              fontSize: '17px', fontWeight: '800',
              cursor: (loading || (isAwnProduct && !selectedPackage)) ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
              boxShadow: selectedPackageInfo
                ? '0 8px 25px ' + selectedPackageInfo.color + '50'
                : '0 8px 25px rgba(6,182,212,0.35)',
              fontFamily: "'Tajawal', sans-serif",
              opacity: (loading || (isAwnProduct && !selectedPackage)) ? 0.6 : 1,
              transition: 'all 0.3s ease',
            }}
          >
            {loading ? (
              <><i className="fas fa-spinner fa-spin"></i> جاري معالجة الطلب...</>
            ) : (
              <><i className="fas fa-paper-plane"></i>
                {isAwnProduct && selectedPackage
                  ? `تأكيد طلب باقة ${selectedPackage}`
                  : 'تأكيد الطلب'}
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '16px', fontFamily: "'Tajawal', sans-serif" }}>
            <i className="fas fa-info-circle"></i> سيتم مراجعة طلبك من قِبل الإدارة قبل التفعيل
          </p>
        </form>

        <style>{`
          @keyframes dropdownSlide {
            from { opacity: 0; transform: translateY(-10px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes shakeX {
            0%, 100% { transform: translateX(0); }
            20%       { transform: translateX(-6px); }
            40%       { transform: translateX(6px); }
            60%       { transform: translateX(-4px); }
            80%       { transform: translateX(4px); }
          }
        `}</style>
      </div>
    </div>
  );
}