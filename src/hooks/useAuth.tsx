// hooks/useAuth.tsx
// ─────────────────────────────────────────────────────────────────────────────
// مزوّد المصادقة المركزي — يُغلّف التطبيق كله ويوفّر حالة المستخدم
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useCallback, useContext, createContext, useRef } from 'react';
import { supabase, User, Employee } from '../lib/supabase';
import type { User as AuthUser, Session } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Types ══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

interface UseAuthReturn {
  user:            AuthUser  | null;
  session:         Session   | null;
  userProfile:     User      | null;    // ← بيانات جدول user (association_name …)
  employeeProfile: Employee  | null;    // ← بيانات جدول employees
  isAdmin:         boolean;
  isEmployee:      boolean;
  isAdminOrEmployee: boolean;           // ← shorthand للصفحات المقيّدة (مثل العقود)
  isClient:        boolean;
  loading:         boolean;
  profileLoading:  boolean;
  hasSession:      boolean;
  showAdminDashboard: boolean;
  showUserOrders:     boolean;
  // ── WhatsApp ──
  /** user_id الجمعية أو employee_id الموظف الذي يُستخدم في عمليات واتساب */
  waUserId:        string | null;
  /** هل يملك الحساب الحالي صلاحية استخدام منصة واتساب */
  canUseWhatsApp:  boolean;
  signIn:         (email: string, password: string) => Promise<{ error: any }>;
  signUp:         (email: string, password: string) => Promise<{ error: any }>;
  signOut:        () => Promise<void>;
  refreshProfile: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  updatePassword:       (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  checkEmailExists:     (email: string) => Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Context ════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<UseAuthReturn | null>(null);

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Cache Helpers ══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const CACHE_DURATION = 10 * 60 * 1000;
const LS_KEY         = 'auth_profile_cache';
const CACHE_SALT     = 'alm_v1_';

type LSCacheEntry = {
  email:     string;
  emp:       Employee | null;
  usr:       User     | null;
  timestamp: number;
};

function encodeCache(data: object): string {
  try { return btoa(CACHE_SALT + JSON.stringify(data)); } catch { return ''; }
}

function decodeCache(encoded: string): LSCacheEntry | null {
  try {
    const decoded = atob(encoded);
    if (!decoded.startsWith(CACHE_SALT)) return null;
    return JSON.parse(decoded.slice(CACHE_SALT.length));
  } catch { return null; }
}

function readLSCache(email: string): LSCacheEntry | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cached = decodeCache(raw);
    if (!cached) return null;
    if (cached.email !== email) return null;
    if (Date.now() - cached.timestamp > CACHE_DURATION) return null;
    return cached;
  } catch { return null; }
}

function writeLSCache(email: string, emp: Employee | null, usr: User | null) {
  try {
    const safeEmp = emp ? {
      employee_id:    emp.employee_id,
      employee_role:  emp.employee_role,
      employee_name:  emp.employee_name,
      employee_email: emp.employee_email,
      is_active:      emp.is_active,
    } : null;

    const safeUsr = usr ? {
      user_id:           usr.user_id,
      user_email:        usr.user_email,
      association_name:  usr.association_name,
      entity_type:       usr.entity_type,
      is_review_blocked: usr.is_review_blocked,
    } : null;

    localStorage.setItem(LS_KEY, encodeCache({ email, emp: safeEmp, usr: safeUsr, timestamp: Date.now() }));
  } catch {}
}

