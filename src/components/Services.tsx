interface Service {
  icon: string;
  title: string;
  description: string;
}

interface ServicesProps {
  onServiceSelect: (serviceName: string, serviceType?: string) => void; // ← تعديل: إضافة serviceType
}

export function Services({ onServiceSelect }: ServicesProps) {
  const services: Service[] = [
    {
      icon: 'fa-chart-line',
      title: 'بناء الخطط الاستراتيجية والتشغيلية',
      description: 'نحوّل رؤيتك إلى خطة واضحة بأهداف ومؤشرات قابلة للقياس… وخارطة طريق تقودك للنتائج لا للاجتماعات.',
    },
    {
      icon: 'fa-file-contract',
      title: 'تجهيز ملف الحوكمة',
      description: 'نرفع مستوى الامتثال والشفافية لديك حتى تصبح جهة موثوقة أمام المانحين والجهات الرقابية.',
    },
    {
      icon: 'fa-hand-holding-usd',
      title: 'جاهزية صندوق دعم الجمعيات',
      description: 'نغلق منحك باحتراف… ونجهزك للتقديم بثقة، من التقارير إلى قياس النتائج حتى الاعتماد.',
    },
    {
      icon: 'fa-project-diagram',
      title: 'تصميم المشاريع التنموية',
      description: 'نبني مشاريع ذات أثر حقيقي، قائمة على احتياج مجتمعي، بهيكل احترافي يقنع المانحين ويمكّنك من التمويل.',
    },
    {
      icon: 'fa-handshake',
      title: 'تقديم ورفع المشاريع للمانحين',
      description: 'نصيغ… نراجع… نرفع… ونتابع حتى صدور القرار. مشروعك يصل للجهة المانحة بأفضل صورة ممكنة.',
    },
    {
      icon: 'fa-building',
      title: 'تأسيس الجمعيات والمؤسسات الأهلية',
      description: 'من الفكرة إلى الترخيص… نبني كيانك النظامي على أسس صحيحة تضمن الاستدامة.',
    },
    {
      icon: 'fa-donate',
      title: 'التسجيل والرفع في منصة إحسان',
      description: 'نهيئ جهتك ونرفع مشاريعك باحتراف لتصل للمتبرعين وتضاعف فرص الدعم.',
    },
    {
      icon: 'fa-users',
      title: 'بناء فرق العمل المؤسسي',
      description: 'نصنع فريقًا يعرف دوره… يعمل بكفاءة… ويحقق المستهدف.',
    },
    {
      icon: 'fa-user-tie',
      title: 'الاستشارات الإدارية والفنية',
      description: 'حلول عملية للتحديات الإدارية والمالية والتشغيلية… قرارات مبنية على خبرة لا اجتهاد.',
    },
    {
      icon: 'fa-calculator',
      title: 'مراجعة القوائم المالية',
      description: 'نراجع وننظم قوائمك المالية لتكون جاهزة لأي تدقيق أو رفع أو تقديم.',
    },
  ];

  return (
    <>
      <style>{`
        .services-section-v2 {
          padding: 100px 24px;
          direction: rtl;
          position: relative;
        }

        .services-section-v2 .section-header-v2 {
          text-align: center;
          margin-bottom: 64px;
        }
        .section-header-v2 h2 {
          font-family: 'Tajawal', sans-serif;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 900;
          background: linear-gradient(135deg, #0c4a6e, #0ea5e9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
        }
        .section-header-v2 p {
          font-family: 'Tajawal', sans-serif;
          font-size: 1.1rem;
          color: #64748b;
          font-weight: 500;
        }

        .services-grid-v2 {
          max-width: 1300px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }

        @keyframes card-rise {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes icon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(14,165,233,0.25); }
          50% { box-shadow: 0 0 0 10px rgba(14,165,233,0); }
        }
        @keyframes shimmer-sweep {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }

        .service-card-v2 {
          position: relative;
          background: rgba(255, 255, 255, 0.88);
          border: 1px solid rgba(14, 165, 233, 0.12);
          border-radius: 22px;
          padding: 32px 28px 28px;
          cursor: pointer;
          overflow: hidden;
          backdrop-filter: blur(16px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 16px rgba(14, 165, 233, 0.06);
          text-align: right;
        }

        .service-card-v2::before {
          content: '';
          position: absolute;
          top: 0;
          left: 20%;
          right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #0ea5e9, transparent);
          opacity: 0;
          transition: opacity 0.3s, left 0.3s, right 0.3s;
        }

        .service-card-v2::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 60%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,0.15),
            transparent
          );
          transform: translateX(100%);
          transition: none;
        }

        .service-card-v2:hover {
          transform: translateY(-10px) scale(1.02);
          border-color: rgba(14, 165, 233, 0.35);
          box-shadow:
            0 24px 56px rgba(14, 165, 233, 0.18),
            0 4px 16px rgba(0,0,0,0.05);
          background: rgba(255, 255, 255, 0.97);
        }
        .service-card-v2:hover::before { opacity: 1; left: 0; right: 0; }
        .service-card-v2:hover::after {
          animation: shimmer-sweep 0.6s ease;
        }

        .service-card-v2:focus-visible {
          outline: 2px solid #0ea5e9;
          outline-offset: 3px;
        }

        .sv2-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          background: rgba(14, 165, 233, 0.08);
          border: 1.5px solid rgba(14, 165, 233, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          color: #0284c7;
          margin-bottom: 20px;
          transition: all 0.3s ease;
          position: relative;
        }
        .service-card-v2:hover .sv2-icon {
          background: linear-gradient(135deg, rgba(14,165,233,0.15), rgba(56,189,248,0.1));
          border-color: rgba(14, 165, 233, 0.4);
          transform: rotate(-5deg) scale(1.1);
          color: #0ea5e9;
          animation: icon-pulse 1.5s ease infinite;
        }

        .sv2-title {
          font-family: 'Tajawal', sans-serif;
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 10px;
          line-height: 1.4;
          transition: color 0.3s;
        }
        .service-card-v2:hover .sv2-title { color: #0284c7; }

        .sv2-desc {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.88rem;
          color: #64748b;
          line-height: 1.75;
          font-weight: 400;
        }

        .sv2-cta {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid rgba(14, 165, 233, 0.1);
          font-family: 'Tajawal', sans-serif;
          font-size: 0.83rem;
          font-weight: 800;
          color: #0284c7;
          opacity: 0;
          transform: translateY(5px);
          transition: all 0.3s ease;
        }
        .service-card-v2:hover .sv2-cta {
          opacity: 1;
          transform: translateY(0);
        }
        .sv2-cta i {
          transition: transform 0.3s ease;
        }
        .service-card-v2:hover .sv2-cta i {
          transform: translateX(-4px);
        }

        .sv2-number {
          position: absolute;
          top: 18px;
          left: 18px;
          font-family: 'Courier New', monospace;
          font-size: 0.65rem;
          font-weight: 700;
          color: rgba(14, 165, 233, 0.3);
          letter-spacing: 0.05em;
        }
      `}</style>

      <section className="services-section-v2" id="services" aria-labelledby="servicesTitle">
        <div className="section-header-v2" data-aos="fade-up">
          <h2 id="servicesTitle">خدماتنا</h2>
          <p>نمنح كيانك الجاهزية.. ليحصد التمكين</p>
        </div>

        <div className="services-grid-v2" role="list">
          {services.map((service, index) => (
            <article
              key={index}
              className="service-card-v2"
              onClick={() => onServiceSelect(service.title, 'service')} // ← تعديل هنا: إضافة 'service'
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onServiceSelect(service.title, 'service'); // ← تعديل هنا: إضافة 'service'
                }
              }}
              role="listitem"
              tabIndex={0}
              aria-label={`طلب خدمة: ${service.title}`}
              data-aos="fade-up"
              data-aos-delay={Math.min(index * 70, 350)}
            >
              <span className="sv2-number">{String(index + 1).padStart(2, '0')}</span>

              <div className="sv2-icon" aria-hidden="true">
                <i className={`fas ${service.icon}`} />
              </div>

              <h3 className="sv2-title">{service.title}</h3>
              <p className="sv2-desc">{service.description}</p>

              <div className="sv2-cta">
                <i className="fas fa-arrow-left" />
                اطلب الخدمة الآن
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}