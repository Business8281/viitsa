import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { Clock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useState } from 'react';

export function ClinicPendingApprovalPage() {
  const navigate = useNavigate();
  const { user, clinic, logout, refreshSession } = useAuth();
  const [loading, setLoading] = useState(false);

  const status = user?.clinic_verification_status || clinic?.verification_status || 'pending';
  const isRejected = status === 'rejected';
  const rejectionReason = clinic?.rejection_reason || 'No specific reason provided.';

  const handleSignOut = async () => {
    await logout();
    // logout() already redirects appropriately based on role, but we can leave navigate just in case
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

        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
