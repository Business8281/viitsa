import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import type { PatientAccount, Clinic } from './types';
import { useAuth } from './auth';
import { generateReadableId, sanitizeForFirestore } from './identityResolver';
import { switchPatientClinic } from './patientClinicService';
import { calculateAge } from './format';
import { claimPastAppointmentsForPhone } from './accountLinking';

const STORAGE_KEY = 'viitsa_patient_v1';

interface PatientAuthState {
  account: PatientAccount | null;
  clinic: Clinic | null;
  clinicId: string | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ ok: boolean; error?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ ok: boolean; error?: string; isNew?: boolean }>;
  register: (data: RegisterData) => Promise<{ ok: boolean; error?: string }>;
  updateProfile: (data: Partial<RegisterData>) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  setClinicId: (id: string) => void;
  selectClinic: (clinic: Clinic | null) => Promise<void>;
  refreshAccount: () => Promise<void>;
}

export interface RegisterData {
  phone: string;
  name: string;
  email?: string;
  dob?: string;
  age?: number | string | null;
  gender: 'Male' | 'Female' | 'Other';
  blood_group: string;
  address?: string;
  chronic_conditions: string;
  allergies: string;
  current_medications?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  attender_name?: string;
  attender_phone?: string;
  profile_completed?: boolean;
}

