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
  ShieldCheck,
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { auth, functions, db } from '../lib/firebase';
import type { OnboardingData } from '../lib/identityResolver';
import { PATIENT_ROLES, ADMIN_ROLES } from '../lib/types';
import { getPasswordValidationError, assertPasswordUniqueness } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';
import { sendEmailAuthOtpCode, verifyEmailAuthOtpCode, checkRegistrationConflict } from '../lib/emailService';

type AuthTab = 'signin' | 'register';

const isValidEmail = (val: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
const isValid10Digit = (val: string) => /^\d{10}$/.test(val.replace(/\D/g, ''));

const getIdentifierType = (val: string): 'email' | 'phone' | 'empty' => {
  const trimmed = val.trim();
  if (!trimmed) return 'empty';
  if (/[a-zA-Z]/.test(trimmed) || trimmed.includes('@')) {
    return 'email';
  }
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length > 0) {
    return 'phone';
  }
  return 'empty';
};

const extractCleanPhone = (val: string): string => {
  const digits = val.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits.slice(-10);
};

// ── 6-Digit Individual OTP Input Component ──────────────────────────────────
interface SixDigitOtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
}

function SixDigitOtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = true,
  hasError = false,
}: SixDigitOtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const digits = Array.from({ length: 6 }, (_, idx) => value[idx] || '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const raw = e.target.value;
    const clean = raw.replace(/\D/g, '');

    if (!clean) {
      const next = [...digits];
      next[idx] = '';
      const updated = next.join('');
      onChange(updated);
      return;
    }

    if (clean.length > 1) {
      // Pasted or autofilled multiple characters
      const pasted = clean.slice(0, 6);
      onChange(pasted);
      const nextIdx = Math.min(pasted.length, 5);
      inputRefs.current[nextIdx]?.focus();
      if (pasted.length === 6 && onComplete) {
        onComplete(pasted);
      }
      return;
    }

    const next = [...digits];
    next[idx] = clean;
    const updated = next.join('');
    onChange(updated);

    if (idx < 5) {
      inputRefs.current[idx + 1]?.focus();
    }

    if (updated.length === 6 && onComplete) {
      onComplete(updated);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Backspace') {
      if (!digits[idx] && idx > 0) {
        const next = [...digits];
        next[idx - 1] = '';
        onChange(next.join(''));
        inputRefs.current[idx - 1]?.focus();
        e.preventDefault();
      } else {
        const next = [...digits];
        next[idx] = '';
        onChange(next.join(''));
      }
    } else if (e.key === 'ArrowLeft' && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && idx < 5) {
      inputRefs.current[idx + 1]?.focus();
      e.preventDefault();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    onChange(pasted);
    const nextIdx = Math.min(pasted.length, 5);
    inputRefs.current[nextIdx]?.focus();
    if (pasted.length === 6 && onComplete) {
      onComplete(pasted);
    }
  };

  return (
    <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 max-w-sm mx-auto my-2" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => { inputRefs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          disabled={disabled}
          value={digits[idx] || ''}
          onChange={(e) => handleChange(e, idx)}
          onKeyDown={(e) => handleKeyDown(e, idx)}
          className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold font-mono rounded-xl border bg-white transition-all focus:outline-none ${
            hasError
              ? 'border-rose-400 text-rose-700 focus:ring-2 focus:ring-rose-500/20'
              : digits[idx]
              ? 'border-[#106EBE] text-slate-900 ring-2 ring-[#106EBE]/20 shadow-xs'
              : 'border-slate-300 text-slate-900 focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20'
          } ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
        />
      ))}
    </div>
  );
}

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
    sendWhatsAppLoginOtp,
    loginWithWhatsAppOtp,
    refreshSession,
    logout,
    applyVerificationCode,
    error: authError,
    clearError,
  } = useAuth();

  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);

  // ── Sign In State (Smart Single-Box) ──────────────────────────────────────
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginOtp, setLoginOtp] = useState('');
  const [loginOtpSent, setLoginOtpSent] = useState(false);
  const [loginResendCooldown, setLoginResendCooldown] = useState(0);

  // ── Create Account (Dual Verification: Mobile WhatsApp OTP + Email OTP) ────
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);

  // Dual OTP Verification States
  const [dualOtpSent, setDualOtpSent] = useState(false);
  const [regMobileOtp, setRegMobileOtp] = useState('');
  const [regEmailOtp, setRegEmailOtp] = useState('');
  const [dualOtpLoading, setDualOtpLoading] = useState(false);
  const [dualOtpVerifying, setDualOtpVerifying] = useState(false);
  const [dualResendCooldown, setDualResendCooldown] = useState(0);

  // General UI state
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Email verification modal / link states
  const [verificationCode, setVerificationCode] = useState<string | null>(() => {
    return searchParams.get('mode') === 'verifyEmail' ? searchParams.get('oobCode') : null;
  });
  const [verificationState, setVerificationState] = useState<'ready' | 'verifying' | 'success' | 'error'>(() => {
    return searchParams.get('mode') === 'verifyEmail' && Boolean(searchParams.get('oobCode')) ? 'ready' : 'ready';
  });
  const [verificationError, setVerificationError] = useState<string | null>(null);

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

  // Cooldown countdowns
  useEffect(() => {
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
      setLoginResendCooldown((c) => (c > 0 ? c - 1 : 0));
      setDualResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync tab with URL search parameter if changed externally
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') {
      setActiveTab('register');
    } else if (mode !== 'register' && !searchParams.get('oobCode') && mode !== 'verifyEmail') {
      setActiveTab('signin');
    }
  }, [searchParams]);

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

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setLocalError(null);
    clearError();
    setLoginOtpSent(false);
    setLoginOtp('');
    setDualOtpSent(false);
    setRegMobileOtp('');
    setRegEmailOtp('');
    const newParams = new URLSearchParams();
    if (tab === 'register') {
      newParams.set('mode', 'register');
    }
    const ret = searchParams.get('return') || searchParams.get('returnUrl');
    if (ret) newParams.set('returnUrl', ret);
    const q = newParams.toString();
    navigate(q ? `/clinic/login?${q}` : '/clinic/login', { replace: true });
  };

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
          } catch { }
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

  // Handle ?mode=verifyEmail&oobCode=... and ?verified=true
  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const isVerifiedParam = searchParams.get('verified') === 'true';

    if (mode === 'resetPassword' || (oobCode && mode !== 'verifyEmail')) {
      const params = new URLSearchParams(searchParams);
      if (!params.has('return')) params.set('return', '/clinic/login');
      navigate(`/reset-password?${params.toString()}`, { replace: true });
      return;
    }

    if (mode === 'verifyEmail' && oobCode) {
      setVerificationCode(oobCode);
      return;
    }

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

  // Background auto-polling: checks if clinic email is confirmed
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
    // 1. Doctor role: always route directly to Doctor Home Dashboard (/doctor/dashboard)
    if (u.role === 'clinic_doctor' || u.role === 'doctor') {
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status;
      if (verificationStatus && verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      // If returnUrl was explicitly for a doctor subpage (e.g. /doctor/appointments), allow it;
      // otherwise, NEVER leak clinic administrative pages or cached returnUrls
      if (returnUrl && returnUrl.startsWith('/doctor') && !returnUrl.startsWith('/clinic')) {
        navigate(returnUrl, { replace: true });
        return;
      }
      navigate('/doctor/dashboard', { replace: true });
      return;
    }

    // 2. Safe returnUrl handling for non-doctor clinic users (do not route clinic staff/admins to /doctor)
    if (returnUrl) {
      if (!returnUrl.startsWith('/doctor')) {
        navigate(returnUrl, { replace: true });
        return;
      }
    }

    if (u.role === 'clinic_admin') {
      // 1. Basic clinic info onboarding form must be completed first
      if (u.clinic_setup_complete !== true) {
        navigate('/clinic/setup', { replace: true });
        return;
      }
      // 2. Verification documents upload must be completed second
      if (u.clinic_documents_uploaded !== true) {
        navigate('/clinic/upload-documents', { replace: true });
        return;
      }
      // 3. If setup & documents uploaded, check platform verification status
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status || u.clinic_verification_status || 'unverified';
      if (verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      // 4. Check subscription status
      const subStatus = clinicObj?.subscription_status || clinic?.subscription_status;
      if (subStatus !== 'active' && subStatus !== 'free_plan' && subStatus !== 'trial') {
        navigate('/clinic/subscription-setup', { replace: true });
        return;
      }
      // 5. Unlocked -> Dashboard
      navigate('/clinic/dashboard', { replace: true });
      return;
    }

    if (u.role === 'clinic_staff' || u.role === 'staff') {
      const verificationStatus = clinicObj?.verification_status || clinic?.verification_status;
      if (verificationStatus && verificationStatus !== 'approved') {
        navigate('/clinic/pending-approval', { replace: true });
        return;
      }
      navigate('/clinic/dashboard', { replace: true });
      return;
    }

    navigate('/clinic/dashboard', { replace: true });
  };

  useEffect(() => {
    if (verificationCode) return;
    if (!user) return;
    if (PATIENT_ROLES.includes(user.role)) {
      return;
    }
    if (ADMIN_ROLES.includes(user.role)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    routeClinicUser(user, clinic);
  }, [user, clinic, navigate, returnUrl, verificationCode]);

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
      const targetEmail = registeredEmail || regEmail;
      const res = await resendVerificationEmail(targetEmail, regName, 'clinic');
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

  // ── SMART SIGN IN: Detection & Submission ─────────────────────────────────
  const detectedType = getIdentifierType(identifier);
  const cleanPhone = extractCleanPhone(identifier);

  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);
    clearError();

    if (detectedType === 'email') {
      const cleanEmail = identifier.trim().toLowerCase();
      if (!isValidEmail(cleanEmail)) {
        setLocalError('Please enter a valid clinic email address.');
        return;
      }
      if (!password) {
        setLocalError('Please enter your password.');
        return;
      }

      setLoading(true);
      // Upfront Role Check: Block patient or admin from logging in at clinic portal
      const conflictCheck = await checkRegistrationConflict(undefined, cleanEmail, 'clinic_admin', 'login', 'clinic');
      if (!conflictCheck.allowed || conflictCheck.hasConflict) {
        setLoading(false);
        setLocalError(conflictCheck.conflictMessage || 'This email address is not registered as a clinic account.');
        return;
      }

      const res = await loginWithEmail(cleanEmail, password, 'clinic_admin');
      setLoading(false);
      if (res.ok && res.user) {
        handleAfterAuth(res.user, res.clinic);
      } else if (res.error) {
        setLocalError(res.error);
      }
    } else if (detectedType === 'phone') {
      if (!loginOtpSent) {
        // Send OTP
        await handleSendLoginOtp();
      } else {
        // Verify OTP
        await handleVerifyLoginOtp();
      }
    } else {
      setLocalError('Please enter your clinic email or 10-digit mobile number.');
    }
  };

  const handleSendLoginOtp = async () => {
    setLocalError(null);
    clearError();
    if (!isValid10Digit(cleanPhone)) {
      setLocalError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);
    // Upfront Role Check: NEVER send OTP if number is registered for patient, admin, or not a clinic account
    const conflictCheck = await checkRegistrationConflict(cleanPhone, undefined, 'clinic_admin', 'login', 'clinic');
    if (!conflictCheck.allowed || conflictCheck.hasConflict) {
      setLoading(false);
      setLocalError(conflictCheck.conflictMessage || 'This mobile number is not registered as a clinic account.');
      return;
    }

    const res = await sendWhatsAppLoginOtp(cleanPhone, 'clinic', 'login');
    setLoading(false);
    if (res.ok) {
      setLoginOtpSent(true);
      setLoginResendCooldown(60);
      setLoginOtp('');
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  const handleVerifyLoginOtp = async (codeToVerify?: string) => {
    setLocalError(null);
    clearError();
    const token = (codeToVerify || loginOtp).trim();
    if (token.length < 6) {
      setLocalError('Please enter the 6-digit verification code sent to your WhatsApp.');
      return;
    }

    setLoading(true);
    const onboarding: OnboardingData = { role: 'clinic_admin' };
    const res = await loginWithWhatsAppOtp(cleanPhone, token, onboarding);
    setLoading(false);
    if (res.ok && res.user) {
      handleAfterAuth(res.user, res.clinic);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  // ── CREATE ACCOUNT: Dual OTP Trigger & Verification (WhatsApp Mobile + Email OTP) ──
  const handleSendDualOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);
    clearError();

    if (!regName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }

    const clean = regPhone.replace(/\D/g, '').slice(-10);
    if (!isValid10Digit(clean)) {
      setLocalError('Please enter a valid 10-digit mobile number for WhatsApp verification.');
      return;
    }

    const cleanEmail = regEmail.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setLocalError('Please enter a valid clinic email address.');
      return;
    }

    const pwdErr = getPasswordValidationError(regPassword, regConfirmPassword);
    if (pwdErr) {
      setLocalError(pwdErr);
      return;
    }

    setDualOtpLoading(true);

    // 1. Check for registration / role conflict (mobile number and email)
    const conflictCheck = await checkRegistrationConflict(clean, cleanEmail, 'clinic_admin', 'register', 'clinic');
    if (!conflictCheck.allowed || conflictCheck.hasConflict) {
      setDualOtpLoading(false);
      setLocalError(conflictCheck.conflictMessage || 'This mobile number or email address is already registered with another account role.');
      return;
    }

    // 2. Global password uniqueness check before dispatching OTPs
    const uniqCheck = await assertPasswordUniqueness(regPassword);
    if (!uniqCheck.ok) {
      setLocalError(uniqCheck.error || 'This password is already in use by another account. Please choose a different password.');
      setDualOtpLoading(false);
      return;
    }

    try {
      // Trigger BOTH WhatsApp OTP and Email OTP simultaneously
      const [waRes, emailRes] = await Promise.all([
        sendWhatsAppLoginOtp(clean, 'clinic', 'register'),
        sendEmailAuthOtpCode(cleanEmail, regName.trim())
      ]);

      setDualOtpLoading(false);

      if (!waRes.ok) {
        setLocalError(waRes.error || 'Failed to dispatch WhatsApp OTP. Please verify your mobile number.');
        return;
      }

      if (!emailRes.success) {
        setLocalError(emailRes.error || 'Failed to dispatch Email verification code. Please check your email address.');
        return;
      }

      setDualOtpSent(true);
      setDualResendCooldown(60);
      setRegMobileOtp('');
      setRegEmailOtp('');
    } catch (err: any) {
      setDualOtpLoading(false);
      setLocalError(err.message || 'Failed to dispatch verification codes. Please try again.');
    }
  };

  const handleVerifyDualOtpAndRegister = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLocalError(null);
    clearError();

    const clean = regPhone.replace(/\D/g, '').slice(-10);
    const cleanEmail = regEmail.trim().toLowerCase();
    const cleanMobileOtp = regMobileOtp.trim();
    const cleanEmailOtp = regEmailOtp.trim();

    if (cleanMobileOtp.length < 6) {
      setLocalError('Please enter the 6-digit WhatsApp OTP sent to your mobile number.');
      return;
    }

    if (cleanEmailOtp.length < 6) {
      setLocalError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    setDualOtpVerifying(true);

    // Re-verify conflict before final registration
    const conflictCheck = await checkRegistrationConflict(clean, cleanEmail, 'clinic_admin', 'register', 'clinic');
    if (conflictCheck.hasConflict) {
      setDualOtpVerifying(false);
      setLocalError(conflictCheck.conflictMessage || 'This mobile number or email address is already registered with another account role.');
      return;
    }

    try {
      // 1. Verify WhatsApp OTP via Cloud Function
      const fnWa = httpsCallable(functions, 'verifyWhatsAppAuthOtp');
      const waRes: any = await fnWa({ phone: clean, otp: cleanMobileOtp });
      if (!waRes.data?.success) {
        setDualOtpVerifying(false);
        setLocalError(waRes.data?.message || 'Incorrect WhatsApp OTP. Please check your WhatsApp messages.');
        return;
      }

      // 2. Verify Email OTP via Cloud Function
      const emailRes = await verifyEmailAuthOtpCode(cleanEmail, cleanEmailOtp);
      if (!emailRes.success) {
        setDualOtpVerifying(false);
        setLocalError(emailRes.error || 'Incorrect Email verification code. Please check your inbox or spam folder.');
        return;
      }

      // 3. Both OTPs are verified! Create the clinic administrator account
      const onboarding: OnboardingData = {
        role: 'clinic_admin',
        name: regName.trim(),
        email: cleanEmail,
        phone: clean,
        phone_verified: true,
        email_verified: true,
      };

      // Persist verified credentials to session and local storage immediately
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('viitsa_reg_phone', clean);
        sessionStorage.setItem('viitsa_reg_email', cleanEmail);
        localStorage.setItem('viitsa_clinic_phone', clean);
        localStorage.setItem('viitsa_clinic_email', cleanEmail);
      }

      const res = await registerWithEmail(cleanEmail, regPassword, onboarding);

      if (res.ok && res.user) {
        // Enforce unverified state and setup flags so clinic completes onboarding form & documents upload first
        try {
          const userId = res.user.id || res.user.user_id;
          const userRef = doc(db, 'users', userId);
          await setDoc(userRef, {
            phone: clean,
            email: cleanEmail,
            phone_verified: true,
            email_verified: true,
            clinic_setup_complete: false,
            clinic_documents_uploaded: false,
            clinic_verification_status: 'unverified',
            verification_status: 'unverified',
            updated_at: new Date().toISOString()
          }, { merge: true });

          const clinicId = res.clinic?.id || res.clinic?.clinic_id || `cln_${userId}`;
          const clinicRef = doc(db, 'clinics', clinicId);
          await setDoc(clinicRef, {
            phone: clean,
            email: cleanEmail,
            phone_verified: true,
            email_verified: true,
            clinic_setup_complete: false,
            documents_uploaded: false,
            verification_status: 'unverified',
            approval_status: 'pending',
            updated_at: new Date().toISOString()
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Set initial clinic state error:', dbErr);
        }

        await refreshSession();
        setDualOtpVerifying(false);

        // Direct newly registered clinic to Step 1: Clinic Onboarding Setup Form!
        navigate('/clinic/setup', { replace: true });
        return;
      } else {
        setDualOtpVerifying(false);
        setLocalError(res.error || 'Registration failed. Please try again.');
      }
    } catch (err: any) {
      setDualOtpVerifying(false);
      setLocalError(err.message || 'Verification failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
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
            : 'Create your clinic account with dual-verified mobile & email'}
        </p>
      </div>

      {/* Card */}
      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-100 rounded-2xl p-6 sm:p-8">

          {/* Verification Code Handling (Email link click) */}
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
              )}
            </div>
          ) : (
            <>
              {/* Top Tabs */}
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

              {/* Error / Success Feedback Banner */}
              {errorMessage && (() => {
                const isSuccess = /success|verified|confirmed/i.test(errorMessage);
                const isPatientPortalRedirect = /patient portal|\/login\b/i.test(errorMessage);
                const isAdminPortalRedirect = /admin portal|\/admin\/login/i.test(errorMessage);
                const isRegisterTabRedirect = /create account tab/i.test(errorMessage);

                return (
                  <div className={`p-3.5 border rounded-xl mb-5 animate-in fade-in duration-150 ${
                    isSuccess
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <div className="flex items-start gap-3">
                      {isSuccess ? (
                        <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
                      ) : (
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                      )}
                      <div className="space-y-2.5 flex-1">
                        <p className="text-xs sm:text-sm font-semibold leading-relaxed">{errorMessage}</p>
                        {isPatientPortalRedirect && (
                          <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
                          >
                            <span>Go to Patient Portal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdminPortalRedirect && (
                          <button
                            type="button"
                            onClick={() => navigate('/admin/login')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
                          >
                            <span>Go to Admin Portal</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isRegisterTabRedirect && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab('register');
                              setLocalError(null);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#106EBE] hover:bg-[#0D5A9C] rounded-lg shadow-sm transition-all"
                          >
                            <span>Switch to Create Account Tab</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ═══════════════════════════════════════════════════════════════
                  TAB 1: SIGN IN (SMART SINGLE BOX: EMAIL OR MOBILE)
                  ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'signin' && (
                <form onSubmit={handleLoginSubmit} className="space-y-4" autoComplete="on">
                  {/* Single Smart Input Box */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                        Email or Mobile Number
                      </label>
                    </div>

                    <div className="relative">
                      {detectedType === 'phone' ? (
                        <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 pointer-events-none text-slate-500 font-semibold text-xs border-r border-slate-200 pr-2">
                          <Smartphone className="w-4 h-4 text-[#106EBE]" />
                          <span>+91</span>
                        </div>
                      ) : (
                        <Mail className={`w-5 h-5 absolute left-3.5 top-3.5 transition-colors ${
                          detectedType === 'email' ? 'text-[#106EBE]' : 'text-slate-400'
                        }`} />
                      )}

                      <input
                        type={detectedType === 'phone' ? 'tel' : 'text'}
                        id="clinic-login-identifier"
                        autoComplete="username"
                        required
                        disabled={loading || loginOtpSent}
                        value={identifier}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIdentifier(val);
                          setLocalError(null);
                          if (loginOtpSent) {
                            setLoginOtpSent(false);
                            setLoginOtp('');
                          }
                        }}
                        placeholder="Enter email or 10-digit mobile number"
                        className={`w-full h-12 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all font-medium ${
                          detectedType === 'phone' ? 'pl-20 font-mono tracking-wider font-semibold' : 'pl-11'
                        } ${loginOtpSent ? 'bg-slate-50 cursor-not-allowed' : ''}`}
                      />

                      {loginOtpSent && (
                        <button
                          type="button"
                          onClick={() => {
                            setLoginOtpSent(false);
                            setLoginOtp('');
                          }}
                          className="absolute right-3.5 top-3.5 text-xs font-semibold text-[#106EBE] hover:underline"
                        >
                          Change
                        </button>
                      )}
                    </div>
                  </div>

                  {/* BRANCH A: Detected as EMAIL -> Show Password Box & Forgot Password */}
                  {detectedType === 'email' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                            Password
                          </label>
                          <Link
                            to="/forgot-password?return=/clinic/login"
                            className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                          >
                            Forgot password?
                          </Link>
                        </div>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="clinic-login-password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || !password}
                        className="w-full h-12 bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg disabled:opacity-50"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In with Password <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </div>
                  )}

                  {/* BRANCH B: Detected as MOBILE -> Show 6-Digit OTP Boxes */}
                  {detectedType === 'phone' && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {!loginOtpSent ? (
                        <div>
                          <p className="text-xs text-slate-500 mb-4">
                            We'll send a 6-digit one-time password to your WhatsApp (+91 {cleanPhone || '...'}).
                          </p>
                          <button
                            type="button"
                            onClick={handleSendLoginOtp}
                            disabled={loading || cleanPhone.length < 10}
                            className="w-full h-12 bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg disabled:opacity-50"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Get 6-Digit OTP via WhatsApp <ArrowRight className="w-4 h-4" /></>}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                                Enter 6-Digit OTP
                              </label>
                              <span className="text-xs text-slate-500">
                                Sent to +91 {cleanPhone}
                              </span>
                            </div>

                            <SixDigitOtpInput
                              value={loginOtp}
                              onChange={setLoginOtp}
                              onComplete={(code) => handleVerifyLoginOtp(code)}
                              disabled={loading}
                              autoFocus={true}
                              hasError={Boolean(errorMessage)}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleVerifyLoginOtp()}
                            disabled={loading || loginOtp.length < 6}
                            className="w-full h-12 bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg disabled:opacity-50"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Sign In <ArrowRight className="w-4 h-4" /></>}
                          </button>

                          <div className="text-center pt-1">
                            <button
                              type="button"
                              disabled={loading || loginResendCooldown > 0}
                              onClick={handleSendLoginOtp}
                              className="text-xs font-semibold text-[#106EBE] hover:underline disabled:opacity-50"
                            >
                              {loginResendCooldown > 0
                                ? `Resend OTP in ${loginResendCooldown}s`
                                : "Didn't receive the OTP? Resend code"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* BRANCH C: Empty state */}
                  {detectedType === 'empty' && (
                    <button
                      type="submit"
                      disabled={true}
                      className="w-full h-12 bg-slate-100 text-slate-400 font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-not-allowed"
                    >
                      <span>Enter email or mobile to continue</span>
                    </button>
                  )}
                </form>
              )}

              {/* ═══════════════════════════════════════════════════════════════
                  TAB 2: CREATE ACCOUNT (DUAL VERIFICATION: MOBILE OTP + EMAIL OTP)
                  ═══════════════════════════════════════════════════════════════ */}
              {activeTab === 'register' && (
                <div className="space-y-4">
                  {/* Step Guidance Banner */}
                  <div className="p-3.5 bg-teal-50 border border-teal-200/80 rounded-xl text-xs text-teal-800 leading-relaxed flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-teal-900 block font-semibold mb-0.5">Dual Verification Required:</strong>
                      Both WhatsApp mobile OTP and email verification code are triggered at once. Once both are entered together, your account will be submitted for administrator approval.
                    </div>
                  </div>

                  {!dualOtpSent ? (
                    /* PHASE 1: ENTER CLINIC DETAILS & DISPATCH BOTH OTPS */
                    <form onSubmit={handleSendDualOtp} className="space-y-4" autoComplete="on">
                      {/* 1. Full Name */}
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
                            disabled={dualOtpLoading}
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="e.g. Dr. Priya Sharma"
                            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all font-medium"
                          />
                        </div>
                      </div>

                      {/* 2. Mobile Number (WhatsApp) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Mobile Number (WhatsApp) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 pointer-events-none text-slate-500 font-semibold text-xs border-r border-slate-200 pr-2">
                            <Smartphone className="w-4 h-4 text-[#106EBE]" />
                            <span>+91</span>
                          </div>
                          <input
                            type="tel"
                            id="clinic-reg-phone"
                            autoComplete="tel"
                            maxLength={10}
                            required
                            disabled={dualOtpLoading}
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            placeholder="10-digit mobile number"
                            className="w-full h-12 pl-20 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all font-mono tracking-wider font-semibold"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          A 6-digit verification code will be sent to your WhatsApp.
                        </p>
                      </div>

                      {/* 3. Email Address */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Clinic Email Address <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            id="clinic-reg-email"
                            autoComplete="email"
                            required
                            disabled={dualOtpLoading}
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="doctor@clinic.com"
                            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all font-medium"
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          A 6-digit verification code will be sent to your email inbox.
                        </p>
                      </div>

                      {/* 4. Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Account Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            id="clinic-reg-password"
                            autoComplete="new-password"
                            required
                            disabled={dualOtpLoading}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="Min. 8 characters with uppercase, number & symbol"
                            className="w-full h-12 pl-11 pr-11 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword((v) => !v)}
                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                          >
                            {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      {/* 5. Confirm Password */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                          Confirm Password <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            id="clinic-reg-confirm"
                            autoComplete="new-password"
                            required
                            disabled={dualOtpLoading}
                            value={regConfirmPassword}
                            onChange={(e) => setRegConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            className={`w-full h-12 pl-11 pr-11 bg-white border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all ${
                              regConfirmPassword.length > 0
                                ? regPassword === regConfirmPassword
                                  ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                                  : 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                : 'border-slate-300 focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword((v) => !v)}
                            className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        {regConfirmPassword.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold animate-in fade-in">
                            {regPassword === regConfirmPassword ? (
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

                      <PasswordRequirementsGuide password={regPassword} confirmPassword={regConfirmPassword} showAlways={true} />

                      {/* Primary Trigger Button: Dispatches Mobile & Email OTP at once */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={dualOtpLoading}
                          className="w-full h-12 bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg disabled:opacity-50"
                        >
                          {dualOtpLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Sending Mobile & Email Codes...</span>
                            </>
                          ) : (
                            <>
                              <span>Send Mobile & Email Verification Codes</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* PHASE 2: DUAL 6-DIGIT OTP ENTRY (ENTER TOGETHER) */
                    <form onSubmit={handleVerifyDualOtpAndRegister} className="space-y-4 animate-in fade-in duration-200">
                      {/* Dispatched Info Banner */}
                      <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold text-emerald-950 block mb-0.5">Verification Codes Dispatched:</strong>
                          Enter the 6-digit WhatsApp OTP sent to <strong>+91 {regPhone}</strong> and the 6-digit Email code sent to <strong>{regEmail}</strong> together below.
                        </div>
                      </div>

                      {/* OTP BOX 1: Mobile WhatsApp OTP */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <Smartphone className="w-4 h-4 text-[#106EBE]" />
                            <span>1. Mobile OTP (WhatsApp)</span>
                          </div>
                          <span className="text-xs font-mono font-bold text-slate-700">
                            +91 {regPhone}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Enter 6-digit OTP code received on WhatsApp:
                        </p>
                        <SixDigitOtpInput
                          value={regMobileOtp}
                          onChange={setRegMobileOtp}
                          disabled={dualOtpVerifying}
                          autoFocus={true}
                        />
                      </div>

                      {/* OTP BOX 2: Email Inbox OTP */}
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wide">
                            <Mail className="w-4 h-4 text-teal-700" />
                            <span>2. Email OTP (Inbox)</span>
                          </div>
                          <span className="text-xs font-mono font-semibold text-slate-700 truncate max-w-[180px]">
                            {regEmail}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Enter 6-digit verification code received in your email (check spam if needed):
                        </p>
                        <SixDigitOtpInput
                          value={regEmailOtp}
                          onChange={setRegEmailOtp}
                          disabled={dualOtpVerifying}
                          autoFocus={false}
                        />
                      </div>

                      {/* Resend & Edit Controls */}
                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          disabled={dualOtpLoading || dualResendCooldown > 0}
                          onClick={handleSendDualOtp}
                          className="text-xs font-semibold text-[#106EBE] hover:underline disabled:opacity-50"
                        >
                          {dualResendCooldown > 0
                            ? `Resend codes in ${dualResendCooldown}s`
                            : "Didn't receive codes? Resend both"}
                        </button>

                        <button
                          type="button"
                          disabled={dualOtpVerifying}
                          onClick={() => {
                            setDualOtpSent(false);
                            setRegMobileOtp('');
                            setRegEmailOtp('');
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline"
                        >
                          Edit Mobile or Email
                        </button>
                      </div>

                      {/* Primary Verification & Submit Button */}
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={dualOtpVerifying || regMobileOtp.length < 6 || regEmailOtp.length < 6}
                          className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] shadow-md hover:shadow-lg disabled:opacity-50"
                        >
                          {dualOtpVerifying ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                              <span>Verifying Codes & Submitting...</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-4 h-4 text-teal-200" />
                              <span>Verify Codes & Submit for Admin Approval</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                        <p className="text-center text-[11px] text-slate-500 mt-2">
                          Once verified, you will be redirected to the approval screen to await administrator verification.
                        </p>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          EMAIL VERIFICATION CONFIRMATION MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
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
