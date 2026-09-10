import { useState, useRef } from 'react';
import { Camera, Upload, FileText, Loader2, AlertTriangle, CheckCircle, ChevronLeft, Save, Eye } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import { formatDate, localDateISO } from '../lib/format';
import type { HealthReport, HealthFinding } from '../lib/types';

interface Props {
  patientId: string | null;
  accountId: string | null;
  clinicId: string | null;
  onBack: () => void;
  onSaved: () => void;
}

type ScannerMode = 'choose' | 'preview' | 'processing' | 'review' | 'done';

export function ReportScanner({ patientId, accountId, clinicId, onBack, onSaved }: Props) {
  const [mode, setMode] = useState<ScannerMode>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<Partial<HealthReport> | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setMode('preview');
  };

  const processWithAI = async () => {
    setMode('processing');

    // Simulate AI processing - in production, this would call OpenAI Vision or Claude API
    await new Promise(r => setTimeout(r, 2500));

    // Mock extracted data based on file name or random
    const mockData: Partial<HealthReport> = {
      report_type: 'Blood Test',
      report_date: localDateISO(),
      hospital_or_doctor: 'Sample Diagnostic Lab',
      key_findings: [
        { name: 'Hemoglobin', value: '13.5', unit: 'g/dL', normal_range: '12-16', is_abnormal: false },
        { name: 'Fasting Blood Sugar', value: '145', unit: 'mg/dL', normal_range: '70-100', is_abnormal: true },
        { name: 'Cholesterol', value: '185', unit: 'mg/dL', normal_range: '<200', is_abnormal: false },
        { name: 'Blood Pressure', value: '138/88', unit: 'mmHg', normal_range: '120/80', is_abnormal: true },
      ],
      diagnosis: 'Pre-diabetic condition, mild hypertension',
      summary: 'Your blood test shows slightly elevated blood sugar (145 mg/dL) and blood pressure (138/88). While not immediately concerning, these levels suggest you should focus on diet and exercise. Please consult your doctor for personalized advice.',
      urgent_flags: ['Fasting Blood Sugar elevated', 'Blood Pressure slightly high'],
      ai_processed: true,
    };

    setExtractedData(mockData);
    setMode('review');
  };

  const saveReport = async () => {
    if (!patientId || !extractedData) return;
    setSaving(true);

    try {
      const docRef = await addDoc(collection(db, 'health_reports'), {
        patient_id: patientId,
        account_id: accountId,
        clinic_id: clinicId,
        report_type: extractedData.report_type || 'Medical Report',
        report_date: extractedData.report_date,
        hospital_or_doctor: extractedData.hospital_or_doctor,
        key_findings: extractedData.key_findings || [],
        diagnosis: extractedData.diagnosis,
        summary: extractedData.summary,
        urgent_flags: extractedData.urgent_flags || [],
        ai_processed: true,
      });
      await updateDoc(docRef, { report_id: docRef.id });
      setMode('done');
      onSaved();
    } catch(error) {
      console.error(error);
    }
    setSaving(false);
  };

  // Choose mode screen
  if (mode === 'choose') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] pb-24">
        <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Scan Medical Report</p>
        </div>

        <div className="px-4 py-6">
          <p className="text-gray-600 text-sm mb-6">
            Upload your medical report and our AI will extract all the important information automatically.
          </p>

          <div className="space-y-4">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Camera size={24} className="text-primary" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Take photo</p>
                <p className="text-xs text-gray-500">Use camera to scan your report</p>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-white rounded-2xl border border-gray-100 p-6 flex items-center gap-4 shadow-sm"
            >
              <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                <Upload size={24} className="text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Upload from gallery</p>
                <p className="text-xs text-gray-500">Select image or PDF file</p>
              </div>
            </button>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-yellow-50 border border-yellow-100">
            <p className="text-xs text-yellow-800">
              <strong>Supported:</strong> Blood tests, X-ray reports, prescriptions, discharge summaries, and lab reports.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Preview mode
  if (mode === 'preview' && previewUrl) {
    return (
      <div className="min-h-screen bg-[#F5FAFA] pb-24">
        <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => setMode('choose')} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Preview Report</p>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
            {file?.type.startsWith('image/') ? (
              <img src={previewUrl} alt="Report preview" className="w-full" />
            ) : (
              <div className="h-48 flex items-center justify-center bg-gray-50">
                <FileText size={48} className="text-gray-300" />
                <p className="text-sm text-gray-500 ml-3">{file?.name}</p>
              </div>
            )}
          </div>

          <button
            onClick={processWithAI}
            className="w-full mt-4 rounded-xl py-4 text-base font-semibold text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#0F6E56' }}
          >
            <Eye size={20} />
            Scan this report
          </button>
        </div>
      </div>
    );
  }

  // Processing mode
  if (mode === 'processing') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center px-6">
        <div className="relative h-20 w-20 mb-6">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <FileText size={28} className="text-primary" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Processing your report...</h2>
        <p className="text-sm text-gray-500 text-center">
          Our AI is reading and extracting information from your medical report.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 size={14} className="animate-spin" />
          Analyzing document...
        </div>
      </div>
    );
  }

  // Review mode
  if (mode === 'review' && extractedData) {
    const abnormalFindings = extractedData.key_findings?.filter(f => f.is_abnormal) || [];
    const normalFindings = extractedData.key_findings?.filter(f => !f.is_abnormal) || [];

    return (
      <div className="min-h-screen bg-[#F5FAFA] pb-32">
        <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
          <button onClick={() => setMode('choose')} className="p-2 rounded-xl bg-white/10 text-white">
            <ChevronLeft size={18} />
          </button>
          <p className="text-sm font-bold text-white">Review Extracted Data</p>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* Report summary card */}
          <div className="rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm">
            <div className="px-4 py-3 bg-primary/5 border-b border-gray-100">
              <p className="text-xs text-gray-500 uppercase font-semibold">Report Summary</p>
            </div>
            <div className="p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Type</span>
                <span className="text-sm font-semibold text-gray-900">{extractedData.report_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm font-semibold text-gray-900">{extractedData.report_date ? formatDate(extractedData.report_date) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Hospital/Doctor</span>
                <span className="text-sm font-semibold text-gray-900">{extractedData.hospital_or_doctor || '—'}</span>
              </div>
            </div>
          </div>

          {/* Urgent flags */}
          {abnormalFindings.length > 0 && (
            <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={16} className="text-red-600" />
                <p className="text-sm font-bold text-red-800">Values needing attention</p>
              </div>
              <div className="space-y-2">
                {abnormalFindings.map((f, i) => (
                  <FindingRow key={i} finding={f} isAbnormal />
                ))}
              </div>
            </div>
          )}

          {/* Normal findings */}
          {normalFindings.length > 0 && (
            <div className="rounded-2xl bg-white border border-gray-100 p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-600" />
                <p className="text-sm font-bold text-gray-900">Normal values</p>
              </div>
              <div className="space-y-2">
                {normalFindings.map((f, i) => (
                  <FindingRow key={i} finding={f} />
                ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {extractedData.summary && (
            <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
              <p className="text-xs text-blue-600 uppercase font-semibold mb-2">What this means for you</p>
              <p className="text-sm text-blue-900">{extractedData.summary}</p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4">
          <button
            onClick={saveReport}
            disabled={saving}
            className="w-full rounded-xl py-4 text-base font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ backgroundColor: '#0F6E56' }}
          >
            <Save size={20} />
            {saving ? 'Saving...' : 'Save to My Records'}
          </button>
        </div>
      </div>
    );
  }

  // Done mode
  if (mode === 'done') {
    return (
      <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center px-6">
        <div className="h-20 w-20 rounded-full bg-[#E1F5EE] flex items-center justify-center mb-4">
          <CheckCircle size={40} className="text-primary" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Report Saved!</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Your medical report has been saved to your health records.
        </p>
        <button
          onClick={onBack}
          className="rounded-xl px-6 py-3 font-semibold text-white"
          style={{ backgroundColor: '#0F6E56' }}
        >
          Back to Records
        </button>
      </div>
    );
  }

  return null;
}

function FindingRow({ finding, isAbnormal = false }: { finding: HealthFinding; isAbnormal?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div>
        <p className="text-sm font-medium text-gray-900">{finding.name}</p>
        <p className="text-xs text-gray-500">Normal: {finding.normal_range}</p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold ${isAbnormal ? 'text-red-600' : 'text-gray-900'}`}>
          {finding.value} <span className="font-normal text-gray-400">{finding.unit}</span>
        </p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          isAbnormal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {isAbnormal ? 'Abnormal' : 'Normal'}
        </span>
      </div>
    </div>
  );
}
