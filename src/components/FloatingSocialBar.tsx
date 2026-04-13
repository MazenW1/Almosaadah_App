export function FloatingSocialBar() {
  return (
    <div className="floating-social-bar" role="complementary" aria-label="روابط التواصل السريعة">
      <a
        href="https://wa.me/966580171160"
        className="social-btn whatsapp-btn"
        target="_blank"
        rel="noopener noreferrer"
        title="واتساب"
        aria-label="تواصل عبر واتساب"
      >
        <i className="fab fa-whatsapp"></i>
      </a>

      <a
        href="https://x.com/SWalttwyr"
        className="social-btn twitter-btn"
        target="_blank"
        rel="noopener noreferrer"
        title="إكس"
        aria-label="تواصل عبر إكس"
      >
        <i className="fab fa-x-twitter"></i>
      </a>

      <a
        href="mailto:info@almosaadah.com"
        className="social-btn email-btn"
        title="بريد إلكتروني"
        aria-label="إرسال بريد إلكتروني"
      >
        <i className="fas fa-envelope"></i>
      </a>
    </div>
  );
}
