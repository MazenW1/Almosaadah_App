interface Product {
  title: string;
  emoji: string;
  description: string;
  goal: string;
  goalIcon?: string;
  goalColor?: string;
  features: string[];
  featuresLabel?: string;
  highlight?: boolean;
  type?: string;
  badge?: string;
  badgeIcon?: string;
  price?: string;
  priceColor?: string;
  extraNote?: string;
  extraNoteIcon?: string;
  extraNoteColor?: string;
  extraNoteBorderColor?: string;
}

interface ProductsProps {
  onProductSelect: (productName: string, productType?: string) => void;
}

export function Products({ onProductSelect }: ProductsProps) {
  const products: Product[] = [
    {
      emoji: '1️⃣',
      title: 'منتج عون',
      description:
        'تقديم دعم فوري ومساندة احترافية سريعة للجمعيات الأهلية لتجاوز التحديات الإدارية والفنية اليومية بكفاءة عالية.',
      goal: 'تقديم استشارات مباشرة وحلول عملية فورية لضمان استمرارية الأعمال.',
      badge: 'منتج تأهيلي للتقديم على صندوق دعم الجمعيات',
      badgeIcon: 'fa-check-double',
      features: [
        'استشارات مباشرة لحل التحديات الطارئة.',
        'متابعة تنفيذ المهام لضمان الجودة.',
        'تقارير إنجاز توضح النتائج المحققة.',
        'توفير الجهد والوقت عبر خبرات عملية.',
      ],
      type: 'عون',
    },
    {
      emoji: '2️⃣',
      title: 'بكج المساعدة الإدارية',
      description:
        'بناء منظومة إدارية متكاملة للكيان، تبدأ من التخطيط الاستراتيجي وصولاً إلى التنفيذ التشغيلي وتصميم المبادرات النوعية.',
      goal: 'بناء أساس إداري متين يضمن جاهزية الجمعية للاعتماد والنمو.',
      featuresLabel: 'مخرجات البكج:',
      features: [
        'إعداد الخطط الاستراتيجية والتشغيلية.',
        'تجهيز ملفات الحوكمة والسياسات الداخلية.',
        'تصميم مشاريع تنموية تلبي احتياج المجتمع.',
        'رفع كفاءة الأداء المؤسسي للجمعية.',
      ],
      type: 'product',
    },
    {
      emoji: '3️⃣',
      title: 'منتج الجهات المانحة',
      description:
        'تجسير العلاقة بين الجمعية والمانحين عبر صياغة مشاريع ومبادرات احترافية تتوافق تماماً مع اشتراطات ومعايير الصناديق الداعمة.',
      goal: 'تعظيم فرص الحصول على الدعم المالي وتعزيز ثقة المانحين.',
      featuresLabel: 'المميزات:',
      features: [
        'دراسة دقيقة لمتطلبات الصناديق والمانحين.',
        'صياغة عروض المشاريع بمعايير احترافية.',
        'بناء مؤشرات قياس الأثر لضمان القبول.',
        'متابعة الرفع والتقديم حتى صدور القرار.',
      ],
      type: 'product',
    },
    {
      emoji: '4️⃣',
      title: 'المنسق المؤسسي للمانحين',
      description:
        'تمثيل احترافي للمؤسسات المانحة لإدارة محافظهم التنموية وضمان تنفيذ المشاريع المدعومة وفق أعلى معايير الحوكمة والكفاءة المالية.',
      goal: 'إدارة المشاريع نيابة عن المانح لضمان تحقيق الأثر التنموي المستدام.',
      featuresLabel: 'الضمانات:',
      features: [
        'دراسة مهنية دقيقة للمشاريع المتقدمة.',
        'متابعة التنفيذ الميداني والإداري.',
        'تقارير احترافية دورية قابلة للقياس.',
        'فريق متخصص بخبرة +10 سنوات.',
      ],
      type: 'product',
    },
    {
      emoji: '5️⃣',
      title: 'بكج المنحة التأسيسية',
      description:
        'خدمة متكاملة مصممة خصيصاً للجمعيات الناشئة لرفع جاهزيتها وتجهيز ملفاتها للحصول على دعم صندوق دعم الجمعيات باحترافية عالية.',
      goal: 'رفع جاهزية الجمعية الناشئة وتجهيز ملفاتها للحصول على دعم الصندوق.',
      badge: 'منتج للحصول على دعم صندوق دعم الجمعيات',
      badgeIcon: 'fa-check-double',
      featuresLabel: 'مخرجات الخدمة:',
      features: [
        'رفع الجاهزية حسب متطلبات صندوق الدعم.',
        'إعداد ملف المنحة التأسيسية باحترافية.',
        'التقديم والمتابعة حتى إغلاق الملف.',
        'زيادة فرص الحصول على الدعم المالي.',
      ],
      extraNote: 'ميزة إضافية: استرداد 50٪ من قيمة الخدمة عند الاشتراك في منتج عون لعام 2027هـ.',
      extraNoteIcon: 'fa-gift',
      extraNoteColor: '#c5a059',
      extraNoteBorderColor: '#c5a059',
      price: 'الرسوم: 10,000 ريال فقط',
      priceColor: '#0891b2',
      type: 'product',
    },
    {
      emoji: '6️⃣',
      title: 'منحة المصروفات التشغيلية',
      description:
        'خدمة احترافية لتجهيز ورفع طلبات منح التشغيل، نضمن من خلالها جودة الملفات وتفادي أخطاء الرفض التقنية والإدارية لضمان استدامة جمعيتك.',
      goal: 'ضمان جودة ملفات التشغيل وتفادي أسباب الرفض لتعزيز استدامة الجمعية.',
      goalIcon: 'fa-shield-alt',
      badge: 'مخصص للجمعيات (سنة - سنتين)',
      badgeIcon: 'fa-hand-holding-heart',
      featuresLabel: 'مخرجات الخدمة:',
      features: [
        'إعداد الملف الإداري وفق معايير الجهات المانحة.',
        'رفع الطلب عبر المنصات الرسمية بدقة عالية.',
        'متابعة حالة الطلب حتى صدور قرار الدعم.',
        'إغلاق المنحة وتقديم التقارير الختامية المطلوبة.',
      ],
      extraNote: 'ضمان المساعدة: الدفع مؤجل ومتاح فقط بعد نزول الدعم في حساب الجمعية.',
      extraNoteIcon: 'fa-shield-alt',
      extraNoteColor: '#0891b2',
      extraNoteBorderColor: '#0891b2',
      price: 'لشركاء عون: 8,500 ريال | السعر العام: 15,000 ريال',
      priceColor: '#c5a059',
      type: 'product',
    },
    
    {
      emoji: '🌟',
      title: 'منحة تطوع المحترفين',
      description:
        'فرصة استثنائية من صندوق دعم الجمعيات، صُممت خصيصًا لتمكين الجهات الأهلية عبر خبراء متخصصين يرفعون كفاءتها التشغيلية ويصنعون أثرًا تنمويًا حقيقيًا.',
      goal: 'رفع جاهزية جمعيتك للاستفادة من منحة تطوع المحترفين وتحقيق أثر مستدام وقابل للقياس.',
      goalIcon: 'fa-star',
      goalColor: '#0891b2',
      badge: 'من صندوق دعم الجمعيات',
      badgeIcon: 'fa-hand-holding-heart',
      featuresLabel: 'خدماتنا في هذه المنحة:',
      features: [
        'تجهيز ملف التقديم باحترافية عالية.',
        'رفع جاهزية الجمعية لمتطلبات المنحة.',
        'إعداد المستندات والمتطلبات اللازمة.',
        'تحسين فرص القبول وتحقيق العائد المالي للجمعية.',
        'متابعة كاملة من البداية حتى الإغلاق.',
      ],
      extraNote: 'المقاعد محدودة … والفرص تُمنح للجاهزين فقط. لا تضيع الفرصة!',
      extraNoteIcon: 'fa-exclamation-triangle',
      extraNoteColor: '#c5a059',
      extraNoteBorderColor: '#c5a059',
     
      priceColor: '#0891b2',
      type: 'product',
    },
    {
      emoji: '🚀',
      title: 'برنامج تأهيل برو',
      description:
        'برنامج استراتيجي متكامل يُعنى برفع جاهزية الجمعيات الأهلية وفق معايير دقيقة، لبناء مشاريع نوعية تعزز ثقة الجهات المانحة وتضمن الاستدامة.',
      goal: 'تمكين الكيانات من المنافسة الاحترافية على فرص الدعم والتمويل.',
      featuresLabel: 'مخرجات البرنامج:',
      features: [
        'تأهيل شامل للحوكمة والامتثال.',
        'بناء مصفوفة الصلاحيات الإدارية.',
        'تجهيز ملفات استحقاق دعم الصناديق.',
        'تصميم مشاريع تنموية ذات أثر ملموس.',
        'إعداد خطط الاستدامة المالية.',
        'دعم فني واستشاري طوال البرنامج.',
      ],
      highlight: true,
      type: 'product',
    },
  ];

  const handleClick = (product: Product) => {
    onProductSelect(product.title, product.type || 'product');
  };

  const handleKeyDown = (e: React.KeyboardEvent, product: Product) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onProductSelect(product.title, product.type || 'product');
    }
  };

  return (
    <section className="products-section" id="products" aria-labelledby="productsTitle">
      <div className="section-header" data-aos="fade-up">
        <h2 id="productsTitle">منتجاتنا النوعيّة</h2>
        <p>حلول متقدمة ومبتكرة… لتأمين الاستدامة وتعظيم التأثير</p>
      </div>

      <div className="products-grid" data-aos="fade-up">
        {products.map((product, index) => (
          <article
            key={index}
            className={`product-item clickable-card ${product.highlight ? 'highlight' : ''}`}
            onClick={() => handleClick(product)}
            onKeyDown={(e) => handleKeyDown(e, product)}
            role="button"
            tabIndex={0}
            aria-label={product.title}
            data-aos="fade-up"
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '40px', alignItems: 'flex-start' }}>

              {/* ── العمود الأيمن ── */}
              <div style={{ flex: '1.2', minWidth: '280px' }}>

                {/* عنوان + badge */}
                <div style={{ marginBottom: '15px' }}>
                  <h3>
                    {product.emoji} {product.title}
                    {product.badge && (
                      <><br />
                        <span
                          className="gov-badge"
                          style={{
                            fontSize: '0.85rem',
                            padding: '4px 10px',
                            display: 'inline-block',
                            marginTop: '6px',
                            borderRadius: '4px',
                          }}
                        >
                          {product.badgeIcon && (
                            <i className={`fas ${product.badgeIcon}`} style={{ marginLeft: '5px' }} />
                          )}
                          {product.badge}
                        </span>
                      </>
                    )}
                  </h3>
                </div>

                <p>{product.description}</p>

                {/* بنر الهدف */}
                <div
                  style={{
                    marginTop: '25px',
                    padding: '12px',
                    borderRight: `4px solid ${product.goalColor ?? '#0891b2'}`,
                    background: `rgba(8, 145, 178, 0.05)`,
                    borderRadius: '4px',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.95rem', color: product.goalColor ?? '#0891b2' }}>
                    <strong>
                      <i className={`fas ${product.goalIcon ?? 'fa-bullseye'}`} /> الهدف:
                    </strong>{' '}
                    {product.goal}
                  </p>
                </div>

                {/* ملاحظة إضافية (اختيارية) */}
                {product.extraNote && (
                  <div
                    style={{
                      marginTop: '15px',
                      padding: '12px',
                      borderRight: `4px solid ${product.extraNoteBorderColor ?? '#c5a059'}`,
                      background: `rgba(197, 160, 89, 0.05)`,
                      borderRadius: '4px',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: '0.95rem', color: product.extraNoteColor ?? '#c5a059' }}>
                      <strong>
                        {product.extraNoteIcon && (
                          <i className={`fas ${product.extraNoteIcon}`} style={{ marginLeft: '4px' }} />
                        )}
                      </strong>{' '}
                      {product.extraNote}
                    </p>
                  </div>
                )}

                {/* السعر (اختياري) */}
                {product.price && (
                  <div
                    style={{
                      marginTop: '15px',
                      fontWeight: 'bold',
                      color: product.priceColor ?? '#0891b2',
                    }}
                  >
                    <i className="fas fa-tag" style={{ marginLeft: '6px' }} />
                    {product.price}
                  </div>
                )}
              </div>

              {/* ── العمود الأيسر ── */}
              <div style={{ flex: '1', minWidth: '280px' }}>
                <h4 style={{ color: '#c5a059', marginBottom: '15px' }}>
                  <i className="fas fa-list-check" /> {product.featuresLabel ?? 'المميزات:'}
                </h4>
                <ul className="guarantees-list" style={{ listStyle: 'none', padding: 0, display: 'grid', gap: '12px' }}>
                  {product.features.map((feature, idx) => (
                    <li key={idx}>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>
          </article>
        ))}
      </div>
    </section>
  );
}