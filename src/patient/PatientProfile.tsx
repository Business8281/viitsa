import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Phone, Mail, MapPin, Calendar, Droplets, Heart,
  Pill, AlertTriangle, Shield, Edit3, Check, X, LogOut, CheckCircle2,
  Lock, Key, Eye, EyeOff, Loader2, ShieldCheck,
} from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { assertPasswordUniqueness, claimPasswordHash, getPasswordValidationError } from '../lib/passwordSecurity';
import { PasswordRequirementsGuide } from '../components/PasswordRequirementsGuide';
import { usePatientAuth, type RegisterData } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { formatDate, calculateAge } from '../lib/format';
import type { PatientTab } from './PatientBottomNav';
import { DobCalendarPicker } from '../components/DobCalendarPicker';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CHRONIC_OPTIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Thyroid', 'Kidney disease', 'None'];

interface Props { onTab: (t: PatientTab) => void; }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-bold text-gray-900">{title}</p>
      </div>
      <div className="px-4 py-4 space-y-3.5">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, editEl }: { icon: React.ReactNode; label: string; value: string; editEl?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        {editEl ?? <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>}
      </div>
    </div>
  );
}

const getCachedProfile = (accId?: string | null, userId?: string | null) => {
  const keys = [
    accId ? `viitsa_patient_profile_${accId}` : null,
    userId ? `viitsa_patient_profile_${userId}` : null,
    userId ? `viitsa_pat_${userId}` : null,
    'viitsa_patient_v1',
  ].filter(Boolean) as string[];

  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // localStorage may be unavailable or JSON invalid
    }
  }
  return null;
};

