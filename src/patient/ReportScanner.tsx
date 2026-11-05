import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, FileText, Loader2, CheckCircle, ChevronLeft, Save, Plus, Trash2, X } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, updateDoc, getDocs, query, where } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { localDateISO } from '../lib/format';
import type { User } from '../lib/types';

interface ClinicOption {
  id: string;
  name: string;
}

interface DoctorOption {
  id: string;
  name: string;
}

interface Props {
  patientId: string | null;
  patientName: string;
  accountId: string | null;
  clinicId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

interface SelectedFileItem {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  category: string;
}

type ScannerMode = 'choose' | 'preview' | 'uploading' | 'done';

const REPORT_CATEGORIES = [
  'Blood Test / Pathology',
  'Radiology / Scan (X-Ray, MRI, CT)',
  'Prescription / Medication Slip',
  'Discharge Summary',
  'Doctor Consultation Note',
  'Other Medical Document'
];

export function ReportScanner({ patientId, patientName, accountId, clinicId, onBack, onSaved }: Props) {
  const [mode, setMode] = useState<ScannerMode>('choose');
  const [items, setItems] = useState<SelectedFileItem[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [selectedClinic, setSelectedClinic] = useState<string>('');
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');

  const [clinics, setClinics] = useState<ClinicOption[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Load Clinics
  useEffect(() => {
    const fetchClinics = async () => {
      try {
        const snap = await getDocs(collection(db, 'clinics'));
        const cls: ClinicOption[] = [];
        snap.forEach(doc => {
          cls.push({ id: doc.data().clinic_id || doc.id, name: doc.data().name || 'Clinic' });
        });
        setClinics(cls);
      } catch (err) {
        console.error('Failed to load clinics', err);
      }
    };
    fetchClinics();
  }, []);

  // Load Doctors when clinic changes
  useEffect(() => {
    if (!selectedClinic) {
      setDoctors([]);
      setSelectedDoctor('');
      return;
    }
    const fetchDoctors = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          where('clinic_id', '==', selectedClinic),
          where('role', '==', 'clinic_doctor'),
          where('active', '==', true)
        );
        const snap = await getDocs(q);
        const docs: DoctorOption[] = [];
        snap.forEach(d => {
          const u = d.data() as User;
          docs.push({ id: u.user_id || d.id, name: u.name });
        });
        setDoctors(docs);
        if (docs.length > 0) {
          setSelectedDoctor(docs[0].id);
        } else {
          setSelectedDoctor('');
        }
      } catch (err) {
        console.error('Failed to load doctors', err);
      }
    };
    fetchDoctors();
  }, [selectedClinic]);

  const handleMultipleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedList = e.target.files;
    if (!selectedList || selectedList.length === 0) return;

    const newItems: SelectedFileItem[] = Array.from(selectedList).map((f, i) => {
      const cleanName = f.name.replace(/\.[^/.]+$/, '');
      return {
        id: `${Date.now()}_${i}_${Math.random()}`,
        file: f,
        previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : '',
        name: cleanName || `Medical Report ${items.length + i + 1}`,
        category: 'Blood Test / Pathology'
      };
    });

