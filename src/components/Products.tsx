interface Product {
  title: string;
  emoji: string;
  description: string;
  goal: string;
  features: string[];
  highlight?: boolean;
  type?: string;
}

interface ProductsProps {
  onProductSelect: (productName: string, productType?: string) => void;
}

export function Products({ onProductSelect }: ProductsProps) {
  const products: Product[] = [
    {
      emoji: '1️⃣',
      title: 'منتج عون',
      description: 'تقديم دعم فوري ومساندة احترافية سريعة للجمعيات الأهلية لتجاوز التحديات الإدارية والفنية اليومية بكفاءة عالية.',
      goal: 'تقديم استشارات مباشرة وحلول عملية فورية لضمان استمرارية الأعمال.',
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
      description: 'بناء منظومة إدارية متكاملة للكيان، تبدأ من التخطيط الاستراتيجي وصولاً إلى التنفيذ التشغيلي وتصميم المبادرات النوعية.',
      goal: 'بناء أساس إداري متين يضمن جاهزية الجمعية للاعتماد والنمو.',
      features: [
        'إعداد الخطط الاستراتيجية والتشغيلية.',
        'تجهيز ملفات الحوكمة والسياسات الداخلية.',
        'تصميم مشاريع تنموية تلبي احتياج المجتمع.',
        'رفع كفاءة الأداء المؤسسي للجمعية.',
      ],
      type: 'product', // ← مهم: تحديد أنه منتج
    },
    {
      emoji: '3️⃣',
      title: 'منتج الجهات المانحة',
      description: 'تجسير العلاقة بين الجمعية والمانحين عبر صياغة مشاريع ومبادرات احترافية تتوافق تماماً مع اشتراطات ومعايير الصناديق الداعمة.',
      goal: 'تعظيم فرص الحصول على الدعم المالي وتعزيز ثقة المانحين.',
      features: [
        'دراسة دقيقة لمتطلبات الصناديق والمانحين.',
        'صياغة عروض المشاريع بمعايير احترافية.',
        'بناء مؤشرات قياس الأثر لضمان القبول.',
        'متابعة الرفع والتقديم حتى صدور القرار.',
      ],
      type: 'product', // ← مهم: تحديد أنه منتج
    },
    {
      emoji: '4️⃣',
      title: 'منتج المنسق المؤسسي للمانحين',
      description: 'تمثيل احترافي للمؤسسات المانحة لإدارة محافظهم التنموية وضمان تنفيذ المشاريع المدعومة وفق أعلى معايير الحوكمة والكفاءة المالية.',
      goal: 'إدارة المشاريع نيابة عن المانح لضمان تحقيق الأثر التنموي المستدام.',
      features: [
        'دراسة مهنية دقيقة للمشاريع المتقدمة.',
        'متابعة التنفيذ الميداني والإداري.',
        'تقارير احترافية دورية قابلة للقياس.',
        'فريق متخصص بخبرة +10 سنوات.',
      ],
      type: 'product', // ← مهم: تحديد أنه منتج
    },
    {
      emoji: '🚀',
      title: 'برنامج تأهيل برو',
      description: 'برنامج استراتيجي متكامل يُعنى برفع جاهزية الجمعيات الأهلية وفق معايير دقيقة، لبناء مشاريع نوعية تعزز ثقة الجهات المانحة وتضمن الاستدامة.',
      goal: 'تمكين الكيانات من المنافسة الاحترافية على فرص الدعم والتمويل.',
      features: [
        'تأهيل شامل للحوكمة والامتثال.',
        'بناء مصفوفة الصلاحيات الإدارية.',
        'تجهيز ملفات استحقاق دعم الصناديق.',
        'تصميم مشاريع تنموية ذات أثر ملموس.',
        'إعداد خطط الاستدامة المالية.',
        'دعم فني واستشاري طوال البرنامج.',
      ],
      highlight: true,
      type: 'product', // ← مهم: تحديد أنه منتج
    },
  ];

  const handleClick = (product: Product) => {
    // تمرير اسم المنتج ونوعه
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
            <div className="flex flex-wrap gap-10 items-start">
              <div className="flex-1 min-w-[280px]">
                <h3>{product.emoji} {product.title}</h3>
                <p>{product.description}</p>
                <div
                  className="mt-6 p-3 pr-4"
                  style={{
                    borderRight: '4px solid #0891b2',
                    background: 'rgba(8, 145, 178, 0.05)',
                    borderRadius: '4px',
                  }}
                >
                  <p
                    className="m-0 text-base"
                    style={{ color: '#0891b2' }}
                  >
                    <strong>
                      <i className="fas fa-bullseye"></i> الهدف:
                    </strong>{' '}
                    {product.goal}
                  </p>
                </div>
              </div>
              <div className="flex-1 min-w-[280px]">
                <h4 style={{ color: '#c5a059', marginBottom: '15px' }}>
                  <i className="fas fa-list-check"></i>{' '}
                  {product.highlight ? 'مخرجات البرنامج:' : 'المميزات:'}
                </h4>
                <ul className="guarantees-list">
                  {product.features.map((feature, idx) => (
                    <li key={idx}>
                      <i className="fas fa-check-circle"></i>
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