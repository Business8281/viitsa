import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { PatientFullDetails } from './PatientFullDetails';
import { formatDate, calculateAge } from '../lib/format';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { FileText, Phone, Mail, MapPin, Droplet, User, ShieldAlert, AlertTriangle } from 'lucide-react';
import type { Patient } from '../lib/types';

interface PatientDetailModalProps {
  patient: Patient | any | null;
  patientId?: string | null;
  open?: boolean;
  onClose: () => void;
}

export function PatientDetailModal({ patient, patientId, open, onClose }: PatientDetailModalProps) {
  const [hydrated, setHydrated] = useState<any>(patient || null);

  const resolvedPatientId = patient?.patient_id || patient?.id || patientId || '';
  const searchPhone = (patient?.phone || '').replace(/\D/g, '') || null;
  const searchEmail = (patient?.email || '').toLowerCase().trim() || null;

  // Sync initial patient prop
  useEffect(() => {
    if (patient) {
      setHydrated(patient);
    }
  }, [patient]);

  // Live real-time hydration from patient_accounts and users
  useEffect(() => {
    if (!resolvedPatientId && !searchPhone) return;

    let mounted = true;

    // Listen to patient_accounts to get canonical address, blood group, emergency contact, DOB, medications
    const unsub = onSnapshot(collection(db, 'patient_accounts'), (snap) => {
      if (!mounted) return;
      const match = snap.docs.find((d) => {
        const data = d.data();
        if (d.id === resolvedPatientId) return true;
        if (data.auth_user_id === resolvedPatientId || data.account_id === resolvedPatientId) return true;
        if (searchPhone) {
          const accPhone = (data.phone || '').replace(/\D/g, '');
          const tgtPhone = searchPhone.replace(/\D/g, '');
          if (accPhone && tgtPhone && accPhone === tgtPhone) return true;
        }
        if (searchEmail && data.email && data.email.toLowerCase() === searchEmail) return true;
        return false;
      });

      if (match) {
        const acc = match.data();
        setHydrated((prev: any) => ({
          ...(prev || {}),
          ...acc,
          patient_id: prev?.patient_id || match.id,
          name: acc.name || acc.full_name || prev?.name || 'Patient',
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
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, [resolvedPatientId, searchPhone, searchEmail]);

  if (!patient && !open && !patientId) return null;

  const current = hydrated || patient || {};
  const isModalOpen = open !== undefined ? open : !!patient;

  const displayCode = current.display_id || current.patient_code || (current.patient_id ? current.patient_id.slice(0, 10).toUpperCase() : 'PAT');
  const bloodGroupText = current.blood_group ? `Blood Group: ${current.blood_group}` : 'Unknown blood group';

  const currentAge = current.age ?? calculateAge(current.dob);

  return (
    <Modal
      open={isModalOpen}
      onClose={onClose}
      title={`${current.name || 'Patient Details'}${current.status === 'left' ? ' (Left Clinic)' : ''}`}
      subtitle={`${currentAge !== null ? `${currentAge} yrs` : '—'}${current.dob ? ` · DOB: ${formatDate(current.dob)}` : ''} · ${current.gender ?? '—'} · ${bloodGroupText} · ID: ${displayCode}`}
      size="xl"
    >
      <div className="space-y-4">
        {/* Top Demographics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Detail label="Age" value={currentAge !== null ? `${currentAge} yrs` : '—'} />
          <Detail label="Date of Birth" value={current.dob ? formatDate(current.dob) : 'Not set'} />
          <Detail label="Gender" value={current.gender ?? '—'} />
          <Detail label="Phone" value={current.phone ?? '—'} isPhone />
          <Detail label="Email" value={current.email ?? '—'} isEmail />
          <Detail label="Patient ID" value={displayCode} />
        </div>

        {/* Address Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <MapPin size={12} className="text-primary" /> Residential Address
          </p>
          <p className="text-sm font-semibold text-slate-800">{current.address || 'Not provided'}</p>
        </div>

        {/* Medical Alerts (Allergies & Chronic) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`rounded-xl p-3.5 border ${
            current.allergies && current.allergies !== 'None'
              ? 'bg-red-50/80 border-red-200 text-red-900'
              : 'bg-white border-slate-200'
          }`}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-red-600">
              <AlertTriangle size={13} /> Allergies
            </p>
            <p className="text-xs font-semibold text-slate-800">{current.allergies || 'None'}</p>
          </div>

          <div className={`rounded-xl p-3.5 border ${
            current.chronic_conditions && current.chronic_conditions !== 'None'
              ? 'bg-amber-50/80 border-amber-200 text-amber-900'
              : 'bg-white border-slate-200'
          }`}>
            <p className="text-[11px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-amber-600">
              <ShieldAlert size={13} /> Chronic Conditions
            </p>
            <p className="text-xs font-semibold text-slate-800">{current.chronic_conditions || 'None'}</p>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Detail label="Emergency contact" value={current.emergency_contact_name ?? '—'} />
          <Detail label="Emergency phone" value={current.emergency_contact_phone ?? '—'} isPhone />
        </div>

        {/* Data Security Banner */}
        <div className="flex items-center gap-2 text-xs text-slate-500 rounded-xl bg-primary-50/50 border border-primary/10 p-3">
          <FileText size={14} className="text-primary shrink-0" />
          <span>Patient data is stored securely and updated in real time within the VIITSA clinical database.</span>
        </div>

        {/* Comprehensive A to Z Full Details Multi-Tab Dossier */}
        <PatientFullDetails 
          patientId={resolvedPatientId} 
          patientName={current.name} 
          patient={current} 
        />
      </div>
    </Modal>
  );
}

function Detail({ label, value, isPhone, isEmail }: { label: string; value: string; isPhone?: boolean; isEmail?: boolean }) {
  return (
    <div className="min-w-0 bg-white p-3 rounded-xl border border-slate-200">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      {isPhone && value !== '—' ? (
        <a href={`tel:${value}`} className="text-xs font-semibold text-primary hover:underline truncate block" title={value}>
          {value}
        </a>
      ) : isEmail && value !== '—' ? (
        <a href={`mailto:${value}`} className="text-xs font-semibold text-primary hover:underline truncate block" title={value}>
          {value}
        </a>
      ) : (
        <p className="text-xs font-semibold text-slate-800 truncate" title={value}>
          {value}
        </p>
      )}
    </div>
  );
}
