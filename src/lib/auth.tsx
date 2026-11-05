import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  signInWithCustomToken,
  GoogleAuthProvider, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signOut, 
  onAuthStateChanged,
  sendEmailVerification,
  applyActionCode,
  ConfirmationResult,
  User as FirebaseUser 
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { doc, setDoc, onSnapshot, deleteDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db, functions, DEFAULT_CLINIC_ID } from './firebase';
import type { Clinic, User, PatientAccount, Role } from './types';
import { PATIENT_ROLES, ADMIN_ROLES, CLINIC_ROLES } from './types';
import { resolveCanonicalIdentity, generateReadableId, sanitizeForFirestore, getOrInitializeClinic, getCachedIdentity, saveCachedIdentity, type OnboardingData, type IdentityResult } from './identityResolver';
import { clearAllViitsaCaches } from './cacheCleaner';
import { logUserLogin } from './auditLogger';
import { sendVerificationNotificationEmail } from './emailService';
import { getPasswordValidationError, assertPasswordUniqueness, claimPasswordHash } from './passwordSecurity';

export interface AuthResponse {
  ok: boolean;
  user?: User;
  clinic?: Clinic | null;
  patientAccount?: PatientAccount | null;
  role?: Role;
  error?: string;
  isNewUser?: boolean;
}

export type PortalType = 'clinic' | 'admin' | 'patient';

export const getPortalType = (expectedRole?: Role): PortalType => {
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/admin') || sessionStorage.getItem('viitsa_portal_intent') === 'admin') return 'admin';
    if (window.location.pathname.startsWith('/clinic') || sessionStorage.getItem('viitsa_portal_intent') === 'clinic') return 'clinic';
  }
  if (expectedRole) {
    if (ADMIN_ROLES.includes(expectedRole)) return 'admin';
    if (CLINIC_ROLES.includes(expectedRole)) return 'clinic';
  }
  return 'patient';
};

export const validatePortalRole = (role: Role, portal: PortalType | boolean): { ok: boolean; error?: string } => {
  const resolvedPortal: PortalType = typeof portal === 'boolean' ? (portal ? 'clinic' : 'patient') : portal;
  if (resolvedPortal === 'admin') {
    if (!ADMIN_ROLES.includes(role)) {
      return {
        ok: false,
        error: 'This account does not have Admin access. Please sign in with an Administrator account.'
      };
    }
  } else if (resolvedPortal === 'clinic') {
    if (!CLINIC_ROLES.includes(role)) {
      return {
        ok: false,
        error: 'This account is not registered as a Clinic account. The Clinic Portal requires a Clinic Staff or Clinic Admin account. Please sign in via the correct portal.'
      };
    }
  } else {
    // Patient portal
    if (CLINIC_ROLES.includes(role)) {
      return {
        ok: false,
        error: 'This account is registered as a Clinic account. The Patient Portal only accepts Patient accounts. Please sign in via the Clinic Portal (/clinic/login).'
      };
    }
    if (ADMIN_ROLES.includes(role)) {
      return {
        ok: false,
        error: 'This account is registered as an Admin account. Please sign in via the Admin Portal (/admin/login).'
      };
    }
  }
  return { ok: true };
};

