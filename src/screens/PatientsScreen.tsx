import { useMemo, useState } from 'react';
import { Search, UserPlus, Phone, Droplet, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { useToast } from '../lib/toast';
import { Modal } from '../components/Modal';
import { EmptyState, Loading, SectionHeader, Avatar } from '../components/ui';
import { formatDate } from '../lib/format';
import type { Patient } from '../lib/types';

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

  if (loading) return <Loading label="Loading patients…" />;

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
                    <p className="text-sm font-semibold text-ink truncate">{p.name}</p>
                    <p className="text-xs text-ink-muted">
                      {p.age ?? '—'} yrs · {p.gender ?? '—'}
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
    if (!form.terms) {
      toast('Please accept the terms to register the patient.', 'error');
      return;
    }
    setSaving(true);
    const conditions = buildConditions();
    const payload = {
      clinic_id: clinicId,
      name: form.name.trim(),
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
              <label className="label">Age</label>
              <input type="number" min="0" max="120" className="input" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
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

function PatientDetailModal({ patient, onClose }: { patient: Patient | null; onClose: () => void }) {
  if (!patient) return null;
  return (
    <Modal
      open={!!patient}
      onClose={onClose}
      title={patient.name}
      subtitle={`${patient.age ?? '—'} yrs · ${patient.gender ?? '—'} · ${patient.blood_group ?? 'Unknown blood group'}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Detail label="Phone" value={patient.phone ?? '—'} />
          <Detail label="Email" value={patient.email ?? '—'} />
          <Detail label="Patient ID" value={patient.patient_id.slice(0, 8).toUpperCase()} />
          <Detail label="Registered" value={formatDate(patient.created_at)} />
        </div>
        <div className="rounded-lg border border-black/5 p-3">
          <p className="label">Address</p>
          <p className="text-sm text-ink">{patient.address ?? 'Not provided'}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg bg-danger-bg/40 border border-danger/15 p-3">
            <p className="label text-danger">Allergies</p>
            <p className="text-sm text-ink">{patient.allergies || 'None'}</p>
          </div>
          <div className="rounded-lg bg-warning-bg/40 border border-warning/15 p-3">
            <p className="label text-warning">Chronic conditions</p>
            <p className="text-sm text-ink">{patient.chronic_conditions || 'None'}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Detail label="Emergency contact" value={patient.emergency_contact_name ?? '—'} />
          <Detail label="Emergency phone" value={patient.emergency_contact_phone ?? '—'} />
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-subtle rounded-lg bg-primary-50/50 p-3">
          <FileText size={12} />
          <span>Patient data is stored locally within the clinic's VIITSA database.</span>
        </div>
      </div>
    </Modal>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-sm text-ink">{value}</p>
    </div>
  );
}
