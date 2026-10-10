import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ViitsaLogo } from '../components/ViitsaLogo';

const isValidEmail = (val: string) =>
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(val.trim());

type PageState = 'form' | 'sent' | 'error';

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('return') || '/login';

  const [email, setEmail] = useState('');
  const [state, setState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      await sendPasswordResetEmail(auth, cleanEmail, {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      });
      setState('sent');
    } catch (err: any) {
      // Firebase returns auth/user-not-found for unknown emails.
      // For security, we show the same "sent" screen regardless.
      // (Prevents email enumeration attacks)
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        // Still show success to prevent email harvesting
        setState('sent');
      } else {
        setErrorMsg(
          err.code === 'auth/too-many-requests'
            ? 'Too many requests. Please wait a few minutes before trying again.'
            : err.message || 'Failed to send reset email. Please try again.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const backLink = returnTo.startsWith('/') ? returnTo : '/login';
  const portalLabel =
    backLink.includes('admin') ? 'Admin Portal' :
    backLink.includes('clinic') ? 'Clinic Portal' :
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

          {state === 'sent' ? (
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
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-left space-y-3 mb-8">
                {[
                  { num: '1', text: 'Open the email from VIITSA' },
                  { num: '2', text: 'Click "Reset Password"' },
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

              <div className="space-y-3">
                <button
                  onClick={() => { setState('form'); setEmail(''); }}
                  className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all"
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

              <p className="mt-5 text-xs text-slate-400">
                Didn't receive the email? Check your spam folder, or wait a few minutes.
              </p>
            </div>
          ) : (
            /* ── FORM STATE ── */
            <div className="p-8">
              {/* Portal badge */}
              <div className="flex justify-center mb-5">
                <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200/80 rounded-full px-3 py-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                  <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">
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