    setItems(prev => [...prev, ...newItems]);
    setMode('preview');
    // reset input so same files can be chosen again if needed
    if (e.target) e.target.value = '';
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      if (updated.length === 0) {
        setMode('choose');
      }
      return updated;
    });
  };

  const updateItemField = (id: string, field: 'name' | 'category', value: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const startBatchUpload = async () => {
    if (!patientId || items.length === 0) return;

    setMode('uploading');
    setSaving(true);
    setUploadProgress(0);
    setCurrentUploadIndex(0);

    const folderName = (patientName || 'patient').replace(/[^a-zA-Z0-9]/g, '_');
    const totalCount = items.length;

    try {
      for (let i = 0; i < totalCount; i++) {
        const item = items[i];
        setCurrentUploadIndex(i + 1);

        const timestamp = Date.now();
        const sanitizedRecordName = (item.name || item.file.name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const extension = item.file.name.split('.').pop() || 'pdf';
        const metadata = {
          contentType: item.file.type || 'application/pdf',
          contentDisposition: 'inline'
        };
        const filePath = `patients/${folderName}/health_reports/${sanitizedRecordName}_${timestamp}_${i}.${extension}`;
        const storageRef = ref(storage, filePath);
        const uploadTask = uploadBytesResumable(storageRef, item.file, metadata);

        // Upload file with progress tracking
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed', 
            (snapshot) => {
              const filePct = snapshot.bytesTransferred / snapshot.totalBytes;
              const overall = ((i + filePct) / totalCount) * 100;
              setUploadProgress(Math.min(99, overall));
            },
            (error) => {
              console.error('File upload failed:', error);
              reject(error);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

                const doctorObj = selectedDoctor ? doctors.find(d => d.id === selectedDoctor) : null;
                const docName = doctorObj?.name || null;
                const reportTitle = item.name || 'Medical Report';

                // Save report doc to Firestore
                const docRef = await addDoc(collection(db, 'health_reports'), {
                  patient_id: patientId,
                  account_id: accountId,
                  clinic_id: selectedClinic || clinicId || null,
                  doctor_id: selectedDoctor || null,
                  doctor_name: docName,
                  prescribed_by: docName,
                  report_type: reportTitle,
                  test_name: reportTitle,
                  title: reportTitle,
                  name: reportTitle,
                  category: item.category,
                  report_date: localDateISO(),
                  hospital_or_doctor: docName,
                  original_file_url: downloadUrl,
                  file_url: downloadUrl,
                  download_url: downloadUrl,
                  original_file_type: item.file.type,
                  ai_processed: false,
                  created_at: new Date().toISOString()
                });

                await updateDoc(docRef, { report_id: docRef.id });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      }

      setUploadProgress(100);
      setMode('done');
      setSaving(false);
      onSaved();
    } catch (err: any) {
      console.error('Batch upload error:', err);
      alert('Upload failed: ' + (err.message || 'Network error'));
      setSaving(false);
      setMode('preview');
    }
  };

  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] pb-24">
        <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Upload Medical Records</p>
        </div>

        <div className="px-4 py-6 max-w-xl mx-auto">
          <p className="text-gray-600 text-sm mb-6">
            Securely upload one or multiple medical documents at once (PDFs, Lab Results, X-Rays, Prescriptions). You can choose which clinic and doctor can view them.
          </p>

          <div className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleMultipleFilesSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              multiple
              onChange={handleMultipleFilesSelect}
              className="hidden"
            />

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm active:bg-gray-50 transition"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Camera size={24} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Take a Photo / Scan</p>
                <p className="text-xs text-gray-500">Capture document directly with camera</p>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm active:bg-gray-50 transition"
            >
              <div className="h-14 w-14 rounded-2xl bg-teal-50 flex items-center justify-center shrink-0">
                <Upload size={24} className="text-teal-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Upload Multiple Files</p>
                <p className="text-xs text-gray-500">Select multiple PDFs, images, or documents at once</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'preview') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] pb-24">
        <div className="bg-primary px-4 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setMode('choose')} className="p-2 rounded-xl bg-white/10 text-white">
              <ChevronLeft size={18} />
            </button>
            <p className="text-sm font-bold text-white">Review Reports ({items.length})</p>
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold bg-white/20 text-white px-3 py-1.5 rounded-lg hover:bg-white/30 flex items-center gap-1 transition"
          >
            <Plus size={14} /> Add More Files
          </button>
        </div>

        <div className="px-4 py-4 space-y-4 max-w-xl mx-auto">
          {/* Hidden inputs to add more files */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={handleMultipleFilesSelect}
            className="hidden"
          />

          {/* Destination Clinic & Doctor */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
            <p className="text-xs font-bold text-gray-700 uppercase">Share With Clinic & Doctor (Optional)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Clinic</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  value={selectedClinic}
                  onChange={e => setSelectedClinic(e.target.value)}
                >
                  <option value="">Personal Record (No Clinic)</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-gray-500 block mb-1">Doctor</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  value={selectedDoctor}
                  onChange={e => setSelectedDoctor(e.target.value)}
                  disabled={!selectedClinic}
                >
                  <option value="">Any Available Doctor</option>
                  {doctors.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* List of Selected Documents */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700 uppercase">Selected Documents ({items.length})</span>
              <span className="text-[11px] text-gray-400">All will be uploaded simultaneously</span>
            </div>

            {items.map((item, idx) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm space-y-2.5 relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{item.file.name}</p>
                      <p className="text-[10px] text-gray-400">{(item.file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => removeItem(item.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                    title="Remove this file"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-semibold block mb-0.5">Report Title</label>
                    <input 
                      type="text" 
                      value={item.name}
                      onChange={e => updateItemField(item.id, 'name', e.target.value)}
                      placeholder="e.g. Blood Test Report"
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-semibold block mb-0.5">Category</label>
                    <select
                      value={item.category}
                      onChange={e => updateItemField(item.id, 'category', e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
                    >
                      {REPORT_CATEGORIES.map((cat, ci) => (
                        <option key={ci} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button
              onClick={startBatchUpload}
              disabled={items.length === 0}
              className="w-full rounded-xl py-4 text-base font-semibold text-white flex items-center justify-center gap-2 transition-colors shadow-sm"
              style={{ backgroundColor: '#0F6E56' }}
            >
              <Save size={20} />
              Securely Upload All ({items.length}) Reports
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'uploading') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center px-6">
        <div className="relative h-20 w-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div 
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Upload size={28} className="text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Uploading Multiple Reports...</h2>
        <p className="text-sm text-gray-600 font-semibold mb-1">
          Uploading document {currentUploadIndex} of {items.length}
        </p>
        <p className="text-xs text-gray-400 text-center mb-4">
          {Math.round(uploadProgress)}% total progress
        </p>
        <div className="w-64 bg-gray-200 h-2.5 rounded-full overflow-hidden">
          <div className="bg-primary h-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
        </div>
      </div>
    );
  }

  if (mode === 'done') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center px-6">
        <div className="h-20 w-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Upload Complete ({items.length} Reports)</h2>
        <p className="text-sm text-gray-500 text-center mb-6 max-w-sm">
          All your medical documents have been securely stored in the cloud database and synced in real time.
        </p>
        <button
          onClick={onBack}
          className="rounded-xl px-6 py-3 font-semibold text-white transition-colors hover:bg-primary/90"
          style={{ backgroundColor: '#0F6E56' }}
        >
          Back to Records
        </button>
      </div>
    );
  }

  return null;
}
