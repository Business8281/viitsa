import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { ViitsaLogo } from '../components/ViitsaLogo';

type PageState = 'loading' | 'invalid' | 'form' | 'success';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');

  const [state, setState] = useState<PageState>('loading');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setState('invalid');
      return;
    }
    // Verify the code before showing the form
    verifyPasswordResetCode(auth, oobCode)
      .then((userEmail) => {
        setEmail(userEmail);
        setState('form');
      })
      .catch((err) => {
        console.error('Invalid reset code:', err);
        setState('invalid');
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (!oobCode) return;

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      
      // Determine user role based on email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const snap = await getDocs(q);
      
      let targetRoute = '/login'; // default
      if (!snap.empty) {
        const userDoc = snap.docs[0].data();
        const role = userDoc.role;
        if (['company_admin', 'company_manager', 'company_staff'].includes(role)) {
          targetRoute = '/admin/login';
        } else if (['clinic_admin', 'clinic_doctor', 'clinic_staff'].includes(role)) {
          targetRoute = '/clinic/login';
        }
      }

      setState('success');
      
      // Automatically redirect after a short delay
      setTimeout(() => {
        navigate(targetRoute, { replace: true });
      }, 3000);
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password. Please try again.');
      setLoading(false);
    }
  };

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
          
          {state === 'loading' && (
            <div className="p-12 text-center flex flex-col items-center">
              <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-4" />
              <p className="text-sm text-slate-500 font-medium">Verifying reset link...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Invalid or Expired Link</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-8">
                Your password reset link is invalid or has expired. Please request a new one.
              </p>
              <button
                onClick={() => navigate('/forgot-password')}
                className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl transition"
              >
                Request New Link
              </button>
            </div>
          )}

          {state === 'success' && (
            <div className="p-8 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Password Reset!</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                Your password has been changed successfully. You are being redirected to the login page...
              </p>
              <div className="flex justify-center">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            </div>
          )}

          {state === 'form' && (
            <div className="p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">
                  Create New Password
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  For {email}
                </p>
              </div>

              {errorMsg && (
                <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl mb-5 text-rose-800 animate-in fade-in duration-150">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-medium leading-relaxed">{errorMsg}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 6 characters"
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Save Password <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
