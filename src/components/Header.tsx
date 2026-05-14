import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate, useLocation, NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import logoImg from '../img/Logo.png';
import { NotificationsPanel } from './NotificationsPanel';

interface HeaderProps {
  onLoginClick: () => void;
  onRegisterClick: () => void;
  onSignOut: () => void;
  isAdmin: boolean;
  isEmployee: boolean;
  user: any;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export function Header({
  onLoginClick,
  onRegisterClick,
  onSignOut,
  isAdmin,
  isEmployee,
  user,
  isDarkMode = false,
  onToggleDarkMode
}: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPage = location.pathname;

  // ✅ استخدام useRef للـ observers عشان نقدر ننظفهم
  const observerRef = useRef<IntersectionObserver | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [manualIsAdmin, setManualIsAdmin] = useState(false);
  const [manualIsEmployee, setManualIsEmployee] = useState(false);
  const [manualIsClient, setManualIsClient] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileData, setProfileData] = useState<any>(null);

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isPagesDropdownOpen, setIsPagesDropdownOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [time, setTime] = useState(new Date());
  // ✅ تنظيف كل الـ observers لما الصفحة تتغير
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (timeIntervalRef.current) {
        clearInterval(timeIntervalRef.current);
      }
    };
  }, [currentPage]);

  // ✅ useEffect للـ profile مع isMounted flag
  useEffect(() => {
    if (!user?.email) {
      setProfileLoading(false);
      return;
    }
    
    let isMounted = true;
    
    const checkUser = async () => {
      setProfileLoading(true);
      try {
        const { data: emp } = await supabase
          .from('employees')
          .select('employee_role, is_active, employee_name')
          .eq('employee_email', user.email)
          .eq('is_active', true)
          .maybeSingle();
        
        if (!isMounted) return;
        
        if (emp) {
          const role = emp.employee_role?.toLowerCase();
          setManualIsAdmin(role === 'admin');
          setManualIsEmployee(role === 'employee' || role === 'admin');
          setManualIsClient(false);
          setProfileData({ ...emp, type: 'employee' });
        } else {
          const { data: usr } = await supabase
            .from('user')
            .select('user_id, association_name')
            .eq('user_email', user.email)
            .maybeSingle();
          
          if (!isMounted) return;
          
          if (usr) {
            setManualIsAdmin(false);
            setManualIsEmployee(false);
            setManualIsClient(true);
            setProfileData({ ...usr, type: 'client' });
          } else {
            setProfileData(null);
          }
        }
      } catch (err) {
        console.error('Header checkUser error:', err);
      } finally {
        if (isMounted) setProfileLoading(false);
      }
    };
    
    checkUser();
    
    return () => { isMounted = false; };
  }, [user]);

  // ✅ Scroll handler مع throttle (100ms)
  useEffect(() => {
    const handleScroll = () => {
      if (scrollTimeoutRef.current) return;
      
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolled(window.scrollY > 50);
        scrollTimeoutRef.current = null;
      }, 100);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  // ✅ Time interval مع cleanup
  useEffect(() => {
    timeIntervalRef.current = setInterval(() => setTime(new Date()), 1000);
    return () => {
      if (timeIntervalRef.current) clearInterval(timeIntervalRef.current);
    };
  }, []);

  // ✅ IntersectionObserver مع cleanup صحيح
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (currentPage !== '/') return;

    const sections = document.querySelectorAll('section[id]');
    if (sections.length === 0) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.3, rootMargin: '-100px 0px -50% 0px' }
    );

    sections.forEach((section) => observerRef.current?.observe(section));

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [currentPage]);

  const finalIsAdmin = isAdmin || manualIsAdmin;
  const finalIsEmployee = isEmployee || manualIsEmployee;
  const finalIsClient = manualIsClient;

  const handleLogout = useCallback(async () => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    try {
      await supabase.auth.signOut();
      onSignOut?.();
      navigate('/', { replace: true });
    } catch (error) {
      navigate('/', { replace: true });
    }
  }, [navigate, onSignOut]);

  const handleNavClick = useCallback((href: string) => {
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    if (currentPage !== '/') {
      navigate('/');
      setTimeout(() => {
        document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    } else {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentPage, navigate]);

  const formatTime = useCallback((d: Date) =>
    d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
  []);

  const getDisplayName = useCallback(() => {
    if (profileLoading) return 'جاري التحميل...';
    if (profileData?.type === 'employee') return profileData.employee_name;
    if (profileData?.type === 'client') return profileData.association_name;
    return user?.email?.split('@')[0] || 'مستخدم';
  }, [profileLoading, profileData, user]);

  const navLinks = [
    { href: '#home', label: 'الرئيسية', icon: 'fa-home' },
    { href: '#services', label: 'خدماتنا', icon: 'fa-layer-group' },
    { href: '#products', label: 'منتجاتنا', icon: 'fa-box-open' },
    { href: '#partners', label: 'شركاؤنا', icon: 'fa-handshake' },
    { href: '#news', label: 'الأخبار', icon: 'fa-newspaper' },
    { href: '#stats', label: 'إحصائياتنا', icon: 'fa-chart-bar' },
  ];

  // الأقسام التي تنتمي للصفحة الرئيسية فقط (لا تُغيّر الـ active)
  const homeSectionIds = ['home', 'services', 'products', 'partners', 'news', 'stats'];

  // الصفحات المستقلة (خارج الـ home) – الدائرة تبقى على الرئيسية
  const isOnHomePage = currentPage === '/';

  // دالة لتحديد هل الزر active
  const isNavActive = (href: string) => {
    // الدائرة الزرقاء تبقى دائماً على الرئيسية — سواء على الصفحة الرئيسية أو غيرها
    return href === '#home';
  };

  return (
    <>
      <style>{`
        :root {
          --sky: #0ea5e9;
          --sky-dark: #0284c7;
          --sky-light: #e0f2fe;
          --sky-glow: rgba(14, 165, 233, 0.35);
          --sky-ultra: rgba(14, 165, 233, 0.08);
        }

        @keyframes shimmer {
          0% { background-position: 200% 0 }
          100% { background-position: -200% 0 }
        }
        @keyframes pulse-ring { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
          70% { box-shadow: 0 0 0 8px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        @keyframes scan-line {
          0% { transform: translateY(-100%); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        @keyframes grid-move {
          0% { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes float-up {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes data-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes border-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes dropdown-in {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
          header.futuristic-header::before {
            animation: none;
            background: var(--sky);
            opacity: 0.6;
          }
          .logo-img-ring {
            animation: none;
            box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.3);
          }
          header.futuristic-header.scrolled {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            background: rgba(255, 255, 255, 0.97);
          }
          header.futuristic-header.scrolled.dark-header {
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            background: rgba(15, 23, 42, 0.98);
          }
          .scan-line, .header-grid-bg {
            display: none !important;
          }
        }

        header.futuristic-header {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 0;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          background: transparent;
          direction: rtl;
          will-change: transform;
          isolation: isolate;
          box-sizing: border-box;
        }

        header.futuristic-header.scrolled {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(24px) saturate(180%);
          -webkit-backdrop-filter: blur(24px) saturate(180%);
          border-bottom: 1px solid rgba(14, 165, 233, 0.15);
          box-shadow:
            0 4px 32px rgba(14, 165, 233, 0.12),
            0 1px 0 rgba(255,255,255,0.8) inset;
        }

        header.futuristic-header.scrolled.dark-header {
          background: rgba(15, 23, 42, 0.95);
          border-bottom: 1px solid rgba(6, 182, 212, 0.2);
          box-shadow: 0 4px 32px rgba(6, 182, 212, 0.08);
        }

        header.futuristic-header.dark-header .logo-title {
          background: linear-gradient(135deg, #7dd3fc, #38bdf8);
          -webkit-background-clip: text;
          background-clip: text;
        }
        header.futuristic-header.dark-header .logo-sub { color: #94a3b8; }
        header.futuristic-header.dark-header .header-clock { color: #38bdf8; background: rgba(6,182,212,0.1); border-color: rgba(6,182,212,0.2); }
        header.futuristic-header.dark-header .nav-pill-btn { color: #94a3b8; }
        header.futuristic-header.dark-header .nav-pill-btn:hover { background: rgba(6,182,212,0.15); color: #38bdf8; }
        header.futuristic-header.dark-header .header-nav-pill { background: rgba(15,23,42,0.7); border-color: rgba(6,182,212,0.2); }
        header.futuristic-header.dark-header .user-avatar-btn { background: rgba(30,41,59,0.9); border-color: rgba(6,182,212,0.3); }
        header.futuristic-header.dark-header .user-name-text { color: #e2e8f0; }
        header.futuristic-header.dark-header .mobile-menu-btn-new { background: rgba(30,41,59,0.8); border-color: rgba(6,182,212,0.3); color: #38bdf8; }
        header.futuristic-header.dark-header .dark-mode-toggle-btn { background: rgba(30,41,59,0.8); border-color: rgba(6,182,212,0.3); color: #38bdf8; }

        header.futuristic-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg,
            transparent 0%,
            var(--sky) 20%,
            #38bdf8 50%,
            var(--sky) 80%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: border-flow 3s ease infinite;
        }

        .header-inner {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 64px;
          height: auto;
          gap: 16px;
          box-sizing: border-box;
          flex-wrap: nowrap;
        }
        @media (max-width: 480px) {
          .header-inner {
            padding: 0 14px;
            gap: 8px;
            min-height: 58px;
          }
        }

        .header-logo-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          position: relative;
          flex-shrink: 0;
        }

        .logo-img-ring {
          position: relative;
          width: 46px;
          height: 46px;
          border-radius: 14px;
          overflow: hidden;
          border: 2px solid rgba(14, 165, 233, 0.3);
          box-shadow: 0 0 0 0 var(--sky-glow);
          animation: pulse-ring 2.5s ease infinite;
          flex-shrink: 0;
          background: var(--sky-ultra);
        }
        .logo-img-ring img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
        }

        .logo-text-block {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        @media (max-width: 360px) {
          .logo-text-block { display: none; }
        }
        .logo-title {
          font-family: 'Tajawal', sans-serif;
          font-weight: 900;
          font-size: 1rem;
          background: linear-gradient(135deg, #0c4a6e, var(--sky));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .logo-sub {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.65rem;
          color: #64748b;
          letter-spacing: 0.05em;
          font-weight: 600;
        }

        .header-clock {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 100px;
          background: var(--sky-ultra);
          border: 1px solid rgba(14, 165, 233, 0.15);
          font-family: 'Courier New', monospace;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--sky-dark);
          letter-spacing: 0.05em;
          animation: float-up 3s ease-in-out infinite;
        }
        .header-clock i { font-size: 0.65rem; animation: data-blink 1s step-start infinite; }
        @media (max-width: 768px) { .header-clock { display: none; } }

        .header-nav-pill {
          display: flex;
          align-items: center;
          gap: 2px;
          background: rgba(255,255,255,0.7);
          border: 1px solid rgba(14, 165, 233, 0.18);
          border-radius: 100px;
          padding: 4px;
          backdrop-filter: blur(12px);
          flex-shrink: 1;
          min-width: 0;
        }

        .nav-pill-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 100px;
          border: none;
          background: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.25s ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .nav-pill-btn:hover {
          background: var(--sky-light);
          color: var(--sky-dark);
        }
        .nav-pill-btn.active {
          background: linear-gradient(135deg, var(--sky), #38bdf8);
          color: white;
          box-shadow: 0 4px 12px var(--sky-glow);
        }
        .nav-pill-btn i { font-size: 0.72rem; }

        @media (max-width: 1200px) { .header-nav-pill { display: none; } }
        @media (max-width: 1200px) { .dash-quick-btn { display: none; } }
        @media (max-width: 1200px) { .btn-login { display: none; } }
        @media (max-width: 1200px) { .btn-register { display: none; } }
        @media (max-width: 1200px) { .user-avatar-btn { display: none; } }
        @media (max-width: 1200px) { .mobile-menu-btn-new { display: flex; } }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
          flex-wrap: nowrap;
        }

        .dash-quick-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 18px;
          border-radius: 100px;
          border: none;
          cursor: pointer;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.82rem;
          font-weight: 800;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          overflow: hidden;
        }
        
        .dash-quick-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.2), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .dash-quick-btn:hover::before { opacity: 1; }
        .dash-quick-btn:hover { transform: translateY(-2px) scale(1.04); }

        .dash-quick-btn.admin-dash {
          background: linear-gradient(135deg, var(--sky), #0284c7);
          color: white;
          box-shadow: 0 4px 16px var(--sky-glow);
        }
        .dash-quick-btn.client-dash {
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          box-shadow: 0 4px 16px rgba(16,185,129,0.35);
        }
        .dash-quick-btn .btn-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.9);
          animation: data-blink 1.2s ease infinite;
        }

        .btn-login {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: 100px;
          border: 2px solid rgba(14, 165, 233, 0.3);
          background: rgba(14, 165, 233, 0.06);
          color: var(--sky-dark);
          font-family: 'Tajawal', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .btn-login:hover {
          border-color: var(--sky);
          background: var(--sky-light);
          transform: translateY(-1px);
        }
        

        .btn-register {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          border-radius: 100px;
          border: none;
          background: linear-gradient(135deg, var(--sky), #38bdf8);
          color: white;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 16px var(--sky-glow);
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .btn-register:hover {
          transform: translateY(-2px) scale(1.05);
          box-shadow: 0 8px 24px var(--sky-glow);
        }
        

        .user-avatar-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 16px 6px 6px;
          border-radius: 100px;
          border: 2px solid rgba(14, 165, 233, 0.2);
          background: rgba(255,255,255,0.8);
          cursor: pointer;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
        }
        .user-avatar-btn:hover {
          border-color: var(--sky);
          box-shadow: 0 4px 16px var(--sky-glow);
          transform: translateY(-1px);
        }
        
        .avatar-circle {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--sky), #38bdf8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .user-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 0 0 rgba(16,185,129,0.4);
          animation: pulse-ring 2s ease infinite;
          flex-shrink: 0;
        }
        .user-name-text {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.8rem;
          font-weight: 700;
          color: #1e293b;
          max-width: 100px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .header-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          left: 0;
          width: 280px;
          background: rgba(255,255,255,0.97);
          border: 1px solid rgba(14, 165, 233, 0.15);
          border-radius: 20px;
          box-shadow:
            0 20px 60px rgba(14, 165, 233, 0.15),
            0 4px 16px rgba(0,0,0,0.08);
          overflow: hidden;
          animation: dropdown-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(24px);
          z-index: 200;
          will-change: transform, opacity;
        }

        .dropdown-header-strip {
          padding: 14px 16px;
          background: linear-gradient(135deg, rgba(14,165,233,0.08), rgba(56,189,248,0.05));
          border-bottom: 1px solid rgba(14,165,233,0.1);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .dropdown-user-info { flex: 1; overflow: hidden; }
        .dropdown-user-name {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.85rem;
          font-weight: 800;
          color: #0c4a6e;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .dropdown-user-role {
          font-family: 'Tajawal', sans-serif;
          font-size: 0.68rem;
          color: var(--sky-dark);
          font-weight: 600;
        }

        .dropdown-menu-items { padding: 8px; }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: none;
          background: none;
          width: 100%;
          text-decoration: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.83rem;
          font-weight: 700;
          color: #475569;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: right;
        }
        .dropdown-item:hover {
          background: var(--sky-ultra);
          color: var(--sky-dark);
          transform: translateX(-3px);
        }
        .dropdown-item .di-icon {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          flex-shrink: 0;
        }
        .dropdown-item.danger { color: #ef4444; }
        .dropdown-item.danger:hover { background: #fef2f2; color: #dc2626; }

        .dropdown-divider {
          height: 1px;
          background: rgba(14,165,233,0.1);
          margin: 6px 12px;
        }

        .mobile-menu-btn-new {
          display: none;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1.5px solid rgba(14, 165, 233, 0.25);
          background: rgba(255,255,255,0.8);
          cursor: pointer;
          align-items: center;
          justify-content: center;
          color: var(--sky-dark);
          font-size: 1rem;
          transition: all 0.25s ease;
          backdrop-filter: blur(8px);
        }
        .mobile-menu-btn-new:hover {
          background: var(--sky-light);
          border-color: var(--sky);
        }
        

        .mobile-overlay {
          position: fixed;
          inset: 0;
          background: rgba(12, 74, 110, 0.5);
          backdrop-filter: blur(4px);
          z-index: 900;
          animation: none;
        }

        .mobile-drawer {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: 300px;
          background: rgba(255,255,255,0.98);
          z-index: 950;
          padding: 0;
          overflow-y: auto;
          animation: slide-in-right 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
          direction: rtl;
          border-left: 1px solid rgba(14,165,233,0.15);
          box-shadow: -20px 0 60px rgba(14,165,233,0.15);
          will-change: transform;
          contain: layout style paint;
        }

        .mobile-drawer-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(14,165,233,0.1);
          background: linear-gradient(135deg, rgba(14,165,233,0.06), transparent);
        }
        .mobile-drawer-title {
          font-family: 'Tajawal', sans-serif;
          font-size: 1rem;
          font-weight: 900;
          color: #0c4a6e;
        }
        .mobile-close-btn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1.5px solid rgba(14,165,233,0.2);
          background: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #64748b;
          font-size: 0.85rem;
          transition: all 0.2s;
        }
        .mobile-close-btn:hover { background: #fef2f2; color: #ef4444; border-color: #fca5a5; }

        .mobile-nav-list { padding: 12px; flex: 1; }
        .mobile-nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 12px 14px;
          border-radius: 14px;
          border: none;
          background: none;
          font-family: 'Tajawal', sans-serif;
          font-size: 0.9rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          margin-bottom: 4px;
          transition: all 0.2s ease;
          text-align: right;
          text-decoration: none;
          box-sizing: border-box;
        }
        .mobile-nav-btn:hover, .mobile-nav-btn.active {
          background: var(--sky-light);
          color: var(--sky-dark);
        }
        .mobile-nav-btn .mn-icon {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: var(--sky-ultra);
          border: 1px solid rgba(14,165,233,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.78rem;
          color: var(--sky-dark);
          flex-shrink: 0;
        }

        .mobile-auth-area {
          padding: 16px;
          border-top: 1px solid rgba(14,165,233,0.1);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .floating-admin-btn {
          position: fixed;
          bottom: 32px;
          left: 32px;
          z-index: 50;
          display: flex;
          align-items: center;
          gap: 10px;
          background: linear-gradient(135deg, #f97316, #ea580c);
          color: white;
          padding: 14px 22px;
          border-radius: 50px;
          box-shadow: 0 8px 28px rgba(249,115,22,0.45);
          text-decoration: none;
          font-family: 'Tajawal', sans-serif;
          font-weight: 800;
          font-size: 14px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .floating-admin-btn:hover {
          transform: scale(1.06) translateY(-2px);
          box-shadow: 0 12px 36px rgba(249,115,22,0.55);
        }
        @media (max-width: 768px) {
          .floating-admin-btn {
            bottom: 20px;
            left: 16px;
            padding: 11px 16px;
            font-size: 13px;
            gap: 7px;
          }
          .floating-admin-btn span { display: none; }
        }

        @media (max-width: 1200px) {
          .desktop-only-link { display: none !important; }
        }

        .dark-mode-toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          border: 1.5px solid rgba(14,165,233,0.2);
          background: rgba(255,255,255,0.8);
          color: #64748b;
          cursor: pointer;
          transition: all 0.3s ease;
          flex-shrink: 0;
          backdrop-filter: blur(8px);
        }
        .dark-mode-toggle-btn:hover {
          background: var(--sky-light);
          border-color: var(--sky);
          color: var(--sky-dark);
        }
        .dark-mode-toggle-btn.dark {
          background: rgba(30,41,59,0.8);
          border-color: rgba(6,182,212,0.5);
          color: #38bdf8;
        }
        .dark-mode-toggle-btn.dark:hover {
          background: rgba(51,65,85,0.9);
          border-color: #06b6d4;
        }
        @keyframes skel-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skel-item {
          height: 40px;
          border-radius: 12px;
          background: linear-gradient(90deg, #f1f5f9 25%, #e0f2fe 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: skel-shimmer 1.5s infinite;
          margin-bottom: 8px;
        }

        @media (max-width: 768px) {
          .futuristic-header {
            contain: layout style paint;
            will-change: auto !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        /* Mobile-specific header stability */
        @media (max-width: 768px) and (hover: none) {
          header.futuristic-header {
            transform: translateZ(0);
            backface-visibility: hidden;
          }

          header.futuristic-header::before {
            animation: none !important;
          }

          .logo-img-ring {
            animation: none !important;
          }

          .header-clock {
            animation: none !important;
          }
        }
      
        /* ══ Header Mobile Performance ══ */
        @media (max-width: 768px) {
          .futuristic-header {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            background: rgba(240, 249, 255, 0.97) !important;
            will-change: auto !important;
            contain: layout style !important;
          }
          html.dark .futuristic-header {
            background: rgba(10, 17, 32, 0.98) !important;
          }
          .mobile-drawer {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          [class*="-dropdown"], [class*="-menu"], [class*="-notif"] {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
          button, a { -webkit-tap-highlight-color: transparent; }
          [class*="skel"] { animation-duration: 2.5s !important; }
        }
`}</style>

      <header 
  className={`futuristic-header${isScrolled ? ' scrolled' : ''}${isDarkMode ? ' dark-header' : ''}`}
  style={{ zIndex: 1000, isolation: 'isolate' }}
>
        <div className="header-inner">
          <Link to="/" className="header-logo-wrap">
            <div className="logo-img-ring">
              <img src={logoImg} alt="شعار المساعدة الإدارية" />
            </div>
            <div className="logo-text-block">
              <span className="logo-title">المساعدة الإدارية</span>
              <span className="logo-sub">AdminAide • KSA</span>
            </div>
          </Link>

          <div className="header-nav-pill">
            {navLinks.map((link) => (
              <button
                key={link.href}
                onClick={() => handleNavClick(link.href)}
                className={`nav-pill-btn${isNavActive(link.href) ? ' active' : ''}`}
              >
                <i className={`fas ${link.icon}`} />
                {link.label}
              </button>
            ))}
          </div>
          <div className="header-actions">
            {onToggleDarkMode && (
              <button
                onClick={onToggleDarkMode}
                className={`dark-mode-toggle-btn${isDarkMode ? ' dark' : ''}`}
                title={isDarkMode ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
              >
                {isDarkMode ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="5" fill="currentColor"/>
                    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="12" y1="1" x2="12" y2="3"/>
                      <line x1="12" y1="21" x2="12" y2="23"/>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                      <line x1="1" y1="12" x2="3" y2="12"/>
                      <line x1="21" y1="12" x2="23" y2="12"/>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                    </g>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="currentColor"/>
                  </svg>
                )}
              </button>
            )}

            <div className="header-clock">
              <i className="fas fa-circle" />
              {formatTime(time)}
            </div>

            {user && !profileLoading && (
              <>
                {(finalIsAdmin || finalIsEmployee) && (
                  <Link to="/dashboard" className="dash-quick-btn admin-dash">
                    <div className="btn-pulse" />
                    <i className="fas fa-th-large" style={{ fontSize: '0.8rem' }} />
                    <span>لوحة التحكم</span>
                  </Link>
                )}
                {finalIsClient && !finalIsAdmin && !finalIsEmployee && (
                  <Link to="/dashboard" className="dash-quick-btn client-dash">
                    <div className="btn-pulse" />
                    <i className="fas fa-clipboard-list" style={{ fontSize: '0.8rem' }} />
                    <span>طلباتي</span>
                  </Link>
                )}

                {/* ── زر واتساب — للأدمن والموظف فقط ── */}
                {(finalIsAdmin || finalIsEmployee) && (
                  <Link
                    to="/whatsapp"
                    title="منصة الرسائل"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                      border: '1.5px solid rgba(37,211,102,0.3)',
                      background: currentPage === '/whatsapp'
                        ? 'linear-gradient(135deg,#25d366,#128c7e)'
                        : 'rgba(37,211,102,0.07)',
                      color: currentPage === '/whatsapp' ? '#fff' : '#25d366',
                      transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                      textDecoration: 'none',
                      boxShadow: currentPage === '/whatsapp' ? '0 4px 14px rgba(37,211,102,0.4)' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (currentPage !== '/whatsapp') {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'linear-gradient(135deg,#25d366,#128c7e)';
                        (e.currentTarget as HTMLAnchorElement).style.color = '#fff';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 4px 14px rgba(37,211,102,0.4)';
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px) scale(1.08)';
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = '#25d366';
                      }
                    }}
                    onMouseLeave={e => {
                      if (currentPage !== '/whatsapp') {
                        (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.07)';
                        (e.currentTarget as HTMLAnchorElement).style.color = '#25d366';
                        (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                        (e.currentTarget as HTMLAnchorElement).style.transform = 'none';
                        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(37,211,102,0.3)';
                      }
                    }}
                  >
                    <i className="fab fa-whatsapp" style={{ fontSize: 20 }} />
                  </Link>
                )}
              </>
            )}

            {!user ? (
              <>
                {/* قائمة الصفحات المنسدلة - للزوار */}
                <div style={{ position: 'relative' }} className="desktop-only-link">
                  <button
                    onClick={() => setIsPagesDropdownOpen(!isPagesDropdownOpen)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 16px', borderRadius: 100,
                      border: '1.5px solid rgba(14,165,233,0.25)',
                      background: isPagesDropdownOpen ? 'var(--sky-light)' : 'rgba(14,165,233,0.06)',
                      color: 'var(--sky-dark)', fontFamily: 'Tajawal, sans-serif',
                      fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <i className="fas fa-th-large" style={{ fontSize: '0.72rem' }} />
                    الصفحات
                    <i className="fas fa-chevron-down" style={{ fontSize: '0.6rem', transition: 'transform 0.3s', transform: isPagesDropdownOpen ? 'rotate(180deg)' : 'none' }} />
                  </button>
                  {isPagesDropdownOpen && (
                    <>
                      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setIsPagesDropdownOpen(false)} />
                      <div className="header-dropdown" style={{ zIndex: 200, right: 0, left: 'auto' }}>
                        <div className="dropdown-header-strip">
                          <div className="di-icon" style={{ width: 38, height: 38, background: 'rgba(14,165,233,0.1)', color: 'var(--sky-dark)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <i className="fas fa-sitemap" />
                          </div>
                          <div className="dropdown-user-info">
                            <div className="dropdown-user-name">الصفحات</div>
                            <div className="dropdown-user-role">تصفح جميع الأقسام</div>
                          </div>
                        </div>
                        <div className="dropdown-menu-items">
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#home'); }}>
                            <div className="di-icon" style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--sky-dark)' }}><i className="fas fa-home" /></div>
                            الرئيسية
                          </button>
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#services'); }}>
                            <div className="di-icon" style={{ background: 'rgba(14,165,233,0.08)', color: 'var(--sky-dark)' }}><i className="fas fa-layer-group" /></div>
                            خدماتنا
                          </button>
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#products'); }}>
                            <div className="di-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669' }}><i className="fas fa-box-open" /></div>
                            منتجاتنا
                          </button>
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#partners'); }}>
                            <div className="di-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}><i className="fas fa-handshake" /></div>
                            شركاؤنا
                          </button>
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#news'); }}>
                            <div className="di-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}><i className="fas fa-newspaper" /></div>
                            الأخبار
                          </button>
                          <button className="dropdown-item" onClick={() => { setIsPagesDropdownOpen(false); handleNavClick('#stats'); }}>
                            <div className="di-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}><i className="fas fa-chart-bar" /></div>
                            إحصائياتنا
                          </button>
                          <div className="dropdown-divider" />
                          <Link to="/events" className="dropdown-item" onClick={() => setIsPagesDropdownOpen(false)}>
                            <div className="di-icon" style={{ background: 'rgba(6,182,212,0.1)', color: '#0891b2' }}><i className="fas fa-calendar-alt" /></div>
                            الفعاليات
                          </Link>
                          <Link to="/jobs" className="dropdown-item" onClick={() => setIsPagesDropdownOpen(false)}>
                            <div className="di-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}><i className="fas fa-briefcase" /></div>
                            الوظائف
                          </Link>
                          <div className="dropdown-divider" />
                          <Link to="/reviews" className="dropdown-item" onClick={() => setIsPagesDropdownOpen(false)}>
                            <div className="di-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}><i className="fas fa-star" /></div>
                            آراء العملاء
                          </Link>
                          <Link to="/projects" className="dropdown-item" onClick={() => setIsPagesDropdownOpen(false)}>
                            <div className="di-icon" style={{ background: 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}><i className="fas fa-project-diagram" /></div>
                            المشاريع
                          </Link>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button className="btn-login" onClick={onLoginClick}>
                  <i className="fas fa-lock" style={{ fontSize: '0.75rem' }} />
                  دخول
                </button>
                <button className="btn-register" onClick={onRegisterClick}>
                  <i className="fas fa-user-plus" style={{ fontSize: '0.75rem' }} />
                  إنشاء حساب
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* ── زر الإشعارات — يظهر لجميع المستخدمين المسجلين ── */}
            
              <NotificationsPanel
                userId={user?.id}
                onNavigate={(path) => navigate(path)}
              />

                {/* ── Avatar / Dropdown ── */}
                <div style={{ position: 'relative' }}>
                <button
                  className="user-avatar-btn"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                >
                  {profileLoading ? (
                    <div className="avatar-circle">
                      <i className="fas fa-spinner fa-spin" style={{ fontSize: '0.75rem' }} />
                    </div>
                  ) : (
                    <>
                      <div className="user-status-dot" />
                      <div className="avatar-circle">
                        <i className="fas fa-user" />
                      </div>
                      <span className="user-name-text">
                        {getDisplayName()}
                      </span>
                      <i
                        className={`fas fa-chevron-down`}
                        style={{
                          fontSize: '0.65rem',
                          color: '#94a3b8',
                          transition: 'transform 0.3s ease',
                          transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                        }}
                      />
                    </>
                  )}
                </button>

                {isDropdownOpen && (
                  <>
                    <div
                      style={{ position: 'fixed', inset: 0, zIndex: 100 }}
                      onClick={() => setIsDropdownOpen(false)}
                    />
                    <div className="header-dropdown" style={{ zIndex: 200 }}>
                      <div className="dropdown-header-strip">
                        <div className="avatar-circle" style={{ width: 38, height: 38, flexShrink: 0 }}>
                          <i className="fas fa-user" />
                        </div>
                        <div className="dropdown-user-info">
                          <div className="dropdown-user-name">{user.email}</div>
                          <div className="dropdown-user-role">
                            {finalIsAdmin ? 'مسؤول النظام' : finalIsEmployee ? 'موظف' : 'عميل'}
                          </div>
                        </div>
                      </div>

                      <div className="dropdown-menu-items">
                        {profileLoading ? (
                          <>
                            <div className="skel-item" />
                            <div className="skel-item" />
                          </>
                        ) : (
                          <>
                            {(finalIsAdmin || finalIsEmployee) && (
                              <>
                                <Link to="/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                                  <div className="di-icon" style={{ background: 'rgba(14,165,233,0.1)', color: 'var(--sky-dark)' }}>
                                    <i className="fas fa-th-large" />
                                  </div>
                                  لوحة التحكم
                                </Link>
                                <Link to="/add-news" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                                  <div className="di-icon" style={{ background: 'rgba(249,115,22,0.1)', color: '#f97316' }}>
                                    <i className="fas fa-bullhorn" />
                                  </div>
                                  نشر خبر جديد
                                </Link>
                              </>
                            )}
                            {finalIsClient && (
                              <Link to="/dashboard" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                                <div className="di-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                                  <i className="fas fa-clipboard-list" />
                                </div>
                                حالة طلباتي
                              </Link>
                            )}
                          </>
                        )}

                        <div className="dropdown-divider" />

                        <Link to="/profile" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                          <div className="di-icon" style={{ background: 'rgba(100,116,139,0.1)', color: '#64748b' }}>
                            <i className="fas fa-id-card" />
                          </div>
                          الملف الشخصي
                        </Link>

                        <div className="dropdown-divider" />

                        <Link to="/reviews" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                          <div className="di-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <i className="fas fa-star" />
                          </div>
                          آراء العملاء
                        </Link>

                        <Link to="/projects" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                          <div className="di-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' }}>
                            <i className="fas fa-project-diagram" />
                          </div>
                          المشاريع
                        </Link>

                        <Link to="/events" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                          <div className="di-icon" style={{ background: 'rgba(6,182,212,0.1)', color: '#0891b2' }}>
                            <i className="fas fa-calendar-alt" />
                          </div>
                          الفعاليات
                        </Link>

                        <Link to="/jobs" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                          <div className="di-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                            <i className="fas fa-briefcase" />
                          </div>
                          الوظائف
                        </Link>

                        {(finalIsAdmin || finalIsEmployee) && (
                          <Link to="/contracts" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                            <div className="di-icon" style={{ background: 'rgba(234,88,12,0.1)', color: '#ea580c' }}>
                              <i className="fas fa-file-contract" />
                            </div>
                            العقود
                          </Link>
                        )}
                        
                        <div className="dropdown-divider" />

                        <button className="dropdown-item danger" onClick={handleLogout}>
                          <div className="di-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                            <i className="fas fa-sign-out-alt" />
                          </div>
                          تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              </div>
            )}

            <button
              className="mobile-menu-btn-new"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="القائمة"
            >
              <i className="fas fa-bars" />
            </button>
          </div>
        </div>
      </header>

      {user && (finalIsAdmin || finalIsEmployee) && !profileLoading && currentPage === '/' && (
        <Link to="/dashboard" className="floating-admin-btn">
          <span>إضافة خبر جديد</span>
          <i className="fas fa-plus-circle" style={{ fontSize: '18px' }} />
        </Link>
      )}

      {isMobileMenuOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setIsMobileMenuOpen(false)} />
          <nav className="mobile-drawer">
            <div className="mobile-drawer-top">
              <span className="mobile-drawer-title">القائمة الرئيسية</span>
              <button className="mobile-close-btn" title="إغلاق القائمة" onClick={() => setIsMobileMenuOpen(false)}>
                <i className="fas fa-times" />
              </button>
            </div>

            <div className="mobile-nav-list">
              {navLinks.map((link) => {
                const iconColors: Record<string, { bg: string; color: string; border: string }> = {
                  '#home':     { bg: 'rgba(14,165,233,0.12)',  color: '#0ea5e9', border: '1px solid rgba(14,165,233,0.2)'  },
                  '#services': { bg: 'rgba(20,184,166,0.12)',  color: '#0d9488', border: '1px solid rgba(20,184,166,0.2)'  },
                  '#products': { bg: 'rgba(16,185,129,0.12)',  color: '#059669', border: '1px solid rgba(16,185,129,0.2)'  },
                  '#partners': { bg: 'rgba(249,115,22,0.12)',  color: '#ea580c', border: '1px solid rgba(249,115,22,0.2)'  },
                  '#news':     { bg: 'rgba(239,68,68,0.12)',   color: '#dc2626', border: '1px solid rgba(239,68,68,0.2)'   },
                  '#stats':    { bg: 'rgba(139,92,246,0.12)',  color: '#7c3aed', border: '1px solid rgba(139,92,246,0.2)'  },
                };
                const c = iconColors[link.href] ?? { bg: 'rgba(14,165,233,0.1)', color: '#0284c7', border: '1px solid rgba(14,165,233,0.15)' };
                return (
                  <button
                    key={link.href}
                    className={`mobile-nav-btn${isNavActive(link.href) ? ' active' : ''}`}
                    onClick={() => handleNavClick(link.href)}
                  >
                    <div className="mn-icon" style={{ background: c.bg, color: c.color, border: c.border }}>
                      <i className={`fas ${link.icon}`} />
                    </div>
                    {link.label}
                  </button>
                );
              })}
              <NavLink
                to="/events"
                className={({ isActive }) => `mobile-nav-btn${isActive ? ' active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="mn-icon" style={{ background: 'rgba(20,184,166,0.12)', color: '#0d9488', border: '1px solid rgba(20,184,166,0.2)' }}><i className="fas fa-calendar-alt" /></div>
                الفعاليات
              </NavLink>
              <NavLink
                to="/jobs"
                className={({ isActive }) => `mobile-nav-btn${isActive ? ' active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="mn-icon" style={{ background: 'rgba(99,102,241,0.12)', color: '#4f46e5', border: '1px solid rgba(99,102,241,0.2)' }}><i className="fas fa-briefcase" /></div>
                الوظائف
              </NavLink>
              <NavLink
                to="/projects"
                className={({ isActive }) => `mobile-nav-btn${isActive ? ' active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="mn-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#7c3aed', border: '1px solid rgba(139,92,246,0.2)' }}><i className="fas fa-project-diagram" /></div>
                المشاريع
              </NavLink>
              <NavLink
                to="/reviews"
                className={({ isActive }) => `mobile-nav-btn${isActive ? ' active' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="mn-icon" style={{ background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.2)' }}><i className="fas fa-star" /></div>
                آراء العملاء
              </NavLink>
              {(finalIsAdmin || finalIsEmployee) && (
                <NavLink
                  to="/contracts"
                  className={({ isActive }) => `mobile-nav-btn${isActive ? ' active' : ''}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <div className="mn-icon" style={{ background: 'rgba(234,88,12,0.12)', color: '#ea580c', border: '1px solid rgba(234,88,12,0.2)' }}><i className="fas fa-file-contract" /></div>
                  العقود
                </NavLink>
              )}
            </div>

            <div className="mobile-auth-area">
              {onToggleDarkMode && (
                <button
                  onClick={() => { onToggleDarkMode(); setIsMobileMenuOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    padding: '12px 14px', borderRadius: '14px', fontWeight: '800',
                    cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: '0.88rem',
                    border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(14, 165, 233, 0.2)',
                    background: isDarkMode ? 'rgba(51, 65, 85, 0.5)' : 'rgba(6, 182, 212, 0.08)',
                    color: isDarkMode ? '#06b6d4' : '#0284c7',
                    width: '100%',
                  }}
                >
                  {isDarkMode ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="5"/>
                      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </g>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                    </svg>
                  )}
                  {isDarkMode ? 'الوضع الفاتح' : 'الوضع الداكن'}
                </button>
              )}

              {!user ? (
                <>
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); onLoginClick(); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '13px', background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)',
                      color: '#fff', borderRadius: '14px', border: 'none', fontWeight: '800',
                      cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem',
                      boxShadow: '0 4px 16px var(--sky-glow)',
                    }}
                  >
                    <i className="fas fa-lock" /> تسجيل الدخول
                  </button>
                  <button
                    onClick={() => { setIsMobileMenuOpen(false); onRegisterClick(); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      padding: '13px', background: '#fff', border: '2px solid rgba(14,165,233,0.3)',
                      color: '#0284c7', borderRadius: '14px', fontWeight: '800',
                      cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: '0.9rem',
                    }}
                  >
                    <i className="fas fa-user-plus" /> إنشاء حساب
                  </button>
                </>
              ) : profileLoading ? (
                <>
                  <div className="skel-item" />
                  <div className="skel-item" />
                </>
              ) : (
                <>
                  {(finalIsAdmin || finalIsEmployee) && (
                    <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 14px', background: 'linear-gradient(135deg,rgba(14,165,233,0.1),rgba(56,189,248,0.06))',
                        color: '#0284c7', borderRadius: '14px', fontWeight: '800', textDecoration: 'none',
                        fontFamily: 'Tajawal, sans-serif', fontSize: '0.88rem',
                        border: '1px solid rgba(14,165,233,0.2)',
                      }}>
                      <i className="fas fa-th-large" /> لوحة التحكم
                    </Link>
                  )}
                  {finalIsClient && (
                    <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '12px 14px', background: 'rgba(16,185,129,0.08)',
                        color: '#059669', borderRadius: '14px', fontWeight: '800', textDecoration: 'none',
                        fontFamily: 'Tajawal, sans-serif', fontSize: '0.88rem',
                        border: '1px solid rgba(16,185,129,0.2)',
                      }}>
                      <i className="fas fa-clipboard-list" /> حالة طلباتي
                    </Link>
                  )}
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '12px 14px', background: '#f8fafc',
                      color: '#475569', borderRadius: '14px', fontWeight: '800', textDecoration: 'none',
                      fontFamily: 'Tajawal, sans-serif', fontSize: '0.88rem',
                      border: '1px solid #e2e8f0',
                    }}>
                    <i className="fas fa-id-card" /> الملف الشخصي
                  </Link>
                  
                  <button onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                      padding: '12px', background: 'linear-gradient(135deg,#ef4444,#dc2626)',
                      color: '#fff', borderRadius: '14px', border: 'none', fontWeight: '800',
                      cursor: 'pointer', fontFamily: 'Tajawal, sans-serif', fontSize: '0.88rem',
                    }}>
                    <i className="fas fa-sign-out-alt" /> تسجيل الخروج
                  </button>
                </>
              )}
            </div>
          </nav>
        </>
      )}
    </>
  );
}