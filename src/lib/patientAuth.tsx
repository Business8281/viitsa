import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { auth, db } from './firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, signOut, ConfirmationResult } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import type { PatientAccount, Clinic, Patient } from './types';

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
}

const Ctx = createContext<PatientAuthState | undefined>(undefined);

export function PatientAuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [clinicId, setClinicIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

  const fetchAccount = useCallback(async (account_id: string) => {
    try {
      const docRef = doc(db, 'patient_accounts', account_id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setAccount({ ...docSnap.data(), account_id: docSnap.id } as PatientAccount);
      } else {
        setAccount(null);
      }
    } catch (e) {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const { account_id, clinic_id } = JSON.parse(raw) as { account_id: string; clinic_id?: string };
      if (clinic_id) setClinicIdState(clinic_id);
      setLoading(true);
      fetchAccount(account_id).finally(() => setLoading(false));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [fetchAccount]);

  useEffect(() => {
    if (!clinicId) return;
    getDoc(doc(db, 'clinics', clinicId))
      .then((docSnap) => {
        if (docSnap.exists()) {
          setClinic({ ...docSnap.data(), clinic_id: docSnap.id } as Clinic);
        }
      });
  }, [clinicId]);

  const setClinicId = useCallback((id: string) => setClinicIdState(id), []);

  const sendOtp = useCallback(async (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return { ok: false, error: 'Enter a valid 10-digit mobile number.' };
    const fullPhone = clean.length === 10 ? `+91${clean}` : `+${clean}`;
    
    try {
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible'
        });
      }
      const confirmation = await signInWithPhoneNumber(auth, fullPhone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      return { ok: true };
    } catch (error: any) {
      console.error(error);
      return { ok: false, error: error.message || 'Unable to send OTP. Please try again.' };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    if (!confirmationResult) return { ok: false, error: 'Session expired. Please request OTP again.' };
    
    try {
      const result = await confirmationResult.confirm(otp);
      const authUserId = result.user.uid;
      const clean = phone.replace(/\D/g, '');
      
      const q = query(collection(db, 'patient_accounts'), where('phone', '==', clean));
      const querySnapshot = await getDocs(q);
      
      let acc: PatientAccount;
      if (!querySnapshot.empty) {
        const existingDoc = querySnapshot.docs[0];
        acc = { ...existingDoc.data(), account_id: existingDoc.id } as PatientAccount;
        await updateDoc(doc(db, 'patient_accounts', acc.account_id), { otp_verified: true, auth_user_id: authUserId });
        acc = { ...acc, otp_verified: true, auth_user_id: authUserId };
      } else {
        const newDocRef = await addDoc(collection(db, 'patient_accounts'), {
          phone: clean,
          name: 'New Patient',
          otp_verified: true,
          auth_user_id: authUserId,
          created_at: new Date().toISOString()
        });
        const newDocSnap = await getDoc(newDocRef);
        acc = { ...newDocSnap.data(), account_id: newDocSnap.id } as PatientAccount;
      }

      const isNew = acc.name === 'New Patient';
      setAccount(acc);
      const stored: Record<string, string> = { account_id: acc.account_id };
      if (clinicId) stored.clinic_id = clinicId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return { ok: true, isNew };
    } catch (error) {
      return { ok: false, error: 'Unable to verify OTP. Please try again.' };
    }
  }, [confirmationResult, clinicId]);

  const register = useCallback(async (d: RegisterData) => {
    if (!account) return { ok: false, error: 'Not verified' };
    const clean = d.phone.replace(/\D/g, '');
    const age = d.dob ? Math.floor((Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;
    const medications = d.current_medications
      ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    try {
      const updates = {
        name: d.name,
        email: d.email || null,
        dob: d.dob || null,
        age: age ?? null,
        gender: d.gender,
        blood_group: d.blood_group,
        address: d.address || null,
        chronic_conditions: d.chronic_conditions,
        allergies: d.allergies,
        current_medications: medications,
        emergency_contact_name: d.emergency_contact_name,
        emergency_contact_phone: d.emergency_contact_phone,
        otp_verified: true,
      };

      await updateDoc(doc(db, 'patient_accounts', account.account_id), updates);
      const updatedAccSnap = await getDoc(doc(db, 'patient_accounts', account.account_id));
      const acc = { ...updatedAccSnap.data(), account_id: updatedAccSnap.id } as PatientAccount;
      setAccount(acc);

      if (clinicId) {
        const q = query(collection(db, 'patients'), where('phone', '==', clean), where('clinic_id', '==', clinicId));
        const pSnap = await getDocs(q);
        if (pSnap.empty) {
          const newPatRef = await addDoc(collection(db, 'patients'), {
            clinic_id: clinicId,
            name: d.name,
            email: d.email || null,
            dob: d.dob || null,
            age: age ?? null,
            gender: d.gender,
            phone: clean,
            blood_group: d.blood_group,
            address: d.address || null,
            allergies: d.allergies,
            chronic_conditions: d.chronic_conditions,
            current_medications: medications,
            emergency_contact_name: d.emergency_contact_name,
            emergency_contact_phone: d.emergency_contact_phone,
            created_at: new Date().toISOString()
          });
          
          await addDoc(collection(db, 'patient_clinic_links'), {
            account_id: acc.account_id,
            patient_id: newPatRef.id,
            clinic_id: clinicId,
          });
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ account_id: acc.account_id, clinic_id: clinicId }));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Unable to create account. Please try again.' };
    }
  }, [account, clinicId]);

  const updateProfile = useCallback(async (d: Partial<RegisterData>) => {
    if (!account) return { ok: false, error: 'Not logged in.' };
    const medications = d.current_medications
      ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
      : undefined;
    const age = d.dob ? Math.floor((Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;

    const updates: Record<string, any> = {};
    if (d.name !== undefined) updates.name = d.name;
    if (d.email !== undefined) updates.email = d.email || null;
    if (d.dob !== undefined) { updates.dob = d.dob || null; if (age !== undefined) updates.age = age; }
    if (d.gender !== undefined) updates.gender = d.gender;
    if (d.blood_group !== undefined) updates.blood_group = d.blood_group;
    if (d.address !== undefined) updates.address = d.address || null;
    if (d.chronic_conditions !== undefined) updates.chronic_conditions = d.chronic_conditions;
    if (d.allergies !== undefined) updates.allergies = d.allergies;
    if (medications !== undefined) updates.current_medications = medications;
    if (d.emergency_contact_name !== undefined) updates.emergency_contact_name = d.emergency_contact_name;
    if (d.emergency_contact_phone !== undefined) updates.emergency_contact_phone = d.emergency_contact_phone;

    try {
      await updateDoc(doc(db, 'patient_accounts', account.account_id), updates);
      const updatedSnap = await getDoc(doc(db, 'patient_accounts', account.account_id));
      setAccount({ ...updatedSnap.data(), account_id: updatedSnap.id } as PatientAccount);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: 'Unable to update profile. Please try again.' };
    }
  }, [account]);

  const refreshAccount = useCallback(async () => {
    if (!account) return;
    await fetchAccount(account.account_id);
  }, [account, fetchAccount]);

  const logout = useCallback(() => {
    setAccount(null);
    setClinicIdState(null);
    setClinic(null);
    localStorage.removeItem(STORAGE_KEY);
    signOut(auth);
  }, []);

  const value = useMemo<PatientAuthState>(
    () => ({ account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, refreshAccount }),
    [account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, refreshAccount],
  );

  return (
    <Ctx.Provider value={value}>
      <div id="recaptcha-container"></div>
      {children}
    </Ctx.Provider>
  );
}

export function usePatientAuth(): PatientAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePatientAuth must be inside PatientAuthProvider');
  return ctx;
}
