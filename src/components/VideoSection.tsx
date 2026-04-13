export function VideoSection() {
  return (
    <section className="company-video-section" aria-label="فيديو تعريفي">
      <div className="video-wrapper">
        <video
          playsInline
          autoPlay
          muted
          loop
          controls
          className="main-video"
          poster="img/video-poster.jpg"
          preload="metadata"
        >
          <source src="img/WhatsApp Video 2026-02-12 at 8.38.52 AM.mp4" type="video/mp4" />
          <p>
            متصفحك لا يدعم تشغيل الفيديو. يمكنك{' '}
            <a href="img/WhatsApp Video 2026-02-12 at 8.38.52 AM.mp4">تحميل الفيديو</a> بدلاً من ذلك.
          </p>
        </video>
      </div>
    </section>
  );
}
