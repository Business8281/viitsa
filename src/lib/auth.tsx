import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  GoogleAuthProvider, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signOut, 
  onAuthStateChanged,
  sendEmailVerification,
  ConfirmationResult,
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, setDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { auth, db, DEFAULT_CLINIC_ID } from './firebase';
import type { Clinic, User, PatientAccount, Role } from './types';
import { PATIENT_ROLES, ADMIN_ROLES, CLINIC_ROLES } from './types';
import { resolveCanonicalIdentity, generateReadableId, sanitizeForFirestore, getOrInitializeClinic, getCachedIdentity, saveCachedIdentity, type OnboardingData, type IdentityResult } from './identityResolver';
import { clearAllViitsaCaches } from './cacheCleaner';

interface AuthResponse {
  ok: boolean;
  user?: User;
  role?: Role;
  error?: string;
  isNewUser?: boolean;
}

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
  loginWithGoogle: (onboarding?: OnboardingData) => Promise<AuthResponse>;
  sendPhoneOtp: (phone: string, recaptchaContainerId: string) => Promise<{ ok: boolean; error?: string }>;
  verifyPhoneOtp: (otp: string, onboarding?: OnboardingData) => Promise<AuthResponse>;
  updateUserRole: (role: Role, targetUserId?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  clearError: () => void;
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
            const activeClinic = await getOrInitializeClinic();
            const fallbackUser: User = {
              user_id: firebaseUser.uid,
              clinic_id: activeClinic?.clinic_id || undefined,
              clinic_name: activeClinic?.name || undefined,
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
            setClinic(activeClinic);
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
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      const onboardingData = expectedRole ? { role: expectedRole, name: email.split('@')[0], email } : undefined;
      const res = await resolveCanonicalIdentity(cred.user, onboardingData);

      // Enforce email verification for patients only
      const isAdminOrStaff = res.user?.role && (ADMIN_ROLES.includes(res.user.role) || CLINIC_ROLES.includes(res.user.role));
      if (!cred.user.emailVerified && !isAdminOrStaff) {
        try { await sendEmailVerification(cred.user); } catch (e) {}
        await signOut(auth);
        throw new Error('Please verify your email address before logging in. A new confirmation link has been sent to your inbox.');
      }
      
      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      setLoading(false);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'email' });
      return { ok: true, user: res.user, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password.'
        : (err.message || 'Login failed.');
      setError(msg);
      setLoading(false);
      return { ok: false, error: msg };
    }
  }, []);

  // Email + Password Registration
  const registerWithEmail = useCallback(async (
    email: string, 
    password: string, 
    onboarding: OnboardingData
  ): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const res = await resolveCanonicalIdentity(cred.user, { ...onboarding, email });
      
      await sendEmailVerification(cred.user);
      await signOut(auth);
      
      setUser(null);
      setClinic(null);
      setPatientAccount(null);
      setLoading(false);
      return { ok: false, error: 'Registration successful! Please check your email and click the confirmation link before logging in.' };
    } catch (err: any) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists. Please sign in instead.'
        : (err.message || 'Registration failed.');
      setError(msg);
      setLoading(false);
      return { ok: false, error: msg };
    }
  }, []);

  // Google Sign-In
  const loginWithGoogle = useCallback(async (onboarding?: OnboardingData): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(auth, provider);
      
      let res: IdentityResult;
      try {
        res = await resolveCanonicalIdentity(cred.user, onboarding);
      } catch (e: any) {
        console.warn('Fallback inside loginWithGoogle:', e);
        const activeClinic = await getOrInitializeClinic();
        const fallbackUser: User = {
          user_id: cred.user.uid,
          clinic_id: activeClinic?.clinic_id || undefined,
          clinic_name: activeClinic?.name || undefined,
          name: cred.user.displayName || onboarding?.name || cred.user.email?.split('@')[0] || 'User',
          email: cred.user.email || '',
          role: onboarding?.role || 'patient',
          phone: onboarding?.phone || null,
          specialisation: null,
          active: true,
          avatar_color: '#0F6E56',
          created_at: new Date().toISOString(),
          linked_uids: [cred.user.uid],
          auth_providers: ['google.com'],
        };
        res = {
          user: fallbackUser,
          clinic: activeClinic,
          patientAccount: null,
        };
      }

      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      setLoading(false);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'google' });
      return { ok: true, user: res.user, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setLoading(false);
        return { ok: false };
      }
      const msg = err.message || 'Google sign in failed.';
      setError(msg);
      setLoading(false);
      return { ok: false, error: msg };
    }
  }, []);

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

    setLoading(true);
    setError(null);

    try {
      const cred = await confirmationResult.confirm(otp.trim());
      const res = await resolveCanonicalIdentity(cred.user, onboarding);
      setUser(res.user);
      setClinic(res.clinic);
      setPatientAccount(res.patientAccount);
      setLoading(false);
      logUserLogin(res.user.id || res.user.user_id, res.user.role, res.user.clinic_id, { method: 'phone' });
      return { ok: true, user: res.user, role: res.user.role, isNewUser: res.isNewUser };
    } catch (err: any) {
      console.error('verifyPhoneOtp error:', err);
      const msg = err.code === 'auth/invalid-verification-code' 
        ? 'Incorrect OTP. Please try again.' 
        : (err.message || 'OTP verification failed.');
      setError(msg);
      setLoading(false);
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
    if (role === 'company_admin') loginPath = '/admin/login';
    else if (role === 'clinic_admin' || role === 'clinic_doctor' || role === 'clinic_staff') loginPath = '/clinic/login';
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
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      updateUserRole,
      logout,
      refreshSession,
      clearError,
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
      loginWithGoogle,
      sendPhoneOtp,
      verifyPhoneOtp,
      updateUserRole,
      logout,
      refreshSession,
      clearError,
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

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { DEFAULT_CLINIC_ID, DEFAULT_CLINIC_ID as DEMO_CLINIC_ID };
