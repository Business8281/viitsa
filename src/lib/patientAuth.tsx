import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { db } from './firebase';
import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import type { PatientAccount, Clinic } from './types';
import { useAuth } from './auth';
import { generateReadableId, sanitizeForFirestore } from './identityResolver';

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
  gender: 'Male' | 'Female' | 'Other';
  blood_group: string;
  address?: string;
  chronic_conditions: string;
  allergies: string;
  current_medications?: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  profile_completed?: boolean;
}

const Ctx = createContext<PatientAuthState | undefined>(undefined);

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, clinic: authClinic, patientAccount: authPatientAccount, logout: authLogout } = useAuth();
  
  const [account, setAccount] = useState<PatientAccount | null>(authPatientAccount);
  const [clinic, setClinic] = useState<Clinic | null>(authClinic);
  const [clinicId, setClinicIdState] = useState<string | null>(authClinic?.clinic_id || null);
  const [loading] = useState(false);

  // Load real clinic ONLY if account or user explicitly selected a clinic_id
  useEffect(() => {
    const targetCid = clinicId || account?.clinic_id;
    if (targetCid && (!clinic || clinic.clinic_id !== targetCid)) {
      getDoc(doc(db, 'clinics', targetCid)).then((snap) => {
        if (snap.exists()) {
          setClinic({ ...snap.data(), clinic_id: snap.id } as Clinic);
          setClinicIdState(snap.id);
        } else {
          setClinic(null);
          setClinicIdState(null);
        }
      }).catch(console.warn);
    } else if (!targetCid) {
      setClinic(null);
      setClinicIdState(null);
    }
  }, [clinicId, account?.clinic_id]);

  // Real-time onSnapshot for active patient account
  useEffect(() => {
    const activeAccId = account?.account_id || user?.patient_account_id || (user?.role === 'patient' ? `pat_${user.user_id}` : null);
    if (!activeAccId) return;
    const unsub = onSnapshot(doc(db, 'patient_accounts', activeAccId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PatientAccount;
        setAccount((prev) => ({
          ...(prev || {}),
          ...data,
          account_id: snap.id,
        } as PatientAccount));
      }
    });
    return () => unsub();
  }, [account?.account_id, user?.patient_account_id, user?.user_id, user?.role]);

  // Synchronize with unified AuthProvider
  useEffect(() => {
    const targetId = authPatientAccount?.account_id || user?.patient_account_id || user?.user_id;
    let cachedProfile: any = null;
    if (targetId) {
      try {
        const raw = localStorage.getItem(`viitsa_patient_profile_${targetId}`);
        if (raw) cachedProfile = JSON.parse(raw);
      } catch {}
    }

    if (authPatientAccount) {
      setAccount({
        ...authPatientAccount,
        ...(cachedProfile || {}),
        phone: authPatientAccount.phone || cachedProfile?.phone || user?.phone || '',
        name: authPatientAccount.name || cachedProfile?.name || user?.name || '',
        email: authPatientAccount.email || cachedProfile?.email || user?.email || null,
        profile_completed: authPatientAccount.profile_completed || cachedProfile?.profile_completed || false,
      });
    } else if (user && user.role === 'patient') {
      setAccount({
        account_id: user.patient_account_id || user.user_id,
        phone: user.phone || cachedProfile?.phone || '',
        name: user.name || cachedProfile?.name || '',
        email: user.email || cachedProfile?.email || null,
        age: cachedProfile?.age ?? null,
        dob: cachedProfile?.dob ?? null,
        gender: cachedProfile?.gender ?? null,
        blood_group: cachedProfile?.blood_group ?? null,
        address: cachedProfile?.address ?? null,
        current_medications: cachedProfile?.current_medications ?? null,
        allergies: cachedProfile?.allergies ?? 'None',
        chronic_conditions: cachedProfile?.chronic_conditions ?? 'None',
        emergency_contact_name: cachedProfile?.emergency_contact_name ?? null,
        emergency_contact_phone: cachedProfile?.emergency_contact_phone ?? null,
        otp_code: '',
        otp_verified: true,
        auth_user_id: user.user_id,
        created_at: user.created_at,
        profile_completed: cachedProfile?.profile_completed ?? false,
      });
    } else if (!user) {
      setAccount(null);
    }
  }, [authPatientAccount, user]);

  useEffect(() => {
    if (authClinic) {
      setClinic(authClinic);
      setClinicIdState(authClinic.clinic_id);
    }
  }, [authClinic]);

  useEffect(() => {
    if (!clinicId || authClinic) return;
    getDoc(doc(db, 'clinics', clinicId))
      .then((docSnap) => {
        if (docSnap.exists()) {
          setClinic({ ...docSnap.data(), clinic_id: docSnap.id } as Clinic);
        }
      })
      .catch((err) => {
        console.warn('Error fetching clinic for patient:', err);
      });
  }, [clinicId, authClinic]);

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
    const activeAccountId = account?.account_id || user?.patient_account_id || (user?.user_id ? `pat_${user.user_id}` : null);
    if (!activeAccountId) return { ok: false, error: 'Not logged in.' };

    const medications = d.current_medications
      ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
      : (account?.current_medications || ['None']);
    const age = d.dob ? Math.floor((Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : (account?.age || null);

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
    if (d.dob !== undefined) { updates.dob = d.dob || null; updates.age = age; }
    if (d.gender !== undefined) updates.gender = d.gender;
    if (d.blood_group !== undefined) updates.blood_group = d.blood_group;
    if (d.address !== undefined) updates.address = d.address || null;
    if (d.chronic_conditions !== undefined) updates.chronic_conditions = d.chronic_conditions;
    if (d.allergies !== undefined) updates.allergies = d.allergies;
    if (medications !== undefined) updates.current_medications = medications;
    if (d.emergency_contact_name !== undefined) updates.emergency_contact_name = d.emergency_contact_name;
    if (d.emergency_contact_phone !== undefined) updates.emergency_contact_phone = d.emergency_contact_phone;
    if (d.profile_completed !== undefined) updates.profile_completed = d.profile_completed;

    try {
      localStorage.setItem(`viitsa_patient_profile_${activeAccountId}`, JSON.stringify({ ...(account || {}), ...updates }));
      if (user?.user_id) {
        localStorage.setItem(`viitsa_patient_profile_${user.user_id}`, JSON.stringify({ ...(account || {}), ...updates }));
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
    } catch (e) {
      console.warn('Could not update patient_accounts doc:', e);
    }

    // 2. Save all A to Z data to users
    if (user?.user_id) {
      try {
        await setDoc(doc(db, 'users', user.user_id), sanitizeForFirestore({
          ...updates,
          role: 'patient',
          user_type: 'patient',
          id_number: patientCode,
          display_id: patientCode,
          full_name: patName,
          patient_account_id: activeAccountId,
          profile_completed: true,
          role_selected: true,
        }), { merge: true });
      } catch (e) {
        console.warn('Could not update users doc:', e);
      }
    }

    // 3. Save all A to Z data to patients collection only if clinic is chosen
    const activeClinicId = clinicId || authClinic?.clinic_id || account?.clinic_id;
    if (activeClinicId) {
      try {
        await setDoc(doc(db, 'patients', activeAccountId), sanitizeForFirestore({
          patient_id: activeAccountId,
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
        }), { merge: true });
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
        age: age || null,
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
    return { ok: true };
  }, [account, user, clinicId]);

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
    if (!activeAccountId) return;

    try {
      await updateDoc(doc(db, 'patient_accounts', activeAccountId), {
        clinic_id: c ? c.clinic_id : null,
        clinic_name: c ? c.name : null,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Update patient_accounts clinic choice error:', e);
    }

    if (user?.user_id) {
      try {
        await updateDoc(doc(db, 'users', user.user_id), {
          clinic_id: c ? c.clinic_id : null,
          clinic_name: c ? c.name : null,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Update users clinic choice error:', e);
      }
    }

    if (c) {
      try {
        await setDoc(doc(db, 'patient_clinic_links', `${activeAccountId}_${c.clinic_id}`), sanitizeForFirestore({
          account_id: activeAccountId,
          clinic_id: c.clinic_id,
          patient_id: activeAccountId,
          name: account?.name || user?.name || 'Patient',
          id_number: account?.id_number || '',
          created_at: new Date().toISOString(),
        }), { merge: true });
      } catch (e) {
        console.warn('Sync chosen clinic to patient_clinic_links error:', e);
      }
    }
  }, [account, user]);

  const logout = useCallback(() => {
    setAccount(null);
    setClinicIdState(null);
    setClinic(null);
    localStorage.removeItem(STORAGE_KEY);
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
