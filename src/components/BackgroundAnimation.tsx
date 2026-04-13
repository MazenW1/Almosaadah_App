// Background Animation with Dark Mode Support
import { useEffect, useRef } from 'react';

interface BackgroundAnimationProps {
  isDarkMode?: boolean;
}

export function BackgroundAnimation({ isDarkMode = false }: BackgroundAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animFrame: number;
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    // Particles for connection network
    const PARTICLE_COUNT = 50;
    const particles: Array<{
      x: number; y: number; vx: number; vy: number;
      size: number; alpha: number; color: string;
    }> = [];

    // Light mode colors
    const lightColors = [
      'rgba(6, 182, 212,',   // cyan-500
      'rgba(14, 165, 233,', // cyan-600
      'rgba(56, 189, 248,',  // cyan-400
      'rgba(103, 232, 249,', // cyan-300
      'rgba(34, 211, 238,',  // cyan-400
    ];

    // Dark mode colors - more vibrant
    const darkColors = [
      'rgba(6, 182, 212,',   // cyan-500
      'rgba(34, 211, 238,',  // cyan-400
      'rgba(103, 232, 249,', // cyan-300
      'rgba(14, 165, 233,',  // cyan-600
      'rgba(56, 189, 248,',  // cyan-400
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

    // Data nodes - larger glowing circles
    const nodes: Array<{
      x: number; y: number; r: number; pulse: number; speed: number; color: string;
    }> = [];
    for (let i = 0; i < 8; i++) {
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
      ctx.clearRect(0, 0, W, H);
      t += 0.008;

      // Draw connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        if (p.y > H) p.y = 0;

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 130) {
            ctx.beginPath();
            ctx.strokeStyle = isDarkMode
              ? `rgba(6, 182, 212,${0.2 * (1 - dist / 130)})` // Brighter in dark mode
              : `rgba(6,182,212,${0.12 * (1 - dist / 130)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        // Draw particle with subtle glow
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}0.08)`;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.alpha})`;
        ctx.fill();
      }

      // Draw pulsing nodes
      for (const node of nodes) {
        node.pulse += node.speed;
        const glow = Math.sin(node.pulse) * 0.5 + 0.5;
        const outerR = node.r + glow * 8;

        // Outer glow ring
        const grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, outerR * 2.5);
        grad.addColorStop(0, `${node.color}${0.3 * glow})`);
        grad.addColorStop(1, `${node.color}0)`);
        ctx.beginPath();
        ctx.arc(node.x, node.y, outerR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}${0.6 + glow * 0.4})`;
        ctx.fill();
      }

      animFrame = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', onResize);
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
        }

        .bg-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          transition: all 0.5s ease;
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

        /* Light mode glass orbs */
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
            inset 0 0 40px rgba(255, 255, 255, 0.5);
        }

        /* Dark mode glass orbs */
        .glass-orb-dark {
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: linear-gradient(
            135deg,
            rgba(51, 65, 85, 0.5) 0%,
            rgba(30, 41, 59, 0.4) 50%,
            rgba(6, 182, 212, 0.1) 100%
          );
          border: 1px solid rgba(6, 182, 212, 0.3);
          box-shadow:
            0 0 60px rgba(6, 182, 212, 0.2),
            0 0 100px rgba(6, 182, 212, 0.1),
            inset 0 0 40px rgba(6, 182, 212, 0.1);
        }

        @keyframes orb-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 0.5; }
          25% { transform: translate(30px, -25px) scale(1.05); opacity: 0.6; }
          50% { transform: translate(-15px, 30px) scale(0.98); opacity: 0.55; }
          75% { transform: translate(-35px, -15px) scale(1.02); opacity: 0.5; }
        }
        @keyframes orb-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.45; }
          33% { transform: translate(-40px, 25px) scale(1.08); opacity: 0.55; }
          66% { transform: translate(25px, -30px) scale(0.95); opacity: 0.5; }
        }
        @keyframes orb-float-3 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 0.5; }
          50% { transform: translate(20px, -40px) rotate(180deg) scale(1.1); opacity: 0.6; }
        }
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        .glass-orb {
          position: absolute;
          border-radius: 50%;
        }

        .glass-orb-1 {
          top: 5%;
          right: 10%;
          width: 450px;
          height: 450px;
          animation: orb-float-1 16s ease-in-out infinite;
        }
        .glass-orb-1::before {
          content: '';
          position: absolute;
          inset: 25%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.2) 0%, transparent 70%);
          animation: orb-pulse 4s ease-in-out infinite;
        }

        .glass-orb-2 {
          bottom: 10%;
          left: 5%;
          width: 350px;
          height: 350px;
          animation: orb-float-2 20s ease-in-out infinite;
        }
        .glass-orb-2::before {
          content: '';
          position: absolute;
          inset: 20%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(14, 165, 233, 0.15) 0%, transparent 70%);
          animation: orb-pulse 5s ease-in-out infinite 1s;
        }

        .glass-orb-3 {
          top: 50%;
          left: 35%;
          width: 280px;
          height: 280px;
          animation: orb-float-3 12s ease-in-out infinite;
        }
        .glass-orb-3::before {
          content: '';
          position: absolute;
          inset: 30%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56, 189, 248, 0.15) 0%, transparent 70%);
          animation: orb-pulse 3s ease-in-out infinite 0.5s;
        }

        .glass-orb-4 {
          top: 15%;
          left: 25%;
          width: 180px;
          height: 180px;
          animation: orb-float-2 14s ease-in-out infinite reverse;
          opacity: 0.5;
        }

        .glass-orb-5 {
          bottom: 25%;
          right: 15%;
          width: 220px;
          height: 220px;
          animation: orb-float-1 18s ease-in-out infinite reverse;
          opacity: 0.45;
        }

        /* Light mode glass crystals */
        .glass-crystal-light {
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.6) 0%,
            rgba(186, 230, 253, 0.4) 100%
          );
          border: 1px solid rgba(255, 255, 255, 0.8);
          box-shadow:
            0 0 30px rgba(6, 182, 212, 0.08),
            inset 0 0 25px rgba(255, 255, 255, 0.4);
        }

        /* Dark mode glass crystals */
        .glass-crystal-dark {
          backdrop-filter: blur(15px);
          -webkit-backdrop-filter: blur(15px);
          background: linear-gradient(
            180deg,
            rgba(51, 65, 85, 0.4) 0%,
            rgba(6, 182, 212, 0.1) 100%
          );
          border: 1px solid rgba(6, 182, 212, 0.2);
          box-shadow:
            0 0 30px rgba(6, 182, 212, 0.15),
            inset 0 0 25px rgba(6, 182, 212, 0.1);
        }

        @keyframes crystal-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes crystal-float {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(120deg) translateY(-15px); }
        }

        .glass-crystal {
          position: absolute;
        }

        .crystal-diamond {
          width: 90px;
          height: 90px;
          top: 25%;
          left: 10%;
          transform: rotate(45deg);
          animation: crystal-float 10s ease-in-out infinite;
        }

        .crystal-diamond-2 {
          width: 60px;
          height: 60px;
          top: 60%;
          right: 15%;
          transform: rotate(45deg);
          animation: crystal-float 8s ease-in-out infinite reverse;
        }

        .crystal-hexagon {
          width: 100px;
          height: 100px;
          top: 45%;
          left: 65%;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          animation: crystal-rotate 25s linear infinite;
        }

        .crystal-hexagon::before {
          content: '';
          position: absolute;
          inset: 8px;
          clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.5) 0%, transparent 100%);
          border: 1px solid rgba(255, 255, 255, 0.5);
        }

        .crystal-triangle {
          width: 70px;
          height: 70px;
          top: 70%;
          left: 40%;
          clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
          animation: crystal-rotate 20s linear infinite reverse;
        }

        /* Glass rings */
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.03); opacity: 0.55; }
        }
        @keyframes ring-expand {
          0% { transform: scale(0.9); opacity: 0; }
          50% { opacity: 0.3; }
          100% { transform: scale(1.2); opacity: 0; }
        }

        .glass-ring {
          position: absolute;
          border-radius: 50%;
          border: 2px solid rgba(6, 182, 212, 0.15);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          background: transparent;
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
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.4; }
          25% { transform: translateY(-25px) translateX(12px); opacity: 0.7; }
          50% { transform: translateY(-40px) translateX(-8px); opacity: 0.5; }
          75% { transform: translateY(-15px) translateX(-20px); opacity: 0.6; }
        }

        .particle {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.6) 0%, transparent 70%);
          box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
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
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        .glow-spot {
          position: absolute;
          border-radius: 50%;
          filter: blur(30px);
          animation: glow-pulse 7s ease-in-out infinite;
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
          animation-delay: 1.5s;
        }
        .glow-spot-3 {
          top: 48%;
          right: 8%;
          width: 180px;
          height: 180px;
          animation-delay: 3s;
        }

        /* Light rays */
        @keyframes ray-rotate {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
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
        }

        /* Glass card effect */
        .glass-card {
          background: rgba(255, 255, 255, 0.5);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.8);
          border-radius: 20px;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .glass-orb-1 { width: 280px; height: 280px; }
          .glass-orb-2 { width: 220px; height: 220px; }
          .glass-orb-3 { width: 160px; height: 160px; }
          .glass-crystal { transform: scale(0.7); }
          .glass-ring { transform: scale(0.8); }
        }
      `}</style>

      <div className={`bg-futuristic ${isDarkMode ? 'dark-mode-bg' : 'light-mode-bg'}`} aria-hidden="true">
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