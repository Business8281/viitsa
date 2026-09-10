import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, Search, MapPin, Star, Clock, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { Clinic } from '../lib/types';

const DEPARTMENTS = [
  'General Medicine',
  'Gynaecology',
  'Paediatrics',
  'Orthopaedics',
  'Dermatology',
  'Dentistry',
  'ENT',
  'Cardiology',
  'Ophthalmology',
  'Diabetology',
  'Neurology',
  'Psychiatry',
];

type SortOption = 'nearest' | 'rating' | 'available';

interface Props {
  onSelectClinic: (clinic: Clinic) => void;
  onBack: () => void;
}

export function ClinicSearch({ onSelectClinic, onBack }: Props) {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filtered, setFiltered] = useState<Clinic[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('nearest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load clinics from database
  useEffect(() => {
    getDocs(collection(db, 'clinics'))
      .then((snap) => {
        setLoading(false);
        const data = snap.docs.map(d => d.data() as Clinic);
        setClinics(data);
        setFiltered(data);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  // Filter and sort clinics
  useEffect(() => {
    let results = [...clinics];

    // Filter by department
    if (selectedDept) {
      results = results.filter(c => {
        const depts = c.departments || [];
        return depts.some(d => d.toLowerCase().includes(selectedDept.toLowerCase()));
      });
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      results = results.filter(c => {
        const name = c.name?.toLowerCase() || '';
        const address = c.address?.toLowerCase() || '';
        const city = c.city?.toLowerCase() || '';
        const depts = (c.departments || []).join(' ').toLowerCase();
        return name.includes(q) || address.includes(q) || city.includes(q) || depts.includes(q);
      });
    }

    // Sort
    if (sort === 'rating') {
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'available') {
      // Clinics open today - simple check
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      results = results.filter(c => {
        const days = c.working_hours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.includes(today);
      });
    }
    // 'nearest' would require actual distance calculation with GPS

    setFiltered(results);
  }, [clinics, search, selectedDept, sort]);

  // Get user location
  const handleNearMe = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        // In real app, would use this to sort by distance
        setSort('nearest');
      },
      (err) => {
        setLocationError('Unable to get location. Please enable GPS.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedDept(null);
  };

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} aria-label="Back" className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Find a Clinic</p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clinic, doctor, area, or department..."
            className="w-full rounded-xl bg-white border-0 pl-11 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          {search && (
            <button onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>

        {/* Near me and Sort buttons */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleNearMe}
            className={`flex-1 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-sm font-semibold ${
              userLocation ? 'bg-white text-primary' : 'bg-white/20 text-white'
            }`}
          >
            <Navigation size={16} />
            Near me
          </button>
          <button
            onClick={() => setShowSortPicker(!showSortPicker)}
            className="flex-1 rounded-xl bg-white/20 py-2.5 px-3 flex items-center justify-center gap-2 text-sm font-semibold text-white"
          >
            <SlidersHorizontal size={16} />
            {sort === 'nearest' ? 'Nearest' : sort === 'rating' ? 'Top rated' : 'Available'}
          </button>
        </div>

        {locationError && (
          <p className="text-xs text-red-200 mt-2 text-center">{locationError}</p>
        )}
      </div>

      {/* Sort picker dropdown */}
      {showSortPicker && (
        <div className="absolute top-[180px] right-4 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px]">
          {[
            { key: 'nearest' as SortOption, label: 'Nearest first' },
            { key: 'rating' as SortOption, label: 'Highest rated' },
            { key: 'available' as SortOption, label: 'Available today' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => { setSort(opt.key); setShowSortPicker(false); }}
              className={`w-full px-4 py-2.5 text-left text-sm ${
                sort === opt.key ? 'text-primary font-semibold bg-primary/5' : 'text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Department chips */}
      <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
        <button
          onClick={() => setSelectedDept(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
            selectedDept === null
              ? 'bg-primary text-white'
              : 'bg-white text-gray-600 border border-gray-200'
          }`}
        >
          All
        </button>
        {DEPARTMENTS.map(dept => (
          <button
            key={dept}
            onClick={() => setSelectedDept(dept)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
              selectedDept === dept
                ? 'bg-primary text-white'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Active filters indicator */}
      {(selectedDept || search) && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Filters:</span>
          {selectedDept && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {selectedDept}
              <button onClick={() => setSelectedDept(null)} aria-label="Remove department filter" className="hover:text-primary/70">
                <X size={12} />
              </button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
              "{search}"
              <button onClick={() => setSearch('')} aria-label="Clear search filter" className="hover:text-blue-500">
                <X size={12} />
              </button>
            </span>
          )}
          <button onClick={clearFilters} className="text-xs text-gray-400 underline ml-auto">
            Clear all
          </button>
        </div>
      )}

      {/* Results count */}
      <div className="px-4 pb-2">
        <p className="text-xs text-gray-500">{filtered.length} clinic{filtered.length !== 1 ? 's' : ''} found</p>
      </div>

      {/* Clinic list */}
      <div className="px-4 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                <div className="h-5 bg-gray-100 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-100 rounded-full w-20" />
                  <div className="h-6 bg-gray-100 rounded-full w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Search size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700">No clinics found</p>
            <p className="text-xs text-gray-500 mt-1">Try adjusting your filters or search</p>
            <button onClick={clearFilters} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map(clinic => (
            <button
              key={clinic.clinic_id}
              onClick={() => onSelectClinic(clinic)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
            >
              {/* Clinic header */}
              <div className="flex items-start gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#0F6E56' }}>
                  <span className="text-white font-bold text-lg">
                    {clinic.name?.charAt(0).toUpperCase() || 'C'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{clinic.name}</p>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                    <MapPin size={12} />
                    <span className="truncate">{clinic.address || clinic.city}</span>
                  </div>
                </div>
                {clinic.rating && (
                  <div className="flex items-center gap-1 bg-yellow-50 rounded-full px-2 py-0.5">
                    <Star size={12} className="text-yellow-500 fill-yellow-500" />
                    <span className="text-xs font-semibold text-yellow-700">{clinic.rating}</span>
                  </div>
                )}
              </div>

              {/* Department tags */}
              {clinic.departments && clinic.departments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {clinic.departments.slice(0, 4).map(dept => (
                    <span
                      key={dept}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        selectedDept === dept
                          ? 'bg-primary text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {dept}
                    </span>
                  ))}
                  {clinic.departments.length > 4 && (
                    <span className="text-[10px] px-2 py-0.5 text-gray-400">
                      +{clinic.departments.length - 4} more
                    </span>
                  )}
                </div>
              )}

              {/* Working hours */}
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Clock size={12} />
                <span>
                  {clinic.working_hours?.open || '09:00'} - {clinic.working_hours?.close || '19:00'}
                </span>
                <span className="text-gray-300">|</span>
                <span>
                  {clinic.working_hours?.days?.slice(0, 3).join(', ') || 'Mon-Fri'}
                </span>
              </div>

              {/* Contact */}
              <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                <span className="text-xs text-gray-400">{clinic.phone || 'Contact clinic'}</span>
                <span className="text-xs font-semibold text-primary">View doctors →</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
