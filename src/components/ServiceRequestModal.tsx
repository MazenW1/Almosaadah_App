import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ============================================
// 🔧 اكتب هنا البنود لكل باقة من باقات منتج عون
// ============================================

interface PackageItem {
  icon: string;
  text: string;
}

interface PackageDetails {
  icon: string;
  color: string;
  gradient: string;
  items: PackageItem[];
}

const PRODUCT_AWN_PACKAGES: Record<string, PackageDetails> = 
{
  
  'الماسية': {
    icon: '💎',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
    items: [
     { icon: '⚖️', text: 'الموافقة على هذه الشروط تعد إقراراً كاملاً بالالتزام بها' },
  { icon: '🎯', text: 'نطاق الخدمة يشمل الدعم الإداري والاستشاري المتفق عليه فقط' },
  { icon: '🤝', text: 'تتعهد الجهة بتقديم كافة البيانات المطلوبة والتعاون للتنفيذ' },
  { icon: '💰', text: 'يتم الالتزام بالمواعيد المالية المتفق عليها قبل استلام المخرجات' },
  { icon: '⏳', text: 'مدة التنفيذ مرتبطة بسرعة استجابة الجهة وتزويدنا بالبيانات' },
  { icon: '🔒', text: 'نلتزم بسرية تامة لجميع بيانات ومعلومات الجهة المشاركة' },
  { icon: '🚫', text: 'إخلاء مسؤولية: الخدمة استشارية ولا تضمن قبول المنح أو التمويل' },
  { icon: '🔄', text: 'يحق لمقدم الخدمة تحديث الشروط لضمان جودة العمل' },
  { icon: '📩', text: 'الضغط على موافقة يعد توقيعاً إلكترونياً ملزماً للطرفين' },
    ],
  },
  'الذهبية': {
    icon: '🥇',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    items: [
     { icon: '⚖️', text: 'الموافقة على هذه الشروط تعد إقراراً كاملاً بالالتزام بها' },
  { icon: '🎯', text: 'نطاق الخدمة يشمل الدعم الإداري والاستشاري المتفق عليه فقط' },
  { icon: '🤝', text: 'تتعهد الجهة بتقديم كافة البيانات المطلوبة والتعاون للتنفيذ' },
  { icon: '💰', text: 'يتم الالتزام بالمواعيد المالية المتفق عليها قبل استلام المخرجات' },
  { icon: '⏳', text: 'مدة التنفيذ مرتبطة بسرعة استجابة الجهة وتزويدنا بالبيانات' },
  { icon: '🔒', text: 'نلتزم بسرية تامة لجميع بيانات ومعلومات الجهة المشاركة' },
  { icon: '🚫', text: 'إخلاء مسؤولية: الخدمة استشارية ولا تضمن قبول المنح أو التمويل' },
  { icon: '🔄', text: 'يحق لمقدم الخدمة تحديث الشروط لضمان جودة العمل' },
  { icon: '📩', text: 'الضغط على موافقة يعد توقيعاً إلكترونياً ملزماً للطرفين' },
    ],
  },
  'الفضية': {
    icon: '🥈',
    color: '#64748b',
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
    items: [
      { icon: '⚖️', text: 'الموافقة على هذه الشروط تعد إقراراً كاملاً بالالتزام بها' },
  { icon: '🎯', text: 'نطاق الخدمة يشمل الدعم الإداري والاستشاري المتفق عليه فقط' },
  { icon: '🤝', text: 'تتعهد الجهة بتقديم كافة البيانات المطلوبة والتعاون للتنفيذ' },
  { icon: '💰', text: 'يتم الالتزام بالمواعيد المالية المتفق عليها قبل استلام المخرجات' },
  { icon: '⏳', text: 'مدة التنفيذ مرتبطة بسرعة استجابة الجهة وتزويدنا بالبيانات' },
  { icon: '🔒', text: 'نلتزم بسرية تامة لجميع بيانات ومعلومات الجهة المشاركة' },
  { icon: '🚫', text: 'إخلاء مسؤولية: الخدمة استشارية ولا تضمن قبول المنح أو التمويل' },
  { icon: '🔄', text: 'يحق لمقدم الخدمة تحديث الشروط لضمان جودة العمل' },
  { icon: '📩', text: 'الضغط على موافقة يعد توقيعاً إلكترونياً ملزماً للطرفين' },
    ],
  },
  'مرنة': {
    icon: '🔄',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    items: [
     { icon: '⚖️', text: 'الموافقة على هذه الشروط تعد إقراراً كاملاً بالالتزام بها' },
  { icon: '🎯', text: 'نطاق الخدمة يشمل الدعم الإداري والاستشاري المتفق عليه فقط' },
  { icon: '🤝', text: 'تتعهد الجهة بتقديم كافة البيانات المطلوبة والتعاون للتنفيذ' },
  { icon: '💰', text: 'يتم الالتزام بالمواعيد المالية المتفق عليها قبل استلام المخرجات' },
  { icon: '⏳', text: 'مدة التنفيذ مرتبطة بسرعة استجابة الجهة وتزويدنا بالبيانات' },
  { icon: '🔒', text: 'نلتزم بسرية تامة لجميع بيانات ومعلومات الجهة المشاركة' },
  { icon: '🚫', text: 'إخلاء مسؤولية: الخدمة استشارية ولا تضمن قبول المنح أو التمويل' },
  { icon: '🔄', text: 'يحق لمقدم الخدمة تحديث الشروط لضمان جودة العمل' },
  { icon: '📩', text: 'الضغط على موافقة يعد توقيعاً إلكترونياً ملزماً للطرفين' },
    ],
  },
};