const Ctx = createContext<PatientAuthState | undefined>(undefined);

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, clinic: authClinic, patientAccount: authPatientAccount, logout: authLogout, switchClinic: authSwitchClinic, setClinic: authSetClinic, refreshSession } = useAuth();
  
  const [account, setAccount] = useState<PatientAccount | null>(authPatientAccount);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [clinicId, setClinicIdState] = useState<string | null>(authPatientAccount?.clinic_id || null);
  const [loading] = useState(false);

  // Load clinic ONLY when explicitly chosen by the patient on their account or via URL parameter (?clinic=...)
  useEffect(() => {
    const targetCid = clinicId || account?.clinic_id || authPatientAccount?.clinic_id || null;
    if (targetCid) {
      if (!clinic || clinic.clinic_id !== targetCid) {
        getDoc(doc(db, 'clinics', targetCid)).then((snap) => {
          if (snap.exists()) {
            const loadedClinic = { ...snap.data(), clinic_id: snap.id } as Clinic;
            setClinic(loadedClinic);
            setClinicIdState(snap.id);
            if (authSetClinic && authClinic?.clinic_id !== snap.id) {
              authSetClinic(loadedClinic);
            }
          }
        }).catch(console.warn);
      }
    } else {
      if (clinic) {
        setClinic(null);
        if (authSetClinic) authSetClinic(null);
      }
    }
  }, [clinicId, account?.clinic_id, authPatientAccount?.clinic_id, clinic, authSetClinic, authClinic?.clinic_id]);

  // Real-time onSnapshot for active patient account
  useEffect(() => {
    const activeAccId = account?.account_id || authPatientAccount?.account_id || user?.patient_account_id || (user?.role === 'patient' ? `pat_${user.user_id}` : null);
    if (!activeAccId) return;
    const unsub = onSnapshot(doc(db, 'patient_accounts', activeAccId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PatientAccount;
        setAccount((prev) => {
          const merged = {
            ...(prev || {}),
            ...data,
            account_id: snap.id,
            profile_completed: data.profile_completed || prev?.profile_completed || false,
          };
          return merged as PatientAccount;
        });
      }
    });
    return () => unsub();
  }, [account?.account_id, authPatientAccount?.account_id, user?.patient_account_id, user?.user_id, user?.role]);

  // Synchronize with unified AuthProvider safely without overwriting filled fields with nulls
  useEffect(() => {
    const targetId = authPatientAccount?.account_id || user?.patient_account_id || user?.user_id;
    let cachedProfile: any = null;
    if (targetId) {
      try {
        const raw = localStorage.getItem(`viitsa_patient_profile_${targetId}`) || localStorage.getItem(`viitsa_pat_${targetId}`);
        if (raw) cachedProfile = JSON.parse(raw);
      } catch {}
    }

    if (authPatientAccount) {
      setAccount(prev => {
        const base = prev || cachedProfile || {};
        const merged: any = { ...base };
        for (const [k, v] of Object.entries(authPatientAccount)) {
          if (v !== null && v !== undefined && v !== '') {
            merged[k] = v;
          }
        }
        if (cachedProfile) {
          for (const [k, v] of Object.entries(cachedProfile)) {
            if (merged[k] === null || merged[k] === undefined || merged[k] === '') {
              merged[k] = v;
            }
          }
        }
        if (user?.phone && !merged.phone) merged.phone = user.phone;
        if (user?.name && !merged.name) merged.name = user.name;
        if (user?.email && !merged.email) merged.email = user.email;
        merged.profile_completed = authPatientAccount.profile_completed || merged.profile_completed || false;
        return merged as PatientAccount;
      });
    } else if (user && (user.role === 'patient' || user.role === 'patient_attendant')) {
      setAccount(prev => {
        const base = prev || cachedProfile || {};
        return {
          ...base,
          account_id: user.patient_account_id || user.user_id,
          phone: user.phone || base.phone || '',
          name: user.name || base.name || '',
          email: user.email || base.email || null,
          age: base.age ?? (user as any).age ?? null,
          dob: base.dob || (user as any).dob || null,
          gender: base.gender || (user as any).gender || null,
          blood_group: base.blood_group || (user as any).blood_group || null,
          address: base.address || (user as any).address || null,
          current_medications: base.current_medications || (user as any).current_medications || null,
          allergies: base.allergies || (user as any).allergies || 'None',
          chronic_conditions: base.chronic_conditions || (user as any).chronic_conditions || 'None',
          emergency_contact_name: base.emergency_contact_name || (user as any).emergency_contact_name || null,
          emergency_contact_phone: base.emergency_contact_phone || (user as any).emergency_contact_phone || null,
          otp_code: '',
          otp_verified: true,
          auth_user_id: user.user_id,
          created_at: user.created_at,
          profile_completed: base.profile_completed || (user as any).profile_completed || false,
        } as PatientAccount;
      });
    } else if (!user) {
      setAccount(null);
    }
  }, [authPatientAccount, user]);

  const setClinicId = useCallback((id: string) => setClinicIdState(id), []);

  const sendOtp = useCallback(async () => {
    return { ok: false, error: 'Please use the unified login page for authentication.' };
  }, []);

  const verifyOtp = useCallback(async () => {
    return { ok: false, error: 'Please use the unified login page for authentication.' };
  }, []);

  const register = useCallback(async () => {
    return { ok: true };
  }, []);

  const updateProfile = useCallback(async (d: Partial<RegisterData>) => {
    const activeAccountId = account?.account_id || authPatientAccount?.account_id || user?.patient_account_id || (user?.user_id ? `pat_${user.user_id}` : null);
    if (!activeAccountId) return { ok: false, error: 'Not logged in.' };

    const medications = d.current_medications !== undefined
      ? (typeof d.current_medications === 'string'
          ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
          : d.current_medications)
      : (account?.current_medications || ['None']);

    const patientCode = account?.id_number || account?.patient_code || user?.id_number || generateReadableId('PAT', activeAccountId);
    const patName = d.name || account?.name || user?.name || 'Patient';
    const nowIso = new Date().toISOString();

    const updates: Record<string, any> = {
      name: patName,
      full_name: patName,
      id_number: patientCode,
      display_id: patientCode,
      patient_code: patientCode,
      updated_at: nowIso,
    };
    if (d.email !== undefined) updates.email = d.email || null;
    if (d.phone !== undefined) updates.phone = d.phone;
    if (d.dob !== undefined) updates.dob = d.dob || null;
    if (d.age !== undefined) {
      const num = Number(d.age);
      updates.age = (!isNaN(num) && d.age !== '' && d.age !== null) ? num : null;
    } else if (d.dob !== undefined && d.dob && (account?.age === undefined || account?.age === null)) {
      const calc = calculateAge(d.dob);
      if (calc !== null) updates.age = calc;
    }
    if (d.gender !== undefined) updates.gender = d.gender;
    if (d.blood_group !== undefined) updates.blood_group = d.blood_group;
    if (d.address !== undefined) updates.address = d.address || null;
    if (d.chronic_conditions !== undefined) updates.chronic_conditions = d.chronic_conditions;
    if (d.allergies !== undefined) updates.allergies = d.allergies;
    if (d.current_medications !== undefined) updates.current_medications = medications;
    const attName = d.attender_name || d.emergency_contact_name || account?.attender_name || account?.emergency_contact_name;
    const attPhone = d.attender_phone || d.emergency_contact_phone || account?.attender_phone || account?.emergency_contact_phone;

    if (d.emergency_contact_name !== undefined || d.attender_name !== undefined) {
      updates.emergency_contact_name = attName || null;
      updates.attender_name = attName || null;
    }
    if (d.emergency_contact_phone !== undefined || d.attender_phone !== undefined) {
      updates.emergency_contact_phone = attPhone || null;
      updates.attender_phone = attPhone || null;
    }
    if (d.profile_completed !== undefined) updates.profile_completed = d.profile_completed;

    try {
      const fullSaved = { ...(account || {}), ...updates };
      localStorage.setItem(`viitsa_patient_profile_${activeAccountId}`, JSON.stringify(fullSaved));
      if (user?.user_id) {
        localStorage.setItem(`viitsa_patient_profile_${user.user_id}`, JSON.stringify(fullSaved));
        localStorage.setItem(`viitsa_pat_${user.user_id}`, JSON.stringify(fullSaved));
      }
    } catch {}

    // 1. Save all A to Z data to patient_accounts
    try {
      await setDoc(doc(db, 'patient_accounts', activeAccountId), sanitizeForFirestore({
        account_id: activeAccountId,
        ...updates,
        auth_user_id: user?.user_id || account?.auth_user_id || null,
        otp_verified: true,
        profile_completed: true,
      }), { merge: true });

      // Claim any prior walk-in appointments for this phone number
      const phoneToClaim = updates.phone || account?.phone || user?.phone;
      if (phoneToClaim) {
        claimPastAppointmentsForPhone(phoneToClaim, activeAccountId).catch(() => {});
      }
    } catch (e: any) {
      console.warn('Could not update patient_accounts doc:', e);
      return { ok: false, error: 'Failed to update patient profile. Permission denied or network issue.' };
    }

    // 2. Also ensure the 'users' document knows about this profile completion and linking
    if (user?.user_id) {
      try {
        await updateDoc(doc(db, 'users', user.user_id), sanitizeForFirestore({
          patient_account_id: activeAccountId,
          phone: updates.phone || user.phone || null,
          email: updates.email || user.email || null,
          attender_name: attName || null,
          attender_phone: attPhone || null,
          emergency_contact_name: attName || null,
          emergency_contact_phone: attPhone || null,
          profile_completed: true,
          updated_at: new Date().toISOString()
        }));
      } catch (e) {
        console.warn('Could not update users doc profile_completed flag:', e);
      }
    }

    // 2. Save all A to Z data to users
    if (user?.user_id) {
      try {
        await setDoc(doc(db, 'users', user.user_id), sanitizeForFirestore({
          ...updates,
          phone: updates.phone || user.phone || null,
          email: updates.email || user.email || null,
          attender_name: attName || null,
          attender_phone: attPhone || null,
          emergency_contact_name: attName || null,
          emergency_contact_phone: attPhone || null,
          role: 'patient',
          user_type: 'patient',
          id_number: patientCode,
          display_id: patientCode,
          full_name: patName,
          patient_account_id: activeAccountId,
          profile_completed: true,
          role_selected: true,
        }), { merge: true });
      } catch (e: any) {
        console.warn('Could not update users doc:', e);
        // Do not block onboarding on users doc failure if patient_account worked.
      }
    }

    // 3. Save all A to Z data to patients collection only if clinic is chosen
    const activeClinicId = clinicId || authClinic?.clinic_id || account?.clinic_id;
    if (activeClinicId) {
      try {
        const patPayload = sanitizeForFirestore({
          account_id: activeAccountId,
          clinic_id: activeClinicId,
          id_number: patientCode,
          display_id: patientCode,
          patient_code: patientCode,
          name: patName,
          full_name: patName,
          phone: updates.phone || account?.phone || user?.phone || null,
          email: updates.email || account?.email || user?.email || null,
          dob: updates.dob || account?.dob || null,
          age: updates.age !== undefined ? updates.age : (account?.age || null),
          gender: updates.gender || account?.gender || null,
          blood_group: updates.blood_group || account?.blood_group || null,
          address: updates.address || account?.address || null,
          allergies: updates.allergies || account?.allergies || 'None',
          chronic_conditions: updates.chronic_conditions || account?.chronic_conditions || 'None',
          emergency_contact_name: updates.emergency_contact_name || account?.emergency_contact_name || null,
          emergency_contact_phone: updates.emergency_contact_phone || account?.emergency_contact_phone || null,
          profile_completed: true,
          updated_at: nowIso,
        });

        const patQ = query(
          collection(db, 'patients'),
          where('account_id', '==', activeAccountId),
          where('clinic_id', '==', activeClinicId)
        );
        const patSnap = await getDocs(patQ);
        if (!patSnap.empty) {
          await updateDoc(doc(db, 'patients', patSnap.docs[0].id), patPayload);
        } else {
          // If no specific record for this clinic exists yet, create one
          const newPatRef = doc(collection(db, 'patients'));
          await setDoc(newPatRef, {
            ...patPayload,
            patient_id: newPatRef.id,
            created_at: nowIso,
          });
        }
      } catch (e) {
        console.warn('Could not update patients collection doc:', e);
      }

      // 4. Save to patient_clinic_links
      try {
        await setDoc(doc(db, 'patient_clinic_links', `${activeAccountId}_${activeClinicId}`), sanitizeForFirestore({
          account_id: activeAccountId,
          clinic_id: activeClinicId,
          patient_id: activeAccountId,
          name: patName,
          id_number: patientCode,
          updated_at: nowIso,
        }), { merge: true });
      } catch (e) {
        console.warn('Could not update patient_clinic_links doc:', e);
      }
    }

    setAccount(prev => {
      const base = prev || {
        account_id: activeAccountId,
        name: patName,
        phone: updates.phone || '',
        email: updates.email || null,
        age: updates.age !== undefined ? updates.age : (account?.age || null),
        dob: updates.dob || null,
        gender: updates.gender || null,
        blood_group: updates.blood_group || null,
        address: updates.address || null,
        current_medications: medications || null,
        allergies: updates.allergies || 'None',
        chronic_conditions: updates.chronic_conditions || 'None',
        emergency_contact_name: updates.emergency_contact_name || null,
        emergency_contact_phone: updates.emergency_contact_phone || null,
        otp_code: '',
        otp_verified: true,
        auth_user_id: user?.user_id || activeAccountId,
        profile_completed: true,
        created_at: nowIso,
        updated_at: nowIso,
      };
      return { ...base, ...updates };
    });
    if (refreshSession) {
      refreshSession().catch(console.warn);
    }
    return { ok: true };
  }, [account, user, clinicId, refreshSession]);

  const refreshAccount = useCallback(async () => {
    if (!account) return;
    try {
      const snap = await getDoc(doc(db, 'patient_accounts', account.account_id));
      if (snap.exists()) {
        setAccount({ ...snap.data(), account_id: snap.id } as PatientAccount);
      }
    } catch (e) {
      console.warn('refreshAccount error:', e);
    }
  }, [account]);

  const selectClinic = useCallback(async (c: Clinic | null) => {
    setClinic(c);
    setClinicIdState(c ? c.clinic_id : null);
    const activeAccountId = account?.account_id || user?.patient_account_id || (user?.user_id ? `pat_${user.user_id}` : null);

    if (c) {
      // Update local account immediately so UI reflects the selection instantaneously
      setAccount(prev => prev ? { ...prev, clinic_id: c.clinic_id, clinic_name: c.name } : prev);
      // Synchronize with global auth session
      if (authSwitchClinic) {
        authSwitchClinic(c).catch(console.warn);
      } else if (authSetClinic) {
        authSetClinic(c);
      }

      if (activeAccountId) {
        await switchPatientClinic({
          accountId: activeAccountId,
          targetClinic: c,
          previousClinicId: clinic?.clinic_id || account?.clinic_id || null,
          patientName: account?.name || user?.name || 'Patient',
          userUid: user?.user_id,
        });
      }
    } else {
      // Disconnecting / Exiting clinic
      setAccount(prev => prev ? { ...prev, clinic_id: undefined, clinic_name: undefined } : prev);
      if (authSetClinic) authSetClinic(null);

      // Persist disconnection to Firestore so patient stays disconnected across reloads/sessions
      if (activeAccountId) {
        try {
          await updateDoc(doc(db, 'patient_accounts', activeAccountId), {
            clinic_id: null,
            clinic_name: null,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Clear clinic_id in patient_accounts error:', e);
        }
      }
      if (user?.user_id) {
        try {
          await updateDoc(doc(db, 'users', user.user_id), {
            clinic_id: '',
            clinic_name: null,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('Clear clinic_id in users error:', e);
        }
      }
    }
  }, [account, user, clinic, authSwitchClinic, authSetClinic]);

  const logout = useCallback(() => {
    setAccount(null);
    setClinicIdState(null);
    setClinic(null);
    localStorage.removeItem(STORAGE_KEY);
    try {
      localStorage.removeItem('viitsa_active_clinic_id');
    } catch {}
    authLogout();
  }, [authLogout]);

  const value = useMemo<PatientAuthState>(
    () => ({ account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, selectClinic, refreshAccount }),
    [account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, selectClinic, refreshAccount],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
    </Ctx.Provider>
  );
}

export function usePatientAuth(): PatientAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePatientAuth must be inside PatientAuthProvider');
  return ctx;
}
