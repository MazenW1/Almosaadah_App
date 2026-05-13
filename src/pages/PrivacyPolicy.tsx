// pages/PrivacyPolicy.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';

export default function PrivacyPolicy() {
  const { isDarkMode: dm } = useDarkMode();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'سياسة الخصوصية — المساعدة الإدارية';
  }, []);

  const bg    = dm ? '#0b1120' : '#f0f4f8';
  const card  = dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
  const txt1  = dm ? '#f1f5f9' : '#0f172a';
  const txt2  = dm ? '#94a3b8' : '#475569';
  const bdr   = dm ? 'rgba(8,145,178,0.15)' : 'rgba(8,145,178,0.1)';
  const acc   = '#0891b2';

  const sections = [
    {
      icon: 'fa-info-circle',
      title: 'مقدمة',
      body: `تلتزم مؤسسة المساعدة الإدارية ("نحن"، "المؤسسة") بحماية خصوصيتك وبياناتك الشخصية. تصف هذه السياسة كيفية جمع معلوماتك واستخدامها وحمايتها عند استخدامك لموقعنا الإلكتروني almosaadah.sa وخدماتنا المرتبطة به، بما في ذلك خدمة التواصل عبر واتساب.`,
    },
    {
      icon: 'fa-database',
      title: 'البيانات التي نجمعها',
      body: `نجمع المعلومات التالية عند استخدامك لخدماتنا:\n\n• **بيانات الحساب:** الاسم، البريد الإلكتروني، رقم الجوال، نوع المنشأة.\n• **بيانات التواصل:** رسائل واتساب الواردة والصادرة، الوسائط المرسلة، تاريخ ووقت الرسائل.\n• **بيانات الاستخدام:** سجلات الدخول، الصفحات المزارة، الجهاز والمتصفح المستخدم.\n• **البيانات التقنية:** عنوان IP، نوع المتصفح، اللغة المفضلة.`,
    },
    {
      icon: 'fa-cogs',
      title: 'كيف نستخدم بياناتك',
      body: `نستخدم بياناتك للأغراض التالية:\n\n• تقديم خدماتنا الإدارية والاستشارية.\n• التواصل معك عبر واتساب والرد على استفساراتك.\n• إرسال رسائل إعلامية وترويجية (بموافقتك).\n• تحسين جودة خدماتنا وتطوير المنصة.\n• الامتثال للمتطلبات القانونية والتنظيمية في المملكة العربية السعودية.`,
    },
    {
      icon: 'fa-share-alt',
      title: 'مشاركة البيانات مع أطراف ثالثة',
      body: `لا نبيع بياناتك الشخصية لأي طرف ثالث. قد نشارك بياناتك في الحالات التالية:\n\n• **Meta Platforms (واتساب):** لتشغيل خدمة التواصل عبر واتساب وفق سياسة خصوصية Meta.\n• **Supabase:** لتخزين البيانات بشكل آمن على خوادم مشفرة.\n• **الجهات الحكومية:** عند الطلب القانوني الرسمي من الجهات المختصة في المملكة.\n• **الشركاء الخدميين:** فقط بالقدر الضروري لتقديم الخدمة مع التزامهم بالسرية.`,
    },
    {
      icon: 'fa-shield-alt',
      title: 'حماية البيانات',
      body: `نطبق معايير أمنية عالية لحماية بياناتك:\n\n• تشفير البيانات الحساسة (API Keys وبيانات المصادقة) بخوارزمية AES-GCM.\n• حماية قاعدة البيانات بـ Row Level Security (RLS).\n• استخدام اتصالات HTTPS المشفرة.\n• تقييد الوصول للبيانات على الموظفين المصرح لهم فقط.\n• مراجعة دورية لسياسات الأمان.`,
    },
    {
      icon: 'fa-clock',
      title: 'مدة الاحتفاظ بالبيانات',
      body: `نحتفظ ببياناتك طوال فترة تعاملك معنا وبعدها لمدة لا تتجاوز 3 سنوات للأغراض القانونية والمحاسبية. يمكنك طلب حذف بياناتك في أي وقت عبر التواصل معنا مباشرة.`,
    },
    {
      icon: 'fa-user-check',
      title: 'حقوقك',
      body: `وفق نظام حماية البيانات الشخصية السعودي (PDPL) يحق لك:\n\n• **الاطلاع:** معرفة البيانات التي نحتفظ بها عنك.\n• **التصحيح:** طلب تصحيح أي بيانات غير دقيقة.\n• **الحذف:** طلب حذف بياناتك ("الحق في النسيان").\n• **الاعتراض:** رفض استخدام بياناتك لأغراض التسويق.\n• **النقل:** الحصول على نسخة من بياناتك بصيغة قابلة للقراءة.`,
    },
    {
      icon: 'fa-cookie',
      title: 'ملفات تعريف الارتباط (Cookies)',
      body: `يستخدم موقعنا ملفات تعريف الارتباط للأغراض التالية:\n\n• **الضرورية:** للحفاظ على جلسة تسجيل الدخول وإعدادات الموقع.\n• **التحليلية:** لفهم كيفية استخدام الزوار للموقع وتحسين تجربتهم.\n\nيمكنك ضبط متصفحك لرفض ملفات الارتباط، لكن ذلك قد يؤثر على بعض وظائف الموقع.`,
    },
    {
      icon: 'fa-globe',
      title: 'نقل البيانات خارج المملكة',
      body: `بعض بياناتك قد تُخزن أو تُعالج خارج المملكة العربية السعودية (مثل خوادم Supabase وMeta). نضمن أن هذه النقلات تتم وفق ضمانات أمنية مناسبة وبما يتوافق مع نظام PDPL السعودي.`,
    },
    {
      icon: 'fa-child',
      title: 'خصوصية الأطفال',
      body: `خدماتنا موجهة للمنشآت والجمعيات الأهلية ولا تستهدف من هم دون سن 18 عاماً. إذا علمنا بجمع بيانات شخص دون هذا السن بدون موافقة ولي الأمر، سنحذفها فوراً.`,
    },
    {
      icon: 'fa-sync',
      title: 'تحديث السياسة',
      body: `قد نحدّث هذه السياسة بين الحين والآخر. سنخطرك بأي تغييرات جوهرية عبر البريد الإلكتروني أو إشعار في الموقع. آخر تحديث: مايو 2026.`,
    },
    {
      icon: 'fa-envelope',
      title: 'تواصل معنا',
      body: `لأي استفسار أو طلب بخصوص بياناتك الشخصية:\n\n• **البريد الإلكتروني:** info@almosaadah.sa\n• **الموقع:** almosaadah.sa\n• **العنوان:** الطائف، المملكة العربية السعودية`,
    },
  ];

  return (
    <div style={{ minHeight: '100dvh', background: bg, fontFamily: "'Tajawal', sans-serif", direction: 'rtl' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        padding: '120px 24px 60px',
        background: dm
          ? 'linear-gradient(135deg, rgba(8,145,178,0.12) 0%, rgba(7,15,30,0) 60%)'
          : 'linear-gradient(135deg, rgba(8,145,178,0.08) 0%, rgba(240,244,248,0) 60%)',
        borderBottom: `1px solid ${bdr}`,
        animation: 'fadeUp 0.6s ease both',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: acc, fontSize: 13, fontWeight: 700, textDecoration: 'none', marginBottom: 24, opacity: 0.85 }}>
            <i className="fas fa-arrow-right" />
            العودة للرئيسية
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${acc}, #0e7490)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 8px 24px rgba(8,145,178,0.3)` }}>
              <i className="fas fa-shield-alt" style={{ fontSize: 22, color: '#fff' }} />
            </div>
            <div>
              <h1 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 900, color: txt1, margin: 0, lineHeight: 1.2 }}>
                سياسة الخصوصية
              </h1>
              <div style={{ fontSize: 13, color: txt2, marginTop: 4 }}>
                المساعدة الإدارية — آخر تحديث: مايو 2026
              </div>
            </div>
          </div>

          <div style={{ background: dm ? 'rgba(8,145,178,0.1)' : 'rgba(8,145,178,0.06)', border: `1px solid rgba(8,145,178,0.25)`, borderRadius: 14, padding: '14px 18px', fontSize: 13, color: dm ? '#7dd3fc' : '#0e7490', lineHeight: 1.7 }}>
            <i className="fas fa-info-circle" style={{ marginLeft: 8 }} />
            هذه السياسة مطبقة على جميع خدمات مؤسسة المساعدة الإدارية بما فيها خدمة التواصل عبر واتساب. باستخدامك لخدماتنا فأنت توافق على أحكام هذه السياسة.
          </div>
        </div>
      </div>

      {/* ── Sections ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px', animation: 'fadeUp 0.5s 0.1s ease both' }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            background: card, border: `1px solid ${bdr}`, borderRadius: 18,
            padding: '22px 24px', marginBottom: 16,
            boxShadow: dm ? '0 4px 24px rgba(0,0,0,0.2)' : '0 2px 12px rgba(8,145,178,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingBottom: 14, borderBottom: `1px solid ${bdr}` }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `rgba(8,145,178,0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className={`fas ${s.icon}`} style={{ color: acc, fontSize: 16 }} />
              </div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: txt1, margin: 0 }}>
                {i + 1}. {s.title}
              </h2>
            </div>
            <div style={{ fontSize: 14, color: txt2, lineHeight: 2, whiteSpace: 'pre-line' }}>
              {s.body.split('\n').map((line, j) => {
                if (line.startsWith('• **')) {
                  const match = line.match(/• \*\*(.+?)\*\*:?\s*(.*)/);
                  if (match) return (
                    <div key={j} style={{ marginBottom: 6 }}>
                      <span style={{ color: acc, fontWeight: 700 }}>• {match[1]}:</span>
                      <span> {match[2]}</span>
                    </div>
                  );
                }
                if (line.startsWith('• ')) return <div key={j} style={{ marginBottom: 4, paddingRight: 8 }}>{line}</div>;
                if (line === '') return <div key={j} style={{ height: 8 }} />;
                return <span key={j}>{line}</span>;
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', borderTop: `1px solid ${bdr}`, marginTop: 8 }}>
          <div style={{ fontSize: 13, color: txt2, marginBottom: 16 }}>
            © {new Date().getFullYear()} مؤسسة المساعدة الإدارية — جميع الحقوق محفوظة
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/" style={{ fontSize: 13, color: acc, textDecoration: 'none', fontWeight: 600 }}>الرئيسية</Link>
            <span style={{ color: txt2 }}>•</span>
            <Link to="/terms" style={{ fontSize: 13, color: acc, textDecoration: 'none', fontWeight: 600 }}>شروط الاستخدام</Link>
            <span style={{ color: txt2 }}>•</span>
            <a href="mailto:info@almosaadah.sa" style={{ fontSize: 13, color: acc, textDecoration: 'none', fontWeight: 600 }}>تواصل معنا</a>
          </div>
        </div>
      </div>
    </div>
  );
}