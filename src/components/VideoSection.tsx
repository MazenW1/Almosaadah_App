// 1. استيراد الفيديو من المسار الجديد في src/img
// ملاحظة: تأكد أن اسم الملف هو Video1.mp4 كما ظهر في صورتك السابقة
import companyVideo from '../img/Video1.mp4'; 
import videoPoster from '../img/Logo.png'; // يمكنك استخدام الشعار كصورة مؤقتة أو صورة أخرى

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
          poster={videoPoster} // استخدام الشعار كبوستر حتى يجهز الفيديو
          preload="metadata"
        >
          {/* 2. استخدام المتغير المستورد هنا */}
          <source src={companyVideo} type="video/mp4" />
          <p>
            متصفحك لا يدعم تشغيل الفيديو. يمكنك{' '}
            <a href={companyVideo}>تحميل الفيديو</a> بدلاً من ذلك.
          </p>
        </video>
      </div>
    </section>
  );
}