// ============================================
// 🔧 اكتب هنا البنود لكل خدمة على حدة
// ============================================

const SERVICE_ITEMS: Record<string, PackageItem[]> = {
  'بناء الخطط الاستراتيجية والتشغيلية': [
    { icon: '🎯', text: 'تحليل الوضع الراهن للجمعية' },
    { icon: '📊', text: 'صياغة الرؤية والرسالة' },
    { icon: '🗺️', text: 'وضع الأهداف الاستراتيجية' },
    { icon: '📋', text: 'خطة تشغيلية سنوية' },
    { icon: '📈', text: 'مؤشرات الأداء الرئيسية KPI' },
  ],
  'تجهيز ملف الحوكمة': [
    { icon: '📁', text: 'اللوائح الأساسية والتنظيمية' },
    { icon: '⚖️', text: 'سياسات الحوكمة والإدارة' },
    { icon: '🔍', text: 'إجراءات العمل الداخلية' },
    { icon: '📜', text: 'هيكل التنظيم الإداري' },
    { icon: '✅', text: 'نماذج الموافقات والتفويضات' },
  ],
  'جاهزية صندوق دعم الجمعيات': [
    { icon: '📄', text: 'تجهيز ملف الترشيح' },
    { icon: '📊', text: 'تدقيق المتطلبات المالية' },
    { icon: '📋', text: 'إعداد التقارير المطلوبة' },
    { icon: '🎯', text: 'متابعة الطلب حتى الاعتماد' },
  ],
  'تصميم المشاريع التنموية': [
    { icon: '💡', text: 'دراسة الاحتياج المجتمعي' },
    { icon: '📐', text: 'تصميم منطق المشروع' },
    { icon: '🎯', text: 'تحديد الأهداف والمخرجات' },
    { icon: '💰', text: 'إعداد الميزانية التفصيلية' },
    { icon: '📈', text: 'مؤشرات قياس النجاح' },
  ],
  'تقديم ورفع المشاريع للمانحين': [
    { icon: '🔍', text: 'دراسة متطلبات المانح' },
    { icon: '✍️', text: 'صياغة العرض الفني' },
    { icon: '💵', text: 'إعداد العرض المالي' },
    { icon: '📤', text: 'رفع الطلب على المنصة' },
    { icon: '📞', text: 'متابعة الطلب حتى القرار' },
  ],
  'تأسيس الجمعيات والمؤسسات الأهلية': [
    { icon: '📝', text: 'إعداد اللائحة الأساسية' },
    { icon: '🏛️', text: 'إجراءات الترخيص' },
    { icon: '📋', text: 'تجهيز ملف التأسيس' },
    { icon: '⚖️', text: 'الإجراءات القانونية' },
    { icon: '🎉', text: 'استلام الترخيص النهائي' },
  ],
  'التسجيل والرفع في منصة إحسان': [
    { icon: '🔐', text: 'فتح حساب في المنصة' },
    { icon: '📄', text: 'رفع المستندات المطلوبة' },
    { icon: '✅', text: 'التأكد من اكتمال البيانات' },
    { icon: '🚀', text: 'نشر المشاريع على المنصة' },
  ],
  'بناء فرق العمل المؤسسي': [
    { icon: '👥', text: 'تصميم الهيكل التنظيمي' },
    { icon: '📋', text: 'تحديد الوظائف والمسؤوليات' },
    { icon: '🎯', text: 'وصف الوظائف' },
    { icon: '📊', text: 'نظام التقييم الأداء' },
  ],
  'الاستشارات الإدارية والفنية': [
    { icon: '💬', text: 'استشارات مباشرة' },
    { icon: '🔧', text: 'حل المشكلات التشغيلية' },
    { icon: '📈', text: 'تطوير الأداء المؤسسي' },
    { icon: '📋', text: 'تقارير توصيات فنية' },
  ],
  'مراجعة القوائم المالية': [
    { icon: '📊', text: 'مراجعة الدخل والمصروفات' },
    { icon: '💰', text: 'التأكد من التوازن المالي' },
    { icon: '📋', text: 'إعداد التقارير المالية' },
    { icon: '✅', text: 'الجاهزية للتدقيق' },
  ],
};

