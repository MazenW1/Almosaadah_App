import { Link } from 'react-router-dom';

export function Hero() {
  const handleScroll = (href: string) => {
    document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero" id="home" aria-label="الصفحة الرئيسية">
      <div className="hero-content" data-aos="fade-up" data-aos-duration="1000">
        {/* Logo */}
        <div className="relative inline-block mb-2.5">
          <img
            src="/img/WhatsApp Image 2026-02-12 at 10.20.07 AM.jpeg"
            alt="شعار المساعدة الإدارية"
            className="company-logo"
            width="180"
            height="180"
            loading="eager"
          />
        </div>

        {/* Location Badge */}
        <div className="location-badge">
          <i className="fas fa-map-marker-alt"></i>
          <span>الطائف، المملكة العربية السعودية</span>
        </div>

        {/* Heading */}
        <h2>
          إدارة احترافية
          <br />
          <span>أثر أكبر</span>
        </h2>

        {/* Description */}
        <p>
          المساعدة الإدارية نصنع الجاهزية… ونقودك للتمكين والتمويل
          <br />
          لسنا مقدم خدمة…
          <br />
          نحن شريك نجاح يبني لك الكيان من الداخل ويجهزك للثقة والاعتماد والدعم.
        </p>

        {/* CTA Buttons */}
        <div className="cta-buttons">
          {/* استخدام button بدل Link لتجنب مشكلة hash navigation في React Router */}
          <button
            onClick={() => handleScroll('#services')}
            className="btn btn-primary"
            type="button"
          >
            <i className="fas fa-rocket"></i>
            اكتشف خدماتنا
          </button>
          <button
            onClick={() => handleScroll('#contact')}
            className="btn btn-secondary"
            type="button"
          >
            <i className="fas fa-phone"></i>
            تواصل معنا
          </button>
        </div>
      </div>
    </section>
  );
}