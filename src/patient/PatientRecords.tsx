import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, FileText, Bell, Pill, Share2, BellRing, Plus, Camera, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, getDocs, limit } from 'firebase/firestore';
import { formatDate } from '../lib/format';
import { usePatientAuth } from '../lib/patientAuth';
import { ReportScanner } from './ReportScanner';
import type { Consultation, Vital, HealthReport } from '../lib/types';
import type { PatientTab } from './PatientBottomNav';

interface Props { patientId: string | null; onTab: (t: PatientTab) => void; }

type TabKey = 'reports' | 'visits' | 'prescriptions';

export function PatientRecords({ patientId, onTab }: Props) {
  const { account } = usePatientAuth();
  const [tab, setTab] = useState<TabKey>('reports');
  const [consults, setConsults] = useState<Consultation[]>([]);
  const [vitals, setVitals] = useState<Vital[]>([]);
  const [reports, setReports] = useState<HealthReport[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!patientId) return;

    // Load consultations
    const cQ = query(collection(db, 'consultations'), where('patient_id', '==', patientId), orderBy('created_at', 'desc'));
    getDocs(cQ).then(snap => setConsults(snap.docs.map(d => d.data() as Consultation)));

    // Load vitals
    const vQ = query(collection(db, 'vitals'), where('patient_id', '==', patientId), orderBy('recorded_at', 'desc'), limit(5));
    getDocs(vQ).then(snap => setVitals(snap.docs.map(d => d.data() as Vital)));

    // Load health reports
    const rQ = query(collection(db, 'health_reports'), where('patient_id', '==', patientId), orderBy('created_at', 'desc'));
    getDocs(rQ).then(snap => setReports(snap.docs.map(d => d.data() as HealthReport)));
  }, [patientId]);

  const latest = vitals[0];
  const prescriptions = consults.filter(c => c.prescription && c.prescription.trim().length > 0);
  const abnormalReports = reports.filter(r => r.urgent_flags && r.urgent_flags.length > 0);

  const refreshReports = () => {
    if (!patientId) return;
    const rQ = query(collection(db, 'health_reports'), where('patient_id', '==', patientId), orderBy('created_at', 'desc'));
    getDocs(rQ).then(snap => setReports(snap.docs.map(d => d.data() as HealthReport)));
  };

  // Show scanner
  if (showScanner) {
    return (
      <ReportScanner
        patientId={patientId}
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
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-4 rounded-full bg-primary text-[10px] text-white">
                  {reports.length}
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
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">{r.report_type}</p>
                            {hasAbnormal && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold">
                                {r.urgent_flags.length} abnormal
                              </span>
                            )}
                          </div>
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
            <p className="text-sm font-bold text-gray-900 mb-3">Digital prescriptions</p>
            {prescriptions.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                <Pill size={32} className="text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No prescriptions yet.</p>
                <p className="text-xs text-gray-400 mt-1">Prescriptions will appear here after your doctor creates them.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {prescriptions.map(presc => {
                  const isOpen = expanded === `rx-${presc.consult_id}`;
                  return (
                    <div key={presc.consult_id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                      <button onClick={() => setExpanded(isOpen ? null : `rx-${presc.consult_id}`)}
                        className="w-full flex items-center gap-3 p-4 text-left">
                        <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                          <Pill size={20} className="text-purple-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{presc.diagnosis || 'Consultation'}</p>
                          <p className="text-xs text-gray-500">{formatDate(presc.created_at)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{countMedicines(presc.prescription || '')} medicines</p>
                        </div>
                        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-50 pt-3">
                          <Field label="Diagnosis" value={presc.diagnosis || '—'} />
                          <Field label="Prescription" value={presc.prescription || '—'} />
                          {presc.notes && <Field label="Special instructions" value={presc.notes} />}
                          {presc.follow_up_date && (
                            <div className="flex items-center gap-2 rounded-xl bg-yellow-50 px-3 py-2">
                              <Bell size={14} className="text-yellow-600" />
                              <p className="text-xs text-yellow-700">Follow-up: <strong>{formatDate(presc.follow_up_date)}</strong></p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button onClick={() => {
                              const msg = `Your prescription from ${formatDate(presc.created_at)}:\n\nDiagnosis: ${presc.diagnosis || 'Consultation'}\n\nPrescription:\n${presc.prescription}\n\nFollow-up: ${presc.follow_up_date ? formatDate(presc.follow_up_date) : 'None'}\n\n- VIITSA`;
                              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');
                            }}
                              className="flex items-center justify-center gap-1.5 rounded-xl bg-green-50 py-2.5 text-xs font-semibold text-green-700">
                              <Share2 size={14} /> WhatsApp
                            </button>
                            <button onClick={() => {
                              if ('Notification' in window && Notification.permission === 'granted') {
                                alert(`Reminder set!\n\nYou will be notified daily.`);
                              } else if ('Notification' in window && Notification.permission !== 'denied') {
                                Notification.requestPermission();
                              } else {
                                alert('Please enable browser notifications.');
                              }
                            }}
                              className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-50 py-2.5 text-xs font-semibold text-purple-700">
                              <BellRing size={14} /> Set reminder
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
      </div>
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
