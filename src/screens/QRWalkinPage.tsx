import { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { 
  Check, UserCircle, Phone, Mail, FileText, User, Calendar, 
  Stethoscope, Clock, ShieldCheck, ArrowRight, AlertCircle, HeartPulse, Sparkles
} from 'lucide-react';
import type { Clinic, User as Doctor } from '../lib/types';
import { localDateISO, calculateAge, formatDobForInput } from '../lib/format';
import { sendInstantAppointmentEmail } from '../lib/emailService';
import { findExistingPatientAccountByPhone } from '../lib/accountLinking';
import { fetchClinicDoctors } from '../lib/doctorService';
import { useNavigate, useLocation } from 'react-router-dom';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const GENDERS = ['Male', 'Female', 'Other'] as const;

interface QRWalkinPageProps {
  clinicIdOverride?: string;
  onSuccess?: (details: any) => void;
}

export function QRWalkinPage({ clinicIdOverride, onSuccess }: QRWalkinPageProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  
  // Form fields
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [bloodGroup, setBloodGroup] = useState<string>('O+');
  const [attendantName, setAttendantName] = useState('');
  const [attendantPhone, setAttendantPhone] = useState('');
  const [reason, setReason] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');

  // Existing account indicator
  const [existingAccountInfo, setExistingAccountInfo] = useState<{
    found: boolean;
    accountId?: string;
    name?: string;
  } | null>(null);

  const now = new Date();
  const [date, setDate] = useState(localDateISO(now));
  const [timeSlot, setTimeSlot] = useState(
    `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  );
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookingDetails, setBookingDetails] = useState<{ 
    token: string; 
    doctorName: string; 
    time: string; 
    date: string;
    isLinked: boolean;
    phone: string;
  } | null>(null);
  const [error, setError] = useState('');

  const handleDobChange = (newDob: string) => {
    const formatted = formatDobForInput(newDob);
    setDob(formatted);
    if (!formatted) {
      setAge('');
      return;
    }
    const computed = calculateAge(formatted);
    if (computed !== null && computed >= 0 && computed < 130) {
      setAge(String(computed));
    } else {
      setAge('');
    }
  };

  // Real-time lookup if phone has an existing Viitsa account
  useEffect(() => {
    const clean = phone.replace(/\D/g, '').slice(-10);
    if (clean.length === 10) {
      let isCancelled = false;
      findExistingPatientAccountByPhone(clean).then((res) => {
        if (!isCancelled && res.found) {
          setExistingAccountInfo({
            found: true,
            accountId: res.accountId,
            name: res.name,
          });
          // Auto-fill available details if empty
          if (res.name && !patientName) setPatientName(res.name);
          if (res.email && !email) setEmail(res.email);
          if (res.dob && !dob) handleDobChange(res.dob);
          if (res.gender && (res.gender === 'Male' || res.gender === 'Female' || res.gender === 'Other')) {
            setGender(res.gender);
          }
          if (res.bloodGroup && BLOOD_GROUPS.includes(res.bloodGroup as any)) {
            setBloodGroup(res.bloodGroup);
          }
        } else if (!isCancelled) {
          setExistingAccountInfo(null);
        }
      });
      return () => {
        isCancelled = true;
      };
    } else {
      setExistingAccountInfo(null);
    }
  }, [phone]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clinicId = clinicIdOverride || params.get('clinic');
    if (!clinicId) {
      setError('Clinic ID is missing. Please scan the official clinic QR code.');
      setLoading(false);
      return;
    }

    // Load Clinic & All Clinic Doctors
    getDoc(doc(db, 'clinics', clinicId)).then(async (snap) => {
      if (snap.exists()) {
        const cData = { ...snap.data(), clinic_id: snap.id } as Clinic;
        setClinic(cData);
        
        try {
          const docList = await fetchClinicDoctors(clinicId, cData);
          setDoctors(docList);
          if (docList.length > 0) {
            setSelectedDoctorId(docList[0].user_id || docList[0].id || '');
          }
        } catch (fetchErr) {
          console.warn('Error fetching doctors:', fetchErr);
        }

        setLoading(false);
      } else {
        setError('Clinic not found. Please contact the clinic reception.');
        setLoading(false);
      }
    }).catch(() => {
      setError('Unable to load clinic details. Please check your internet connection.');
      setLoading(false);
    });
  }, [clinicIdOverride]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    const cleanAttendantPhone = attendantPhone.replace(/\D/g, '').slice(-10);
    const cleanEmail = email.trim().toLowerCase();

    if (!patientName.trim()) {
      setError('Please enter the patient name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setError('Patient phone number must be exactly 10 digits.');
      return;
    }
    // Email is optional, but if entered, must be a valid email format
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid email address, or leave it blank.');
      return;
    }
    if (!dob) {
      setError('Please enter the Date of Birth to auto-compute age.');
      return;
    }
    // Attendant details are compulsory
    if (!attendantName.trim()) {
      setError('Please enter the attendant / guardian name.');
      return;
    }
    if (cleanAttendantPhone.length !== 10) {
      setError('Attendant phone number must be exactly 10 digits.');
      return;
    }
    if (!reason.trim()) {
      setError('Please specify the reason for visit / emergency symptoms.');
      return;
    }
    if (!selectedDoctorId) {
      setError('Please select a doctor.');
      return;
    }

    setError('');
    setSaving(true);
    
    try {
      const parsedAge = age ? parseInt(age, 10) : calculateAge(dob);

      // Check whether an account exists under this phone number
      const existingAccount = await findExistingPatientAccountByPhone(cleanPhone);
      const isLinkedToExistingAccount = existingAccount.found && Boolean(existingAccount.accountId);
      const finalAccountId = isLinkedToExistingAccount ? existingAccount.accountId! : null;

      // 1. Ensure or update clinic-specific patient record
      const clinicPatQ = query(
        collection(db, 'patients'), 
        where('clinic_id', '==', clinic!.clinic_id), 
        where('phone', '==', cleanPhone)
      );
      const clinicPatSnap = await getDocs(clinicPatQ);
      let clinicPatientId = '';

      if (!clinicPatSnap.empty) {
        clinicPatientId = clinicPatSnap.docs[0].id;
        const updates: any = {
          name: patientName.trim(),
          email: cleanEmail || null,
          dob: dob,
          age: parsedAge,
          gender: gender,
          blood_group: bloodGroup,
          attender_name: attendantName.trim() || null,
          attender_phone: cleanAttendantPhone || null,
          emergency_contact_name: attendantName.trim() || null,
          emergency_contact_phone: cleanAttendantPhone || null,
          updated_at: new Date().toISOString(),
        };
        if (finalAccountId) updates.account_id = finalAccountId;
        await updateDoc(doc(db, 'patients', clinicPatientId), updates).catch(console.warn);
      } else {
        const cPatRef = await addDoc(collection(db, 'patients'), {
          clinic_id: clinic!.clinic_id,
          account_id: finalAccountId,
          name: patientName.trim(),
          phone: cleanPhone,
          email: cleanEmail || null,
          dob: dob,
          age: parsedAge,
          gender: gender,
          blood_group: bloodGroup,
          attender_name: attendantName.trim() || null,
          attender_phone: cleanAttendantPhone || null,
          emergency_contact_name: attendantName.trim() || null,
          emergency_contact_phone: cleanAttendantPhone || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        clinicPatientId = cPatRef.id;
        await updateDoc(cPatRef, { patient_id: cPatRef.id }).catch(console.warn);
      }

      // If user has an existing patient_account, update it with recent emergency contact & blood group
      if (isLinkedToExistingAccount && finalAccountId) {
        await updateDoc(doc(db, 'patient_accounts', finalAccountId), {
          attender_name: attendantName.trim() || null,
          attender_phone: cleanAttendantPhone || null,
          emergency_contact_name: attendantName.trim() || null,
          emergency_contact_phone: cleanAttendantPhone || null,
          blood_group: bloodGroup,
          gender: gender,
          dob: dob,
          age: parsedAge,
          updated_at: new Date().toISOString(),
        }).catch(console.warn);
      }

      // 2. Determine token number and slot
      const apptQ = query(
        collection(db, 'appointments'), 
        where('clinic_id', '==', clinic!.clinic_id), 
        where('date', '==', date)
      );
      const existingSnap = await getDocs(apptQ);
      const existing = existingSnap.docs.map(d => d.data());
      
      const maxToken = existing.reduce((max, appt) => Math.max(max, appt.token_number || 0), 0);
      const nextToken = maxToken + 1;
      const displayToken = 'QR-' + String(nextToken).padStart(3, '0');

      const selectedDoc = doctors.find(d => (d.user_id || d.id) === selectedDoctorId);
      const rawDocName = selectedDoc?.name || clinic?.doctor_name || 'Doctor';
      const cleanDocName = rawDocName.replace(/^(Dr\.?|Doctor)\s+/i, '').trim();
      const formattedDocName = cleanDocName ? `Dr. ${cleanDocName}` : 'Doctor';

      // 3. Create appointment
      const apptPayload: Record<string, any> = {
        clinic_id: clinic!.clinic_id,
        patient_id: clinicPatientId,
        patient_phone: cleanPhone,
        patient_name: patientName.trim(),
        patient_email: cleanEmail || null,
        doctor_id: selectedDoctorId,
        doctor_name: formattedDocName,
        attendant_name: attendantName.trim(),
        emergency_contact_name: attendantName.trim(),
        attendant_phone: cleanAttendantPhone,
        emergency_contact_phone: cleanAttendantPhone,
        patient_dob: dob,
        patient_age: parsedAge,
        gender: gender,
        blood_group: bloodGroup,
        date: date,
        time_slot: timeSlot,
        type: 'walk-in',
        status: 'waiting',
        reason: reason.trim(),
        triage_level: 'emergency',
        is_emergency: true,
        token_number: nextToken,
        display_token: displayToken,
        booked_via: 'qr_walkin',
        online_booking: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (isLinkedToExistingAccount && finalAccountId) {
        apptPayload.account_id = finalAccountId;
        apptPayload.is_unclaimed = false;
      } else {
        apptPayload.account_id = null;
        apptPayload.is_unclaimed = true;
        apptPayload.unclaimed_phone = cleanPhone;
      }

      const apptRef = await addDoc(collection(db, 'appointments'), apptPayload);

      await updateDoc(apptRef, { 
        appt_id: apptRef.id,
        appointment_id: apptRef.id,
      }).catch(console.warn);

      // Trigger instant confirmation email
      sendInstantAppointmentEmail(apptRef.id, 'appointment_confirmed');
      
      const successData = {
        token: displayToken,
        doctorName: formattedDocName,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        isLinked: isLinkedToExistingAccount,
        phone: cleanPhone,
      };

      setBookingDetails(successData);
      setSuccess(true);
      if (onSuccess) onSuccess(successData);
    } catch (err: any) {
      console.error('[QRWalkin] error:', err);
      setError('An error occurred while booking: ' + (err.message || 'Unknown error') + '. Please try again or visit reception.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center p-6 text-center">
        <div className="inline-flex items-center gap-2.5 text-primary font-medium">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span>Connecting to clinic portal...</span>
        </div>
      </div>
    );
  }

  if (error && !clinic) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
          <div className="text-red-500 mb-4 mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center font-bold text-xl">!</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Notice</h2>
          <p className="text-gray-600 text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/login')} className="btn-primary w-full py-2.5">
            Go to Patient Login
          </button>
        </div>
      </div>
    );
  }

  if (success && bookingDetails) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Appointment Registered</h2>
          <p className="text-xs text-gray-500">Your token has been added to the doctor's queue</p>
          
          <div className="bg-gray-50 rounded-2xl p-5 my-6 text-left border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Queue Token</span>
              <span className="text-xs font-semibold text-emerald-700">● Waiting in Queue</span>
            </div>
            <p className="text-3xl font-extrabold text-primary mb-4 font-mono">{bookingDetails.token}</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Clinic</span>
                <span className="font-semibold text-gray-900 text-right">{clinic?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Doctor</span>
                <span className="font-semibold text-gray-900 text-right">{bookingDetails.doctorName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Time & Date</span>
                <span className="font-semibold text-gray-900 text-right">{bookingDetails.time} • {bookingDetails.date}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Registered Mobile</span>
                <span className="font-semibold text-gray-900 font-mono">+91 {bookingDetails.phone}</span>
              </div>
            </div>
          </div>

          {/* Account status notification */}
          {bookingDetails.isLinked ? (
            <div className="p-3.5 bg-emerald-50 rounded-xl text-left border border-emerald-100 mb-6 text-xs text-emerald-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span>Linked to your existing Viitsa Account</span>
              </div>
              <p className="text-emerald-700">
                This visit has been linked to your account. You can log in anytime to view your digital prescription and queue status.
              </p>
            </div>
          ) : (
            <div className="p-3.5 bg-sky-50 rounded-xl text-left border border-sky-100 mb-6 text-xs text-sky-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-sky-900">
                <Sparkles size={16} className="text-sky-600" />
                <span>Future Account Linking Guaranteed</span>
              </div>
              <p className="text-sky-700">
                Whenever you create a Viitsa account with <strong>+91 {bookingDetails.phone}</strong>, this appointment and all doctor notes will automatically appear in your dashboard!
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            <button 
              onClick={() => navigate('/login')} 
              className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <span>{bookingDetails.isLinked ? 'Go to Patient Dashboard' : 'Create Account / Sign In'}</span>
              <ArrowRight size={16} />
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="w-full py-2.5 text-xs text-gray-500 hover:text-gray-800 font-medium transition"
            >
              Book Another Walk-in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col p-4 sm:p-6 md:p-8">
      <div className="max-w-xl w-full mx-auto">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold mb-3 border border-emerald-100">
            <HeartPulse size={14} className="text-emerald-600 animate-pulse" />
            <span>Emergency & Fast Walk-in Queue</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900">{clinic?.name}</h1>
          {clinic?.address && (
            <p className="text-gray-500 text-xs mt-1 max-w-md mx-auto">{clinic.address}</p>
          )}

          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>Already have an account?</span>
            <button 
              type="button" 
              onClick={() => navigate('/login')}
              className="text-primary font-semibold hover:underline"
            >
              Sign In
            </button>
          </div>
        </div>

        {/* Small Emergency Form Card */}
        <div className="bg-white rounded-2xl shadow-sm p-5 sm:p-7 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Existing Account Detected Banner */}
            {existingAccountInfo && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                <span>
                  Existing account found for <strong>{existingAccountInfo.name || 'you'}</strong>. This appointment will automatically link to your dashboard!
                </span>
              </div>
            )}

            {/* 1. Patient Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Patient Name <span className="text-red-500">*</span>
              </label>
              <input 
                className="input py-2.5 text-sm" 
                placeholder="Full Name of Patient" 
                value={patientName} 
                onChange={e => setPatientName(e.target.value)} 
                required 
              />
            </div>

            {/* 2. Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 font-mono">
                    +91
                  </span>
                  <input 
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="input py-2.5 text-sm font-mono flex-1" 
                    placeholder="10-digit mobile" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    required 
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  <span className="text-[11px] text-gray-400 font-normal normal-case">(Optional)</span>
                </div>
                <input 
                  type="email"
                  className="input py-2.5 text-sm" 
                  placeholder="patient@example.com (optional)" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                />
              </div>
            </div>

            {/* 3. DOB & Age (Auto-calculated and Disabled) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Date of Birth (DOB) <span className="text-red-500">*</span>
                </label>
                <input 
                  type="date"
                  required
                  max={localDateISO(new Date())}
                  className="input py-2.5 text-sm" 
                  value={formatDobForInput(dob)} 
                  onChange={e => handleDobChange(e.target.value)} 
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Age (Years)
                  </label>
                  <span className="text-[10px] text-emerald-600 font-medium">Auto-computed</span>
                </div>
                <input 
                  type="text" 
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="input py-2.5 text-sm font-mono bg-gray-100 text-gray-700 font-semibold cursor-not-allowed border-gray-200" 
                  placeholder="Auto-calculated from DOB" 
                  value={age ? `${age} yrs` : '—'} 
                />
              </div>
            </div>

            {/* 4. Gender (Radio Buttons) & Blood Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {GENDERS.map((g) => (
                    <label 
                      key={g} 
                      className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium cursor-pointer transition border ${
                        gender === g 
                          ? 'border-primary bg-primary/5 text-primary font-semibold ring-1 ring-primary' 
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="patient_gender" 
                        value={g} 
                        checked={gender === g} 
                        onChange={() => setGender(g)}
                        className="sr-only"
                      />
                      <span>{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Blood Group
                </label>
                <select
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="input py-2.5 text-sm"
                >
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 5. Attendant Details (Compulsory) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attendant Name <span className="text-red-500">*</span>
                </label>
                <input 
                  className="input py-2.5 text-sm" 
                  placeholder="Guardian / Relative Name" 
                  value={attendantName} 
                  onChange={e => setAttendantName(e.target.value)} 
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attendant Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 font-mono">
                    +91
                  </span>
                  <input 
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    className="input py-2.5 text-sm font-mono flex-1" 
                    placeholder="10-digit mobile" 
                    value={attendantPhone} 
                    onChange={e => setAttendantPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} 
                    required
                  />
                </div>
              </div>
            </div>

            {/* 6. Doctor Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Doctor <span className="text-red-500">*</span>
              </label>
              {doctors.length === 0 ? (
                <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-500">
                  Loading available clinic doctors...
                </div>
              ) : (
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="input py-2.5 text-sm"
                  required
                >
                  {doctors.map(doc => {
                    const id = doc.user_id || doc.id;
                    const docName = doc.name?.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`;
                    return (
                      <option key={id} value={id}>
                        {docName} {doc.specialisation ? `— ${doc.specialisation}` : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* 7. Reason for Visit / Emergency */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Emergency Symptoms / Reason for Visit <span className="text-red-500">*</span>
              </label>
              <textarea 
                className="input py-2 text-sm min-h-[70px]" 
                placeholder="Briefly describe symptoms, chief complaint, or urgent concern" 
                value={reason} 
                onChange={e => setReason(e.target.value)} 
                required 
              />
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button 
                type="submit" 
                disabled={
                  saving || 
                  !selectedDoctorId || 
                  !patientName.trim() || 
                  phone.replace(/\D/g, '').slice(-10).length !== 10 || 
                  !attendantName.trim() ||
                  attendantPhone.replace(/\D/g, '').slice(-10).length !== 10 ||
                  !reason.trim()
                } 
                className="btn-primary w-full py-3.5 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm transition hover:shadow-md"
              >
                {saving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>Booking Walk-in Appointment...</span>
                  </>
                ) : (
                  <>
                    <HeartPulse size={17} />
                    <span>Confirm Emergency Walk-in</span>
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-4">
          Powered by VIITSA Healthcare Intelligence
        </p>

      </div>
    </div>
  );
}
