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

  const [loginMethod, setLoginMethod] = useState<LoginMethod>('email');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [adminName, setAdminName] = useState('');

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  const errorMessage = localError || authError;

  // Redirect if already authenticated
  useEffect(() => {
    if (!user) return;
    if (user.role === 'company_admin') {
      navigate('/admin/dashboard', { replace: true });
    } else if (user.role === 'patient') {
      navigate('/patient/dashboard', { replace: true });
    } else {
      navigate('/clinic/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── Email Submit ──────────────────────────────────────────────────────────
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(cleanEmail)) {
      setLocalError('Please enter a valid email address.');
      return;
    }
    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    if (!isRegisterMode) {
      const res = await loginWithEmail(cleanEmail, password);
      setLoading(false);
      if (res.ok && res.user) {
        if (res.user.role !== 'company_admin') {
          setLocalError('This account is not an admin account. Please use the correct login portal.');
          return;
        }
        navigate('/admin/dashboard', { replace: true });
      }
    } else {
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.');
        setLoading(false);
        return;
      }
      if (!adminName.trim()) {
        setLocalError('Please enter your full name.');
        setLoading(false);
        return;
      }
      const onboarding: OnboardingData = {
        role: 'company_admin',
        name: adminName.trim(),
        email: cleanEmail,
      };
      const res = await registerWithEmail(cleanEmail, password, onboarding);
      setLoading(false);
      if (res.ok && res.user) {
        navigate('/admin/dashboard', { replace: true });
      }
    }
  };

  // ── Phone OTP: Send ───────────────────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    const clean = phone.replace(/\D/g, '');
    if (!/^\d{10}$/.test(clean)) {
      setLocalError('Phone number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    const res = await sendPhoneOtp(clean, 'admin-recaptcha-container');
    setLoading(false);
    if (res.ok) setOtpSent(true);
  };

  // ── Phone OTP: Verify ─────────────────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    if (otp.trim().length < 4) {
      setLocalError('Please enter the 6-digit OTP.');
      return;
    }
    setLoading(true);
    const onboarding: OnboardingData = {
      role: 'company_admin',
      name: adminName.trim() || 'Admin',
    };
    const res = await verifyPhoneOtp(otp.trim(), onboarding);
    setLoading(false);
    if (res.ok && res.user) {
      if (res.user.role !== 'company_admin') {
        setLocalError('This phone number is not linked to an admin account.');
        return;
      }
      navigate('/admin/dashboard', { replace: true });
    }
  };

  // ── Forgot Password ───────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^@]+@[^@]+\.[^@]+$/.test(cleanEmail)) {
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

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* reCAPTCHA container */}
      <div id="admin-recaptcha-container" />

      {/* Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={true} />
        </div>
        <div className="inline-flex items-center gap-2 bg-violet-500/20 border border-violet-500/40 rounded-full px-4 py-1.5 mb-4">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-bold text-violet-300 uppercase tracking-widest">Admin Portal</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          {isRegisterMode ? 'Create Admin Account' : 'Admin Sign In'}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          {isRegisterMode
            ? 'Register a new system administrator account'
            : 'Restricted access — VIITSA system administrators only'}
        </p>
      </div>

      {/* Card */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 border border-slate-700/60 shadow-2xl rounded-2xl p-6 sm:p-8">

          {/* Sign In / Register toggle */}
          <div className="flex rounded-xl bg-slate-800 p-1.5 mb-6 border border-slate-700/60">
            <button
              type="button"
              onClick={() => { setIsRegisterMode(false); setLocalError(null); clearError(); setForgotMode(false); setResetSent(false); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                !isRegisterMode ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegisterMode(true); setLocalError(null); clearError(); setForgotMode(false); setResetSent(false); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                isRegisterMode ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Admin
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="flex items-start gap-3 p-3.5 bg-red-900/40 border border-red-700/50 rounded-xl mb-5 text-red-300 animate-in fade-in duration-150">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* ── SIGN IN ── */}
          {!isRegisterMode && (
            <>
              {/* Forgot Password — reset sent */}
              {forgotMode && resetSent ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-10 h-10 text-violet-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold text-white mb-1">Reset email sent!</h3>
                  <p className="text-xs text-slate-400 mb-5">Check your inbox to reset your password.</p>
                  <button
                    onClick={() => { setForgotMode(false); setResetSent(false); }}
                    className="text-sm font-semibold text-violet-400 hover:text-violet-200"
                  >
                    ← Back to Sign In
                  </button>
                </div>
              ) : forgotMode ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                      Admin Email
                    </label>
                    <div className="relative">
                      <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full h-12 pl-11 pr-4 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Reset Link'}
                  </button>
                  <button type="button" onClick={() => setForgotMode(false)} className="w-full text-sm text-slate-400 hover:text-slate-200 font-semibold">
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
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-sm'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
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
                          ? 'bg-violet-600/20 border-violet-500 text-violet-300 shadow-sm'
                          : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>Phone OTP</span>
                    </button>
                  </div>

                  {/* Email/Password */}
                  {loginMethod === 'email' && (
                    <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Email</label>
                        <div className="relative">
                          <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                          <input
                            type="email"
                            id="admin-email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="admin@viitsa.com"
                            className="w-full h-12 pl-11 pr-4 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide">Password</label>
                          <button type="button" onClick={() => setForgotMode(true)} className="text-xs font-semibold text-violet-400 hover:text-violet-200">
                            Forgot?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                          <input
                            type={showPassword ? 'text' : 'password'}
                            id="admin-password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="Your password"
                            className="w-full h-12 pl-11 pr-11 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                          />
                          <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300">
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Sign In <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </form>
                  )}

                  {/* Phone OTP */}
                  {loginMethod === 'phone' && (
                    <>
                      {!otpSent ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">
                              Admin Mobile Number
                            </label>
                            <div className="flex items-center gap-2">
                              <span className="h-12 px-3.5 bg-slate-800 border border-slate-600 rounded-xl text-sm font-bold text-slate-300 flex items-center">+91</span>
                              <input
                                type="tel"
                                id="admin-phone"
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
                                className="flex-1 h-12 px-4 bg-slate-800 border border-slate-600 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                              />
                            </div>
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send OTP'}
                          </button>
                        </form>
                      ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                          <div className="bg-violet-900/30 border border-violet-700/40 rounded-xl p-3 text-center">
                            <p className="text-xs font-semibold text-violet-300">OTP sent to +91 {phone}</p>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Enter OTP</label>
                            <input
                              type="text"
                              inputMode="numeric"
                              maxLength={6}
                              required
                              value={otp}
                              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              placeholder="6-digit OTP"
                              className="w-full h-12 px-4 text-center tracking-widest font-mono text-lg bg-slate-800 border border-slate-600 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
                          >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Verify & Sign In <ArrowRight className="w-4 h-4" /></>}
                          </button>
                          <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }} className="w-full text-sm text-slate-400 hover:text-slate-200 font-semibold">
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

          {/* ── REGISTER ADMIN ── */}
          {isRegisterMode && (
            <form onSubmit={handleEmailSubmit} className="space-y-4" autoComplete="on">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Full Name <span className="text-red-400">*</span></label>
                <div className="relative">
                  <ShieldCheck className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    id="admin-reg-name"
                    autoComplete="name"
                    required
                    value={adminName}
                    onChange={e => setAdminName(e.target.value)}
                    placeholder="Admin Full Name"
                    className="w-full h-12 pl-11 pr-4 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Email <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    id="admin-reg-email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="admin@viitsa.com"
                    className="w-full h-12 pl-11 pr-4 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="admin-reg-password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 6 characters"
                    className="w-full h-12 pl-11 pr-11 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wide mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    id="admin-reg-confirm"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className="w-full h-12 pl-11 pr-4 bg-slate-800 border border-slate-600 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create Admin Account <ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}
        </div>

        {/* Footer links */}
        <div className="mt-5 text-center space-y-1.5">
          <p className="text-xs text-slate-500">
            <Link to="/clinic/login" className="text-slate-400 hover:text-slate-200 font-semibold">Clinic Portal</Link>
            {' · '}
            <Link to="/login" className="text-slate-400 hover:text-slate-200 font-semibold">Patient Portal</Link>
          </p>
          <p className="text-xs text-slate-600">VIITSA Admin — Restricted Access</p>
        </div>
      </div>
    </div>
  );
}