export function PatientProfile({ onTab }: Props) {
  const navigate = useNavigate();
  const { account, updateProfile, logout, refreshAccount } = usePatientAuth();
  const { user, patientAccount: authPatientAccount, refreshSession } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Password Security State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState<string | null>(null);

  const hasPasswordProvider = useMemo(() => {
    const fromAuth = auth.currentUser?.providerData.some(p => p.providerId === 'password');
    const fromUser = user?.auth_providers?.includes('password');
    return Boolean(fromAuth || fromUser);
  }, [user]);

  const hasGoogleProvider = useMemo(() => {
    const fromAuth = auth.currentUser?.providerData.some(p => p.providerId === 'google.com');
    const fromUser = user?.auth_providers?.includes('google.com');
    return Boolean(fromAuth || fromUser);
  }, [user]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdSuccess(null);

    const valErr = getPasswordValidationError(newPassword, confirmPassword);
    if (valErr) {
      setPwdError(valErr);
      return;
    }

    if (!auth.currentUser) {
      setPwdError('No active authentication session. Please sign in again.');
      return;
    }

    setPwdLoading(true);
    try {
      const uniqCheck = await assertPasswordUniqueness(newPassword, auth.currentUser.uid);
      if (!uniqCheck.ok) {
        setPwdError(uniqCheck.error || 'This password is already in use by another account. Please choose a different password.');
        setPwdLoading(false);
        return;
      }

      await updatePassword(auth.currentUser, newPassword);

      // Claim hash in registry
      await claimPasswordHash(uniqCheck.hash, auth.currentUser.uid, auth.currentUser.email || '');

      // Record 'password' provider in user document and patient_accounts
      const uid = user?.user_id || (user as any)?.id || auth.currentUser.uid;
      try {
        await updateDoc(doc(db, 'users', uid), {
          auth_providers: arrayUnion('password'),
          updated_at: new Date().toISOString()
        });
      } catch (docErr) {
        console.warn('Update user auth_providers warning:', docErr);
      }

      const accId = account?.account_id || authPatientAccount?.account_id;
      if (accId) {
        try {
          await updateDoc(doc(db, 'patient_accounts', accId), {
            auth_providers: arrayUnion('password'),
            updated_at: new Date().toISOString()
          });
        } catch (accErr) {
          console.warn('Update patient_accounts auth_providers warning:', accErr);
        }
      }

      setPwdSuccess(hasPasswordProvider ? 'Password changed successfully!' : 'Password set successfully! You can now sign in using Google or email & password.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPwdSuccess(null);
        refreshSession?.();
      }, 2000);
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setPwdError('For security, please sign out and sign in again before setting a new password.');
      } else {
        setPwdError(err.message || 'Failed to update password. Please try again.');
      }
    } finally {
      setPwdLoading(false);
    }
  };

  // Comprehensive fallback combining account, authPatientAccount, user, and localStorage caches
  const effectiveAccount = useMemo(() => {
    const cached = getCachedProfile(
      account?.account_id || authPatientAccount?.account_id,
      user?.user_id
    );

    const pickStr = (...vals: any[]): string => {
      for (const v of vals) {
        if (typeof v === 'string' && v.trim() !== '') return v.trim();
      }
      return '';
    };

    const rawConditions = account?.chronic_conditions ?? authPatientAccount?.chronic_conditions ?? user?.chronic_conditions ?? cached?.chronic_conditions;
    const rawAllergies = account?.allergies ?? authPatientAccount?.allergies ?? user?.allergies ?? cached?.allergies;
    const rawMeds = account?.current_medications ?? authPatientAccount?.current_medications ?? user?.current_medications ?? cached?.current_medications;

    const computedDob = pickStr(account?.dob, authPatientAccount?.dob, user?.dob, cached?.dob);
    let computedAge: string | number | null = null;
    if (account?.age !== undefined && account?.age !== null && (account?.age as unknown) !== '') computedAge = account.age;
    else if (authPatientAccount?.age !== undefined && authPatientAccount?.age !== null && (authPatientAccount?.age as unknown) !== '') computedAge = authPatientAccount.age;
    else if (user?.age !== undefined && user?.age !== null && (user?.age as unknown) !== '') computedAge = user.age;
    else if (cached?.age !== undefined && cached?.age !== null && (cached?.age as unknown) !== '') computedAge = cached.age;
    else if (computedDob) computedAge = calculateAge(computedDob);

    return {
      name: pickStr(account?.name, authPatientAccount?.name, user?.name, user?.full_name, cached?.name, cached?.full_name),
      phone: pickStr(account?.phone, authPatientAccount?.phone, user?.phone, cached?.phone),
      email: pickStr(account?.email, authPatientAccount?.email, user?.email, cached?.email),
      dob: computedDob,
      age: computedAge,
      gender: pickStr(account?.gender, authPatientAccount?.gender, user?.gender, cached?.gender),
      blood_group: pickStr(account?.blood_group, authPatientAccount?.blood_group, user?.blood_group, cached?.blood_group),
      address: pickStr(account?.address, authPatientAccount?.address, user?.address, cached?.address),
      emergency_contact_name: pickStr(account?.emergency_contact_name, (account as any)?.attender_name, authPatientAccount?.emergency_contact_name, user?.emergency_contact_name, (user as any)?.attender_name, cached?.emergency_contact_name),
      emergency_contact_phone: pickStr(account?.emergency_contact_phone, (account as any)?.attender_phone, authPatientAccount?.emergency_contact_phone, user?.emergency_contact_phone, (user as any)?.attender_phone, cached?.emergency_contact_phone),
      chronic_conditions: rawConditions || 'None',
      allergies: rawAllergies || 'None',
      current_medications: rawMeds || 'None',
    };
  }, [account, authPatientAccount, user]);

  // Editable fields
  const [name, setName] = useState(effectiveAccount.name);
  const [phone, setPhone] = useState(effectiveAccount.phone);
  const [email, setEmail] = useState(effectiveAccount.email);
  const [dob, setDob] = useState(effectiveAccount.dob);
  const [age, setAge] = useState<string>(
    effectiveAccount.age !== undefined && effectiveAccount.age !== null ? String(effectiveAccount.age) : ''
  );
  const [gender, setGender] = useState(effectiveAccount.gender);
  const [blood, setBlood] = useState(effectiveAccount.blood_group);
  const [address, setAddress] = useState(effectiveAccount.address);

  const parseConditions = (raw: any): string[] => {
    if (Array.isArray(raw)) return raw.length ? raw : ['None'];
    if (typeof raw === 'string' && raw.trim()) return raw.split(', ').filter(Boolean);
    return ['None'];
  };

  const parseString = (raw: any): string => {
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'string') return raw;
    return '';
  };

  const [conditions, setConditions] = useState<string[]>(parseConditions(effectiveAccount.chronic_conditions));
  const [allergies, setAllergies] = useState(parseString(effectiveAccount.allergies));
  const [medications, setMedications] = useState(parseString(effectiveAccount.current_medications));
  const [emergName, setEmergName] = useState(effectiveAccount.emergency_contact_name);
  const [emergPhone, setEmergPhone] = useState(effectiveAccount.emergency_contact_phone);

  // Synchronize local form fields with live account data whenever effectiveAccount changes (and not actively editing)
  useEffect(() => {
    if (isEditing) return;
    setName(effectiveAccount.name);
    setPhone(effectiveAccount.phone);
    setEmail(effectiveAccount.email);
    setDob(effectiveAccount.dob);
    setAge(effectiveAccount.age !== undefined && effectiveAccount.age !== null ? String(effectiveAccount.age) : '');
    setGender(effectiveAccount.gender);
    setBlood(effectiveAccount.blood_group);
    setAddress(effectiveAccount.address);
    setConditions(parseConditions(effectiveAccount.chronic_conditions));
    setAllergies(parseString(effectiveAccount.allergies));
    setMedications(parseString(effectiveAccount.current_medications));
    setEmergName(effectiveAccount.emergency_contact_name);
    setEmergPhone(effectiveAccount.emergency_contact_phone);
  }, [effectiveAccount, isEditing]);

  // When patient picks DOB: calculate and fill full age immediately
  const handleDobChange = (newDob: string) => {
    setDob(newDob);
    if (newDob) {
      const computed = calculateAge(newDob);
      if (computed !== null) {
        setAge(String(computed));
      }
    }
  };

  // When patient types age manually:
  const handleAgeChange = (newAge: string) => {
    setAge(newAge);
  };

  const toggleCondition = (c: string) => {
    if (c === 'None') { setConditions(['None']); return; }
    setConditions(prev => {
      const without = prev.filter(x => x !== 'None');
      return without.includes(c) ? without.filter(x => x !== c) : [...without, c];
    });
  };

  const startEditing = () => {
    setName(effectiveAccount.name);
    setPhone(effectiveAccount.phone);
    setDob(effectiveAccount.dob);
    setAge(effectiveAccount.age !== undefined && effectiveAccount.age !== null ? String(effectiveAccount.age) : '');
    setGender(effectiveAccount.gender);
    setBlood(effectiveAccount.blood_group);
    setEmail(effectiveAccount.email);
    setAddress(effectiveAccount.address);
    setEmergName(effectiveAccount.emergency_contact_name);
    setEmergPhone(effectiveAccount.emergency_contact_phone);
    setConditions(parseConditions(effectiveAccount.chronic_conditions));
    setAllergies(parseString(effectiveAccount.allergies));
    setMedications(parseString(effectiveAccount.current_medications));
    setError('');
    setSuccess('');
    setIsEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    const parsedAge = String(age).trim() !== '' ? parseInt(String(age).trim(), 10) : (dob ? calculateAge(dob) ?? undefined : undefined);
    const sanitizedPhone = phone.trim() ? phone.replace(/\D/g, '').slice(0, 10) : undefined;
    const sanitizedEmergPhone = emergPhone.trim() ? emergPhone.replace(/\D/g, '').slice(0, 10) : undefined;

    const updates: Partial<RegisterData> = {
      name: name.trim() || undefined,
      phone: sanitizedPhone,
      dob: dob || undefined,
      age: parsedAge !== undefined && !isNaN(parsedAge) ? parsedAge : undefined,
      gender: (gender as 'Male' | 'Female' | 'Other') || undefined,
      blood_group: blood || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      emergency_contact_name: emergName.trim() || undefined,
      emergency_contact_phone: sanitizedEmergPhone,
      attender_name: emergName.trim() || undefined,
      attender_phone: sanitizedEmergPhone,
      chronic_conditions: conditions.includes('None') || conditions.length === 0 ? 'None' : conditions.join(', '),
      allergies: allergies.trim() || 'None',
      current_medications: medications.trim() || 'None',
    };

    const r = await updateProfile(updates);
    if (!r.ok) {
      setSaving(false);
      setError(r.error ?? 'Update failed. Please try again.');
      return;
    }

    // Immediately cache updated data across all patient storage keys
    const activeAccId = account?.account_id || authPatientAccount?.account_id || user?.patient_account_id || (user?.user_id ? `pat_${user.user_id}` : null);
    const updatedCombined = {
      ...effectiveAccount,
      ...updates,
      phone: sanitizedPhone || effectiveAccount.phone,
      emergency_contact_phone: sanitizedEmergPhone || effectiveAccount.emergency_contact_phone,
    };
    if (activeAccId) {
      try {
        localStorage.setItem(`viitsa_patient_profile_${activeAccId}`, JSON.stringify(updatedCombined));
      } catch {
        // localStorage may be unavailable
      }
    }
    if (user?.user_id) {
      try {
        localStorage.setItem(`viitsa_patient_profile_${user.user_id}`, JSON.stringify(updatedCombined));
        localStorage.setItem(`viitsa_pat_${user.user_id}`, JSON.stringify(updatedCombined));
      } catch {
        // localStorage may be unavailable
      }
    }

    if (refreshAccount) {
      refreshAccount().catch(console.warn);
    }
    if (refreshSession) {
      refreshSession().catch(console.warn);
    }

    setSaving(false);
    setSuccess('Profile updated successfully!');
    setIsEditing(false);
    setTimeout(() => setSuccess(''), 3500);
  };



  const field = (value: string, setter: (v: string) => void, placeholder = '', type = 'text', maxLength?: number) => (
    <input
      type={type}
      value={value}
      onChange={e => setter(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary shadow-sm"
    />
  );

  // Live display variables (prefer effectiveAccount, fallback to state)
  const displayAge = effectiveAccount.age !== undefined && effectiveAccount.age !== null && effectiveAccount.age !== ''
    ? effectiveAccount.age
    : (effectiveAccount.dob ? calculateAge(effectiveAccount.dob) : (age ? age : null));

  const displayDob = effectiveAccount.dob || dob;

  const displayConditions = useMemo(() => {
    const raw = effectiveAccount.chronic_conditions;
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'string' && raw.trim()) return raw;
    return conditions.length ? conditions.join(', ') : 'None';
  }, [effectiveAccount.chronic_conditions, conditions]);

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">
              <ChevronLeft size={18} />
            </button>
            <p className="text-sm font-bold text-white">My Profile</p>
          </div>
          {!isEditing && (
            <button onClick={startEditing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-primary text-xs font-bold shadow-sm hover:bg-gray-50 transition">
              <Edit3 size={14} /> Edit Profile
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-white">
              {(effectiveAccount.name || 'Patient').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xl font-bold text-white">{effectiveAccount.name || 'Patient'}</p>
            <p className="text-sm text-white/70">{effectiveAccount.phone || 'No phone number'}</p>
            <p className="text-xs text-white/80 mt-0.5">
              {displayAge ? `${displayAge} years` : 'Age not set'}
              {effectiveAccount.gender ? ` • ${effectiveAccount.gender}` : ''}
              {effectiveAccount.blood_group ? ` • ${effectiveAccount.blood_group}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-xl flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl flex items-center gap-2">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        {/* Personal Information */}
        <Section title="Personal Information">
          <Row
            icon={<User size={16} />}
            label="Full Name"
            value={effectiveAccount.name || name}
            editEl={isEditing ? field(name, setName, 'Enter full name') : undefined}
          />

          <Row
            icon={<Calendar size={16} />}
            label="Date of Birth"
            value={displayDob ? formatDate(displayDob) : '—'}
            editEl={isEditing ? (
              <div className="mt-1 space-y-1">
                <DobCalendarPicker
                  value={dob}
                  onChange={handleDobChange}
                  placeholder="Select Date of Birth"
                />
                <p className="text-[11px] text-gray-500">Click to select Date of Birth (auto-fills age)</p>
              </div>
            ) : undefined}
          />

          <Row
            icon={<User size={16} />}
            label="Age"
            value={displayAge !== null && displayAge !== undefined && displayAge !== '' ? `${displayAge} years` : '—'}
            editEl={isEditing ? (
              <div className="mt-1 space-y-1">
                <input
                  type="number"
                  min={0}
                  max={125}
                  value={age}
                  onChange={e => handleAgeChange(e.target.value)}
                  placeholder="Type age (e.g. 28)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono shadow-sm"
                />
                <p className="text-[11px] text-gray-500">Auto-filled from DOB or type manually</p>
              </div>
            ) : undefined}
          />

          <Row
            icon={<User size={16} />}
            label="Gender"
            value={effectiveAccount.gender || gender}
            editEl={isEditing ? (
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {(['Male', 'Female', 'Other'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`rounded-xl border-2 py-2 text-xs font-semibold transition ${
                      gender === g ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            ) : undefined}
          />

          <Row
            icon={<Droplets size={16} />}
            label="Blood Group"
            value={effectiveAccount.blood_group || blood}
            editEl={isEditing ? (
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {BLOOD_GROUPS.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBlood(b)}
                    className={`rounded-xl border-2 py-1.5 text-xs font-semibold transition ${
                      blood === b ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
        </Section>

        {/* Contact Information */}
        <Section title="Contact & Address">
          <Row
            icon={<Phone size={16} />}
            label="Mobile"
            value={effectiveAccount.phone || phone || '—'}
            editEl={isEditing ? field(phone, v => setPhone(v.replace(/\D/g, '').slice(0, 10)), '10-digit mobile number', 'tel', 10) : undefined}
          />

          <Row
            icon={<Mail size={16} />}
            label="Email"
            value={effectiveAccount.email || email}
            editEl={isEditing ? field(email, setEmail, 'email@example.com', 'email') : undefined}
          />

          <Row
            icon={<MapPin size={16} />}
            label="Address"
            value={effectiveAccount.address || address}
            editEl={isEditing ? (
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Street, area, city, PIN code"
                className="mt-0.5 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none shadow-sm"
                rows={2}
              />
            ) : undefined}
          />

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-bold text-gray-600 mb-0.5">Patient Attendant & Emergency Contact</p>
            <p className="text-[11px] text-gray-400 mb-2">Can log in via mobile OTP using their phone number to access your appointments and records.</p>
            <Row
              icon={<Shield size={16} />}
              label="Attendant / Contact Name"
              value={effectiveAccount.emergency_contact_name || emergName}
              editEl={isEditing ? field(emergName, setEmergName, 'Attendant or Emergency contact name') : undefined}
            />
            <div className="mt-2">
              <Row
                icon={<Phone size={16} />}
                label="Attendant Mobile Number"
                value={effectiveAccount.emergency_contact_phone || emergPhone}
                editEl={isEditing ? field(emergPhone, v => setEmergPhone(v.replace(/\D/g, '').slice(0, 10)), '10-digit mobile number', 'tel', 10) : undefined}
              />
            </div>
          </div>
        </Section>

        {/* Health Profile */}
        <Section title="Health Profile">
          <Row
            icon={<Heart size={16} />}
            label="Medical Conditions"
            value={displayConditions}
            editEl={isEditing ? (
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {CHRONIC_OPTIONS.map(c => {
                  const active = conditions.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCondition(c)}
                      className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-xs font-medium transition ${
                        active ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {active && <Check size={11} className="shrink-0" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            ) : undefined}
          />

          <Row
            icon={<AlertTriangle size={16} />}
            label="Allergies"
            value={
              effectiveAccount.allergies
                ? (Array.isArray(effectiveAccount.allergies) ? effectiveAccount.allergies.join(', ') : effectiveAccount.allergies)
                : (allergies || 'None')
            }
            editEl={isEditing ? field(allergies, setAllergies, 'e.g. Penicillin, Dust, Peanuts') : undefined}
          />

          <Row
            icon={<Pill size={16} />}
            label="Current Medications"
            value={
              effectiveAccount.current_medications
                ? (Array.isArray(effectiveAccount.current_medications) ? effectiveAccount.current_medications.join(', ') : effectiveAccount.current_medications)
                : (medications || 'None')
            }
            editEl={isEditing ? field(medications, setMedications, 'e.g. Paracetamol 500mg, Metformin') : undefined}
          />
        </Section>

        {/* Account Security & Password Section */}
        {!isEditing && (
          <Section title="Account Security & Credentials">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 border border-teal-100">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-800">Sign-In Methods</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {hasGoogleProvider && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Google Sign-In
                        </span>
                      )}
                      {hasPasswordProvider && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Email & Password
                        </span>
                      )}
                      {!hasGoogleProvider && !hasPasswordProvider && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Email Login
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setPwdError(null);
                    setPwdSuccess(null);
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowPasswordModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#106EBE]/10 hover:bg-[#106EBE]/20 text-[#106EBE] border border-[#106EBE]/30 transition shrink-0 flex items-center gap-1.5 shadow-xs"
                >
                  <Key size={14} />
                  {hasPasswordProvider ? 'Change Password' : 'Set Password'}
                </button>
              </div>

              {!hasPasswordProvider && hasGoogleProvider && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
                  <p className="font-semibold mb-0.5">Dual-Method Sign-In:</p>
                  You currently sign in with Google. You can set a password here so you can also log in directly using your email address and password.
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Set / Change Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {hasPasswordProvider ? 'Change Account Password' : 'Set Account Password'}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {hasPasswordProvider ? 'Choose a strong, unique new password' : 'Enable email & password login for your account'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition"
                >
                  <X size={18} />
                </button>
              </div>

              {pwdSuccess && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>{pwdSuccess}</span>
                </div>
              )}

              {pwdError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle size={16} className="text-red-500 shrink-0" />
                  <span>{pwdError}</span>
                </div>
              )}

              <form onSubmit={handleUpdatePassword} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <PasswordRequirementsGuide password={newPassword} />

                <div className="flex gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={pwdLoading}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-xs hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwdLoading}
                    className="flex-1 py-2.5 rounded-xl bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-70 shadow-sm"
                  >
                    {pwdLoading ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                    {pwdLoading ? 'Saving...' : hasPasswordProvider ? 'Update Password' : 'Save Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isEditing ? (
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => setIsEditing(false)}
              disabled={saving}
              className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={saveProfile}
              disabled={saving}
              className="flex-1 py-4 rounded-2xl bg-[#106EBE] hover:bg-[#0D5A9C] text-white font-bold text-sm flex items-center justify-center gap-2 transition disabled:opacity-70 shadow-md"
            >
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="w-full py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm mt-4"
          >
            <LogOut size={16} /> Sign Out
          </button>
        )}
      </div>
    </div>
  );
}
