import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail,
  Lock,
  Smartphone,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { OnboardingData } from '../lib/identityResolver';
import { ADMIN_ROLES, PATIENT_ROLES } from '../lib/types';

type LoginMethod = 'email' | 'phone';

const isValidEmail = (val: string) => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());
const isValid10Digit = (val: string) => /^\d{10}$/.test(val.replace(/\D/g, ''));

export function AdminLoginPage() {
  const navigate = useNavigate();
  const {
    user,
    loginWithEmail,
    registerWithEmail,
    sendPhoneOtp,
    verifyPhoneOtp,
    error: authError,
    clearError,
  } = useAuth();

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [adminName, setAdminName]       = useState('');
  const [phone, setPhone]               = useState('');
  const [otp, setOtp]                   = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent]           = useState(false);
  const [loading, setLoading]           = useState(false);
  const [localError, setLocalError]     = useState<string | null>(null);
  const [forgotMode, setForgotMode]     = useState(false);
  const [resetSent, setResetSent]       = useState(false);

  const errorMessage = localError || authError;

  useEffect(() => {
    if (!user) return;
    if (ADMIN_ROLES.includes(user.role)) { navigate('/admin/dashboard', { replace: true }); return; }
    if (PATIENT_ROLES.includes(user.role)) { navigate('/patient/dashboard', { replace: true }); return; }
    navigate('/clinic/dashboard', { replace: true });
  }, [user, navigate]);

  const switchTab = (register: boolean) => {
    setIsRegisterMode(register);
    setLocalError(null);
    clearError();
    setForgotMode(false);
    setResetSent(false);
    setOtpSent(false);
  };

  // ── Email submit ───────────────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) { setLocalError('Please enter a valid email address.'); return; }
    if (!password || password.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }

    setLoading(true);

    if (!isRegisterMode) {
      const res = await loginWithEmail(cleanEmail, password);
      setLoading(false);
      if (res.ok && res.user) {
        if (res.user.role !== 'company_admin') {
          setLocalError('This account does not have admin access. Please use the correct portal.');
          return;
        }
        navigate('/admin/dashboard', { replace: true });
      }
    } else {
      if (password !== confirmPassword) { setLocalError('Passwords do not match.'); setLoading(false); return; }
      if (!adminName.trim()) { setLocalError('Please enter your full name.'); setLoading(false); return; }
      const onboarding: OnboardingData = { role: 'company_admin', name: adminName.trim(), email: cleanEmail };
      const res = await registerWithEmail(cleanEmail, password, onboarding);
      setLoading(false);
      if (res.ok && res.user) navigate('/admin/dashboard', { replace: true });
    }
  };

  // ── Phone OTP: send ────────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (!isValid10Digit(phone)) { setLocalError('Phone number must be exactly 10 digits.'); return; }
    setLoading(true);
    const res = await sendPhoneOtp(phone.replace(/\D/g, ''), 'admin-recaptcha-container');
    setLoading(false);
    if (res.ok) setOtpSent(true);
  };

  // ── Phone OTP: verify ──────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (otp.trim().length < 4) { setLocalError('Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    const onboarding: OnboardingData = { role: 'company_admin', name: adminName.trim() || 'Admin' };
    const res = await verifyPhoneOtp(otp.trim(), onboarding);
    setLoading(false);
    if (res.ok && res.user) {
      if (res.user.role !== 'company_admin') {
        setLocalError('This phone is not linked to an admin account.');
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) { setLocalError('Please enter a valid email address.'); return; }
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

  return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* reCAPTCHA */}
      <div id="admin-recaptcha-container" />

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={false} />
        </div>
        <div className="inline-flex items-center gap-1.5 bg-primary-50 border border-primary/20 rounded-full px-3 py-1 mb-3">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary uppercase tracking-wide">Admin Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">Admin Sign In</h1>
        <p className="mt-1.5 text-sm text-ink-muted">Restricted access — VIITSA system administrators only</p>
      </div>

      {/* Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 sm:p-8"
             style={{ boxShadow: '0 1px 3px rgba(15,27,44,0.06), 0 1px 2px rgba(15,27,44,0.04)' }}>


          {/* Feedback Banner */}
          {errorMessage && (
            <div className={`flex items-start gap-3 p-3.5 border rounded-xl mb-5 animate-slide-up ${
              errorMessage.includes('successful') || errorMessage.includes('confirmation link')
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-danger-bg border-danger/20 text-danger'
            }`}>
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${
                errorMessage.includes('successful') || errorMessage.includes('confirmation link') ? 'text-emerald-600' : 'text-danger'
              }`} />
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* ── SIGN IN ── */}
          {!isRegisterMode && (
            <>

                   {/* Email / Password sign-in only */}
                   {/* Email / Password sign-in */}
                   <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
                      <div>
                        <label className="label">Email Address</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                          <input
                            type="email"
                            id="admin-signin-email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@viitsa.com"
                            className="input pl-10"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="label mb-0">Password</label>
                          <Link to="/forgot-password?return=/admin/login" className="text-xs font-semibold text-primary hover:text-primary-700">
                            Forgot password?
                          </Link>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="admin-signin-password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="input pl-10 pr-10"
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-2.5 text-ink-subtle hover:text-ink">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" disabled={loading} className="btn-primary w-full h-11 mt-1">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
                      </button>
                   </form>

            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-5 text-center space-y-1.5">
          <p className="text-xs text-ink-subtle">
            <Link to="/clinic/login" className="text-ink-muted hover:text-primary font-semibold">Clinic Portal</Link>
            {' · '}
            <Link to="/login" className="text-ink-muted hover:text-primary font-semibold">Patient Portal</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
