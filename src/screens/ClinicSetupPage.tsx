import { useState } from 'react';
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
  Plus,
  Trash2,
} from 'lucide-react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { sanitizeForFirestore, generateReadableId } from '../lib/identityResolver';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ClinicSetupPage() {
  const navigate = useNavigate();
  const { user, clinic, refreshSession } = useAuth();

  // Clinic info
  const [clinicName, setClinicName] = useState(clinic?.name || '');
  const [address, setAddress] = useState(clinic?.address || '');
  const [city, setCity] = useState(clinic?.city || '');
  const [clinicPhone, setClinicPhone] = useState(clinic?.phone || '');
  const [clinicEmail, setClinicEmail] = useState(clinic?.email || user?.email || '');
  const [speciality, setSpeciality] = useState('');

  // Owner info
  const [ownerName, setOwnerName] = useState(user?.name || '');
  const [ownerPhone, setOwnerPhone] = useState(user?.phone || '');

  // Working hours
  const [openTime, setOpenTime] = useState('09:00');
  const [closeTime, setCloseTime] = useState('19:00');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

  // Doctors list
  const [doctors, setDoctors] = useState([{ name: '', specialisation: '' }]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleDay = (day: string) => {
    setWorkingDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const addDoctor = () => {
    setDoctors(prev => [...prev, { name: '', specialisation: '' }]);
  };

  const removeDoctor = (i: number) => {
    setDoctors(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateDoctor = (i: number, field: 'name' | 'specialisation', val: string) => {
    setDoctors(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!clinicName.trim()) { setError('Clinic name is required.'); return; }
    if (!address.trim()) { setError('Clinic address is required.'); return; }
    if (!city.trim()) { setError('City is required.'); return; }
    if (!clinicPhone.replace(/\D/g, '') || clinicPhone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit clinic phone number.'); return;
    }
    if (doctors.length === 0 || !doctors[0].name.trim()) {
      setError('At least one doctor name is required.'); return;
    }
    if (workingDays.length === 0) { setError('Please select at least one working day.'); return; }

    setLoading(true);
    const nowIso = new Date().toISOString();
    const uid = user?.user_id;
    const clinicId = user?.clinic_id || clinic?.clinic_id;

    if (!uid || !clinicId) {
      setError('Session error. Please log out and sign in again.');
      setLoading(false);
      return;
    }

    const cleanPhone = clinicPhone.replace(/\D/g, '');
    const clinicCode = clinic?.clinic_code || clinic?.id_number || generateReadableId('CLN', clinicId);

    const clinicData = sanitizeForFirestore({
      clinic_id: clinicId,
      clinic_code: clinicCode,
      id_number: clinicCode,
      display_id: clinicCode,
      name: clinicName.trim(),
      address: address.trim(),
      city: city.trim(),
      phone: cleanPhone,
      email: clinicEmail.trim().toLowerCase(),
      owner_name: ownerName.trim() || user?.name || '',
      owner_user_id: uid,
      speciality: speciality.trim() || null,
      logo_url: null,
      clinic_setup_complete: true,
      working_hours: {
        open: openTime,
        close: closeTime,
        days: workingDays,
      },
      updated_at: nowIso,
    });

    try {
      // 1. Update clinic doc
      await setDoc(doc(db, 'clinics', clinicId), clinicData, { merge: true });

      // 2. Save doctors under clinic sub-collection
      for (const dr of doctors) {
        if (!dr.name.trim()) continue;
        const drCode = generateReadableId('DOC', `${clinicId}_${dr.name}`);
        const drData = sanitizeForFirestore({
          clinic_id: clinicId,
          name: dr.name.trim(),
          full_name: dr.name.trim(),
          specialisation: dr.specialisation.trim() || speciality.trim() || null,
          id_number: drCode,
          display_id: drCode,
          role: 'clinic_doctor',
          user_type: 'doctor',
          active: true,
          avatar_color: '#0F6E56',
          created_at: nowIso,
          updated_at: nowIso,
        });
        await setDoc(doc(db, 'clinics', clinicId, 'doctors', drCode), drData, { merge: true });
      }

      // 3. Update user doc with setup complete + clinic metadata
      await updateDoc(doc(db, 'users', uid), sanitizeForFirestore({
        clinic_setup_complete: true,
        clinic_id: clinicId,
        clinic_name: clinicName.trim(),
        name: ownerName.trim() || user?.name,
        full_name: ownerName.trim() || user?.name,
        phone: ownerPhone.replace(/\D/g, '') || user?.phone || null,
        updated_at: nowIso,
      }));

      // 4. Refresh session so auth context picks up the new state
      await refreshSession();

      navigate('/clinic/upload-documents', { replace: true });
    } catch (err: any) {
      console.error('Clinic setup error:', err);
      setError('Failed to save clinic details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5FAFA] py-8 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="max-w-2xl mx-auto text-center mb-8">
        <div className="flex justify-center mb-4">
          <ViitsaLogo size="md" light={false} />
        </div>
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

              {/* Clinic Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Clinic Phone <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">+91</span>
                  <input
                    type="tel"
                    required
                    inputMode="numeric"
                    maxLength={10}
                    value={clinicPhone}
                    onKeyDown={e => {
                      if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={e => setClinicPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Clinic Email */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Clinic Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={clinicEmail}
                    onChange={e => setClinicEmail(e.target.value)}
                    placeholder="clinic@example.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
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
                  Your Name <span className="text-rose-500">*</span>
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Your Mobile <span className="text-slate-400 font-normal normal-case">(optional)</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 flex items-center">+91</span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={ownerPhone}
                    onKeyDown={e => {
                      if (['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={e => setOwnerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Doctors ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 text-purple-700 rounded-lg flex items-center justify-center">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Doctor(s)</h2>
              </div>
              <button
                type="button"
                onClick={addDoctor}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-900 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Doctor
              </button>
            </div>

            <div className="space-y-3">
              {doctors.map((dr, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Doctor Name {i === 0 && <span className="text-rose-500">*</span>}
                      </label>
                      <input
                        type="text"
                        required={i === 0}
                        value={dr.name}
                        onChange={e => updateDoctor(i, 'name', e.target.value)}
                        placeholder="Dr. Full Name"
                        className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                        Specialisation
                      </label>
                      <input
                        type="text"
                        value={dr.specialisation}
                        onChange={e => updateDoctor(i, 'specialisation', e.target.value)}
                        placeholder="e.g. General Physician"
                        className="w-full h-11 px-4 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-all"
                      />
                    </div>
                  </div>
                  {doctors.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDoctor(i)}
                      className="mt-6 p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Section 4: Working Hours ── */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 bg-amber-100 text-amber-700 rounded-lg flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="text-base font-bold text-slate-900">Working Hours</h2>
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
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
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
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
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

          <p className="text-center text-xs text-slate-400 pb-4">
            All information can be updated later from Settings.
          </p>
        </form>
      </div>
    </div>
  );
}
