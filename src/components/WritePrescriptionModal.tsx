import React, { useState } from 'react';
import { 
  Pill, Plus, Trash2, Eye, Printer, Save, X, 
  Stethoscope, FileText, CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { todayISO, formatDate, calculateAge, formatDobForInput } from '../lib/format';
import { DobCalendarPicker } from './DobCalendarPicker';
import { PrescriptionView, type PrescriptionMedicine } from './PrescriptionView';
import { useClinicData } from '../lib/useClinicData';
import { searchMedicineCatalog, type CatalogMedicine, COMMON_MEDICINES } from '../lib/medicineCatalog';

interface WritePrescriptionModalProps {
  open: boolean;
  onClose: () => void;
  patient: any;
  appointment?: any;
  doctor?: any;
  clinic?: any;
  onSaved?: () => void;
}

export function WritePrescriptionModal({
  open,
  onClose,
  patient,
  appointment,
  doctor,
  clinic,
  onSaved
}: WritePrescriptionModalProps) {
  const { user, clinic: authClinic } = useAuth();
  const { toast } = useToast();
  const { inventory } = useClinicData();
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState<number | null>(null);

  const currentClinic = clinic || authClinic;
  const currentDoctor = doctor || {
    name: user?.name || 'Dr. S. Mehta',
    specialization: user?.specialisation || 'General Physician',
    registrationNumber: user?.registration_number || '123456 (TSMC)'
  };

  // Form States
  const [patientDob, setPatientDob] = useState(patient?.dob || '');
  const [patientAge, setPatientAge] = useState<string>(
    patient?.age !== undefined && patient?.age !== null 
      ? String(patient.age) 
      : (patient?.dob ? String(calculateAge(patient.dob) ?? '') : '')
  );

  const handleDobChange = (newDob: string) => {
    setPatientDob(newDob);
    if (newDob) {
      const computed = calculateAge(newDob);
      if (computed !== null) setPatientAge(String(computed));
    }
  };

  const [chiefComplaint, setChiefComplaint] = useState(appointment?.reason || '');
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  
  // Vitals
  const [temperature, setTemperature] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulse, setPulse] = useState('');
  const [spo2, setSpo2] = useState('');

  // Medicines (defaults to 1 empty row for immediate entry)
  const [medicines, setMedicines] = useState<PrescriptionMedicine[]>([
    {
      id: '1',
      name: '',
      dose: '1 Tablet',
      timesPerDay: '3 times/day',
      intakeTime: 'Morning, Afternoon, Night',
      duration: '3 Days',
      foodInstruction: 'After Food',
      instructions: ''
    }
  ]);

  // Advice & Tests
  const [adviceText, setAdviceText] = useState(
    'Drink plenty of water and stay hydrated.\nTake adequate rest and avoid strenuous activity.\nFollow a light and easily digestible diet.'
  );
  const [testsText, setTestsText] = useState(
    'Complete Blood Count (CBC)\nFollow-up if symptoms worsen'
  );
  const [followUpDate, setFollowUpDate] = useState('');
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  if (!open) return null;

  const handleAddMedicine = () => {
    setMedicines(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name: '',
        dose: '1 Tablet',
        timesPerDay: '2 times/day',
        intakeTime: 'Morning, Night',
        duration: '5 Days',
        foodInstruction: 'After Food',
        instructions: ''
      }
    ]);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateMedicine = (index: number, field: keyof PrescriptionMedicine, value: string) => {
    setMedicines(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSelectMedicine = (index: number, item: CatalogMedicine) => {
    setMedicines(prev => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        name: item.name,
        dose: item.dose || copy[index].dose || '1 Tablet',
        timesPerDay: item.timesPerDay || copy[index].timesPerDay || '2 times/day',
        intakeTime: item.intakeTime || copy[index].intakeTime || 'Morning, Night',
        duration: item.duration || copy[index].duration || '5 Days',
        foodInstruction: item.foodInstruction || copy[index].foodInstruction || 'After Food',
        instructions: item.instructions || copy[index].instructions || ''
      };
      return copy;
    });
    setActiveSuggestionIdx(null);
  };

  const getRowSuggestions = (query: string): CatalogMedicine[] => {
    if (!query || query.trim().length === 0) {
      return COMMON_MEDICINES.slice(0, 8);
    }
    return searchMedicineCatalog(query, inventory);
  };

  // Quick preset template
  const handleLoadSample = () => {
    setChiefComplaint('Fever and body ache since 2 days.');
    setSymptoms('Fever, headache, mild cough, throat irritation, body ache.');
    setDiagnosis('Viral Fever (Provisional Diagnosis)');
    setTemperature('101.2 °F');
    setBloodPressure('120/80 mmHg');
    setPulse('96/min');
    setSpo2('98%');
    setMedicines([
      { id: '1', name: 'Paracetamol 500 mg', dose: '1 Tablet', timesPerDay: '3 times/day', intakeTime: 'Morning, Afternoon, Night', duration: '3 Days', foodInstruction: 'After Food', instructions: 'For fever and body ache' },
      { id: '2', name: 'Pantoprazole 40 mg', dose: '1 Tablet', timesPerDay: '1 time/day', intakeTime: 'Morning', duration: '5 Days', foodInstruction: 'Before Food', instructions: 'Before breakfast' },
      { id: '3', name: 'Vitamin D3 60K (Sachet)', dose: '1 Sachet', timesPerDay: '1 time/week', intakeTime: 'Sunday Morning', duration: '4 Weeks', foodInstruction: 'After Food', instructions: 'Once weekly' },
      { id: '4', name: 'ORS (200 ml)', dose: '200 ml', timesPerDay: '3 times/day', intakeTime: 'Morning, Afternoon, Evening', duration: '3 Days', foodInstruction: 'After Food', instructions: 'Maintain hydration' },
      { id: '5', name: 'Cetirizine 10 mg', dose: '1 Tablet', timesPerDay: '1 time/day', intakeTime: 'Night', duration: '5 Days', foodInstruction: 'After Food', instructions: 'At bedtime for allergy symptoms' }
    ]);
    setAdviceText('Drink plenty of water and stay hydrated.\nTake adequate rest and avoid strenuous activity.\nFollow a light and easily digestible diet.\nMonitor temperature and seek medical attention if fever persists beyond 3 days.');
    setTestsText('Complete Blood Count (CBC)\nVitamin D (25-OH)\nFollow-up after 5 days or earlier if symptoms worsen.');
  };

  // Save to Firebase
  const handleSave = async (markAppointmentDone = false) => {
    if (!diagnosis.trim() && medicines.every(m => !m.name.trim())) {
      toast('Please enter a diagnosis or at least one prescribed medicine.', 'error');
      return;
    }

    setSaving(true);
    try {
      const pId = patient?.patient_id || patient?.id;
      const apptId = appointment?.appointment_id || appointment?.appt_id || appointment?.id;

      const cleanedMeds = medicines.filter(m => m.name.trim().length > 0);
      const adviceArr = adviceText.split('\n').map(s => s.trim()).filter(Boolean);
      const testsArr = testsText.split('\n').map(s => s.trim()).filter(Boolean);

      // Generate formatted prescription text for backwards compatibility
      const plainTextPrescription = cleanedMeds.map(
        m => `${m.name} | ${m.dose} | ${m.timesPerDay} (${m.intakeTime}) | ${m.duration} | ${m.foodInstruction}${m.instructions ? ' | ' + m.instructions : ''}`
      ).join('\n');

      const presPayload: any = {
        patient_id: pId || null,
        patient_name: patient?.name || patient?.full_name || null,
        patient_phone: patient?.phone || patient?.mobile || null,
        patient_age: patientAge ? parseInt(patientAge, 10) : null,
        patient_dob: patientDob || null,
        patient_gender: patient?.gender ?? null,
        appointment_id: apptId || null,
        doctor_id: user?.uid || user?.user_id || null,
        doctor_name: currentDoctor.name,
        clinic_id: currentClinic?.clinic_id || currentClinic?.id || 'cln_viitsa_main',
        
        chief_complaint: chiefComplaint.trim() || null,
        symptoms: symptoms.trim() || null,
        diagnosis: diagnosis.trim() || 'General Consultation',
        
        vitals: {
          temperature: temperature.trim() || null,
          bloodPressure: bloodPressure.trim() || null,
          pulse: pulse.trim() || null,
          spo2: spo2.trim() || null,
        },
        
        prescriptions: cleanedMeds,
        prescription: plainTextPrescription,
        advice: adviceArr,
        recommended_tests: testsArr,
        follow_up_date: followUpDate || null,
        notes: notes.trim() || null,
        created_at: new Date().toISOString()
      };

      await addDoc(collection(db, 'consultations'), presPayload);

      // Update patient profile live (all dashboards)
      if (pId) {
        try {
          const profilePayload = {
            dob: patientDob || null,
            age: patientAge ? parseInt(patientAge, 10) : null,
            updated_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'patients', pId), profilePayload, { merge: true });
          
          const accId = patient?.account_id || (pId.startsWith('pat_') ? pId : null);
          if (accId) {
            await setDoc(doc(db, 'patient_accounts', accId), profilePayload, { merge: true });
          }
        } catch (e) {
          console.error("Failed to sync patient DOB/Age:", e);
        }
      }

      // If tied to an appointment and marking done
      if (apptId && markAppointmentDone) {
        try {
          await updateDoc(doc(db, 'appointments', apptId), {
            status: 'done',
            completed_at: serverTimestamp(),
            updated_at: serverTimestamp()
          });
        } catch (e) {
          console.warn('Could not update appointment status:', e);
        }
      }

      toast('Doctor Prescription saved successfully!', 'success');
      onSaved?.();
      setShowPreview(true);
    } catch (err: any) {
      console.error('Error saving prescription:', err);
      toast('Failed to save prescription: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Current preview data object
  const currentPrescriptionData = {
    patient: {
      name: patient?.name || patient?.full_name || 'Patient',
      uhid: patient?.patient_code || patient?.id_number || patient?.display_id || 'VTS001234',
      age: patientAge ? `${patientAge} Years` : undefined,
      dob: patientDob || undefined,
      gender: patient?.gender || 'Male',
      mobile: patient?.phone || patient?.mobile || '+91 98765 43210'
    },
    doctor: currentDoctor,
    clinic: currentClinic,
    clinicalNotes: {
      chiefComplaint: chiefComplaint || 'Routine medical evaluation',
      symptoms: symptoms || 'None reported',
      diagnosis: diagnosis || 'Provisional Diagnosis',
      vitals: {
        temperature: temperature ? (temperature.includes('°') ? temperature : `${temperature} °F`) : '98.6 °F',
        bloodPressure: bloodPressure || '120/80 mmHg',
        pulse: pulse ? (pulse.includes('/min') ? pulse : `${pulse}/min`) : '78/min',
        spo2: spo2 ? (spo2.includes('%') ? spo2 : `${spo2}%`) : '99%'
      }
    },
    medicines: medicines.filter(m => m.name.trim().length > 0).length > 0 ? medicines.filter(m => m.name.trim().length > 0) : undefined,
    advice: adviceText.split('\n').filter(Boolean),
    recommendedTests: testsText.split('\n').filter(Boolean),
    followUpDate: followUpDate ? formatDate(followUpDate) : undefined
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-[#0F6E56] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white font-serif font-black text-base">
              ℞
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">Write & Fill Doctor Prescription</h3>
              <p className="text-xs text-teal-100 font-medium">
                Patient: <span className="font-bold text-white">{patient?.name || 'Patient'}</span>
                {patientAge ? ` · ${patientAge} yrs` : ''}
                {patient?.gender ? ` · ${patient?.gender}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-2.5 py-1 rounded-md bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition"
              title="Fill sample fields matching reference design"
            >
              Fill Sample Data
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-2.5 py-1 rounded-md bg-white text-[#0F6E56] hover:bg-teal-50 text-xs font-bold transition flex items-center gap-1 shadow-sm"
              title="Preview A4 sheet"
            >
              <Eye size={13} /> Preview A4
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-teal-200 hover:text-white hover:bg-white/10 transition ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body: Scrollable Editor */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {/* SECTION 1: Patient Details */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-100">
              <Stethoscope size={14} className="text-[#0F6E56]" />
              1. Patient Demographics (DOB & Age)
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Date of Birth (DOB)</label>
                <DobCalendarPicker
                  value={patientDob}
                  onChange={handleDobChange}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Age (Years)</label>
                <input
                  type="number"
                  value={patientAge}
                  onChange={(e) => setPatientAge(e.target.value)}
                  placeholder="e.g. 35"
                  className="input text-xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Clinical Notes (Chief Complaint, Symptoms, Diagnosis) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider pb-1 border-b border-slate-100">
              <FileText size={14} className="text-[#0F6E56]" />
              2. Clinical Notes & Working Diagnosis
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Chief Complaint</label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Fever and body ache since 2 days."
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Symptoms Noted</label>
                <input
                  type="text"
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  placeholder="e.g. Fever, headache, mild cough, body ache"
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Working Diagnosis *</label>
                <input
                  type="text"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g. Viral Fever (Provisional Diagnosis)"
                  className="input text-xs font-semibold text-slate-900 border-[#0F6E56]/40"
                  required
                />
              </div>
            </div>

            {/* Vitals row */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1.5">
                Patient Vitals
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Temperature</span>
                  <input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="101.2 °F"
                    className="input text-xs py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Blood Pressure (BP)</span>
                  <input
                    type="text"
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    placeholder="120/80 mmHg"
                    className="input text-xs py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">Pulse Rate</span>
                  <input
                    type="text"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="96/min"
                    className="input text-xs py-1"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-medium">SpO₂ Oxygen</span>
                  <input
                    type="text"
                    value={spo2}
                    onChange={(e) => setSpo2(e.target.value)}
                    placeholder="98%"
                    className="input text-xs py-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Medicine Prescription Table */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <Pill size={14} className="text-[#0F6E56]" />
                3. Prescribed Medications (Rx Table)
              </div>
              <button
                type="button"
                onClick={handleAddMedicine}
                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0F6E56] border border-teal-200 text-xs font-bold flex items-center gap-1 transition"
              >
                <Plus size={13} /> Add Medicine
              </button>
            </div>

            <div className="space-y-2.5">
              {medicines.map((med, idx) => (
                <div key={med.id || idx} className="p-3 rounded-lg border border-slate-200 bg-slate-50/40 space-y-2 relative group hover:border-[#0F6E56]/40 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#0F6E56] bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      Medicine #{idx + 1}
                    </span>
                    {medicines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMedicine(idx)}
                        className="text-slate-400 hover:text-red-500 p-1 transition"
                        title="Delete medicine row"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    {/* Medicine Name (col 4 with Interactive Suggestion Dropdown) */}
                    <div className="sm:col-span-4 relative">
                      <div className="flex items-center justify-between mb-0.5">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase">
                          Medicine Name *
                        </label>
                        <span className="text-[9px] text-[#0F6E56] font-semibold hidden sm:inline">
                          Type to search list
                        </span>
                      </div>
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => {
                          handleUpdateMedicine(idx, 'name', e.target.value);
                          setActiveSuggestionIdx(idx);
                        }}
                        onFocus={() => setActiveSuggestionIdx(idx)}
                        onBlur={() => {
                          setTimeout(() => {
                            setActiveSuggestionIdx((curr) => curr === idx ? null : curr);
                          }, 220);
                        }}
                        placeholder="e.g. Paracetamol, Pan 40, Cetirizine..."
                        className="input text-xs font-semibold py-1.5 focus:border-[#0F6E56]"
                        autoComplete="off"
                        required
                      />

                      {/* Medicine Search Suggestions Dropdown */}
                      {activeSuggestionIdx === idx && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-white rounded-xl shadow-2xl border border-teal-200/90 overflow-hidden max-h-64 overflow-y-auto divide-y divide-slate-100 animate-fade-in">
                          <div className="px-3 py-1.5 bg-teal-50 flex items-center justify-between text-[10px] font-bold text-[#0F6E56] border-b border-teal-100 sticky top-0 backdrop-blur-xs">
                            <span>Select Medicine ({getRowSuggestions(med.name).length})</span>
                            <span className="text-[9px] font-normal text-slate-500">Auto-fills dose & timing</span>
                          </div>

                          {getRowSuggestions(med.name).length > 0 ? (
                            getRowSuggestions(med.name).map((s, sIdx) => (
                              <div
                                key={`${s.name}-${sIdx}`}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectMedicine(idx, s);
                                }}
                                className="px-3 py-2 hover:bg-teal-50/80 cursor-pointer transition text-left flex items-start justify-between gap-2 group"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-xs text-slate-900 group-hover:text-[#0F6E56]">
                                      {s.name}
                                    </span>
                                    {s.category && (
                                      <span className="text-[9px] font-medium text-teal-700 bg-teal-100/70 px-1.5 py-0.2 rounded">
                                        {s.category}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[9.5px] text-slate-500 mt-0.5">
                                    <span className="font-medium text-slate-700">{s.dose}</span>
                                    <span>•</span>
                                    <span>{s.timesPerDay}</span>
                                    <span>•</span>
                                    <span className="text-teal-700 font-medium">{s.foodInstruction}</span>
                                    {s.instructions && (
                                      <>
                                        <span>•</span>
                                        <span className="italic truncate">{s.instructions}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <span className="text-[10px] font-bold text-[#0F6E56] bg-teal-50 group-hover:bg-teal-600 group-hover:text-white border border-teal-200 px-2 py-0.5 rounded transition shrink-0 mt-0.5">
                                  Select
                                </span>
                              </div>
                            ))
                          ) : (
                            <div className="p-3 text-center text-xs text-slate-500">
                              <p className="font-semibold text-slate-700">No preset match for "{med.name}"</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">You can keep typing any custom medicine name and dosage.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Dose (col 2) */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Dose</label>
                      <input
                        type="text"
                        value={med.dose}
                        onChange={(e) => handleUpdateMedicine(idx, 'dose', e.target.value)}
                        placeholder="1 Tablet"
                        className="input text-xs py-1.5"
                      />
                    </div>

                    {/* Times / Day (col 3) */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Times / Day</label>
                      <select
                        value={med.timesPerDay}
                        onChange={(e) => handleUpdateMedicine(idx, 'timesPerDay', e.target.value)}
                        className="select text-xs py-1.5"
                      >
                        <option value="1 time/day">1 time/day</option>
                        <option value="2 times/day">2 times/day</option>
                        <option value="3 times/day">3 times/day</option>
                        <option value="4 times/day">4 times/day</option>
                        <option value="1 time/week">1 time/week</option>
                        <option value="As needed (SOS)">As needed (SOS)</option>
                      </select>
                    </div>

                    {/* Duration (col 3) */}
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Duration</label>
                      <input
                        type="text"
                        value={med.duration}
                        onChange={(e) => handleUpdateMedicine(idx, 'duration', e.target.value)}
                        placeholder="3 Days / 1 Week"
                        className="input text-xs py-1.5"
                      />
                    </div>

                    {/* Intake Time (col 4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Intake Timing</label>
                      <input
                        type="text"
                        value={med.intakeTime}
                        onChange={(e) => handleUpdateMedicine(idx, 'intakeTime', e.target.value)}
                        placeholder="e.g. Morning, Afternoon, Night"
                        className="input text-xs py-1.5"
                      />
                    </div>

                    {/* Food Instruction (col 4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Food Instruction</label>
                      <select
                        value={med.foodInstruction}
                        onChange={(e) => handleUpdateMedicine(idx, 'foodInstruction', e.target.value)}
                        className="select text-xs py-1.5"
                      >
                        <option value="After Food">After Food</option>
                        <option value="Before Food">Before Food</option>
                        <option value="With Food">With Food</option>
                        <option value="Empty Stomach">Empty Stomach</option>
                        <option value="Before Breakfast">Before Breakfast</option>
                        <option value="At Bedtime">At Bedtime</option>
                      </select>
                    </div>

                    {/* Instructions (col 4) */}
                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Instructions</label>
                      <input
                        type="text"
                        value={med.instructions}
                        onChange={(e) => handleUpdateMedicine(idx, 'instructions', e.target.value)}
                        placeholder="e.g. For fever and body ache"
                        className="input text-xs py-1.5"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddMedicine}
              className="w-full py-2 rounded-lg border-2 border-dashed border-teal-200 hover:border-[#0F6E56] text-[#0F6E56] hover:bg-teal-50/50 text-xs font-bold flex items-center justify-center gap-1.5 transition"
            >
              <Plus size={14} /> + Add Another Medicine Row
            </button>
          </div>

          {/* SECTION 4: Advice, Lab Tests & Follow-up */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Advice */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <FileText size={13} className="text-[#0F6E56]" />
                4. Advice / Lifestyle (One per line)
              </div>
              <textarea
                value={adviceText}
                onChange={(e) => setAdviceText(e.target.value)}
                rows={4}
                className="input text-xs font-medium"
                placeholder="• Drink plenty of water and stay hydrated.&#10;• Take adequate rest."
              />
            </div>

            {/* Recommended Tests */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center gap-1.5 text-slate-800 font-bold text-xs uppercase tracking-wider">
                <Stethoscope size={13} className="text-[#0F6E56]" />
                5. Recommended Tests / Follow-up
              </div>
              <textarea
                value={testsText}
                onChange={(e) => setTestsText(e.target.value)}
                rows={4}
                className="input text-xs font-medium"
                placeholder="• Complete Blood Count (CBC)&#10;• Vitamin D (25-OH)"
              />
            </div>
          </div>

          {/* SECTION 6: Follow-up Date & Notes */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Recommended Follow-up Date
              </label>
              <input
                type="date"
                min={todayISO()}
                value={formatDobForInput(followUpDate)}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="input text-xs"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                Confidential Doctor Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal clinical notes (optional)"
                className="input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-white px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn-ghost text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="btn-outline text-xs flex items-center gap-1.5 text-slate-700 hover:text-slate-900"
            >
              <Eye size={14} /> Preview Live A4 Sheet
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Prescription'}
            </button>

            {appointment && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={saving}
                className="btn-primary text-xs flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={14} /> {saving ? 'Saving...' : 'Save & Mark Appointment Done'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Embedded Live A4 Prescription View Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/85 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in">
          <div className="relative max-w-4xl w-full my-auto">
            <PrescriptionView
              data={currentPrescriptionData}
              onClose={() => setShowPreview(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
export default WritePrescriptionModal;
