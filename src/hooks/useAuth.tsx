// hooks/useAuth.tsx
import { useState, useEffect, useCallback, useContext, createContext, useRef } from 'react';
import { supabase, User, Employee } from '../lib/supabase';
import type { User as AuthUser, Session } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UseAuthReturn {
  user: AuthUser | null;
  session: Session | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isClient: boolean;
  loading: boolean;
  profileLoading: boolean;
  hasSession: boolean;
  showAdminDashboard: boolean;
  showUserOrders: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<UseAuthReturn | null>(null);

const CACHE_DURATION = 10 * 60 * 1000; // 10 دقائق
const LS_KEY = 'auth_profile_cache';

// ─── localStorage helpers ─────────────────────────────────────────────────────
function readLSCache(email: string) {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (cached.email !== email) return null;
    if (Date.now() - cached.timestamp > CACHE_DURATION) return null;
    return cached as { email: string; emp: Employee | null; usr: User | null; timestamp: number };
  } catch { return null; }
}

function writeLSCache(email: string, emp: Employee | null, usr: User | null) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ email, emp, usr, timestamp: Date.now() }));
  } catch {}
}

function clearLSCache() {
  try { localStorage.removeItem(LS_KEY); } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [employeeProfile, setEmployeeProfile] = useState<Employee | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  const profileCache = useRef<{
    email: string;
    emp: Employee | null;
    usr: User | null;
    timestamp: number;
  } | null>(null);

  const isFetching = useRef(false);
  const currentEmailRef = useRef<string | null>(null);

  const fetchProfiles = useCallback(async (email: string, forceRefresh = false) => {
    // 1) تحقق من memory cache
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

    // 2) تحقق من localStorage cache — يحل مشكلة التحميل عند الـ refresh
    if (!forceRefresh) {
      const lsCache = readLSCache(email);
      if (lsCache) {
        profileCache.current = lsCache;
        setEmployeeProfile(lsCache.emp);
        setUserProfile(lsCache.usr);
        setProfileLoading(false);
        setLoading(false);
        // جيب من DB في الخلفية بدون إظهار loading
        setTimeout(() => fetchProfiles(email, true), 100);
        return;
      }
    }

    if (isFetching.current) return;
    isFetching.current = true;
    setProfileLoading(true);

    // 3) timeout مخفّض من 30s إلى 6s
    const timeout = setTimeout(() => {
      if (!isFetching.current) return;
      console.warn('useAuth: DB timeout — continuing without profile');
      // استخدم آخر cache موجود إذا كان عندنا
      const fallback = profileCache.current;
      if (fallback?.email === email) {
        setEmployeeProfile(fallback.emp);
        setUserProfile(fallback.usr);
      } else {
        setEmployeeProfile(null);
        setUserProfile(null);
      }
      setProfileLoading(false);
      setLoading(false);
      isFetching.current = false;
    }, 6000);

    try {
      const [{ data: emp, error: empError }, { data: usr, error: usrError }] = await Promise.all([
        supabase
          .from('employees')
          .select('employee_id, employee_role, is_active, employee_name, employee_email, employee_phone')
          .eq('employee_email', email)
          .maybeSingle(),
        supabase
          .from('user')
          .select('user_id, user_email, association_name, user_phone, entity_type, license_number')
          .eq('user_email', email)
          .maybeSingle(),
      ]);

      if (empError) console.warn('Employee fetch error:', empError.message);
      if (usrError) console.warn('User fetch error:', usrError.message);

      const empData = emp ?? null;
      const usrData = usr ?? null;

      profileCache.current = { email, emp: empData, usr: usrData, timestamp: Date.now() };
      writeLSCache(email, empData, usrData);

      setEmployeeProfile(empData);
      setUserProfile(usrData);
    } catch (err) {
      console.error('useAuth fetchProfiles:', err);
      // عند الخطأ استخدم آخر cache
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
      clearTimeout(timeout);
      setProfileLoading(false);
      setLoading(false);
      isFetching.current = false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (currentEmailRef.current) {
      await fetchProfiles(currentEmailRef.current, true);
    }
  }, [fetchProfiles]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user && !session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setLoading(false);
          setProfileLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user?.email) {
          currentEmailRef.current = session.user.email;
          setHasSession(true);
          await fetchProfiles(session.user.email);
        } else {
          setLoading(false);
          setProfileLoading(false);
        }
      } catch {
        if (mounted) {
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || event === 'INITIAL_SESSION') return;

        if (session?.user && !session.user.email_confirmed_at) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setHasSession(false);
          setEmployeeProfile(null);
          setUserProfile(null);
          setProfileLoading(false);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          currentEmailRef.current = null;
          profileCache.current = null;
          isFetching.current = false;
          clearLSCache();
          setHasSession(false);
          setEmployeeProfile(null);
          setUserProfile(null);
          setProfileLoading(false);
          setLoading(false);
          return;
        }

        if (session?.user?.email) {
          currentEmailRef.current = session.user.email;
          setHasSession(true);
          await fetchProfiles(session.user.email);
        }
      }
    );

    const refreshInterval = setInterval(() => {
      if (currentEmailRef.current && profileCache.current) {
        const age = Date.now() - profileCache.current.timestamp;
        if (age > CACHE_DURATION * 0.8) {
          fetchProfiles(currentEmailRef.current, true);
        }
      }
    }, 60_000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [fetchProfiles]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    if (data.user && !data.user.email_confirmed_at) {
      await supabase.auth.signOut();
      return { error: new Error('يرجى تأكيد بريدك الإلكتروني أولاً — تحقق من صندوق الوارد') };
    }
    return { error: null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('SignOut error (safe to ignore):', error);
    currentEmailRef.current = null;
    profileCache.current = null;
    isFetching.current = false;
    clearLSCache();
    setEmployeeProfile(null);
    setUserProfile(null);
    setHasSession(false);
    setSession(null);
    setUser(null);
    setLoading(false);
    setProfileLoading(false);
  }, []);

  const isAdmin = employeeProfile?.employee_role?.toLowerCase()?.trim() === 'admin'
    && (employeeProfile?.is_active === true || employeeProfile?.is_active as any === 'true');
  const isEmployee = employeeProfile?.employee_role?.toLowerCase()?.trim() === 'employee'
    && employeeProfile?.is_active === true;
  const isClient = !isAdmin && !isEmployee && !!user;

  const value: UseAuthReturn = {
    user, session, loading, profileLoading, hasSession,
    isAdmin, isEmployee, isClient,
    showAdminDashboard: isAdmin || isEmployee,
    showUserOrders: isClient,
    signIn, signUp, signOut, refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseAuthReturn {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be wrapped in <AuthProvider>');
  return ctx;
}