import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Phone, Mail, MapPin, Calendar, Droplets, Heart,
  Pill, AlertTriangle, Shield, Edit3, Check, X, LogOut, CheckCircle2,
} from 'lucide-react';
import { usePatientAuth, type RegisterData } from '../lib/patientAuth';
import { formatDate, calculateAge, formatDobForInput, localDateISO } from '../lib/format';
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

export function PatientProfile({ onTab }: Props) {
  const navigate = useNavigate();
  const { account, updateProfile, logout } = usePatientAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable fields
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [dob, setDob] = useState(account?.dob ?? '');
  const [age, setAge] = useState<string>(
    account?.age !== undefined && account?.age !== null
      ? String(account.age)
      : (account?.dob ? String(calculateAge(account.dob) ?? '') : '')
  );
  const [gender, setGender] = useState(account?.gender ?? '');
  const [blood, setBlood] = useState(account?.blood_group ?? '');
  const [address, setAddress] = useState(account?.address ?? '');

  const [conditions, setConditions] = useState<string[]>(
    Array.isArray(account?.chronic_conditions) 
      ? account.chronic_conditions 
      : (account?.chronic_conditions && typeof account.chronic_conditions === 'string' 
          ? account.chronic_conditions.split(', ').filter(Boolean) 
          : ['None'])
  );
  const [allergies, setAllergies] = useState(
    Array.isArray(account?.allergies) ? account.allergies.join(', ') : (account?.allergies ?? '')
  );
  const [medications, setMedications] = useState(
    Array.isArray(account?.current_medications)
      ? account.current_medications.join(', ')
      : typeof account?.current_medications === 'string'
      ? account.current_medications
      : ''
  );
  const [emergName, setEmergName] = useState(account?.emergency_contact_name ?? '');
  const [emergPhone, setEmergPhone] = useState(account?.emergency_contact_phone ?? '');

  // Synchronize local form fields with live account data whenever account changes (and not actively editing)
  useEffect(() => {
    if (isEditing) return;
    if (!account) return;
    setName(account.name || '');
    setEmail(account.email || '');
    setDob(account.dob || '');
    setAge(
      account.age !== undefined && account.age !== null
        ? String(account.age)
        : (account.dob ? String(calculateAge(account.dob) ?? '') : '')
    );
    setGender(account.gender || '');
    setBlood(account.blood_group || '');
    setAddress(account.address || '');
    setConditions(
      Array.isArray(account.chronic_conditions) 
        ? account.chronic_conditions 
        : (account.chronic_conditions && typeof account.chronic_conditions === 'string' 
            ? account.chronic_conditions.split(', ').filter(Boolean) 
            : ['None'])
    );
    setAllergies(Array.isArray(account.allergies) ? account.allergies.join(', ') : (account.allergies || ''));
    setMedications(
      Array.isArray(account.current_medications)
        ? account.current_medications.join(', ')
        : typeof account.current_medications === 'string'
        ? account.current_medications
        : ''
    );
    setEmergName(account.emergency_contact_name || '');
    setEmergPhone(account.emergency_contact_phone || '');
  }, [account, isEditing]);

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
    if (account) {
      setName(account.name || '');
      setDob(account.dob || '');
      setAge(account.age !== undefined && account.age !== null ? String(account.age) : (account.dob ? String(calculateAge(account.dob) ?? '') : ''));
      setGender(account.gender || '');
      setBlood(account.blood_group || '');
      setEmail(account.email || '');
      setAddress(account.address || '');
      setEmergName(account.emergency_contact_name || '');
      setEmergPhone(account.emergency_contact_phone || '');
      setConditions(
        Array.isArray(account.chronic_conditions) 
          ? account.chronic_conditions 
          : (account.chronic_conditions && typeof account.chronic_conditions === 'string' 
              ? account.chronic_conditions.split(', ').filter(Boolean) 
              : ['None'])
      );
      setAllergies(Array.isArray(account.allergies) ? account.allergies.join(', ') : (account.allergies || ''));
      setMedications(
        Array.isArray(account.current_medications)
          ? account.current_medications.join(', ')
          : typeof account.current_medications === 'string'
          ? account.current_medications
          : ''
      );
    }
    setError('');
    setSuccess('');
    setIsEditing(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    
    const parsedAge = String(age).trim() !== '' ? parseInt(String(age).trim(), 10) : (dob ? calculateAge(dob) ?? undefined : undefined);
    
    const updates: Partial<RegisterData> = {
      name: name.trim() || undefined,
      dob: dob || undefined,
      age: parsedAge !== undefined && !isNaN(parsedAge) ? parsedAge : undefined,
      gender: gender as 'Male' | 'Female' | 'Other',
      blood_group: blood,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      emergency_contact_name: emergName.trim() || undefined,
      emergency_contact_phone: emergPhone.trim() || undefined,
      chronic_conditions: conditions.includes('None') || conditions.length === 0 ? 'None' : conditions.join(', '),
      allergies: allergies.trim() || 'None',
      current_medications: medications.trim() || undefined,
    };

    const r = await updateProfile(updates);
    setSaving(false);
    if (!r.ok) {
      setError(r.error ?? 'Update failed. Please try again.');
      return;
    }

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

  // Live display variables (prefer account, fallback to state)
  const displayAge = account?.age !== undefined && account?.age !== null
    ? account.age
    : (account?.dob ? calculateAge(account.dob) : (age ? age : null));

  const displayDob = account?.dob || dob;

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
              {(account?.name || 'Patient').slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-xl font-bold text-white">{account?.name || 'Patient'}</p>
            <p className="text-sm text-white/70">{account?.phone || 'No phone number'}</p>
            <p className="text-xs text-white/80 mt-0.5">
              {displayAge ? `${displayAge} years` : 'Age not set'}
              {account?.gender ? ` • ${account.gender}` : ''}
              {account?.blood_group ? ` • ${account.blood_group}` : ''}
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
            value={account?.name || name}
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
            value={account?.gender || gender}
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
            value={account?.blood_group || blood}
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
            value={account?.phone || '—'}
          />

          <Row
            icon={<Mail size={16} />}
            label="Email"
            value={account?.email || email}
            editEl={isEditing ? field(email, setEmail, 'email@example.com', 'email') : undefined}
          />

          <Row
            icon={<MapPin size={16} />}
            label="Address"
            value={account?.address || address}
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
            <p className="text-xs font-bold text-gray-500 mb-2">Emergency Contact</p>
            <Row
              icon={<Shield size={16} />}
              label="Contact Name"
              value={account?.emergency_contact_name || emergName}
              editEl={isEditing ? field(emergName, setEmergName, 'Emergency contact person name') : undefined}
            />
            <div className="mt-2">
              <Row
                icon={<Phone size={16} />}
                label="Contact Phone"
                value={account?.emergency_contact_phone || emergPhone}
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
            value={
              account?.chronic_conditions
                ? (Array.isArray(account.chronic_conditions) ? account.chronic_conditions.join(', ') : account.chronic_conditions)
                : (conditions.length ? conditions.join(', ') : 'None')
            }
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
              account?.allergies
                ? (Array.isArray(account.allergies) ? account.allergies.join(', ') : account.allergies)
                : (allergies || 'None')
            }
            editEl={isEditing ? field(allergies, setAllergies, 'e.g. Penicillin, Dust, Peanuts') : undefined}
          />

          <Row
            icon={<Pill size={16} />}
            label="Current Medications"
            value={
              account?.current_medications
                ? (Array.isArray(account.current_medications) ? account.current_medications.join(', ') : account.current_medications)
                : (medications || 'None')
            }
            editEl={isEditing ? field(medications, setMedications, 'e.g. Paracetamol 500mg, Metformin') : undefined}
          />
        </Section>

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
              className="flex-1 py-4 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition disabled:opacity-70"
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
