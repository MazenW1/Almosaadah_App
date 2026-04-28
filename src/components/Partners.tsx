// 1. هذا السطر يقوم باستيراد كل الصور التي تبدأ بـ partner وتنتهي بـ .jpeg من مجلد img
const images = import.meta.glob('../img/partner*.{png,jpg,jpeg,svg}', { eager: true });

// 2. تحويل الكائنات المستوردة إلى مصفوفة روابط بسيطة
const partnersPaths = Object.values(images).map((mod: any) => mod.default);

export function Partners() {
  return (
    <section className="partners-section" id="partners" aria-labelledby="partnersTitle">
      <div className="section-header" data-aos="fade-up">
        <h2 id="partnersTitle">شركاء النجاح</h2>
        <p>نعتز بشراكتنا مع نخبة من الجهات الرائدة</p>
      </div>

      <div className="partners-container" data-aos="fade-up">
        {partnersPaths.map((imgSrc, index) => (
          <div key={index} className="partner-card">
            <img
              src={imgSrc} // هنا نستخدم الرابط مباشرة لأن Vite قام بمعالجته
              alt={`شريك ${index + 1}`}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </section>
  );
}