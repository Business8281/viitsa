import React, { useState } from 'react';
import { 
  User, Mail, Phone, Calendar, Droplets, MapPin, 
  Heart, AlertTriangle, Check, CheckCircle2, BadgeCheck, Lock, ArrowRight, Loader2, Users, ShieldCheck, LogOut 
} from 'lucide-react';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { DobCalendarPicker } from '../components/DobCalendarPicker';
import { isValidGmail, isValid10DigitPhone } from '../screens/AuthLoginPage';
import { calculateAge, formatDobForInput, parseDateArg, localDateISO } from '../lib/format';
import { claimPastAppointmentsForPhone } from '../lib/accountLinking';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = ['Male', 'Female', 'Other'] as const;
const COMMON_CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Heart Disease', 'Thyroid', 'Kidney Disease'];

interface Props {
  onComplete: () => void;
}

export function PatientOnboardingProfile({ onComplete }: Props) {
  const { account, updateProfile, clinic, logout, refreshAccount } = usePatientAuth();
  const { user, refreshSession } = useAuth();

  const isGenericUser = (n?: string | null) => {
    if (!n) return true;
    const clean = n.trim().toLowerCase();
    return clean === 'user' || clean.startsWith('user ') || clean === 'patient';
  };

  const getCleanInitialName = (val?: string | null) => {
    if (!val || isGenericUser(val)) return '';
    return val.trim();
  };

  const getCleanPhone = (val?: string | null) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '');
    if (!digits || /^0+$/.test(digits)) return '';
    return digits;
  };

  // Auto-fill from login details
  const [name, setName] = useState(getCleanInitialName(account?.name || user?.name));
  const [email, setEmail] = useState(account?.email || user?.email || '');
  const [phone, setPhone] = useState(getCleanPhone(account?.phone || user?.phone));
  
  // Mandatory profile details to be completed
  const [dob, setDob] = useState(account?.dob || '');
  const [age, setAge] = useState<string>(
    account?.age ? String(account.age) : (account?.dob ? String(calculateAge(account.dob) ?? '') : '')
  );
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>(account?.gender || '');

  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    const computed = calculateAge(newDob);
    if (computed !== null && !isNaN(computed)) {
      setAge(String(computed));
    } else {
      setAge('');
    }
  };
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

  // Sync login details once on mount without overwriting user edits
  const hasInitializedName = React.useRef(false);
  const hasInitializedEmail = React.useRef(false);
  const hasInitializedPhone = React.useRef(false);

  React.useEffect(() => {
    if (!hasInitializedName.current) {
      const cleanN = getCleanInitialName(account?.name || user?.name);
      if (cleanN) {
        setName(cleanN);
        hasInitializedName.current = true;
      }
    }
    if (!hasInitializedEmail.current) {
      const cleanE = account?.email || user?.email;
      if (cleanE) {
        setEmail(cleanE);
        hasInitializedEmail.current = true;
      }
    }
    if (!hasInitializedPhone.current) {
      const cleanP = getCleanPhone(account?.phone || user?.phone);
      if (cleanP) {
        setPhone(cleanP);
        hasInitializedPhone.current = true;
      }
    }
  }, [account, user]);

  // Determine initial sign-in method to highlight verified vs missing fields
  const isGoogleAuth = Boolean(
    user?.auth_providers?.includes('google.com') ||
    (user?.email && !user?.phone)
  );
  const isWhatsAppAuth = Boolean(
    user?.phone && !user?.auth_providers?.includes('google.com')
  );

  // Compute age from DOB
  const computedAge = calculateAge(dob);

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
    const cleanName = name.trim();
    if (!cleanName || isGenericUser(cleanName)) {
      setError('Please enter your Full Name.');
      return;
    }

    // 2. Google Email (Optional)
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail && !isValidGmail(cleanEmail)) {
      setError('Please enter a valid email address, or leave it blank.');
      return;
    }

    // 3. Mandatory 10-digit Phone
    const cleanPhone = phone.replace(/\D/g, '');
    if (!isValid10DigitPhone(cleanPhone)) {
      setError('Mobile number must be exactly 10 digits (numbers only).');
      return;
    }

    // 4. Mandatory DOB (Age is automatically computed from DOB)
    if (!dob) {
      setError('Please select your Date of Birth.');
      return;
    }
    const dobDate = parseDateArg(dob);
    if (isNaN(dobDate.getTime()) || dobDate > new Date()) {
      setError('Please select a valid Date of Birth in the past.');
      return;
    }

    const calculated = calculateAge(dob);
    const finalAge = calculated !== null ? calculated : (age ? parseInt(age, 10) : null);
    if (finalAge === null || isNaN(finalAge) || finalAge < 0 || finalAge > 125) {
      setError('Please select a valid Date of Birth.');
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
      name: cleanName,
      email: cleanEmail || undefined,
      phone: cleanPhone,
      dob,
      age: finalAge,
      gender,
      blood_group: bloodGroup,
      address: address.trim(),
      emergency_contact_name: emergencyName.trim(),
      emergency_contact_phone: cleanEmergPhone,
      attender_name: emergencyName.trim(),
      attender_phone: cleanEmergPhone,
      chronic_conditions: conditionsString,
      allergies: allergies.trim() || 'None',
      current_medications: medications.trim() || 'None',
      profile_completed: true,
    });

    setSubmitting(false);

    if (res.ok) {
      // Retroactively link any past appointments booked with this mobile number
      if (cleanPhone) {
        claimPastAppointmentsForPhone(cleanPhone, account?.account_id || user?.user_id || 'active').catch(() => {});
      }

      // Save completed flag in localStorage
      const profileObj = {
        name: cleanName,
        email: cleanEmail || '',
        phone: cleanPhone,
        dob,
        age: finalAge,
        gender,
        blood_group: bloodGroup,
        address: address.trim(),
        emergency_contact_name: emergencyName.trim(),
        emergency_contact_phone: cleanEmergPhone,
        attender_name: emergencyName.trim(),
        attender_phone: cleanEmergPhone,
        chronic_conditions: conditionsString,
        allergies: allergies.trim() || 'None',
        current_medications: medications.trim() || 'None',
        profile_completed: true,
      };

      try {
        const id = account?.account_id || user?.user_id || 'active';
        localStorage.setItem(`viitsa_patient_profile_${id}`, JSON.stringify(profileObj));
        if (user?.user_id) {
          localStorage.setItem(`viitsa_patient_profile_${user.user_id}`, JSON.stringify(profileObj));
          localStorage.setItem(`viitsa_pat_${user.user_id}`, JSON.stringify(profileObj));
        }
      } catch {}

      try {
        if (refreshSession) await refreshSession();
        if (refreshAccount) await refreshAccount();
      } catch {}

      try {
        sessionStorage.removeItem('viitsa_is_new_registration');
      } catch {}

      onComplete();
    } else {
      setError(res.error || 'Failed to save profile. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 sm:py-10 px-3.5 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 relative">
          <div className="flex items-center justify-between mb-4">
            <ViitsaLogo size="md" light={false} />
            <button
              type="button"
              onClick={logout}
              className="text-slate-600 hover:text-black transition flex items-center gap-1.5 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 shadow-xs"
            >
              <LogOut size={15} /> Logout
            </button>
          </div>

          <div className="text-center sm:text-left">
            <p className="text-xs font-bold uppercase tracking-wider text-[#106EBE] mb-2">
              Mandatory First-Time Setup
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-black tracking-tight">
              Complete Your Patient Profile
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-xl">
              Welcome to {clinic?.name || 'Viitsa Healthcare'}! Please complete your medical and emergency details to access your patient dashboard and book consultations.
            </p>
          </div>
        </div>

        {/* Unified Identity banner */}
        <div className="mb-6 p-4 rounded-2xl bg-white border border-[#106EBE]/30 shadow-xs flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-[#106EBE]/10 text-[#106EBE] shrink-0 mt-0.5">
            <Users className="w-5 h-5 text-[#106EBE]" />
          </div>
          <div className="text-xs sm:text-sm text-slate-700 leading-relaxed">
            <span className="font-bold text-black">Unified Account Access:</span> This profile is linked to your mobile number, Google email, and attendant's contact. Both you and your attendant can sign in seamlessly using any of these credentials.
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
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-black flex items-center gap-2 border-b border-slate-100 pb-3">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#106EBE]" />
              <span>1. Personal & Contact Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Harshit Sharma"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Email
                  </label>
                  {isGoogleAuth && email ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Verified</span>
                    </span>
                  ) : null}
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@gmail.com"
                    className="w-full h-11 pl-10 pr-4 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                  />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-800">
                  {isGoogleAuth
                    ? 'Google account email used for sign-in.'
                    : 'Used for appointment confirmations, prescriptions, and digital invoices.'}
                </p>
              </div>

              {/* Mobile Phone */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  {isWhatsAppAuth && phone ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>Verified</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#106EBE] bg-[#106EBE]/10 px-2 py-0.5 rounded-md border border-[#106EBE]/25">
                      Required for Mobile OTP
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-11 px-3 border rounded-xl text-xs font-bold flex items-center shrink-0 ${
                    isWhatsAppAuth && phone
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-slate-100 border-slate-300 text-black'
                  }`}>
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    required
                    disabled={Boolean(isWhatsAppAuth && phone)}
                    readOnly={Boolean(isWhatsAppAuth && phone)}
                    value={phone}
                    onKeyDown={(e) => {
                      if (isWhatsAppAuth && phone) return;
                      if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                      if (e.ctrlKey || e.metaKey) return;
                      if (!/^\d$/.test(e.key)) e.preventDefault();
                    }}
                    onChange={(e) => {
                      if (isWhatsAppAuth && phone) return;
                      setPhone(e.target.value.replace(/\D/g, '').slice(0, 10));
                    }}
                    placeholder="9876543210"
                    className={`flex-1 min-w-0 h-11 px-3.5 border rounded-xl text-sm font-mono transition-all ${
                      isWhatsAppAuth && phone
                        ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed select-none font-semibold'
                        : 'bg-white border-slate-300 text-black font-medium focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20'
                    }`}
                  />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-800">
                  {isWhatsAppAuth && phone
                    ? 'Verified login mobile number (locked).'
                    : '10-digit mobile number for WhatsApp updates and OTP login.'}
                </p>
              </div>

              {/* Date of Birth & Age (Column 1) */}
              <div>
                <div className="flex items-end gap-2.5">
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                      Date of Birth (DOB) <span className="text-rose-500">*</span>
                    </label>
                    <DobCalendarPicker
                      value={dob}
                      onChange={handleDobChange}
                      placeholder="DD / MM / YYYY"
                    />
                  </div>

                  <div className="w-20 sm:w-24 shrink-0">
                    <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5 text-center whitespace-nowrap">
                      Age <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      readOnly
                      tabIndex={-1}
                      value={computedAge !== null ? String(computedAge) : (age ? String(age) : '')}
                      placeholder="—"
                      className="w-full h-11 text-center bg-slate-50 border border-slate-300 rounded-xl text-base font-bold text-black select-none cursor-default font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Gender (Column 2) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGender(g)}
                      className={`h-11 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                        gender === g
                          ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-sm'
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
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Droplets className="w-3.5 h-3.5 text-[#106EBE]" />
                <span>Blood Group <span className="text-rose-500">*</span></span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5 sm:gap-2">
                {BLOOD_GROUPS.map((bg) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => setBloodGroup(bg)}
                    className={`h-10 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                      bloodGroup === bg
                        ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-[#106EBE]/40'
                    }`}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </div>

            {/* Residential Address */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#106EBE]" />
                <span>Residential Address <span className="text-rose-500">*</span></span>
              </label>
              <textarea
                required
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House/Flat No., Street, Area, City, Pin Code"
                className="w-full p-3 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 resize-none transition-all"
              />
            </div>
          </div>

          {/* SECTION 2: Patient Attendant & Emergency Contact */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-black flex items-center gap-2">
                <Phone className="w-4 h-4 sm:w-5 sm:h-5 text-[#106EBE]" />
                <span>2. Patient Attendant & Emergency Contact</span>
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Your attendant or family member can use their own mobile number to log in via OTP and access your appointments, records, and prescriptions.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Attendant / Contact Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="e.g. Ramesh Sharma (Brother / Spouse / Friend)"
                  className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                  Attendant Mobile Number <span className="text-slate-400 font-normal normal-case">(10 digits)</span> <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="h-11 px-3 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-black flex items-center shrink-0">
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
                    className="flex-1 min-w-0 h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black font-mono focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
                  />
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-800">
                  Your attendant can log in using this mobile number to view and manage your care.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 3: Medical Background */}
          <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm sm:text-base font-bold text-black flex items-center gap-2 border-b border-slate-100 pb-3">
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-[#106EBE]" />
              <span>3. Medical History & Allergies</span>
            </h2>

            {/* Chronic Conditions */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-2">
                Chronic Health Conditions <span className="text-rose-500">*</span>
              </label>
              <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-2">
                <button
                  type="button"
                  onClick={handleNoneConditions}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    hasNoConditions
                      ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-xs'
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
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        isSelected
                          ? 'bg-[#106EBE] border-[#106EBE] text-white shadow-xs'
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
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Known Drug / Food Allergies <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g. Penicillin, Peanuts, Sulfa (or type 'None')"
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
              />
            </div>

            {/* Current Medications */}
            <div>
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide mb-1.5">
                Current Medications
              </label>
              <input
                type="text"
                value={medications}
                onChange={(e) => setMedications(e.target.value)}
                placeholder="e.g. Metformin 500mg, Thyronorm (or 'None')"
                className="w-full h-11 px-3.5 bg-white border border-slate-300 rounded-xl text-sm font-medium text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20 transition-all"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 sm:h-13 flex items-center justify-center gap-2 px-6 rounded-xl text-sm sm:text-base font-bold text-white bg-[#106EBE] hover:bg-[#0D5A9C] transition-all shadow-md hover:shadow-lg disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Saving Profile...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 text-[#0FFCBE]" />
                <span>Save Profile & Open Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#0FFCBE]" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
