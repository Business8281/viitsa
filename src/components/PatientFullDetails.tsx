import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { 
  Calendar, FileText, Pill, Receipt, Activity, Clock, 
  Download, Share2, AlertTriangle, CheckCircle2, Heart, 
  MapPin, Phone, Mail, Droplet, Sparkles, Printer, 
  User, Check, ChevronRight, AlertCircle, FileCheck, Stethoscope,
  UploadCloud, Upload, Plus, Trash2, Edit3, X, Loader2,
  Building2, ShieldCheck, ShieldAlert, MessageCircle
} from 'lucide-react';
import { formatDate, formatTime, calculateAge, formatDobForInput, localDateISO } from '../lib/format';
import { EmptyState } from './ui';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { Modal } from './Modal';
import { useToast } from '../lib/toast';
import { PrescriptionView } from './PrescriptionView';
import { WritePrescriptionModal } from './WritePrescriptionModal';
import { InvoiceView } from './InvoiceView';
import { logClinicalRecordCreated } from '../lib/auditLogger';
import { sendWhatsAppFollowupDueViaAPI } from '../lib/whatsappClientService';

interface PatientFullDetailsProps {
  patientId: string;
  patientName?: string;
  patient?: any;
}

export function PatientFullDetails({ patientId, patientName, patient }: PatientFullDetailsProps) {
  const { clinic } = useAuth();
  const clinicData = useClinicData();
  const [tab, setTab] = useState<'overview' | 'appointments' | 'consultations' | 'reports' | 'invoices' | 'vitals'>('overview');
  
  // Real-time collections data
  const [dbAppointments, setDbAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [dbInvoices, setDbInvoices] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [aiSessions, setAiSessions] = useState<any[]>([]);
  const [patientClinicLinks, setPatientClinicLinks] = useState<any[]>([]);
  const [liveProfile, setLiveProfile] = useState<any>(patient || null);
  const [completingApptId, setCompletingApptId] = useState<string | null>(null);
  const [uploadReportsModalOpen, setUploadReportsModalOpen] = useState(false);
  const [selectedPrescriptionConsultation, setSelectedPrescriptionConsultation] = useState<any | null>(null);
  const [writePrescriptionOpen, setWritePrescriptionOpen] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);

  const { toast } = useToast();
  const [editingDemographics, setEditingDemographics] = useState(false);
  const [editDemoForm, setEditDemoForm] = useState({
    name: '',
    dob: '',
    age: '',
    gender: 'Male',
    blood_group: 'O+',
    phone: '',
    email: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
  });
  const [savingDemo, setSavingDemo] = useState(false);

  const openEditDemographics = () => {
    setEditDemoForm({
      name: currentProfile?.name || patientName || '',
      dob: currentProfile?.dob || '',
      age: currentProfile?.age ? String(currentProfile.age) : (currentProfile?.dob ? String(calculateAge(currentProfile.dob) ?? '') : ''),
      gender: currentProfile?.gender || 'Male',
      blood_group: currentProfile?.blood_group || 'O+',
      phone: currentProfile?.phone || '',
      email: currentProfile?.email || '',
      address: currentProfile?.address || '',
      emergency_contact_name: currentProfile?.emergency_contact_name || '',
      emergency_contact_phone: currentProfile?.emergency_contact_phone || '',
    });
    setEditingDemographics(true);
  };

  const handleEditDemoDobChange = (newDob: string) => {
    let calcAge = editDemoForm.age;
    if (newDob) {
      const computed = calculateAge(newDob);
      if (computed !== null) calcAge = String(computed);
    }
    setEditDemoForm(f => ({ ...f, dob: newDob, age: calcAge }));
  };

  const saveDemographics = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDemo(true);
    const parsedAge = editDemoForm.age ? parseInt(editDemoForm.age, 10) : (editDemoForm.dob ? calculateAge(editDemoForm.dob) : null);
    const pDocId = currentProfile?.patient_id || patientId;
    const nowIso = new Date().toISOString();

    const payload: any = {
      name: editDemoForm.name.trim(),
      full_name: editDemoForm.name.trim(),
      dob: editDemoForm.dob || null,
      age: parsedAge,
      gender: editDemoForm.gender,
      blood_group: editDemoForm.blood_group,
      phone: editDemoForm.phone.trim() || null,
      email: editDemoForm.email.trim() || null,
      address: editDemoForm.address.trim() || null,
      emergency_contact_name: editDemoForm.emergency_contact_name.trim() || null,
      emergency_contact_phone: editDemoForm.emergency_contact_phone.trim() || null,
      updated_at: nowIso,
    };

    try {
      if (pDocId) {
        await setDoc(doc(db, 'patients', pDocId), payload, { merge: true });
      }
      const accId = currentProfile?.account_id || (pDocId?.startsWith('pat_') ? pDocId : null);
      if (accId) {
        await setDoc(doc(db, 'patient_accounts', accId), payload, { merge: true });
      }
      setLiveProfile((prev: any) => ({
        ...(prev || {}),
        ...payload,
      }));
      toast('Patient demographics & DOB updated successfully.', 'success');
      setEditingDemographics(false);
    } catch (err) {
      console.error('Error saving demographics:', err);
      toast('Failed to save patient demographics. Please try again.', 'error');
    } finally {
      setSavingDemo(false);
    }
  };

  // Stable identifiers for this patient across all collections
  const targetIds = useMemo(() => {
    const ids = new Set<string>();
    if (patientId) ids.add(patientId);
    if (patient?.patient_id) ids.add(patient.patient_id);
    if (patient?.id) ids.add(patient.id);
    if (patient?.account_id) ids.add(patient.account_id);
    if (patient?.auth_user_id) ids.add(patient.auth_user_id);
    if (patient?.user_id) ids.add(patient.user_id);
    if (patient?.patient_account_id) ids.add(patient.patient_account_id);
    if (patient?.id_number) ids.add(patient.id_number);
    if (patient?.patient_code) ids.add(patient.patient_code);
    if (patient?.display_id) ids.add(patient.display_id);

    // Cross-match with memory-cached clinic patients
    const matched = clinicData.patients.find(p => 
      p.patient_id === patientId ||
      (p.id_number && p.id_number === patient?.id_number) ||
      (patient?.phone && p.phone && p.phone.replace(/\D/g, '') === patient.phone.replace(/\D/g, ''))
    );
    if (matched) {
      if (matched.patient_id) ids.add(matched.patient_id);
      if (matched.id_number) ids.add(matched.id_number);
      if (matched.display_id) ids.add(matched.display_id);
      if (matched.patient_code) ids.add(matched.patient_code);
    }
    return Array.from(ids).filter(Boolean);
  }, [patientId, patient?.patient_id, patient?.id, patient?.account_id, patient?.auth_user_id, patient?.user_id, patient?.phone, patient?.id_number, clinicData.patients]);

  const targetPhone = useMemo(() => {
    const raw = patient?.phone || liveProfile?.phone || '';
    return raw.replace(/\D/g, '') || null;
  }, [patient?.phone, liveProfile?.phone]);

  const targetEmail = useMemo(() => {
    const raw = patient?.email || liveProfile?.email || '';
    return raw.toLowerCase().trim() || null;
  }, [patient?.email, liveProfile?.email]);

  const patientDisplayName = useMemo(() => {
    return (patient?.name || patient?.full_name || liveProfile?.name || patientName || '').trim();
  }, [patient?.name, patient?.full_name, liveProfile?.name, patientName]);

  const targetName = useMemo(() => {
    return patientDisplayName.toLowerCase() || null;
  }, [patientDisplayName]);

  const matchesPatient = useCallback((item: any) => {
    if (!item) return false;
    const pId = item.patient_id || item.user_id || item.account_id || item.patient_account_id || item.id_number;
    if (pId && targetIds.includes(pId)) return true;
    if (targetPhone) {
      const itemPhone = (item.patient_phone || item.phone || item.mobile || '').replace(/\D/g, '');
      if (itemPhone && (itemPhone === targetPhone || itemPhone.endsWith(targetPhone) || targetPhone.endsWith(itemPhone))) {
        return true;
      }
    }
    if (targetEmail) {
      const itemEmail = (item.patient_email || item.email || '').toLowerCase().trim();
      if (itemEmail && itemEmail === targetEmail) return true;
    }
    if (targetName && targetName.length > 2) {
      const itemName = (item.patient_name || item.name || '').toLowerCase().trim();
      if (itemName && (itemName === targetName || itemName.includes(targetName) || targetName.includes(itemName))) {
        return true;
      }
    }
    return false;
  }, [targetIds, targetPhone, targetEmail, targetName]);

  // Combined fast appointments (instant in-memory cache + live DB updates)
  const appointments = useMemo(() => {
    const map = new Map<string, any>();
    clinicData.appointments.forEach((a: any) => {
      if (matchesPatient(a)) {
        map.set(a.appointment_id || a.id, { ...a, id: a.appointment_id || a.id });
      }
    });
    dbAppointments.forEach(a => {
      if (matchesPatient(a)) {
        map.set(a.id || a.appointment_id, { ...a, id: a.id || a.appointment_id });
      }
    });
    const list = Array.from(map.values());
    list.sort((a: any, b: any) => {
      const da = a.date || '';
      const db = b.date || '';
      if (da !== db) return db.localeCompare(da);
      return (b.time_slot || '').localeCompare(a.time_slot || '');
    });
    return list;
  }, [clinicData.appointments, dbAppointments, matchesPatient]);

  // Combined fast invoices/billing (instant in-memory cache + live DB updates)
  const invoices = useMemo(() => {
    const map = new Map<string, any>();
    clinicData.bills.forEach((b: any) => {
      if (matchesPatient(b)) {
        map.set(b.bill_id || b.id, { ...b, id: b.bill_id || b.id });
      }
    });
    dbInvoices.forEach(inv => {
      if (matchesPatient(inv)) {
        map.set(inv.id || inv.invoice_id || inv.bill_id, { ...inv, id: inv.id || inv.invoice_id || inv.bill_id });
      }
    });
    const list = Array.from(map.values());
    list.sort((a: any, b: any) => {
      const ta = new Date(a.date || a.created_at || 0).getTime();
      const tb = new Date(b.date || b.created_at || 0).getTime();
      return tb - ta;
    });
    return list;
  }, [clinicData.bills, dbInvoices, matchesPatient]);

  // Stable sync key so effect does not re-subscribe cyclically
  const targetSyncKey = useMemo(() => {
    return `${patientId || ''}_${targetPhone || ''}_${targetEmail || ''}_${targetIds.join(',')}`;
  }, [patientId, targetPhone, targetEmail, targetIds]);

  // Realtime listeners for all patient data across Firestore
  useEffect(() => {
    if (!patientId && targetIds.length === 0 && !targetPhone) return;

    let mounted = true;

    // 1. Patient Accounts & Users for complete profile hydration
    const unsubAccounts = onSnapshot(collection(db, 'patient_accounts'), (snap) => {
      const match = snap.docs.find(d => {
        const dData = d.data();
        return d.id === patientId || targetIds.includes(d.id) || matchesPatient(dData);
      });
      if (match && mounted) {
        const acc = match.data();
        setLiveProfile((prev: any) => ({
          ...(prev || {}),
          ...acc,
          patient_id: prev?.patient_id || match.id,
          account_id: match.id,
          address: acc.address || prev?.address || null,
          blood_group: acc.blood_group || prev?.blood_group || null,
          dob: acc.dob || prev?.dob || null,
          age: acc.age ?? prev?.age ?? null,
          gender: acc.gender || prev?.gender || null,
          allergies: (acc.allergies && acc.allergies !== 'None') ? acc.allergies : (prev?.allergies || 'None'),
          chronic_conditions: (acc.chronic_conditions && acc.chronic_conditions !== 'None') ? acc.chronic_conditions : (prev?.chronic_conditions || 'None'),
          emergency_contact_name: acc.emergency_contact_name || prev?.emergency_contact_name || null,
          emergency_contact_phone: acc.emergency_contact_phone || prev?.emergency_contact_phone || null,
          current_medications: acc.current_medications || prev?.current_medications || [],
          display_id: acc.display_id || acc.patient_code || prev?.display_id || null,
          patient_code: acc.patient_code || prev?.patient_code || null,
          created_at: acc.created_at || prev?.created_at,
        }));
      }
    }, (err) => console.warn('Account live sync:', err));

    // 2. Appointments live sync
    const unsubAppointments = onSnapshot(collection(db, 'appointments'), (snap) => {
      if (!mounted) return;
      const list = snap.docs
        .map(d => ({ id: d.id, appointment_id: d.id, ...d.data() }))
        .filter(matchesPatient);
      setDbAppointments(list);
    }, (err) => console.warn('Appointments live sync:', err));

    // 3. Consultations (Doctor notes & Prescriptions)
    const unsubConsultations = onSnapshot(collection(db, 'consultations'), (snap) => {
      if (!mounted) return;
      const list = snap.docs
        .map(d => ({ id: d.id, consult_id: d.id, ...d.data() }))
        .filter(matchesPatient);

      list.sort((a: any, b: any) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setConsultations(list);
    }, (err) => console.warn('Consultations live sync:', err));

    // 4. Health Reports & Medical Documents (merging health_reports and reports)
    const reportMap = new Map<string, any>();
    const unsubHealthReports = onSnapshot(collection(db, 'health_reports'), (snap) => {
      if (!mounted) return;
      snap.docs.forEach(d => {
        const data = d.data();
        if (matchesPatient(data) || targetIds.includes(data.patient_id) || targetIds.includes(data.account_id)) {
          reportMap.set(d.id, { id: d.id, report_id: d.id, ...data });
        }
      });
      const list = Array.from(reportMap.values());
      list.sort((a: any, b: any) => {
        const ta = new Date(a.report_date || a.created_at || 0).getTime();
        const tb = new Date(b.report_date || b.created_at || 0).getTime();
        return tb - ta;
      });
      setReports(list);
    }, (err) => console.warn('Health reports live sync:', err));

    const unsubGenericReports = onSnapshot(collection(db, 'reports'), (snap) => {
      if (!mounted) return;
      snap.docs.forEach(d => {
        const data = d.data();
        if (matchesPatient(data) || targetIds.includes(data.patient_id) || targetIds.includes(data.account_id)) {
          reportMap.set(d.id, { id: d.id, report_id: d.id, ...data });
        }
      });
      const list = Array.from(reportMap.values());
      list.sort((a: any, b: any) => {
        const ta = new Date(a.report_date || a.created_at || 0).getTime();
        const tb = new Date(b.report_date || b.created_at || 0).getTime();
        return tb - ta;
      });
      setReports(list);
    }, (err) => console.warn('Generic reports live sync:', err));

    // 5. Invoices & Billing live collections
    const invMap = new Map<string, any>();
    const unsubInvoices = onSnapshot(collection(db, 'invoices'), (snapInv) => {
      if (!mounted) return;
      snapInv.docs.forEach(d => {
        const data = d.data();
        if (matchesPatient(data)) {
          invMap.set(d.id, { id: d.id, invoice_id: d.id, is_invoice: true, ...data });
        }
      });
      setDbInvoices(Array.from(invMap.values()));
    }, (err) => console.warn('Invoices live sync:', err));

    const unsubBilling = onSnapshot(collection(db, 'billing'), (snapBill) => {
      if (!mounted) return;
      snapBill.docs.forEach(d => {
        const data = d.data();
        if (matchesPatient(data)) {
          invMap.set(d.id, { id: d.id, bill_id: d.id, is_bill: true, ...data });
        }
      });
      setDbInvoices(Array.from(invMap.values()));
    }, (err) => console.warn('Billing live sync:', err));

    // 6. Vitals
    const unsubVitals = onSnapshot(collection(db, 'vitals'), (snap) => {
      if (!mounted) return;
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(matchesPatient);

      list.sort((a: any, b: any) => {
        const ta = new Date(a.recorded_at || a.created_at || 0).getTime();
        const tb = new Date(b.recorded_at || b.created_at || 0).getTime();
        return tb - ta;
      });
      setVitals(list);
    }, (err) => console.warn('Vitals live sync:', err));

    // 7. AI Sessions & Triage
    const unsubAi = onSnapshot(collection(db, 'ai_sessions'), (snap) => {
      if (!mounted) return;
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(matchesPatient);

      list.sort((a: any, b: any) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
      setAiSessions(list);
    }, (err) => console.warn('AI sessions live sync:', err));

    // 8. Patient Clinic Links live sync for active treating clinic tracking
    const unsubLinks = onSnapshot(collection(db, 'patient_clinic_links'), (snap) => {
      if (!mounted) return;
      const list = snap.docs
        .map(d => ({ link_id: d.id, ...d.data() }))
        .filter((l: any) => matchesPatient(l) || targetIds.includes(l.patient_id) || targetIds.includes(l.account_id));
      setPatientClinicLinks(list);
    }, (err) => console.warn('Patient clinic links live sync:', err));

    return () => {
      mounted = false;
      unsubAccounts();
      unsubAppointments();
      unsubConsultations();
      unsubHealthReports();
      unsubGenericReports();
      unsubInvoices();
      unsubBilling();
      unsubVitals();
      unsubAi();
      unsubLinks();
    };
  }, [targetSyncKey, matchesPatient]);

  const currentProfile = liveProfile || patient || {};
  const isReadOnly = currentProfile?.status === 'left';
  const viewingClinicId = clinic?.clinic_id;

  const [sendingFollowupId, setSendingFollowupId] = useState<string | null>(null);

  const handleSendFollowupDueWhatsApp = async (cons: any) => {
    const recipientPhone = liveProfile?.phone || currentProfile?.phone || patient?.phone || cons.patient_phone;
    if (!recipientPhone) {
      toast('No valid patient phone number found to send WhatsApp reminder.', 'error');
      return;
    }
    setSendingFollowupId(cons.id);
    try {
      const res = await sendWhatsAppFollowupDueViaAPI({
        to: recipientPhone,
        clinicId: clinic?.clinic_id || cons.clinic_id || '',
        patientName: liveProfile?.name || currentProfile?.name || patientName || 'Patient',
        doctorName: cons.doctor_name || clinic?.doctor_name || 'Doctor',
        clinicName: clinic?.name || 'Clinic',
        dueDate: formatDate(cons.follow_up_date),
        clinicPhone: clinic?.phone || '+91 73961 11081',
      });
      if (res.success) {
        toast(`Follow-up WhatsApp reminder sent successfully to ${recipientPhone}!`, 'success');
      } else {
        toast(res.error || 'Failed to dispatch WhatsApp follow-up reminder.', 'error');
      }
    } catch (err: any) {
      toast(err?.message || 'Failed to send WhatsApp follow-up reminder.', 'error');
    } finally {
      setSendingFollowupId(null);
    }
  };

  // Active clinic link resolution
  const activeLink = useMemo(() => {
    return patientClinicLinks.find((l: any) => l.is_current_active === true && l.status === 'active');
  }, [patientClinicLinks]);

  const resolvedActiveClinicId = useMemo(() => {
    return activeLink?.clinic_id || currentProfile?.current_clinic_id || currentProfile?.clinic_id || null;
  }, [activeLink, currentProfile]);

  // Is viewing clinic the current active treating clinic for the patient?
  const isCurrentActiveTreatingClinic = useMemo(() => {
    // If not in a clinic context (e.g. system admin), full access
    if (!viewingClinicId) return true;
    // If patient has no active clinic set yet, treating clinic operates with continuity
    if (!resolvedActiveClinicId) return true;
    return viewingClinicId === resolvedActiveClinicId;
  }, [viewingClinicId, resolvedActiveClinicId]);

  // Strict Clinic-Level Data Isolation & Continuity Filters
  const visibleConsultations = useMemo(() => {
    if (isCurrentActiveTreatingClinic) {
      // Active treating clinic: sees full authorized historical medical history (continuity) + own
      return consultations;
    }
    // Previous clinic: STRICT ISOLATION. Only see consultations originated by viewingClinicId
    return consultations.filter((c: any) => {
      const cClinicId = c.clinic_id || c.clinic?.clinic_id;
      return cClinicId === viewingClinicId;
    });
  }, [consultations, isCurrentActiveTreatingClinic, viewingClinicId]);

  const visibleAppointments = useMemo(() => {
    if (isCurrentActiveTreatingClinic) {
      return appointments;
    }
    return appointments.filter((a: any) => {
      const aClinicId = a.clinic_id || a.clinic?.clinic_id;
      return aClinicId === viewingClinicId;
    });
  }, [appointments, isCurrentActiveTreatingClinic, viewingClinicId]);

  const visibleReports = useMemo(() => {
    if (isCurrentActiveTreatingClinic) {
      return reports;
    }
    return reports.filter((r: any) => {
      const rClinicId = r.clinic_id;
      return !rClinicId || rClinicId === viewingClinicId;
    });
  }, [reports, isCurrentActiveTreatingClinic, viewingClinicId]);

  const visibleInvoices = useMemo(() => {
    // Operational billing records are strictly clinic-private
    return invoices.filter((inv: any) => {
      const invClinicId = inv.clinic_id;
      if (!invClinicId || !viewingClinicId) return true;
      return invClinicId === viewingClinicId;
    });
  }, [invoices, viewingClinicId]);

  const visibleVitals = useMemo(() => {
    if (isCurrentActiveTreatingClinic) {
      return vitals;
    }
    return vitals.filter((v: any) => {
      const vClinicId = v.clinic_id;
      return !vClinicId || vClinicId === viewingClinicId;
    });
  }, [vitals, isCurrentActiveTreatingClinic, viewingClinicId]);

  // Derived financial numbers from strictly authorized visible invoices
  const { totalBilled, totalPaid, totalPending } = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let pending = 0;
    visibleInvoices.forEach(inv => {
      const amt = Number(inv.amount || inv.total_amount || 0);
      billed += amt;
      const status = (inv.payment_status || inv.status || '').toLowerCase();
      if (status === 'paid' || status === 'completed') {
        paid += amt;
      } else if (status !== 'cancelled') {
        pending += amt;
      }
    });
    return { totalBilled: billed, totalPaid: paid, totalPending: pending };
  }, [visibleInvoices]);

  const latestVital = visibleVitals[0] || null;
  const abnormalReportsCount = visibleReports.filter(r => r.urgent_flags && r.urgent_flags.length > 0).length;

  // Print / View consultation Rx helper (Opens production-ready A4 Prescription)
  const handlePrintPrescription = (cons: any) => {
    setSelectedPrescriptionConsultation(cons);
  };

  // View official invoice modal helper
  const handleViewInvoice = (inv: any) => {
    setViewingInvoice(inv);
  };

  // Mark appointment done directly from the patient history
  const handleMarkApptComplete = async (apptId: string) => {
    setCompletingApptId(apptId);
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: 'done',
        completed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error completing appt:', err);
    } finally {
      setCompletingApptId(null);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-slate-200">
      {/* Scrollable Tabs Header */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide no-scrollbar">
        {[
          { id: 'overview', label: 'Overview & Records', icon: Activity, count: 'Live', alert: false },
          { id: 'appointments', label: 'Appointments', icon: Calendar, count: visibleAppointments.length, alert: false },
          { id: 'consultations', label: 'Prescriptions & Notes', icon: Pill, count: visibleConsultations.length, alert: false },
          { id: 'reports', label: 'Lab Reports & Docs', icon: FileText, count: visibleReports.length, alert: abnormalReportsCount > 0 },
          { id: 'invoices', label: 'Billing & Invoices', icon: Receipt, count: visibleInvoices.length, alert: totalPending > 0 },
          { id: 'vitals', label: 'Vitals & Intake Data', icon: Heart, count: visibleVitals.length, alert: false },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as any)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all shadow-sm ${
              tab === t.id 
                ? 'bg-primary text-white shadow-primary/20 shadow-md ring-2 ring-primary/20' 
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <t.icon size={15} className={tab === t.id ? 'text-white' : 'text-primary'} />
            {t.label}
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              tab === t.id 
                ? 'bg-white/20 text-white' 
                : 'bg-slate-100 text-slate-700 border border-slate-200'
            }`}>
              {t.count}
            </span>
            {t.alert && (
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" title="Requires attention" />
            )}
          </button>
        ))}
      </div>

      {/* Main Tab Panel */}
      <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 min-h-[360px]">
        {/* Clinic Access Status Banner */}
        {!isCurrentActiveTreatingClinic && (
          <div className="mb-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <ShieldAlert size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="font-bold text-amber-900">Historical Records View · Clinic Data Isolation Enforced</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  This patient is currently receiving active care at another clinic. Only records and prescriptions originated by your clinic are displayed here. All records from other clinics remain strictly protected.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px] uppercase tracking-wider shrink-0 border border-amber-300">
              Isolated
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & COMPLETE CLINICAL DOSSIER */}
        {/* ========================================================================= */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Quick Warning Banners */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Allergies */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                currentProfile.allergies && currentProfile.allergies !== 'None'
                  ? 'bg-red-50 border-red-200 text-red-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <AlertTriangle size={16} className={currentProfile.allergies && currentProfile.allergies !== 'None' ? 'text-red-600 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Allergies</p>
                  <p className="text-xs font-semibold truncate">{currentProfile.allergies || 'None recorded'}</p>
                </div>
              </div>

              {/* Chronic Conditions */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                currentProfile.chronic_conditions && currentProfile.chronic_conditions !== 'None'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-700'
              }`}>
                <AlertCircle size={16} className={currentProfile.chronic_conditions && currentProfile.chronic_conditions !== 'None' ? 'text-amber-600 shrink-0 mt-0.5' : 'text-slate-400 shrink-0 mt-0.5'} />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Chronic Conditions</p>
                  <p className="text-xs font-semibold truncate">{currentProfile.chronic_conditions || 'None recorded'}</p>
                </div>
              </div>

              {/* Blood Group */}
              <div className="p-3 rounded-xl border bg-white border-slate-200 flex items-start gap-2.5">
                <Droplet size={16} className="text-red-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Blood Group</p>
                  <p className="text-xs font-bold text-slate-800">{currentProfile.blood_group || 'Unknown blood group'}</p>
                </div>
              </div>
            </div>

            {/* Live Stats Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Total Visits</span>
                  <Calendar size={16} className="text-primary" />
                </div>
                <p className="text-xl font-bold text-slate-900">{visibleAppointments.length}</p>
                <p className="text-[11px] text-emerald-600 font-medium">
                  {visibleAppointments.filter((a: any) => a.status === 'done').length} Completed
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Prescriptions</span>
                  <Pill size={16} className="text-indigo-600" />
                </div>
                <p className="text-xl font-bold text-slate-900">{visibleConsultations.length}</p>
                <p className="text-[11px] text-slate-500 font-medium">
                  {visibleConsultations[0] ? `Latest: ${formatDate(visibleConsultations[0].created_at)}` : 'No Rx on record'}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Lab Reports</span>
                  <FileText size={16} className="text-teal-600" />
                </div>
                <p className="text-xl font-bold text-slate-900">{visibleReports.length}</p>
                <p className={`text-[11px] font-medium ${abnormalReportsCount > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                  {abnormalReportsCount > 0 ? `${abnormalReportsCount} Abnormal values` : 'All normal'}
                </p>
              </div>

              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 mb-1">
                  <span className="text-xs font-semibold">Total Billed</span>
                  <Receipt size={16} className="text-amber-600" />
                </div>
                <p className="text-xl font-bold text-slate-900">₹{totalBilled}</p>
                <p className={`text-[11px] font-medium ${totalPending > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {totalPending > 0 ? `₹${totalPending} Pending` : 'Fully Settled'}
                </p>
              </div>
            </div>

            {/* Demographics & Intake Details Card */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User size={14} className="text-primary" /> Patient Demographics & Profile
                </h4>
                <div className="flex items-center gap-2">
                  {!isReadOnly && (
                    <button
                      onClick={openEditDemographics}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-primary bg-teal-50 border border-teal-200 hover:bg-teal-100 transition shadow-2xs"
                    >
                      <Edit3 size={12} /> Edit Info & DOB
                    </button>
                  )}
                  <span className="text-xs text-slate-500 font-medium">
                    ID: <span className="font-bold text-slate-700">{currentProfile.display_id || currentProfile.patient_code || (currentProfile.patient_id ? currentProfile.patient_id.slice(0, 10) : '—')}</span>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Full Legal Name</span>
                  <span className="font-semibold text-slate-800">{currentProfile.name || patientName || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Age & Gender</span>
                  <span className="font-semibold text-slate-800">{currentProfile.age ?? '—'} yrs · {currentProfile.gender ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Date of Birth (DOB)</span>
                  <span className="font-semibold text-slate-800">{currentProfile.dob ? formatDate(currentProfile.dob) : '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Phone size={11} /> Primary Contact Phone
                  </span>
                  {currentProfile.phone ? (
                    <a href={`tel:${currentProfile.phone}`} className="font-semibold text-primary hover:underline">{currentProfile.phone}</a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
                    <Mail size={11} /> Email Address
                  </span>
                  {currentProfile.email ? (
                    <a href={`mailto:${currentProfile.email}`} className="font-semibold text-primary hover:underline truncate block">{currentProfile.email}</a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5 flex items-center gap-1">
                    <MapPin size={11} /> Residential Address
                  </span>
                  <span className="font-semibold text-slate-800">{currentProfile.address || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Emergency Contact</span>
                  <span className="font-semibold text-slate-800">{currentProfile.emergency_contact_name || '—'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Emergency Phone</span>
                  {currentProfile.emergency_contact_phone ? (
                    <a href={`tel:${currentProfile.emergency_contact_phone}`} className="font-semibold text-red-600 hover:underline">
                      {currentProfile.emergency_contact_phone}
                    </a>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Registration Date</span>
                  <span className="font-semibold text-slate-800">{formatDate(currentProfile.created_at)}</span>
                </div>
              </div>

              {/* Current Medications */}
              {currentProfile.current_medications && currentProfile.current_medications.length > 0 && currentProfile.current_medications[0] !== 'None' && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1.5 flex items-center gap-1">
                    <Pill size={12} className="text-primary" /> Active Medications from Intake Form
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentProfile.current_medications.map((med: string, i: number) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-medium">
                        <Pill size={11} /> {med}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Latest Vitals Bar */}
            {latestVital && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Heart size={14} className="text-red-500" /> Latest Vitals Reading
                  </h4>
                  <span className="text-xs text-slate-500">
                    Recorded: {formatDate(latestVital.recorded_at || latestVital.created_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">BP (mmHg)</span>
                    <span className="text-sm font-bold text-slate-800">
                      {latestVital.systolic_bp && latestVital.diastolic_bp ? `${latestVital.systolic_bp}/${latestVital.diastolic_bp}` : '—'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Pulse</span>
                    <span className="text-sm font-bold text-slate-800">{latestVital.pulse ? `${latestVital.pulse} bpm` : '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Temperature</span>
                    <span className="text-sm font-bold text-slate-800">{latestVital.temperature ? `${latestVital.temperature}°F` : '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">SpO2</span>
                    <span className="text-sm font-bold text-slate-800">{latestVital.spo2 ? `${latestVital.spo2}%` : '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Weight</span>
                    <span className="text-sm font-bold text-slate-800">{latestVital.weight ? `${latestVital.weight} kg` : '—'}</span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">BMI</span>
                    <span className="text-sm font-bold text-slate-800">{latestVital.bmi || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* AI Clinical Navigator / Triage Assessment */}
            {(aiSessions.length > 0 || appointments.some(a => a.ai_summary)) && (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50/40 p-4 rounded-xl border border-emerald-200 shadow-sm space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Sparkles size={13} />
                    </div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                      AI Patient Intake & Triage Assessment
                    </h4>
                  </div>
                  {aiSessions[0]?.triage_level && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                      aiSessions[0].triage_level === 'urgent' ? 'bg-red-100 text-red-700 border border-red-200' :
                      aiSessions[0].triage_level === 'moderate' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    }`}>
                      Triage: {aiSessions[0].triage_level}
                    </span>
                  )}
                </div>

                <div className="text-xs space-y-1.5 text-slate-700">
                  {aiSessions[0]?.symptoms_entered && (
                    <p><span className="font-semibold text-slate-900">Chief Symptoms:</span> {aiSessions[0].symptoms_entered}</p>
                  )}
                  {aiSessions[0]?.ai_response && (
                    <p className="bg-white/80 p-2.5 rounded-lg border border-emerald-100 text-slate-800">
                      {aiSessions[0].ai_response}
                    </p>
                  )}
                  {aiSessions[0]?.recommendations && aiSessions[0].recommendations.length > 0 && (
                    <div className="pt-1">
                      <span className="font-semibold text-slate-900 block mb-1">Clinical Recommendations:</span>
                      <ul className="space-y-1 pl-1">
                        {aiSessions[0].recommendations.map((rec: any, idx: number) => (
                          <li key={idx} className="flex items-start gap-1.5 text-slate-600">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                            {typeof rec === 'string' ? rec : rec.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: APPOINTMENTS */}
        {/* ========================================================================= */}
        {tab === 'appointments' && (
          <div className="space-y-3">
            {visibleAppointments.length === 0 ? (
              <EmptyState 
                icon={<Calendar size={22} />} 
                title="No appointments on record" 
                description="This patient has no appointment history in the clinic database." 
              />
            ) : (
              visibleAppointments.map((apt: any) => {
                const isDone = apt.status === 'done' || apt.status === 'completed';
                const isCancelled = apt.status === 'cancelled';
                const isWaiting = apt.status === 'waiting' || apt.status === 'in-progress' || !apt.status;

                return (
                  <div key={apt.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-primary/40 transition">
                    <div className="flex items-start gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                        {(apt.display_token ? apt.display_token.replace(/^EM-/, 'QR-') : null) || (apt.token_number ? `#${apt.token_number}` : 'APT')}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800 text-sm">
                            {formatDate(apt.date)} at {formatTime(apt.time_slot)}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isDone ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            isCancelled ? 'bg-red-100 text-red-700 border border-red-200' :
                            'bg-amber-100 text-amber-700 border border-amber-200'
                          }`}>
                            {apt.status || 'Waiting'}
                          </span>
                          {apt.triage_level === 'urgent' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">Urgent</span>
                          )}
                          {apt.visit_type && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 capitalize">
                              {apt.visit_type.replace('-', ' ')}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                          <span>Doctor: <strong className="text-slate-700">{apt.doctor_name || apt.doctor?.name || 'Assigned Doctor'}</strong></span>
                          <span>·</span>
                          <span>Reason: <strong className="text-slate-700">{apt.reason || apt.chief_complaint || 'General Consultation'}</strong></span>
                        </p>

                        {apt.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100">
                            <strong>Note:</strong> {apt.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {isWaiting && (
                        <button
                          onClick={() => handleMarkApptComplete(apt.id)}
                          disabled={completingApptId === apt.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                        >
                          <CheckCircle2 size={13} />
                          {completingApptId === apt.id ? 'Completing…' : 'Mark Done'}
                        </button>
                      )}
                      {isDone && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
                          <Check size={13} className="text-emerald-600" /> Completed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: PRESCRIPTIONS & CONSULTATION NOTES */}
        {/* ========================================================================= */}
        {tab === 'consultations' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Doctor Prescriptions & Notes ({visibleConsultations.length})</h3>
                <p className="text-xs text-slate-500">Official digital prescriptions with print-ready A4 documentation</p>
              </div>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={() => setWritePrescriptionOpen(true)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto shrink-0 shadow-sm"
                >
                  <Pill size={14} /> + Write New Prescription
                </button>
              )}
            </div>

            {visibleConsultations.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                <Pill size={32} className="text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">No prescriptions recorded yet</h4>
                {!isReadOnly ? (
                  <>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">Click below to create and fill an official A4 doctor prescription for this patient.</p>
                    <button
                      type="button"
                      onClick={() => setWritePrescriptionOpen(true)}
                      className="btn-primary text-xs py-2 px-4 inline-flex items-center gap-1.5 shadow-sm"
                    >
                      <Pill size={14} /> + Write First Prescription
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">This patient has left the clinic. You can no longer write prescriptions for them.</p>
                )}
              </div>
            ) : (
              visibleConsultations.map((cons: any) => {
                const rxItems = Array.isArray(cons.prescriptions) && cons.prescriptions.length > 0 
                  ? cons.prescriptions 
                  : cons.prescription ? [{ medicine_name: cons.prescription, dosage: '', frequency: '', duration: '' }] : [];

                const isFromPreviousClinic = Boolean(cons.clinic_id && viewingClinicId && cons.clinic_id !== viewingClinicId);

                return (
                  <div key={cons.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Stethoscope size={16} className="text-primary" />
                          <h4 className="font-bold text-slate-900 text-sm">Consultation Record</h4>
                          <span className="text-xs text-slate-400">· {formatDate(cons.created_at)}</span>
                          {isFromPreviousClinic && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <Building2 size={11} /> Historical: {cons.clinic_name || 'Previous Clinic'}
                            </span>
                          )}
                        </div>
                        {cons.doctor_name && (
                          <p className="text-xs text-slate-500 mt-0.5">Doctor: {cons.doctor_name}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {cons.follow_up_date && (
                          <>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
                              <Clock size={12} /> Follow-up: {formatDate(cons.follow_up_date)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSendFollowupDueWhatsApp(cons)}
                              disabled={sendingFollowupId === cons.id}
                              className="px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                              title="Send WhatsApp Follow-up Due Reminder to Patient"
                            >
                              <MessageCircle size={13} className="text-emerald-600" />
                              {sendingFollowupId === cons.id ? 'Sending...' : 'Remind Follow-up'}
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedPrescriptionConsultation(cons)}
                          className="px-2.5 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-[#0F6E56] border border-teal-200 text-xs font-semibold flex items-center gap-1 transition"
                          title="View production-ready A4 Doctor Prescription"
                        >
                          <FileText size={13} /> View A4 Rx
                        </button>
                        <button
                          onClick={() => setSelectedPrescriptionConsultation(cons)}
                          className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                          title="Print or export Rx"
                        >
                          <Printer size={13} /> Print Rx
                        </button>
                      </div>
                    </div>

                    {/* Diagnosis */}
                    {cons.diagnosis && (
                      <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Working Diagnosis</p>
                        <p className="text-xs font-semibold text-slate-900">{cons.diagnosis}</p>
                      </div>
                    )}

                    {/* Symptoms */}
                    {cons.symptoms && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Symptoms Noted</p>
                        <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100">{cons.symptoms}</p>
                      </div>
                    )}

                    {/* Structured Prescriptions */}
                    {rxItems.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Prescribed Medications</p>
                        <div className="grid gap-2">
                          {rxItems.map((p: any, i: number) => (
                            <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg text-xs border border-slate-200/80">
                              <div className="flex items-center gap-2.5">
                                <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Pill size={13} />
                                </div>
                                <div>
                                  <span className="font-bold text-slate-800">{p.medicine_name || p.name || 'Medicine'}</span>
                                  {(p.dosage || p.frequency) && (
                                    <span className="text-slate-500 ml-2 font-medium">({p.dosage || ''} {p.frequency ? `· ${p.frequency}` : ''})</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                {p.duration && (
                                  <span className="bg-white px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 border border-slate-200">
                                    {p.duration}
                                  </span>
                                )}
                                {p.instructions && (
                                  <span className="text-[11px] text-slate-500 italic">
                                    {p.instructions}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical notes */}
                    {cons.notes && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clinical Notes</p>
                        <p className="text-xs text-slate-600">{cons.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LAB REPORTS & DOCUMENTS */}
        {/* ========================================================================= */}
        {tab === 'reports' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-800">Medical Reports & Diagnostic Documents ({visibleReports.length})</h3>
                <p className="text-xs text-slate-500">Live synchronized lab tests, radiology scans, pathology, and diagnostic PDFs</p>
              </div>
              {!isReadOnly && (
                <button 
                  onClick={() => setUploadReportsModalOpen(true)}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <UploadCloud size={14} /> + Upload Reports (Multiple)
                </button>
              )}
            </div>

            {visibleReports.length === 0 ? (
              <EmptyState 
                icon={<FileText size={22} />} 
                title="No lab reports or documents" 
                description="Uploaded pathology tests, blood tests, radiology scans, and PDFs will appear here." 
                action={
                  !isReadOnly ? (
                    <button 
                      onClick={() => setUploadReportsModalOpen(true)}
                      className="btn-primary text-xs flex items-center gap-1.5 mt-2"
                    >
                      <UploadCloud size={14} /> Upload Patient Reports (Multiple)
                    </button>
                  ) : undefined
                }
              />
            ) : (
              visibleReports.map((rep: any) => {
                const hasAbnormal = rep.urgent_flags && rep.urgent_flags.length > 0;
                const fileUrl = rep.file_url || rep.original_file_url || rep.url;

                return (
                  <div key={rep.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-primary/40 transition">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          hasAbnormal ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-600'
                        }`}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-slate-900 text-sm">{rep.report_type || rep.title || 'Medical Diagnostic Report'}</p>
                            {hasAbnormal && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                                <AlertTriangle size={10} /> {rep.urgent_flags.length} Abnormal
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Date: {formatDate(rep.report_date || rep.created_at)}
                          </p>
                        </div>
                      </div>

                      {fileUrl && (
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <a 
                            href={fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                          >
                            <FileCheck size={13} /> View Document
                          </a>
                          <a 
                            href={fileUrl} 
                            download 
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition"
                            title="Download document"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Abnormal flags detail */}
                    {hasAbnormal && (
                      <div className="bg-red-50 p-2.5 rounded-lg border border-red-100">
                        <p className="text-[10px] font-bold text-red-800 uppercase tracking-wider mb-1">Abnormal Findings Alert</p>
                        <div className="flex flex-wrap gap-1.5">
                          {rep.urgent_flags.map((flag: string, idx: number) => (
                            <span key={idx} className="bg-white px-2 py-0.5 rounded text-xs font-semibold text-red-700 border border-red-200">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Summary & Findings */}
                    {(rep.summary || rep.findings) && (
                      <div className="text-xs text-slate-700 space-y-1">
                        {rep.summary && <p><strong className="text-slate-900">Summary:</strong> {rep.summary}</p>}
                        {rep.findings && <p><strong className="text-slate-900">Findings:</strong> {rep.findings}</p>}
                      </div>
                    )}

                    {/* Extracted Key Metrics */}
                    {rep.key_metrics && Object.keys(rep.key_metrics).length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Extracted Clinical Values</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {Object.entries(rep.key_metrics).map(([k, v]: [string, any], idx: number) => (
                            <div key={idx} className="bg-slate-50 p-2 rounded-lg border border-slate-100 text-xs">
                              <span className="text-[10px] text-slate-400 uppercase block truncate">{k}</span>
                              <span className="font-semibold text-slate-800 truncate block">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: BILLING & INVOICES */}
        {/* ========================================================================= */}
        {tab === 'invoices' && (
          <div className="space-y-4">
            {/* Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Billed</span>
                <span className="text-base sm:text-lg font-bold text-slate-900">₹{totalBilled}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase text-emerald-600 block">Collected / Paid</span>
                <span className="text-base sm:text-lg font-bold text-emerald-700">₹{totalPaid}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 text-center">
                <span className="text-[10px] font-bold uppercase text-amber-600 block">Balance Due</span>
                <span className={`text-base sm:text-lg font-bold ${totalPending > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                  ₹{totalPending}
                </span>
              </div>
            </div>

            {visibleInvoices.length === 0 ? (
              <EmptyState 
                icon={<Receipt size={22} />} 
                title="No billing history" 
                description="Consultation invoices and pharmacy receipts for this patient will show here." 
              />
            ) : (
              <div className="space-y-3">
                {visibleInvoices.map((inv: any) => {
                  const isPaid = (inv.payment_status || inv.status || '').toLowerCase() === 'paid';
                  const isCancelled = (inv.payment_status || inv.status || '').toLowerCase() === 'cancelled';

                  return (
                    <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">
                            {inv.is_bill ? 'Bill' : 'Invoice'} #{inv.id.slice(0, 8).toUpperCase()}
                          </p>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            isPaid ? 'bg-emerald-100 text-emerald-700' :
                            isCancelled ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {inv.payment_status || inv.status || 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Date: {formatDate(inv.date || inv.created_at)} · Method: <span className="uppercase font-semibold text-slate-700">{inv.payment_method || 'Cash'}</span>
                        </p>
                        {inv.notes && (
                          <p className="text-xs text-slate-600 mt-1 italic">{inv.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right">
                          <p className="text-base font-bold text-slate-900">₹{inv.amount || inv.total_amount || 0}</p>
                          <p className="text-[11px] text-slate-500">{isPaid ? 'Paid in full' : 'Unsettled'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleViewInvoice(inv)}
                            className="px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold flex items-center gap-1.5 transition border border-teal-200"
                            title="View official invoice"
                          >
                            <FileText size={13} className="text-[#0F6E56]" /> View Invoice
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: VITALS & CLINICAL INTAKE HISTORY */}
        {/* ========================================================================= */}
        {tab === 'vitals' && (
          <div className="space-y-4">
            {visibleVitals.length === 0 ? (
              <EmptyState 
                icon={<Heart size={22} />} 
                title="No vitals recorded" 
                description="Nurse or triage recorded vitals (BP, Pulse, Temperature, SpO2) will appear here." 
              />
            ) : (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Vitals Recorded Over Time</h4>
                <div className="grid gap-3">
                  {visibleVitals.map((v: any) => (
                    <div key={v.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Heart size={14} className="text-red-500" /> Recorded on {formatDate(v.recorded_at || v.created_at)}
                        </span>
                        {v.recorded_by && <span className="text-xs text-slate-400">By: {v.recorded_by}</span>}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">Blood Pressure</span>
                          <span className="font-bold text-slate-800">
                            {v.systolic_bp && v.diastolic_bp ? `${v.systolic_bp}/${v.diastolic_bp} mmHg` : '—'}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">Heart Rate</span>
                          <span className="font-bold text-slate-800">{v.pulse ? `${v.pulse} bpm` : '—'}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">Temperature</span>
                          <span className="font-bold text-slate-800">{v.temperature ? `${v.temperature}°F` : '—'}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">Oxygen (SpO2)</span>
                          <span className="font-bold text-slate-800">{v.spo2 ? `${v.spo2}%` : '—'}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">Weight / Height</span>
                          <span className="font-bold text-slate-800">{v.weight ? `${v.weight} kg` : '—'} / {v.height ? `${v.height} cm` : '—'}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <span className="text-[10px] text-slate-400 block uppercase">BMI</span>
                          <span className="font-bold text-slate-800">{v.bmi || '—'}</span>
                        </div>
                      </div>
                      {v.notes && (
                        <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                          <strong>Vitals Note:</strong> {v.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Patient Reports Modal (Multi-file batch upload) */}
      <UploadPatientReportsModal
        open={uploadReportsModalOpen}
        patientId={patientId}
        patientName={patientDisplayName}
        patient={patient}
        clinic={clinic}
        onClose={() => setUploadReportsModalOpen(false)}
      />

      {/* Production-Ready A4 Doctor Prescription Modal */}
      {selectedPrescriptionConsultation && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in">
          <div className="relative max-w-4xl w-full my-auto">
            <PrescriptionView
              consultation={selectedPrescriptionConsultation}
              patient={currentProfile || patient}
              clinic={clinic}
              doctor={selectedPrescriptionConsultation.doctor || { name: selectedPrescriptionConsultation.doctor_name }}
              onClose={() => setSelectedPrescriptionConsultation(null)}
            />
          </div>
        </div>
      )}

      {/* Production-Ready A4 Official Invoice Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex justify-center p-2 sm:p-4 animate-fade-in">
          <div className="relative max-w-4xl w-full my-auto">
            <InvoiceView
              invoice={viewingInvoice}
              patient={currentProfile || patient}
              clinic={clinic}
              onClose={() => setViewingInvoice(null)}
            />
          </div>
        </div>
      )}

      {/* Write & Fill Doctor Prescription Modal */}
      {writePrescriptionOpen && (
        <WritePrescriptionModal
          open={writePrescriptionOpen}
          patient={currentProfile}
          clinic={clinic}
          onClose={() => setWritePrescriptionOpen(false)}
        />
      )}

      {/* Edit Patient Demographics & DOB Modal */}
      {editingDemographics && (
        <Modal
          open={editingDemographics}
          onClose={() => setEditingDemographics(false)}
          title="Edit Patient Demographics & Profile"
          subtitle={`Update DOB, age, and clinical details for ${currentProfile.name || patientName}`}
          size="lg"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingDemographics(false)}
                disabled={savingDemo}
                className="btn-ghost"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="edit-demo-form"
                disabled={savingDemo}
                className="btn-primary flex items-center gap-1.5"
              >
                {savingDemo ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {savingDemo ? 'Saving Changes…' : 'Save Changes'}
              </button>
            </>
          }
        >
          <form id="edit-demo-form" onSubmit={saveDemographics} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Full Legal Name *</label>
                <input
                  required
                  className="input"
                  value={editDemoForm.name}
                  onChange={e => setEditDemoForm({ ...editDemoForm, name: e.target.value })}
                  placeholder="Full Name"
                />
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  value={editDemoForm.phone}
                  onChange={e => setEditDemoForm({ ...editDemoForm, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label className="label">Date of Birth (DOB)</label>
                <input
                  type="date"
                  max={localDateISO(new Date())}
                  className="input"
                  value={formatDobForInput(editDemoForm.dob)}
                  onChange={e => handleEditDemoDobChange(e.target.value)}
                />
              </div>
              <div>
                <label className="label">
                  Age (Years) {editDemoForm.dob && <span className="text-[10px] text-teal-700 font-normal">(Auto-calculated)</span>}
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  tabIndex={-1}
                  className="input font-mono bg-slate-100 text-slate-700 font-semibold cursor-not-allowed select-none border-slate-200"
                  placeholder="Computed from DOB"
                  value={editDemoForm.age ? `${editDemoForm.age} yrs` : '—'}
                />
              </div>
              <div>
                <label className="label">Gender</label>
                <select
                  className="select"
                  value={editDemoForm.gender}
                  onChange={e => setEditDemoForm({ ...editDemoForm, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="label">Blood Group</label>
                <select
                  className="select"
                  value={editDemoForm.blood_group}
                  onChange={e => setEditDemoForm({ ...editDemoForm, blood_group: e.target.value })}
                >
                  {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'Unknown'].map(bg => (
                    <option key={bg} value={bg}>{bg}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label">Email Address</label>
                <input
                  type="email"
                  className="input"
                  value={editDemoForm.email}
                  onChange={e => setEditDemoForm({ ...editDemoForm, email: e.target.value })}
                  placeholder="patient@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Residential Address</label>
                <textarea
                  rows={2}
                  className="input resize-none"
                  value={editDemoForm.address}
                  onChange={e => setEditDemoForm({ ...editDemoForm, address: e.target.value })}
                  placeholder="Street, locality, city, pincode"
                />
              </div>
              <div>
                <label className="label">Emergency Contact Name</label>
                <input
                  className="input"
                  value={editDemoForm.emergency_contact_name}
                  onChange={e => setEditDemoForm({ ...editDemoForm, emergency_contact_name: e.target.value })}
                  placeholder="Guardian / Relative name"
                />
              </div>
              <div>
                <label className="label">Emergency Contact Phone</label>
                <input
                  className="input"
                  value={editDemoForm.emergency_contact_phone}
                  onChange={e => setEditDemoForm({ ...editDemoForm, emergency_contact_phone: e.target.value })}
                  placeholder="10 digit number"
                />
              </div>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ============================================================================
// UPLOAD PATIENT LAB REPORTS & DOCUMENTS (SUPPORTS MULTIPLE FILES AT ONCE)
// ============================================================================
interface QueuedPatientReport {
  id: string;
  file: File;
  name: string;
  category: string;
}

function UploadPatientReportsModal({
  open,
  patientId,
  patientName,
  patient,
  clinic,
  onClose
}: {
  open: boolean;
  patientId: string;
  patientName?: string;
  patient?: any;
  clinic?: any;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [queuedFiles, setQueuedFiles] = useState<QueuedPatientReport[]>([]);
  const [prescribedDoctor, setPrescribedDoctor] = useState(
    patient?.doctor_name || (user?.name && !['admin', 'staff', 'user'].includes(user.name.toLowerCase()) ? user.name : '') || clinic?.doctor_name || ''
  );
  const [uploading, setUploading] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQueuedFiles([]);
      setUploading(false);
      setProgress(0);
      setCurrentUploadIndex(0);
    } else {
      if (!prescribedDoctor) {
        setPrescribedDoctor(
          patient?.doctor_name || (user?.name && !['admin', 'staff', 'user'].includes(user.name.toLowerCase()) ? user.name : '') || clinic?.doctor_name || ''
        );
      }
    }
  }, [open, patient, user, clinic]);

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newItems: QueuedPatientReport[] = Array.from(files).map((f, i) => ({
      id: `${Date.now()}_${i}_${Math.random()}`,
      file: f,
      name: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      category: 'Blood Test / Hematology'
    }));
    setQueuedFiles(prev => [...prev, ...newItems]);
  };

  const removeQueuedFile = (id: string) => {
    setQueuedFiles(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: 'name' | 'category', val: string) => {
    setQueuedFiles(prev => prev.map(item => item.id === id ? { ...item, [field]: val } : item));
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (queuedFiles.length === 0) {
      toast('Please choose at least one report file to upload.', 'error');
      return;
    }

    setUploading(true);
    setProgress(0);
    setCurrentUploadIndex(0);

    const folderName = (patientName || patient?.name || 'patient').replace(/[^a-zA-Z0-9]/g, '_');
    const total = queuedFiles.length;

    try {
      for (let i = 0; i < total; i++) {
        const item = queuedFiles[i];
        setCurrentUploadIndex(i + 1);

        const ext = item.file.name.split('.').pop() || 'pdf';
        const cleanName = (item.name || item.file.name).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `patients/${folderName}/health_reports/${cleanName}_${Date.now()}_${i}.${ext}`;
        const storageRef = ref(storage, storagePath);

        const uploadTask = uploadBytesResumable(storageRef, item.file, {
          contentType: item.file.type || 'application/pdf',
          contentDisposition: 'inline'
        });

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snap) => {
              const filePct = snap.bytesTransferred / (snap.totalBytes || 1);
              const overall = Math.round(((i + filePct) / total) * 100);
              setProgress(Math.min(99, overall));
            },
            (err) => {
              console.error(err);
              reject(err);
            },
            async () => {
              try {
                const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

                const finalDoctorName = (prescribedDoctor || patient?.doctor_name || user?.name || clinic?.doctor_name || '').trim();
                const reportTitle = item.name.trim() || 'Medical Diagnostic Report';

                const docRef = doc(collection(db, 'health_reports'));
                await setDoc(docRef, {
                  report_id: docRef.id,
                  id: docRef.id,
                  patient_id: patientId || patient?.patient_id || patient?.id,
                  account_id: patient?.account_id || null,
                  clinic_id: clinic?.clinic_id || null,
                  doctor_id: patient?.doctor_id || user?.uid || null,
                  doctor_name: finalDoctorName,
                  prescribed_by: finalDoctorName,
                  report_type: reportTitle,
                  test_name: reportTitle,
                  title: reportTitle,
                  name: reportTitle,
                  patient_name: patientName || patient?.name || 'Patient',
                  patient_phone: patient?.phone || patient?.mobile || '',
                  category: item.category,
                  report_date: new Date().toISOString().split('T')[0],
                  hospital_or_doctor: finalDoctorName || clinic?.name || null,
                  original_file_url: downloadUrl,
                  file_url: downloadUrl,
                  download_url: downloadUrl,
                  original_file_type: item.file.type || 'application/pdf',
                  ai_processed: false,
                  created_at: new Date().toISOString(),
                  uploaded_by_role: 'clinic_doctor_staff'
                });
                logClinicalRecordCreated(
                  clinic?.clinic_id || 'system',
                  'clinic_staff',
                  clinic?.clinic_id || 'clinic',
                  patientId || patient?.patient_id || 'patient',
                  'health_report',
                  docRef.id
                );
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      }

      setProgress(100);
      toast(`Successfully uploaded ${total} patient report(s)!`, 'success');
      setUploading(false);
      onClose();
    } catch (err: any) {
      console.error('Patient reports upload error:', err);
      setUploading(false);
      toast('Failed to upload report(s): ' + (err.message || 'Error occurred'), 'error');
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title={`Upload Reports & Documents: ${patientName || patient?.name || 'Patient'}`} subtitle="Select and upload multiple lab results, radiology scans, blood tests, or diagnostic PDFs at once">
      <form onSubmit={handleUpload} className="space-y-4 pt-2">
        {/* Prescribing Doctor Field */}
        <div className="p-3.5 bg-blue-50/50 border border-[#106EBE]/20 rounded-xl space-y-1.5">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wide block">
            Prescribed By (Doctor Name) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={uploading}
            value={prescribedDoctor}
            onChange={(e) => setPrescribedDoctor(e.target.value)}
            placeholder="e.g. Dr. Pavan"
            className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-black focus:outline-none focus:border-[#106EBE] focus:ring-2 focus:ring-[#106EBE]/20"
          />
          <p className="text-[11px] text-slate-600">
            This doctor's name will appear on the patient's clinical records and WhatsApp notification.
          </p>
        </div>

        <input 
          ref={fileInputRef}
          type="file" 
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" 
          className="hidden" 
          id="patient-reports-multi-input"
          onChange={(e) => handleFilesAdded(e.target.files)} 
        />

        {queuedFiles.length === 0 ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-black/15 rounded-2xl p-8 text-center hover:border-primary/50 transition cursor-pointer bg-slate-50/50 hover:bg-teal-50/30"
          >
            <UploadCloud size={36} className="mx-auto text-primary mb-2" />
            <p className="text-sm font-bold text-ink">Click or Drag & Drop multiple reports / scans</p>
            <p className="text-xs text-ink-muted mt-1">Select multiple PDF reports, pathology results, X-Ray / CT scans, or prescriptions</p>
            <button type="button" className="btn-secondary text-xs mt-3 inline-flex items-center gap-1.5 pointer-events-none">
              <Plus size={14} /> Browse Reports (Multiple)
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-black/5">
              <span className="text-xs font-bold text-ink uppercase tracking-wide">
                Selected Patient Reports ({queuedFiles.length})
              </span>
              <button 
                type="button" 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> + Add More Reports
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {queuedFiles.map((item, idx) => (
                <div key={item.id} className="p-3 bg-white border border-black/10 rounded-xl space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink truncate" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <span className="text-[10px] text-ink-subtle">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>

                    <button 
                      type="button"
                      onClick={() => removeQueuedFile(item.id)}
                      disabled={uploading}
                      className="text-ink-subtle hover:text-danger p-1 rounded-lg transition"
                      title="Remove file from queue"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-black/5">
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Report Name / Test</label>
                      <input 
                        required
                        disabled={uploading}
                        className="input text-xs py-1.5"
                        value={item.name}
                        onChange={e => updateItem(item.id, 'name', e.target.value)}
                        placeholder="E.g. Complete Blood Count (CBC), Chest X-Ray"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-ink-subtle uppercase block mb-1">Category</label>
                      <select 
                        disabled={uploading}
                        className="select text-xs py-1.5"
                        value={item.category}
                        onChange={e => updateItem(item.id, 'category', e.target.value)}
                      >
                        <option value="Blood Test / Hematology">Blood Test / Hematology</option>
                        <option value="Radiology (X-Ray, CT, MRI, Ultrasound)">Radiology (X-Ray, CT, MRI, Ultrasound)</option>
                        <option value="Pathology / Histopathology">Pathology / Histopathology</option>
                        <option value="ECG / 2D Echo / Cardiology">ECG / 2D Echo / Cardiology</option>
                        <option value="Prescription & Discharge Summary">Prescription & Discharge Summary</option>
                        <option value="Biochemistry & Liver/Kidney Function">Biochemistry & Liver/Kidney Function</option>
                        <option value="Other Medical Report">Other Medical Report / Diagnostic File</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploading && (
          <div className="space-y-1.5 p-3 bg-teal-50/60 rounded-xl border border-teal-100">
            <div className="flex justify-between text-xs font-bold text-ink">
              <span>Uploading report {currentUploadIndex} of {queuedFiles.length}...</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-teal-200/50 h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-black/5">
          <button type="button" onClick={onClose} disabled={uploading} className="btn-ghost">
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {queuedFiles.length > 0 && !uploading && (
              <button 
                type="button" 
                onClick={() => setQueuedFiles([])} 
                className="btn-ghost text-xs text-danger"
              >
                Clear all
              </button>
            )}
            <button 
              type="submit" 
              disabled={uploading || queuedFiles.length === 0} 
              className="btn-primary flex items-center gap-1.5"
            >
              <Upload size={14} /> {uploading ? `Uploading (${currentUploadIndex}/${queuedFiles.length})…` : `Upload All (${queuedFiles.length}) Reports`}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
