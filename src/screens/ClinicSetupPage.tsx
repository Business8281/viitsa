import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  Stethoscope,
  CheckCircle2,
  Loader2,
  AlertCircle,
  LogOut,
  Lock,
} from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { sanitizeForFirestore, generateReadableId } from '../lib/identityResolver';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ClinicSetupPage() {
  const navigate = useNavigate();
  const { user, clinic, refreshSession, logout } = useAuth();

  // Dual-verified credentials from OTP registration or active session
  const sessionPhone = (
    user?.phone || 
    clinic?.phone || 
    (typeof window !== 'undefined' ? (sessionStorage.getItem('viitsa_reg_phone') || localStorage.getItem('viitsa_clinic_phone') || '') : '')
  ).replace(/\D/g, '').slice(-10);

  const sessionEmail = (
    user?.email || 
    clinic?.email || 
    auth.currentUser?.email ||
    (typeof window !== 'undefined' ? (sessionStorage.getItem('viitsa_reg_email') || localStorage.getItem('viitsa_clinic_email') || '') : '')
  ).trim().toLowerCase();

  const isPhoneLocked = Boolean(sessionPhone && sessionPhone.length === 10);
  const isEmailLocked = Boolean(sessionEmail && sessionEmail.includes('@'));

  const [enteredPhone, setEnteredPhone] = useState(sessionPhone || '');
  const [enteredEmail, setEnteredEmail] = useState(sessionEmail || '');

  // Keep state in sync if auth/clinic resolves after initial mount
  useEffect(() => {
    if (sessionPhone && (!enteredPhone || enteredPhone.length < 10)) {
      setEnteredPhone(sessionPhone);
    }
    if (sessionEmail && (!enteredEmail || !enteredEmail.includes('@'))) {
      setEnteredEmail(sessionEmail);
    }
  }, [sessionPhone, sessionEmail]);

  // Clinic info
  const [clinicName, setClinicName] = useState(clinic?.name || (user as any)?.clinic_name || '');
  const [address, setAddress] = useState(clinic?.address || '');
  const [city, setCity] = useState(clinic?.city || '');
  const [receptionPhone, setReceptionPhone] = useState((clinic as any)?.reception_phone || '');
  const [speciality, setSpeciality] = useState(clinic?.speciality || '');

  // Owner info
  const [ownerName, setOwnerName] = useState(user?.name || (clinic as any)?.owner_name || '');

  // Working hours
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalPhone = (isPhoneLocked ? sessionPhone : enteredPhone).replace(/\D/g, '').slice(-10);
    const finalEmail = (isEmailLocked ? sessionEmail : enteredEmail).trim().toLowerCase();

    if (!clinicName.trim()) { setError('Clinic name is required.'); return; }
    if (!address.trim()) { setError('Clinic address is required.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!finalPhone || finalPhone.length < 10) {
      setError('Please enter a valid 10-digit clinic mobile number.'); return;
    }
    if (!finalEmail || !finalEmail.includes('@')) {
      setError('Please enter a valid clinic email address.'); return;
    }
    if (workingDays.length === 0) { setError('Please select at least one working day.'); return; }

    setLoading(true);
    const nowIso = new Date().toISOString();
    const authUid = auth.currentUser?.uid;
    const uid = user?.user_id || authUid;
    const clinicId = clinic?.clinic_id || user?.clinic_id || (authUid ? `CLN_${authUid.slice(0, 8)}` : null);

    if (!clinicId) {
      setError('Session error: Clinic ID could not be identified. Please log out and sign in again.');
      setLoading(false);
      return;
    }

    const cleanReception = receptionPhone.replace(/\D/g, '');
    const clinicCode = clinic?.clinic_code || clinic?.id_number || generateReadableId('CLN', clinicId);

    const clinicData = sanitizeForFirestore({
      clinic_id: clinicId,
      clinic_code: clinicCode,
      id_number: clinicCode,
      display_id: clinicCode,
      name: clinicName.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: finalPhone,
      email: finalEmail,
      phone_verified: true,
      email_verified: true,
      reception_phone: cleanReception || null,
      owner_name: ownerName.trim() || user?.name || '',
      owner_user_id: authUid || uid,
      admin_user_id: uid || authUid,
      speciality: speciality.trim() || null,
      logo_url: clinic?.logo_url || null,
      clinic_setup_complete: true,
      working_hours: {
        open: openTime,
        close: closeTime,
        days: workingDays,
      },
      updated_at: nowIso,
    });

    try {
      // 1. Update/create clinic doc
      await setDoc(doc(db, 'clinics', clinicId), clinicData, { merge: true });

      // 2. Also initialize/sync clinic_settings with working_hours and default slot duration
      try {
        await setDoc(doc(db, 'clinic_settings', clinicId), sanitizeForFirestore({
          clinic_id: clinicId,
          setting_id: clinicId,
          slot_duration_minutes: 20,
          working_hours: {
            open: openTime,
            close: closeTime,
            days: workingDays,
          },
          updated_at: nowIso,
        }), { merge: true });
      } catch (settingsErr) {
        console.warn('Could not write to clinic_settings collection:', settingsErr);
      }

      // 3. Update user doc with setup complete + clinic metadata
      const userPayload = sanitizeForFirestore({
        clinic_setup_complete: true,
        clinic_id: clinicId,
        clinic_name: clinicName.trim(),
        name: ownerName.trim() || user?.name,
        full_name: ownerName.trim() || user?.name,
        phone: finalPhone || user?.phone || null,
        email: finalEmail || user?.email || null,
        phone_verified: true,
        email_verified: true,
        updated_at: nowIso,
      });

      if (authUid) {
        try {
          await setDoc(doc(db, 'users', authUid), userPayload, { merge: true });
        } catch (uErr) {
          console.warn('Could not update user doc by authUid:', uErr);
        }
      }
      if (user?.user_id && user.user_id !== authUid) {
        try {
          await setDoc(doc(db, 'users', user.user_id), userPayload, { merge: true });
        } catch (uErr) {
          console.warn('Could not update user doc by user.user_id:', uErr);
        }
      }

      // 4. Update localStorage active clinic key
      try {
        localStorage.setItem('viitsa_active_clinic_id', clinicId);
      } catch {}

      // 5. Refresh session so auth context picks up the new state
      await refreshSession();

      navigate('/clinic/upload-documents', { replace: true });
    } catch (err: any) {
      console.error('Clinic setup error:', err);
      setError(err?.message || 'Failed to save clinic details. Please try again.');
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
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-8">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 rounded-full px-3 py-1 mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wide">Account Created — Step 2 of 3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Set Up Your Clinic
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Fill in your clinic details. You can edit everything later from the dashboard settings.
          </p>
        </div>

      {/* Form Card */}
      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {/* ── Section 1: Clinic Information ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-teal-100 text-teal-700 rounded-lg flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Clinic Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Clinic Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Clinic / Hospital Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={clinicName}
                    onChange={e => setClinicName(e.target.value)}
                    placeholder="e.g. Apollo Family Clinic"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Speciality */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Speciality / Department <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={speciality}
                    onChange={e => setSpeciality(e.target.value)}
                    placeholder="e.g. General Practice, Paediatrics, Orthopaedics"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    placeholder="Street, Area, Landmark"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  City <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Bangalore"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Clinic Registered Mobile */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Registered Mobile <span className="text-rose-500">*</span>
                  </label>
                  {isPhoneLocked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified via WhatsApp
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">+91</span>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      required
                      inputMode="numeric"
                      maxLength={10}
                      readOnly={isPhoneLocked}
                      disabled={isPhoneLocked}
                      value={isPhoneLocked ? sessionPhone : enteredPhone}
                      onKeyDown={e => {
                        if (isPhoneLocked) return;
                        if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
                        if (e.ctrlKey || e.metaKey) return;
                        if (!/^\d$/.test(e.key)) e.preventDefault();
                      }}
                      onChange={e => {
                        if (!isPhoneLocked) setEnteredPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      }}
                      placeholder="10-digit mobile number"
                      className={`w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-mono transition-all ${
                        isPhoneLocked
                          ? 'bg-slate-100/80 text-slate-700 cursor-not-allowed select-none pr-10'
                          : 'bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                      }`}
                    />
                    {isPhoneLocked && (
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isPhoneLocked ? 'Primary phone verified during signup.' : 'Primary clinic mobile number for alerts & OTPs.'}
                </p>
              </div>

              {/* Reception / Desk Phone (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Reception / Desk Phone <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={receptionPhone}
                    onKeyDown={e => {
                      if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={e => setReceptionPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="Landline / Reception"
                    className="flex-1 h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Alternate number for patient enquiries.</p>
              </div>

              {/* Clinic Registered Official Email */}
              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Registered Official Email <span className="text-rose-500">*</span>
                  </label>
                  {isEmailLocked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified via Email OTP
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    readOnly={isEmailLocked}
                    disabled={isEmailLocked}
                    value={isEmailLocked ? sessionEmail : enteredEmail}
                    onChange={e => {
                      if (!isEmailLocked) setEnteredEmail(e.target.value.trim().toLowerCase());
                    }}
                    placeholder="clinic@example.com"
                    className={`w-full h-11 pl-10 border border-slate-300 rounded-xl text-sm transition-all ${
                      isEmailLocked
                        ? 'bg-slate-100/80 text-slate-700 cursor-not-allowed select-none pr-10'
                        : 'bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                    }`}
                  />
                  {isEmailLocked && (
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {isEmailLocked ? 'Official clinic email verified during signup.' : 'Primary official clinic email for reports & invoices.'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Section 2: Owner / Admin Info ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Admin / Owner Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Owner / Administrator Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Admin Mobile
                  </label>
                  {isPhoneLocked && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">+91</span>
                  <div className="relative flex-1">
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      readOnly={isPhoneLocked}
                      disabled={isPhoneLocked}
                      value={isPhoneLocked ? sessionPhone : enteredPhone}
                      onChange={e => {
                        if (!isPhoneLocked) setEnteredPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                      }}
                      placeholder="10-digit mobile number"
                      className={`w-full h-11 px-4 border border-slate-300 rounded-xl text-sm font-mono transition-all ${
                        isPhoneLocked
                          ? 'bg-slate-100/80 text-slate-700 cursor-not-allowed select-none pr-10'
                          : 'bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20'
                      }`}
                    />
                    {isPhoneLocked && (
                      <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Working Hours ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Working Hours & Days</h2>
            </div>

            {/* Days */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Working Days <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      workingDays.includes(day)
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-teal-400'
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            </div>

            {/* Times */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Opens at
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="time"
                    value={openTime}
                    onChange={e => setOpenTime(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Closes at
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
                  <input
                    type="time"
                    value={closeTime}
                    onChange={e => setCloseTime(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-teal-700 hover:bg-teal-800 text-white font-bold text-base rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.99] shadow-lg shadow-teal-700/25"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Saving clinic details...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Next: Upload Documents</span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400">
            All clinic details and working hours are editable from Settings. Doctors & staff are added in Dashboard Settings.
          </p>

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
