import { useEffect, useRef, useState } from 'react';
import { Save, Building2, Clock, Stethoscope, Users, Bell, Plus, AlertCircle, RefreshCw, QrCode, Link2, Share2 } from 'lucide-react';
import { db, firebaseConfig } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, orderBy, getDoc } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { Modal } from '../components/Modal';
import { Loading, SectionHeader, Avatar } from '../components/ui';
import type { ClinicSettings, User, Role } from '../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type Tab = 'profile' | 'hours' | 'doctors' | 'staff' | 'notifications' | 'patient-access';

export function SettingsScreen() {
  const { clinic, logout } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('profile');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [clinicEmail, setClinicEmail] = useState('');
  const [openHours, setOpenHours] = useState('09:00');
  const [closeHours, setCloseHours] = useState('19:00');
  const [workingDays, setWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [slotDuration, setSlotDuration] = useState(20);
  const [upiId, setUpiId] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  useEffect(() => {
    if (!clinic) return;
    setClinicName(clinic.name);
    setClinicAddress(clinic.address ?? '');
    setClinicPhone(clinic.phone ?? '');
    setClinicEmail(clinic.email ?? '');
    if (clinic.working_hours) {
      setOpenHours(clinic.working_hours.open ?? '09:00');
      setCloseHours(clinic.working_hours.close ?? '19:00');
      setWorkingDays(clinic.working_hours.days ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    }
    const fetchSettingsAndUsers = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'clinic_settings', clinic.clinic_id));
        const settingsData = settingsSnap.exists() ? settingsSnap.data() as ClinicSettings : null;
        setSettings(settingsData);
        if (settingsData) {
          setSlotDuration(settingsData.slot_duration_minutes);
          setUpiId((settingsData as any).upi_id ?? '');
        }

        const usersQ = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id), orderBy('role'));
        const usersSnap = await getDocs(usersQ);
        setUsers(usersSnap.docs.map(d => d.data() as User));
      } catch(e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettingsAndUsers();
  }, [clinic]);

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'clinics', clinic!.clinic_id), { name: clinicName, address: clinicAddress, phone: clinicPhone, email: clinicEmail });
      toast('Clinic profile updated.', 'success');
    } catch(error) {
      toast('Unable to update clinic profile. Please try again.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const saveHours = async () => {
    setSavingHours(true);
    const wh = { open: openHours, close: closeHours, days: workingDays };
    try {
      await updateDoc(doc(db, 'clinics', clinic!.clinic_id), { working_hours: wh });
      const upsertData = { clinic_id: clinic!.clinic_id, setting_id: clinic!.clinic_id, slot_duration_minutes: slotDuration, upi_id: upiId || null };
      await setDoc(doc(db, 'clinic_settings', clinic!.clinic_id), upsertData, { merge: true });
      setSettings(prev => prev ? { ...prev, ...upsertData } : upsertData as any);
      toast('Working hours & slots updated.', 'success');
    } catch (e) {
      toast('Unable to save configuration.', 'error');
    } finally {
      setSavingHours(false);
    }
  };

  const toggleDay = (d: string) => setWorkingDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const toggleReminder = async (key: 'whatsapp_reminders_enabled' | 'sms_reminders_enabled', val: boolean) => {
    if (!settings) return;
    try {
      await updateDoc(doc(db, 'clinic_settings', clinic!.clinic_id), { [key]: val });
      setSettings({ ...settings, [key]: val });
      toast(`${key === 'whatsapp_reminders_enabled' ? 'WhatsApp' : 'SMS'} reminders ${val ? 'enabled' : 'disabled'}.`, 'success');
    } catch(e) {
      toast('Unable to update settings. Please try again.', 'error');
    }
  };

  const addUser = async (data: { name: string; email: string; role: Role; phone: string; specialisation: string; password: string }) => {
    try {
      // create user with secondary app to avoid logging out the current user
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email.toLowerCase(), data.password);
      
      const userId = userCredential.user.uid;
      const newUser = {
        user_id: userId,
        clinic_id: clinic!.clinic_id, name: data.name, email: data.email.toLowerCase(),
        role: data.role, phone: data.phone || null,
        specialisation: data.specialisation || null, active: true,
        avatar_color: data.role === 'doctor' ? '#05C994' : data.role === 'staff' ? '#E08600' : '#0F6E56',
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', userId), newUser);
      
      await secondaryAuth.signOut();
      
      toast(`${data.name} added.`, 'success');
      setAddUserOpen(false);
      setUsers(prev => [...prev, newUser as User].sort((a,b) => a.role.localeCompare(b.role)));
    } catch (e) {
      toast('Unable to add this user. Please try again.', 'error');
    }
  };

  const resetPassword = async (u: User) => {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, u.email);
      toast('Password reset email sent.', 'success');
    } catch (e) {
      toast('Unable to send reset email. Please try again.', 'error');
    }
  };

  const toggleActive = async (u: User) => {
    try {
      await updateDoc(doc(db, 'users', u.user_id), { active: !u.active });
      setUsers(users.map(x => x.user_id === u.user_id ? { ...x, active: !x.active } : x));
      toast(`${u.name} ${u.active ? 'deactivated' : 'activated'}.`, 'success');
    } catch(e) {
      toast('Unable to update user status. Please try again.', 'error');
    }
  };

  if (loading || !clinic) return <Loading label="Loading settings…" />;

  const tabs: { key: Tab; label: string; Icon: any }[] = [
    { key: 'profile', label: 'Clinic profile', Icon: Building2 },
    { key: 'hours', label: 'Working hours', Icon: Clock },
    { key: 'doctors', label: 'Doctors', Icon: Stethoscope },
    { key: 'staff', label: 'Staff', Icon: Users },
    { key: 'notifications', label: 'Notifications', Icon: Bell },
    { key: 'patient-access', label: 'Patient Access', Icon: QrCode },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink">Settings</h1>
        <p className="text-sm text-ink-muted">Manage clinic profile, staff, and configuration</p>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-primary-50/60 p-0.5 overflow-x-auto">
        {tabs.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card max-w-2xl space-y-3">
          <SectionHeader title="Clinic profile" subtitle="Basic clinic information shown across the app" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Clinic name</label><input className="input" value={clinicName} onChange={e => setClinicName(e.target.value)} /></div>
            <div><label className="label">Phone</label><input className="input" value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} /></div>
          </div>
          <div><label className="label">Address</label><input className="input" value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} /></div>
          <div><label className="label">Email</label><input className="input" value={clinicEmail} onChange={e => setClinicEmail(e.target.value)} /></div>
          <div>
            <label className="label">Logo</label>
            <div className="rounded-lg border-2 border-dashed border-ink-subtle/30 px-4 py-6 text-center text-xs text-ink-subtle">Drag & drop or click to upload (illustrative in MVP)</div>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary"><Save size={14} /> {savingProfile ? 'Saving…' : 'Save profile'}</button>
            <button onClick={logout} className="btn-ghost text-danger">Sign out</button>
          </div>
        </div>
      )}

      {tab === 'hours' && (
        <div className="card max-w-2xl space-y-5">
          <SectionHeader title="Working hours & slots" subtitle="Set open/close time, days, and appointment slot duration" />
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Opens</label><input type="time" className="input" value={openHours} onChange={e => setOpenHours(e.target.value)} /></div>
            <div><label className="label">Closes</label><input type="time" className="input" value={closeHours} onChange={e => setCloseHours(e.target.value)} /></div>
          </div>
          <div>
            <label className="label">Working days</label>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => {
                const active = workingDays.includes(d);
                return (
                  <button key={d} onClick={() => toggleDay(d)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${active ? 'bg-primary border-primary text-white' : 'border-ink-subtle/30 text-ink-muted hover:border-primary/50'}`}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="label">Appointment slot duration</label>
            <div className="flex items-center gap-2">
              {[15, 20, 30].map(d => (
                <button key={d} onClick={() => setSlotDuration(d)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${slotDuration === d ? 'bg-primary border-primary text-white' : 'border-ink-subtle/30 text-ink-muted hover:border-primary/50'}`}>
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Clinic UPI ID (for invoices)</label>
            <input className="input" value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="clinic@upi" />
          </div>
          <button onClick={saveHours} disabled={savingHours} className="btn-primary"><Save size={14} /> {savingHours ? 'Saving…' : 'Save configuration'}</button>
        </div>
      )}

      {(tab === 'doctors' || tab === 'staff') && (
        <UserManagement tab={tab} users={users} onAdd={() => setAddUserOpen(true)} onReset={resetPassword} onToggle={toggleActive} />
      )}

      {tab === 'notifications' && settings && (
        <div className="card max-w-2xl space-y-4">
          <SectionHeader title="Notification settings" subtitle="Configure patient reminders" />
          <ToggleRow title="WhatsApp reminders" description="Send WhatsApp appointment reminders to patients when clicking the Remind button." checked={settings.whatsapp_reminders_enabled} onChange={v => toggleReminder('whatsapp_reminders_enabled', v)} />
          <ToggleRow title="SMS reminders (future)" description="SMS gateway integration is on the roadmap. Toggle is for future use only." checked={settings.sms_reminders_enabled} onChange={v => toggleReminder('sms_reminders_enabled', v)} />
          <div className="flex items-start gap-2 text-xs text-ink-subtle rounded-lg bg-primary-50/50 p-3 mt-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>Reminders open WhatsApp web with a pre-filled message — no API key required for MVP.</span>
          </div>
        </div>
      )}

      {tab === 'patient-access' && (
        <PatientAccessTab clinicId={clinic.clinic_id} clinicName={clinic.name} clinicPhone={clinic.phone} />
      )}

      <AddUserModal open={addUserOpen} onClose={() => setAddUserOpen(false)} onSaved={addUser} />
    </div>
  );
}

