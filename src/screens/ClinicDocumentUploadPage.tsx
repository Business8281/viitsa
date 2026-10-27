import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileUp, Trash2, CheckCircle2, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { sendEmail } from '../lib/emailService';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function ClinicDocumentUploadPage() {
  const navigate = useNavigate();
  const { user, refreshSession, logout } = useAuth();
  
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.clinic_id) return;
    if (files.length === 0) {
      setError('Please select at least one document to upload for verification.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Upload files to Storage and get URLs
      const uploadedDocs = [];
      const folderName = user.clinic_name ? user.clinic_name.replace(/[^a-zA-Z0-9 -]/g, '').trim() : user.clinic_id;
      for (const file of files) {
        const storageRef = ref(storage, `clinics onboarding files/${folderName}/${file.name}`);
        const snapshot = await uploadBytesResumable(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        uploadedDocs.push({ name: file.name, url });
      }

      // 2. Update clinic doc
      await setDoc(doc(db, 'clinics', user.clinic_id), {
        documents_uploaded: true,
        verification_status: 'pending',
        onboarding_documents: uploadedDocs
      }, { merge: true });

      // 3. Update user doc
      await updateDoc(doc(db, 'users', user.user_id), {
        clinic_documents_uploaded: true,
        clinic_verification_status: 'pending',
        updated_at: new Date().toISOString(),
      });

      // 4. Send Instant Email
      try {
        if (user.email) {
          await sendEmail({
            to: user.email,
            template: 'clinic_pending',
            data: { 
              clinicName: user.clinic_name || 'Clinic Admin',
              clinicEmail: user.email,
              phone: user.phone || 'Not provided',
              address: 'As provided during setup',
              city: 'As provided during setup'
            }
          });
        }
      } catch (err) {
        console.error('Failed to send pending verification email', err);
      }

      // 5. Refresh session
      await refreshSession();

      navigate('/clinic/pending-approval', { replace: true });
    } catch (err: any) {
      console.error('Document upload error:', err);
      setError('Failed to upload documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/clinic/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
      navigate('/clinic/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      {/* Top Header Bar with Logout */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <ViitsaLogo size="md" light={false} />
        <div className="flex items-center gap-3">
          {user?.email && (
            <span className="text-xs text-slate-500 font-medium hidden sm:inline-block">
              Signed in as <strong className="text-slate-800">{user.email}</strong>
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer"
            title="Log out and return to sign in"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      <div className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Step 3 of 3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Upload Verification Documents
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Please provide your clinic registration and doctor credentials for admin verification.
          </p>
        </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="mb-6">
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:border-teal-500 transition-colors">
                <div className="space-y-1 text-center">
                  <FileUp className="mx-auto h-12 w-12 text-slate-400" />
                  <div className="flex text-sm text-slate-600 justify-center">
                    <label
                      htmlFor="file-upload"
                      className="relative cursor-pointer rounded-md font-medium text-teal-600 hover:text-teal-500 focus-within:outline-none"
                    >
                      <span>Upload a file</span>
                      <input
                        id="file-upload"
                        name="file-upload"
                        type="file"
                        className="sr-only"
                        multiple
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={handleFileChange}
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-slate-500">PNG, JPG, PDF up to 10MB</p>
                </div>
              </div>
            </div>

            {files.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Selected Files</h4>
                <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl px-4">
                  {files.map((file, idx) => (
                    <li key={idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <CheckCircle2 className="w-5 h-5 text-teal-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {file.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Remove file"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.99] shadow-lg shadow-teal-700/25"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Submit Application</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 pt-1 pb-6 text-xs text-slate-500">
            <span>Signed in as <strong>{user?.email || 'User'}</strong> ·</span>
            <button
              type="button"
              onClick={handleLogout}
              className="font-semibold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <LogOut size={12} />
              Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
