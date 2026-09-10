import React, { useState } from 'react';
import { 
  User, Mail, Phone, Calendar, Droplets, MapPin, 
  Heart, AlertTriangle, Check, ArrowRight, Loader2, Sparkles, ShieldCheck 
} from 'lucide-react';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { isValidGmail, isValid10DigitPhone } from '../screens/AuthLoginPage';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = ['Male', 'Female', 'Other'] as const;
const COMMON_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Thyroid', 'Kidney Disease'];

interface Props {
  onComplete: () => void;
}

export function PatientOnboardingProfile({ onComplete }: Props) {
  const { account, updateProfile, clinic } = usePatientAuth();
  const { user } = useAuth();

  const getCleanPhone = (val?: string | null) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (!digits || /^0+$/.test(digits)) return '';
    return digits;
  };

  // Auto-fill from login details
  const [name, setName] = useState(account?.name || user?.name || '');
  const [email, setEmail] = useState(account?.email || user?.email || '');
  const [phone, setPhone] = useState(getCleanPhone(account?.phone || user?.phone));
  
  // Mandatory profile details to be completed
  const [dob, setDob] = useState(account?.dob || '');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>(account?.gender || '');
  const [bloodGroup, setBloodGroup] = useState<string>(account?.blood_group || '');
  const [address, setAddress] = useState(account?.address || '');
  const [emergencyName, setEmergencyName] = useState(account?.emergency_contact_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState(getCleanPhone(account?.emergency_contact_phone));
  
  // Health details
  const [selectedConditions, setSelectedConditions] = useState<string[]>(
    account?.chronic_conditions && account.chronic_conditions !== 'None'
      ? account.chronic_conditions.split(',').map(s => s.trim())
      : []
  );
  const [hasNoConditions, setHasNoConditions] = useState(account?.chronic_conditions === 'None' || !account?.chronic_conditions);
  const [allergies, setAllergies] = useState(account?.allergies || 'None');
  const [medications, setMedications] = useState(
    account?.current_medications && account.current_medications.length > 0
      ? account.current_medications.join(', ')
      : 'None'
  );

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Sync login details if they arrive after mount
  React.useEffect(() => {
    if (!name && (account?.name || user?.name)) {
      setName(account?.name || user?.name || '');
    }
    if (!email && (account?.email || user?.email)) {
      setEmail(account?.email || user?.email || '');
    }
    const cleanP = getCleanPhone(account?.phone || user?.phone);
    if (!phone && cleanP) {
      setPhone(cleanP);
    }
  }, [account, user, name, email, phone]);

  // Compute age from DOB
  const computedAge = dob 
    ? Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
    : null;

  const toggleCondition = (cond: string) => {
    setHasNoConditions(false);
    setSelectedConditions(prev => 
      prev.includes(cond) ? prev.filter(c => c !== cond) : [...prev, cond]
    );
  };

  const handleNoneConditions = () => {
    setHasNoConditions(true);
    setSelectedConditions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Mandatory Name
    if (!name.trim()) {
      setError('Please enter your Full Name.');
      return;
    }

    // 2. Mandatory Gmail
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Email address is required.');
      return;
    }
    if (!isValidGmail(cleanEmail)) {
      setError('Email address must be a valid Gmail account ending in @gmail.com.');
      return;
    }

    // 3. Mandatory 10-digit Phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValid10DigitPhone(cleanPhone)) {
      setError('Mobile number must be exactly 10 digits (numbers only).');
      return;
    }

    // 4. Mandatory DOB
    if (!dob) {
      setError('Please select your Date of Birth.');
      return;
    }
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
      setError('Please select a valid Date of Birth in the past.');
      return;
    }

    // 5. Mandatory Gender
    if (!gender) {
      setError('Please select your Gender.');
      return;
    }

    // 6. Mandatory Blood Group
    if (!bloodGroup) {
      setError('Please select your Blood Group.');
      return;
    }

    // 7. Mandatory Residential Address
    if (!address.trim() || address.trim().length < 5) {
      setError('Please enter your complete Residential Address.');
      return;
    }

    // 8. Mandatory Emergency Contact Name
    if (!emergencyName.trim()) {
      setError('Please enter an Emergency Contact Person name.');
      return;
    }

    // 9. Mandatory Emergency Contact Phone (10 digits)
    const cleanEmergPhone = emergencyPhone.replace(/\D/g, '');
    if (!isValid10DigitPhone(cleanEmergPhone)) {
      setError('Emergency contact number must be exactly 10 digits (numbers only).');
      return;
    }

    setSubmitting(true);

    const conditionsString = hasNoConditions || selectedConditions.length === 0
      ? 'None'
      : selectedConditions.join(', ');

    const res = await updateProfile({
      name: name.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      dob,
      gender,
      blood_group: bloodGroup,
      address: address.trim(),
      emergency_contact_name: emergencyName.trim(),
      emergency_contact_phone: cleanEmergPhone,
      chronic_conditions: conditionsString,
      allergies: allergies.trim() || 'None',
      current_medications: medications.trim() || 'None',
      profile_completed: true,
    });

    setSubmitting(false);

    if (res.ok) {
      // Save completed flag in localStorage
      try {
        const id = account?.account_id || user?.user_id || 'active';
        localStorage.setItem(`viitsa_patient_profile_${id}`, JSON.stringify({
          name: name.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          dob,
          gender,
          blood_group: bloodGroup,
          address: address.trim(),
          emergency_contact_name: emergencyName.trim(),
          emergency_contact_phone: cleanEmergPhone,
          chronic_conditions: conditionsString,
          allergies: allergies.trim() || 'None',
          current_medications: medications.trim() || 'None',
          profile_completed: true,
        }));
      } catch {}

      onComplete();
    } else {
      setError(res.error || 'Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <ViitsaLogo size="md" light={false} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-100 text-teal-800 text-xs font-bold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>Mandatory First-Time Setup</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Complete Your Patient Profile
          </h1>
          <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">
            Welcome to {clinic?.name || 'Viitsa Healthcare'}! Please complete your medical and emergency details to access your patient dashboard and book consultations.
          </p>
        </div>

        {/* Auto-fill banner */}
        <div className="mb-6 p-4 rounded-2xl bg-teal-50/80 border border-teal-200 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
          <div className="text-xs text-teal-900 leading-relaxed">
            <span className="font-bold">Auto-filled from your login:</span> Your name, email, and mobile number have been automatically imported. Please review them and fill the remaining mandatory information below.
          </div>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-sm font-semibold animate-in fade-in">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SECTION 1: Personal Details */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-5 h-5 text-teal-600" />
              <span>1. Personal & Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ananya Sharma"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Gmail Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Gmail Address <span className="text-slate-400 font-normal normal-case">(@gmail.com only)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    pattern="^[a-zA-Z0-9._%+-]+@gmail\.com$"
                    placeholder="name@gmail.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Mobile Number <span className="text-slate-400 font-normal normal-case">(10 digits)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                    value={phone}
                    onKeyDown={(e) => {
                      if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Date of Birth <span className="text-rose-500">*</span>
                  {computedAge !== null && (
                    <span className="ml-2 text-teal-700 font-bold normal-case">({computedAge} years old)</span>
                  )}
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="date"
                    required
                    max={new Date().toISOString().split('T')[0]}
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`h-11 rounded-xl text-xs font-bold border transition-all ${
                        gender === g
                          ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Blood Group */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-rose-500" />
                <span>Blood Group <span className="text-rose-500">*</span></span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setBloodGroup(bg)}
                    className={`h-10 rounded-xl text-xs font-bold border transition-all ${
                      bloodGroup === bg
                        ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Residential Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                <span>Residential Address <span className="text-rose-500">*</span></span>
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Flat No., Street, Area, City, Pin Code"
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 resize-none"
              />
            </div>
          </div>

          {/* SECTION 2: Emergency Contact */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="w-5 h-5 text-rose-600" />
              <span>2. Emergency Contact Details</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Emergency Contact Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma (Father / Spouse)"
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                  Emergency Contact Phone <span className="text-slate-400 font-normal normal-case">(10 digits)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                    value={emergencyPhone}
                    onKeyDown={(e) => {
                      if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => setEmergencyPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="9876543210"
                    className="flex-1 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 font-mono focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Medical Background */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Heart className="w-5 h-5 text-teal-600" />
              <span>3. Medical History & Allergies</span>
            </h2>

            {/* Chronic Conditions */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                Chronic Health Conditions <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleNoneConditions}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    hasNoConditions
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  None
                </button>
                {COMMON_CONDITIONS.map((cond) => {
                  const isSelected = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        isSelected
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Known Allergies */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Known Drug / Food Allergies <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Peanuts, Sulfa (or type 'None')"
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                Current Medications
              </label>
              <input
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Metformin 500mg, Thyronorm (or 'None')"
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 flex items-center justify-center gap-2 px-6 rounded-xl text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Save Profile & Open Dashboard</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