// ============================================
// 🔧 اكتب هنا البنود لكل منتج (غير عون)
// ============================================

const PRODUCT_ITEMS: Record<string, PackageItem[]> = {
  'بكج المساعدة الإدارية': [
    { icon: '📅', text: 'مدة الاشتراك 12 شهرًا تبدأ من تاريخ التفعيل' },
  { icon: '💳', text: 'يتم دفع الرسوم بشكل شهري أو سنوي حسب الباقة المختارة' },
  { icon: '✅', text: 'يلتزم مقدم الخدمة بتقديم الخدمات المتفق عليها ضمن حدود البكج' },
  { icon: '⚠️', text: 'لا تشمل الباقة أي خدمات إضافية خارج النطاق إلا برسوم مستقلة' },
  { icon: '🤝', text: 'يلتزم العميل بتوفير المعلومات والمستندات المطلوبة في الوقت المحدد' },
  { icon: '🚫', text: 'في حال التأخر بالسداد، يحق للمزود إيقاف الخدمة مؤقتًا حتى السداد' },
  { icon: '💰', text: 'الرسوم المدفوعة غير مستردة بعد بدء الاشتراك' },
  { icon: '📜', text: 'لا يحق إلغاء العقد قبل انتهاء المدة، وفي حال الإلغاء يتم دفع المتبقي' },
  { icon: '🔒', text: 'نلتزم بالحفاظ على سرية جميع بيانات العميل' },
  { icon: '📩', text: 'عند الاشتراك، يقر العميل بموافقته على جميع الشروط والأحكام' },
  ],
  'منتج الجهات المانحة': [
    { icon: '📝', text: 'الخدمة تشمل إعداد وتقديم طلبات المنح ومتابعتها حسب الاتفاق' },
  { icon: '🚫', text: 'لا يضمن مقدم الخدمة الحصول على المنحة، حيث يعتمد القبول على الجهة المانحة' },
  { icon: '🤝', text: 'يلتزم العميل بتوفير معلومات ومستندات صحيحة ومحدثة' },
  { icon: '⏳', text: 'أي تأخير ناتج عن نقص البيانات أو تأخر العميل يتحمله العميل' },
  { icon: '💰', text: 'الرسوم المتفق عليها غير مستردة بعد بدء تنفيذ الخدمة' },
  { icon: '🔒', text: 'يلتزم مقدم الخدمة بالحفاظ على سرية بيانات العميل' },
  { icon: '⚠️', text: 'يحق للمزود إيقاف الخدمة في حال عدم تعاون العميل أو تقديم معلومات غير دقيقة' },
  { icon: '🏛️', text: 'لا يتحمل مقدم الخدمة مسؤولية رفض الطلب من الجهات المانحة' },
  { icon: '📩', text: 'عند طلب الخدمة، يعتبر العميل موافقًا على جميع الشروط والأحكام' },
  ],
  'منتج المنسق المؤسسي للمانحين': [
    { icon: '📊', text: 'دراسة المشاريع المتقدمة' },
    { icon: '👁️', text: 'متابعة التنفيذ الميداني' },
    { icon: '📋', text: 'تقارير دورية احترافية' },
    { icon: '👨‍💼', text: 'فريق متخصص بخبرة +10 سنوات' },
  ],
  'برنامج تأهيل برو': [
    { icon: '🎯', text: 'تهدف الخدمة إلى تأهيل مشاريعك وفق معايير صندوق دعم الجمعيات للمنافسة' },
  { icon: '🤝', text: 'يعتمد نجاح التأهيل على التزامك بتوفير البيانات وتنفيذ التوصيات' },
  { icon: '🚫', text: 'لا يضمن الصندوق قبول المشروع، والرسوم غير مستردة بعد بدء التنفيذ' },
  { icon: '📩', text: 'بالنقر على "أوافق"، أقر بموافقتي على جميع الشروط والأحكام' },
  ],
};

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
  serviceDescription: string;
  contractUrl: string;
  notes: string;
  file: File | null;
  packageType?: string;
}

