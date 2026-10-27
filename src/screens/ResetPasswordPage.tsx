import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, CheckCircle2, AlertCircle, Loader2, ArrowRight, Eye, EyeOff, ShieldCheck, Building2, User, ArrowLeft } from 'lucide-react';
import { verifyPasswordResetCode, confirmPasswordReset, signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { getPasswordValidationError, assertPasswordUniqueness, claimPasswordHash } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';

type PageState = 'loading' | 'invalid' | 'form' | 'success';
type PortalType = 'clinic' | 'admin' | 'patient';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');

  const [state, setState] = useState<PageState>('loading');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [detectedPortal, setDetectedPortal] = useState<PortalType>(() => {
    const ret = searchParams.get('return') || searchParams.get('continueUrl') || '';
    if (ret.includes('/admin')) return 'admin';
    if (ret.includes('/clinic')) return 'clinic';
    if (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'clinic') return 'clinic';
    if (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'admin') return 'admin';
    return 'patient';
  });
  const [resolvedTarget, setResolvedTarget] = useState<string>(() => {
    const ret = searchParams.get('return');
    if (ret && ret.startsWith('/')) return ret;
    if (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'clinic') return '/clinic/login';
    if (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'admin') return '/admin/login';
    return '/login';
  });
  const resolvedTargetRef = useRef(resolvedTarget);
  resolvedTargetRef.current = resolvedTarget;
  const verifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!oobCode) {
      if (searchParams.get('completed') === 'true') {
        setState('success');
        const timer = setTimeout(() => {
          navigate(resolvedTargetRef.current, { replace: true });
        }, 3000);
        return () => clearTimeout(timer);
      } else {
        setState('invalid');
      }
      return;
    }

    if (verifiedRef.current === oobCode) return;
    verifiedRef.current = oobCode;

    // If callback is for email verification, forward to the dedicated portal verification handler
    if (mode === 'verifyEmail') {
      const isClinic = searchParams.get('return')?.includes('/clinic') || 
        searchParams.get('continueUrl')?.includes('/clinic') ||
        sessionStorage.getItem('viitsa_portal_intent') === 'clinic';
      const targetPortal = isClinic ? '/clinic/login' : '/login';
      const params = new URLSearchParams(searchParams);
      navigate(`${targetPortal}?${params.toString()}`, { replace: true });
      return;
    }

    // Verify the password reset code before showing the form
    verifyPasswordResetCode(auth, oobCode)
      .then(async (userEmail) => {
        setEmail(userEmail);
        setState('form');

        // Pre-fetch user role to detect portal badge and target route early
        try {
          const cleanEmail = userEmail.toLowerCase().trim();
          let snap = await getDocs(query(collection(db, 'users'), where('email', '==', cleanEmail)));
          if (snap.empty && cleanEmail !== userEmail.trim()) {
            snap = await getDocs(query(collection(db, 'users'), where('email', '==', userEmail.trim())));
          }
          if (!snap.empty) {
            const role = snap.docs[0].data()?.role;
            if (['company_admin', 'company_manager', 'company_staff', 'admin'].includes(role)) {
              setDetectedPortal('admin');
              setResolvedTarget('/admin/login');
            } else if (['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(role)) {
              setDetectedPortal('clinic');
              setResolvedTarget('/clinic/login');
            } else {
              setDetectedPortal('patient');
              setResolvedTarget('/login');
            }
          }
        } catch (e) {
          console.warn('Early role detection warning:', e);
        }
      })
      .catch((err) => {
        console.error('Invalid reset code:', err);
        setState('invalid');
      });
  }, [oobCode, mode, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const pwdErr = getPasswordValidationError(newPassword, confirmPassword);
    if (pwdErr) {
      setErrorMsg(pwdErr);
      return;
    }

    if (!oobCode) return;

    setLoading(true);
    try {
      const uniqCheck = await assertPasswordUniqueness(newPassword);
      if (!uniqCheck.ok) {
        setErrorMsg(uniqCheck.error || 'This password is already in use by another account. Please choose a different password.');
        setLoading(false);
        return;
      }

      await confirmPasswordReset(auth, oobCode, newPassword);

      // Authenticate session with the new credentials so that Firestore security rules permit updating auth_providers
      let authenticatedUid: string | null = null;
      try {
        const cred = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), newPassword);
        authenticatedUid = cred.user.uid;
        setIsAuthenticated(true);
      } catch (authErr) {
        console.warn('Post-reset sign-in note:', authErr);
      }
      
      // Determine user role across users and patient_accounts
      const usersRef = collection(db, 'users');
      const cleanEmail = email.toLowerCase().trim();
      let snap = await getDocs(query(usersRef, where('email', '==', cleanEmail)));
      if (snap.empty && cleanEmail !== email.trim()) {
        snap = await getDocs(query(usersRef, where('email', '==', email.trim())));
      }
      
      let userDoc: any = null;
      let docId: string | null = null;
      let role: string | null = null;

      if (!snap.empty) {
        userDoc = snap.docs[0].data();
        docId = snap.docs[0].id;
        role = userDoc.role;
      } else if (authenticatedUid) {
        try {
          const directSnap = await getDoc(doc(db, 'users', authenticatedUid));
          if (directSnap.exists()) {
            userDoc = directSnap.data();
            docId = directSnap.id;
            role = userDoc.role;
          } else {
            const linkedSnap = await getDocs(query(usersRef, where('linked_uids', 'array-contains', authenticatedUid)));
            if (!linkedSnap.empty) {
              userDoc = linkedSnap.docs[0].data();
              docId = linkedSnap.docs[0].id;
              role = userDoc.role;
            }
          }
        } catch (e) {
          console.warn('Direct user doc lookup error:', e);
        }
      }

      // Check patient accounts if role still unresolved
      if (!role) {
        try {
          const patSnap = await getDocs(query(collection(db, 'patient_accounts'), where('email', '==', cleanEmail)));
          if (!patSnap.empty) {
            role = 'patient';
          } else if (authenticatedUid) {
            const directPat = await getDoc(doc(db, 'patient_accounts', `pat_${authenticatedUid}`));
            if (directPat.exists()) {
              role = 'patient';
            }
          }
        } catch (e) {
          console.warn('Patient account lookup note:', e);
        }
      }

      // Claim password hash in registry
      const targetDocId = docId || authenticatedUid;
      if (targetDocId) {
        claimPasswordHash(uniqCheck.hash, targetDocId, email).catch(() => {});

        // Sync auth_providers in Firestore to record that user now has a password
        const currentProviders = Array.isArray(userDoc?.auth_providers) ? userDoc.auth_providers : [];
        if (!currentProviders.includes('password')) {
          updateDoc(doc(db, 'users', targetDocId), {
            auth_providers: arrayUnion('password'),
            updated_at: new Date().toISOString()
          }).catch(console.warn);
        }
      } else {
        claimPasswordHash(uniqCheck.hash, email, email).catch(() => {});
      }

      // Determine proper destination portal based on detected role
      const returnParam = searchParams.get('return');
      let targetRoute = resolvedTargetRef.current || '/login';
      if (role && ['company_admin', 'company_manager', 'company_staff', 'admin'].includes(role)) {
        targetRoute = '/admin/login';
      } else if (role && ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(role)) {
        targetRoute = '/clinic/login';
      } else if (role && ['patient', 'patient_attendant'].includes(role)) {
        targetRoute = '/login';
      } else if (returnParam && returnParam.startsWith('/')) {
        targetRoute = returnParam;
      }

      if (authenticatedUid) {
        await refreshSession().catch(() => {});
      }

      setState('success');
      setResolvedTarget(targetRoute);
      
      // Automatically redirect after a short delay
      setTimeout(() => {
        navigate(targetRoute, { replace: true });
      }, 3000);
      
    } catch (err: any) {
      console.error('Password reset submit error:', err);
      const code = err.code || '';
      if (code === 'auth/expired-action-code') {
        setErrorMsg('This password reset link has expired. Please request a new link.');
        setState('invalid');
      } else if (code === 'auth/invalid-action-code') {
        setErrorMsg('This password reset link is invalid or has already been used. Please request a new link.');
        setState('invalid');
      } else if (code === 'auth/user-disabled') {
        setErrorMsg('This account has been disabled. Please contact support@viitsa.com for assistance.');
      } else if (code === 'auth/weak-password') {
        setErrorMsg('Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.');
      } else {
        setErrorMsg(err.message || 'Failed to reset password. Please try again.');
      }
      setLoading(false);
    }
  };

  const portalLabel = 
    detectedPortal === 'admin' ? 'Admin Portal' :
    detectedPortal === 'clinic' ? 'Clinic Portal' :
    'Patient Portal';

  const portalBadgeColor = 
    detectedPortal === 'admin' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' :
    detectedPortal === 'clinic' ? 'bg-teal-50 border-teal-200 text-teal-700' :
    'bg-teal-50 border-teal-200 text-teal-700';

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
              <p className="text-sm text-slate-500 font-medium">Verifying reset link securely...</p>
            </div>
          )}

          {state === 'invalid' && (
            <div className="p-8 text-center animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-100 shadow-sm">
                <AlertCircle className="w-8 h-8 text-rose-500" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Invalid or Expired Link</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {errorMsg || 'Your password reset link is invalid or has expired. Password reset links expire within 1 hour for your security.'}
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    navigate(resolvedTarget ? `/forgot-password?return=${encodeURIComponent(resolvedTarget)}` : '/forgot-password');
                  }}
                  className="w-full h-12 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  Request New Link
                </button>
                <Link
                  to={resolvedTarget}
                  className="w-full h-11 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}

          {state === 'success' && (
            <div className="p-8 text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100 shadow-sm">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">Password Reset Successfully!</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                {isAuthenticated
                  ? 'Your password has been changed and your account is securely authenticated.'
                  : 'Your password has been changed successfully. You can now sign in with your new password.'
                }
              </p>
              <button
                onClick={() => navigate(resolvedTarget, { replace: true })}
                className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 mb-3"
              >
                {isAuthenticated ? 'Proceed to Dashboard' : 'Proceed to Sign In'} <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex justify-center items-center gap-2 text-xs text-slate-400">
                <Loader2 className="w-3.5 h-3.5 text-teal-600 animate-spin" />
                <span>Redirecting automatically...</span>
              </div>
            </div>
          )}

          {state === 'form' && (
            <div className="p-6 sm:p-8">
              {/* Portal badge */}
              <div className="flex justify-center mb-4">
                <div className={`inline-flex items-center gap-1.5 border rounded-full px-3 py-1 ${portalBadgeColor}`}>
                  {detectedPortal === 'admin' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  ) : detectedPortal === 'clinic' ? (
                    <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  ) : (
                    <User className="w-3.5 h-3.5 text-teal-600" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wide">
                    {portalLabel}
                  </span>
                </div>
              </div>

              <div className="text-center mb-6">
                <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">
                  Create New Password
                </h2>
                <p className="text-sm text-slate-500 font-medium break-all">
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
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min. 8 chars with upper, lower, number & symbol"
                      className="w-full h-12 pl-11 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Repeat new password"
                      className={`w-full h-12 pl-11 pr-11 bg-slate-50 border rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition-all font-medium ${
                        confirmPassword.length > 0
                          ? newPassword === confirmPassword
                            ? 'border-emerald-500 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20'
                            : 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                          : 'border-slate-200 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-700"
                      title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5 text-xs font-semibold animate-in fade-in">
                      {newPassword === confirmPassword ? (
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

                <PasswordRequirementsGuide password={newPassword} confirmPassword={confirmPassword} showAlways={true} />

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full h-12 mt-2 ${
                    detectedPortal === 'admin'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-teal-700 hover:bg-teal-800'
                  } text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-70 shadow-md`}
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

              <div className="mt-5 pt-4 border-t border-slate-100 text-center">
                <Link
                  to={resolvedTarget}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
