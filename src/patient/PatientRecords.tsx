import { useEffect, useState } from 'react';
import { 
  Trash2, ChevronDown, ChevronUp, ChevronLeft, FileText, Bell, Share2, 
  AlertTriangle, CheckCircle, Camera, Eye, Pill, BellRing, Plus, Edit2, 
  Check, X, Download, Printer, Calendar, Clock, Stethoscope, Building2 
} from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { formatDate, formatTime } from '../lib/format';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { claimPastAppointmentsForPhone } from '../lib/accountLinking';
import { ReportScanner } from './ReportScanner';
import type { Consultation, Vital, HealthReport, Clinic } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';
import { PrescriptionView } from '../components/PrescriptionView';

interface Props { patientId: string | null; onTab: (t: PatientTab) => void; }

type TabKey = 'reports' | 'visits' | 'prescriptions';

export function PatientRecords({ patientId, onTab }: Props) {
  const { account } = usePatientAuth();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('reports');
  const [consults, setConsults] = useState<Consultation[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [clinicsMap, setClinicsMap] = useState<Map<string, Clinic>>(new Map());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [viewingPrescription, setViewingPrescription] = useState<Consultation | null>(null);

  // 1. Resolve all linked patient IDs across clinic and patient accounts
  const [linkedPatientIds, setLinkedPatientIds] = useState<string[]>([]);

  useEffect(() => {
    const rawPhone = account?.phone || (account as any)?.mobile || user?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);
    const targetAccountId = account?.account_id || patientId;
    if (cleanPhone && targetAccountId) {
      claimPastAppointmentsForPhone(cleanPhone, targetAccountId).catch(() => {});
    }
    const ids = new Set<string>();
    if (patientId) ids.add(patientId);
    if (account?.account_id) ids.add(account.account_id);
    if (account?.id) ids.add(account.id);
    if ((account as any)?.patient_id) ids.add((account as any).patient_id);
    if ((account as any)?.id_number) ids.add((account as any).id_number);
    if (user?.uid) ids.add(user.uid);
    if (user?.user_id) ids.add(user.user_id);
    if (user?.patient_account_id) ids.add(user.patient_account_id);

    if (cleanPhone) {
      const qPat = query(collection(db, 'patients'), where('phone', '==', cleanPhone));
      getDocs(qPat)
        .then((snap) => {
          snap.forEach((d) => {
            ids.add(d.id);
            const data = d.data();
            if (data.patient_id) ids.add(data.patient_id);
            if (data.id_number) ids.add(data.id_number);
          });
          setLinkedPatientIds(Array.from(ids));
        })
        .catch(() => {
          setLinkedPatientIds(Array.from(ids));
        });
    } else {
      setLinkedPatientIds(Array.from(ids));
    }
  }, [patientId, account, user]);

  // 2. Real-time live synchronization for consultations, vitals, and health reports
  useEffect(() => {
    const targetIds = linkedPatientIds.length > 0 ? linkedPatientIds : (patientId ? [patientId] : []);
    const rawPhone = account?.phone || (account as any)?.mobile || user?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '').slice(-10);

    if (targetIds.length === 0 && !cleanPhone) return;

    const unsubs: (() => void)[] = [];
    const consultMap = new Map<string, Consultation>();

    const syncConsults = () => {
      const list = Array.from(consultMap.values());
      list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      setConsults(list);

      // Lazy load clinic records for rich prescription headers
      list.forEach((c) => {
        if (c.clinic_id && !clinicsMap.has(c.clinic_id)) {
          const cid = c.clinic_id;
          getDoc(doc(db, 'clinics', cid)).then((snap) => {
            if (snap.exists()) {
              setClinicsMap((prev) => new Map(prev).set(cid, { ...snap.data(), clinic_id: snap.id } as Clinic));
            }
          }).catch(() => {});
        }
      });
    };

    // Query consultations by linked patient IDs
    for (let i = 0; i < targetIds.length; i += 10) {
      const chunk = targetIds.slice(i, i + 10);
      const cQ = query(collection(db, 'consultations'), where('patient_id', 'in', chunk));
      unsubs.push(onSnapshot(cQ, (snap) => {
        snap.docs.forEach((d) => {
          consultMap.set(d.id, { ...d.data(), consult_id: d.id } as Consultation);
        });
        syncConsults();
      }, (err) => console.warn('Consultations by patient_id snapshot error:', err)));
    }

    // Query consultations by patient phone number
    if (cleanPhone) {
      const cPhoneQ = query(collection(db, 'consultations'), where('patient_phone', '==', cleanPhone));
      unsubs.push(onSnapshot(cPhoneQ, (snap) => {
        snap.docs.forEach((d) => {
          consultMap.set(d.id, { ...d.data(), consult_id: d.id } as Consultation);
        });
        syncConsults();
      }, (err) => console.warn('Consultations by patient_phone snapshot error:', err)));

      const cPhonePlainQ = query(collection(db, 'consultations'), where('phone', '==', cleanPhone));
      unsubs.push(onSnapshot(cPhonePlainQ, (snap) => {
        snap.docs.forEach((d) => {
          consultMap.set(d.id, { ...d.data(), consult_id: d.id } as Consultation);
        });
        syncConsults();
      }, (err) => console.warn('Consultations by phone snapshot error:', err)));
    }

    // Load vitals
    if (targetIds.length > 0) {
      const vQ = query(collection(db, 'vitals'), where('patient_id', 'in', targetIds.slice(0, 10)));
      unsubs.push(onSnapshot(vQ, (snap) => {
        const data = snap.docs.map(d => d.data() as Vital);
        data.sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());
        setVitals(data.slice(0, 5));
      }, (err) => console.warn('Vitals snapshot error:', err)));
    }

    // Load health reports
    if (targetIds.length > 0) {
      const rQ = query(collection(db, 'health_reports'), where('patient_id', 'in', targetIds.slice(0, 10)));
      unsubs.push(onSnapshot(rQ, (snap) => {
        const data = snap.docs.map(d => ({ ...d.data(), report_id: d.id } as HealthReport));
        data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setReports(data);
      }, (err) => console.warn('Health reports snapshot error:', err)));
    }

    return () => {
      unsubs.forEach(u => u());
    };
  }, [linkedPatientIds, patientId, account, user]);

  const latest = vitals[0];
  const prescriptions = consults.filter(c => 
    Boolean(
      (c.prescription && typeof c.prescription === 'string' && c.prescription.trim().length > 0) ||
      (Array.isArray((c as any).prescriptions) && (c as any).prescriptions.length > 0) ||
      (Array.isArray((c as any).medicines) && (c as any).medicines.length > 0) ||
      (c as any).diagnosis ||
      (c as any).advice
    )
  );
  const abnormalReports = reports.filter(r => r.urgent_flags && r.urgent_flags.length > 0);

  function countMedicines(c: any): number {
    if (Array.isArray(c?.prescriptions) && c.prescriptions.length > 0) return c.prescriptions.length;
    if (Array.isArray(c?.medicines) && c.medicines.length > 0) return c.medicines.length;
    if (typeof c?.prescription === 'string') {
      const lines = c.prescription.split('\n').filter((l: string) => l.trim().length > 0);
      return lines.length || 1;
    }
    return 1;
  }

  function getMedicineList(c: any): string[] {
    if (Array.isArray(c?.prescriptions) && c.prescriptions.length > 0) {
      return c.prescriptions.map((m: any) => m.name || m.medicine_name || 'Medicine').filter(Boolean);
    }
    if (Array.isArray(c?.medicines) && c.medicines.length > 0) {
      return c.medicines.map((m: any) => m.name || m.medicine_name || 'Medicine').filter(Boolean);
    }
    if (typeof c?.prescription === 'string') {
      return c.prescription
        .split('\n')
        .map((l: string) => l.trim().split(/[-–—|,]/)[0].trim())
        .filter((l: string) => l.length > 0);
    }
    return [];
  }

  const refreshReports = () => {
    // No-op, data is now live
  };

  const handleDeleteReport = async (r: HealthReport) => {
    if (!window.confirm('Are you sure you want to completely delete this record? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'health_reports', r.report_id));
      if (r.original_file_url) {
        const fileRef = ref(storage, r.original_file_url);
        await deleteObject(fileRef);
      }
    } catch (e: any) {
      console.error('Delete failed:', e);
      alert('Failed to delete record: ' + e.message);
    }
  };

  const handleSaveRename = async (reportId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!editingName.trim()) {
      setEditingReportId(null);
      return;
    }
    try {
      await updateDoc(doc(db, 'health_reports', reportId), {
        report_type: editingName.trim()
      });
      setEditingReportId(null);
      // alert('Successfully updated in database!');
    } catch (err: any) {
      console.error('Rename failed:', err);
      alert('Failed to rename: ' + err.message);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      // Default to .pdf if extension is unknown
      a.download = filename.includes('.') ? filename : `${filename}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed, falling back to new tab:', error);
      window.open(url, '_blank');
    }
  };

  // Show scanner
  if (showScanner) {
    return (
      <ReportScanner
        patientId={patientId}
        patientName={account?.name || 'Unknown_Patient'}
        accountId={account?.account_id ?? null}
        clinicId={null}
        onBack={() => setShowScanner(false)}
        onSaved={refreshReports}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F5FAFA] pb-24">
      <div className="bg-primary px-4 pt-12 pb-4 flex items-center gap-3">
        <button onClick={() => onTab('home')} aria-label="Back" className="p-2 rounded-xl bg-white/10 text-white"><ChevronLeft size={18} /></button>
        <p className="text-sm font-bold text-white">My Health Records</p>
      </div>

      {/* Health profile summary */}
      <div className="mx-4 -mt-2 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{ backgroundColor: '#0F6E56' }}>
            {account?.name?.slice(0, 2).toUpperCase() ?? 'PT'}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{account?.name ?? 'Patient'}</p>
            <p className="text-xs text-gray-500">
              {account?.age ?? '—'} yrs, {account?.gender ?? '—'} • {account?.blood_group ?? 'Blood group not set'}
            </p>
          </div>
        </div>
        {account?.chronic_conditions && account.chronic_conditions !== 'None' && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {account.chronic_conditions.split(', ').map(c => (
              <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 font-medium">{c}</span>
            ))}
          </div>
        )}
        {account?.allergies && account.allergies !== 'None' && (
          <div className="mt-2 text-xs text-red-600">
            <strong>Allergies:</strong> {account.allergies}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Latest vitals */}
        {latest && (
          <div>
            <p className="text-sm font-bold text-gray-900 mb-2">Latest vitals</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Blood Pressure', value: latest.systolic_bp ? `${latest.systolic_bp}/${latest.diastolic_bp}` : '—', unit: 'mmHg' },
                { label: 'Pulse', value: latest.pulse ? String(latest.pulse) : '—', unit: 'bpm' },
                { label: 'Temperature', value: latest.temperature ? String(latest.temperature) : '—', unit: '°F' },
                { label: 'SpO2', value: latest.spo2 ? `${latest.spo2}%` : '—', unit: '' },
              ].map(v => (
                <div key={v.label} className="bg-white rounded-2xl border border-gray-100 p-4">
                  <p className="text-xs text-gray-500">{v.label}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">{v.value} <span className="text-xs text-gray-400 font-normal">{v.unit}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab selector */}
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {(['reports', 'visits', 'prescriptions'] as TabKey[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2.5 text-xs font-semibold capitalize transition ${
                tab === t ? 'bg-white text-primary shadow-sm' : 'text-gray-500'
              }`}>
              {t === 'reports' ? 'Reports' : t === 'visits' ? 'Visits' : 'Prescriptions'}
              {t === 'reports' && reports.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-primary text-[10px] text-white">
                  {reports.length}
                </span>
              )}
              {t === 'visits' && consults.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-gray-400 text-[10px] text-white">
                  {consults.length}
                </span>
              )}
              {t === 'prescriptions' && prescriptions.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full bg-emerald-600 text-[10px] text-white font-bold">
                  {prescriptions.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Reports tab */}
        {tab === 'reports' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Medical Reports</p>
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                <Plus size={14} /> Scan Report
              </button>
            </div>

            {/* Abnormal reports first */}
            {abnormalReports.length > 0 && (
              <div className="mb-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <div className="flex items-center gap-2 text-xs text-red-700 font-semibold mb-2">
                  <AlertTriangle size={14} /> {abnormalReports.length} report{abnormalReports.length > 1 ? 's' : ''} with abnormal values
                </div>
              </div>
            )}

            {reports.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Camera size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500 mb-1">No reports yet.</p>
                <p className="text-xs text-gray-400 mb-4">Scan your blood tests, X-rays, and prescriptions.</p>
                <button
                  onClick={() => setShowScanner(true)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: '#0F6E56' }}
                >
                  Scan your first report
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {reports.map(r => {
                  const isOpen = expanded === r.report_id;
                  const hasAbnormal = r.urgent_flags && r.urgent_flags.length > 0;
                  return (
                    <div key={r.report_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button onClick={() => setExpanded(isOpen ? null : r.report_id)}
                        className="w-full flex items-center gap-3 p-4 text-left">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                          hasAbnormal ? 'bg-red-50' : 'bg-[#E1F5EE]'
                        }`}>
                          {hasAbnormal ? (
                            <AlertTriangle size={16} className="text-red-500" />
                          ) : (
                            <FileText size={16} className="text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          {editingReportId === r.report_id ? (
                            <div className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                autoFocus
                                value={editingName}
                                onChange={e => setEditingName(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveRename(r.report_id);
                                  if (e.key === 'Escape') setEditingReportId(null);
                                }}
                                className="border border-gray-300 rounded px-2 py-1 text-sm font-semibold text-gray-900 w-full focus:outline-none focus:ring-1 focus:ring-primary"
                              />
                              <button onClick={(e) => handleSaveRename(r.report_id, e)} className="text-green-600 p-1.5 bg-green-50 rounded-lg hover:bg-green-100">
                                <Check size={14} />
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditingReportId(null); }} className="text-gray-400 p-1.5 hover:bg-gray-100 rounded-lg">
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900 truncate">{r.report_type}</p>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReportId(r.report_id);
                                  setEditingName(r.report_type);
                                }}
                                className="text-gray-400 hover:text-blue-600 p-1"
                                title="Rename document"
                              >
                                <Edit2 size={14} />
                              </button>
                              {hasAbnormal && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                                  {r.urgent_flags.length} abnormal
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-xs text-gray-500">{r.report_date ? formatDate(r.report_date) : 'Date unknown'}</p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                          {/* Key findings */}
                          {r.key_findings && r.key_findings.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase">Key Findings</p>
                              {r.key_findings.map((f, i) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                  <div>
                                    <p className="text-sm text-gray-800">{f.name}</p>
                                    <p className="text-[10px] text-gray-400">Normal: {f.normal_range}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className={`text-sm font-bold ${f.is_abnormal ? 'text-red-600' : 'text-gray-900'}`}>
                                      {f.value} <span className="font-normal text-gray-400">{f.unit}</span>
                                    </p>
                                    {f.is_abnormal && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">High</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Summary */}
                          {r.summary && (
                            <div className="p-3 rounded-xl bg-blue-50">
                              <p className="text-[10px] text-blue-600 font-semibold uppercase mb-1">AI Summary</p>
                              <p className="text-xs text-blue-900">{r.summary}</p>
                            </div>
                          )}

                          {/* Urgent flags */}
                          {r.urgent_flags && r.urgent_flags.length > 0 && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                              <p className="text-[10px] text-red-600 font-semibold uppercase mb-1">Needs Attention</p>
                              <ul className="space-y-1">
                                {r.urgent_flags.map((flag, i) => (
                                  <li key={i} className="text-xs text-red-700 flex items-center gap-1.5">
                                    <AlertTriangle size={12} /> {flag}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* View, Download, and Delete actions */}
                          <div className="flex gap-2 pt-2 flex-wrap">
                            {r.original_file_url && (
                              <a
                                href={r.original_file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-gray-700 py-3 rounded-xl text-sm font-semibold transition border border-gray-200 min-w-[120px]"
                                title="View in browser"
                              >
                                <Eye size={16} />
                                View
                              </a>
                            )}
                            {r.original_file_url && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownload(r.original_file_url!, r.report_type.replace(/[^a-zA-Z0-9]/g, '_'));
                                }}
                                className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-3 rounded-xl text-sm font-semibold transition border border-blue-100 min-w-[120px]"
                                title="Download to device"
                              >
                                <Download size={16} />
                                Download
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteReport(r);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl text-sm font-semibold transition border border-red-100 min-w-[120px]"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Visits tab */}
        {tab === 'visits' && (
          <div>
            <p className="text-sm font-bold text-gray-900 mb-3">Visit history</p>
            {consults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <FileText size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No visit records yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {consults.map(c => {
                  const isOpen = expanded === c.consult_id;
                  return (
                    <div key={c.consult_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button onClick={() => setExpanded(isOpen ? null : c.consult_id)}
                        className="w-full flex items-center gap-3 p-4 text-left">
                        <div className="h-10 w-10 rounded-xl bg-[#E1F5EE] flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{c.diagnosis || 'Consultation'}</p>
                          <p className="text-xs text-gray-500">{formatDate(c.created_at)}</p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                          {c.symptoms && <Field label="Symptoms" value={c.symptoms} />}
                          {c.diagnosis && <Field label="Diagnosis" value={c.diagnosis} />}
                          {c.prescription && <Field label="Prescription" value={c.prescription} />}
                          {c.notes && <Field label="Notes" value={c.notes} />}
                          {c.follow_up_date && (
                            <div className="flex items-center gap-2 rounded-xl bg-yellow-50 px-3 py-2">
                              <Bell size={14} className="text-yellow-600" />
                              <p className="text-xs text-yellow-700">Follow-up: <strong>{formatDate(c.follow_up_date)}</strong></p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Prescriptions tab */}
        {tab === 'prescriptions' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Digital Prescriptions</p>
                <p className="text-xs text-gray-500">Official A4 prescriptions issued by your doctors</p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                {prescriptions.length} {prescriptions.length === 1 ? 'Prescription' : 'Prescriptions'}
              </span>
            </div>

            {prescriptions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center shadow-xs">
                <div className="h-16 w-16 rounded-2xl bg-teal-50 text-[#0F6E56] flex items-center justify-center mx-auto mb-3">
                  <Pill size={30} />
                </div>
                <h4 className="text-base font-bold text-gray-900">No Prescriptions Yet</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
                  When your doctor creates an official digital prescription during a consultation or clinic visit, it will appear here in real time.
                </p>
                <button
                  onClick={() => setViewingPrescription({
                    consult_id: 'rx_official_demo',
                    id: 'RX-VIITSA-DEMO',
                    diagnosis: 'Acute Upper Respiratory Tract Infection',
                    created_at: new Date().toISOString(),
                    doctor_name: 'Dr. S. Mehta, MBBS, MD',
                    doctor_specialization: 'Consultant Physician & Diabetologist',
                    clinic_name: 'VIITSA HEALTHCARE CLINIC',
                    clinic_address: 'Plot No. 123, Healthcare Enclave, Hyderabad, Telangana - 500081',
                    clinic_phone: '+91 98765 43210',
                    clinic_email: 'care@viitsa.com',
                    prescriptions: [
                      { id: '1', name: 'Paracetamol 650 mg', dose: '1 Tablet', timesPerDay: '3 times/day', intakeTime: 'Morning, Afternoon, Night', duration: '3 Days', foodInstruction: 'After Food', instructions: 'For fever and body ache' },
                      { id: '2', name: 'Pantoprazole 40 mg', dose: '1 Tablet', timesPerDay: '1 time/day', intakeTime: 'Morning', duration: '5 Days', foodInstruction: 'Before Food', instructions: 'Before breakfast' },
                      { id: '3', name: 'Vitamin C & Zinc Chews', dose: '1 Tablet', timesPerDay: '1 time/day', intakeTime: 'Afternoon', duration: '10 Days', foodInstruction: 'After Food', instructions: 'Immunity support' },
                      { id: '4', name: 'Cetirizine 10 mg', dose: '1 Tablet', timesPerDay: '1 time/day', intakeTime: 'Night', duration: '3 Days', foodInstruction: 'After Food', instructions: 'At bedtime for cough/rhinitis' }
                    ],
                    vitals: { temperature: '100.4 °F', bloodPressure: '120/80 mmHg', pulse: '82/min', spo2: '99%' },
                    advice: [
                      'Drink plenty of warm fluids and maintain hydration.',
                      'Take complete physical rest.',
                      'Steam inhalation twice daily.',
                      'Consult immediately if temperature exceeds 102 °F or breathlessness occurs.'
                    ],
                    recommended_tests: ['Complete Blood Count (CBC)', 'Serum Electrolytes'],
                    notes: 'Review in OPD after 3 days if symptoms persist.',
                    follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString()
                  } as any)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0F6E56] text-xs font-bold border border-teal-200 transition shadow-2xs"
                >
                  <Eye size={14} /> Preview Official Prescription Design
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {prescriptions.map(presc => {
                  const cl = (presc.clinic_id ? clinicsMap.get(presc.clinic_id) : null) || (presc as any).clinic;
                  const cName = cl?.name || presc.clinic_name || 'VIITSA Healthcare Clinic';
                  const dName = presc.doctor_name || (presc as any).doctor?.name || 'Attending Doctor';
                  const medCount = countMedicines(presc);
                  const medList = getMedicineList(presc);

                  return (
                    <div 
                      key={presc.consult_id || presc.id} 
                      className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs hover:border-teal-200 hover:shadow-sm transition-all"
                    >
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-2 pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-2.5">
                          <div className="h-10 w-10 rounded-xl bg-teal-50 text-[#0F6E56] flex items-center justify-center shrink-0">
                            <Pill size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-mono font-bold text-[#0F6E56]">
                                #{presc.consult_id?.slice(0, 8).toUpperCase() || 'RX'}
                              </p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Official Digital Rx
                              </span>
                              {(presc.patient_age || account?.age) && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-[#0F6E56] border border-teal-200">
                                  Age: {presc.patient_age || account?.age} yrs
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-bold text-gray-900 mt-0.5">
                              {presc.diagnosis || 'Consultation & Prescription'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold text-gray-800">{formatDate(presc.created_at)}</p>
                          <p className="text-[11px] text-gray-400">{formatTime(presc.created_at)}</p>
                        </div>
                      </div>

                      {/* Doctor & Clinic Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-3 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <Stethoscope size={14} className="text-[#0F6E56] shrink-0" />
                          <span className="font-semibold text-gray-800 truncate">{dName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Building2 size={14} className="text-primary shrink-0" />
                          <span className="truncate">{cName}</span>
                        </div>
                      </div>

                      {/* Medicines Pills Preview */}
                      {medList.length > 0 && (
                        <div className="mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                            Prescribed Medicines ({medCount})
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {medList.slice(0, 4).map((medName, mIdx) => (
                              <span 
                                key={mIdx} 
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-50/80 text-teal-800 text-[11px] font-medium border border-teal-100"
                              >
                                💊 {medName}
                              </span>
                            ))}
                            {medList.length > 4 && (
                              <span className="text-[11px] font-bold text-teal-700 self-center pl-1">
                                +{medList.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Follow-up banner if set */}
                      {presc.follow_up_date && (
                        <div className="flex items-center gap-2 rounded-xl bg-amber-50/70 border border-amber-200/60 px-3 py-1.5 mb-3 text-xs text-amber-800">
                          <Calendar size={13} className="text-amber-600 shrink-0" />
                          <span>Recommended Follow-up: <strong>{formatDate(presc.follow_up_date)}</strong></span>
                        </div>
                      )}

                      {/* Actions Toolbar */}
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2">
                        <button
                          onClick={() => setViewingPrescription(presc)}
                          className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/95 transition shadow-sm"
                          title="Open official A4 prescription with print, PDF download, and share"
                        >
                          <Eye size={14} /> View Official Prescription
                        </button>

                        <button
                          onClick={() => setViewingPrescription(presc)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 text-[#0F6E56] text-xs font-semibold border border-teal-200 transition"
                          title="Download official PDF"
                        >
                          <Download size={13} /> PDF
                        </button>

                        <button
                          onClick={() => setViewingPrescription(presc)}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition"
                          title="Print official prescription"
                        >
                          <Printer size={13} /> Print
                        </button>

                        <button
                          onClick={() => {
                            const loginUrl = 'https://viitsa.com/login';
                            const msg = `*Doctor Prescription — ${cName}*\n📅 Date: ${formatDate(presc.created_at)}\n👨‍⚕️ Doctor: ${dName}\n🩺 Diagnosis: ${presc.diagnosis || 'Consultation'}\n\n🔐 View & Download from your Patient Account:\n${loginUrl}\n\n— VIITSA Healthcare Platform`;
                            window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                          }}
                          className="p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold transition border border-green-200"
                          title="Share on WhatsApp"
                        >
                          <Share2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Production-Ready A4 Doctor Prescription Modal */}
      {viewingPrescription && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in">
          <div className="relative max-w-4xl w-full my-auto">
            <PrescriptionView
              consultation={viewingPrescription}
              patient={{
                ...(account || {}),
                name: account?.name || viewingPrescription.patient_name,
                phone: account?.phone || viewingPrescription.patient_phone,
                age: account?.age || (viewingPrescription as any).patient_age || (account as any)?.age,
                dob: account?.dob || (viewingPrescription as any).patient_dob || (account as any)?.dob,
                gender: account?.gender || (viewingPrescription as any).patient_gender || (account as any)?.gender
              }}
              clinic={(viewingPrescription.clinic_id ? clinicsMap.get(viewingPrescription.clinic_id) : null) || (viewingPrescription as any).clinic}
              doctor={
                viewingPrescription.doctor || {
                  name: viewingPrescription.doctor_name,
                  specialisation: (viewingPrescription as any).doctor_specialization || (viewingPrescription as any).specialization
                }
              }
              onClose={() => setViewingPrescription(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function countMedicines(prescription: string): number {
  if (!prescription) return 0;
  const lines = prescription.split('\n').filter(l => l.trim().length > 0);
  return lines.filter(l => /^(Tab|Cap|Syrup|Injection|Inj|Syp|Cream|Oint|Drops)/i.test(l.trim())).length || lines.length;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
