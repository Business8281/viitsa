import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Users,
  Stethoscope,
  Clock,
  MapPin,
  Phone,
  Globe,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Plus,
  X,
  User,
} from 'lucide-react';
import { db, firebaseConfig } from '../lib/firebase';
import { updateDoc, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';

const STEPS = [
  { id: 1, title: 'Clinic Details', icon: Building2, desc: 'Basic clinic information' },
  { id: 2, title: 'Doctors', icon: Stethoscope, desc: 'Add your medical staff' },
  { id: 3, title: 'Staff', icon: Users, desc: 'Add your support team' },
  { id: 4, title: 'Working Hours', icon: Clock, desc: 'Set your schedule' },
];

const SPECIALIZATIONS = [
  'General Medicine',
  'Pediatrics',
  'Orthopedics',
  'Dermatology',
  'Gynecology',
  'ENT',
  'Cardiology',
  'Neurology',
  'Psychiatry',
  'Ophthalmology',
  'Dentistry',
];

export function SetupWizardPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast: showToast } = useToast();
  const { user, clinic } = useAuth();

  const [clinicDetails, setClinicDetails] = useState({
    address: clinic?.address || '',
    city: clinic?.city || '',
    pincode: '',
    phone: clinic?.phone || '',
    email: clinic?.email || '',
    website: '',
    departments: [] as string[],
  });

  const [doctors, setDoctors] = useState([
    { name: '', email: '', phone: '', specialization: 'General Medicine', color: '#05C994' },
  ]);

  const [staff, setStaff] = useState([
    { name: '', email: '', phone: '', role: 'Receptionist', color: '#E08600' },
  ]);

  const [workingHours, setWorkingHours] = useState({
    open: '09:00',
    close: '19:00',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  });

  const [newDepartment, setNewDepartment] = useState('');

  const updateClinicDetails = (key: string, value: string | string[]) => {
    setClinicDetails({ ...clinicDetails, [key]: value });
  };

  const addDepartment = () => {
    if (newDepartment.trim() && !clinicDetails.departments.includes(newDepartment.trim())) {
      setClinicDetails({
        ...clinicDetails,
        departments: [...clinicDetails.departments, newDepartment.trim()],
      });
      setNewDepartment('');
    }
  };

  const removeDepartment = (dept: string) => {
    setClinicDetails({
      ...clinicDetails,
      departments: clinicDetails.departments.filter((d) => d !== dept),
    });
  };

  const updateDoctor = (index: number, key: string, value: string) => {
    const updated = [...doctors];
    updated[index] = { ...updated[index], [key]: value };
    setDoctors(updated);
  };

  const addDoctor = () => {
    setDoctors([
      ...doctors,
      { name: '', email: '', phone: '', specialization: 'General Medicine', color: '#05C994' },
    ]);
  };

  const removeDoctor = (index: number) => {
    if (doctors.length > 1) {
      setDoctors(doctors.filter((_, i) => i !== index));
    }
  };

  const updateStaff = (index: number, key: string, value: string) => {
    const updated = [...staff];
    updated[index] = { ...updated[index], [key]: value };
    setStaff(updated);
  };

  const addStaff = () => {
    setStaff([...staff, { name: '', email: '', phone: '', role: 'Receptionist', color: '#E08600' }]);
  };

  const removeStaff = (index: number) => {
    if (staff.length > 1) {
      setStaff(staff.filter((_, i) => i !== index));
    }
  };

  const toggleDay = (day: string) => {
    if (workingHours.days.includes(day)) {
      if (workingHours.days.length > 1) {
        setWorkingHours({
          ...workingHours,
          days: workingHours.days.filter((d) => d !== day),
        });
      }
    } else {
      setWorkingHours({
        ...workingHours,
        days: [...workingHours.days, day],
      });
    }
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    if (!user?.clinic_id) {
      showToast('User session not found', 'error');
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      // Update clinic details
      await updateDoc(doc(db, 'clinics', user.clinic_id), {
        address: clinicDetails.address,
        city: clinicDetails.city,
        phone: clinicDetails.phone,
        email: clinicDetails.email,
        working_hours: workingHours,
        departments: clinicDetails.departments.length > 0 ? clinicDetails.departments : null,
      });

      // Use a secondary app to create users without logging out
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      // Add doctors
      for (const docUser of doctors) {
        if (docUser.name.trim()) {
          if (!docUser.email?.trim()) continue;
          const tempPassword = crypto.randomUUID();
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, docUser.email.toLowerCase(), tempPassword);
          const userId = userCredential.user.uid;
          await setDoc(doc(db, 'users', userId), {
            user_id: userId,
            clinic_id: user.clinic_id,
            name: docUser.name,
            email: docUser.email.toLowerCase(),
            phone: docUser.phone,
            role: 'doctor',
            specialisation: docUser.specialization,
            avatar_color: docUser.color,
            active: true,
            created_at: new Date().toISOString()
          });
        }
      }

      // Add staff
      for (const member of staff) {
        if (member.name.trim()) {
          if (!member.email?.trim()) continue;
          const tempPassword = crypto.randomUUID();
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, member.email.toLowerCase(), tempPassword);
          const userId = userCredential.user.uid;
          await setDoc(doc(db, 'users', userId), {
            user_id: userId,
            clinic_id: user.clinic_id,
            name: member.name,
            email: member.email.toLowerCase(),
            phone: member.phone,
            role: 'staff',
            avatar_color: member.color,
            active: true,
            created_at: new Date().toISOString()
          });
        }
      }
      
      await secondaryAuth.signOut();

      showToast('Setup completed successfully!', 'success');
      navigate('/clinic/dashboard');
    } catch (error) {
      showToast('Setup could not be completed. Please check your connection and try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return clinicDetails.city.trim() !== '';
      case 2:
        return doctors.some((d) => d.name.trim() !== '');
      case 3:
        return staff.some((s) => s.name.trim() !== '');
      case 4:
        return workingHours.days.length > 0;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <ViitsaLogo size="sm" />
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              Step {step} of 4
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white border-b border-slate-100 border-t border-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => s.id < step && setStep(s.id)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                    step === s.id
                      ? 'bg-emerald-50 text-emerald-600'
                      : s.id < step
                      ? 'text-slate-400 hover:text-slate-600'
                      : 'text-slate-300'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      step === s.id
                        ? 'bg-emerald-500 text-white'
                        : s.id < step
                        ? 'bg-emerald-100 text-emerald-500'
                        : 'bg-slate-100 text-slate-300'
                    }`}
                  >
                    {s.id < step ? <CheckCircle className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-sm font-medium">{s.title}</p>
                    <p className="text-xs text-slate-400">{s.desc}</p>
                  </div>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 mx-2 ${s.id < step ? 'bg-emerald-200' : 'bg-slate-100'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden">
          {/* Step 1: Clinic Details */}
          {step === 1 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Clinic Details</h2>
                <p className="text-slate-600">Add your clinic's address and contact information</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-3.5 w-5 h-5 text-slate-400" />
                    <textarea
                      value={clinicDetails.address}
                      onChange={(e) => updateClinicDetails('address', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Plot 42, KPHB Colony, Kukatpally"
                      rows={2}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">City *</label>
                    <input
                      type="text"
                      value={clinicDetails.city}
                      onChange={(e) => updateClinicDetails('city', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Hyderabad"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">PIN Code</label>
                    <input
                      type="text"
                      value={clinicDetails.pincode}
                      onChange={(e) => updateClinicDetails('pincode', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="500072"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="tel"
                        value={clinicDetails.phone}
                        onChange={(e) => updateClinicDetails('phone', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="+91 98765 43210"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                    <div className="relative">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        type="email"
                        value={clinicDetails.email}
                        onChange={(e) => updateClinicDetails('email', e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        placeholder="clinic@example.com"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Website</label>
                  <div className="relative">
                    <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={clinicDetails.website}
                      onChange={(e) => updateClinicDetails('website', e.target.value)}
                      className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder=""
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Departments</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {clinicDetails.departments.map((dept) => (
                      <span
                        key={dept}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-sm rounded-lg"
                      >
                        {dept}
                        <button
                          onClick={() => removeDepartment(dept)}
                          className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-500 hover:bg-emerald-200 flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      placeholder="Add department (e.g., Pediatrics)"
                    />
                    <button
                      onClick={addDepartment}
                      className="px-4 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Doctors */}
          {step === 2 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Add Doctors</h2>
                <p className="text-slate-600">Add medical staff who will see patients</p>
              </div>

              <div className="space-y-4">
                {doctors.map((doc, index) => (
                  <div
                    key={index}
                    className="p-4 border border-slate-200 rounded-xl bg-slate-50/50"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: doc.color }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                        >
                          {doc.name ? doc.name[0].toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {doc.name || 'New Doctor'}
                          </p>
                          <p className="text-sm text-slate-500">{doc.specialization}</p>
                        </div>
                      </div>
                      {doctors.length > 1 && (
                        <button
                          onClick={() => removeDoctor(index)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                        <input
                          type="text"
                          value={doc.name}
                          onChange={(e) => updateDoctor(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="Dr. Priya Rao"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Specialization</label>
                        <select
                          value={doc.specialization}
                          onChange={(e) => updateDoctor(index, 'specialization', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        >
                          {SPECIALIZATIONS.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={doc.email}
                          onChange={(e) => updateDoctor(index, 'email', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="doctor@clinic.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={doc.phone}
                          onChange={(e) => updateDoctor(index, 'phone', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="+91 98765 11111"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addDoctor}
                  className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Doctor
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Staff */}
          {step === 3 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Add Staff</h2>
                <p className="text-slate-600">Add receptionists and support staff</p>
              </div>

              <div className="space-y-4">
                {staff.map((member, index) => (
                  <div
                    key={index}
                    className="p-4 border border-slate-200 rounded-xl bg-slate-50/50"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          style={{ backgroundColor: member.color }}
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                        >
                          {member.name ? member.name[0].toUpperCase() : <User className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">
                            {member.name || 'New Staff'}
                          </p>
                          <p className="text-sm text-slate-500">{member.role}</p>
                        </div>
                      </div>
                      {staff.length > 1 && (
                        <button
                          onClick={() => removeStaff(index)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateStaff(index, 'name', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="Reena Kumar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
                        <input
                          type="text"
                          value={member.role}
                          onChange={(e) => updateStaff(index, 'role', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="Receptionist"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={member.phone}
                          onChange={(e) => updateStaff(index, 'phone', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          placeholder="+91 98765 22222"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  onClick={addStaff}
                  className="w-full p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Staff Member
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Working Hours */}
          {step === 4 && (
            <div className="p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Working Hours</h2>
                <p className="text-slate-600">Set your clinic's operating schedule</p>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <label className="block text-sm font-medium text-emerald-700 mb-2">Opening Time</label>
                    <input
                      type="time"
                      value={workingHours.open}
                      onChange={(e) => setWorkingHours({ ...workingHours, open: e.target.value })}
                      className="w-full text-2xl font-mono text-center px-4 py-3 rounded-lg border border-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <label className="block text-sm font-medium text-slate-600 mb-2">Closing Time</label>
                    <input
                      type="time"
                      value={workingHours.close}
                      onChange={(e) => setWorkingHours({ ...workingHours, close: e.target.value })}
                      className="w-full text-2xl font-mono text-center px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Working Days</label>
                  <div className="flex flex-wrap gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                          workingHours.days.includes(day)
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <p className="text-sm text-slate-600 mb-2">
                    Your clinic will be shown as
                  </p>
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-emerald-500" />
                    <span className="text-lg font-medium text-slate-800">
                      {workingHours.open} - {workingHours.close}
                    </span>
                    <span className="text-slate-500">on</span>
                    <span className="text-slate-800">{workingHours.days.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="p-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-slate-600 font-medium hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={loading}
                className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    Complete Setup
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-sm text-slate-500 mt-4">
          You can change these settings anytime from the Settings page
        </p>
      </div>
    </div>
  );
}
