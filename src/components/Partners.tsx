const partners = [
  'img/WhatsApp Image 2026-02-12 at 7.31.54 AM (3).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.54 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.55 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.55 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.55 AM (3).jpeg',
  'img/البر.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.55 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.56 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.46 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.46 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.46 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.47 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.47 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.47 AM (3).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.47 AM.jpeg',
  'img/شبابي.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.48 AM (2).jpeg',
  'img/سند.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.48 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.49 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.49 AM (4).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.49 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.50 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.50 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.50 AM (3).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.50 AM (4).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.50 AM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.51 AM (1).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.51 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.51 AM (3).jpeg',
  'img/WhatsApp Image 2026-02-15 at 12.59.52 PM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.52 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.52 AM (3).jpeg',
  'img/فيض االعطاء.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.52 AM.jpeg',
  'img/WhatsApp Image 2026-02-15 at 1.04.55 PM.jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.53 AM (2).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.53 AM (3).jpeg',
  'img/WhatsApp Image 2026-02-12 at 7.31.53 AM (4).jpeg',
  'img/تنبه.jpeg',
];

export function Partners() {
  return (
    <section className="partners-section" id="partners" aria-labelledby="partnersTitle">
      <div className="section-header" data-aos="fade-up">
        <h2 id="partnersTitle">شركاء النجاح</h2>
        <p>نفخر بالتعاون مع أكثر من 40 جهة رائدة في المملكة</p>
      </div>

      <div className="partners-container" data-aos="fade-up">
        {partners.map((imgSrc, index) => (
          <div key={index} className="partner-card">
            <img
              src={imgSrc}
              alt={`شريك ${index + 1}`}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://via.placeholder.com/180x130/0891b2/ffffff?text=شريك';
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
