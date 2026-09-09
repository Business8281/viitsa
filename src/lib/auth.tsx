import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, DEMO_CLINIC_ID } from './supabase';
import type { Clinic, Role, User } from './types';

interface AuthState {
  user: User | null;
  clinic: Clinic | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithOtp: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function loadProfile(email: string): Promise<{ user: User | null; clinic: Clinic | null }> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .eq('active', true)
    .maybeSingle();
  if (!data) return { user: null, clinic: null };

  const { data: clinicData } = await supabase
    .from('clinics')
    .select('*')
    .eq('clinic_id', data.clinic_id)
    .single();

  return { user: data as User, clinic: clinicData as Clinic };
}

async function checkAndCreateProfile(sessionUser: import('@supabase/supabase-js').User): Promise<{ user: User | null; clinic: Clinic | null }> {
  const { user: u, clinic: c } = await loadProfile(sessionUser.email ?? '');
  if (u) {
    return { user: u, clinic: c };
  }

  const metadata = sessionUser.user_metadata;
  if (metadata && metadata.role === 'admin') {
    const { data: newClinic, error: clinicError } = await supabase
      .from('clinics')
      .insert({
        name: metadata.clinic_name,
        owner_name: metadata.owner_name,
        phone: metadata.phone,
        city: metadata.city,
        email: sessionUser.email,
      })
      .select()
      .single();

    if (clinicError || !newClinic) {
      return { user: null, clinic: null };
    }

    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        user_id: sessionUser.id,
        clinic_id: newClinic.clinic_id,
        name: metadata.owner_name,
        email: sessionUser.email,
        phone: metadata.phone,
        role: 'admin',
        active: true,
        password_hash: 'supabase-auth',
      })
      .select()
      .single();

    if (userError || !newUser) {
      return { user: null, clinic: null };
    }

    return { user: newUser as User, clinic: newClinic as Clinic };
  }

  return { user: null, clinic: null };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        checkAndCreateProfile(session.user).then(({ user: u, clinic: c }) => {
          if (!mounted) return;
          setUser(u);
          setClinic(c);
          setLoading(false);
          if (!u) supabase.auth.signOut();
        });
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!session?.user) {
          setUser(null);
          setClinic(null);
          setLoading(false);
          return;
        }
        const { user: u, clinic: c } = await checkAndCreateProfile(session.user);
        setUser(u);
        setClinic(c);
        setLoading(false);
        if (!u) await supabase.auth.signOut();
      })();
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInError) {
        setLoading(false);
        return { ok: false, error: 'Invalid email or password.' };
      }
      if (data.user) {
        const { user: u, clinic: c } = await checkAndCreateProfile(data.user);
        if (!u) {
          await supabase.auth.signOut();
          setLoading(false);
          return { ok: false, error: 'User profile not found or inactive.' };
        }
        setUser(u);
        setClinic(c);
      }
      setLoading(false);
      return { ok: true };
    } catch (err) {
      setError('Login failed. Please try again.');
      setLoading(false);
      return { ok: false, error: 'Login failed. Please try again.' };
    }
  }, []);

  const loginWithOtp = useCallback(async (email: string) => {
    setError(null);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: false },
      });
      if (otpError) {
        return { ok: false, error: 'Unable to send login code.' };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: 'Unable to send login code.' };
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
      });
      if (verifyError) {
        setLoading(false);
        return { ok: false, error: 'Invalid verification code.' };
      }
      if (data.user) {
        const { user: u, clinic: c } = await checkAndCreateProfile(data.user);
        if (!u) {
          await supabase.auth.signOut();
          setLoading(false);
          return { ok: false, error: 'User profile not found or inactive.' };
        }
        setUser(u);
        setClinic(c);
      }
      setLoading(false);
      return { ok: true };
    } catch (err) {
      setError('Invalid verification code.');
      setLoading(false);
      return { ok: false, error: 'Invalid verification code.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setClinic(null);
    void supabase.auth.signOut();
  }, []);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { user: u, clinic: c } = await loadProfile(session.user.email ?? '');
      setUser(u);
      setClinic(c);
    } else {
      setUser(null);
      setClinic(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, clinic, loading, error, login, loginWithOtp, verifyEmailOtp, logout, refreshSession }),
    [user, clinic, loading, error, login, loginWithOtp, verifyEmailOtp, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { DEMO_CLINIC_ID };
