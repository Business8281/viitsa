import { useEffect, useState, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, MessageCircle, Calendar, CalendarPlus, Search, MapPin, Star, Clock, Navigation, SlidersHorizontal, X, Brain } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { usePatientAuth } from '../lib/patientAuth';
import { sendEmail } from '../lib/emailService';
import { formatTime, formatDate, whatsappAppointmentConfirmation, localDateISO } from '../lib/format';
import type { User, Clinic } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';
import type { TriageSummary } from '../lib/aiService';

type VisitTypeKey = 'new-visit' | 'follow-up' | 'report-discussion';
type BookStep = 'clinic' | 'doctor' | 'date' | 'slot' | 'confirm' | 'done';

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

function generateDates(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); d.setHours(0,0,0,0); return d;
  });
}

function generateSlots(open = '09:00', close = '19:00', dur = 20): string[] {
  const slots: string[] = [];
  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);
  for (let t = oh * 60 + om; t < ch * 60 + cm; t += dur) {
    slots.push(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`);
  }
  return slots;
}

interface Props { onTab: (t: PatientTab) => void; clinic: Clinic | null; patientId: string | null; aiSummary?: TriageSummary | null; }

export function PatientBooking({ onTab, clinic: initialClinic, patientId, aiSummary }: Props) {
  const { account } = usePatientAuth();
  const [step, setStep] = useState<BookStep>(initialClinic ? 'doctor' : 'clinic');
  const [clinic, setClinic] = useState<Clinic | null>(initialClinic);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState<User | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [takenSlots, setTakenSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [visitType, setVisitType] = useState<VisitTypeKey>('new-visit');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Clinic search state
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [filtered, setFiltered] = useState<Clinic[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('nearest');
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [loadingClinics, setLoadingClinics] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dates = generateDates(7);
  const slots = generateSlots(
    clinic?.working_hours?.open ?? '09:00',
    clinic?.working_hours?.close ?? '19:00',
    20
  );

  // Pre-fill reason from AI summary
  useEffect(() => {
    if (aiSummary?.chief_complaint && !reason) {
      setReason(aiSummary.chief_complaint);
    }
  }, [aiSummary]);

  // Load clinics when entering clinic step
  useEffect(() => {
    if (step === 'clinic' && clinics.length === 0) {
      setLoadingClinics(true);
      getDocs(collection(db, 'clinics'))
        .then((snap) => {
          setLoadingClinics(false);
          const data = snap.docs.map(d => d.data() as Clinic);
          setClinics(data);
          setFiltered(data);
        })
        .catch(() => {
          setLoadingClinics(false);
        });
    }
  }, [step, clinics.length]);

  // Filter and sort clinics
  useEffect(() => {
    let results = [...clinics];
    if (selectedDept) {
      results = results.filter(c => {
        const depts = c.departments || [];
        return depts.some(d => d.toLowerCase().includes(selectedDept.toLowerCase()));
      });
    }
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
    if (sort === 'rating') {
      results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sort === 'available') {
      const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
      results = results.filter(c => {
        const days = c.working_hours?.days || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days.includes(today);
      });
    }
    setFiltered(results);
  }, [clinics, search, selectedDept, sort]);

  const handleNearMe = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSort('nearest');
      },
      () => {}
    );
  };

  // Load doctors when clinic is selected
    if (!clinic) return;
    const q = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id), where('role', '==', 'doctor'), where('active', '==', true));
    getDocs(q).then((snap) => setDoctors(snap.docs.map(d => d.data() as User)));
  }, [clinic]);

  // Load taken slots
    if (!selectedDoctor || !clinic) return;
    const iso = localDateISO(selectedDate);
    const q = query(collection(db, 'appointments'), where('doctor_id', '==', selectedDoctor.user_id), where('date', '==', iso));
    getDocs(q).then((snap) => {
      const data = snap.docs.map(d => d.data());
      setTakenSlots(data.filter(r => r.status !== 'cancelled').map(r => r.time_slot));
    });
  }, [selectedDoctor, selectedDate, clinic]);

  const selectClinic = (c: Clinic) => {
    setClinic(c);
    setStep('doctor');
  };

  const confirmBooking = async () => {
    setBookingError('');
    if (!clinic || !selectedDoctor || !selectedSlot || !patientId) return;
    setSaving(true);
    const iso = localDateISO(selectedDate);
    
    try {
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinic.clinic_id), where('date', '==', iso), orderBy('token_number', 'desc'), limit(1));
      const snap = await getDocs(q);
      const existing = snap.docs.map(d => d.data());
      const nextToken = (existing?.[0]?.token_number ?? 0) + 1;
      
      // Check for duplicate slot
      const dupQ = query(collection(db, 'appointments'), where('doctor_id', '==', selectedDoctor.user_id), where('date', '==', iso), where('time_slot', '==', selectedSlot));
      const dupSnap = await getDocs(dupQ);
      const dupData = dupSnap.docs.map(d => d.data()).filter(d => d.status !== 'cancelled');
      if (dupData.length > 0) {
        setSaving(false);
        setBookingError('This time slot was just booked by another patient. Please choose a different time.');
        return;
      }
      
      const apptRef = await addDoc(collection(db, 'appointments'), {
        clinic_id: clinic.clinic_id,
        patient_id: patientId,
        doctor_id: selectedDoctor.user_id,
        date: iso,
        time_slot: selectedSlot,
        type: 'scheduled',
        status: 'waiting',
        reason: reason || null,
        triage_level: aiSummary?.level?.toLowerCase() ?? 'normal',
        token_number: nextToken,
        booked_via: 'patient',
        visit_type: visitType,
        online_booking: true,
        ai_summary: aiSummary ?? null,
      });
      // also update the id to match firestore structure
      await updateDoc(apptRef, { appt_id: apptRef.id });

      setSaving(false);

      // Send confirmation email if patient has an email on file
      if (account?.email) {
        sendEmail({
          to: account.email,
          template: "appointment_confirmed",
          data: {
            patientName: account.name ?? 'Patient',
            clinicName: clinic.name,
            doctorName: selectedDoctor.name,
            date: formatDate(selectedDate),
            time: formatTime(selectedSlot),
            token: String(nextToken),
          },
        });
      }

      setStep('done');
    } catch (error) {
      setSaving(false);
      setBookingError('Unable to book your appointment. Please try again or contact the clinic directly.');
    }
  };

  const goBack = () => {
    if (step === 'doctor') {
      if (initialClinic) onTab('home');
      else setStep('clinic');
    } else if (step === 'date') setStep('doctor');
    else if (step === 'slot') setStep('date');
    else if (step === 'confirm') setStep('slot');
    else if (step === 'clinic') onTab('home');
  };

  // Done screen
  if (step === 'done') return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center pt-20 px-5">
      <div className="h-20 w-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
        <Check size={36} className="text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 text-center">Appointment Confirmed!</h1>
      <p className="text-sm text-gray-500 text-center mt-1">Your booking has been saved successfully</p>
      <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5 w-full space-y-3 shadow-sm">
        <Row label="Clinic" value={clinic?.name ?? '—'} />
        <Row label="Doctor" value={selectedDoctor?.name ?? '—'} />
        <Row label="Specialisation" value={selectedDoctor?.specialisation ?? 'General Medicine'} />
        <Row label="Date" value={formatDate(selectedDate)} />
        <Row label="Time" value={formatTime(selectedSlot)} />
        <Row label="Visit type" value={visitType.replace('-', ' ')} />
        {reason && <Row label="Reason" value={reason} />}
      </div>
      <div className="w-full mt-4 space-y-2">
        <a href={whatsappAppointmentConfirmation(account?.name ?? 'Patient', clinic?.name ?? 'Clinic', formatDate(selectedDate), formatTime(selectedSlot), selectedDoctor?.name ?? 'Doctor')} target="_blank" rel="noopener noreferrer" className="w-full rounded-xl py-3 flex items-center justify-center gap-2 bg-green-500 text-white font-semibold text-sm">
          <MessageCircle size={16} /> Share on WhatsApp
        </a>
        <button onClick={() => {
          const title = encodeURIComponent(`Appointment with ${selectedDoctor?.name ?? 'Doctor'} at ${clinic?.name ?? 'Clinic'}`);
          const details = encodeURIComponent(`Visit type: ${visitType.replace('-', ' ')}${reason ? `\nReason: ${reason}` : ''}`);
          const startdt = new Date(selectedDate);
          const [h, m] = selectedSlot.split(':').map(Number);
          startdt.setHours(h, m, 0, 0);
          const enddt = new Date(startdt);
          enddt.setMinutes(enddt.getMinutes() + 30);
          const startISO = startdt.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
          const endISO = enddt.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
          window.open(`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startISO}/${endISO}&details=${details}`, '_blank');
        }} className="w-full rounded-xl py-3 flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 font-semibold text-sm">
          <CalendarPlus size={16} /> Add to Calendar
        </button>
        <button onClick={() => onTab('home')} className="w-full rounded-xl py-3 font-semibold text-sm text-white" style={{ backgroundColor: '#0F6E56' }}>
          Back to home
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      {/* Header */}
      <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={goBack} className="p-2 rounded-xl bg-white/10 text-white" aria-label="Go back">
          <ChevronLeft size={18} />
        </button>
        <div>
          <p className="text-sm font-bold text-white">Book Appointment</p>
          <p className="text-xs text-white/70 capitalize">{step === 'clinic' ? 'Choose clinic' : step === 'doctor' ? 'Choose doctor' : step}</p>
        </div>
      </div>

      {/* Step: clinic search */}
      {step === 'clinic' && (
        <>
          {/* Search header */}
          <div className="bg-primary px-4 pb-4 -mt-1">
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clinic, doctor, area, or department..."
                className="w-full rounded-xl bg-white border-0 pl-11 pr-10 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1" aria-label="Clear search">
                  <X size={16} className="text-gray-400" />
                </button>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleNearMe} className={`flex-1 rounded-xl py-2.5 px-3 flex items-center justify-center gap-2 text-sm font-semibold ${userLocation ? 'bg-white text-primary' : 'bg-white/20 text-white'}`}>
                <Navigation size={16} /> Near me
              </button>
              <button onClick={() => setShowSortPicker(!showSortPicker)} className="flex-1 rounded-xl bg-white/20 py-2.5 px-3 flex items-center justify-center gap-2 text-sm font-semibold text-white">
                <SlidersHorizontal size={16} />
                {sort === 'nearest' ? 'Nearest' : sort === 'rating' ? 'Top rated' : 'Available'}
              </button>
            </div>
          </div>

          {/* Sort picker */}
          {showSortPicker && (
            <div className="absolute top-[160px] right-4 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px]">
              {[
                { key: 'nearest' as SortOption, label: 'Nearest first' },
                { key: 'rating' as SortOption, label: 'Highest rated' },
                { key: 'available' as SortOption, label: 'Available today' },
              ].map(opt => (
                <button key={opt.key} onClick={() => { setSort(opt.key); setShowSortPicker(false); }} className={`w-full px-4 py-2.5 text-left text-sm ${sort === opt.key ? 'text-primary font-semibold bg-primary/5' : 'text-gray-700'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Department chips */}
          <div ref={scrollRef} className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
            <button onClick={() => setSelectedDept(null)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${selectedDept === null ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>All</button>
            {DEPARTMENTS.map(dept => (
              <button key={dept} onClick={() => setSelectedDept(dept)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${selectedDept === dept ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                {dept}
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="px-4 pb-2">
            <p className="text-xs text-gray-500">{filtered.length} clinic{filtered.length !== 1 ? 's' : ''} found</p>
          </div>

          <div className="px-4 space-y-3">
            {loadingClinics ? (
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
                <p className="text-xs text-gray-500 mt-1">Try adjusting your filters</p>
                <button onClick={() => { setSearch(''); setSelectedDept(null); }} className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>
                  Clear filters
                </button>
              </div>
            ) : (
              filtered.map(c => (
                <button key={c.clinic_id} onClick={() => selectClinic(c)} className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left shadow-sm transition-transform active:scale-[0.98]">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#0F6E56' }}>
                      <span className="text-white font-bold text-lg">{c.name?.charAt(0).toUpperCase() || 'C'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <MapPin size={12} />
                        <span className="truncate">{c.address || c.city}</span>
                      </div>
                    </div>
                    {c.rating && (
                      <div className="flex items-center gap-1 bg-yellow-50 rounded-full px-2 py-0.5">
                        <Star size={12} className="text-yellow-500 fill-yellow-500" />
                        <span className="text-xs font-semibold text-yellow-700">{c.rating}</span>
                      </div>
                    )}
                  </div>
                  {c.departments && c.departments.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {c.departments.slice(0, 4).map(dept => (
                        <span key={dept} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selectedDept === dept ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {dept}
                        </span>
                      ))}
                      {c.departments.length > 4 && <span className="text-[10px] px-2 py-0.5 text-gray-400">+{c.departments.length - 4}</span>}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock size={12} />
                    <span>{c.working_hours?.open || '09:00'} - {c.working_hours?.close || '19:00'}</span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{c.phone || 'Contact clinic'}</span>
                    <span className="text-xs font-semibold text-primary">View doctors →</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Step: doctor */}
      {step === 'doctor' && (
        <div className="px-4 py-5 space-y-3">
          {clinic && (
            <div className="bg-primary/5 rounded-xl px-3 py-2 mb-4">
              <p className="text-xs text-gray-500">Selected clinic</p>
              <p className="text-sm font-semibold text-gray-900">{clinic.name}</p>
            </div>
          )}
          <h2 className="text-lg font-bold text-gray-900">Choose your doctor</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-gray-500">No doctors available at this clinic.</p>
          ) : doctors.map(d => (
            <button key={d.user_id} onClick={() => { setSelectedDoctor(d); setStep('date'); }} className="w-full bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4 text-left shadow-sm">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0" style={{ backgroundColor: d.avatar_color ?? '#0F6E56' }}>
                {d.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{d.name}</p>
                <p className="text-xs text-gray-500">{d.specialisation ?? 'General Medicine'}</p>
                <div className="flex items-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(s => <span key={s} className="text-yellow-400 text-xs">★</span>)}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {/* Step: date */}
      {step === 'date' && (
        <div className="py-5 space-y-4">
          <div className="px-4"><h2 className="text-lg font-bold text-gray-900">Choose a date</h2></div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-1">
            {dates.map(d => {
              const active = d.toDateString() === selectedDate.toDateString();
              return (
                <button key={d.toISOString()} onClick={() => setSelectedDate(d)} className={`shrink-0 flex flex-col items-center rounded-2xl px-4 py-3 border-2 min-w-[72px] transition ${active ? 'border-primary bg-[#E1F5EE]' : 'border-gray-100 bg-white'}`}>
                  <span className={`text-[10px] uppercase font-semibold ${active ? 'text-primary' : 'text-gray-400'}`}>{d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                  <span className={`text-xl font-bold ${active ? 'text-primary' : 'text-gray-800'}`}>{d.getDate()}</span>
                  <span className={`text-[10px] ${active ? 'text-primary' : 'text-gray-400'}`}>{d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                </button>
              );
            })}
          </div>
          <div className="px-4">
            <button onClick={() => setStep('slot')} className="w-full rounded-xl py-4 text-base font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>Choose time →</button>
          </div>
        </div>
      )}

      {/* Step: slot */}
      {step === 'slot' && (
        <div className="px-4 py-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Choose a time slot</h2>
          <p className="text-sm text-gray-500">{formatDate(selectedDate)}</p>
          <div className="grid grid-cols-3 gap-2">
            {slots.map(s => {
              const taken = takenSlots.includes(s);
              const sel = selectedSlot === s;
              return (
                <button key={s} onClick={() => !taken && setSelectedSlot(s)} disabled={taken} className={`rounded-xl py-3 text-sm font-semibold transition border-2 ${sel ? 'border-primary bg-[#E1F5EE] text-primary' : taken ? 'border-gray-100 bg-gray-50 text-gray-300 line-through' : 'border-gray-200 bg-white text-gray-700 hover:border-primary/50'}`}>
                  {formatTime(s)}
                </button>
              );
            })}
          </div>
          {selectedSlot && (
            <button onClick={() => setStep('confirm')} className="w-full rounded-xl py-4 text-base font-semibold text-white" style={{ backgroundColor: '#0F6E56' }}>Continue →</button>
          )}
        </div>
      )}

      {/* Step: confirm */}
      {step === 'confirm' && (
        <div className="px-4 py-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Confirm booking</h2>
          {aiSummary && (
            <div className="flex items-center gap-2 bg-[#E1F5EE] rounded-xl px-3 py-2.5">
              <Brain size={16} className="text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-primary">AI Summary attached</p>
                <p className="text-xs text-green-700 truncate">{aiSummary.chief_complaint}</p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
            <Row label="Clinic" value={clinic?.name ?? '—'} />
            <Row label="Doctor" value={selectedDoctor?.name ?? '—'} />
            <Row label="Date" value={formatDate(selectedDate)} />
            <Row label="Time" value={formatTime(selectedSlot)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Visit type</label>
            <div className="grid grid-cols-3 gap-2">
              {([['new-visit','New Visit'],['follow-up','Follow-up'],['report-discussion','Report']] as [VisitTypeKey,string][]).map(([k,l]) => (
                <button key={k} onClick={() => setVisitType(k)} className={`rounded-xl border-2 py-2.5 text-xs font-semibold transition ${visitType === k ? 'border-primary bg-[#E1F5EE] text-primary' : 'border-gray-200 text-gray-600'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Reason (optional)</label>
            <input value={reason} onChange={e => setReason(e.target.value)} className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm focus:outline-none focus:border-primary" placeholder="e.g. routine check-up, fever, headache" />
          </div>
          <button onClick={confirmBooking} disabled={saving} className="w-full rounded-xl py-4 text-base font-semibold text-white disabled:opacity-50" style={{ backgroundColor: '#0F6E56' }}>
            {saving ? 'Booking…' : 'Confirm appointment'}
          </button>
          {bookingError && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl">
              {bookingError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900 capitalize">{value}</span>
    </div>
  );
}