function PatientAccessTab({ clinicId, clinicName, clinicPhone }: { clinicId: string; clinicName: string; clinicPhone: string }) {
  const { toast } = useToast();
  const patientLink = `${window.location.origin}/patient?clinic=${clinicId}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(patientLink)}`;
  const canvasRef = useRef<HTMLImageElement>(null);

  const copy = () => {
    navigator.clipboard.writeText(patientLink).then(() => toast('Link copied!', 'success'));
  };

  const shareWA = () => {
    const msg = `Book your appointment at ${clinicName} using this link: ${patientLink}\n\nPowered by VIITSA`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
  };

  const downloadQR = () => {
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${clinicName.replace(/\s/g,'-')}-patient-qr.png`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="card max-w-2xl space-y-5">
      <SectionHeader title="Patient access" subtitle="Give patients a direct link to book appointments at your clinic" />

      <div className="flex items-start gap-4 flex-col sm:flex-row">
        <div className="rounded-xl border border-primary-100 p-3 bg-white shadow-card shrink-0">
          <img ref={canvasRef} src={qrUrl} alt="Patient QR code" className="w-48 h-48" />
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <label className="label">Patient booking link</label>
            <div className="flex items-center gap-2">
              <input readOnly className="input text-xs font-mono flex-1" value={patientLink} />
              <button onClick={copy} className="btn-secondary shrink-0">
                <Link2 size={14} /> Copy
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1">Share this link or QR code — patients open it to book appointments.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={downloadQR} className="btn-outline">
              <QrCode size={14} /> Download QR (PNG)
            </button>
            <button onClick={shareWA} className="btn-secondary">
              <Share2 size={14} /> Share on WhatsApp
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-primary-50/60 p-4 text-sm space-y-1.5">
        <p className="font-semibold text-primary">How it works</p>
        <ul className="text-xs text-ink-muted space-y-1">
          <li>• Patient scans QR code or opens the link on their phone</li>
          <li>• They enter their mobile number and verify with OTP (OTP via SMS)</li>
          <li>• They see your clinic's doctors and available slots</li>
          <li>• Booking appears instantly on your clinic dashboard</li>
        </ul>
      </div>
    </div>
  );
}

function UserManagement({ tab, users, onAdd, onReset, onToggle }: { tab: 'doctors' | 'staff'; users: User[]; onAdd: () => void; onReset: (u: User) => void; onToggle: (u: User) => void }) {
  const filtered = users.filter(u => tab === 'doctors' ? u.role === 'doctor' : u.role === 'staff' || u.role === 'admin');
  return (
    <div className="card space-y-3">
      <SectionHeader
        title={tab === 'doctors' ? 'Doctor management' : 'Staff management'}
        subtitle={tab === 'doctors' ? 'Add doctors and assign specialisation' : 'Add staff and manage access'}
        action={<button onClick={onAdd} className="btn-primary"><Plus size={14} /> Add {tab === 'doctors' ? 'doctor' : 'staff'}</button>}
      />
      {filtered.length === 0 ? <p className="text-sm text-ink-subtle">No {tab} yet.</p> : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.user_id} className="flex items-center gap-3 rounded-lg border border-black/5 p-3">
              <Avatar name={u.name} color={u.avatar_color} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{u.name}</p>
                <p className="text-xs text-ink-muted truncate">{u.email} · {u.specialisation ?? u.role}</p>
              </div>
              <span className={`badge ${u.active ? 'badge-done' : 'badge-cancelled'} text-[10px]`}>{u.active ? 'Active' : 'Inactive'}</span>
              <button onClick={() => onReset(u)} className="btn-ghost p-1.5 text-ink-muted" title="Reset password"><RefreshCw size={13} /></button>
              <button onClick={() => onToggle(u)} className="btn-ghost p-1.5 text-ink-muted text-xs">{u.active ? 'Deactivate' : 'Activate'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ title, description, checked, onChange }: { title: string; description: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-black/5 p-3">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-muted">{description}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-primary' : 'bg-ink-subtle/30'}`}
        role="switch" aria-checked={checked}>
        <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function AddUserModal({ open, onClose, onSaved }: {
  open: boolean;
  onClose: () => void;
  onSaved: (d: { name: string; email: string; role: Role; phone: string; specialisation: string; password: string }) => void;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('doctor');
  const [phone, setPhone] = useState('');
  const [spec, setSpec] = useState('');
  const [pw, setPw] = useState('');

  const submit = () => {
    if (!name.trim() || !email.trim()) return;
    if (!pw.trim() || pw.length < 8) return;
    onSaved({ name: name.trim(), email: email.trim(), role, phone: phone.trim(), specialisation: spec.trim(), password: pw });
    setName(''); setEmail(''); setSpec(''); setPhone(''); setPw('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add new user" subtitle="Create a new doctor or staff account" size="md"
      footer={<><button onClick={onClose} className="btn-ghost">Cancel</button><button onClick={submit} className="btn-primary"><Plus size={14} /> Add user</button></>}
    >
      <div className="space-y-3">
        <div><label className="label">Full name *</label><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Dr. Priya Rao" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Email *</label><input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><label className="label">Phone</label><input className="input" value={phone} onChange={e => setPhone(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Role</label>
            <select className="select" value={role} onChange={e => setRole(e.target.value as Role)}>
              <option value="doctor">Doctor</option>
              <option value="staff">Receptionist / Staff</option>
              <option value="admin">Clinic Admin</option>
            </select>
          </div>
          <div><label className="label">Specialisation</label><input className="input" value={spec} onChange={e => setSpec(e.target.value)} placeholder="General Medicine" /></div>
        </div>
        <div><label className="label">Initial password *</label><input type="password" className="input" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 8 characters" /></div>
      </div>
    </Modal>
  );
}
