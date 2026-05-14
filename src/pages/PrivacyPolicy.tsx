// pages/PrivacyPolicy.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDarkMode } from '../hooks/useDarkMode';

export default function PrivacyPolicy() {
  const { isDarkMode: dm } = useDarkMode();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.title = 'الأحكام والشروط — المساعدة الإدارية';
  }, []);

  const bg = dm ? '#0b1120' : '#f0f4f8';
  const card = dm ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.98)';
  const txt1 = dm ? '#f1f5f9' : '#0f172a';
  const txt2 = dm ? '#94a3b8' : '#475569';
  const bdr = dm ? 'rgba(8,145,178,0.15)' : 'rgba(8,145,178,0.1)';
  const acc = '#0891b2';

  const sections = [
    {
      icon: 'fa-file-contract',
      title: 'الأحكام والشروط',
      body: `مرحبًا بكم في موقع المساعدة الادارية، المتخصص في تقديم الاستشارات الإدارية والفنية والخدمات التطويرية للجمعيات والمؤسسات غير الربحية.\n\nباستخدامكم لهذا الموقع أو طلب أي من خدماتنا، فإنكم توافقون على الأحكام والشروط التالية:\n\n• تُقدم الخدمات وفق نطاق العمل المتفق عليه مع العميل.\n• يلتزم العميل بتزويدنا بالمعلومات الصحيحة اللازمة لتنفيذ الخدمة.\n• جميع المحتويات والتصاميم والنماذج المعروضة في الموقع محفوظة الحقوق لـ المساعدة الادارية.\n• يحق لنا تعديل أو تحديث الخدمات والأسعار في أي وقت.\n• لا يحق إعادة استخدام أو نشر أي مخرجات أو ملفات دون موافقة خطية.\n• تلتزم المساعدة الادارية بالمحافظة على سرية معلومات العملاء وعدم مشاركتها مع أي طرف ثالث إلا وفق الأنظمة المعمول بها.\n• استخدام الموقع لأي غرض غير مشروع أو يضر بالموقع أو خدماته يعد مخالفة تستوجب اتخاذ الإجراءات المناسبة.\n• تخضع هذه الأحكام لأنظمة المملكة العربية السعودية.`,
    },

    {
      icon: 'fa-shield-alt',
      title: 'سياسة الخصوصية',
      body: `نحترم خصوصية عملائنا ونلتزم بحماية بياناتهم الشخصية.`,
    },

    {
      icon: 'fa-database',
      title: 'البيانات التي قد نجمعها',
      body: `• الاسم ووسائل التواصل.\n• بيانات الجهة أو الجمعية.\n• المعلومات المتعلقة بطلب الخدمة.`,
    },

    {
      icon: 'fa-cogs',
      title: 'استخدام البيانات',
      body: `تُستخدم المعلومات بهدف:\n\n• تقديم الخدمات المطلوبة.\n• التواصل مع العملاء.\n• تحسين جودة الخدمات وتجربة المستخدم.`,
    },

    {
      icon: 'fa-lock',
      title: 'حماية المعلومات',
      body: `نعمل على حماية البيانات ومنع الوصول غير المصرح به إليها، ولا نقوم ببيع أو مشاركة البيانات مع أي طرف ثالث إلا عند الحاجة النظامية أو بموافقة العميل.`,
    },

    {
      icon: 'fa-envelope',
      title: 'التواصل',
      body: `للاستفسارات المتعلقة بالخصوصية أو الخدمات يمكن التواصل عبر:\n\n• البريد الإلكتروني: [البريد الإلكتروني]\n• رقم التواصل: [رقم الهاتف]`,
    },

    {
      icon: 'fa-briefcase',
      title: 'سياسة الخدمات',
      body: `• يتم تنفيذ الخدمات بعد الاتفاق على نطاق العمل والتكلفة.\n• تختلف مدة التنفيذ بحسب نوع الخدمة.\n• يحق للعميل طلب التعديلات ضمن حدود الاتفاق.\n• لا يتم استرجاع المبالغ بعد بدء تنفيذ الخدمة إلا وفق ما يتم الاتفاق عليه.\n• تحتفظ المساعدة الادارية بحق الاعتذار عن أي طلب لا يتوافق مع سياساتها أو اختصاصها.`,
    },
  ];

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: bg,
        fontFamily: "'Tajawal', sans-serif",
        direction: 'rtl',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800;900&display=swap');

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        * {
          box-sizing: border-box;
        }
      `}</style>

      {/* Hero */}
      <div
        style={{
          padding: '120px 24px 60px',
          background: dm
            ? 'linear-gradient(135deg, rgba(8,145,178,0.12) 0%, rgba(7,15,30,0) 60%)'
            : 'linear-gradient(135deg, rgba(8,145,178,0.08) 0%, rgba(240,244,248,0) 60%)',
          borderBottom: `1px solid ${bdr}`,
          animation: 'fadeUp 0.6s ease both',
        }}
      >
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <Link
            to="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              color: acc,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: 'none',
              marginBottom: 24,
              opacity: 0.85,
            }}
          >
            <i className="fas fa-arrow-right" />
            العودة للرئيسية
          </Link>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${acc}, #0e7490)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: `0 8px 24px rgba(8,145,178,0.3)`,
              }}
            >
              <i
                className="fas fa-shield-alt"
                style={{ fontSize: 22, color: '#fff' }}
              />
            </div>

            <div>
              <h1
                style={{
                  fontSize: 'clamp(22px,4vw,34px)',
                  fontWeight: 900,
                  color: txt1,
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                الأحكام والشروط
              </h1>

              <div
                style={{
                  fontSize: 13,
                  color: txt2,
                  marginTop: 4,
                }}
              >
                المساعدة الإدارية — آخر تحديث: مايو 2026
              </div>
            </div>
          </div>

          <div
            style={{
              background: dm
                ? 'rgba(8,145,178,0.1)'
                : 'rgba(8,145,178,0.06)',
              border: `1px solid rgba(8,145,178,0.25)`,
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: 13,
              color: dm ? '#7dd3fc' : '#0e7490',
              lineHeight: 1.7,
            }}
          >
            <i
              className="fas fa-info-circle"
              style={{ marginLeft: 8 }}
            />
            باستخدامك لموقع وخدمات المساعدة الإدارية فإنك توافق على
            الأحكام والشروط وسياسة الخصوصية الموضحة في هذه الصفحة.
          </div>
        </div>
      </div>

      {/* Sections */}
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '40px 24px 80px',
          animation: 'fadeUp 0.5s 0.1s ease both',
        }}
      >
        {sections.map((s, i) => (
          <div
            key={i}
            style={{
              background: card,
              border: `1px solid ${bdr}`,
              borderRadius: 18,
              padding: '22px 24px',
              marginBottom: 16,
              boxShadow: dm
                ? '0 4px 24px rgba(0,0,0,0.2)'
                : '0 2px 12px rgba(8,145,178,0.06)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 14,
                paddingBottom: 14,
                borderBottom: `1px solid ${bdr}`,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `rgba(8,145,178,0.1)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <i
                  className={`fas ${s.icon}`}
                  style={{
                    color: acc,
                    fontSize: 16,
                  }}
                />
              </div>

              <h2
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: txt1,
                  margin: 0,
                }}
              >
                {i + 1}. {s.title}
              </h2>
            </div>

            <div
              style={{
                fontSize: 14,
                color: txt2,
                lineHeight: 2,
                whiteSpace: 'pre-line',
              }}
            >
              {s.body.split('\n').map((line, j) => {
                if (line.startsWith('• ')) {
                  return (
                    <div
                      key={j}
                      style={{
                        marginBottom: 6,
                        paddingRight: 8,
                      }}
                    >
                      {line}
                    </div>
                  );
                }

                if (line === '') {
                  return <div key={j} style={{ height: 8 }} />;
                }

                return <span key={j}>{line}</span>;
              })}
            </div>
          </div>
        ))}

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            borderTop: `1px solid ${bdr}`,
            marginTop: 8,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: txt2,
              marginBottom: 16,
            }}
          >
            © {new Date().getFullYear()} مؤسسة المساعدة الإدارية — جميع
            الحقوق محفوظة
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <Link
              to="/"
              style={{
                fontSize: 13,
                color: acc,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              الرئيسية
            </Link>

            <span style={{ color: txt2 }}>•</span>

            <a
              href="/#contact"
              style={{
                fontSize: 13,
                color: acc,
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              تواصل معنا
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}