import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Mail, Lock, ArrowRight, Zap, Shield, CheckCircle, Home, ArrowLeft, Eye, EyeOff,
  AlertCircle, Smartphone, KeyRound,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { auth } from '../lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, sendPasswordResetEmail, isSignInWithEmailLink } from 'firebase/auth';

type LoginMode = 'password' | 'email-otp' | 'mobile-otp';

export function AuthLoginPage() {
  const [mode, setMode] = useState<LoginMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const navigate = useNavigate();
  const { login, loginWithOtp, verifyEmailOtp } = useAuth();
  
  // Auto-verify email links on mount
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      setMode('email-otp');
      setOtpSent(true);
      setLoading(true);
      // Wait a tick to allow Firebase to initialize if needed
      setTimeout(async () => {
        const result = await verifyEmailOtp('', ''); // email/otp is handled inside verifyEmailOtp
        if (result.ok) {
          navigate('/dashboard');
        } else {
          setError(result.error || 'Invalid verification link');
          setLoading(false);
        }
      }, 500);
    }
  }, []);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    if (result.ok) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Login failed');
    }
    setLoading(false);
  };

  const handleSendEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await loginWithOtp(email.trim().toLowerCase());
    if (result.ok) {
      setOtpSent(true);
    } else {
      setError(result.error || 'Failed to send code');
    }
    setLoading(false);
  };

  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await verifyEmailOtp(email.trim().toLowerCase(), otp);
    if (result.ok) {
      navigate('/dashboard');
    } else {
      setError(result.error || 'Invalid code');
    }
    setLoading(false);
  };

  const handleSendMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    setLoading(true);
    const fullPhone = clean.length === 10 ? `+91${clean}` : `+${clean}`;
    
    try {
      if (!(window as any).recaptchaVerifierAuthLogin) {
        (window as any).recaptchaVerifierAuthLogin = new RecaptchaVerifier(auth, 'recaptcha-container-login', {
          size: 'invisible'
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, (window as any).recaptchaVerifierAuthLogin);
      setConfirmationResult(confirmation);
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Unable to send login code.');
    }
    setLoading(false);
  };

  const handleVerifyMobileOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!confirmationResult) return;
    setLoading(true);
    try {
      await confirmationResult.confirm(otp);
      // Mobile OTP users go to patient portal
      navigate('/patient');
    } catch (err) {
      setError('Invalid verification code.');
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Unable to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetOtpState = () => {
    setOtpSent(false);
    setOtp('');
    setError('');
  };

  const modeTabs: { key: LoginMode; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { key: 'password', label: 'Password', icon: Lock },
    { key: 'email-otp', label: 'Email Link', icon: Mail },
    { key: 'mobile-otp', label: 'Mobile OTP', icon: Smartphone },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex">
      <div id="recaptcha-container-login"></div>
      {/* Left Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <ViitsaLogo size="md" />
            <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition">
              <Home size={14} /> Home
            </Link>
          </div>

          {!showForgot ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h1>
                <p className="text-slate-600">Sign in to your VIITSA account</p>
              </div>

              {/* Mode tabs */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {modeTabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => { setMode(tab.key); resetOtpState(); }}
                      className={`flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl text-sm font-medium transition-all ${
                        mode === tab.key
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Icon size={18} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5">
                  <AlertCircle size={16} />
                  {error}
                </div>
              )}

              {/* Password mode */}
              {mode === 'password' && (
                <form onSubmit={handlePasswordLogin} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="you@clinic.com"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button type="button" onClick={() => setShowForgot(true)} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                      Forgot password?
                    </button>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                  >
                    {loading ? (
                      <><span className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />Signing in...</>
                    ) : (
                      <>Sign In <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>
              )}

              {/* Email OTP mode */}
              {mode === 'email-otp' && !otpSent && (
                <form onSubmit={handleSendEmailOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="you@clinic.com"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : <>Send Login Link <KeyRound className="w-5 h-5" /></>}
                  </button>
                </form>
              )}

              {mode === 'email-otp' && otpSent && (
                <form onSubmit={handleVerifyEmailOtp} className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    <span>Link sent to <strong>{email}</strong>. Check your inbox and click the link to sign in. (Leave this window open).</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Enter code (if applicable)</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full text-center text-2xl font-bold tracking-[0.3em] rounded-xl border-2 border-slate-200 py-3.5 focus:outline-none focus:border-emerald-500"
                      placeholder="------"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {loading ? 'Verifying…' : <>Verify & Sign In <ArrowRight className="w-5 h-5" /></>}
                  </button>
                  <button type="button" onClick={resetOtpState} className="w-full text-sm text-slate-500 hover:text-slate-700">
                    Use a different email
                  </button>
                </form>
              )}

              {/* Mobile OTP mode */}
              {mode === 'mobile-otp' && !otpSent && (
                <form onSubmit={handleSendMobileOtp} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile number</label>
                    <div className="flex items-center gap-2">
                      <span className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-600">+91</span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="98765 43210"
                        inputMode="numeric"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : <>Send OTP <Smartphone className="w-5 h-5" /></>}
                  </button>
                </form>
              )}

              {mode === 'mobile-otp' && otpSent && (
                <form onSubmit={handleVerifyMobileOtp} className="space-y-5">
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-start gap-2">
                    <CheckCircle size={16} className="shrink-0 mt-0.5" />
                    <span>OTP sent to +91 {phone}. Enter the 6-digit code.</span>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Enter OTP</label>
                    <input
                      type="text"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full text-center text-2xl font-bold tracking-[0.3em] rounded-xl border-2 border-slate-200 py-3.5 focus:outline-none focus:border-emerald-500"
                      placeholder="------"
                      inputMode="numeric"
                      maxLength={6}
                      autoFocus
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || otp.length < 6}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {loading ? 'Verifying…' : <>Verify & Continue <ArrowRight className="w-5 h-5" /></>}
                  </button>
                  <button type="button" onClick={resetOtpState} className="w-full text-sm text-slate-500 hover:text-slate-700">
                    Change number
                  </button>
                </form>
              )}

              <div className="mt-8 text-center">
                <p className="text-slate-600">
                  Don't have an account?{' '}
                  <Link to="/register" className="text-emerald-600 hover:text-emerald-700 font-semibold">
                    Register your clinic
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { setShowForgot(false); setResetSent(false); }} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
                <ArrowLeft size={14} /> Back to login
              </button>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">Reset your password</h1>
              <p className="text-slate-600 mb-6">We'll send a secure reset link to your email.</p>

              {resetSent ? (
                <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm px-4 py-4 rounded-xl flex items-start gap-3">
                  <CheckCircle size={18} className="shrink-0 mt-0.5" />
                  <span>Reset link sent! Check your inbox and follow the instructions to reset your password.</span>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        placeholder="you@clinic.com"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send Reset Link'}
                    {!loading && <ArrowRight className="w-5 h-5" />}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 items-center justify-center p-12">
        <div className="max-w-lg text-white">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              AI Healthcare Intelligence
            </div>
            <h2 className="text-4xl font-bold mb-4">Smarter Healthcare. For Everyone.</h2>
            <p className="text-emerald-100 text-lg">
              Join clinics across India managing appointments, patients, billing, and more with AI-powered insights on the VIITSA platform.
            </p>
          </div>
          <div className="space-y-4">
            {[
              'AI-powered patient triage and insights',
              'Real-time appointment management',
              'Automated billing and invoicing',
              'WhatsApp patient reminders',
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="text-sm">End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