function clearLSCache() {
  try {
    ['auth_profile_cache', 'user_profile', 'emp_profile'].forEach(k => localStorage.removeItem(k));
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ Rate Limiter ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

const loginAttempts = { count: 0, blockedUntil: 0 };

function checkLoginRateLimit(): { allowed: boolean; waitSeconds: number } {
  const now = Date.now();
  if (now < loginAttempts.blockedUntil)
    return { allowed: false, waitSeconds: Math.ceil((loginAttempts.blockedUntil - now) / 1000) };
  return { allowed: true, waitSeconds: 0 };
}

function recordLoginAttempt(success: boolean) {
  if (success) { loginAttempts.count = 0; loginAttempts.blockedUntil = 0; return; }
  loginAttempts.count++;
  if (loginAttempts.count >= 5) {
    const mins = Math.min(30, Math.pow(2, loginAttempts.count - 5));
    loginAttempts.blockedUntil = Date.now() + mins * 60_000;
  }
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ AuthProvider ════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ── قراءة الكاش قبل أي شيء لتحديد الحالة الأولية فوراً ──────────────────
  const _initialCache = (() => {
    try {
      // أولاً: نحاول نقرأ الكاش مباشرة بدون ما نحتاج الإيميل
      const rawCache = localStorage.getItem('auth_profile_cache');
      if (rawCache) {
        const decoded = (() => {
          try {
            const d = atob(rawCache);
            const SALT = 'alm_v1_';
            if (!d.startsWith(SALT)) return null;
            return JSON.parse(d.slice(SALT.length));
          } catch { return null; }
        })();
        if (decoded?.email && decoded?.timestamp && Date.now() - decoded.timestamp < 10 * 60 * 1000) {
          return decoded as LSCacheEntry;
        }
      }
      // ثانياً: نحاول نقرأ الإيميل من sb-session
      const raw = localStorage.getItem('sb-session');
      if (!raw) return null;
      let email: string | null = null;
      try { email = JSON.parse(raw)?.user?.email; } catch {}
      if (!email) {
        // sb-session قد يكون base64
        try {
          const parts = raw.split('.');
          if (parts.length >= 2) email = JSON.parse(atob(parts[1]))?.email;
        } catch {}
      }
      if (!email) return null;
      return readLSCache(email);
    } catch { return null; }
  })();

  const [user,            setUser]            = useState<AuthUser  | null>(null);
  const [session,         setSession]         = useState<Session   | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee  | null>(_initialCache?.emp ?? null);
  const [userProfile,     setUserProfile]     = useState<User      | null>(_initialCache?.usr ?? null);
  const [loading,         setLoading]         = useState(!_initialCache);
  const [profileLoading,  setProfileLoading]  = useState(!_initialCache);
  const [hasSession,      setHasSession]      = useState(!!_initialCache);

  const profileCache    = useRef<LSCacheEntry | null>(_initialCache);
  const isFetching      = useRef(false);
  const currentEmailRef = useRef<string | null>(_initialCache?.email ?? null);

  // ─── fetchProfiles ────────────────────────────────────────────────────────────
  const fetchProfiles = useCallback(async (email: string, forceRefresh = false) => {
    if (!EMAIL_REGEX.test(email) || email.length > 254) {
      console.error('[useAuth] صيغة البريد غير صحيحة');
      setProfileLoading(false);
      setLoading(false);
      return;
    }

    // 1) Memory cache
    if (!forceRefresh && profileCache.current?.email === email) {
      const age = Date.now() - profileCache.current.timestamp;
      if (age < CACHE_DURATION) {
        setEmployeeProfile(profileCache.current.emp);
        setUserProfile(profileCache.current.usr);
        setProfileLoading(false);
        setLoading(false);
        return;
      }
    }

    // 2) localStorage cache — يُظهر البيانات فوراً ثم يجلب تحديثاً في الخلفية
    if (!forceRefresh) {
      const lsCache = readLSCache(email);
      if (lsCache) {
        profileCache.current = lsCache;
        setEmployeeProfile(lsCache.emp);
        setUserProfile(lsCache.usr);
        setProfileLoading(false);
        setLoading(false);
        // فقط نجدد إذا الكاش عمره أكثر من دقيقتين — يمنع الاهتزاز
        const cacheAge = Date.now() - lsCache.timestamp;
        if (cacheAge > 2 * 60 * 1000) {
          setTimeout(() => fetchProfiles(email, true), 2000);
        }
        return;
      }
    }

    // منع طلبات متزامنة
    if (isFetching.current) {
      await new Promise(r => setTimeout(r, 50));
      if (isFetching.current) return;
    }
    isFetching.current = true;
    setProfileLoading(true);

    const timeoutPromise = new Promise<'timeout'>(resolve =>
      setTimeout(() => resolve('timeout'), 3000)
    );

    const fetchPromise = Promise.all([
      supabase
        .from('employees')
        .select('employee_id, employee_role, is_active, employee_name, employee_email')
        .eq('employee_email', email)
        .maybeSingle(),
      supabase
        .from('user')
        .select('user_id, user_email, association_name, entity_type, is_review_blocked')
        .eq('user_email', email)
        .maybeSingle(),
    ]);

    try {
      const result = await Promise.race([fetchPromise, timeoutPromise]);

      if (result === 'timeout') {
        console.warn('[useAuth] ⚠️ تأخرت قاعدة البيانات، يُستخدم الكاش');
        const fallback = readLSCache(email);
        if (fallback) {
          setEmployeeProfile(fallback.emp);
          setUserProfile(fallback.usr);
        }
        setProfileLoading(false);
        setLoading(false);
        isFetching.current = false;
        setTimeout(() => fetchProfiles(email, true), 5000);
        return;
      }

      const [{ data: emp, error: empErr }, { data: usr, error: usrErr }] = result;

      if (empErr) console.warn('[useAuth] Employee error:', empErr.message);
      if (usrErr)  console.warn('[useAuth] User error:',     usrErr.message);

      const empData = emp ?? null;
      const usrData = usr ?? null;

      profileCache.current = { email, emp: empData, usr: usrData, timestamp: Date.now() };
      writeLSCache(email, empData, usrData);
      setEmployeeProfile(empData);
      setUserProfile(usrData);

    } catch (err) {
      console.error('[useAuth] fetchProfiles خطأ:', err);
      const fallback = readLSCache(email);
      if (fallback) {
        setEmployeeProfile(fallback.emp);
        setUserProfile(fallback.usr);
      } else {
        profileCache.current = { email, emp: null, usr: null, timestamp: Date.now() };
        setEmployeeProfile(null);
        setUserProfile(null);
      }
    } finally {
      setProfileLoading(false);
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  // ─── refreshProfile ───────────────────────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (currentEmailRef.current) await fetchProfiles(currentEmailRef.current, true);
  }, [fetchProfiles]);

  // ─── Bootstrap + Auth Listener ────────────────────────────────────────────────
  useEffect(() => {
    let mounted       = true;
    let bootstrapDone = false;

    // Safety timeout — يوقف loading فقط، لا يسجّل خروج
    const globalTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[useAuth] Safety timeout');
        setLoading(false);
        setProfileLoading(false);
      }
    }, 4_000);

    const bootstrap = async () => {
      if (bootstrapDone) return;
      bootstrapDone = true;
      try {
        // ── خطوة 0: عرض الكاش فوراً قبل أي طلب شبكة ──────────────────────────
        try {
          // قراءة الكاش مباشرة من auth_profile_cache
          const rawCache = localStorage.getItem('auth_profile_cache');
          if (rawCache) {
            try {
              const d = atob(rawCache);
              const SALT = 'alm_v1_';
              if (d.startsWith(SALT)) {
                const decoded = JSON.parse(d.slice(SALT.length));
                if (decoded?.email && decoded?.timestamp && Date.now() - decoded.timestamp < 10 * 60 * 1000 && mounted) {
                  setEmployeeProfile(decoded.emp);
                  setUserProfile(decoded.usr);
                  currentEmailRef.current = decoded.email;
                  setHasSession(true);
                  setLoading(false);
                  setProfileLoading(false);
                  profileCache.current = decoded;
                }
              }
            } catch {}
          }
        } catch {}

        // ── خطوة 1: جلب الـ session من Supabase ──────────────────────────────
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (!mounted) return;

        if (sessionError && !sessionData?.session) {
          console.log('[useAuth] فشل استرداد الجلسة');
          if (mounted) { setLoading(false); setProfileLoading(false); setHasSession(false); }
          return;
        }

        const sess = sessionData?.session;

        if (!sess?.user) {
          if (mounted) {
            setUser(null); setSession(null);
            setHasSession(false); setLoading(false); setProfileLoading(false);
          }
          return;
        }

        if (mounted) {
          setSession(sess);
          setUser(sess.user);
          currentEmailRef.current = sess.user.email ?? null;
          setHasSession(true);
        }

        if (sess.user.email && mounted) {
          // تحقق من الكاش مباشرة من localStorage
          const rawC = localStorage.getItem('auth_profile_cache');
          let cacheValid = false;
          if (rawC) {
            try {
              const d = atob(rawC);
              if (d.startsWith('alm_v1_')) {
                const parsed = JSON.parse(d.slice('alm_v1_'.length));
                const age = Date.now() - (parsed?.timestamp || 0);
                // إذا الكاش نفس المستخدم وعمره أقل من دقيقتين — لا نسوي fetch
                if (parsed?.email === sess.user.email && age < 2 * 60 * 1000) {
                  cacheValid = true;
                }
              }
            } catch {}
          }
          if (!cacheValid) {
            await fetchProfiles(sess.user.email);
          }
        }

      } catch (err) {
        console.error('[useAuth] خطأ غير متوقع:', err);
        if (mounted) { setLoading(false); setProfileLoading(false); }
      } finally {
        if (mounted) { setLoading(false); setProfileLoading(false); }
      }
    };

    // شغّل فوراً بدون تأخير
    bootstrap();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mounted) return;
        if (event === 'INITIAL_SESSION') return;

        setSession(sess);
        setUser(sess?.user ?? null);

        if (event === 'SIGNED_OUT') {
          currentEmailRef.current = null;
          profileCache.current    = null;
          isFetching.current      = false;
          clearLSCache();
          setHasSession(false);
          setEmployeeProfile(null);
          setUserProfile(null);
          setProfileLoading(false);
          setLoading(false);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (sess?.user?.email) {
            currentEmailRef.current = sess.user.email;
            setHasSession(true);

            // ── حفظ بيانات التسجيل من sessionStorage بعد التحقق من البريد ──
            const pending = sessionStorage.getItem('pending_registration');
            if (pending && sess.user.id) {
              try {
                const reg = JSON.parse(pending);
                if (reg.user_id === sess.user.id) {
                  // insert بدل upsert لكشف تعارض البريد أو الترخيص (unique violation 23505)
                  const { error: insertError } = await supabase.from('user').insert([{
                    user_id:           reg.user_id,
                    association_name:  reg.association_name,
                    user_phone:        reg.user_phone        || null,
                    user_email:        reg.user_email,
                    license_number:    reg.license_number    || null,
                    entity_type:       reg.entity_type       || null,
                    email_verified:    true,
                    email_verified_at: new Date().toISOString(),
                  }]);
                  if (insertError) {
                    if (insertError.code === '23505') {
                      console.error('[useAuth] تعارض بيانات التسجيل (بريد أو ترخيص مكرر):', insertError.details);
                    } else {
                      console.error('[useAuth] خطأ حفظ بيانات المستخدم:', insertError.message);
                    }
                  }
                  sessionStorage.removeItem('pending_registration');
                }
              } catch {}
            }

            await fetchProfiles(sess.user.email);
          }
        }
      }
    );

    // تحديث الكاش تلقائياً كل دقيقة إذا اقترب من الانتهاء
    const refreshInterval = setInterval(() => {
      if (currentEmailRef.current && profileCache.current) {
        const age = Date.now() - profileCache.current.timestamp;
        if (age > CACHE_DURATION * 0.8) fetchProfiles(currentEmailRef.current, true);
      }
    }, 60_000);

    return () => {
      mounted = false;
      clearTimeout(globalTimeout);
      clearInterval(refreshInterval);
      subscription.unsubscribe();
    };
  }, [fetchProfiles]);

  // ─── signIn ───────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    if (!email || !password)
      return { error: new Error('يرجى إدخال البريد الإلكتروني وكلمة المرور') };

    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 254)
      return { error: new Error('صيغة البريد الإلكتروني غير صحيحة') };
    if (password.length < 6 || password.length > 128)
      return { error: new Error('كلمة المرور غير صالحة') };

    const rateCheck = checkLoginRateLimit();
    if (!rateCheck.allowed)
      return { error: new Error(`تم تجاوز عدد المحاولات. حاول بعد ${rateCheck.waitSeconds} ثانية`) };

    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    recordLoginAttempt(!error);
    if (error) return { error };

    if (currentEmailRef.current && currentEmailRef.current !== cleanEmail) {
      clearLSCache();
      profileCache.current = null;
    }

    return { error: null };
  }, []);

  // ─── signUp ───────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail) || cleanEmail.length > 254)
      return { error: new Error('صيغة البريد الإلكتروني غير صحيحة') };
    if (password.length < 8 || password.length > 128)
      return { error: new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل') };

    const { error } = await supabase.auth.signUp({ email: cleanEmail, password });
    return { error };
  }, []);

  // ─── signOut ──────────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearLSCache();
    profileCache.current    = null;
    currentEmailRef.current = null;
    isFetching.current      = false;
    setUser(null);
    setSession(null);
    setEmployeeProfile(null);
    setUserProfile(null);
    setHasSession(false);
    setLoading(false);
    setProfileLoading(false);
  }, []);

  // ─── requestPasswordReset ─────────────────────────────────────────────────────
  // يرسل بريد استعادة كلمة المرور
  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      if (!email || !EMAIL_REGEX.test(email))
        return { success: false, error: 'صيغة البريد الإلكتروني غير صحيحة' };

      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
      });

      if (error) {
        if (error.message.includes('not found') || error.message.includes('not_found'))
          return { success: false, error: 'هذا البريد غير مسجّل في النظام' };
        return { success: false, error: error.message || 'حدث خطأ أثناء الإرسال' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[useAuth] requestPasswordReset error:', err);
      return { success: false, error: 'حدث خطأ غير متوقع' };
    }
  }, []);

  // ─── checkEmailExists ─────────────────────────────────────────────────────────
  // يتحقق إذا البريد مسجّل في جدول user أو employees قبل إرسال رابط الاستعادة
  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
  if (!email || !EMAIL_REGEX.test(email)) return false;
  const clean = email.trim().toLowerCase();
  try {
    const [{ data: userData }, { data: empExists }] = await Promise.all([
      supabase.from('user').select('user_id').eq('user_email', clean).maybeSingle(),
      supabase.rpc('check_employee_email_exists', { p_email: clean }),
    ]);
    return !!(userData || empExists);
  } catch {
    return true;
  }
}, []);

  // ─── updatePassword ────────────────────────────────────────────────────────────
  // تحديث كلمة المرور (بعد التحقق من الرابط)
  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      if (!newPassword || newPassword.length < 8)
        return { success: false, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' };
      if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword))
        return { success: false, error: 'كلمة المرور يجب أن تحتوي على حروف وأرقام' };

      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        if (error.message.includes('session'))
          return { success: false, error: 'انتهت صلاحية الجلسة. يرجى طلب رابط جديد' };
        return { success: false, error: error.message || 'فشل في تحديث كلمة المرور' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[useAuth] updatePassword error:', err);
      return { success: false, error: 'حدث خطأ غير متوقع' };
    }
  }, []);

  // ─── Computed roles ───────────────────────────────────────────────────────────
  const isAdmin = !!employeeProfile &&
    employeeProfile.employee_role?.toLowerCase().trim() === 'admin' &&
    employeeProfile.is_active === true;

  const isEmployee = !!employeeProfile &&
    employeeProfile.employee_role?.toLowerCase().trim() === 'employee' &&
    employeeProfile.is_active === true;

  // أدمن أو موظف — يُستخدم لحماية صفحات العقود وغيرها
  const isAdminOrEmployee = isAdmin || isEmployee;

  const isClient = !isAdmin && !isEmployee && !!user;

  // ─── WhatsApp Computed ────────────────────────────────────────────────────────
  // waUserId: employee_id للموظف/الأدمن فقط
  const waUserId: string | null = employeeProfile?.employee_id ?? null;

  // canUseWhatsApp: الأدمن والموظف النشط فقط — مطابق لـ isAdminOrEmployee
  const canUseWhatsApp: boolean = isAdminOrEmployee;

  // ─── Value ────────────────────────────────────────────────────────────────────
  const value: UseAuthReturn = {
    user,
    session,
    userProfile,
    employeeProfile,
    isAdmin,
    isEmployee,
    isAdminOrEmployee,
    isClient,
    loading,
    profileLoading,
    hasSession,
    showAdminDashboard: isAdmin || isEmployee,
    showUserOrders:     isClient,
    // WhatsApp
    waUserId,
    canUseWhatsApp,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    requestPasswordReset,
    updatePassword,
    checkEmailExists,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══ useAuth Hook ════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth يجب أن يُستخدم داخل <AuthProvider>');
  return ctx;
}