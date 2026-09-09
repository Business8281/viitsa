import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import type { PatientAccount, Clinic } from './types';

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

  const fetchAccount = useCallback(async (account_id: string) => {
    const { data } = await supabase.from('patient_accounts').select('*').eq('account_id', account_id).maybeSingle();
    setAccount((data as PatientAccount | null) ?? null);
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
    supabase.from('clinics').select('*').eq('clinic_id', clinicId).maybeSingle()
      .then(({ data }) => setClinic((data as Clinic | null) ?? null));
  }, [clinicId]);

  const setClinicId = useCallback((id: string) => setClinicIdState(id), []);

  const sendOtp = useCallback(async (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (clean.length < 10) return { ok: false, error: 'Enter a valid 10-digit mobile number.' };
    const fullPhone = clean.length === 10 ? `+91${clean}` : `+${clean}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      phone: fullPhone,
      options: { channel: 'sms' },
    });
    if (otpError) return { ok: false, error: 'Unable to send OTP. Please try again.' };
    return { ok: true };
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const clean = phone.replace(/\D/g, '');
    const fullPhone = clean.length === 10 ? `+91${clean}` : `+${clean}`;
    const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
      phone: fullPhone,
      token: otp,
      type: 'sms',
    });
    if (otpError || !otpData.user) return { ok: false, error: 'Unable to verify OTP. Please try again.' };

    const authUserId = otpData.user.id;
    const { data: existing } = await supabase
      .from('patient_accounts')
      .select('*')
      .eq('phone', clean)
      .maybeSingle();

    let acc: PatientAccount;
    if (existing) {
      acc = existing as PatientAccount;
      await supabase.from('patient_accounts').update({ otp_verified: true, auth_user_id: authUserId }).eq('account_id', acc.account_id);
      acc = { ...acc, otp_verified: true, auth_user_id: authUserId };
    } else {
      const { data: newAcc, error: insertError } = await supabase
        .from('patient_accounts')
        .insert({ phone: clean, name: 'New Patient', otp_verified: true, auth_user_id: authUserId })
        .select('*')
        .single();
      if (insertError || !newAcc) return { ok: false, error: 'Unable to create account. Please try again.' };
      acc = newAcc as PatientAccount;
    }

    const isNew = acc.name === 'New Patient';
    setAccount(acc);
    const stored: Record<string, string> = { account_id: acc.account_id };
    if (clinicId) stored.clinic_id = clinicId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    return { ok: true, isNew };
  }, [clinicId]);

  const register = useCallback(async (d: RegisterData) => {
    const clean = d.phone.replace(/\D/g, '');
    const age = d.dob ? Math.floor((Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;
    const medications = d.current_medications
      ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
      : [];

    const { data, error } = await supabase
      .from('patient_accounts')
      .update({
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
      })
      .eq('phone', clean)
      .select('*')
      .single();
    if (error || !data) return { ok: false, error: 'Unable to create account. Please try again.' };
    const acc = data as PatientAccount;
    setAccount(acc);

    if (clinicId) {
      const { data: existing } = await supabase
        .from('patients').select('patient_id').eq('phone', clean).eq('clinic_id', clinicId).maybeSingle();
      if (!existing) {
        const { data: newPat } = await supabase.from('patients').insert({
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
        }).select('patient_id').single();
        if (newPat) {
          await supabase.from('patient_clinic_links').insert({
            account_id: acc.account_id,
            patient_id: (newPat as { patient_id: string }).patient_id,
            clinic_id: clinicId,
          });
        }
      }
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ account_id: acc.account_id, clinic_id: clinicId }));
    return { ok: true };
  }, [clinicId]);

  const updateProfile = useCallback(async (d: Partial<RegisterData>) => {
    if (!account) return { ok: false, error: 'Not logged in.' };
    const medications = d.current_medications
      ? d.current_medications.split(',').map(m => m.trim()).filter(Boolean)
      : undefined;
    const age = d.dob ? Math.floor((Date.now() - new Date(d.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : undefined;

    const updates: Record<string, unknown> = {};
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

    const { data, error } = await supabase.from('patient_accounts').update(updates)
      .eq('account_id', account.account_id).select('*').single();
    if (error || !data) return { ok: false, error: 'Unable to update profile. Please try again.' };
    setAccount(data as PatientAccount);
    return { ok: true };
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
    void supabase.auth.signOut();
  }, []);

  const value = useMemo<PatientAuthState>(
    () => ({ account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, refreshAccount }),
    [account, clinic, clinicId, loading, sendOtp, verifyOtp, register, updateProfile, logout, setClinicId, refreshAccount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePatientAuth(): PatientAuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePatientAuth must be inside PatientAuthProvider');
  return ctx;
}
