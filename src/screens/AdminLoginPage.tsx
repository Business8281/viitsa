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
    if (user.role === 'company_admin') { navigate('/admin/dashboard', { replace: true }); return; }
    if (user.role === 'patient') { navigate('/patient/dashboard', { replace: true }); return; }
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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink">
          {isRegisterMode ? 'Create Admin Account' : 'Admin Sign In'}
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          {isRegisterMode
            ? 'Register a new system administrator'
            : 'Restricted access — VIITSA system administrators only'}
        </p>
      </div>

      {/* Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white border border-black/5 shadow-sm rounded-2xl p-6 sm:p-8"
             style={{ boxShadow: '0 1px 3px rgba(15,27,44,0.06), 0 1px 2px rgba(15,27,44,0.04)' }}>

          {/* Tab switch */}
          <div className="flex rounded-xl bg-surface p-1.5 mb-6 border border-black/5">
            <button
              type="button"
              onClick={() => switchTab(false)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                !isRegisterMode ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchTab(true)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                isRegisterMode ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
            >
              Register Admin
            </button>
          </div>

          {/* Error */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 bg-danger-bg border border-danger/20 rounded-xl mb-5 animate-slide-up">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium text-danger leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* ── SIGN IN ── */}
          {!isRegisterMode && (
            <>
              {forgotMode && resetSent ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-primary mx-auto mb-3" />
                  <h3 className="text-base font-bold text-ink mb-1">Reset email sent!</h3>
                  <p className="text-xs text-ink-muted mb-5">Check your inbox and follow the link to reset your password.</p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false); }}
                    className="text-sm font-semibold text-primary hover:text-primary-700"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              ) : forgotMode ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="label">Admin Email</label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@viitsa.com"
                        className="input pl-10"
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="btn-primary w-full h-11">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => setForgotMode(false)} className="btn-ghost w-full">
                    ← Back
                  </button>
                </form>
              ) : (
                <>
                  {/* Method toggle */}
                  <div className="grid grid-cols-2 gap-2 mb-5">
                    <button
                      type="button"
                      onClick={() => { setLoginMethod('email'); setOtpSent(false); setLocalError(null); }}
                      className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all border ${
                        loginMethod === 'email'
                          ? 'bg-primary-50 border-primary text-primary shadow-sm'
                          : 'bg-white border-black/10 text-ink-muted hover:bg-surface'
                      }`}
                    >
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setLoginMethod('phone'); setLocalError(null); }}
                      className={`py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg flex items-center justify-center gap-2 transition-all border ${
                        loginMethod === 'phone'
                          ? 'bg-primary-50 border-primary text-primary shadow-sm'
                          : 'bg-white border-black/10 text-ink-muted hover:bg-surface'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Phone OTP</span>
                    </button>
                  </div>

                  {/* Email / Password */}
                  {loginMethod === 'email' && (
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
                          <button type="button" onClick={() => setForgotMode(true)} className="text-xs font-semibold text-primary hover:text-primary-700">
                            Forgot password?
                          </button>
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
                  )}

                  {/* Phone OTP */}
                  {loginMethod === 'phone' && (
                    <>
                      {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                          <div>
                            <label className="label">Admin Mobile Number</label>
                            <div className="flex items-center gap-2">
                              <span className="h-10 px-3.5 bg-surface border border-black/10 rounded-lg text-sm font-bold text-ink flex items-center">+91</span>
                              <input
                                type="tel"
                                id="admin-signin-phone"
                                inputMode="numeric"
                                maxLength={10}
                                required
                                value={phone}
                                onKeyDown={e => {
                                  if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
                                  if (e.ctrlKey || e.metaKey) return;
                                  if (!/^\d$/.test(e.key)) e.preventDefault();
                                }}
                                onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                placeholder="9876543210"
                                className="input flex-1 font-mono"
                              />
                            </div>
                          </div>
                          <button type="submit" disabled={loading} className="btn-primary w-full h-11">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                          <div className="p-3 bg-primary-50 border border-primary/20 rounded-xl text-xs text-primary font-semibold text-center">
                            OTP sent to +91 {phone}
                          </div>
                          <div>
                            <label className="label">Enter 6-digit OTP</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              required
                              value={otp}
                              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="••••••"
                              className="input text-center tracking-[0.5em] text-lg font-bold font-mono"
                              autoFocus
                            />
                          </div>
                          <button type="submit" disabled={loading} className="btn-primary w-full h-11">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Verify & Sign In</span><ArrowRight className="w-4 h-4" /></>}
                          </button>
                          <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }} className="btn-ghost w-full">
                            ← Change number
                          </button>
                        </form>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── REGISTER ── */}
          {isRegisterMode && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="label">Full Name <span className="text-danger">*</span></label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                  <input
                    type="text"
                    id="admin-reg-name"
                    autoComplete="name"
                    required
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Full name"
                    className="input pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="label">Email Address <span className="text-danger">*</span></label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                  <input
                    type="email"
                    id="admin-reg-email"
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
                <label className="label">Password <span className="text-danger">*</span></label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="admin-reg-password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="input pl-10 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-2.5 text-ink-subtle hover:text-ink">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm Password <span className="text-danger">*</span></label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-ink-subtle absolute left-3.5 top-3" />
                  <input
                    type="password"
                    id="admin-reg-confirm"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="input pl-10"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full h-11">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Create Admin Account</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
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
