import { useEffect, useState } from 'react';
import {
  ChevronLeft, Plus, Users, Trash2, ChevronDown, ChevronUp,
  User, Calendar, Droplets, Heart, AlertTriangle, Pill, X, Check,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { usePatientAuth } from '../lib/patientAuth';
import type { PatientTab } from './PatientBottomNav';

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Guardian', 'Other'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const CHRONIC_OPTIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Thyroid', 'Kidney disease', 'None'];

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  current_medications: string | null;
}

interface Props { onTab: (t: PatientTab) => void; }

const emptyForm = {
  name: '', relationship: '', dob: '', gender: '',
  blood_group: '', conditions: ['None'] as string[],
  allergies: '', medications: '',
};

export function FamilyVault({ onTab }: Props) {
  const { account } = usePatientAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    if (!account) return;
    const { data } = await supabase
      .from('family_members')
      .select('*')
      .eq('patient_account_id', account.id)
      .order('name');
    setMembers((data as FamilyMember[] | null) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [account]);

  const toggleCondition = (c: string) => {
    if (c === 'None') { setForm(f => ({ ...f, conditions: ['None'] })); return; }
    setForm(f => {
      const without = f.conditions.filter(x => x !== 'None');
      return {
        ...f,
        conditions: without.includes(c) ? without.filter(x => x !== c) : [...without, c],
      };
    });
  };

  const save = async () => {
    if (!account || !form.name.trim() || !form.relationship) {
      setError('Name and relationship are required'); return;
    }
    setSaving(true); setError('');
    const { error: err } = await supabase.from('family_members').insert({
      patient_account_id: account.id,
      name: form.name.trim(),
      relationship: form.relationship,
      dob: form.dob || null,
      gender: form.gender || null,
      blood_group: form.blood_group || null,
      chronic_conditions: form.conditions.includes('None') ? 'None' : form.conditions.join(', '),
      allergies: form.allergies.trim() || null,
      current_medications: form.medications.trim() || null,
    });
    setSaving(false);
    if (err) { setError('Unable to save family member. Please try again.'); return; }
    setForm({ ...emptyForm });
    setShowAdd(false);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from('family_members').delete().eq('id', id);
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const ageFromDob = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      <div className="bg-primary px-4 pt-12 pb-6">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => onTab('home')} aria-label="Back" className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <div className="flex-1">
            <p className="text-sm font-bold text-white">Family Health Vault</p>
            <p className="text-xs text-white/60">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setShowAdd(true); setError(''); }}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 text-white text-xs font-semibold px-3 py-2"
          >
            <Plus size={14} /> Add Member
          </button>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-3">
        {loading && [1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-100 h-20 animate-pulse" />
        ))}

        {!loading && members.length === 0 && !showAdd && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Users size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No family members yet</p>
            <p className="text-xs text-gray-400 mt-1">Add family members to track their health</p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-4 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
              style={{ backgroundColor: '#0F6E56' }}
            >
              Add First Member
            </button>
          </div>
        )}

        {members.map(m => {
          const age = ageFromDob(m.dob);
          const isOpen = expanded === m.id;
          return (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : m.id)}
              >
                <div className="h-10 w-10 rounded-xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{m.name}</p>
                  <p className="text-xs text-gray-500">
                    {m.relationship}{age ? ` · ${age} yrs` : ''}{m.blood_group ? ` · ${m.blood_group}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); remove(m.id); }}
                    aria-label={`Remove ${m.name}`}
                    className="p-1.5 rounded-lg text-red-400 hover:bg-red-50"
                  >
                    <Trash2 size={14} />
                  </button>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>
              {isOpen && (
                <div className="border-t border-gray-50 px-4 py-3 space-y-2">
                  {m.dob && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar size={13} className="text-gray-400" />
                      <span>Born: {new Date(m.dob).toLocaleDateString('en-IN')}</span>
                    </div>
                  )}
                  {m.blood_group && (
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Droplets size={13} className="text-gray-400" />
                      <span>Blood Group: {m.blood_group}</span>
                    </div>
                  )}
                  {m.chronic_conditions && m.chronic_conditions !== 'None' && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <Heart size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <span>Conditions: {m.chronic_conditions}</span>
                    </div>
                  )}
                  {m.allergies && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <AlertTriangle size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <span>Allergies: {m.allergies}</span>
                    </div>
                  )}
                  {m.current_medications && (
                    <div className="flex items-start gap-2 text-xs text-gray-600">
                      <Pill size={13} className="text-gray-400 mt-0.5 shrink-0" />
                      <span>Medications: {m.current_medications}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Add member form */}
        {showAdd && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">Add Family Member</p>
              <button onClick={() => { setShowAdd(false); setError(''); setForm({ ...emptyForm }); }} aria-label="Close">
                <X size={16} className="text-gray-400" />
              </button>
            </div>
            <div className="px-4 py-4 space-y-3">
              {error && <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Full Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Member name"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Relationship *</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {RELATIONSHIPS.map(r => (
                    <button key={r} onClick={() => setForm(f => ({ ...f, relationship: r }))}
                      className={`rounded-xl border-2 py-2 text-xs font-semibold transition ${form.relationship === r ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob}
                    onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                    max={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Gender</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Male', 'Female', 'Other'] as const).map(g => (
                      <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
                        className={`rounded-xl border-2 py-2 text-xs font-semibold transition ${form.gender === g ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                        {g === 'Other' ? 'Oth' : g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Blood Group</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {BLOOD_GROUPS.map(b => (
                    <button key={b} onClick={() => setForm(f => ({ ...f, blood_group: b }))}
                      className={`rounded-xl border-2 py-1.5 text-xs font-semibold transition ${form.blood_group === b ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-500'}`}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Medical Conditions</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHRONIC_OPTIONS.map(c => {
                    const active = form.conditions.includes(c);
                    return (
                      <button key={c} onClick={() => toggleCondition(c)}
                        className={`flex items-center gap-1.5 rounded-xl border-2 px-2.5 py-2 text-xs font-medium transition ${active ? 'border-primary text-primary bg-[#E1F5EE]' : 'border-gray-200 text-gray-600'}`}>
                        {active && <Check size={11} className="shrink-0" />}
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Allergies</label>
                <input
                  value={form.allergies}
                  onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                  placeholder="e.g. Penicillin, Dust"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">Current Medications</label>
                <input
                  value={form.medications}
                  onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                  placeholder="comma separated"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: '#0F6E56' }}
              >
                {saving ? 'Saving…' : 'Save Member'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
