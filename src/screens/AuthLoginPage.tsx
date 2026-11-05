import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Smartphone,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { type Role, ADMIN_ROLES, CLINIC_ROLES } from '../lib/types';
import { checkRegistrationConflict } from '../lib/emailService';

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

export const isValid10DigitPhone = (val: string): boolean => {
  if (typeof val !== 'string') return false;
  return /^\d{10}$/.test(val.replace(/\D/g, ''));
};

export const isValidGmail = (val: string): boolean => {
  if (typeof val !== 'string') return false;
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim().toLowerCase());
};

export function AuthLoginPage() {
  const navigate = useNavigate();
  const {
    user,
    loginWithGoogle,
    sendWhatsAppLoginOtp,
    loginWithWhatsAppOtp,
    logout,
    error: authError,
    clearError,
  } = useAuth();

  // Form State
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Device Autofill Suggestions
  const [devicePhones, setDevicePhones] = useState<string[]>([]);

  // STRICT PORTAL ISOLATION: Flag patient portal on mount
  useEffect(() => {
    sessionStorage.setItem('viitsa_portal_intent', 'patient');
  }, []);

  // Cooldown countdown for resend button
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Load saved phone from localStorage for 1-click device auto-fill
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('viitsa_device_saved_phone');
      if (savedPhone) {
        const clean = savedPhone.replace(/\D/g, '').slice(-10);
        if (clean.length === 10) {
          setDevicePhones([clean]);
        }
      }
    } catch { }
  }, []);

  const saveDevicePhone = (phoneNum: string) => {
    try {
      localStorage.setItem('viitsa_device_saved_phone', phoneNum);
      setDevicePhones([phoneNum]);
    } catch { }
  };

  // If already authenticated with patient role, route automatically
  useEffect(() => {
    if (user) {
      // If user is Clinic Staff or Admin, do NOT redirect away to clinic; show switch banner
      if (ADMIN_ROLES.includes(user.role) || CLINIC_ROLES.includes(user.role)) {
        return;
      }
      navigate('/patient/dashboard', { replace: true });
    }
  }, [user, navigate]);

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

  // Google Sign-In (Patients and Attendants)
  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    setLoading(true);
    sessionStorage.setItem('viitsa_portal_intent', 'patient');

    const res = await loginWithGoogle({ role: 'patient' });
    setLoading(false);

    if (res.ok && res.user) {
      if (res.isNewUser) {
        try { sessionStorage.setItem('viitsa_is_new_registration', 'true'); } catch { }
      } else {
        try { sessionStorage.removeItem('viitsa_is_new_registration'); } catch { }
      }
      handleRouteByRole(res.role || res.user.role);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  // WhatsApp OTP: Step 1 - Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!isValid10DigitPhone(cleanPhone)) {
      setLocalError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    // Upfront Role Check: Block Clinic and Admin accounts from logging in at the Patient portal
    const conflictCheck = await checkRegistrationConflict(cleanPhone, undefined, 'patient', 'login', 'patient');
    if (!conflictCheck.allowed || conflictCheck.hasConflict) {
      setLoading(false);
      setLocalError(conflictCheck.conflictMessage || 'This mobile number cannot be used on the Patient Portal.');
      return;
    }

    const res = await sendWhatsAppLoginOtp(cleanPhone, 'patient', 'login');
    setLoading(false);

    if (res.ok) {
      saveDevicePhone(cleanPhone);
      setOtpSent(true);
      setResendCooldown(60);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  // WhatsApp OTP: Step 2 - Verify Code & Login
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setLocalError('Please enter the 6-digit verification code sent to your mobile number.');
      return;
    }

    setLoading(true);
    const res = await loginWithWhatsAppOtp(cleanPhone, cleanOtp, { role: 'patient' });
    setLoading(false);

    if (res.ok && res.user) {
      saveDevicePhone(cleanPhone);
      if (res.isNewUser) {
        try { sessionStorage.setItem('viitsa_is_new_registration', 'true'); } catch { }
      } else {
        try { sessionStorage.removeItem('viitsa_is_new_registration'); } catch { }
      }
      handleRouteByRole(res.role || res.user.role);
    } else if (res.error) {
      setLocalError(res.error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={false} />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-blue-50 text-[#106EBE] border border-[#106EBE]/20 mb-3 shadow-xs">
          <Users className="w-3.5 h-3.5 text-[#106EBE]" />
          <span className="text-xs font-bold uppercase tracking-wide">
            Patient & Attendant Portal
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">
          Patient Sign In
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          Access your appointments, health records, and prescriptions
        </p>
      </div>

      {/* Main Card Container */}
      <div className="mt-6 w-full max-w-md mx-auto">
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-100 rounded-2xl p-5 sm:p-8">

          {/* Active Clinic Session Prompt */}
          {user && (CLINIC_ROLES.includes(user.role as Role) || ADMIN_ROLES.includes(user.role as Role)) && (
            <div className="mb-5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm">
                  <p className="font-semibold text-amber-900 mb-0.5">Active Staff Session Detected</p>
                  <p className="text-amber-800 text-xs mb-2.5">
                    You are currently signed in with a Clinic / Staff account (<strong>{user.email || user.name}</strong>). The Patient Portal is for Patients and Attendants.
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
                      Sign Out & Log In as Patient
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
            const isClinicPortalRedirect = /clinic portal|\/clinic\/login/i.test(errorMessage);
            const isAdminPortalRedirect = /admin portal|\/admin\/login/i.test(errorMessage);

            return (
              <div className={`p-3.5 border rounded-xl mb-5 animate-in fade-in duration-150 ${isSuccess
                ? 'bg-[#0FFCBE]/15 border-[#0FFCBE]/50 text-black'
                : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                <div className="flex items-start gap-3">
                  {isSuccess ? (
                    <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-black" />
                  ) : (
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                  )}
                  <div className="space-y-2 flex-1">
                    <p className="text-xs sm:text-sm font-semibold leading-relaxed">{errorMessage}</p>
                    {isClinicPortalRedirect && (
                      <button
                        type="button"
                        onClick={() => navigate('/clinic/login')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm transition-all"
                      >
                        <span>Go to Clinic Portal</span>
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
                  </div>
                </div>
              </div>
            );
          })()}

          {/* METHOD 1: Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={loading}
            className="w-full mb-5 h-12 flex items-center justify-center gap-3 px-6 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-black/20 transition-all font-bold text-black shadow-sm disabled:opacity-50 active:scale-[0.99]"
          >
            <GoogleIcon className="w-5 h-5" />
            <span>Continue with Google</span>
          </button>

          <div className="relative mb-5 flex items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Or Login with Mobile Number
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* METHOD 2: Mobile Number OTP */}
          <div className="space-y-4">
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 pointer-events-none text-slate-500 font-semibold text-xs border-r border-slate-200 pr-2">
                      <Smartphone className="w-4 h-4 text-[#106EBE]" />
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      required
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      placeholder="10-digit mobile number"
                      className="w-full h-12 pl-20 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-black placeholder:text-slate-400 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all font-mono tracking-wider font-semibold"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    We'll send a 6-digit one-time password to your mobile number.
                  </p>

                  {/* 1-Click Device Phone Suggestion Pills */}
                  {devicePhones.length > 0 && !phone && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] font-semibold text-slate-400">Device suggestion:</span>
                      {devicePhones.map((savedPhone) => (
                        <button
                          key={savedPhone}
                          type="button"
                          onClick={() => setPhone(savedPhone)}
                          className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-[#0FFCBE]/20 text-black hover:bg-[#0FFCBE]/30 transition-colors border border-[#0FFCBE]/50 shadow-xs font-mono"
                        >
                          +91 {savedPhone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || phone.replace(/\D/g, '').length < 10}
                  className="w-full h-12 flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold text-white bg-[#106EBE] hover:bg-[#0D5A9C] transition-all disabled:opacity-50 shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <Smartphone className="w-4 h-4 text-[#0FFCBE]" />
                  <span>Login with Mobile Number</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                      6-Digit Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false);
                        setOtp('');
                      }}
                      className="text-xs text-[#106EBE] hover:underline font-semibold"
                    >
                      Change number (+91 {phone})
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      className="w-full h-12 text-center text-xl tracking-[0.4em] font-mono font-bold bg-white border border-slate-300 rounded-xl text-black placeholder:text-slate-300 focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-500 text-center">
                    Code sent to +91 {phone}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || otp.trim().length < 6}
                  className="w-full h-12 flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold text-white bg-[#106EBE] hover:bg-[#0D5A9C] transition-all disabled:opacity-50 shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
                  <span>Verify & Access Account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    disabled={loading || resendCooldown > 0}
                    onClick={handleSendOtp}
                    className="text-xs font-semibold text-[#106EBE] hover:underline disabled:opacity-50"
                  >
                    {resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : "Didn't receive the OTP? Resend code"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Attendant & Family Access Note */}
          <div className="mt-6 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs leading-relaxed">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[#106EBE] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-black">Family & Attendant Access:</span> Friends or family members registered as patient attendants can enter their own mobile number to log in via mobile OTP and access appointments and records.
              </div>
            </div>
          </div>

          {/* Doctor / Clinic Portal Redirect Link */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Are you a Doctor or Clinic Admin?{' '}
              <Link to="/clinic/login" className="font-bold text-[#106EBE] hover:underline">
                Sign in to Clinic Portal &rarr;
              </Link>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
