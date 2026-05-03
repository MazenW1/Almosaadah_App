import footerLogo from '../img/Logo.png';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <>
      <style>{`
        footer.footer-v2 {
          position: relative;
          overflow: hidden;
          direction: rtl;
          padding: 60px 24px 32px;
          background:
            linear-gradient(160deg, rgba(14,165,233,0.04) 0%, rgba(255,255,255,0) 50%),
            rgba(255, 255, 255, 0.6);
          border-top: 1px solid rgba(14, 165, 233, 0.12);
          backdrop-filter: blur(20px);
        }

        footer.footer-v2::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(56,189,248,0.4) 20%,
            #0ea5e9 50%,
            rgba(56,189,248,0.4) 80%,
            transparent 100%
          );
        }

        .footer-inner {
          max-width: 1100px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 36px;
        }

        /* Logo block */
        .footer-logo-block {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
        }

        .footer-logo-img {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          border: 2px solid rgba(14, 165, 233, 0.2);
          box-shadow: 0 8px 24px rgba(14, 165, 233, 0.15);
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .footer-logo-img:hover { transform: scale(1.06) rotate(-2deg); }

        .footer-tagline {
          font-family: 'Tajawal', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: #334155;
          text-align: center;
          max-width: 360px;
          line-height: 1.6;
        }
        .footer-tagline span {
          background: linear-gradient(135deg, #0284c7, #38bdf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-weight: 900;
        }

        /* Owner card */
        .footer-owner-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          padding: 20px 36px;
          background: linear-gradient(135deg, rgba(14,165,233,0.06) 0%, rgba(56,189,248,0.03) 100%);
          border: 1.5px solid rgba(14, 165, 233, 0.18);
          border-radius: 999px;
          box-shadow: 0 4px 24px rgba(14,165,233,0.08), inset 0 1px 0 rgba(255,255,255,0.7);
          backdrop-filter: blur(12px);
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .footer-owner-card:hover {
          box-shadow: 0 8px 32px rgba(14,165,233,0.18), inset 0 1px 0 rgba(255,255,255,0.8);
          transform: translateY(-2px);
        }

        .footer-owner-label {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .footer-owner-name {
          font-family: 'Tajawal', sans-serif;
          font-size: 1.05rem;
          font-weight: 900;
          background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 50%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          text-align: center;
          line-height: 1.5;
        }

        /* Social links */
        .footer-socials {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        @keyframes social-pulse {
          0%, 100% { box-shadow: 0 4px 16px rgba(14,165,233,0.15); }
          50% { box-shadow: 0 4px 24px rgba(14,165,233,0.35); }
        }

        .social-link {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          border: 1.5px solid rgba(14, 165, 233, 0.15);
          background: rgba(255, 255, 255, 0.8);
          color: #475569;
          backdrop-filter: blur(8px);
        }
        .social-link:hover {
          transform: translateY(-4px) scale(1.1);
          animation: social-pulse 1.5s ease infinite;
        }
        .social-link.x-link:hover         { background: #0f172a; color: #fff; border-color: #0f172a; }
        .social-link.linkedin-link:hover   { background: #0077b5; color: #fff; border-color: #0077b5; }
        .social-link.whatsapp-link:hover   { background: #25d366; color: #fff; border-color: #25d366; }
        .social-link.email-link:hover      { background: #0284c7; color: #fff; border-color: #0284c7; }
        .social-link.instagram-link:hover  { background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888); color: #fff; border-color: #e1306c; }
        .social-link.facebook-link:hover   { background: #1877f2; color: #fff; border-color: #1877f2; }
        .social-link.phone-link:hover      { background: #16a34a; color: #fff; border-color: #16a34a; }
        .social-link.location-link:hover   { background: #dc2626; color: #fff; border-color: #dc2626; }

        /* Divider */
        .footer-divider {
          width: 200px;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(14,165,233,0.3), transparent);
        }

        /* Bottom info */
        .footer-bottom {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          text-align: center;
        }

        .footer-copyright {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.82rem;
          color: #94a3b8;
          font-weight: 500;
        }
        .footer-copyright span {
          color: #0284c7;
          font-weight: 800;
        }

        .footer-location {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.78rem;
          color: #cbd5e1;
        }
        .footer-location i { font-size: 0.7rem; color: #0ea5e9; }

        /* Tech badge */
        .footer-tech-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          border: 1px solid rgba(14, 165, 233, 0.15);
          background: rgba(14, 165, 233, 0.04);
          font-family: 'Courier New', monospace;
          font-size: 0.68rem;
          color: rgba(14, 165, 233, 0.6);
          letter-spacing: 0.08em;
        }

        @keyframes data-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.2; }
        }
        .footer-tech-badge i { animation: data-blink 1.5s ease infinite; }
      `}</style>

      <footer className="footer-v2" id="contact">
        <div className="footer-inner">

          {/* Logo */}
          <div className="footer-logo-block">
            <img
              src={footerLogo}
              alt="شعار المساعدة الإدارية"
              className="footer-logo-img"
              width="72"
              height="72"
              loading="lazy"
            />
            <p className="footer-tagline">
              <span>المساعدة الإدارية</span>
              {' '}.. شراكة فاعلة … وأثر مستدام
            </p>
          </div>

          {/* Owner card */}
          <div className="footer-owner-card">
            <span className="footer-owner-label">المالك</span>
            <span className="footer-owner-name">راكان مطلق مسيفر العتيبي</span>
          </div>

          {/* Social links */}
          <div className="footer-socials">
            <a href="https://x.com/SWalttwyr" className="social-link x-link"
              aria-label="X (تويتر)" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-x-twitter" />
            </a>
            <a href="https://www.linkedin.com/company/adminaide/" className="social-link linkedin-link"
              aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-linkedin-in" />
            </a>
            <a href="https://www.instagram.com/almosaadah.sa?igsh=ZXNia3J6YjdvdDIz" className="social-link instagram-link"
              aria-label="Instagram" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-instagram" />
            </a>
            <a href="https://www.facebook.com/profile.php?id=61588813229375" className="social-link facebook-link"
              aria-label="Facebook" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-facebook-f" />
            </a>
            <a href="https://wa.me/966580171160" className="social-link whatsapp-link"
              aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-whatsapp" />
            </a>
            <a href="tel:+966580171160" className="social-link phone-link"
              aria-label="الاتصال">
              <i className="fas fa-phone" />
            </a>
            <a href="mailto:info@almosaadah.com" className="social-link email-link"
              aria-label="البريد الإلكتروني">
              <i className="fas fa-envelope" />
            </a>
            <a href="https://maps.app.goo.gl/mrz9Z5Ddf7HyHotF9?g_st=aw" className="social-link location-link"
              aria-label="الموقع على الخريطة" target="_blank" rel="noopener noreferrer">
              <i className="fas fa-map-marker-alt" />
            </a>
          </div>

          <div className="footer-divider" />

          {/* Bottom */}
          <div className="footer-bottom">
            <p className="footer-copyright">
              © {currentYear} <span>المساعدة الإدارية</span> | جميع الحقوق محفوظة
            </p>
            <div className="footer-location">
              <i className="fas fa-map-marker-alt" />
              الطائف، المملكة العربية السعودية
            </div>
            <div className="footer-tech-badge">
              <i className="fas fa-circle" />
              SYSTEM ONLINE
            </div>
          </div>

        </div>
      </footer>
    </>
  );
}