import { useState, useEffect } from 'react';
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
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { OnboardingData } from '../lib/identityResolver';
import { PATIENT_ROLES, ADMIN_ROLES } from '../lib/types';

function GoogleIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  );
}

type AuthTab = 'signin' | 'register';
type LoginMethod = 'email' | 'phone';

const isValidEmail = (val: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
const isValid10Digit = (val: string) => /^\d{10}$/.test(val.replace(/\D/g, ''));

export function ClinicLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');
  const {
    user,
    loginWithEmail,
    registerWithEmail,
    loginWithGoogle,
    sendPhoneOtp,
    verifyPhoneOtp,
    error: authError,
    clearError,
  } = useAuth();
  const initialMode = searchParams.get('mode') === 'register' ? 'register' : 'signin';
  const [activeTab, setActiveTab] = useState<AuthTab>(initialMode);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const errorMessage = localError || authError;

  // Redirect if already authenticated
  useEffect(() => {
    if (!user) return;
    if (PATIENT_ROLES.includes(user.role)) {
      navigate('/patient/dashboard', { replace: true });
      return;
    }
    if (ADMIN_ROLES.includes(user.role)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (returnUrl) {
      navigate(returnUrl, { replace: true });
      return;
    }
    // Doctors and staff directly open clinic dashboard
    if (user.role === 'clinic_doctor' || user.role === 'clinic_staff' || user.role === 'doctor' || user.role === 'staff') {
      navigate('/clinic/dashboard', { replace: true });
      return;
    }
    // Already registered clinic users (has clinic_id or clinic_setup_complete !== false)
    if (user.clinic_id || user.clinic_setup_complete !== false) {
      navigate('/clinic/dashboard', { replace: true });
    } else {
      navigate('/clinic/setup', { replace: true });
    }
  }, [user, navigate, returnUrl]);

  const handleAfterAuth = (role?: string, setupComplete?: boolean) => {
    if (role && PATIENT_ROLES.includes(role as any)) {
      navigate('/patient/dashboard', { replace: true });
      return;
    }
    if (role && ADMIN_ROLES.includes(role as any)) {
      navigate('/admin/dashboard', { replace: true });
      return;
    }
    if (returnUrl) {
      navigate(returnUrl, { replace: true });
      return;
    }
    // Doctors and staff directly open clinic dashboard
    if (role === 'clinic_doctor' || role === 'clinic_staff' || role === 'doctor' || role === 'staff') {
      navigate('/clinic/dashboard', { replace: true });
      return;
    }
    // Only brand-new clinic registrations without setup go to /clinic/setup
    if (setupComplete === false && activeTab === 'register') {
      navigate('/clinic/setup', { replace: true });
    } else {
      navigate('/clinic/dashboard', { replace: true });
    }
  };

  // ── Google Sign-In ──────────────────────────────────────────────────────────
  const handleGoogleAuth = async () => {
    setLocalError(null);
    clearError();
    setLoading(true);
    const onboarding: OnboardingData = { role: 'clinic_admin' };
    const res = await loginWithGoogle(onboarding);
    setLoading(false);
    if (res.ok && res.user) {
      handleAfterAuth(res.user.role, res.user.clinic_setup_complete);
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
    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    if (activeTab === 'signin') {
      const res = await loginWithEmail(cleanEmail, password, 'admin');
      setLoading(false);
      if (res.ok && res.user) {
        handleAfterAuth(res.user.role, res.user.clinic_setup_complete);
      }
    } else {
      // Register
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
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
      if (res.ok && res.user) {
        handleAfterAuth(res.user.role, res.user.clinic_setup_complete);
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
      handleAfterAuth(res.user.role, res.user.clinic_setup_complete);
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setResetSent(true);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: AuthTab) => {
    setActiveTab(tab);
    setOtpSent(false);
    setLocalError(null);
    clearError();
    setForgotMode(false);
    setResetSent(false);
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

          {/* Feedback Banner */}
          {errorMessage && (
            <div className={`flex items-start gap-3 p-3.5 border rounded-xl mb-5 animate-in fade-in duration-150 ${
              errorMessage.includes('successful') || errorMessage.includes('confirmation link')
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                errorMessage.includes('successful') || errorMessage.includes('confirmation link') ? 'text-emerald-600' : 'text-rose-600'
              }`} />
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* ── SIGN IN TAB ── */}
          {activeTab === 'signin' && (
            <>
                  {/* Google Sign-In */}
                  <div className="mb-5">
                    <button
                      type="button"
                      onClick={handleGoogleAuth}
                      disabled={loading}
                      className="w-full h-12 flex items-center justify-center gap-3 px-4 rounded-xl text-sm font-semibold transition-all border bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-sm hover:border-slate-400 active:scale-[0.99]"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-600" /> : <GoogleIcon />}
                      <span>Continue with Google</span>
                    </button>
                  </div>

                  {/* Divider */}
                  <div className="relative mb-5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs font-semibold uppercase tracking-wider">
                      <span className="bg-white px-3 text-slate-400">Or continue with</span>
                    </div>
                  </div>

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
                    placeholder="Min. 6 characters"
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
                    type="password"
                    id="clinic-reg-confirm"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

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
        </div>


      </div>
    </div>
  );
}
