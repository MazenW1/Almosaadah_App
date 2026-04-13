import { useEffect, useRef, useState } from 'react';

const stats = [
  { target: 50, label: 'مشروع منجز', icon: 'fa-briefcase', suffix: '+', color: '#0ea5e9' },
  { target: 6,  label: 'سنوات خبرة',  icon: 'fa-calendar-alt', suffix: '+', color: '#38bdf8' },
  { target: 5,  label: 'خبير إداري',  icon: 'fa-user-tie', suffix: '+', color: '#7dd3fc' },
];

export function Stats() {
  const [counters, setCounters] = useState(stats.map(() => 0));
  const sectionRef = useRef<HTMLElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            animateCounters();
          }
        });
      },
      { threshold: 0.4 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const animateCounters = () => {
    const duration = 2000;
    const steps = 60;
    const stepTime = duration / steps;

    stats.forEach((stat, index) => {
      let current = 0;
      const increment = stat.target / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= stat.target) {
          setCounters((prev) => {
            const next = [...prev];
            next[index] = stat.target;
            return next;
          });
          clearInterval(timer);
        } else {
          setCounters((prev) => {
            const next = [...prev];
            next[index] = Math.ceil(current);
            return next;
          });
        }
      }, stepTime);
    });
  };

  return (
    <>
      <style>{`
        .stats-section-v2 {
          padding: 100px 24px;
          position: relative;
          overflow: hidden;
          direction: rtl;
        }

        .stats-section-v2::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(14,165,233,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .stats-container {
          max-width: 1100px;
          margin: 0 auto;
        }

        .stats-header {
          text-align: center;
          margin-bottom: 64px;
        }
        .stats-header h2 {
          font-family: 'Tajawal', sans-serif;
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          font-weight: 900;
          background: linear-gradient(135deg, #0c4a6e, #0ea5e9);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 12px;
        }
        .stats-header p {
          font-family: 'Tajawal', sans-serif;
          font-size: 1.05rem;
          color: #64748b;
        }

        .stats-grid-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 28px;
        }

        @keyframes stat-card-in {
          from { opacity: 0; transform: translateY(30px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes counter-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(14,165,233,0.3); }
          50% { text-shadow: 0 0 40px rgba(14,165,233,0.6); }
        }
        @keyframes ring-expand {
          0% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes icon-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(5deg); }
        }

        .stat-card-v2 {
          position: relative;
          background: rgba(255, 255, 255, 0.85);
          border: 1px solid rgba(14, 165, 233, 0.15);
          border-radius: 24px;
          padding: 40px 32px;
          text-align: center;
          overflow: hidden;
          backdrop-filter: blur(16px);
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          animation: stat-card-in 0.6s ease both;
          box-shadow:
            0 4px 24px rgba(14, 165, 233, 0.08),
            0 1px 0 rgba(255,255,255,0.9) inset;
        }

        .stat-card-v2::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          border-radius: 24px 24px 0 0;
          background: linear-gradient(90deg, transparent, var(--stat-color), transparent);
        }

        .stat-card-v2::after {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 0%, rgba(14,165,233,0.05) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.4s;
        }

        .stat-card-v2:hover {
          transform: translateY(-8px) scale(1.02);
          border-color: rgba(14, 165, 233, 0.35);
          box-shadow:
            0 20px 48px rgba(14, 165, 233, 0.2),
            0 4px 16px rgba(0,0,0,0.06);
        }
        .stat-card-v2:hover::after { opacity: 1; }

        .stat-icon-wrap {
          position: relative;
          width: 72px;
          height: 72px;
          margin: 0 auto 24px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid var(--stat-color);
          opacity: 0.25;
          animation: ring-expand 2.5s ease-out infinite;
        }
        .stat-icon-ring.delay { animation-delay: 1.2s; }

        .stat-icon-inner {
          width: 64px;
          height: 64px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          background: rgba(14, 165, 233, 0.08);
          border: 1.5px solid rgba(14, 165, 233, 0.2);
          color: var(--stat-color);
          position: relative;
          z-index: 1;
          animation: icon-float 3s ease-in-out infinite;
          backdrop-filter: blur(8px);
        }

        .stat-number-v2 {
          font-family: 'Tajawal', sans-serif;
          font-size: clamp(2.8rem, 5vw, 4rem);
          font-weight: 900;
          color: #0c4a6e;
          line-height: 1;
          margin-bottom: 10px;
          animation: counter-glow 2s ease-in-out infinite;
        }

        .stat-label-v2 {
          font-family: 'Tajawal', sans-serif;
          font-size: 1rem;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.02em;
        }

        .stat-bar {
          width: 40px;
          height: 3px;
          background: linear-gradient(90deg, var(--stat-color), transparent);
          border-radius: 100px;
          margin: 12px auto 0;
          opacity: 0.6;
        }
      `}</style>

      <section className="stats-section-v2" id="stats" ref={sectionRef} aria-label="إحصائياتنا">
        <div className="stats-container">
          <div className="stats-header" data-aos="fade-up">
            <h2>إحصائياتنا</h2>
            <p>أرقام تعكس ثقتكم بنا</p>
          </div>

          <div className="stats-grid-v2">
            {stats.map((stat, index) => (
              <div
                key={index}
                className="stat-card-v2"
                style={{
                  '--stat-color': stat.color,
                  animationDelay: `${index * 0.15}s`,
                } as React.CSSProperties}
                data-aos="fade-up"
                data-aos-delay={index * 120}
              >
                <div className="stat-icon-wrap">
                  <div className="stat-icon-ring" />
                  <div className="stat-icon-ring delay" />
                  <div className="stat-icon-inner" style={{ animationDelay: `${index * 0.5}s` }}>
                    <i className={`fas ${stat.icon}`} aria-hidden="true" />
                  </div>
                </div>

                <div className="stat-number-v2">
                  {counters[index]}{stat.suffix}
                </div>
                <div className="stat-label-v2">{stat.label}</div>
                <div className="stat-bar" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}