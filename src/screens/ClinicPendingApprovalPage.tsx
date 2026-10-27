import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { Clock, AlertCircle, CheckCircle2, RotateCw, LogOut } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export function ClinicPendingApprovalPage() {
  const navigate = useNavigate();
  const { user, clinic, logout, refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  const status = user?.clinic_verification_status || clinic?.verification_status || 'pending';
  const isRejected = status === 'rejected';
  const rejectionReason = clinic?.rejection_reason || 'No specific reason provided.';

  // Real-time listener for instant approval detection
  useEffect(() => {
    const clinicId = user?.clinic_id || clinic?.clinic_id;
    if (!clinicId) return;

    const unsub = onSnapshot(doc(db, 'clinics', clinicId), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.verification_status === 'approved') {
          await refreshSession();
          if (data.subscription_status !== 'active' && data.subscription_status !== 'free_plan' && data.subscription_status !== 'trial') {
            navigate('/clinic/subscription-setup', { replace: true });
          } else {
            navigate('/clinic/dashboard', { replace: true });
          }
        }
      }
    });

    return () => unsub();
  }, [user, clinic, refreshSession, navigate]);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await refreshSession();
      if (clinic?.verification_status === 'approved' || user?.clinic_verification_status === 'approved') {
        if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') {
          navigate('/clinic/subscription-setup', { replace: true });
        } else {
          navigate('/clinic/dashboard', { replace: true });
        }
      }
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/clinic/login');
  };

  const handleReupload = async () => {
    setLoading(true);
    try {
      const clinicId = user?.clinic_id || clinic?.clinic_id;
      if (!clinicId || !user) return;
      
      // Update clinic document
      const clinicRef = doc(db, 'clinics', clinicId);
      await updateDoc(clinicRef, {
        documents_uploaded: false,
        verification_status: 'unverified'
      });

      // Update user document
      const userRef = doc(db, 'users', user.user_id);
      await updateDoc(userRef, {
        clinic_documents_uploaded: false,
        clinic_verification_status: 'unverified'
      });

      await refreshSession();
      navigate('/clinic/upload-documents', { replace: true });
    } catch (err) {
      console.error('Error allowing re-upload:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden text-center p-8">
        <div className="flex justify-center mb-6">
          <ViitsaLogo size="md" light={false} />
        </div>

        {isRejected ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Application Rejected</h2>
            <p className="text-slate-600 mb-6">
              Unfortunately, your clinic application was not approved.
            </p>
            <div className="bg-red-50 p-4 rounded-xl text-left border border-red-100 mb-8">
              <span className="block text-sm font-semibold text-red-800 mb-1">Reason:</span>
              <p className="text-sm text-red-700">{rejectionReason}</p>
            </div>
            
            <button
              onClick={handleReupload}
              disabled={loading}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-medium transition-colors mb-4"
            >
              {loading ? 'Processing...' : 'Upload New Documents'}
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Under Process</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              We have received your verification documents. We will update you within <span className="font-semibold text-slate-800">24-48 hours</span>.
              <br className="hidden sm:block" />
              After verification is complete, your dashboard operations will be unlocked.
            </p>
            
            <div className="space-y-4 mb-8 text-left text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500" />
                <span>Account Created</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500" />
                <span>Basic Info Submitted</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-500" />
                <span>Documents Uploaded</span>
              </div>
              <div className="flex items-center gap-3 opacity-50">
                <div className="w-5 h-5 border-2 border-slate-300 rounded-full" />
                <span>Admin Approval (Pending)</span>
              </div>
            </div>
          </>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl font-medium text-sm transition-colors border border-teal-200"
          >
            <RotateCw className={`w-4 h-4 text-teal-700 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? 'Checking Status...' : 'Check Status Now'}</span>
          </button>

          <button
            onClick={handleSignOut}
            className="inline-flex items-center justify-center gap-1.5 py-2 text-sm font-semibold text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out / Switch Account</span>
          </button>
        </div>
      </div>
    </div>
  );
}
