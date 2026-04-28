// Background Animation with Dark Mode Support - Fixed Version
import { useEffect, useRef } from 'react';

interface BackgroundAnimationProps {
  isDarkMode?: boolean;
  isPaused?: boolean;
}

export function BackgroundAnimation({ isDarkMode = false, isPaused = false }: BackgroundAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(isPaused);

  // Update ref when prop changes
  useEffect(() => {
    pausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ✅ FIX 1: Use a ref-like object to track the animation frame ID
    // so we can cancel it properly on cleanup
    let animFrame: number | null = null;
    let isDestroyed = false;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    // ✅ FIX 2: Debounce resize to avoid hammering canvas on mobile
    // Also skip resize when modal is open (virtual keyboard causes resize)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        // Skip resize when animation is paused (modal open / keyboard visible)
        if (pausedRef.current) return;

        W = canvas.width = window.innerWidth;
        H = canvas.height = window.innerHeight;
      }, 300); // Increased debounce for keyboard transitions
    };

    // Use visualViewport API for better mobile keyboard handling
    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener('resize', () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (pausedRef.current) return;

          W = canvas.width = window.innerWidth;
          H = canvas.height = window.innerHeight;
        }, 300);
      });
    } else {
      window.addEventListener('resize', onResize);
    }

    // ✅ FIX 3: Reduce particle count on mobile for performance
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 25 : 50;
    const CONNECTION_DISTANCE = isMobile ? 100 : 130;

    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; color: string;
    }> = [];

    const lightColors = [
      'rgba(6, 182, 212,',
      'rgba(14, 165, 233,',
      'rgba(56, 189, 248,',
      'rgba(103, 232, 249,',
      'rgba(34, 211, 238,',
    ];

    const darkColors = [
      'rgba(6, 182, 212,',
      'rgba(34, 211, 238,',
      'rgba(103, 232, 249,',
      'rgba(14, 165, 233,',
      'rgba(56, 189, 248,',
    ];

    const colors = isDarkMode ? darkColors : lightColors;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2.5 + 1,
        alpha: Math.random() * 0.5 + 0.2,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // ✅ FIX 4: Reduce node count on mobile
    const NODE_COUNT = isMobile ? 4 : 8;
    const nodes: Array<{
      x: number; y: number; r: number; pulse: number; speed: number; color: string;
    }> = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 3 + 2,
        pulse: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    let t = 0;

    const draw = () => {
      // ✅ FIX 5: Stop loop immediately if component unmounted
      if (isDestroyed) return;

      // ✅ PAUSE ANIMATION when modal is open (ref check, not state)
      if (pausedRef.current) {
        animFrame = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        // ✅ FIX 6: On mobile, skip connection lines (expensive O(n²) on every frame)
        if (!isMobile) {
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < CONNECTION_DISTANCE) {
              ctx.beginPath();
              ctx.strokeStyle = isDarkMode
                ? `rgba(6, 182, 212,${0.2 * (1 - dist / CONNECTION_DISTANCE)})`
                : `rgba(6,182,212,${0.12 * (1 - dist / CONNECTION_DISTANCE)})`;
              ctx.lineWidth = 0.5;
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }

        // Glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}0.08)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
      }

      for (const node of nodes) {
        node.pulse += node.speed;
        const glow = Math.sin(node.pulse) * 0.5 + 0.5;
        const outerR = node.r + glow * 8;

        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, outerR * 2.5);
        grad.addColorStop(0, `${node.color}${0.3 * glow})`);
        grad.addColorStop(1, `${node.color}0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, outerR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}${0.6 + glow * 0.4})`;
        ctx.fill();
      }

      // ✅ FIX 7: Always store the frame ID so cleanup can cancel it
      animFrame = requestAnimationFrame(draw);
    };

    draw();

    // ✅ FIX 8: Proper cleanup — cancel animation, remove listeners, clear timers
    return () => {
      isDestroyed = true;
      if (animFrame !== null) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }
      if (resizeTimer !== null) {
        clearTimeout(resizeTimer);
      }
      window.removeEventListener('resize', onResize);
      // Clear canvas to free GPU memory
      ctx.clearRect(0, 0, W, H);
    };
  }, [isDarkMode]);

  return (
    <>
      <style>{`
        .bg-futuristic {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          overflow: hidden;
          /* isolation: isolate — REMOVED: was creating stacking context that blocked UI */
        }

        .bg-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
        }

        /* Light mode gradient background */
        .bg-base-light {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 100% 80% at 20% 0%, rgba(224, 242, 254, 0.6) 0%, transparent 50%),
            radial-gradient(ellipse 80% 100% at 80% 100%, rgba(186, 230, 253, 0.5) 0%, transparent 50%),
            radial-gradient(ellipse 60% 60% at 50% 50%, rgba(241, 249, 250, 0.4) 0%, transparent 60%),
            linear-gradient(180deg, #f8fafc 0%, #f1f5f9 50%, #f8fafc 100%);
        }

        /* Dark mode gradient background */
        .bg-base-dark {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 100% 80% at 20% 0%, rgba(15, 23, 42, 0.95) 0%, transparent 50%),
            radial-gradient(ellipse 80% 100% at 80% 100%, rgba(30, 41, 59, 0.9) 0%, transparent 50%),
            radial-gradient(ellipse 60% 60% at 50% 50%, rgba(51, 65, 85, 0.85) 0%, transparent 60%),
            linear-gradient(180deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        }

        /* Glass overlay */
        .glass-overlay-light {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.4) 0%,
            rgba(255, 255, 255, 0.2) 50%,
            rgba(255, 255, 255, 0.3) 100%
          );
        }

        .glass-overlay-dark {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(30, 41, 59, 0.6) 0%,
            rgba(51, 65, 85, 0.4) 50%,
            rgba(30, 41, 59, 0.5) 100%
          );
        }

        /* ✅ FIX 10: On mobile, disable backdrop-filter (very expensive on iOS/Android) */
        .glass-orb-light {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.7) 0%,
            rgba(255, 255, 255, 0.5) 50%,
            rgba(186, 230, 253, 0.4) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow:
            0 0 60px rgba(6, 182, 212, 0.1),
            0 0 100px rgba(255, 255, 255, 0.5),
            inset 0 0 40px rgba(255, 255, 255, 0.3);
        }

        .glass-orb-dark {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: linear-gradient(
            135deg,
            rgba(30, 41, 59, 0.7) 0%,
            rgba(51, 65, 85, 0.5) 50%,
            rgba(6, 182, 212, 0.15) 100%
          );
          border: 1px solid rgba(6, 182, 212, 0.2);
          box-shadow:
            0 0 60px rgba(6, 182, 212, 0.15),
            0 0 100px rgba(30, 41, 59, 0.8),
            inset 0 0 40px rgba(6, 182, 212, 0.05);
        }



        .glass-orb {
          position: absolute;
          border-radius: 50%;
          /* ✅ FIX 13: Use will-change to hint GPU compositing */
          will-change: transform;
        }



        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(22px, -16px); }
          66% { transform: translate(-16px, 12px); }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(-18px, 16px); }
          66% { transform: translate(16px, -18px); }
        }
        @keyframes orb-float-3 {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(12px, -22px); }
        }

        .glass-orb-1 {
          top: -5%;
          left: -8%;
          width: 400px;
          height: 400px;
          animation: orb-float-1 24s ease-in-out infinite;
        }
        .glass-orb-2 {
          bottom: -10%;
          right: -5%;
          width: 320px;
          height: 320px;
          animation: orb-float-2 28s ease-in-out infinite 2s;
        }
        .glass-orb-3 {
          top: 30%;
          right: 5%;
          width: 220px;
          height: 220px;
          animation: orb-float-3 20s ease-in-out infinite 1s;
        }
        .glass-orb-4 {
          top: 15%;
          left: 35%;
          width: 160px;
          height: 160px;
          animation: orb-float-1 26s ease-in-out infinite 3s;
        }
        .glass-orb-5 {
          bottom: 25%;
          left: 15%;
          width: 180px;
          height: 180px;
          animation: orb-float-2 22s ease-in-out infinite 1.5s;
        }

        /* Glass crystals */
        .glass-crystal {
          position: absolute;
          will-change: transform;
        }

        .glass-crystal-light {
          background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0.6) 0%,
            rgba(186, 230, 253, 0.4) 50%,
            rgba(255, 255, 255, 0.3) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.7);
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.1), inset 0 0 15px rgba(255, 255, 255, 0.4);
        }

        .glass-crystal-dark {
          background: linear-gradient(
            135deg,
            rgba(6, 182, 212, 0.15) 0%,
            rgba(30, 41, 59, 0.6) 50%,
            rgba(6, 182, 212, 0.1) 100%
          );
          border: 1px solid rgba(6, 182, 212, 0.25);
          box-shadow: 0 0 20px rgba(6, 182, 212, 0.2), inset 0 0 15px rgba(6, 182, 212, 0.05);
        }

        @keyframes crystal-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .crystal-diamond {
          top: 18%;
          left: 8%;
          width: 60px;
          height: 60px;
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
          animation: crystal-rotate 25s linear infinite;
        }
        .crystal-diamond-2 {
          bottom: 22%;
          right: 12%;
          width: 40px;
          height: 40px;
          clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
          animation: crystal-rotate 18s linear infinite reverse;
        }
        .crystal-hexagon {
          top: 55%;
          left: 5%;
          width: 50px;
          height: 50px;
          clip-path: polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%);
          animation: crystal-rotate 30s linear infinite;
        }
        .crystal-triangle {
          top: 8%;
          right: 8%;
          width: 55px;
          height: 55px;
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          animation: crystal-rotate 22s linear infinite reverse;
        }

        /* Glass rings */
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.55; }
        }
        @keyframes ring-expand {
          0% { opacity: 0; }
          50% { opacity: 0.25; }
          100% { opacity: 0; }
        }

        .glass-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(6, 182, 212, 0.15);
          background: transparent;
          will-change: transform;
        }

        .ring-1 {
          top: 12%;
          right: 18%;
          width: 160px;
          height: 160px;
          animation: ring-pulse 5s ease-in-out infinite;
        }
        .ring-1::before {
          content: '';
          position: absolute;
          inset: -15px;
          border-radius: 50%;
          border: 1px solid rgba(6, 182, 212, 0.1);
          animation: ring-expand 5s ease-out infinite;
        }

        .ring-2 {
          bottom: 20%;
          left: 12%;
          width: 120px;
          height: 120px;
          animation: ring-pulse 7s ease-in-out infinite 1.5s;
        }

        .ring-3 {
          top: 38%;
          left: 48%;
          width: 90px;
          height: 90px;
          animation: ring-pulse 4s ease-in-out infinite 0.8s;
          border-width: 1px;
        }

        /* Floating particles */
        @keyframes particle-drift {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.35; }
          33% { transform: translateY(-18px) translateX(8px); opacity: 0.6; }
          66% { transform: translateY(-28px) translateX(-6px); opacity: 0.4; }
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 70%);
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
          will-change: transform;
        }

        .particle-1 { top: 18%; left: 28%; animation: particle-drift 7s ease-in-out infinite; }
        .particle-2 { top: 32%; right: 22%; animation: particle-drift 9s ease-in-out infinite 0.8s; }
        .particle-3 { bottom: 35%; left: 18%; animation: particle-drift 6s ease-in-out infinite 1.5s; }
        .particle-4 { top: 52%; left: 58%; animation: particle-drift 8s ease-in-out infinite 0.4s; }
        .particle-5 { bottom: 18%; right: 28%; animation: particle-drift 10s ease-in-out infinite 2.5s; }
        .particle-6 { top: 65%; left: 42%; animation: particle-drift 7s ease-in-out infinite 1.2s; }

        /* Subtle light grid */
        .bg-grid-light {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(6, 182, 212, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.02) 1px, transparent 1px);
          background-size: 70px 70px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 70%);
        }

        /* Subtle dark grid */
        .bg-grid-dark {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(6, 182, 212, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(6, 182, 212, 0.05) 1px, transparent 1px);
          background-size: 70px 70px;
          mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 80% 80% at 50% 50%, black 0%, transparent 70%);
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.28; }
          50% { opacity: 0.45; }
        }

        .glow-spot {
          position: absolute;
          border-radius: 50%;
          filter: blur(30px);
          animation: glow-pulse 10s ease-in-out infinite;
        }

        .glow-spot-1 {
          top: 8%;
          right: 28%;
          width: 250px;
          height: 250px;
        }
        .glow-spot-2 {
          bottom: 18%;
          left: 18%;
          width: 200px;
          height: 200px;
          animation-delay: 2s;
        }
        .glow-spot-3 {
          top: 48%;
          right: 8%;
          width: 180px;
          height: 180px;
          animation-delay: 4s;
        }

        /* Light rays */
        @keyframes ray-rotate {
          0% { transform: translateX(-50%) rotate(0deg); }
          100% { transform: translateX(-50%) rotate(360deg); }
        }

        .light-rays {
          position: absolute;
          top: -40%;
          left: 50%;
          width: 180%;
          height: 180%;
          transform: translateX(-50%);
          opacity: 0.04;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            rgba(6, 182, 212, 0.4) 15deg,
            transparent 30deg,
            transparent 45deg,
            rgba(6, 182, 212, 0.3) 60deg,
            transparent 75deg,
            transparent 90deg,
            rgba(6, 182, 212, 0.35) 105deg,
            transparent 120deg
          );
          animation: ray-rotate 100s linear infinite;
          will-change: transform;
        }


        /* ══════════════════════════════════════════
           Mobile Performance — أداء الجوال
        ══════════════════════════════════════════ */
        @media (max-width: 768px) {
          /* إلغاء backdrop-filter — أكبر سبب للحرارة */
          .glass-orb-light,
          .glass-orb-dark,
          .glass-ring { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }

          /* إخفاء العناصر الزائدة */
          .glass-crystal, .ring-1, .ring-3,
          .particle-2, .particle-4, .particle-6,
          .glass-orb-4, .glass-orb-5,
          .light-rays { display: none !important; }

          /* إبطاء الانيميشن المتبقية — أخف على CPU */
          .glass-orb-1 { animation-duration: 28s !important; width: 260px !important; height: 260px !important; }
          .glass-orb-2 { animation-duration: 34s !important; width: 200px !important; height: 200px !important; }
          .glass-orb-3 { animation-duration: 24s !important; width: 150px !important; height: 150px !important; }
          .ring-2 { animation-duration: 10s !important; }
          .glow-spot { animation-duration: 12s !important; }
          .glow-spot-1 { width: 180px !important; height: 180px !important; }
          .glow-spot-2 { width: 140px !important; height: 140px !important; }
          .glow-spot-3 { display: none !important; }
          .particle-1, .particle-3, .particle-5 { animation-duration: 12s !important; }

          /* إيقاف الانيميشن عند فتح الكيبورد */
          .bg-futuristic.animations-paused * {
            animation-play-state: paused !important;
          }
        }

        /* Glass card effect */
        .glass-card {
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 20px;
        }
      `}</style>

      <div className={`bg-futuristic ${isDarkMode ? 'dark-mode-bg' : 'light-mode-bg'} ${isPaused ? 'animations-paused' : ''}`} aria-hidden="true" style={{ zIndex: -1, isolation: 'auto' }}>
        {/* Base gradient */}
        <div className={isDarkMode ? 'bg-base-dark' : 'bg-base-light'} />

        {/* Glass overlay */}
        <div className={isDarkMode ? 'glass-overlay-dark' : 'glass-overlay-light'} />

        {/* Light rays */}
        <div className="light-rays" />

        {/* Glow spots */}
        <div className={`glow-spot glow-spot-1 ${isDarkMode ? 'bg-slate-800/80' : 'bg-cyan-100/50'}`} />
        <div className={`glow-spot glow-spot-2 ${isDarkMode ? 'bg-slate-700/60' : 'bg-cyan-50/40'}`} />
        <div className={`glow-spot glow-spot-3 ${isDarkMode ? 'bg-cyan-900/40' : 'bg-cyan-100/30'}`} />

        {/* Grid */}
        <div className={isDarkMode ? 'bg-grid-dark' : 'bg-grid-light'} />

        {/* Glass orbs */}
        <div className={`glass-orb glass-orb-1 ${isDarkMode ? 'glass-orb-dark' : 'glass-orb-light'}`} />
        <div className={`glass-orb glass-orb-2 ${isDarkMode ? 'glass-orb-dark' : 'glass-orb-light'}`} />
        <div className={`glass-orb glass-orb-3 ${isDarkMode ? 'glass-orb-dark' : 'glass-orb-light'}`} />
        <div className={`glass-orb glass-orb-4 ${isDarkMode ? 'glass-orb-dark' : 'glass-orb-light'}`} />
        <div className={`glass-orb glass-orb-5 ${isDarkMode ? 'glass-orb-dark' : 'glass-orb-light'}`} />

        {/* Glass crystals */}
        <div className={`glass-crystal ${isDarkMode ? 'glass-crystal-dark' : 'glass-crystal-light'} crystal-diamond`} />
        <div className={`glass-crystal ${isDarkMode ? 'glass-crystal-dark' : 'glass-crystal-light'} crystal-diamond-2`} />
        <div className={`glass-crystal ${isDarkMode ? 'glass-crystal-dark' : 'glass-crystal-light'} crystal-hexagon`} />
        <div className={`glass-crystal ${isDarkMode ? 'glass-crystal-dark' : 'glass-crystal-light'} crystal-triangle`} />

        {/* Glass rings */}
        <div className="glass-ring ring-1" />
        <div className="glass-ring ring-2" />
        <div className="glass-ring ring-3" />

        {/* Floating particles */}
        <div className="particle particle-1" />
        <div className="particle particle-2" />
        <div className="particle particle-3" />
        <div className="particle particle-4" />
        <div className="particle particle-5" />
        <div className="particle particle-6" />

        {/* Canvas animation layer */}
        <canvas ref={canvasRef} className="bg-canvas" />
      </div>
    </>
  );
}