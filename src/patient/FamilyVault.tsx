import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, Plus, Users, Trash2, ChevronDown, ChevronUp,
  User, Calendar, Droplets, Heart, AlertTriangle, Pill, X, Check,
  Pencil, Phone, FileText, CheckCircle2, Upload, ExternalLink,
  Paperclip, FileCheck, Loader2, ShieldCheck, Search, Activity,
  PhoneCall, ShieldAlert, Sparkles, FileUp
} from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { collection, query, where, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { usePatientAuth } from '../lib/patientAuth';
import { useAuth } from '../lib/auth';
import { formatDate, calculateAge } from '../lib/format';
import { DobCalendarPicker } from '../components/DobCalendarPicker';
import type { PatientTab } from './PatientBottomNav';

const RELATIONSHIPS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Guardian', 'Other'] as const;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] as const;
const CHRONIC_OPTIONS = ['Diabetes', 'Hypertension', 'Heart disease', 'Asthma', 'Thyroid', 'Kidney disease', 'None'];
const MAX_REPORTS = 4;
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB

const RELATIONSHIP_THEMES: Record<string, { bg: string; text: string; border: string; avatarBg: string }> = {
  Spouse: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', avatarBg: 'from-rose-500 to-pink-600' },
  Child: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', avatarBg: 'from-sky-500 to-blue-600' },
  Parent: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', avatarBg: 'from-amber-500 to-orange-600' },
  Sibling: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', avatarBg: 'from-purple-500 to-indigo-600' },
  Guardian: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', avatarBg: 'from-indigo-500 to-violet-600' },
  Other: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', avatarBg: 'from-emerald-500 to-teal-600' },
};

export interface FamilyReport {
  id: string;
  name: string;
  url: string;
  type?: string;
  size?: number;
  uploaded_at: string;
}

export interface FamilyMember {
  id: string;
  patient_account_id?: string;
  name: string;
  relationship: string;
  dob: string | null;
  gender: string | null;
  blood_group: string | null;
  chronic_conditions: string | null;
  allergies: string | null;
  current_medications: string | null;
  emergency_contact?: string | null;
  notes?: string | null;
  reports?: FamilyReport[];
  created_at?: string;
  updated_at?: string;
}

interface Props {
  patientId?: string | null;
  onTab: (t: PatientTab) => void;
}

interface PendingReportFile {
  id: string;
  file: File;
  name: string;
  size: number;
}

const emptyForm = {
  name: '',
  relationship: '',
  dob: '',
  gender: '',
  blood_group: '',
  conditions: ['None'] as string[],
  allergies: '',
  medications: '',
  emergency_contact: '',
  notes: '',
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const getInitials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'FM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export function FamilyVault({ patientId: propsPatientId, onTab }: Props) {
  const { account } = usePatientAuth();
  const { user, patientAccount: authPatientAccount } = useAuth();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingReportForId, setUploadingReportForId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form, setForm] = useState({ ...emptyForm });

  // Custom Confirmation Modal State (replaces ugly window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'member' | 'report';
    title: string;
    message: string;
    itemData?: any;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form reports state
  const [existingReports, setExistingReports] = useState<FamilyReport[]>([]);
  const [newReportFiles, setNewReportFiles] = useState<PendingReportFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidden file input for direct card uploads
  const directCardFileInputRef = useRef<HTMLInputElement>(null);
  const [targetMemberForDirectUpload, setTargetMemberForDirectUpload] = useState<FamilyMember | null>(null);

  // Candidate patient IDs across auth systems
  const candidateAccountIds = useMemo(() => {
    const set = new Set<string>();
    if (propsPatientId) set.add(propsPatientId);
    if (account?.account_id) set.add(account.account_id);
    if (account?.id) set.add(account.id);
    if ((account as any)?.patient_id) set.add((account as any).patient_id);
    if (authPatientAccount?.account_id) set.add(authPatientAccount.account_id);
    if (authPatientAccount?.id) set.add(authPatientAccount.id);
    if (user?.patient_account_id) set.add(user.patient_account_id);
    if (user?.uid) {
      set.add(user.uid);
      set.add(`pat_${user.uid}`);
    }
    if (user?.user_id) {
      set.add(user.user_id);
      set.add(`pat_${user.user_id}`);
    }
    try {
      const stored = localStorage.getItem('viitsa_patient_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.account_id) set.add(parsed.account_id);
        if (parsed.id) set.add(parsed.id);
      }
    } catch {}

    return Array.from(set).filter(Boolean);
  }, [propsPatientId, account, authPatientAccount, user]);

  const effectiveAccountId = useMemo(() => {
    if (candidateAccountIds.length > 0) return candidateAccountIds[0];
    let fallback = localStorage.getItem('viitsa_patient_account_id');
    if (!fallback) {
      fallback = 'pat_' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('viitsa_patient_account_id', fallback);
    }
    return fallback;
  }, [candidateAccountIds]);

  const candidateKey = candidateAccountIds.join(',');

  // Real-time Firestore sync with in-memory sorting
  useEffect(() => {
    const idsToQuery = candidateAccountIds.length > 0 ? candidateAccountIds : [effectiveAccountId];

    const q = idsToQuery.length === 1
      ? query(collection(db, 'family_members'), where('patient_account_id', '==', idsToQuery[0]))
      : query(collection(db, 'family_members'), where('patient_account_id', 'in', idsToQuery.slice(0, 10)));

    const unsub = onSnapshot(q, (snap) => {
      const map = new Map<string, FamilyMember>();
      snap.docs.forEach(d => {
        if (!map.has(d.id)) {
          map.set(d.id, { ...d.data(), id: d.id } as FamilyMember);
        }
      });
      const list = Array.from(map.values());
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setMembers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Family members onSnapshot warning:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [candidateKey, effectiveAccountId]);

  // Strictly deduplicated list of members by document ID
  const uniqueMembers = useMemo(() => {
    const map = new Map<string, FamilyMember>();
    members.forEach(m => {
      if (m.id && !map.has(m.id)) {
        map.set(m.id, m);
      }
    });
    return Array.from(map.values());
  }, [members]);

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return uniqueMembers;
    const q = searchQuery.toLowerCase().trim();
    return uniqueMembers.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.relationship.toLowerCase().includes(q) ||
      (m.blood_group && m.blood_group.toLowerCase().includes(q)) ||
      (m.chronic_conditions && m.chronic_conditions.toLowerCase().includes(q))
    );
  }, [uniqueMembers, searchQuery]);

  // Statistics summary
  const totalReportsCount = useMemo(() => {
    return uniqueMembers.reduce((acc, m) => acc + (m.reports?.length || 0), 0);
  }, [uniqueMembers]);

  const totalEmergencyContactsCount = useMemo(() => {
    return uniqueMembers.filter(m => Boolean(m.emergency_contact)).length;
  }, [uniqueMembers]);

  const toggleCondition = (c: string) => {
    if (c === 'None') {
      setForm(f => ({ ...f, conditions: ['None'] }));
      return;
    }
    setForm(f => {
      const without = f.conditions.filter(x => x !== 'None');
      const updated = without.includes(c) ? without.filter(x => x !== c) : [...without, c];
      return {
        ...f,
        conditions: updated.length === 0 ? ['None'] : updated,
      };
    });
  };

  const startAdd = () => {
    setEditingMember(null);
    setForm({ ...emptyForm });
    setExistingReports([]);
    setNewReportFiles([]);
    setError('');
    setShowAdd(true);
  };

  const startEdit = (m: FamilyMember) => {
    setEditingMember(m);
    let conds: string[] = ['None'];
    if (m.chronic_conditions && m.chronic_conditions.trim() && m.chronic_conditions !== 'None') {
      conds = m.chronic_conditions.split(',').map(s => s.trim()).filter(Boolean);
      if (conds.length === 0) conds = ['None'];
    }
    setForm({
      name: m.name || '',
      relationship: m.relationship || '',
      dob: m.dob || '',
      gender: m.gender || '',
      blood_group: m.blood_group || '',
      conditions: conds,
      allergies: m.allergies || '',
      medications: m.current_medications || '',
      emergency_contact: m.emergency_contact || '',
      notes: m.notes || '',
    });
    setExistingReports(m.reports || []);
    setNewReportFiles([]);
    setError('');
    setShowAdd(true);
    setExpanded(m.id);
  };

  // Form report file selection
  const handleFormFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = existingReports.length + newReportFiles.length;
    const availableSlots = MAX_REPORTS - currentCount;

    if (availableSlots <= 0) {
      setError(`Maximum of ${MAX_REPORTS} reports allowed per family member.`);
      e.target.value = '';
      return;
    }

    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setError(`"${oversized[0].name}" exceeds the 15MB file limit.`);
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots);
    const pending: PendingReportFile[] = selectedFiles.map(f => ({
      id: 'pending_' + Math.random().toString(36).substring(2, 9),
      file: f,
      name: f.name,
      size: f.size,
    }));

    setNewReportFiles(prev => [...prev, ...pending]);
    if (files.length > availableSlots) {
      setError(`Only ${availableSlots} more report(s) could be attached (max ${MAX_REPORTS}).`);
    } else {
      setError('');
    }
    e.target.value = '';
  };

  const removeExistingReport = (reportId: string) => {
    setExistingReports(prev => prev.filter(r => r.id !== reportId));
  };

  const removePendingReport = (id: string) => {
    setNewReportFiles(prev => prev.filter(f => f.id !== id));
  };

  // Save / Update member
  const save = async () => {
    if (!form.name.trim() || !form.relationship) {
      setError('Full Name and Relationship are required.');
      return;
    }
    setSaving(true);
    setError('');

    const now = new Date().toISOString();
    const chronicConditionsStr = form.conditions.includes('None')
      ? 'None'
      : form.conditions.filter(c => c !== 'None').join(', ') || 'None';

    try {
      // Upload pending reports to Firebase Storage
      const newlyUploadedReports: FamilyReport[] = [];
      if (newReportFiles.length > 0) {
        for (const item of newReportFiles) {
          const sanitized = item.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storagePath = `family_vault/${effectiveAccountId}/${Date.now()}_${sanitized}`;
          const storageRef = ref(storage, storagePath);
          const snap = await uploadBytes(storageRef, item.file, {
            contentType: item.file.type || 'application/octet-stream',
          });
          const url = await getDownloadURL(snap.ref);
          newlyUploadedReports.push({
            id: 'rep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            name: item.name,
            url,
            type: item.file.type || 'application/octet-stream',
            size: item.size,
            uploaded_at: now,
          });
        }
      }

      const combinedReports: FamilyReport[] = [...existingReports, ...newlyUploadedReports].slice(0, MAX_REPORTS);

      const memberPayload = {
        patient_account_id: editingMember?.patient_account_id || effectiveAccountId,
        name: form.name.trim(),
        relationship: form.relationship,
        dob: form.dob || null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        chronic_conditions: chronicConditionsStr,
        allergies: form.allergies.trim() || null,
        current_medications: form.medications.trim() || null,
        emergency_contact: form.emergency_contact.trim() || null,
        notes: form.notes.trim() || null,
        reports: combinedReports,
        updated_at: now,
      };

      if (editingMember) {
        const memberRef = doc(db, 'family_members', editingMember.id);
        await updateDoc(memberRef, memberPayload);
        setMembers(prev => prev.map(m => m.id === editingMember.id ? { ...m, ...memberPayload } : m));
        setSuccessMsg(`Updated ${form.name.trim()} successfully!`);
      } else {
        const docRef = await addDoc(collection(db, 'family_members'), {
          ...memberPayload,
          created_at: now,
        });
        await updateDoc(docRef, { id: docRef.id });
        setMembers(prev => {
          if (prev.some(m => m.id === docRef.id)) return prev;
          return [{ id: docRef.id, ...memberPayload, created_at: now }, ...prev];
        });
        setSuccessMsg(`Added ${form.name.trim()} to Family Vault!`);
      }

      setSaving(false);
      setShowAdd(false);
      setEditingMember(null);
      setExistingReports([]);
      setNewReportFiles([]);
      setForm({ ...emptyForm });

      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error saving family member to Firestore:', err);
      setSaving(false);
      setError(err?.message || 'Unable to save family member. Please check your connection.');
    }
  };

  // Direct report upload from card
  const triggerDirectUpload = (member: FamilyMember) => {
    setTargetMemberForDirectUpload(member);
    directCardFileInputRef.current?.click();
  };

  const handleDirectCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const member = targetMemberForDirectUpload;
    if (!files || files.length === 0 || !member) return;

    const currentReports = member.reports || [];
    const availableSlots = MAX_REPORTS - currentReports.length;

    if (availableSlots <= 0) {
      setError(`This member already has the maximum of ${MAX_REPORTS} reports.`);
      setTimeout(() => setError(''), 4000);
      e.target.value = '';
      return;
    }

    const oversized = Array.from(files).filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setError(`"${oversized[0].name}" exceeds the 15MB file limit.`);
      setTimeout(() => setError(''), 4000);
      e.target.value = '';
      return;
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots);
    setUploadingReportForId(member.id);
    const now = new Date().toISOString();

    try {
      const newlyUploaded: FamilyReport[] = [];
      for (const file of selectedFiles) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `family_vault/${effectiveAccountId}/${Date.now()}_${sanitized}`;
        const storageRef = ref(storage, storagePath);
        const snap = await uploadBytes(storageRef, file, {
          contentType: file.type || 'application/octet-stream',
        });
        const url = await getDownloadURL(snap.ref);
        newlyUploaded.push({
          id: 'rep_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
          name: file.name,
          url,
          type: file.type || 'application/octet-stream',
          size: file.size,
          uploaded_at: now,
        });
      }

      const updatedReports = [...currentReports, ...newlyUploaded];
      await updateDoc(doc(db, 'family_members', member.id), {
        reports: updatedReports,
        updated_at: now,
      });

      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, reports: updatedReports, updated_at: now } : m));
      setSuccessMsg(`Added ${newlyUploaded.length} report(s) for ${member.name}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      console.error('Error uploading direct report:', err);
      setError('Failed to upload report: ' + (err?.message || 'Please try again.'));
      setTimeout(() => setError(''), 4000);
    } finally {
      setUploadingReportForId(null);
      setTargetMemberForDirectUpload(null);
      e.target.value = '';
    }
  };

  // Custom UI-driven confirmation for removing a report
  const requestRemoveReport = (member: FamilyMember, report: FamilyReport) => {
    setConfirmModal({
      isOpen: true,
      type: 'report',
      title: 'Remove Health Report?',
      message: `Are you sure you want to remove "${report.name}"? This file will be permanently removed from ${member.name}'s vault.`,
      itemData: { member, reportId: report.id },
    });
  };

  // Custom UI-driven confirmation for removing a member
  const requestRemoveMember = (member: FamilyMember) => {
    setConfirmModal({
      isOpen: true,
      type: 'member',
      title: `Remove ${member.name}?`,
      message: `Are you sure you want to remove ${member.name} from your Family Health Vault? Their health profile, vitals, and all attached diagnostic reports will be permanently deleted.`,
      itemData: member,
    });
  };

  // Executes confirmed deletion cleanly
  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    setDeleting(true);

    try {
      if (confirmModal.type === 'member') {
        const member = confirmModal.itemData as FamilyMember;
        await deleteDoc(doc(db, 'family_members', member.id));
        setMembers(prev => prev.filter(m => m.id !== member.id));
        if (editingMember?.id === member.id) {
          setEditingMember(null);
          setShowAdd(false);
        }
        setSuccessMsg(`Removed ${member.name} from Family Vault.`);
      } else if (confirmModal.type === 'report') {
        const { member, reportId } = confirmModal.itemData;
        const updatedReports = (member.reports || []).filter((r: FamilyReport) => r.id !== reportId);
        await updateDoc(doc(db, 'family_members', member.id), {
          reports: updatedReports,
          updated_at: new Date().toISOString(),
        });
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, reports: updatedReports } : m));
        setSuccessMsg('Report removed from family member.');
      }
      setTimeout(() => setSuccessMsg(''), 3000);
      setConfirmModal(null);
    } catch (err: any) {
      console.error('Error during deletion:', err);
      setError(err?.message || 'Operation failed. Please try again.');
      setTimeout(() => setError(''), 4000);
    } finally {
      setDeleting(false);
    }
  };

  const ageFromDob = (dob: string | null) => calculateAge(dob);
  const totalFormReportsCount = existingReports.length + newReportFiles.length;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F2F8F6] via-[#F8FAFC] to-[#FFFFFF] pb-32">
      {/* Hidden file input for direct card report uploads */}
      <input
        type="file"
        ref={directCardFileInputRef}
        onChange={handleDirectCardUpload}
        multiple
        accept=".pdf,image/*"
        className="hidden"
      />

      {/* Hero Premium Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#084b3a] via-[#0F6E56] to-[#148366] text-white pt-12 pb-8 px-4 sm:px-6 shadow-lg">
        {/* Subtle decorative glow circles */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-teal-300/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          {/* Top Navigation Row */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <button
              onClick={() => onTab('home')}
              aria-label="Back"
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition backdrop-blur-sm border border-white/10"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 text-emerald-100 text-xs font-semibold backdrop-blur-sm border border-emerald-300/20">
                <ShieldCheck size={13} className="text-emerald-300" /> Secure Vault
              </span>
            </div>
            <button
              onClick={startAdd}
              className="flex items-center gap-1.5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 active:scale-95 text-xs font-bold px-4 py-2.5 transition shadow-md hover:shadow-lg"
            >
              <Plus size={15} className="text-emerald-700 stroke-[2.5]" />
              <span>Add Member</span>
            </button>
          </div>

          {/* Title and Description */}
          <div className="mb-5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
              Family Health Vault
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
              Centralized medical profiles, blood groups, chronic conditions, and diagnostic reports for your entire family.
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p className="text-[11px] sm:text-xs text-emerald-100/70 font-medium">Family Members</p>
              <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{uniqueMembers.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p className="text-[11px] sm:text-xs text-emerald-100/70 font-medium">Diagnostic Reports</p>
              <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{totalReportsCount}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-white/10">
              <p className="text-[11px] sm:text-xs text-emerald-100/70 font-medium">Emergency Ready</p>
              <p className="text-lg sm:text-xl font-extrabold text-white mt-0.5">{totalEmergencyContactsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-4">
        {/* Search Bar (visible if members exist) */}
        {uniqueMembers.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-2 sm:p-2.5 flex items-center gap-2.5 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10">
            <Search size={16} className="text-slate-400 ml-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by member name, relationship, blood group..."
              className="w-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent py-1 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="p-1 text-slate-400 hover:text-slate-600 mr-1">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Error Alert Banner */}
        {error && !showAdd && (
          <div className="flex items-center justify-between gap-2.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
            <button onClick={() => setError('')} className="p-1 text-rose-400 hover:text-rose-700">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Success Alert Banner */}
        {successMsg && (
          <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-xs animate-fadeIn">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-5 shadow-sm space-y-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-slate-100 shrink-0" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-100 rounded-md w-1/3" />
                    <div className="h-3 bg-slate-100 rounded-md w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State Card */}
        {!loading && uniqueMembers.length === 0 && (
          <div className="bg-white rounded-3xl border border-emerald-100/80 p-8 sm:p-12 text-center shadow-md relative overflow-hidden mt-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl pointer-events-none" />
            <div className="h-16 w-16 mx-auto rounded-3xl bg-emerald-50 flex items-center justify-center text-primary mb-4 shadow-inner">
              <ShieldCheck size={36} className="stroke-[1.75]" />
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">Your Family Health Vault is Empty</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
              Add your spouse, children, or parents to securely track their blood groups, allergies, chronic conditions, and store up to 4 diagnostic reports each.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-lg mx-auto my-6 text-left">
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 font-medium">
                <Heart size={14} className="text-rose-500 shrink-0" /> Vitals & Blood Group
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 font-medium">
                <Phone size={14} className="text-emerald-600 shrink-0" /> Emergency Ready
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-700 font-medium">
                <FileCheck size={14} className="text-sky-600 shrink-0" /> Reports & Scans (0-4)
              </div>
            </div>

            <button
              onClick={startAdd}
              className="inline-flex items-center gap-2 rounded-2xl px-6 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg transition active:scale-95"
              style={{ backgroundColor: '#0F6E56' }}
            >
              <Plus size={16} className="stroke-[2.5]" /> Add First Family Member
            </button>
          </div>
        )}

        {/* No Search Results */}
        {!loading && uniqueMembers.length > 0 && filteredMembers.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 text-center shadow-sm">
            <Users size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">No matching family members</p>
            <p className="text-xs text-slate-400 mt-1">Try searching for a different name or relationship</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs font-semibold text-primary hover:underline"
            >
              Clear search filter
            </button>
          </div>
        )}

        {/* Member Cards Grid */}
        <div className="space-y-3.5">
          {filteredMembers.map(m => {
            const age = ageFromDob(m.dob);
            const isOpen = expanded === m.id;
            const memberReports = m.reports || [];
            const isUploadingDirect = uploadingReportForId === m.id;
            const theme = RELATIONSHIP_THEMES[m.relationship] || RELATIONSHIP_THEMES.Other;
            const initials = getInitials(m.name);

            return (
              <div
                key={m.id}
                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? 'border-primary/40 shadow-md ring-1 ring-primary/10' : 'border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Member Header Card */}
                <div
                  className="p-4 sm:p-5 flex items-center gap-3 sm:gap-4 cursor-pointer select-none"
                  onClick={() => setExpanded(isOpen ? null : m.id)}
                >
                  {/* Initials Avatar */}
                  <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${theme.avatarBg} text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm shrink-0`}>
                    {initials}
                  </div>

                  {/* Main Member Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{m.name}</p>

                    {/* Quick Meta Pills */}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                      {age !== null && (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                          <Calendar size={11} className="text-slate-400" /> {age} yrs
                        </span>
                      )}
                      {m.gender && (
                        <span className="font-medium text-slate-600">· {m.gender}</span>
                      )}
                      {m.blood_group && (
                        <span className="inline-flex items-center gap-0.5 font-bold text-rose-600">
                          <Droplets size={10} className="fill-rose-500" /> {m.blood_group}
                        </span>
                      )}
                      {memberReports.length > 0 && (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <Paperclip size={10} /> {memberReports.length} report{memberReports.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Side: Relationship placed directly above Edit & Delete icons */}
                  <div className="flex flex-col items-end justify-center shrink-0 ml-2">
                    <span className="text-xs font-semibold text-slate-500 tracking-tight mb-1 pr-1">
                      {m.relationship}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          startEdit(m);
                        }}
                        aria-label={`Edit ${m.name}`}
                        title="Edit Member Details"
                        className="p-1.5 rounded-xl text-blue-600 hover:text-blue-700 hover:bg-blue-50 active:scale-95 transition"
                      >
                        <Pencil size={16} className="stroke-[2.2]" />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          requestRemoveMember(m);
                        }}
                        aria-label={`Remove ${m.name}`}
                        title="Remove Member"
                        className="p-1.5 rounded-xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 active:scale-95 transition"
                      >
                        <Trash2 size={16} className="stroke-[2.2]" />
                      </button>
                      <div className={`p-1 text-slate-400 hover:text-slate-600 transition-transform duration-200 ${isOpen ? 'rotate-180 text-primary' : ''}`}>
                        <ChevronDown size={16} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Detailed View */}
                {isOpen && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4 sm:p-5 space-y-4 animate-fadeIn">
                    {/* Vitals Overview 4-Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Date of Birth</span>
                        <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          {m.dob ? formatDate(m.dob) : 'Not specified'}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Gender</span>
                        <p className="text-xs font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                          <User size={13} className="text-slate-400" />
                          {m.gender || 'Not specified'}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Blood Group</span>
                        <p className="text-xs font-extrabold text-rose-600 mt-1 flex items-center gap-1.5">
                          <Droplets size={13} className="fill-rose-500 text-rose-500" />
                          {m.blood_group || 'Unknown'}
                        </p>
                      </div>

                      <div className="bg-white rounded-2xl p-3 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Conditions</span>
                        <p className="text-xs font-bold text-slate-800 mt-1 truncate flex items-center gap-1.5">
                          <Heart size={13} className="text-amber-500" />
                          {m.chronic_conditions && m.chronic_conditions !== 'None' ? m.chronic_conditions : 'None reported'}
                        </p>
                      </div>
                    </div>

                    {/* Allergies & Current Medications */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Allergies Box */}
                      <div className="bg-white rounded-2xl p-3.5 border border-amber-200/70 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
                          <AlertTriangle size={14} className="text-amber-600" />
                          <span>Allergies</span>
                        </div>
                        <p className="text-xs text-slate-700">
                          {m.allergies ? m.allergies : <span className="text-slate-400 italic">No allergies recorded</span>}
                        </p>
                      </div>

                      {/* Medications Box */}
                      <div className="bg-white rounded-2xl p-3.5 border border-sky-200/70 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-sky-800 text-xs font-bold mb-1">
                          <Pill size={14} className="text-sky-600" />
                          <span>Current Medications</span>
                        </div>
                        <p className="text-xs text-slate-700">
                          {m.current_medications ? m.current_medications : <span className="text-slate-400 italic">No medications prescribed</span>}
                        </p>
                      </div>
                    </div>

                    {/* Emergency Contact & Notes */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Emergency Contact */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Emergency Contact</span>
                        {m.emergency_contact ? (
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-xs font-bold text-slate-800">{m.emergency_contact}</span>
                            <a
                              href={`tel:${m.emergency_contact.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-xl transition"
                            >
                              <PhoneCall size={12} /> Call
                            </a>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic mt-1">No emergency number added</p>
                        )}
                      </div>

                      {/* Additional Health Notes */}
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs">
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Health Notes</span>
                        <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                          {m.notes ? m.notes : <span className="text-slate-400 italic">No additional notes</span>}
                        </p>
                      </div>
                    </div>

                    {/* Health Reports Vault Section */}
                    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <FileCheck size={15} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900">Diagnostic Reports</p>
                            <p className="text-[10px] text-slate-400">{memberReports.length} of {MAX_REPORTS} reports attached</p>
                          </div>
                        </div>

                        {memberReports.length < MAX_REPORTS && (
                          <button
                            type="button"
                            disabled={isUploadingDirect}
                            onClick={() => triggerDirectUpload(m)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary bg-[#E1F5EE] hover:bg-[#d2f0e6] px-3 py-1.5 rounded-xl transition active:scale-95 disabled:opacity-50"
                          >
                            {isUploadingDirect ? (
                              <>
                                <Loader2 size={13} className="animate-spin" /> Uploading…
                              </>
                            ) : (
                              <>
                                <Upload size={13} /> + Upload Report
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Reports List */}
                      {memberReports.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {memberReports.map(rep => (
                            <div
                              key={rep.id}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 hover:border-slate-300 transition group"
                            >
                              <a
                                href={rep.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 flex-1 min-w-0"
                                title="Click to view report"
                              >
                                <Paperclip size={14} className="text-primary shrink-0" />
                                <div className="truncate">
                                  <p className="text-xs font-semibold text-slate-800 group-hover:text-primary truncate">
                                    {rep.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    {formatDate(rep.uploaded_at)} {rep.size ? `· ${formatFileSize(rep.size)}` : ''}
                                  </p>
                                </div>
                              </a>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <a
                                  href={rep.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition"
                                  title="Open report"
                                >
                                  <ExternalLink size={13} />
                                </a>
                                <button
                                  type="button"
                                  onClick={() => requestRemoveReport(m, rep)}
                                  className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition"
                                  title="Delete report"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-4 text-center border-2 border-dashed border-slate-100 rounded-xl">
                          <p className="text-xs text-slate-400 italic">No reports uploaded yet (optional, max 4 reports).</p>
                        </div>
                      )}
                    </div>

                    {/* Edit Member Full Button */}
                    <div className="flex items-center justify-end pt-1">
                      <button
                        onClick={() => startEdit(m)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-primary bg-[#E1F5EE] hover:bg-emerald-100/80 rounded-xl transition active:scale-95 shadow-2xs"
                      >
                        <Pencil size={13} /> Edit Full Profile
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Centered Modal Form for Add / Edit */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="bg-white w-full sm:max-w-xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-slideUp"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <User size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                    {editingMember ? 'Edit Family Member' : 'Add Family Member'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingMember ? `Updating record for ${editingMember.name}` : 'Create a new health record profile'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditingMember(null);
                  setError('');
                  setExistingReports([]);
                  setNewReportFiles([]);
                  setForm({ ...emptyForm });
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-left">
              {error && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={15} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-800 mb-1.5 block">Full Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Eleanor Vance"
                  className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition"
                />
              </div>

              {/* Relationship */}
              <div>
                <label className="text-xs font-bold text-slate-800 mb-1.5 block">Relationship *</label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {RELATIONSHIPS.map(r => {
                    const active = form.relationship === r;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, relationship: r }))}
                        className={`rounded-xl py-2 px-1 text-xs font-bold transition border ${
                          active
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DOB & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Date of Birth</label>
                  <DobCalendarPicker
                    value={form.dob}
                    onChange={v => setForm(f => ({ ...f, dob: v }))}
                    placeholder="Select DOB"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Gender</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Male', 'Female', 'Other'] as const).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, gender: g }))}
                        className={`rounded-xl py-2 text-xs font-bold transition border ${
                          form.gender === g
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Blood Group */}
              <div>
                <label className="text-xs font-bold text-slate-800 mb-1.5 block">Blood Group</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {BLOOD_GROUPS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, blood_group: b }))}
                      className={`rounded-xl py-2 text-xs font-extrabold transition border ${
                        form.blood_group === b
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chronic Conditions */}
              <div>
                <label className="text-xs font-bold text-slate-800 mb-1.5 block">Chronic Conditions</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {CHRONIC_OPTIONS.map(c => {
                    const active = form.conditions.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCondition(c)}
                        className={`flex items-center justify-center gap-1.5 rounded-xl p-2 text-xs font-semibold transition border ${
                          active
                            ? 'bg-[#E1F5EE] text-primary border-primary shadow-2xs font-bold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {active && <Check size={12} className="text-primary stroke-[3]" />}
                        <span>{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Allergies & Medications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Known Allergies</label>
                  <input
                    type="text"
                    value={form.allergies}
                    onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))}
                    placeholder="e.g. Penicillin, Peanuts, Latex"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Current Medications</label>
                  <input
                    type="text"
                    value={form.medications}
                    onChange={e => setForm(f => ({ ...f, medications: e.target.value }))}
                    placeholder="e.g. Metformin 500mg, Inhaler"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Emergency Contact & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={form.emergency_contact}
                    onChange={e => setForm(f => ({ ...f, emergency_contact: e.target.value }))}
                    placeholder="e.g. +91 9876543210"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 mb-1.5 block">Health Notes (Optional)</label>
                  <input
                    type="text"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="e.g. Past surgeries, diet restrictions"
                    className="w-full rounded-2xl border border-slate-200 px-3.5 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-primary transition"
                  />
                </div>
              </div>

              {/* Health Reports (Optional - Up to 4) */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-bold text-slate-900 block">
                      Attach Health Reports <span className="font-normal text-slate-400">(Optional)</span>
                    </label>
                    <p className="text-[10px] text-slate-500">PDF, PNG, JPG scans up to 15MB each</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    totalFormReportsCount >= MAX_REPORTS ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {totalFormReportsCount} / {MAX_REPORTS} attached
                  </span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFormFileSelect}
                  multiple
                  accept=".pdf,image/*"
                  className="hidden"
                />

                {totalFormReportsCount < MAX_REPORTS ? (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 px-4 border-2 border-dashed border-emerald-200 hover:border-primary rounded-2xl bg-emerald-50/40 hover:bg-emerald-50 flex flex-col items-center justify-center gap-1.5 transition group"
                  >
                    <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center group-hover:scale-110 transition">
                      <FileUp size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-800 group-hover:text-primary">
                      Click to Browse Files
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {MAX_REPORTS - totalFormReportsCount} slot{MAX_REPORTS - totalFormReportsCount !== 1 ? 's' : ''} available
                    </span>
                  </button>
                ) : (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs text-center font-medium">
                    Maximum limit of 4 reports reached.
                  </div>
                )}

                {/* Attached Reports List */}
                {(existingReports.length > 0 || newReportFiles.length > 0) && (
                  <div className="mt-3 space-y-1.5">
                    {/* Existing saved reports */}
                    {existingReports.map(r => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <Paperclip size={13} className="text-primary shrink-0" />
                          <span className="truncate font-semibold text-slate-800">{r.name}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            (Saved{r.size ? ` · ${formatFileSize(r.size)}` : ''})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-blue-600 hover:text-blue-700 hover:bg-white transition"
                          >
                            <ExternalLink size={13} />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeExistingReport(r.id)}
                            className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-white transition"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Pending new files */}
                    {newReportFiles.map(f => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                          <Upload size={13} className="text-emerald-700 shrink-0" />
                          <span className="truncate font-semibold text-emerald-950">{f.name}</span>
                          <span className="text-[10px] text-emerald-700 shrink-0">
                            (Ready · {formatFileSize(f.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingReport(f.id)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700 hover:bg-white shrink-0 ml-2 transition"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Sticky Footer */}
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setShowAdd(false);
                  setEditingMember(null);
                  setExistingReports([]);
                  setNewReportFiles([]);
                  setForm({ ...emptyForm });
                }}
                className="flex-1 py-3 rounded-2xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="flex-1 py-3 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#0F6E56] to-[#128064] hover:opacity-95 active:scale-95 transition shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving
                  ? (newReportFiles.length > 0 ? 'Uploading reports…' : 'Saving changes…')
                  : (editingMember ? 'Update Member Profile' : 'Save Member to Vault')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Custom Confirmation Modal */}
      {confirmModal && confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
          onClick={() => !deleting && setConfirmModal(null)}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-slate-100 text-center animate-scaleIn relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Red ambient glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-20 bg-rose-500/10 rounded-full blur-xl pointer-events-none" />

            {/* Warning Trash Icon Badge */}
            <div className="h-14 w-14 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <Trash2 size={24} className="stroke-[2.25]" />
            </div>

            {/* Title */}
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              {confirmModal.title}
            </h3>

            {/* Message */}
            <p className="text-xs sm:text-sm text-slate-500 mt-2 leading-relaxed">
              {confirmModal.message}
            </p>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 mt-6">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmModal(null)}
                className="py-3 px-4 rounded-2xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmAction}
                className="py-3 px-4 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 active:scale-95 transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Removing…
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Yes, Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
