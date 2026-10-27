import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { sendPasswordResetNotificationEmail } from '../lib/emailService';
import { ViitsaLogo } from '../components/ViitsaLogo';

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

const isValidEmail = (val: string) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());

type PageState = 'form' | 'sent' | 'google_account';

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const portalIntent = typeof window !== 'undefined' ? sessionStorage.getItem('viitsa_portal_intent') : null;
  const defaultReturn = portalIntent === 'admin' ? '/admin/login' : portalIntent === 'clinic' ? '/clinic/login' : '/login';
  const returnTo = searchParams.get('return') || defaultReturn;
  const { loginWithGoogle } = useAuth();

  const [email, setEmail] = useState('');
  const [state, setState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [forceResetLoading, setForceResetLoading] = useState(false);
  const [isGoogleLinked, setIsGoogleLinked] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resolvedPortalType, setResolvedPortalType] = useState<'clinic' | 'patient' | 'admin'>(() => {
    if (returnTo.includes('admin')) return 'admin';
    if (returnTo.includes('clinic')) return 'clinic';
    return 'patient';
  });
  const [resolvedReturnUrl, setResolvedReturnUrl] = useState<string>(returnTo);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setErrorMsg(null);
    try {
      sessionStorage.setItem('viitsa_portal_intent', 'patient');
      const res = await loginWithGoogle({ role: 'patient' });
      if (res.ok) {
        const userRole = res.user?.role;
        if (userRole && ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(userRole)) {
          navigate('/clinic/dashboard', { replace: true });
        } else if (userRole && ['company_admin', 'company_manager', 'company_staff', 'admin'].includes(userRole)) {
          navigate('/admin/dashboard', { replace: true });
        } else {
          navigate('/patient/dashboard', { replace: true });
        }
      } else if (res.error) {
        setErrorMsg(res.error);
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Google sign-in failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading || !email) return;
    setResendLoading(true);
    setResendSuccess(false);
    setResendError(null);
    try {
      const res = await sendPasswordResetNotificationEmail(email.trim().toLowerCase(), resolvedReturnUrl, resolvedPortalType);
      if (res.success) {
        setResendSuccess(true);
        setResendCooldown(60);
      } else {
        setResendError(res.error || 'Failed to resend reset email. Please try again.');
      }
    } catch (err: any) {
      setResendError(err.message || 'Failed to resend reset email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSendResetAnyway = async () => {
    if (forceResetLoading || !email) return;
    setForceResetLoading(true);
    setErrorMsg(null);
    try {
      const res = await sendPasswordResetNotificationEmail(email.trim().toLowerCase(), resolvedReturnUrl, resolvedPortalType);
      if (res.success) {
        setState('sent');
      } else {
        setErrorMsg(res.error || 'Failed to send password reset email.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send reset email.');
    } finally {
      setForceResetLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // 1. Check if account exists across users and patient_accounts, and verify authentication method
      let detectedRole: string | null = null;
      try {
        let userData: any = null;
        let usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
        if (usersSnap.empty && cleanEmail !== email.trim()) {
          usersSnap = await getDocs(query(collection(db, 'users'), where('email', '==', email.trim())));
        }
        if (!usersSnap.empty) {
          userData = usersSnap.docs[0].data();
          detectedRole = userData.role;
        } else {
          let patSnap = await getDocs(query(collection(db, 'patient_accounts'), where('email', '==', cleanEmail)));
          if (patSnap.empty && cleanEmail !== email.trim()) {
            patSnap = await getDocs(query(collection(db, 'patient_accounts'), where('email', '==', email.trim())));
          }
          if (!patSnap.empty) {
            userData = patSnap.docs[0].data();
            detectedRole = 'patient';
          }
        }

        if (userData) {
          const providers = Array.isArray(userData.auth_providers)
            ? userData.auth_providers
            : (userData.auth_provider ? [userData.auth_provider] : []);

          if (providers.includes('google.com')) {
            setIsGoogleLinked(true);
          }
        }
      } catch (dbErr) {
        console.warn('Pre-check account existence warning:', dbErr);
      }

      // 2. Determine target return URL & portal type based on detected role or query param
      let returnUrl = returnTo.startsWith('/') ? returnTo : '/login';
      let portalType: 'clinic' | 'patient' | 'admin' = 'patient';
      if (detectedRole && ['company_admin', 'company_manager', 'company_staff', 'admin'].includes(detectedRole)) {
        returnUrl = '/admin/login';
        portalType = 'admin';
      } else if (detectedRole && ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(detectedRole)) {
        returnUrl = '/clinic/login';
        portalType = 'clinic';
      } else if (returnTo.includes('admin')) {
        portalType = 'admin';
      } else if (returnTo.includes('clinic')) {
        portalType = 'clinic';
      }

      setResolvedPortalType(portalType);
      setResolvedReturnUrl(returnUrl);

      const res = await sendPasswordResetNotificationEmail(cleanEmail, returnUrl, portalType);
      if (res.success) {
        setState('sent');
      } else {
        const code = (res as any).code;
        if (code === 'auth/user-not-found') {
          setErrorMsg('No account found with this email address. Please check your spelling or register a new account.');
        } else if (code === 'auth/invalid-email') {
          setErrorMsg('Please enter a valid email address.');
        } else if (code === 'auth/too-many-requests') {
          setErrorMsg('Too many password reset requests. Please wait a few minutes before trying again.');
        } else {
          setErrorMsg(res.error || 'Failed to send password reset email. Please try again.');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setErrorMsg('No account found with this email address. Please check your spelling or register a new account.');
      } else if (err.code === 'auth/invalid-email') {
        setErrorMsg('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorMsg('Too many password reset requests. Please wait a few minutes before trying again.');
      } else {
        setErrorMsg(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const backLink = resolvedReturnUrl.startsWith('/') ? resolvedReturnUrl : '/login';
  const portalLabel =
    resolvedPortalType === 'admin' ? 'Admin Portal' :
    resolvedPortalType === 'clinic' ? 'Clinic Portal' :
    'Patient Portal';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/30 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-100/30 rounded-full blur-3xl" />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <ViitsaLogo size="md" light={false} />
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200/80 shadow-xl shadow-slate-100/50 rounded-2xl overflow-hidden">

          {state === 'google_account' ? (
            /* ── GOOGLE ACCOUNT STATE ── */
            <div className="p-8 text-center animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-blue-50/80 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-blue-100 shadow-sm">
                <GoogleIcon className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">You Sign In with Google</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-1">
                The account for
              </p>
              <p className="text-sm font-bold text-slate-800 mb-4 break-all">{email.trim().toLowerCase()}</p>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-left mb-6">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-900 leading-relaxed space-y-1">
                    <p className="font-bold">No password required:</p>
                    <p>Your account is secured via Google Sign-In and does not require a password. You can sign in directly with Google below, or click the button below to create a permanent password.</p>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-xs text-red-700 text-left">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full h-12 flex items-center justify-center gap-3 px-6 rounded-xl border-2 border-slate-200 hover:border-teal-600 hover:bg-teal-50/30 transition-all font-bold text-slate-800 shadow-sm disabled:opacity-50 active:scale-[0.99] mb-4"
              >
                {googleLoading ? <Loader2 className="w-4 h-4 animate-spin text-teal-600" /> : <GoogleIcon className="w-5 h-5" />}
                <span>Sign In with Google</span>
              </button>

              <div className="bg-slate-50 rounded-xl p-3.5 text-left text-xs text-slate-600 mb-6 space-y-2">
                <p className="font-semibold text-slate-700">Want to sign in with email and password?</p>
                <p className="text-slate-500">Sign in with Google above, or create a permanent password for this account now:</p>
                <button
                  type="button"
                  onClick={handleSendResetAnyway}
                  disabled={forceResetLoading}
                  className="w-full py-2 px-3 bg-white hover:bg-teal-50/50 border border-teal-200 text-teal-700 hover:text-teal-800 rounded-lg font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                >
                  {forceResetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> : <Mail className="w-3.5 h-3.5 text-teal-600" />}
                  Send Link to Create Password
                </button>
              </div>

              <div className="space-y-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => { setState('form'); setEmail(''); setErrorMsg(null); }}
                  className="w-full h-10 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold transition-all"
                >
                  Try a different email
                </button>
                <Link
                  to={backLink}
                  className="flex items-center justify-center gap-2 w-full h-10 text-slate-500 hover:text-slate-800 text-xs font-semibold transition-all"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : state === 'sent' ? (
            /* ── SUCCESS STATE ── */
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Check your inbox</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-1">
                If an account exists for
              </p>
              <p className="text-sm font-bold text-slate-800 mb-4 break-all">{email}</p>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                you'll receive a password reset link shortly. Click the link in the email to create a new password.
              </p>

              {/* Steps */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-3 mb-6">
                {[
                  { num: '1', text: 'Open the email from Viitsa Healthcare (support@viitsa.com)' },
                  { num: '2', text: 'Click "Reset My Password"' },
                  { num: '3', text: 'Create your new password' },
                  { num: '4', text: 'Sign in with your new password' },
                ].map(step => (
                  <div key={step.num} className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-teal-600 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {step.num}
                    </div>
                    <span className="text-sm text-slate-700">{step.text}</span>
                  </div>
                ))}
              </div>

              {/* Notice Alert */}
              <div className="bg-teal-50 border border-teal-200/80 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-teal-950 leading-relaxed space-y-1">
                    <p className="font-bold">Official Security Notice:</p>
                    <p>The reset email is delivered directly from <strong>support@viitsa.com</strong> with a secure <strong>"Reset My Password"</strong> button.</p>
                    <p className="text-teal-800">If you don't see it in your inbox within 1–2 minutes, please check your Spam or Junk folder.</p>
                  </div>
                </div>
              </div>

              {isGoogleLinked && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
                  <div className="flex items-start gap-3">
                    <GoogleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-700 leading-relaxed space-y-2">
                      <p className="font-bold text-slate-800">Google Sign-In is also enabled for this email</p>
                      <p className="text-slate-600">You can reset your password using the email link sent above, or sign in directly with your Google account without needing a password.</p>
                      <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={googleLoading}
                        className="py-2 px-3.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-lg font-bold text-xs transition inline-flex items-center gap-2 shadow-xs"
                      >
                        {googleLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" /> : <GoogleIcon className="w-4 h-4" />}
                        <span>Sign In with Google</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {resendSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs font-semibold text-emerald-800 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Reset email resent successfully! Check your inbox.
                </div>
              )}

              {resendError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-xs font-semibold text-red-800 flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  {resendError}
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || resendLoading}
                  onClick={handleResend}
                  className="w-full h-11 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {resendLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                  {resendCooldown > 0 ? `Resend Reset Email (${resendCooldown}s)` : 'Resend Reset Email'}
                </button>
                <button
                  onClick={() => { setState('form'); setEmail(''); }}
                  className="w-full h-11 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all"
                >
                  Send to a different email
                </button>
                <Link
                  to={backLink}
                  className="flex items-center justify-center gap-2 w-full h-11 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-semibold transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            /* ── FORM STATE ── */
            <div className="p-8">
              {/* Portal badge */}
              <div className="flex justify-center mb-5">
                <div className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 ${
                  resolvedPortalType === 'admin' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
                  resolvedPortalType === 'clinic' ? 'bg-teal-50 border-teal-200 text-teal-700' :
                  'bg-teal-50 border-teal-200 text-teal-700'
                }`}>
                  <ShieldCheck className={`w-3.5 h-3.5 ${resolvedPortalType === 'admin' ? 'text-indigo-600' : 'text-teal-600'}`} />
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {portalLabel}
                  </span>
                </div>
              </div>

              <div className="text-center mb-7">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Reset your password</h1>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Enter your registered email address and we'll send you a secure link to reset your password.
                </p>
              </div>

              {/* Error alert */}
              {errorMsg && (
                <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl mb-5">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full h-12 pl-11 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg active:scale-[0.99]"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending reset link...</>
                    : 'Send Reset Link'
                  }
                </button>
              </form>

              {/* Back link */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <Link
                  to={backLink}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-slate-400">
          Reset links expire in 1 hour · Works for all VIITSA accounts
        </p>
      </div>
    </div>
  );
}
