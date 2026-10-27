import { useMemo, useState } from 'react';
import { Search, UserPlus, Phone, Droplet, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { EmptyState, Loading, SectionHeader, Avatar } from '../components/ui';
import { formatDate, calculateAge, formatDobForInput, localDateISO } from '../lib/format';
import type { Patient } from '../lib/types';
import { PatientDetailModal } from '../components/PatientDetailModal';

const CHRONIC = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Other'];

export function PatientsScreen() {
  const { clinic } = useAuth();
  const { patients, loading, refresh } = useClinicData();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Patient | null>(null);
  const filtered = useMemo(() => {
    if (!query) return patients;
    const q = query.toLowerCase();
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone?.includes(q) || p.email?.toLowerCase().includes(q),
    );
  }, [patients, query]);



  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Patients</h1>
          <p className="text-sm text-ink-muted">Search and register patients ({patients.length} total)</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-primary">
          <UserPlus size={16} />
          Register patient
        </button>
      </div>

      <div className="card">
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="input pl-9"
            placeholder="Search by name, phone, or email…"
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<UserPlus size={18} />}
            title="No patients found"
            description={query ? 'Try a different search term.' : 'Click "Register patient" to add the first one.'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((p) => (
              <button
                key={p.patient_id}
                onClick={() => setSelected(p)}
                className="text-left rounded-xl border border-black/5 p-4 hover:border-primary/30 hover:shadow-card transition group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={p.name} size={40} color="#0F6E56" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                      {p.status === 'left' && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">
                          Left Clinic
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {p.age ?? (p.dob ? calculateAge(p.dob) : '—')} yrs{p.dob ? ` · DOB: ${formatDate(p.dob)}` : ''} · {p.gender ?? '—'}
                    </p>
                  </div>
                  <ChevronRight size={16} className="text-ink-subtle opacity-0 group-hover:opacity-100" />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="flex items-center gap-1.5 text-ink-muted">
                    <Phone size={11} /> {p.phone ?? 'No phone'}
                  </p>
                  <p className="flex items-center gap-1.5 text-ink-muted">
                    <Droplet size={11} /> {p.blood_group ?? 'Unknown'}
                  </p>
                  {p.chronic_conditions && p.chronic_conditions !== 'None' && (
                    <p className="flex items-center gap-1.5 text-warning">
                      <AlertCircle size={11} /> {p.chronic_conditions}
                    </p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <PatientFormModal
        open={open}
        onClose={() => setOpen(false)}
        onSaved={() => {
          void refresh();
          setOpen(false);
        }}
        clinicId={clinic?.clinic_id ?? ''}
      />

      <PatientDetailModal patient={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

const EMPTY_FORM = {
  name: '',
  dob: '',
  age: '',
  gender: 'Male' as 'Male' | 'Female' | 'Other',
  phone: '',
  email: '',
  blood_group: 'O+',
  address: '',
  allergies: 'None',
  chronic: [] as string[],
  chronic_other: '',
  emergency_name: '',
  emergency_phone: '',
  terms: false,
};

function PatientFormModal({
  open,
  onClose,
  onSaved,
  clinicId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  clinicId: string;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const reset = () => setForm(EMPTY_FORM);

  const handleDobChange = (dobVal: string) => {
    const formatted = formatDobForInput(dobVal);
    let calculatedAge = form.age;
    if (dobVal) {
      const computed = calculateAge(dobVal);
      if (computed !== null) calculatedAge = String(computed);
    }
    setForm((f) => ({ ...f, dob: formatted, age: calculatedAge }));
  };

  const handleAgeChange = (ageVal: string) => {
    const cleanAge = ageVal.replace(/\D/g, '').slice(0, 3);
    const num = parseInt(cleanAge, 10);
    let newDob = form.dob;
    if (!form.dob && !isNaN(num) && num >= 0 && num <= 125) {
      const approxYear = new Date().getFullYear() - num;
      newDob = `${approxYear}-01-01`;
    }
    setForm((f) => ({ ...f, age: cleanAge, dob: newDob }));
  };

  const toggleChronic = (c: string) => {
    setForm((f) => ({
      ...f,
      chronic: f.chronic.includes(c) ? f.chronic.filter((x) => x !== c) : [...f.chronic, c],
    }));
  };

  const buildConditions = () => {
    const list = [...form.chronic];
    if (list.includes('Other') && form.chronic_other) {
      list[list.indexOf('Other')] = form.chronic_other.trim();
    } else if (list.includes('Other')) {
      list.splice(list.indexOf('Other'), 1);
    }
    return list.length ? list.join(', ') : 'None';
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast('Name and phone are required.', 'error');
      return;
    }
    setSaving(true);
    const conditions = buildConditions();
    const payload = {
      clinic_id: clinicId,
      name: form.name.trim(),
      dob: form.dob || null,
      age: form.age ? parseInt(form.age, 10) : null,
      gender: form.gender,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      blood_group: form.blood_group,
      address: form.address.trim() || null,
      allergies: form.allergies.trim() || 'None',
      chronic_conditions: conditions,
      emergency_contact_name: form.emergency_name.trim() || null,
      emergency_contact_phone: form.emergency_phone.trim() || null,
    };
    try {
      await addDoc(collection(db, 'patients'), payload);
    } catch (error) {
      setSaving(false);
      toast('Unable to register patient. Please try again.', 'error');
      return;
    }
    setSaving(false);
    toast(`${payload.name} registered successfully.`, 'success');
    reset();
    onSaved();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register new patient"
      subtitle="All fields marked * are required"
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button type="submit" form="patient-form" disabled={saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save patient'}
          </button>
        </>
      }
    >
      <form id="patient-form" onSubmit={submit} className="space-y-5">
        <div>
          <SectionHeader title="Personal details" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Full name *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi Kumar" />
            </div>
            <div>
              <label className="label">Phone *</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="label">Date of Birth (DOB)</label>
              <input
                type="date"
                className="input"
                max={localDateISO(new Date())}
                value={formatDobForInput(form.dob)}
                onChange={(e) => handleDobChange(e.target.value)}
              />
            </div>
            <div>
              <label className="label">
                Age {form.dob && <span className="text-[10px] text-teal-700 font-normal">(Auto-calculated)</span>}
              </label>
              <input
                type="number"
                min="0"
                max="125"
                className="input"
                placeholder="Age in years"
                value={form.age}
                onChange={(e) => handleAgeChange(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Gender</label>
              <select className="select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as 'Male' | 'Female' | 'Other' })}>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="label">Email (optional)</label>
              <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="patient@email.com" />
            </div>
            <div>
              <label className="label">Blood group</label>
              <select className="select" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value })}>
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'].map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="House no, area, city" />
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Medical history" />
          <div className="space-y-3">
            <div>
              <label className="label">Allergies</label>
              <input className="input" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. Penicillin, Sulfa drugs — or 'None'" />
            </div>
            <div>
              <label className="label">Chronic conditions</label>
              <div className="flex flex-wrap gap-2">
                {CHRONIC.map((c) => {
                  const active = form.chronic.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleChronic(c)}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                        active ? 'bg-primary border-primary text-white' : 'border-ink-subtle/30 text-ink-muted hover:border-primary/50'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {form.chronic.includes('Other') && (
                <input className="input mt-2" value={form.chronic_other} onChange={(e) => setForm({ ...form, chronic_other: e.target.value })} placeholder="Specify other condition" />
              )}
            </div>
          </div>
        </div>

        <div>
          <SectionHeader title="Emergency contact" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Contact name</label>
              <input className="input" value={form.emergency_name} onChange={(e) => setForm({ ...form, emergency_name: e.target.value })} />
            </div>
            <div>
              <label className="label">Contact phone</label>
              <input className="input" value={form.emergency_phone} onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })} />
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2 text-xs text-ink-muted rounded-lg bg-primary-50/50 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => setForm({ ...form, terms: e.target.checked })}
            className="mt-0.5 accent-primary"
          />
          <span>
            I confirm that the patient has consented to share medical information with this clinic for the
            purpose of treatment, and that the data will be stored securely within the clinic's system only.
          </span>
        </label>
      </form>
    </Modal>
  );
}
