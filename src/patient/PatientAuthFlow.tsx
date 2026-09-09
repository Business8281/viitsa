import { useState } from 'react';
import { Activity, ArrowRight, CheckCircle, ChevronLeft, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePatientAuth, type RegisterData } from '../lib/patientAuth';
import type { Clinic } from '../lib/types';
import { ViitsaLogo } from '../components/ViitsaLogo';

const CHRONIC_OPTIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Thyroid', 'Kidney disease', 'None'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

type Step = 'phone' | 'otp' | 'step1' | 'step2' | 'step3';

interface Props {
  clinic: Clinic | null;
  onDone: () => void;
}

export function PatientAuthFlow({ clinic, onDone }: Props) {
  const { sendOtp, verifyOtp, register, account } = usePatientAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Personal info
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other' | ''>('');
  const [blood, setBlood] = useState('');

  // Contact info
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [emergName, setEmergName] = useState('');
  const [emergPhone, setEmergPhone] = useState('');

  // Health info
  const [conditions, setConditions] = useState<string[]>(['None']);
  const [allergies, setAllergies] = useState('');
  const [medications, setMedications] = useState('');

  const handleSendOtp = async () => {
    setBusy(true); setError('');
    const r = await sendOtp(phone);
    setBusy(false);
    if (!r.ok) { setError(r.error ?? 'Error'); return; }
    setStep('otp');
  };

  const handleVerifyOtp = async () => {
    setBusy(true); setError('');
    const r = await verifyOtp(phone, otp);
    setBusy(false);
    if (!r.ok) { setError(r.error ?? 'Invalid OTP'); return; }
    if (r.isNew) setStep('step1');
    else onDone();
  };

  const handleStep1 = () => {
    if (!name.trim()) { setError('Please enter your full name.'); return; }
    if (!dob) { setError('Please enter your date of birth.'); return; }
    if (!gender) { setError('Please select your gender.'); return; }
    setError('');
    setStep('step2');
  };

  const handleStep2 = () => {
    setError('');
    setStep('step3');
  };

  const handleStep3 = async () => {
    setBusy(true); setError('');
    const chronic = conditions.includes('None') ? 'None' : conditions.join(', ');
    const data: RegisterData = {
      phone, name,
      email: email || undefined,
      dob: dob || undefined,
      gender: gender as 'Male' | 'Female' | 'Other',
      blood_group: blood || 'Unknown',
      address: address || undefined,
      chronic_conditions: chronic,
      allergies: allergies || 'None',
      current_medications: medications || undefined,
      emergency_contact_name: emergName,
      emergency_contact_phone: emergPhone,
    };
    const r = await register(data);
    setBusy(false);
    if (!r.ok) { setError(r.error ?? 'Registration failed'); return; }
    onDone();
  };

  const toggleCondition = (c: string) => {
    if (c === 'None') { setConditions(['None']); return; }
    setConditions(prev => {
      const without = prev.filter(x => x !== 'None');
      return without.includes(c) ? without.filter(x => x !== c) : [...without, c];
    });
  };

  const clinicName = clinic?.name ?? 'VIITSA';

  const headerEl = (
    <div className="flex flex-col items-center pt-10 pb-5 px-6">
      <ViitsaLogo size="md" />
      <p className="text-xs text-gray-500 text-center mt-1.5">{clinicName}</p>
    </div>
  );

  const progressBar = (current: number, total: number, label: string) => (
    <div className="flex items-center gap-2 mb-3">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-primary' : 'bg-gray-200'}`} />
      ))}
      <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
    </div>
  );

  if (step === 'phone') return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      {headerEl}
      <div className="flex-1 px-5 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome!</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your mobile number to get started</p>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mobile number</label>
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-600">+91</span>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-base focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              placeholder="98765 43210"
              inputMode="numeric"
              maxLength={10}
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-start gap-2 rounded-xl bg-primary/5 px-4 py-3 text-xs text-gray-500">
          <Shield size={14} className="text-primary shrink-0 mt-0.5" />
          <span>We'll send a 4-digit OTP via SMS to verify your number.</span>
        </div>
        <button
          onClick={handleSendOtp}
          disabled={busy || phone.length < 10}
          className="w-full rounded-xl py-4 text-base font-semibold text-white transition disabled:opacity-50"
          style={{ backgroundColor: '#0F6E56' }}
        >
          {busy ? 'Sending…' : 'Get OTP →'}
        </button>
      </div>
    </div>
  );

  if (step === 'otp') return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      {headerEl}
      <div className="flex-1 px-5 space-y-5">
        <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-sm text-gray-500">
          <ChevronLeft size={16} /> Change number
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enter OTP</h1>
          <p className="text-gray-500 text-sm mt-1">Sent to +91 {phone}</p>
        </div>
        <input
          value={otp}
          onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="w-full text-center text-3xl font-bold tracking-[0.4em] rounded-xl border-2 border-gray-200 bg-white py-4 focus:outline-none focus:border-primary"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          autoFocus
        />
        {error && <p className="text-sm text-red-500 text-center">{error}</p>}
        <button
          onClick={handleVerifyOtp}
          disabled={busy || otp.length < 4}
          className="w-full rounded-xl py-4 text-base font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: '#0F6E56' }}
        >
          {busy ? 'Verifying…' : 'Verify OTP'}
        </button>
      </div>
    </div>
  );

  if (step === 'step1') return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      {headerEl}
      <div className="flex-1 px-5 space-y-4 pb-8">
        {progressBar(1, 3, 'Step 1 of 3 — Basic info')}
        <h1 className="text-xl font-bold text-gray-900">Tell us about you</h1>
        <div>
          <label className="label">Full name *</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ravi Kumar"
          />
        </div>
        <div>
          <label className="label">Date of birth *</label>
          <input
            type="date"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={dob}
            onChange={e => setDob(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <label className="label">Gender *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Male', 'Female', 'Other'] as const).map(g => (
              <button key={g} onClick={() => setGender(g)}
                className={`rounded-xl border-2 py-3 text-sm font-semibold transition ${gender === g ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Blood group</label>
          <div className="grid grid-cols-4 gap-2">
            {BLOOD_GROUPS.map(b => (
              <button key={b} onClick={() => setBlood(b)}
                className={`rounded-xl border-2 py-2.5 text-sm font-semibold transition ${blood === b ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                {b}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={handleStep1} className="w-full rounded-xl py-4 text-base font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>
          Continue <ArrowRight size={16} className="inline ml-1" />
        </button>
      </div>
    </div>
  );

  if (step === 'step2') return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      {headerEl}
      <div className="flex-1 px-5 space-y-4 pb-8">
        <button onClick={() => setStep('step1')} className="flex items-center gap-1 text-sm text-gray-500">
          <ChevronLeft size={16} /> Back
        </button>
        {progressBar(2, 3, 'Step 2 of 3 — Contact info')}
        <h1 className="text-xl font-bold text-gray-900">Contact details</h1>
        <div>
          <label className="label">Email address (optional)</label>
          <input
            type="email"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="ravi@example.com"
          />
        </div>
        <div>
          <label className="label">Home address (optional)</label>
          <textarea
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Street, area, city, PIN code"
            rows={2}
          />
        </div>
        <div>
          <label className="label">Emergency contact name</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={emergName}
            onChange={e => setEmergName(e.target.value)}
            placeholder="Family member's name"
          />
        </div>
        <div>
          <label className="label">Emergency contact number</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={emergPhone}
            onChange={e => setEmergPhone(e.target.value)}
            inputMode="numeric"
            placeholder="10-digit mobile"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button onClick={handleStep2} className="w-full rounded-xl py-4 text-base font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>
          Continue <ArrowRight size={16} className="inline ml-1" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-10 pb-3">
        <button onClick={() => navigate('/')} className="text-sm text-gray-500 flex items-center gap-1">
          <ChevronLeft size={16} /> Home
        </button>
      </div>
      {headerEl}
      <div className="flex-1 px-5 space-y-4 pb-28">
        <button onClick={() => setStep('step2')} className="flex items-center gap-1 text-sm text-gray-500">
          <ChevronLeft size={16} /> Back
        </button>
        {progressBar(3, 3, 'Step 3 of 3 — Health profile')}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Health profile</h1>
          <p className="text-xs text-gray-400 mt-0.5">Helps doctors prepare better for your visit</p>
        </div>
        <div>
          <label className="label">Existing medical conditions</label>
          <div className="grid grid-cols-2 gap-2">
            {CHRONIC_OPTIONS.map(c => {
              const active = conditions.includes(c);
              return (
                <button key={c} onClick={() => toggleCondition(c)}
                  className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium transition ${active ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-600'}`}>
                  {active && <CheckCircle size={14} className="text-primary shrink-0" />}
                  {c}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="label">Allergies (optional)</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={allergies}
            onChange={e => setAllergies(e.target.value)}
            placeholder="e.g. Penicillin, Dust, Peanuts"
          />
        </div>
        <div>
          <label className="label">Current medications (optional)</label>
          <input
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary"
            value={medications}
            onChange={e => setMedications(e.target.value)}
            placeholder="e.g. Metformin, Amlodipine (comma separated)"
          />
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        <button onClick={handleStep3} disabled={busy} className="w-full rounded-xl py-4 text-base font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#0F6E56' }}>
          {busy ? 'Saving…' : 'Complete registration ✓'}
        </button>
      </div>
    </div>
  );
}
