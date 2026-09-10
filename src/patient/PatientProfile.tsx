import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, User, Phone, Mail, MapPin, Calendar, Droplets, Heart,
  Pill, AlertTriangle, Shield, Edit3, Check, X, LogOut, UserCircle,
} from 'lucide-react';
import { usePatientAuth, type RegisterData } from '../lib/patientAuth';
import type { PatientTab } from './PatientBottomNav';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CHRONIC_OPTIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Thyroid', 'Kidney disease', 'None'];

interface Props { onTab: (t: PatientTab) => void; }

export function PatientProfile({ onTab }: Props) {
  const navigate = useNavigate();
  const { account, updateProfile, logout } = usePatientAuth();
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Editable fields
  const [name, setName] = useState(account?.name ?? '');
  const [email, setEmail] = useState(account?.email ?? '');
  const [dob, setDob] = useState(account?.dob ?? '');
  const [gender, setGender] = useState(account?.gender ?? '');
  const [blood, setBlood] = useState(account?.blood_group ?? '');
  const [address, setAddress] = useState(account?.address ?? '');
  const [conditions, setConditions] = useState<string[]>(
    account?.chronic_conditions ? account.chronic_conditions.split(', ').filter(Boolean) : ['None']
  );
  const [allergies, setAllergies] = useState(account?.allergies ?? '');
  const [medications, setMedications] = useState(account?.current_medications?.join(', ') ?? '');
  const [emergName, setEmergName] = useState(account?.emergency_contact_name ?? '');
  const [emergPhone, setEmergPhone] = useState(account?.emergency_contact_phone ?? '');

  const ageFromDob = account?.dob
    ? Math.floor((Date.now() - new Date(account.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : account?.age ?? null;

  const toggleCondition = (c: string) => {
    if (c === 'None') { setConditions(['None']); return; }
    setConditions(prev => {
      const without = prev.filter(x => x !== 'None');
      return without.includes(c) ? without.filter(x => x !== c) : [...without, c];
    });
  };

  const saveSection = async (section: string) => {
    setSaving(true); setError('');
    let updates: Partial<RegisterData> = {};
    if (section === 'personal') updates = { name, dob: dob || undefined, gender: gender as 'Male' | 'Female' | 'Other', blood_group: blood };
    else if (section === 'contact') updates = { email: email || undefined, address: address || undefined, emergency_contact_name: emergName, emergency_contact_phone: emergPhone };
    else if (section === 'health') updates = { chronic_conditions: conditions.includes('None') ? 'None' : conditions.join(', '), allergies: allergies || 'None', current_medications: medications || undefined };

    const r = await updateProfile(updates);
    setSaving(false);
    if (!r.ok) { setError(r.error ?? 'Update failed'); return; }
    setEditing(null);
  };

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        {editing === id ? (
          <div className="flex gap-2">
            <button onClick={() => saveSection(id)} disabled={saving} className="flex items-center gap-1 text-xs font-semibold text-primary disabled:opacity-50">
              <Check size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="flex items-center gap-1 text-xs font-semibold text-gray-400">
              <X size={14} /> Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(id)} className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Edit3 size={13} /> Edit
          </button>
        )}
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
    </div>
  );

  const Row = ({ icon, label, value, editEl }: { icon: React.ReactNode; label: string; value: string; editEl?: React.ReactNode }) => (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        {editEl ?? <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>}
      </div>
    </div>
  );

  const field = (value: string, setter: (v: string) => void, placeholder = '', type = 'text') => (
    <input
      type={type}
      value={value}
      onChange={e => setter(e.target.value)}
      placeholder={placeholder}
      className="mt-0.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
    />
  );

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">My Profile</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-white">{account?.name?.slice(0, 2).toUpperCase() ?? 'PT'}</span>
          </div>
          <div>
            <p className="text-xl font-bold text-white">{account?.name ?? 'Patient'}</p>
            <p className="text-sm text-white/70">{account?.phone}</p>
            {ageFromDob && <p className="text-xs text-white/60">{ageFromDob} years • {account?.gender ?? ''}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-xl">{error}</p>}

        {/* Personal Information */}
        <Section id="personal" title="Personal Information">
          <Row icon={<User size={16} />} label="Full Name"
            value={name}
            editEl={editing === 'personal' ? field(name, setName, 'Full name') : undefined}
          />
          <Row icon={<Calendar size={16} />} label="Date of Birth"
            value={dob ? new Date(dob).toLocaleDateString('en-IN') : ''}
            editEl={editing === 'personal' ? (
              <input type="date" value={dob} onChange={e => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="mt-0.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            ) : undefined}
          />
          <Row icon={<User size={16} />} label="Gender"
            value={gender}
            editEl={editing === 'personal' ? (
              <div className="grid grid-cols-3 gap-1.5 mt-1">
                {(['Male', 'Female', 'Other'] as const).map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`rounded-lg border-2 py-2 text-xs font-semibold transition ${gender === g ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                    {g}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
          <Row icon={<Droplets size={16} />} label="Blood Group"
            value={blood}
            editEl={editing === 'personal' ? (
              <div className="grid grid-cols-4 gap-1.5 mt-1">
                {BLOOD_GROUPS.map(b => (
                  <button key={b} onClick={() => setBlood(b)}
                    className={`rounded-lg border-2 py-1.5 text-xs font-semibold transition ${blood === b ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                    {b}
                  </button>
                ))}
              </div>
            ) : undefined}
          />
        </Section>

        {/* Contact Information */}
        <Section id="contact" title="Contact & Address">
          <Row icon={<Phone size={16} />} label="Mobile" value={account?.phone ?? ''} />
          <Row icon={<Mail size={16} />} label="Email"
            value={email}
            editEl={editing === 'contact' ? field(email, setEmail, 'email@example.com', 'email') : undefined}
          />
          <Row icon={<MapPin size={16} />} label="Address"
            value={address}
            editEl={editing === 'contact' ? (
              <textarea value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Street, area, city, PIN"
                className="mt-0.5 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none" rows={2} />
            ) : undefined}
          />
          <div className="border-t border-gray-50 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Emergency Contact</p>
            <Row icon={<Shield size={16} />} label="Name"
              value={emergName}
              editEl={editing === 'contact' ? field(emergName, setEmergName, 'Contact name') : undefined}
            />
            <div className="mt-2">
              <Row icon={<Phone size={16} />} label="Phone"
                value={emergPhone}
                editEl={editing === 'contact' ? field(emergPhone, setEmergPhone, '10-digit mobile') : undefined}
              />
            </div>
          </div>
        </Section>

        {/* Health Profile */}
        <Section id="health" title="Health Profile">
          <Row icon={<Heart size={16} />} label="Medical Conditions"
            value={conditions.join(', ')}
            editEl={editing === 'health' ? (
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {CHRONIC_OPTIONS.map(c => {
                  const active = conditions.includes(c);
                  return (
                    <button key={c} onClick={() => toggleCondition(c)}
                      className={`flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-2 text-xs font-medium transition ${active ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-600'}`}>
                      {active && <Check size={11} className="shrink-0" />}
                      {c}
                    </button>
                  );
                })}
              </div>
            ) : undefined}
          />
          <Row icon={<AlertTriangle size={16} />} label="Allergies"
            value={allergies}
            editEl={editing === 'health' ? field(allergies, setAllergies, 'e.g. Penicillin, Dust') : undefined}
          />
          <Row icon={<Pill size={16} />} label="Current Medications"
            value={medications}
            editEl={editing === 'health' ? field(medications, setMedications, 'comma separated') : undefined}
          />
        </Section>

        {/* Logout */}
        <button
          onClick={() => {
            logout();
            navigate('/login', { replace: true });
          }}
          className="w-full py-4 rounded-2xl border-2 border-red-100 bg-red-50 text-red-600 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </div>
  );
}
