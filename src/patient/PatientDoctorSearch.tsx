import { useEffect, useState } from 'react';
import {
  ChevronLeft, Search, Star, MapPin, X, Stethoscope, Calendar, SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PatientTab } from './PatientBottomNav';
import type { User, Clinic } from '../lib/types';

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Orthopaedics', 'Dermatology',
  'Gynaecology', 'Paediatrics', 'ENT', 'Ophthalmology',
  'Neurology', 'Dentistry', 'Diabetology', 'Psychiatry',
];

interface DoctorWithClinic extends User {
  clinic?: Clinic;
}

interface Props {
  onTab: (t: PatientTab) => void;
  onSelectDoctor?: (clinic: Clinic, doctor: User) => void;
}

export function PatientDoctorSearch({ onTab, onSelectDoctor }: Props) {
  const [doctors, setDoctors] = useState<DoctorWithClinic[]>([]);
  const [filtered, setFiltered] = useState<DoctorWithClinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSpec, setSelectedSpec] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('users')
      .select('*, clinic:clinics(clinic_id, name, address, city, phone, working_hours)')
      .eq('role', 'doctor')
      .eq('active', true)
      .then(({ data }) => {
        setDoctors((data as DoctorWithClinic[] | null) ?? []);
        setFiltered((data as DoctorWithClinic[] | null) ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    let results = [...doctors];
    if (selectedSpec) {
      results = results.filter(d =>
        d.specialisation?.toLowerCase().includes(selectedSpec.toLowerCase())
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.specialisation?.toLowerCase().includes(q) ||
        (d.clinic as Clinic | undefined)?.name?.toLowerCase().includes(q) ||
        (d.clinic as Clinic | undefined)?.city?.toLowerCase().includes(q)
      );
    }
    setFiltered(results);
  }, [doctors, search, selectedSpec]);

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28">
      {/* Header with search */}
      <div className="bg-primary px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <div>
            <p className="text-sm font-bold text-white">Find Doctors</p>
            <p className="text-xs text-white/60">{filtered.length} doctors available</p>
          </div>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, specialty, or clinic…"
            className="w-full rounded-xl bg-white border-0 pl-11 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Specialty chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        <button onClick={() => setSelectedSpec(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${selectedSpec === null ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
          All
        </button>
        {SPECIALTIES.map(s => (
          <button key={s} onClick={() => setSelectedSpec(s)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition whitespace-nowrap ${selectedSpec === s ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 h-24 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Stethoscope size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No doctors found</p>
            <p className="text-xs text-gray-400 mt-1">Try a different specialty or search term</p>
            <button onClick={() => { setSearch(''); setSelectedSpec(null); }}
              className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#0F6E56' }}>
              Clear filters
            </button>
          </div>
        )}

        {!loading && filtered.map(d => {
          const clinic = d.clinic as Clinic | undefined;
          return (
            <div key={d.user_id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div
                  className="h-13 w-13 h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-base shrink-0"
                  style={{ backgroundColor: d.avatar_color ?? '#0F6E56' }}
                >
                  {d.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-500">{d.specialisation ?? 'General Medicine'}</p>
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={11} className="text-yellow-400 fill-yellow-400" />
                    ))}
                    <span className="text-xs text-gray-400 ml-1">({Math.floor(Math.random() * 50) + 10})</span>
                  </div>
                </div>
              </div>
              {clinic && (
                <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-xl px-3 py-2">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700 truncate">{clinic.name}</p>
                    <p className="text-xs text-gray-400 truncate">{clinic.address || clinic.city}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => {
                  if (clinic && onSelectDoctor) onSelectDoctor(clinic, d);
                  else onTab('book');
                }}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0F6E56' }}
              >
                <Calendar size={14} /> Book Appointment
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