interface AuthState {
  user: User | null;
  clinic: Clinic | null;
  patientAccount: PatientAccount | null;
  loading: boolean;
  error: string | null;
  setClinic: (clinic: Clinic | null) => void;
  switchClinic: (clinic: Clinic) => Promise<void>;
  loginWithEmail: (email: string, password: string, expectedRole?: Role) => Promise<AuthResponse>;
  registerWithEmail: (email: string, password: string, onboarding: OnboardingData) => Promise<AuthResponse>;
  resendVerificationEmail: (email: string, name?: string, portal?: 'clinic' | 'patient') => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogle: (onboarding?: OnboardingData) => Promise<AuthResponse>;
  sendPhoneOtp: (phone: string, recaptchaContainerId: string) => Promise<{ ok: boolean; error?: string }>;
  verifyPhoneOtp: (otp: string, onboarding?: OnboardingData) => Promise<AuthResponse>;
  updateUserRole: (role: Role, targetUserId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
  applyVerificationCode: (code: string) => Promise<{ ok: boolean; error?: string }>;
  sendWhatsAppLoginOtp: (phone: string, portal?: 'clinic' | 'patient' | 'admin', action?: 'login' | 'register') => Promise<{ ok: boolean; error?: string }>;
  loginWithWhatsAppOtp: (phone: string, otp: string, onboarding?: OnboardingData) => Promise<AuthResponse>;
  linkUserEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  // Legacy aliases for backward-compatibility with screens
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithGoogleLegacy: () => Promise<{ ok: boolean; error?: string }>;
  loginWithOtp: (email: string) => Promise<{ ok: boolean; error?: string }>;
  verifyEmailOtp: (email: string, token: string) => Promise<{ ok: boolean; error?: string }>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [patientAccount, setPatientAccount] = useState<PatientAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // Listen to Firebase Authentication state changes with instant sub-second local cache hydration
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        // 1. Immediately hydrate from local storage cache to unblock rendering in < 10ms!
        const cached = getCachedIdentity(firebaseUser.uid);
        if (cached) {
          setUser(cached.user);
          setClinic(cached.clinic);
          setPatientAccount(cached.patientAccount);
          setLoading(false);
        }

        // 2. Concurrently resolve canonical identity and keep cache fresh in background
        try {
          const res = await resolveCanonicalIdentity(firebaseUser);
          setUser(res.user);
          setClinic(res.clinic);
          setPatientAccount(res.patientAccount);
        } catch (err: any) {
          console.warn('Fallback on auth state change resolution:', err);
          if (!cached) {
            const fallbackUser: User = {
              user_id: firebaseUser.uid,
              clinic_id: undefined,
              clinic_name: undefined,
              name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
              email: firebaseUser.email || '',
              role: 'patient',
              phone: firebaseUser.phoneNumber || null,
              specialisation: null,
              active: true,
              avatar_color: '#0F6E56',
              created_at: new Date().toISOString(),
              linked_uids: [firebaseUser.uid],
              auth_providers: firebaseUser.providerData.map(p => p.providerId),
            };
            setUser(fallbackUser);
            setClinic(null);
          }
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time onSnapshot listener for live changes to user, clinic, and patient account
  useEffect(() => {
    if (!user?.user_id) return;
    const unsubUser = onSnapshot(doc(db, 'users', user.user_id), (snap) => {
      if (snap.exists()) {
        const uData = snap.data() as User;
        setUser((prev) => prev ? { ...prev, ...uData } : uData);
      }
    });

    let unsubClinic = () => {};
    if (user.clinic_id) {
      unsubClinic = onSnapshot(doc(db, 'clinics', user.clinic_id), (snap) => {
        if (snap.exists()) {
          const cData = { ...snap.data(), clinic_id: snap.id } as Clinic;
          setClinic(cData);
        }
      });
    }

    let unsubPat = () => {};
    const patId = user.patient_account_id || (PATIENT_ROLES.includes(user.role) ? `pat_${user.user_id}` : null);
    if (patId) {
      unsubPat = onSnapshot(doc(db, 'patient_accounts', patId), (snap) => {
        if (snap.exists()) {
          const pData = { ...snap.data(), account_id: snap.id } as PatientAccount;
          setPatientAccount(pData);
        }
      });
    }

    return () => {
      unsubUser();
      unsubClinic();
      unsubPat();
    };
  }, [user?.user_id, user?.clinic_id, user?.patient_account_id, user?.role]);

  // Email + Password Login
  const loginWithEmail = useCallback(async (email: string, password: string, expectedRole?: Role): Promise<AuthResponse> => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      const onboardingData = expectedRole ? { role: expectedRole, name: email.split('@')[0], email } : undefined;
      const res = await resolveCanonicalIdentity(cred.user, onboardingData);
      
      const portalType = getPortalType(expectedRole);
      const portalCheck = validatePortalRole(res.user.role, portalType);
      if (!portalCheck.ok) {
        try {
          await signOut(auth);
        } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        setError(portalCheck.error || 'Unauthorized portal role.');
        return { ok: false, error: portalCheck.error };
      }
      
      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'email' });
      return { ok: true, user: res.user, clinic: res.clinic, patientAccount: res.patientAccount, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password.'
        : (err.message || 'Login failed.');
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Email + Password Registration
  const registerWithEmail = useCallback(async (
    email: string, 
    password: string, 
    onboarding: OnboardingData
  ): Promise<AuthResponse> => {
    setError(null);
    const isClinic = onboarding?.role === 'clinic_admin' || 
      (onboarding?.role !== 'patient' && typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/clinic') ||
        sessionStorage.getItem('viitsa_portal_intent') === 'clinic'
      ));
    const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
      ? window.location.origin
      : 'https://viitsa.com';
    const continueUrl = `${origin}${isClinic ? '/clinic/login?verified=true' : '/login?verified=true'}`;
    const actionCodeSettings = {
      url: continueUrl,
      handleCodeInApp: true,
    };

    try {
      const cleanEmail = email.trim().toLowerCase();

      // Strict password complexity check (min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special symbol)
      const pwdError = getPasswordValidationError(password);
      if (pwdError) {
        setError(pwdError);
        return { ok: false, error: pwdError };
      }

      // Global password uniqueness check across all users
      const uniqueness = await assertPasswordUniqueness(password);
      if (!uniqueness.ok) {
        const err = uniqueness.error || 'This password is already in use by another user. Please choose a different password.';
        setError(err);
        return { ok: false, error: err };
      }

      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

      // Claim password hash globally for this user
      claimPasswordHash(uniqueness.hash, cred.user.uid, cleanEmail).catch(() => {});

      // 1. If email is already verified (e.g. Clinic dual OTP registration), DO NOT dispatch any verification email!
      if (!onboarding?.email_verified) {
        try {
          const verifRes = await sendVerificationNotificationEmail(cleanEmail, onboarding.name, continueUrl, isClinic ? 'clinic' : 'patient');
          if (!verifRes.success) {
            await sendEmailVerification(cred.user, actionCodeSettings).catch(() => sendEmailVerification(cred.user).catch(console.warn));
          }
        } catch (verifErr: any) {
          console.warn('Direct sendVerificationNotificationEmail warning, trying client SDK fallback:', verifErr);
          await sendEmailVerification(cred.user, actionCodeSettings).catch(() => sendEmailVerification(cred.user).catch(console.warn));
        }
      } else {
        // Email is ALREADY verified via 6-digit Email OTP! Mark in Firebase Auth directly without sending redundant email.
        try {
          const fn = httpsCallable(functions, 'markEmailVerified');
          await fn({ uid: cred.user.uid, email: cleanEmail });
        } catch (markErr) {
          console.warn('markEmailVerified call note:', markErr);
        }
      }

      // 2. Resolve database identity concurrently
      const res = await resolveCanonicalIdentity(cred.user, { ...onboarding, email: cleanEmail, role: isClinic ? 'clinic_admin' : (onboarding.role || 'patient') });

      // Keep user in active session without signing out so they stay on page waiting for confirmation
      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      return { ok: true, user: res.user, clinic: res.clinic, patientAccount: res.patientAccount, role: res.user.role, isNewUser: true };
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Please sign in instead.'
        : (err.message || 'Registration failed.');
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Resend Verification Email
  const resendVerificationEmail = useCallback(async (
    email: string,
    name?: string,
    portal?: 'clinic' | 'patient'
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const isClinic = portal === 'clinic' || (typeof window !== 'undefined' && (
        sessionStorage.getItem('viitsa_portal_intent') === 'clinic' || 
        window.location.pathname.startsWith('/clinic')
      ));
      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://viitsa.com';
      const continueUrl = `${origin}${isClinic ? '/clinic/login?verified=true' : '/login?verified=true'}`;

      // 1. Primary: Cloud Function via Titan SMTP (support@viitsa.com)
      const res = await sendVerificationNotificationEmail(cleanEmail, name, continueUrl, isClinic ? 'clinic' : 'patient');
      if (res.success) {
        return { ok: true };
      }

      // 2. Client SDK fallback if active session
      if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanEmail) {
        try {
          await sendEmailVerification(auth.currentUser, { url: continueUrl, handleCodeInApp: true });
          return { ok: true };
        } catch (urlErr: any) {
          if (urlErr.code === 'auth/unauthorized-continue-uri') {
            await sendEmailVerification(auth.currentUser);
            return { ok: true };
          }
          console.warn('Firebase client resend fallback warning:', urlErr);
        }
      }

      return { ok: false, error: res.error || 'Failed to resend verification email.' };
    } catch (err: any) {
      console.error('Failed to resend verification email:', err);
      return { ok: false, error: err.message || 'Failed to resend verification email.' };
    }
  }, []);

  // Google Sign-In (Supports Patients, Attendants, Doctors, and Clinic Staff)
  const loginWithGoogle = useCallback(async (onboarding?: OnboardingData): Promise<AuthResponse> => {
    setError(null);
    try {
      const isClinicPath = typeof window !== 'undefined' && (
        window.location.pathname.startsWith('/clinic') ||
        sessionStorage.getItem('viitsa_portal_intent') === 'clinic'
      );
      const defaultRole: Role = isClinicPath ? 'clinic_admin' : 'patient';

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      
      const effectiveOnboarding: OnboardingData = {
        role: onboarding?.role || defaultRole,
        ...onboarding,
      };

      let res: IdentityResult;
      try {
        res = await resolveCanonicalIdentity(cred.user, effectiveOnboarding);
      } catch (e: any) {
        console.error('resolveCanonicalIdentity error in loginWithGoogle:', e);
        try {
          await signOut(auth);
        } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        const errMsg = e.message || 'Authentication failed.';
        setError(errMsg);
        return { ok: false, error: errMsg };
      }

      // STRICT ADMIN CHECK: Platform Administrator accounts are strictly forbidden from Google Sign-In
      if (ADMIN_ROLES.includes(res.user.role)) {
        try {
          await signOut(auth);
        } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        const msg = 'Platform Administrator accounts must log in strictly using email and password at /admin/login.';
        setError(msg);
        return { ok: false, error: msg };
      }

      // Check portal alignment if specified
      const portalIntent = sessionStorage.getItem('viitsa_portal_intent');
      if (portalIntent === 'patient' && CLINIC_ROLES.includes(res.user.role)) {
        try { await signOut(auth); } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        const msg = 'This Google account is registered as a Clinic / Doctor account. Please sign in via the Clinic Portal (/clinic/login).';
        setError(msg);
        return { ok: false, error: msg };
      }
      if (portalIntent === 'clinic' && PATIENT_ROLES.includes(res.user.role)) {
        try { await signOut(auth); } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        const msg = 'This Google account is registered as a Patient account. Please sign in via the Patient Portal (/login).';
        setError(msg);
        return { ok: false, error: msg };
      }

      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'google' });
      return { ok: true, user: res.user, clinic: res.clinic, patientAccount: res.patientAccount, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return { ok: false };
      }
      try {
        await signOut(auth);
      } catch {}
      clearAllViitsaCaches();
      setUser(null);
      setClinic(null);
      setPatientAccount(null);
      const msg = err.message || 'Google sign in failed.';
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // WhatsApp OTP: Step 1 - Send OTP via Cloud Function & Meta Template phone_login_otps
  const sendWhatsAppLoginOtp = useCallback(async (
    phone: string,
    portal: 'clinic' | 'patient' | 'admin' = 'clinic',
    action: 'login' | 'register' = 'login'
  ): Promise<{ ok: boolean; error?: string }> => {
    setError(null);
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean.length < 10) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setError(msg);
      return { ok: false, error: msg };
    }

    try {
      const fn = httpsCallable(functions, 'sendWhatsAppAuthOtp');
      const res: any = await fn({ phone: clean, portal, action });
      if (res.data?.success) {
        return { ok: true };
      }
      throw new Error(res.data?.message || 'Failed to dispatch WhatsApp OTP.');
    } catch (err: any) {
      console.error('sendWhatsAppLoginOtp error:', err);
      const msg = err.message || 'Failed to send WhatsApp OTP. Please ensure your number is registered on WhatsApp.';
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // WhatsApp OTP: Step 2 - Verify Code & Login via Custom Token
  const loginWithWhatsAppOtp = useCallback(async (
    phone: string,
    otp: string,
    onboarding?: OnboardingData
  ): Promise<AuthResponse> => {
    setError(null);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanOtp = otp.trim();

    if (!cleanPhone || cleanPhone.length < 10) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setError(msg);
      return { ok: false, error: msg };
    }
    if (!cleanOtp) {
      const msg = 'Please enter the verification code sent to your WhatsApp.';
      setError(msg);
      return { ok: false, error: msg };
    }

    try {
      const fn = httpsCallable(functions, 'verifyWhatsAppAuthOtp');
      const res: any = await fn({
        phone: cleanPhone,
        otp: cleanOtp,
        onboarding,
      });

      if (!res.data?.success || !res.data?.customToken) {
        throw new Error(res.data?.message || 'Verification failed. Please check the OTP.');
      }

      const cred = await signInWithCustomToken(auth, res.data.customToken);
      const identityRes = await resolveCanonicalIdentity(cred.user, {
        phone: cleanPhone,
        ...onboarding,
      });

      // Platform admins are strictly forbidden from logging in via WhatsApp OTP
      if (ADMIN_ROLES.includes(identityRes.user.role)) {
        await signOut(auth);
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        const msg = 'Platform Administrator accounts must log in strictly using email and password at /admin/login.';
        setError(msg);
        return { ok: false, error: msg };
      }

      setUser(identityRes.user);
      setClinic(identityRes.clinic);
      setPatientAccount(identityRes.patientAccount);
      logUserLogin(identityRes.user.id || identityRes.user.user_id, identityRes.user.role, identityRes.user.clinic_id, { method: 'whatsapp_otp' });
      return {
        ok: true,
        user: identityRes.user,
        clinic: identityRes.clinic,
        patientAccount: identityRes.patientAccount,
        role: identityRes.user.role,
        isNewUser: identityRes.isNewUser,
      };
    } catch (err: any) {
      console.error('loginWithWhatsAppOtp error:', err);
      const msg = err.message || 'Failed to verify WhatsApp OTP. Please try again.';
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Link/Add Email to Current Profile (Non-blocking post-login email linking)
  const linkUserEmail = useCallback(async (newEmail: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'User is not authenticated' };
    const cleanEmail = newEmail.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(cleanEmail)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }

    try {
      // Check if email already claimed by another user
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      const existingOther = snap.docs.find(d => d.id !== user.user_id && d.data().user_id !== user.user_id);
      if (existingOther) {
        return { ok: false, error: 'This email is already linked to another account.' };
      }

      // Update users collection
      await updateDoc(doc(db, 'users', user.user_id), {
        email: cleanEmail,
        email_verified: false,
        updated_at: new Date().toISOString(),
      });

      // Update patient_accounts collection if patient
      const patId = user.patient_account_id || (PATIENT_ROLES.includes(user.role) ? `pat_${user.user_id}` : null);
      if (patId) {
        try {
          await updateDoc(doc(db, 'patient_accounts', patId), {
            email: cleanEmail,
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }

      // Update local React state
      setUser(prev => prev ? { ...prev, email: cleanEmail } : null);

      // Dispatch verification link via Titan SMTP / Cloud Functions
      const isClinic = CLINIC_ROLES.includes(user.role);
      const origin = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost') && !window.location.origin.includes('127.0.0.1'))
        ? window.location.origin
        : 'https://viitsa.com';
      const continueUrl = `${origin}${isClinic ? '/clinic/login?verified=true' : '/login?verified=true'}`;

      await sendVerificationNotificationEmail(cleanEmail, user.name, continueUrl, isClinic ? 'clinic' : 'patient');

      return { ok: true };
    } catch (err: any) {
      console.error('linkUserEmail error:', err);
      return { ok: false, error: err.message || 'Failed to link email address.' };
    }
  }, [user]);

  // Phone OTP: Step 1 - Send OTP
  const sendPhoneOtp = useCallback(async (
    phone: string, 
    recaptchaContainerId: string
  ): Promise<{ ok: boolean; error?: string }> => {
    setError(null);
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      const msg = 'Please enter a valid 10-digit mobile number.';
      setError(msg);
      return { ok: false, error: msg };
    }

    const fullPhone = clean.length === 10 ? `+91${clean}` : `+${clean}`;

    try {
      if (!(window as any).unifiedRecaptchaVerifier) {
        (window as any).unifiedRecaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: 'invisible',
          callback: () => {
            // reCAPTCHA solved
          },
          'expired-callback': () => {
            (window as any).unifiedRecaptchaVerifier = null;
          }
        });
      }

      const confirmation = await signInWithPhoneNumber(auth, fullPhone, (window as any).unifiedRecaptchaVerifier);
      setConfirmationResult(confirmation);
      return { ok: true };
    } catch (err: any) {
      console.error('sendPhoneOtp error:', err);
      // Reset reCAPTCHA on error
      (window as any).unifiedRecaptchaVerifier = null;
      const msg = err.code === 'auth/invalid-phone-number' 
        ? 'Invalid phone number format.' 
        : (err.message || 'Failed to send SMS OTP. Please check your number.');
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Phone OTP: Step 2 - Verify OTP
  const verifyPhoneOtp = useCallback(async (
    otp: string, 
    onboarding?: OnboardingData
  ): Promise<AuthResponse> => {
    if (!confirmationResult) {
      const msg = 'Session expired. Please request a new OTP.';
      setError(msg);
      return { ok: false, error: msg };
    }

    setError(null);

    try {
      const cred = await confirmationResult.confirm(otp.trim());
      const res = await resolveCanonicalIdentity(cred.user, onboarding);
      const portalType = getPortalType(onboarding?.role);
      const portalCheck = validatePortalRole(res.user.role, portalType);
      if (!portalCheck.ok) {
        try {
          await signOut(auth);
        } catch {}
        clearAllViitsaCaches();
        setUser(null);
        setClinic(null);
        setPatientAccount(null);
        setError(portalCheck.error || 'Unauthorized portal role.');
        return { ok: false, error: portalCheck.error };
      }

      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'phone' });
      return { ok: true, user: res.user, clinic: res.clinic, patientAccount: res.patientAccount, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      console.error('verifyPhoneOtp error:', err);
      const msg = err.code === 'auth/invalid-verification-code' 
        ? 'Incorrect OTP. Please try again.' 
        : (err.message || 'OTP verification failed.');
      setError(msg);
      return { ok: false, error: msg };
    }
  }, [confirmationResult]);

  const logout = useCallback(async () => {
    const role = user?.role;
    setUser(null);
    setClinic(null);
    setPatientAccount(null);
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out:', err);
    }
    await clearAllViitsaCaches();
    let loginPath = '/login';
    if (role && ADMIN_ROLES.includes(role)) loginPath = '/admin/login';
    else if (role && CLINIC_ROLES.includes(role)) loginPath = '/clinic/login';
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  }, [user]);



  // Refresh user session from Firestore
  const refreshSession = useCallback(async () => {
    if (auth.currentUser) {
      try {
        const res = await resolveCanonicalIdentity(auth.currentUser);
        setUser(res.user);
        setClinic(res.clinic);
        setPatientAccount(res.patientAccount);
      } catch (err) {
        console.warn('refreshSession error:', err);
      }
    }
  }, []);

  // Process email verification action code securely with Firebase Authentication
  const applyVerificationCode = useCallback(async (code: string): Promise<{ ok: boolean; error?: string }> => {
    setError(null);
    try {
      await applyActionCode(auth, code);
      if (auth.currentUser) {
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        const res = await resolveCanonicalIdentity(auth.currentUser);
        setUser(res.user);
        setClinic(res.clinic);
        setPatientAccount(res.patientAccount);
      }
      return { ok: true };
    } catch (err: any) {
      if (auth.currentUser) {
        try {
          await auth.currentUser.reload();
          await auth.currentUser.getIdToken(true);
          if (auth.currentUser.emailVerified) {
            const res = await resolveCanonicalIdentity(auth.currentUser);
            setUser(res.user);
            setClinic(res.clinic);
            setPatientAccount(res.patientAccount);
            return { ok: true };
          }
        } catch {}
      }
      const msg = err.code === 'auth/invalid-action-code'
        ? 'This verification link is invalid or has already been used.'
        : (err.message || 'Email verification failed.');
      setError(msg);
      return { ok: false, error: msg };
    }
  }, []);

  // Backward compatibility legacy methods
  const login = useCallback(async (email: string, pass: string) => {
    const res = await loginWithEmail(email, pass);
    return { ok: res.ok, error: res.error };
  }, [loginWithEmail]);

  const loginWithGoogleLegacy = useCallback(async () => {
    const res = await loginWithGoogle();
    return { ok: res.ok, error: res.error };
  }, [loginWithGoogle]);

  const loginWithOtp = useCallback(async () => {
    return { ok: false, error: 'Please use the phone OTP login method.' };
  }, []);

  const verifyEmailOtp = useCallback(async () => {
    return { ok: false, error: 'Email link login has been replaced with unified password / OTP login.' };
  }, []);

  // Update User Role dynamically (e.g. prompt after Google Sign-In or Phone OTP)
  const updateUserRole = useCallback(async (newRole: Role, targetUserId?: string): Promise<void> => {
    const uid = targetUserId || user?.user_id || auth.currentUser?.uid;
    if (!uid) return;

    const readablePrefix = newRole === 'admin' ? 'ADM' : (newRole === 'patient' ? 'PAT' : 'ADM');
    const userDisplayId = user?.id_number || generateReadableId(readablePrefix, uid);
    const userFullName = user?.name || user?.full_name || (newRole === 'patient' ? 'Patient User' : 'Clinic Admin');
    const nowIso = new Date().toISOString();

    setUser(prev => {
      if (!prev) return null;
      return { 
        ...prev, 
        role: newRole,
        user_type: newRole === 'admin' ? 'clinic_admin' : (newRole === 'patient' ? 'patient' : prev.user_type),
        id_number: userDisplayId,
        display_id: userDisplayId,
        full_name: userFullName,
        role_selected: true,
        updated_at: nowIso,
      };
    });

    try {
      const cached = localStorage.getItem(`viitsa_user_${uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.role = newRole;
        parsed.user_type = newRole === 'admin' ? 'clinic_admin' : (newRole === 'patient' ? 'patient' : parsed.user_type);
        parsed.id_number = userDisplayId;
        parsed.display_id = userDisplayId;
        parsed.full_name = userFullName;
        parsed.role_selected = true;
        parsed.updated_at = nowIso;
        localStorage.setItem(`viitsa_user_${uid}`, JSON.stringify(parsed));
      }
    } catch {}

    // Persist to Firestore: users collection
    try {
      const userDocRef = doc(db, 'users', uid);
      await setDoc(userDocRef, sanitizeForFirestore({
        role: newRole,
        user_type: newRole === 'admin' ? 'clinic_admin' : (newRole === 'patient' ? 'patient' : 'company_admin'),
        id_number: userDisplayId,
        display_id: userDisplayId,
        name: userFullName,
        full_name: userFullName,
        email: user?.email || auth.currentUser?.email || null,
        phone: user?.phone || auth.currentUser?.phoneNumber || null,
        role_selected: true,
        updated_at: nowIso,
      }), { merge: true });
    } catch (err) {
      console.warn('Could not update user role in Firestore:', err);
    }

    // Role-specific collections
    if (newRole === 'patient') {
      const patAccountId = `pat_${uid}`;
      const patData: PatientAccount = {
        account_id: patAccountId,
        name: userFullName,
        full_name: userFullName,
        id_number: userDisplayId,
        display_id: userDisplayId,
        patient_code: userDisplayId,
        email: user?.email || auth.currentUser?.email || null,
        phone: user?.phone || auth.currentUser?.phoneNumber || '',
        age: null,
        dob: null,
        gender: null,
        blood_group: null,
        address: null,
        current_medications: null,
        allergies: 'None',
        chronic_conditions: 'None',
        emergency_contact_name: null,
        emergency_contact_phone: null,
        otp_code: '',
        otp_verified: true,
        auth_user_id: uid,
        profile_completed: false,
        created_at: nowIso,
        updated_at: nowIso,
      };

      setPatientAccount(patData);
      setClinic(null);

      try {
        await setDoc(doc(db, 'patient_accounts', patAccountId), sanitizeForFirestore(patData), { merge: true });
      } catch (e) {
        console.warn('Could not sync patient role record in Firestore:', e);
      }
    } else if (newRole === 'admin') {
      try {
        await deleteDoc(doc(db, 'patient_accounts', `pat_${uid}`));
      } catch (e) {
        console.warn('Could not clean up patient_accounts during role switch:', e);
      }

      const clnId = user?.clinic_id || clinic?.clinic_id || `cln_${uid}`;
      const clnCode = clinic?.clinic_code || clinic?.id_number || generateReadableId('CLN', clnId);
      const clnName = clinic?.name || user?.clinic_name || 'My Clinic';
      
      const newClinic: Clinic = {
        clinic_id: clnId,
        name: clnName,
        clinic_code: clnCode,
        id_number: clnCode,
        display_id: clnCode,
        owner_name: userFullName,
        owner_user_id: uid,
        phone: user?.phone || auth.currentUser?.phoneNumber || '',
        email: user?.email || auth.currentUser?.email || '',
        city: 'Bangalore',
        address: '',
        logo_url: null,
        working_hours: { open: '09:00', close: '19:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
        created_at: nowIso,
        updated_at: nowIso,
      };

      setClinic(newClinic);

      try {
        await setDoc(doc(db, 'clinics', clnId), sanitizeForFirestore(newClinic), { merge: true });
      } catch (e) {
        console.warn('Could not sync clinic role record in Firestore:', e);
      }
    }
  }, [user, clinic]);

  const switchClinic = useCallback(async (newClinic: Clinic) => {
    setClinic(newClinic);
    try {
      localStorage.setItem('viitsa_active_clinic_id', newClinic.clinic_id);
    } catch {}

    setUser(prev => {
      if (!prev) return prev;
      const updated: User = {
        ...prev,
        clinic_id: newClinic.clinic_id,
        clinic_name: newClinic.name,
      };
      try {
        const cached = getCachedIdentity(prev.user_id);
        if (cached) {
          saveCachedIdentity({
            ...cached,
            user: updated,
            clinic: newClinic,
            patientAccount: cached.patientAccount ? {
              ...cached.patientAccount,
              clinic_id: newClinic.clinic_id,
              clinic_name: newClinic.name,
            } : cached.patientAccount,
          });
        }
      } catch {}
      return updated;
    });

    setPatientAccount(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        clinic_id: newClinic.clinic_id,
        clinic_name: newClinic.name,
      };
    });

    if (user?.user_id) {
      try {
        await setDoc(doc(db, 'users', user.user_id), sanitizeForFirestore({
          clinic_id: newClinic.clinic_id,
          clinic_name: newClinic.name,
          updated_at: new Date().toISOString(),
        }), { merge: true });
      } catch (e) {
        console.warn('Could not update users doc in switchClinic:', e);
      }
    }
  }, [user?.user_id]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      clinic,
      patientAccount,
      loading,
      error,
      setClinic,
      switchClinic,
      loginWithEmail,
      registerWithEmail,
      resendVerificationEmail,
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      updateUserRole,
      logout,
      refreshSession,
      clearError,
      applyVerificationCode,
      sendWhatsAppLoginOtp,
      loginWithWhatsAppOtp,
      linkUserEmail,
      login,
      loginWithGoogleLegacy,
      loginWithOtp,
      verifyEmailOtp,
    }),
    [
      user,
      clinic,
      patientAccount,
      loading,
      error,
      setClinic,
      switchClinic,
      loginWithEmail,
      registerWithEmail,
      resendVerificationEmail,
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      sendWhatsAppLoginOtp,
      loginWithWhatsAppOtp,
      linkUserEmail,
      updateUserRole,
      logout,
      refreshSession,
      clearError,
      applyVerificationCode,
      login,
      loginWithGoogleLegacy,
      loginWithOtp,
      verifyEmailOtp,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      <div id="unified-recaptcha-global" />
      {children}
    </AuthContext.Provider>
  );
}

const defaultAuthState: AuthState = {
  user: null,
  clinic: null,
  patientAccount: null,
  loading: true,
  error: null,
  clearError: () => {},
  loginWithEmail: async () => ({ ok: false, error: 'Authentication initializing...' }),
  registerWithEmail: async () => ({ ok: false, error: 'Authentication initializing...' }),
  logout: async () => {},
  switchClinic: async () => {},
  setClinic: () => {},
  setUser: () => {},
  refreshSession: async () => {},
  updateUserRole: async () => {},
  sendEmailOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  verifyEmailOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  sendPhoneOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  verifyPhoneOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  sendWhatsAppLoginOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  loginWithWhatsAppOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
  linkUserEmail: async () => ({ ok: false, error: 'Authentication initializing...' }),
  loginWithGoogle: async () => ({ ok: false, error: 'Authentication initializing...' }),
  applyVerificationCode: async () => ({ ok: false, error: 'Authentication initializing...' }),
  resendVerificationEmail: async () => ({ ok: false, error: 'Authentication initializing...' }),
  loginWithGoogleLegacy: async () => ({ ok: false, error: 'Authentication initializing...' }),
  loginWithOtp: async () => ({ ok: false, error: 'Authentication initializing...' }),
};

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return defaultAuthState;
  }
  return ctx;
}

export { DEFAULT_CLINIC_ID, DEFAULT_CLINIC_ID as DEMO_CLINIC_ID };
