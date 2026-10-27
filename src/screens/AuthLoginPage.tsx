import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Smartphone,
  User,
  Building2,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Contact2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { auth } from '../lib/firebase';
import type { OnboardingData } from '../lib/identityResolver';
import { type Role, PATIENT_ROLES, ADMIN_ROLES, CLINIC_ROLES } from '../lib/types';
import { getPasswordValidationError, assertPasswordUniqueness } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

type AuthTab = 'login' | 'register';
type LoginMethod = 'email' | 'phone';

export const isValidGmail = (val: string): boolean => {
  if (typeof val !== 'string') return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim().toLowerCase());
};

export const isValid10DigitPhone = (val: string): boolean => {
  if (typeof val !== 'string') return false;
  return /^\d{10}$/.test(val.replace(/\D/g, ''));
};

const globallyProcessedCodes = new Set<string>();

export function AuthLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    user,
    loginWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    loginWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    updateUserRole,
    applyVerificationCode,
    refreshSession,
    logout,
    error: authError,
    clearError
  } = useAuth();

  // Tab State
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  const handleTabChange = (tab: AuthTab) => {
    setActiveTab(tab);
    setOtpSent(false);
    setLocalError(null);
    clearError();
    const newParams = new URLSearchParams();
    if (tab === 'register') {
      newParams.set('mode', 'register');
    }
    const ret = searchParams.get('return') || searchParams.get('returnUrl');
    if (ret) newParams.set('return', ret);
    const q = newParams.toString();
    navigate(q ? `/login?${q}` : '/login', { replace: true });
  };

  // Sync tab with URL search parameter if changed externally (e.g. browser back button)
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') {
      setActiveTab('register');
    } else if (mode !== 'register' && !searchParams.get('oobCode') && mode !== 'verifyEmail') {
      setActiveTab('login');
    }
  }, [searchParams]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'patient' | 'admin'>('patient');

  // Device Autofill Suggestions & Contact Picker State
  const [deviceEmails, setDeviceEmails] = useState<string[]>([]);
  const [devicePhones, setDevicePhones] = useState<string[]>([]);
  const [hasContactPicker, setHasContactPicker] = useState(false);

  // Role Selection Modal State (after Google Sign-In or Phone OTP)
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [roleActionLoading, setRoleActionLoading] = useState(false);

  // UI State
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState<string | null>(() => {
    return searchParams.get('mode') === 'verifyEmail' ? searchParams.get('oobCode') : null;
  });
  const [verificationState, setVerificationState] = useState<'ready' | 'verifying' | 'success' | 'error'>(() => {
    return searchParams.get('mode') === 'verifyEmail' && Boolean(searchParams.get('oobCode')) ? 'ready' : 'ready';
  });
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Email Creation Confirmation Modal State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  // STRICT PORTAL ISOLATION: Flag patient portal on mount
  useEffect(() => {
    sessionStorage.setItem('viitsa_portal_intent', 'patient');
  }, []);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Background auto-polling: continuously checks if email is confirmed while staying on page
  useEffect(() => {
    if (!showVerificationModal) return;

    let isCancelled = false;
    const interval = setInterval(async () => {
      try {
        if (auth.currentUser) {
          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified && !isCancelled) {
            clearInterval(interval);
            setShowVerificationModal(false);
            await refreshSession();
            navigate('/patient/dashboard', { replace: true });
          }
        }
      } catch (err) {
        console.warn('Auto-poll error checking verification:', err);
      }
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [showVerificationModal, refreshSession, navigate]);

  const handleCheckNow = async () => {
    if (isCheckingStatus) return;
    setIsCheckingStatus(true);
    setLocalError(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          setShowVerificationModal(false);
          await refreshSession();
          navigate('/patient/dashboard', { replace: true });
          return;
        }
      }
      setLocalError("Your email is not verified yet. Please click the verification link sent to your inbox.");
    } catch (e: any) {
      setLocalError(e.message || 'Error checking verification status.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || isResending || !registeredEmail) return;
    setIsResending(true);
    setResendSuccess(false);
    try {
      const res = await resendVerificationEmail(registeredEmail, name);
      if (res.ok) {
        setResendSuccess(true);
        setResendCooldown(60);
      } else {
        setLocalError(res.error || 'Failed to resend confirmation email.');
      }
    } catch (e: any) {
      setLocalError(e.message || 'Failed to resend confirmation email.');
    } finally {
      setIsResending(false);
    }
  };

  // Load device-saved suggestions & detect contact picker
  useEffect(() => {
    try {
      const rawE = localStorage.getItem('viitsa_device_emails');
      if (rawE) {
        const parsed = JSON.parse(rawE);
        if (Array.isArray(parsed)) {
          setDeviceEmails(parsed.filter(isValidGmail));
        }
      }

      const rawP = localStorage.getItem('viitsa_device_phones');
      if (rawP) {
        const parsed = JSON.parse(rawP);
        if (Array.isArray(parsed)) {
          setDevicePhones(parsed.filter(isValid10DigitPhone));
        }
      }
    } catch { }

    if (typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window) {
      setHasContactPicker(true);
    }
  }, []);

  // Handle execute verification with explicit user button
  const handleExecuteVerification = async () => {
    if (!verificationCode || verificationState === 'verifying') return;
    setVerificationState('verifying');
    setVerificationError(null);
    try {
      const res = await applyVerificationCode(verificationCode);
      if (res.ok) {
        setShowVerificationModal(false);
        setVerificationState('success');
        if (auth.currentUser) {
          try {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            await refreshSession();
          } catch {}
        }
      } else {
        if (auth.currentUser?.emailVerified) {
          setShowVerificationModal(false);
          setVerificationState('success');
        } else {
          setVerificationState('error');
          setVerificationError(res.error || 'Verification link is invalid or has expired.');
        }
      }
    } catch (err: any) {
      if (auth.currentUser?.emailVerified) {
        setShowVerificationModal(false);
        setVerificationState('success');
      } else {
        setVerificationState('error');
        setVerificationError(err.message || 'Email verification failed.');
      }
    }
  };

  // Process email verification link callback or status params sequentially without race conditions
  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const isVerifiedParam = searchParams.get('verified') === 'true';
    const unverifiedParam = searchParams.get('unverified') === 'true';

    // 1. If a password reset code or action reaches patient login, redirect to reset-password
    if (mode === 'resetPassword' || (oobCode && mode !== 'verifyEmail')) {
      const params = new URLSearchParams(searchParams);
      if (!params.has('return')) params.set('return', '/login');
      navigate(`/reset-password?${params.toString()}`, { replace: true });
      return;
    }

    // 2. Prepare email verification state with code
    if (mode === 'verifyEmail' && oobCode) {
      setVerificationCode(oobCode);
      return;
    }

    // 3. Handle ?verified=true ONLY if there is no oobCode being verified
    if (isVerifiedParam && !oobCode) {
      (async () => {
        try {
          if (auth.currentUser) {
            await auth.currentUser.reload();
            await auth.currentUser.getIdToken(true);
            if (auth.currentUser.emailVerified) {
              setShowVerificationModal(false);
              await refreshSession();
              navigate('/patient/dashboard', { replace: true });
              return;
            }
          }
          setActiveTab('login');
          setLocalError('Email verified successfully! Please sign in with your email and password to continue.');
        } catch (e) {
          console.warn('Patient verified redirect error:', e);
        }
      })();
      return;
    }

    // 4. Handle ?unverified=true
    if (unverifiedParam) {
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      setActiveTab('login');
      setLocalError('Please verify your email address before logging in. Check your inbox for the confirmation link.');
    }
  }, [searchParams, applyVerificationCode, navigate, refreshSession]);

  const saveDeviceContact = (em?: string, ph?: string) => {
    try {
      if (em && isValidGmail(em)) {
        const cleanE = em.trim().toLowerCase();
        setDeviceEmails(prev => {
          const updated = Array.from(new Set([cleanE, ...prev.filter(isValidGmail)])).slice(0, 3);
          localStorage.setItem('viitsa_device_emails', JSON.stringify(updated));
          return updated;
        });
      }
      if (ph && isValid10DigitPhone(ph)) {
        const cleanP = ph.replace(/\D/g, '');
        setDevicePhones(prev => {
          const updated = Array.from(new Set([cleanP, ...prev.filter(isValid10DigitPhone)])).slice(0, 3);
          localStorage.setItem('viitsa_device_phones', JSON.stringify(updated));
          return updated;
        });
      }
    } catch { }
  };

  // Mobile Web Contact Picker
  const handlePickFromDevice = async () => {
    if ('contacts' in navigator && 'ContactsManager' in window) {
      try {
        const props = ['name', 'email', 'tel'];
        const contacts = await (navigator as any).contacts.select(props, { multiple: false });
        if (contacts && contacts[0]) {
          const c = contacts[0];
          if (c.name?.[0]) setName(c.name[0]);
          if (c.email?.[0] && isValidGmail(c.email[0])) {
            setEmail(c.email[0].trim().toLowerCase());
            saveDeviceContact(c.email[0], undefined);
          }
          if (c.tel?.[0]) {
            const clean = c.tel[0].replace(/\D/g, '').slice(-10);
            if (isValid10DigitPhone(clean)) {
              setPhone(clean);
              saveDeviceContact(undefined, clean);
            }
          }
        }
      } catch { }
    }
  };

  // If already authenticated and not choosing role, route automatically by role
  useEffect(() => {
    if (verificationCode) return;
    if (user && !showRoleModal && !pendingUser) {
      if (auth.currentUser && !auth.currentUser.emailVerified && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
        return;
      }
      // If user is Clinic Staff or Admin, do NOT redirect away to clinic; show switch banner on the page
      if (ADMIN_ROLES.includes(user.role) || CLINIC_ROLES.includes(user.role)) {
        return;
      }
      navigate('/patient/dashboard', { replace: true });
    }
  }, [user, navigate, showRoleModal, pendingUser, verificationCode]);

  const errorMessage = localError || authError;

  const handleRouteByRole = (role?: string) => {
    if (role && ADMIN_ROLES.includes(role as Role)) {
      navigate('/admin/dashboard', { replace: true });
    } else if (role && CLINIC_ROLES.includes(role as Role)) {
      navigate('/clinic/dashboard', { replace: true });
    } else {
      navigate('/patient/dashboard', { replace: true });
    }
  };

  const handleSelectRoleAndProceed = async (role: 'patient' | 'admin') => {
    setRoleActionLoading(true);
    try {
      await updateUserRole(role, pendingUser?.user_id || user?.user_id);
    } catch (err) {
      console.warn('Error updating role:', err);
    }
    setRoleActionLoading(false);
    setShowRoleModal(false);
    setPendingUser(null);
    if (PATIENT_ROLES.includes(role)) {
      navigate('/patient/dashboard', { replace: true });
    } else {
      navigate('/clinic/dashboard', { replace: true });
    }
  };

  // Google Sign-In (Available for both Login and Register)
  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    setLoading(true);
    sessionStorage.setItem('viitsa_portal_intent', 'patient');

    const res = await loginWithGoogle({ role: 'patient' });
    setLoading(false);

    if (res.ok && res.user) {
      saveDeviceContact(res.user?.email, res.user?.phone || undefined);
      if (res.isNewUser) {
        try { sessionStorage.setItem('viitsa_is_new_registration', 'true'); } catch {}
      } else {
        try { sessionStorage.removeItem('viitsa_is_new_registration'); } catch {}
      }
      handleRouteByRole(res.role || res.user.role);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  // Email + Password Submit (Login or Register)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !isValidGmail(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }


    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setLoading(true);

    if (activeTab === 'login') {
      try { sessionStorage.removeItem('viitsa_is_new_registration'); } catch {}
      const res = await loginWithEmail(cleanEmail, password, 'patient');
      setLoading(false);
      if (res.ok) {
        saveDeviceContact(cleanEmail, res.user?.phone || undefined);
        handleRouteByRole(res.role);
      } else if (res.error) {
        setLocalError(res.error);
      }
    } else {
      // Register Mode
      const pwdErr = getPasswordValidationError(password, confirmPassword);
      if (pwdErr) {
        setLocalError(pwdErr);
        setLoading(false);
        return;
      }

      const uniqCheck = await assertPasswordUniqueness(password);
      if (!uniqCheck.ok) {
        setLocalError(uniqCheck.error || 'This password is already in use by another user. Please choose a different password.');
        setLoading(false);
        return;
      }

      if (!name.trim()) {
        setLocalError('Please enter your full name.');
        setLoading(false);
        return;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      // Email AND Phone are strictly required for registration
      if (!isValid10DigitPhone(cleanPhone)) {
        setLocalError('Phone number is required and must be exactly 10 digits (numbers only).');
        setLoading(false);
        return;
      }

      try { sessionStorage.setItem('viitsa_is_new_registration', 'true'); } catch {}

      const onboarding: OnboardingData = {
        role: 'patient',
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
      };

      const res = await registerWithEmail(cleanEmail, password, onboarding);
      setLoading(false);
      if (res.ok) {
        saveDeviceContact(cleanEmail, cleanPhone);
        setRegisteredEmail(cleanEmail);
        setShowVerificationModal(true);
        // Clean mode from URL so we're ready for sign in
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('mode');
        const q = newParams.toString();
        navigate(q ? `/login?${q}` : '/login', { replace: true });
        // Stay on current page, clear passwords
        setPassword('');
        setConfirmPassword('');
        setLocalError(null);
      } else if (res.error) {
        setLocalError(res.error);
      }
    }
  };

  // Phone OTP: Send (Sign-In Mode only)
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValid10DigitPhone(cleanPhone)) {
      setLocalError('Phone number must be exactly 10 digits (numbers only).');
      return;
    }

    setLoading(true);
    const res = await sendPhoneOtp(cleanPhone, 'recaptcha-container-login');
    setLoading(false);

    if (res.ok) {
      saveDeviceContact(email.trim().toLowerCase() || undefined, cleanPhone);
      setOtpSent(true);
    }
  };

  // Phone OTP: Verify (Sign-In Mode only)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 4) {
      setLocalError('Please enter the verification code sent to your phone.');
      return;
    }

    setLoading(true);
    const res = await verifyPhoneOtp(cleanOtp, { role: 'patient' });
    setLoading(false);

    if (res.ok && res.user) {
      saveDeviceContact(email.trim().toLowerCase() || undefined, phone.replace(/\D/g, ''));
      if (res.isNewUser) {
        try { sessionStorage.setItem('viitsa_is_new_registration', 'true'); } catch {}
      } else {
        try { sessionStorage.removeItem('viitsa_is_new_registration'); } catch {}
      }
      if (!res.isNewUser && res.user.role_selected) {
        handleRouteByRole(res.role || res.user.role);
        return;
      }
      // Force patient role for new users
      await handleSelectRoleAndProceed('patient');
    }
  };

  // Forgot Password is now handled by the dedicated /forgot-password page

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">


      {/* Native Browser Datalists for 1-click device auto-fill */}
      <datalist id="device-emails-list">
        {deviceEmails.map((em) => (
          <option key={em} value={em} />
        ))}
      </datalist>

      <datalist id="device-phones-list">
        {devicePhones.map((ph) => (
          <option key={ph} value={ph} />
        ))}
      </datalist>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={false} />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {activeTab === 'login' ? 'Welcome back' : 'Create an account'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {activeTab === 'login'
            ? 'Sign in to access your dashboard and records'
            : 'Select your role and get started in seconds'}
        </p>
      </div>

      {/* Main Card Container */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-100 rounded-2xl p-6 sm:p-8">

          {verificationCode ? (
            <div className="py-6 text-center animate-in fade-in">
              {verificationState === 'ready' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mx-auto mb-4 shadow-sm">
                    <Mail className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verify Your Email Address</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                    Click the button below to confirm your email address and activate your Viitsa patient account.
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteVerification}
                    className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-5 h-5 text-teal-100" />
                    <span>Verify Email & Activate Account</span>
                  </button>
                </>
              )}

              {verificationState === 'verifying' && (
                <div className="py-6">
                  <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mx-auto mb-4 animate-pulse shadow-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verifying Your Email Address</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                    Please wait while we verify your email address and activate your account...
                  </p>
                  <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                    <span>Activating account securely...</span>
                  </div>
                </div>
              )}

              {verificationState === 'success' && (
                <div className="py-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto mb-4 shadow-sm animate-in zoom-in-95">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Email Verified Successfully!</h3>
                  <p className="text-sm text-slate-600 max-w-sm mx-auto mb-6 leading-relaxed">
                    Your email has been confirmed. You can now access your patient portal, medical records, and appointments.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (auth.currentUser) {
                        navigate('/patient/dashboard', { replace: true });
                      } else {
                        setVerificationCode(null);
                        setActiveTab('login');
                        setLocalError('Email verified successfully! Please sign in with your email and password.');
                      }
                    }}
                    className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <span>{auth.currentUser ? 'Proceed to Patient Dashboard' : 'Proceed to Sign In'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {verificationState === 'error' && (
                <div className="py-4">
                  <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto mb-4 shadow-sm">
                    <AlertCircle className="w-8 h-8 text-rose-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verification Link Expired</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                    {verificationError || 'This verification link is invalid or has already been used. Please sign in or request a new confirmation link.'}
                  </p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationCode(null);
                        setActiveTab('login');
                      }}
                      className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      Go to Sign In
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Primary Mode Switch: Sign In vs Create Account */}
              <div className="flex rounded-xl bg-slate-100 p-1.5 mb-6 border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleTabChange('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'login'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              Create Account
            </button>
          </div>

          {/* Contact Picker Button for mobile devices */}
          {hasContactPicker && activeTab === 'register' && (
            <div className="mb-4">
              <button
                type="button"
                onClick={handlePickFromDevice}
                className="w-full py-2.5 px-3 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl text-xs font-semibold text-teal-800 flex items-center justify-center gap-2 transition-colors"
              >
                <Contact2 className="w-4 h-4 text-teal-600" />
                <span>Auto-fill details from device contacts</span>
              </button>
            </div>
          )}

          {/* Active Clinic Session Prompt */}
          {user && (CLINIC_ROLES.includes(user.role as Role) || ADMIN_ROLES.includes(user.role as Role)) && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-amber-900 mb-0.5">Active Clinic Session Detected</p>
                  <p className="text-amber-800 text-xs mb-2.5">
                    You are currently signed in with a Clinic / Staff account (<strong>{user.email || user.name}</strong>). The Patient Portal requires a Patient account.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await logout();
                        setLocalError(null);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm"
                    >
                      Sign Out & Log In to Patient
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/clinic/dashboard')}
                      className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors"
                    >
                      Go to Clinic Portal
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Banner */}
          {errorMessage && (() => {
            const isSuccess = /success|verified|confirmed/i.test(errorMessage);
            return (
              <div className={`flex items-start gap-3 p-3.5 border rounded-xl mb-5 animate-in fade-in duration-150 ${
                isSuccess
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}>
                {isSuccess ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                )}
                <p className="text-xs sm:text-sm font-medium leading-relaxed">{errorMessage}</p>
              </div>
            );
          })()}

          {/* Google Sign-In (Available for both Login and Register) */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full mb-5 h-12 flex items-center justify-center gap-3 px-6 rounded-xl border-2 border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200 transition-all font-bold text-slate-700 shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>Continue with Google</span>
          </button>

          <div className="relative mb-5 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Or
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Sign In Mode: Method Selector — Phone OTP hidden, will be added later */}
          {/* TODO: Re-enable Phone OTP login toggle when ready */}

          {/* Create Account — patient only on this page */}

          {/* METHOD 1: EMAIL & PASSWORD (Available for Register and Login) */}
          {(activeTab === 'register' || loginMethod === 'email') && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      name="name"
                      id="register-name"
                      autoComplete="name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Dr. Rajesh Kumar"
                      className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Email Address {activeTab === 'register' && <span className="text-rose-500">*</span>}
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    name="email"
                    id="login-email"
                    list="device-emails-list"
                    autoComplete="email"
                    inputMode="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@gmail.com"
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                  />
                </div>

                {/* 1-Click Device Suggestion Pills */}
                {deviceEmails.length > 0 && !email && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[11px] font-semibold text-slate-400">Device suggestion:</span>
                    {deviceEmails.map((savedEmail) => (
                      <button
                        key={savedEmail}
                        type="button"
                        onClick={() => setEmail(savedEmail)}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors border border-teal-200/80 shadow-xs"
                      >
                        {savedEmail}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone Number is REQUIRED for registration */}
              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Phone Number <span className="text-slate-400 font-normal normal-case">(10 digits only)</span> <span className="text-rose-500">* (Required)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="h-12 px-3.5 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">
                      +91
                    </span>
                    <input
                      type="tel"
                      name="tel"
                      id="register-phone"
                      list="device-phones-list"
                      autoComplete="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      title="Must be exactly 10 digits (numbers only)"
                      required
                      value={phone}
                      onKeyDown={(e) => {
                        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                        if (e.ctrlKey || e.metaKey) return;
                        if (!/^\d$/.test(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="flex-1 h-12 px-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium font-mono"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Must be exactly 10 digits, numbers only (e.g. 9876543210).</span>

                  {/* 1-Click Device Suggestion Pills for Phone */}
                  {devicePhones.length > 0 && !phone && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] font-semibold text-slate-400">Device suggestion:</span>
                      {devicePhones.map((savedPhone) => (
                        <button
                          key={savedPhone}
                          type="button"
                          onClick={() => setPhone(savedPhone)}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors border border-teal-200/80 shadow-xs font-mono"
                        >
                          +91 {savedPhone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Password {activeTab === 'register' && <span className="text-rose-500">*</span>}
                  </label>
                  {activeTab === 'login' && (
                    <Link
                      to="/forgot-password?return=/login"
                      className="text-xs text-teal-700 hover:text-teal-800 font-semibold"
                    >
                      Forgot password?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="auth-password"
                    autoComplete={activeTab === 'register' ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {activeTab === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Confirm Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirm-password"
                      id="auth-confirm-password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className={`w-full h-12 pl-11 pr-11 bg-white border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all font-medium ${
                        confirmPassword.length > 0
                          ? password === confirmPassword
                            ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                            : 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600"
                      title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold animate-in fade-in">
                      {password === confirmPassword ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-emerald-700">Passwords match perfectly</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span className="text-rose-600">Passwords do not match yet</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'register' && (
                <PasswordRequirementsGuide password={password} confirmPassword={confirmPassword} showAlways={true} />
              )}


              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all disabled:opacity-50 shadow-md hover:shadow-lg active:scale-[0.99]"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                <span>
                  {activeTab === 'login' ? 'Sign In' : 'Create Account'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* METHOD 2: PHONE NUMBER + OTP — Hidden until integration is complete */}
          {/* TODO: Restore Phone OTP login section here when ready */}

          {/* Invisible Recaptcha Mount Point */}
          <div id="recaptcha-container-login" />
            </>
          )}

        </div>
      </div>

      {/* Email Verification Confirmation Modal (Triggered ONLY when email account is created) */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-5 shadow-sm">
                <Mail className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Verify Your Email Address
              </h3>

              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                We've sent a confirmation and verification link to activate your patient account:
              </p>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 break-all">
                <span className="text-sm font-semibold text-teal-900">{registeredEmail}</span>
              </div>

              {/* Auto-detect Status Pill */}
              <div className="w-full bg-teal-50 border border-teal-200/80 rounded-xl p-3 mb-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600 shrink-0" />
                <span className="text-xs font-semibold text-teal-800">
                  Waiting for confirmation... (Auto-detecting)
                </span>
              </div>

              <div className="w-full bg-amber-50/80 border border-amber-200/70 rounded-xl p-3.5 mb-5 text-left">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-semibold">Check your Spam / Junk folder:</span> If the confirmation email isn't in your inbox within a minute, please check your spam folder and mark it as <em>Not Spam</em>.
                  </div>
                </div>
              </div>

              {resendSuccess && (
                <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs font-semibold text-emerald-700 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmation email resent successfully!
                </div>
              )}

              {localError && (() => {
                const isSuccess = /success|verified|confirmed/i.test(localError);
                const isPending = /not verified yet|sent to your/i.test(localError);
                return (
                  <div className={`w-full rounded-xl p-3 mb-4 text-xs font-semibold flex items-center gap-2 ${
                    isSuccess
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : isPending
                        ? 'bg-amber-50 border border-amber-200 text-amber-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-700'
                  }`}>
                    {isSuccess ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertCircle className={`w-4 h-4 shrink-0 ${isPending ? 'text-amber-600' : 'text-rose-600'}`} />
                    )}
                    <span>{localError}</span>
                  </div>
                );
              })()}

              <div className="w-full space-y-3">
                <button
                  type="button"
                  disabled={isCheckingStatus}
                  onClick={handleCheckNow}
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                  <span>I've Confirmed My Email — Continue</span>
                </button>

                <button
                  type="button"
                  disabled={resendCooldown > 0 || isResending}
                  onClick={handleResendVerification}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-teal-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-all disabled:opacity-50"
                >
                  {isResending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  ) : (
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>
                    {resendCooldown > 0
                      ? `Resend Email (${resendCooldown}s)`
                      : 'Resend Confirmation Email'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowVerificationModal(false);
                    handleTabChange('login');
                  }}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors text-center"
                >
                  Back to Sign In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
