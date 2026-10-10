import { useEffect, useState, useMemo } from 'react';
import {
  ChevronLeft, Search, Star, MapPin, X, Stethoscope, Calendar, Map as MapIcon, List
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { PatientTab } from './PatientBottomNav';
import type { User, Clinic } from '../lib/types';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

// Fix Leaflet's default icon path issues with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const SPECIALTIES = [
  'General Medicine', 'Cardiology', 'Orthopaedics', 'Dermatology',
  'Gynaecology', 'Paediatrics', 'ENT', 'Ophthalmology',
  'Neurology', 'Dentistry', 'Diabetology', 'Psychiatry',
];

interface DoctorWithClinic extends User {
  clinic?: Clinic;
  lat?: number;
  lng?: number;
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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  useEffect(() => {
    const fetchData = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'clinic_doctor'), where('active', '==', true));
      const [usersSnap, clinicsSnap] = await Promise.all([
        getDocs(q),
        getDocs(collection(db, 'clinics'))
      ]);

      const clinicsMap = new Map(clinicsSnap.docs.map(d => [d.id, d.data() as Clinic]));
      
      const docs = usersSnap.docs.map((d, i) => {
        const u = d.data() as User;
        const c = u.clinic_id ? clinicsMap.get(u.clinic_id) : undefined;
        // Generate pseudo-coordinates around a center (India/Delhi) if clinic has none, just for demo
        const baseLat = 28.6139;
        const baseLng = 77.2090;
        return {
          ...u,
          user_id: d.id,
          clinic: c,
          lat: baseLat + (Math.random() - 0.5) * 0.1, // mock spread
          lng: baseLng + (Math.random() - 0.5) * 0.1, // mock spread
        } as DoctorWithClinic;
      });

      setDoctors(docs);
      setFiltered(docs);
      setLoading(false);
    };
    fetchData();
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

  const defaultCenter: [number, number] = [28.6139, 77.2090]; // Delhi, India

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-28 flex flex-col">
      {/* Header with search */}
      <div className="bg-primary px-4 pt-12 pb-4 shrink-0 shadow-sm z-20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => onTab('home')} className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition">
              <ChevronLeft size={18} />
            </button>
            <div>
              <p className="text-sm font-bold text-white">Find Doctors</p>
              <p className="text-xs text-white/80">{filtered.length} doctors nearby</p>
            </div>
          </div>
          <div className="bg-white/10 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'list' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white'}`}
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-lg transition ${viewMode === 'map' ? 'bg-white text-primary shadow-sm' : 'text-white/70 hover:text-white'}`}
            >
              <MapIcon size={16} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, specialty, or clinic…"
            className="w-full rounded-xl bg-white border-0 pl-11 pr-10 py-3.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50 shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-slate-100 hover:bg-slate-200 transition">
              <X size={14} className="text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Specialty chips */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide shrink-0 bg-white border-b border-slate-100 z-10 shadow-sm">
        <button onClick={() => setSelectedSpec(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${selectedSpec === null ? 'bg-primary text-white shadow-md' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
          All
        </button>
        {SPECIALTIES.map(s => (
          <button key={s} onClick={() => setSelectedSpec(s)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition whitespace-nowrap ${selectedSpec === s ? 'bg-primary text-white shadow-md' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Map View */}
      {viewMode === 'map' && !loading && (
        <div className="flex-1 relative z-0">
          <MapContainer 
            center={defaultCenter} 
            zoom={12} 
            className="w-full h-full absolute inset-0"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(d => d.lat && d.lng && (
              <Marker key={d.user_id} position={[d.lat, d.lng]}>
                <Popup className="custom-popup rounded-xl">
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: d.avatar_color ?? '#0F6E56' }}>
                        {d.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900 m-0 leading-tight">{d.name}</p>
                        <p className="text-xs font-medium text-slate-500 m-0 mt-0.5">{d.specialisation ?? 'General Medicine'}</p>
                      </div>
                    </div>
                    {d.clinic && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        <MapPin size={12} className="text-primary" />
                        <span className="font-semibold truncate">{d.clinic.name}</span>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        if (d.clinic && onSelectDoctor) onSelectDoctor(d.clinic, d);
                        else onTab('book');
                      }}
                      className="w-full bg-primary hover:bg-primary/90 text-white font-bold rounded-lg py-2 text-xs flex items-center justify-center gap-1.5 transition"
                    >
                      <Calendar size={12} /> Book Now
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="px-4 py-4 space-y-3 overflow-y-auto flex-1">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-slate-100 h-28 animate-pulse shadow-sm" />
              ))}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center shadow-sm mt-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Stethoscope size={28} className="text-slate-300" />
              </div>
              <p className="text-base font-extrabold text-slate-900 mb-1">No doctors found</p>
              <p className="text-sm text-slate-500 mb-6">Try adjusting your filters or searching a different area.</p>
              <button onClick={() => { setSearch(''); setSelectedSpec(null); }}
                className="rounded-xl px-5 py-2.5 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 transition shadow-md">
                Clear all filters
              </button>
            </div>
          )}

          {!loading && filtered.map(d => {
            const clinic = d.clinic as Clinic | undefined;
            return (
              <div key={d.user_id} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition">
                <div className="flex items-start gap-3.5 mb-3">
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner"
                    style={{ backgroundColor: d.avatar_color ?? '#0F6E56' }}
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <p className="text-sm font-extrabold text-slate-900 truncate">{d.name}</p>
                    <p className="text-xs font-semibold text-primary/90 mt-0.5">{d.specialisation ?? 'General Medicine'}</p>
                    <div className="flex items-center gap-0.5 mt-1.5">
                      {[1, 2, 3, 4].map(s => (
                        <Star key={s} size={12} className="text-amber-400 fill-amber-400" />
                      ))}
                      <Star size={12} className="text-slate-200 fill-slate-200" />
                      <span className="text-xs font-bold text-slate-400 ml-1.5">4.8</span>
                    </div>
                  </div>
                </div>
                {clinic && (
                  <div className="flex items-center gap-2 mb-4 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-100">
                    <div className="w-6 h-6 bg-white rounded-full shadow-sm flex items-center justify-center shrink-0">
                      <MapPin size={12} className="text-slate-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{clinic.name}</p>
                      <p className="text-[11px] font-medium text-slate-400 truncate">{clinic.address || clinic.city}</p>
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (clinic && onSelectDoctor) onSelectDoctor(clinic, d);
                    else onTab('book');
                  }}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 active:scale-[0.99] transition shadow-md shadow-primary/20"
                >
                  <Calendar size={16} /> Book Appointment
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