export function ServiceRequestModal({
  isOpen,
  serviceName,
  onClose,
  onSubmit,
  userId,
  isProduct = false,
  productType,
}: ServiceRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [service, setService] = useState<ServiceData | null>(null);
  const [notes, setNotes] = useState('');
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isAwnProduct = isProduct && productType === 'عون';

  useEffect(() => {
    const fetchServiceData = async () => {
      if (!isOpen || !serviceName) return;

      // services table columns: service_id, service_name, service_description, category, icon, is_active, created_at
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
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
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

  const handlePackageSelect = (packageName: string) => {
    setSelectedPackage(packageName);
    setIsDropdownOpen(false);
    setAgreedToTerms(false); // إعادة تعيين الموافقة عند تغيير الباقة
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // شرطك الحالي (ممتاز لمنع الإرسال بالخطأ)
    if (!agreedToTerms) {
      alert('يرجى الموافقة على البنود أولاً');
      return;
    }

    setLoading(true);

    try {
      await onSubmit({
        serviceName,
        serviceDescription: service?.description || '',
        contractUrl: service?.contract_pdf_url || '',
        notes,
        file: null,
        packageType: isAwnProduct ? selectedPackage : undefined,
        
        // إرسال التوثيق للداتا بيز
        terms_accepted: true, 
        terms_version: "1.0", 
        accepted_at: new Date().toISOString(), 
      });

      // ... باقي الكود (مسح الحقول وإغلاق النافذة)
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setLoading(false);
    }
};

  // الحصول على البنود المناسبة
  const getCurrentItems = (): PackageItem[] => {
    if (isAwnProduct && selectedPackage) {
      return PRODUCT_AWN_PACKAGES[selectedPackage]?.items || [];
    }
    if (isProduct) {
      return PRODUCT_ITEMS[serviceName] || [];
    }
    return SERVICE_ITEMS[serviceName] || [];
  };

  const getSelectedPackageInfo = (): PackageDetails | null => {
    if (isAwnProduct && selectedPackage) {
      return PRODUCT_AWN_PACKAGES[selectedPackage] || null;
    }
    return null;
  };

  const currentItems = getCurrentItems();
  const selectedPackageInfo = getSelectedPackageInfo();

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay active"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'linear-gradient(135deg, #fff, #ecfeff)',
          border: '1px solid rgba(6,182,212,0.3)',
          borderRadius: '24px',
          padding: '40px',
          width: '90%',
          maxWidth: '720px',
          margin: 'auto',
          boxShadow: '0 25px 80px rgba(6,182,212,0.3)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '18px',
            left: '18px',
            background: 'rgba(6,182,212,0.1)',
            border: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '16px',
            color: '#0891b2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: '.3s',
          }}
        >
          <i className="fas fa-times"></i>
        </button>

        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div
            style={{
              width: '65px',
              height: '65px',
              background: 'linear-gradient(135deg, #0891b2, #06b6d4)',
              borderRadius: '50%',
              margin: '0 auto 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '26px',
              boxShadow: '0 10px 30px rgba(6,182,212,0.3)',
            }}
          >
            <i className="fas fa-file-signature"></i>
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a' }}>
            طلب {isProduct ? 'منتج' : 'خدمة'}
          </h3>
          <p style={{ color: '#475569', fontSize: '13px', marginTop: '5px' }}>{serviceName}</p>
        </div>

        {service && (
          <div
            style={{
              background: 'rgba(6,182,212,0.07)',
              border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: '14px',
              padding: '18px 20px',
              marginBottom: '22px',
            }}
          >
            <div
              style={{ fontSize: '15px', fontWeight: '800', color: '#0891b2', marginBottom: '6px' }}
            >
              {serviceName}
            </div>
            <div style={{ fontSize: '13px', color: '#475569', lineHeight: '1.7' }}>
              {service.description}
            </div>
          </div>
        )}

        {/* قائمة الباقات - تظهر فقط لمنتج عون */}
        {isAwnProduct && (
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                fontSize: '13px',
                fontWeight: '800',
                color: '#0f172a',
                display: 'block',
                marginBottom: '10px',
              }}
            >
              <i className="fas fa-gem" style={{ color: '#0891b2', marginLeft: '6px' }}></i>
              اختر الباقة <span style={{ color: '#ef4444' }}>*</span>
            </label>

            <div ref={dropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  background: selectedPackageInfo 
                    ? selectedPackageInfo.gradient 
                    : '#f8fafc',
                  border: selectedPackageInfo ? 'none' : '2px dashed rgba(6,182,212,0.4)',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s ease',
                  boxShadow: selectedPackageInfo ? '0 4px 20px ' + (selectedPackageInfo.color + '40') : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {selectedPackageInfo ? (
                    <>
                      <span style={{ fontSize: '24px' }}>{selectedPackageInfo.icon}</span>
                      <span style={{ 
                        fontWeight: '800', 
                        fontSize: '15px',
                        color: '#fff',
                        fontFamily: "'Tajawal', sans-serif",
                      }}>
                        باقة {selectedPackage}
                      </span>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-chevron-down" style={{ color: '#0891b2', fontSize: '14px' }}></i>
                      <span style={{ 
                        color: '#64748b', 
                        fontSize: '14px',
                        fontFamily: "'Tajawal', sans-serif",
                      }}>
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
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    borderRadius: '16px',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                    zIndex: 100,
                    overflow: 'hidden',
                    border: '1px solid rgba(6,182,212,0.2)',
                    animation: 'dropdownSlide 0.3s ease',
                  }}
                >
                  {Object.entries(PRODUCT_AWN_PACKAGES).map(([name, details]) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handlePackageSelect(name)}
                      style={{
                        width: '100%',
                        padding: '16px 20px',
                        border: 'none',
                        background: selectedPackage === name ? 'rgba(6,182,212,0.08)' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        transition: 'all 0.2s ease',
                        borderBottom: '1px solid rgba(226,232,240,0.5)',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedPackage !== name) {
                          e.currentTarget.style.background = 'rgba(6,182,212,0.04)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedPackage !== name) {
                          e.currentTarget.style.background = '#fff';
                        }
                      }}
                    >
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '12px',
                          background: details.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          flexShrink: 0,
                          boxShadow: '0 4px 12px ' + details.color + '40',
                        }}
                      >
                        {details.icon}
                      </div>
                      <div style={{ textAlign: 'right', flex: 1 }}>
                        <div
                          style={{
                            fontWeight: '800',
                            fontSize: '14px',
                            color: '#0f172a',
                            marginBottom: '2px',
                            fontFamily: "'Tajawal', sans-serif",
                          }}
                        >
                          باقة {name}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {details.items.length} بنود متضمنة
                        </div>
                      </div>
                      {selectedPackage === name && (
                        <i className="fas fa-check-circle" style={{ color: details.color, fontSize: '20px' }}></i>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* عرض البنود */}
        {currentItems.length > 0 && (
          <div
            style={{
              marginBottom: '24px',
              padding: '24px',
              background: selectedPackageInfo 
                ? 'rgba(255,255,255,0.6)' 
                : 'rgba(6,182,212,0.05)',
              borderRadius: '16px',
              border: selectedPackageInfo 
                ? '2px solid ' + selectedPackageInfo.color + '30' 
                : '1px solid rgba(6,182,212,0.15)',
              animation: 'fadeIn 0.4s ease',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '18px',
                paddingBottom: '14px',
                borderBottom: selectedPackageInfo 
                  ? '1px dashed ' + selectedPackageInfo.color + '40' 
                  : '1px solid rgba(6,182,212,0.2)',
              }}
            >
              {selectedPackageInfo ? (
                <span style={{ fontSize: '24px' }}>{selectedPackageInfo.icon}</span>
              ) : (
                <i className="fas fa-list-check" style={{ color: '#0891b2', fontSize: '20px' }}></i>
              )}
              <span
                style={{
                  fontWeight: '900',
                  fontSize: '16px',
                  color: selectedPackageInfo ? selectedPackageInfo.color : '#0f172a',
                  fontFamily: "'Tajawal', sans-serif",
                }}
              >
                {isAwnProduct && selectedPackage 
                  ? `بنود باقة ${selectedPackage}` 
                  : `بنود ${serviceName}`}
              </span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {currentItems.map((item, idx) => (
                <li
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 0',
                    fontSize: '14px',
                    color: '#334155',
                    fontFamily: "'Tajawal', sans-serif",
                    borderBottom: idx < currentItems.length - 1 ? '1px solid rgba(226,232,240,0.5)' : 'none',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <span>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ملاحظات إضافية */}
        <div style={{ marginBottom: '24px' }}>
          <label
            style={{
              fontSize: '13px',
              fontWeight: '800',
              color: '#0f172a',
              display: 'block',
              marginBottom: '8px',
            }}
          >
            <i className="fas fa-comment-dots" style={{ color: '#0891b2', marginLeft: '6px' }}></i>{' '}
            ملاحظات إضافية (اختياري)
          </label>
          <textarea
            id="srNotes"
            rows={3}
            placeholder="أي تفاصيل أو استفسارات..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{
              width: '100%',
              padding: '14px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: '12px',
              fontFamily: "'Tajawal', sans-serif",
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.3s',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = '#0891b2'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
          />
        </div>

        {/* Checkbox الموافقة على البنود */}
        <div
          style={{
            marginBottom: '24px',
            padding: '18px 20px',
            background: agreedToTerms ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.05)',
            borderRadius: '14px',
            border: agreedToTerms ? '2px solid #10b981' : '2px solid #ef4444',
            transition: 'all 0.3s ease',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              cursor: 'pointer',
              fontFamily: "'Tajawal', sans-serif",
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '26px',
                height: '26px',
                flexShrink: 0,
              }}
            >
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                style={{
                  position: 'absolute',
                  opacity: 0,
                  width: '100%',
                  height: '100%',
                  cursor: 'pointer',
                  zIndex: 1,
                }}
              />
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '6px',
                  border: agreedToTerms ? '2px solid #10b981' : '2px solid #cbd5e1',
                  background: agreedToTerms ? '#10b981' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                {agreedToTerms && (
                  <i className="fas fa-check" style={{ color: '#fff', fontSize: '14px' }}></i>
                )}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <span
                style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: agreedToTerms ? '#059669' : '#dc2626',
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                {agreedToTerms ? '✓ تمت الموافقة على البنود' : '⚠️ يرجى الموافقة على البنود'}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                أقر بأنني قرأت جميع البنود المتضمنة في {isAwnProduct ? 'الباقة المختارة' : 'هذه الخدمة'} وأوافق عليها
              </span>
            </div>
          </label>
        </div>

        {/* زر الإرسال */}
        <form onSubmit={handleSubmit}>
          <button
            type="submit"
            disabled={loading || !agreedToTerms || (isAwnProduct && !selectedPackage)}
            style={{
              width: '100%',
              padding: '18px',
              background: selectedPackageInfo 
                ? selectedPackageInfo.gradient 
                : 'linear-gradient(135deg, #0891b2, #06b6d4)',
              color: '#fff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '17px',
              fontWeight: '800',
              cursor: (loading || !agreedToTerms || (isAwnProduct && !selectedPackage)) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: selectedPackageInfo 
                ? '0 8px 25px ' + selectedPackageInfo.color + '50'
                : '0 8px 25px rgba(6,182,212,0.35)',
              fontFamily: "'Tajawal', sans-serif",
              opacity: (loading || !agreedToTerms || (isAwnProduct && !selectedPackage)) ? 0.6 : 1,
              transition: 'all 0.3s ease',
            }}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i> جاري معالجة الطلب...
              </>
            ) : (
              <>
                <i className="fas fa-paper-plane"></i> 
                {isAwnProduct && selectedPackage 
                  ? `تأكيد طلب باقة ${selectedPackage}` 
                  : 'تأكيد الطلب'}
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '16px' }}>
            <i className="fas fa-info-circle"></i> سيتم مراجعة طلبك من قِبل الإدارة قبل التفعيل
          </p>
        </form>

        <style>{`
          @keyframes dropdownSlide {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
}