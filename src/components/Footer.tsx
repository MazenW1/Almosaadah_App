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

        /* Social links */
        .footer-socials {
          display: flex;
          align-items: center;
          gap: 12px;
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
        .social-link.x-link:hover       { background: #0f172a; color: #fff; border-color: #0f172a; }
        .social-link.linkedin-link:hover { background: #0077b5; color: #fff; border-color: #0077b5; }
        .social-link.whatsapp-link:hover { background: #25d366; color: #fff; border-color: #25d366; }
        .social-link.email-link:hover    { background: #0284c7; color: #fff; border-color: #0284c7; }

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

      <footer className="footer-v2">
        <div className="footer-inner">
          <div className="footer-logo-block">
            <img
              src={footerLogo} // استخدام المتغير المستورد
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

          <div className="footer-socials">
            <a href="https://x.com/SWalttwyr" className="social-link x-link"
              aria-label="X (تويتر)" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-x-twitter" />
            </a>
            <a href="https://www.linkedin.com/company/adminaide/" className="social-link linkedin-link"
              aria-label="LinkedIn" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-linkedin-in" />
            </a>
            <a href="https://wa.me/966580171160" className="social-link whatsapp-link"
              aria-label="WhatsApp" target="_blank" rel="noopener noreferrer">
              <i className="fab fa-whatsapp" />
            </a>
            <a href="mailto:info@almosaadah.com" className="social-link email-link"
              aria-label="البريد الإلكتروني">
              <i className="fas fa-envelope" />
            </a>
          </div>

          <div className="footer-divider" />

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