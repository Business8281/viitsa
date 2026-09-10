import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db, DEMO_CLINIC_ID } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  getDocs,
  addDoc
} from 'firebase/firestore';
import type { Clinic, User } from './types';

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
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.trim().toLowerCase()), where('active', '==', true));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return { user: null, clinic: null };
    
    const userData = querySnapshot.docs[0].data() as User;
    userData.user_id = querySnapshot.docs[0].id; // Ensure ID is mapped if needed

    const clinicRef = doc(db, 'clinics', userData.clinic_id);
    const clinicSnap = await getDoc(clinicRef);
    
    let clinicData: Clinic | null = null;
    if (clinicSnap.exists()) {
      clinicData = { ...clinicSnap.data(), clinic_id: clinicSnap.id } as Clinic;
    }

    return { user: userData, clinic: clinicData };
  } catch (err) {
    console.error("Error loading profile:", err);
    return { user: null, clinic: null };
  }
}

async function checkAndCreateProfile(sessionUser: FirebaseUser): Promise<{ user: User | null; clinic: Clinic | null }> {
  return await loadProfile(sessionUser.email ?? '');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setClinic(null);
        setLoading(false);
        return;
      }
      
      const { user: u, clinic: c } = await checkAndCreateProfile(firebaseUser);
      setUser(u);
      setClinic(c);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      
      if (userCredential.user) {
        const { user: u, clinic: c } = await checkAndCreateProfile(userCredential.user);
        if (!u) {
          await signOut(auth);
          setLoading(false);
          return { ok: false, error: 'User profile not found or inactive.' };
        }
        setUser(u);
        setClinic(c);
      }
      setLoading(false);
      return { ok: true };
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
      setLoading(false);
      return { ok: false, error: 'Login failed. Please try again.' };
    }
  }, []);

  const loginWithOtp = useCallback(async (email: string) => {
    setError(null);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/login',
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email.trim().toLowerCase(), actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email.trim().toLowerCase());
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message || 'Unable to send login link.' };
    }
  }, []);

  const verifyEmailOtp = useCallback(async (email: string, token: string) => {
    // Firebase auth email links do not use a separate token, they rely on the URL.
    // If you actually use OTPs, Firebase Phone Auth is the native solution.
    // Here we will implement the email link login check.
    setLoading(true);
    setError(null);
    try {
      if (isSignInWithEmailLink(auth, window.location.href)) {
        let storedEmail = window.localStorage.getItem('emailForSignIn');
        if (!storedEmail) {
           storedEmail = window.prompt('Please provide your email for confirmation');
        }
        if (!storedEmail) throw new Error("Email required");
        
        const result = await signInWithEmailLink(auth, storedEmail, window.location.href);
        window.localStorage.removeItem('emailForSignIn');
        
        if (result.user) {
          const { user: u, clinic: c } = await checkAndCreateProfile(result.user);
          if (!u) {
            await signOut(auth);
            setLoading(false);
            return { ok: false, error: 'User profile not found.' };
          }
          setUser(u);
          setClinic(c);
        }
        setLoading(false);
        return { ok: true };
      }
      return { ok: false, error: 'Invalid verification link.' };
    } catch (err: any) {
      setError('Invalid verification link.');
      setLoading(false);
      return { ok: false, error: 'Invalid verification link.' };
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setClinic(null);
    signOut(auth);
  }, []);

  const refreshSession = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const { user: u, clinic: c } = await loadProfile(currentUser.email ?? '');
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
