import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Mail,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { auth } from '../lib/firebase';
import type { OnboardingData } from '../lib/identityResolver';
import { PATIENT_ROLES, ADMIN_ROLES } from '../lib/types';
import { getPasswordValidationError, assertPasswordUniqueness } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';

type AuthTab = 'signin' | 'register';
type LoginMethod = 'email' | 'phone';

const isValidEmail = (val: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
const isValid10Digit = (val: string) => /^\d{10}$/.test(val.replace(/\D/g, ''));

const globallyProcessedClinicCodes = new Set<string>();

export function ClinicLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const {
    user,
    clinic,
    loginWithEmail,
    registerWithEmail,
    resendVerificationEmail,
    sendPhoneOtp,
    verifyPhoneOtp,
    updateUserRole,
    refreshSession,
    logout,
    applyVerificationCode,
    error: authError,
    clearError,
  } = useAuth();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setOtpSent(false);
    setLocalError(null);
    clearError();
    const newParams = new URLSearchParams();
    if (tab === 'register') {
      newParams.set('mode', 'register');
    }
    const ret = searchParams.get('return') || searchParams.get('returnUrl');
    if (ret) newParams.set('returnUrl', ret);
    const q = newParams.toString();
    navigate(q ? `/clinic/login?${q}` : '/clinic/login', { replace: true });
  };

  // Sync tab with URL search parameter if changed externally (e.g. browser back button)
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') {
      setActiveTab('register');
    } else if (mode !== 'register' && !searchParams.get('oobCode') && mode !== 'verifyEmail') {
      setActiveTab('signin');
    }
  }, [searchParams]);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

  // UI state
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

  // Email Verification Modal State
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const errorMessage = localError || authError;

  // STRICT PORTAL ISOLATION: Flag clinic portal on mount
  useEffect(() => {
    sessionStorage.setItem('viitsa_portal_intent', 'clinic');
  }, []);

  // Cooldown countdown for resend button
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Handle ?unverified=true URL parameter
  useEffect(() => {
    const isUnverifiedParam = searchParams.get('unverified') === 'true';
    if (isUnverifiedParam) {
      setShowVerificationModal(true);
      if (auth.currentUser?.email) {
        setRegisteredEmail(auth.currentUser.email);
      }
    }
  }, [searchParams]);

  // Handle execute verification with explicit user button or on-demand
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

  // Handle ?mode=verifyEmail&oobCode=... and ?verified=true sequentially without race conditions
  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const isVerifiedParam = searchParams.get('verified') === 'true';

    // 1. Forward password reset actions to /reset-password
    if (mode === 'resetPassword' || (oobCode && mode !== 'verifyEmail')) {
      const params = new URLSearchParams(searchParams);
      if (!params.has('return')) params.set('return', '/clinic/login');
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
              await refreshSession();
              navigate('/clinic/setup', { replace: true });
              return;
            }
          }
          setActiveTab('signin');
          setLocalError('Email verified successfully! Please sign in with your clinic credentials.');
        } catch (e) {
          console.warn('Clinic verified redirect error:', e);
        }
      })();
    }
  }, [searchParams, navigate, refreshSession]);

  // Background auto-polling: checks if clinic email is confirmed while staying on page
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
            navigate('/clinic/setup', { replace: true });
          }
        }
      } catch (err) {
        console.warn('Clinic auto-poll verification warning:', err);
      }
    }, 2000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [showVerificationModal, refreshSession, navigate]);

  const routeClinicUser = (u: any, clinicObj?: any) => {
    // 1. Password users with unverified email must verify email first
    if (auth.currentUser && !auth.currentUser.emailVerified && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
      setShowVerificationModal(true);
      setRegisteredEmail(u.email || '');
      return;
    }

    if (returnUrl) {
      navigate(returnUrl, { replace: true });
      return;
    }

    // 2. For clinic admin: Enforce setup -> documents -> approval sequence
    if (u.role === 'clinic_admin') {
      if (u.clinic_setup_complete !== true) {
        navigate('/clinic/setup', { replace: true });
        return;
      }
      if (u.clinic_documents_uploaded !== true) {
        navigate('/clinic/upload-documents', { replace: true });
        return;
      }
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status || u.clinic_verification_status || 'unverified';
      if (verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      if (clinicObj?.subscription_status === 'deactivated' || clinic?.subscription_status === 'deactivated' ||
          clinicObj?.subscription_status === 'cancelled' || clinic?.subscription_status === 'cancelled') {
        navigate('/clinic/subscription-setup', { replace: true });
        return;
      }
      navigate('/clinic/dashboard', { replace: true });
      return;
    }

    // 3. Doctors: route directly to dedicated doctor dashboard
    if (u.role === 'clinic_doctor' || u.role === 'doctor') {
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status;
      if (verificationStatus && verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      navigate('/doctor/dashboard', { replace: true });
      return;
    }

    // 4. Staff: route to clinic dashboard
    if (u.role === 'clinic_staff' || u.role === 'staff') {
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status;
      if (verificationStatus && verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      navigate('/clinic/dashboard', { replace: true });
      return;
    }

    // 5. Default
    navigate('/clinic/dashboard', { replace: true });
  };

  // Redirect if already authenticated
  useEffect(() => {
    if (verificationCode) return;
    if (!user) return;
    // If a logged in patient visits clinic login, DO NOT navigate away; show switch prompt banner on the page
    if (PATIENT_ROLES.includes(user.role)) {
      return;
    }
    if (ADMIN_ROLES.includes(user.role)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    routeClinicUser(user, clinic);
  }, [user, clinic, navigate, returnUrl, updateUserRole, verificationCode]);

  const handleAfterAuth = (authenticatedUser?: any, clinicObj?: any) => {
    const target = authenticatedUser || user;
    if (target) {
      routeClinicUser(target, clinicObj || clinic);
    }
  };

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
          navigate('/clinic/setup', { replace: true });
          return;
        }
      }
      setLocalError('Your email is not verified yet. Please click the verification link sent to your inbox.');
    } catch (err: any) {
      setLocalError(err.message || 'Could not verify email status.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleResendVerification = async () => {
    if (isResending || resendCooldown > 0) return;
    setIsResending(true);
    setResendSuccess(false);
    setLocalError(null);
    try {
      const targetEmail = registeredEmail || email;
      const res = await resendVerificationEmail(targetEmail, name, 'clinic');
      if (res.ok) {
        setResendSuccess(true);
        setResendCooldown(60);
      } else {
        setLocalError(res.error || 'Failed to resend verification email.');
      }
    } catch (err: any) {
      setLocalError(err.message || 'Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Email Submit (Sign-In or Register) ────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setLoading(true);

    if (activeTab === 'signin') {
      const res = await loginWithEmail(cleanEmail, password, 'clinic_admin');
      setLoading(false);
      if (res.ok && res.user) {
        handleAfterAuth(res.user, res.clinic);
      } else if (res.error) {
        setLocalError(res.error);
      }
    } else {
      // Register
      const pwdErr = getPasswordValidationError(password, confirmPassword);
      if (pwdErr) {
        setLocalError(pwdErr);
        setLoading(false);
        return;
      }
      const uniqCheck = await assertPasswordUniqueness(password);
      if (!uniqCheck.ok) {
        setLocalError(uniqCheck.error || 'This password is already in use by another account. Please choose a different password.');
        setLoading(false);
        return;
      }
      if (!name.trim()) {
        setLocalError('Please enter your full name.');
        setLoading(false);
        return;
      }
      const cleanPhone = phone.replace(/\D/g, '');
      const onboarding: OnboardingData = {
        role: 'clinic_admin',
        name: name.trim(),
        email: cleanEmail,
        phone: cleanPhone || undefined,
      };
      const res = await registerWithEmail(cleanEmail, password, onboarding);
      setLoading(false);
      if (res.ok) {
        setRegisteredEmail(cleanEmail);
        setShowVerificationModal(true);
        setResendCooldown(60);
        // Clean mode from URL so we're ready for sign in
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('mode');
        const q = newParams.toString();
        navigate(q ? `/clinic/login?${q}` : '/clinic/login', { replace: true });
        setPassword('');
        setConfirmPassword('');
        setLocalError(null);
      } else if (res.error) {
        setLocalError(res.error);
      }
    }
  };

  // ── Phone OTP: Send ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    const clean = phone.replace(/\D/g, '');
    if (!isValid10Digit(clean)) {
      setLocalError('Phone number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    const res = await sendPhoneOtp(clean, 'clinic-recaptcha-container');
    setLoading(false);
    if (res.ok) setOtpSent(true);
  };

  // ── Phone OTP: Verify ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (otp.trim().length < 4) {
      setLocalError('Please enter the 6-digit OTP sent to your phone.');
      return;
    }
    setLoading(true);
    const onboarding: OnboardingData = { role: 'clinic_admin' };
    const res = await verifyPhoneOtp(otp.trim(), onboarding);
    setLoading(false);
    if (res.ok && res.user) {
      handleAfterAuth(res.user, res.clinic);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* reCAPTCHA container — invisible */}
      <div id="clinic-recaptcha-container" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={false} />
        </div>
        <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 mb-3">
          <Building2 className="w-3.5 h-3.5 text-teal-600" />
          <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Clinic Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          {activeTab === 'signin' ? 'Clinic Sign In' : 'Register Your Clinic'}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {activeTab === 'signin'
            ? 'Access your clinic dashboard and manage your practice'
            : 'Create your clinic account and set up your practice'}
        </p>
      </div>

      {/* Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-100 rounded-2xl p-6 sm:p-8">

          {verificationCode ? (
            <div className="py-6 text-center animate-in fade-in">
              {verificationState === 'ready' && (
                <>
                  <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mx-auto mb-4 shadow-sm">
                    <Building2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verify Your Clinic Account</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                    Click the button below to confirm your email address and activate your clinic administration account.
                  </p>
                  <button
                    type="button"
                    onClick={handleExecuteVerification}
                    className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <CheckCircle2 className="w-5 h-5 text-teal-200" />
                    <span>Verify Email & Activate Account</span>
                  </button>
                </>
              )}

              {verificationState === 'verifying' && (
                <div className="py-6">
                  <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mx-auto mb-4 animate-pulse shadow-sm">
                    <Loader2 className="w-8 h-8 animate-spin text-teal-700" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Verifying Clinic Email Address</h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6 leading-relaxed">
                    Please wait while we verify your email address and activate your account...
                  </p>
                  <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-teal-50 border border-teal-200/80 text-teal-800 text-xs font-semibold shadow-xs">
                    <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
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
                    Your clinic administrator email has been confirmed. You can now proceed to setup your clinic details.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (auth.currentUser) {
                        navigate('/clinic/setup', { replace: true });
                      } else {
                        setVerificationCode(null);
                        setActiveTab('signin');
                        setLocalError('Email verified successfully! Please sign in with your clinic credentials.');
                      }
                    }}
                    className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99]"
                  >
                    <span>{auth.currentUser ? 'Proceed to Clinic Setup' : 'Proceed to Sign In'}</span>
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
                        setActiveTab('signin');
                      }}
                      className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      Go to Sign In
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Tab Switch */}
              <div className="flex rounded-xl bg-slate-100 p-1.5 mb-6 border border-slate-200/80">
            <button
              type="button"
              onClick={() => switchTab('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'signin' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Active Patient Session Prompt */}
          {user && PATIENT_ROLES.includes(user.role) && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-amber-900 mb-0.5">Active Patient Session Detected</p>
                  <p className="text-amber-800 text-xs mb-2.5">
                    You are currently signed in with a Patient account (<strong>{user.email || user.name}</strong>). The Clinic Portal requires a Clinic Staff or Clinic Admin account.
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
                      Sign Out & Log In to Clinic
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/patient/dashboard')}
                      className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg transition-colors"
                    >
                      Go to Patient Portal
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

          {/* ── SIGN IN TAB ── */}
          {activeTab === 'signin' && (
            <>
                  {/* Email/Password Sign-In Form */}

                  {/* Method toggle: Email only — Phone OTP hidden until integration is complete */}
                  {/* TODO: Re-enable Phone OTP toggle when ready */}

                  {/* Email/Password Sign-In Form */}
                  {loginMethod === 'email' && (
                    <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Email Address
                        </label>
                        <div className="relative">
                          <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            id="clinic-login-email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="clinic-login-password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <Link
                          to="/forgot-password?return=/clinic/login"
                          className="mt-1.5 text-[11px] font-semibold text-teal-700 hover:text-teal-900 float-right"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] mt-1"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  )}

            </>
          )}

          {/* ── CREATE ACCOUNT TAB ── */}
          {activeTab === 'register' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Your Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    id="clinic-reg-name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Dr. Priya Sharma"
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    id="clinic-reg-email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Smartphone className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    id="clinic-reg-phone"
                    autoComplete="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                  />
                </div>
              </div>


              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="clinic-reg-password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters with uppercase, number & symbol"
                    className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="clinic-reg-confirm"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full h-12 pl-11 pr-11 bg-white border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                      confirmPassword.length > 0
                        ? password === confirmPassword
                          ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                          : 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-slate-300 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(v => !v)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
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

              <PasswordRequirementsGuide password={password} confirmPassword={confirmPassword} showAlways={true} />

              <p className="text-[11px] text-slate-500">
                After registration, you'll complete your clinic profile in the next step.
              </p>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
            </>
          )}
        </div>


      </div>

      {/* Email Verification Confirmation Modal (Triggered when clinic account is created) */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700 mb-5 shadow-sm">
                <Building2 className="w-8 h-8" />
              </div>

              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Verify Your Clinic Email Address
              </h3>

              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                We've sent an official verification link to activate your clinic administration account:
              </p>

              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 break-all">
                <span className="text-sm font-semibold text-teal-900">{registeredEmail}</span>
              </div>

              {/* Auto-detect Status Pill */}
              <div className="w-full bg-teal-50 border border-teal-200/80 rounded-xl p-3 mb-4 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-700 shrink-0" />
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
                  className="w-full h-12 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white bg-teal-700 hover:bg-teal-800 transition-all shadow-md active:scale-[0.99] disabled:opacity-50"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  )}
                  <span>I've Confirmed My Email — Setup Clinic</span>
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
                    switchTab('signin');
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
