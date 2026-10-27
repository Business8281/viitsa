import { useEffect, useState } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Check, UserCircle, Phone, Mail, FileText, User, Calendar } from 'lucide-react';
import type { Clinic, User as Doctor } from '../lib/types';
import { localDateISO, calculateAge, formatDobForInput } from '../lib/format';

export function QRWalkinPage() {
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [attendantName, setAttendantName] = useState('');
  const [reason, setReason] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  const handleDobChange = (newDob: string) => {
    const formatted = formatDobForInput(newDob);
    setDob(formatted);
    if (!newDob) return;
    const computed = calculateAge(newDob);
    if (computed !== null && computed >= 0 && computed < 130) {
      setAge(String(computed));
    }
  };

  const handleAgeChange = (newAge: string) => {
    const cleanAge = newAge.replace(/\D/g, '').slice(0, 3);
    setAge(cleanAge);
    const num = parseInt(cleanAge, 10);
    if (!dob && !isNaN(num) && num >= 0 && num <= 125) {
      const approxYear = new Date().getFullYear() - num;
      setDob(`${approxYear}-01-01`);
    }
  };
  
  const now = new Date();
  const [date, setDate] = useState(localDateISO(now));
  const [timeSlot, setTimeSlot] = useState(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{ token: string, doctorName: string, time: string, date: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clinicId = params.get('clinic');
    if (!clinicId) {
      setError('Invalid QR Code. Clinic ID is missing.');
      setLoading(false);
      return;
    }

    // Load Clinic
    getDoc(doc(db, 'clinics', clinicId)).then((snap) => {
      if (snap.exists()) {
        const cData = { ...snap.data(), clinic_id: snap.id } as Clinic;
        setClinic(cData);
        
        // Load Doctors for this clinic
        const q = query(collection(db, 'users'), where('clinic_id', '==', clinicId), where('active', '==', true));
        getDocs(q).then((uSnap) => {
          const allUsers = uSnap.docs.map(d => ({ ...d.data(), user_id: d.id, id: d.id } as Doctor));
          const docList = allUsers.filter(u => u.role === 'clinic_doctor');
          setDoctors(docList);
          setLoading(false);
        }).catch(() => setLoading(false));

      } else {
        setError('Clinic not found.');
        setLoading(false);
      }
    }).catch(() => {
      setError('Unable to load clinic details. Please try again.');
      setLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !phone.trim() || !reason.trim() || !selectedDoctorId) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setError('');
    setSaving(true);
    
    try {
      const parsedAge = age ? parseInt(age, 10) : null;

      // 1. Try to find if patient exists or create a basic patient record
      const patQ = query(collection(db, 'patient_accounts'), where('phone', '==', phone.trim()));
      const patSnap = await getDocs(patQ);
      let accountId = '';
      
      if (!patSnap.empty) {
        accountId = patSnap.docs[0].id;
        if (dob || parsedAge !== null) {
          await updateDoc(doc(db, 'patient_accounts', accountId), {
            ...(dob ? { dob } : {}),
            ...(parsedAge !== null ? { age: parsedAge } : {})
          });
        }
      } else {
        // Create basic patient account
        const accRef = await addDoc(collection(db, 'patient_accounts'), {
          name: patientName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          dob: dob || null,
          age: parsedAge,
          emergency_contact_name: attendantName.trim() || null,
          otp_verified: false,
          created_at: new Date().toISOString()
        });
        accountId = accRef.id;
        await updateDoc(accRef, { account_id: accRef.id });
      }

      // 1.5 Create or find clinic-specific patient record
      const clinicPatQ = query(collection(db, 'patients'), where('clinic_id', '==', clinic!.clinic_id), where('phone', '==', phone.trim()));
      const clinicPatSnap = await getDocs(clinicPatQ);
      let clinicPatientId = '';
      if (!clinicPatSnap.empty) {
        clinicPatientId = clinicPatSnap.docs[0].id;
        const updates: any = {};
        if (clinicPatSnap.docs[0].data().name !== patientName.trim()) {
          updates.name = patientName.trim();
        }
        if (dob) updates.dob = dob;
        if (parsedAge !== null) updates.age = parsedAge;
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'patients', clinicPatientId), updates);
        }
      } else {
        const cPatRef = await addDoc(collection(db, 'patients'), {
          clinic_id: clinic!.clinic_id,
          account_id: accountId,
          name: patientName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          dob: dob || null,
          age: parsedAge,
          emergency_contact_name: attendantName.trim() || null,
          created_at: new Date().toISOString(),
        });
        clinicPatientId = cPatRef.id;
        await updateDoc(cPatRef, { patient_id: cPatRef.id });
      }

      // 2. Determine token number and slot
      const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', clinic!.clinic_id), where('date', '==', date));
      const existingSnap = await getDocs(apptQ);
      const existing = existingSnap.docs.map(d => d.data());
      
      const maxToken = existing.reduce((max, appt) => Math.max(max, appt.token_number || 0), 0);
      const nextToken = maxToken + 1;

      // 3. Create appointment
      const displayToken = 'QR-' + String(nextToken).padStart(3, '0');
      const apptRef = await addDoc(collection(db, 'appointments'), {
        clinic_id: clinic!.clinic_id,
        patient_id: clinicPatientId, // Use the clinic's patient ID so it links properly on dashboard
        account_id: accountId, // Keep global account reference
        doctor_id: selectedDoctorId,
        date: date,
        time_slot: timeSlot,
        type: 'walk-in',
        status: 'waiting',
        reason: reason.trim(),
        triage_level: 'normal',
        token_number: nextToken,
        display_token: displayToken,
        booked_via: 'qr_walkin',
        visit_type: 'new-visit',
        online_booking: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      await updateDoc(apptRef, { 
        appt_id: apptRef.id,
        appointment_id: apptRef.id,
      });

      const selectedDocName = doctors.find(d => d.user_id === selectedDoctorId)?.name || 'Doctor';
      
      setBookingDetails({
        token: displayToken,
        doctorName: selectedDocName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      });
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError('An error occurred while booking: ' + (err.message || 'Unknown error') + '. Please try again or visit the reception.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center p-6 text-center">
        <div className="inline-flex items-center gap-2 text-primary font-medium">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          Loading clinic details...
        </div>
      </div>
    );
  }

  if (error && !clinic) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
          <div className="text-danger mb-4 mx-auto w-12 h-12 bg-danger/10 rounded-full flex items-center justify-center font-bold text-xl">!</div>
          <p className="text-ink font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (success && bookingDetails) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Completed!</h2>
          
          <div className="bg-gray-50 rounded-xl p-5 my-6 text-left border border-gray-100">
            <p className="text-sm text-gray-500 mb-1 font-medium tracking-wide">TOKEN NO.</p>
            <p className="text-3xl font-bold text-primary mb-4">{bookingDetails.token}</p>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Clinic</span>
                <span className="font-semibold text-gray-900 text-sm">{clinic?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Doctor</span>
                <span className="font-semibold text-gray-900 text-sm">{bookingDetails.doctorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Date</span>
                <span className="font-semibold text-gray-900 text-sm">{bookingDetails.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">Time</span>
                <span className="font-semibold text-gray-900 text-sm">{bookingDetails.time}</span>
              </div>
            </div>
          </div>

          <p className="text-gray-600 mb-6 text-sm">
            Your appointment has been registered successfully. Please take a seat in the lobby, the doctor will call you shortly.
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary w-full py-3">Book Another Walk-in</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FAFA] flex flex-col p-4 sm:p-6 md:p-8">
      <div className="max-w-xl w-full mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          {clinic?.logo_url ? (
            <img src={clinic.logo_url} alt={clinic.name} className="h-16 mx-auto mb-4 rounded-xl shadow-sm" />
          ) : (
            <div className="h-16 w-16 bg-primary text-white rounded-xl mx-auto mb-4 flex items-center justify-center shadow-sm text-2xl font-bold">
              {clinic?.name?.charAt(0) || 'C'}
            </div>
          )}
          <h1 className="text-2xl font-bold text-ink">{clinic?.name}</h1>
          <p className="text-ink-muted text-sm mt-1">{clinic?.address}</p>
          <div className="mt-4 inline-block bg-primary-50 text-primary px-3 py-1 rounded-full text-xs font-semibold tracking-wide">
            QR WALK-IN
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-card p-5 sm:p-7 border border-black/5">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-sm text-danger text-center font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="label flex items-center gap-1.5"><UserCircle size={14} /> Patient Name *</label>
              <input 
                className="input py-2.5" 
                placeholder="Full Name" 
                value={patientName} 
                onChange={e => setPatientName(e.target.value)} 
                required 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1.5"><Phone size={14} /> Phone Number *</label>
                <input 
                  type="tel"
                  maxLength={10}
                  className="input py-2.5" 
                  placeholder="10 digit number" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                  required 
                />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><Mail size={14} /> Email Address <span className="text-ink-subtle font-normal text-[10px] ml-auto">(Optional)</span></label>
                <input 
                  type="email"
                  className="input py-2.5" 
                  placeholder="name@email.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1.5">
                  <Calendar size={14} /> Date of Birth (DOB)
                </label>
                <input 
                  type="date"
                  max={localDateISO(new Date())}
                  className="input py-2.5" 
                  value={formatDobForInput(dob)} 
                  onChange={e => handleDobChange(e.target.value)} 
                />
              </div>
              <div>
                <label className="label flex items-center justify-between">
                  <span>Age (Years)</span>
                  {dob && <span className="text-[10px] text-primary font-medium">Auto-calculated</span>}
                </label>
                <input 
                  type="number"
                  min="0"
                  max="130"
                  className="input py-2.5" 
                  placeholder="e.g. 28" 
                  value={age} 
                  onChange={e => handleAgeChange(e.target.value)} 
                />
              </div>
            </div>

            <div>
              <label className="label flex items-center justify-between">
                <div className="flex items-center gap-1.5"><User size={14} /> Attendant Name</div>
                <span className="text-ink-subtle font-normal text-[10px]">Optional</span>
              </label>
              <input 
                className="input py-2.5" 
                placeholder="Relative or Guardian Name" 
                value={attendantName} 
                onChange={e => setAttendantName(e.target.value)} 
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5"><FileText size={14} /> Reason for Visit *</label>
              <textarea 
                className="input py-2.5 min-h-[80px]" 
                placeholder="Briefly describe your symptoms or reason for visit" 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="label flex items-center gap-1.5">Select Doctor *</label>
              {doctors.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-500">
                  No doctors available currently.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 mt-1">
                  {doctors.map(doc => (
                    <button
                      key={doc.user_id}
                      type="button"
                      onClick={() => setSelectedDoctorId(doc.user_id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition ${selectedDoctorId === doc.user_id ? 'border-primary bg-primary-50/30 ring-1 ring-primary' : 'border-gray-200 hover:border-primary/50'}`}
                    >
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: doc.avatar_color || '#0F6E56' }}>
                        {doc.name.charAt(0)}
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${selectedDoctorId === doc.user_id ? 'text-primary' : 'text-ink'}`}>{doc.name}</p>
                        <p className="text-xs text-ink-muted">{doc.specialisation || doc.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  required
                  min={localDateISO(new Date())}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-900"
                  value={formatDobForInput(date)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Time *</label>
                <input
                  type="time"
                  required
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-gray-900"
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4">
              <button 
                type="submit" 
                disabled={saving || !selectedDoctorId || !patientName || !phone || !reason} 
                className="btn-primary w-full py-3.5 text-base font-semibold rounded-xl"
              >
                {saving ? 'Completing Booking...' : 'Complete Appointment'}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
