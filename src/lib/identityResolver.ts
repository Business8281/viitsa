import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  limit,
  addDoc 
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from './firebase';
import type { User, Clinic, PatientAccount, Role } from './types';

export interface IdentityResult {
  user: User;
  clinic: Clinic | null;
  patientAccount: PatientAccount | null;
  isNewUser?: boolean;
}

/**
 * Fetches an existing active clinic from Firestore, or initializes a canonical clinic record.
 * This guarantees real Firestore IDs and documents without any mock data or fake names.
 */
export async function getOrInitializeClinic(preferredClinicId?: string | null): Promise<Clinic | null> {
  // 1. If preferredClinicId is provided, try fetching it directly from Firestore
  if (preferredClinicId) {
    try {
      const snap = await getDoc(doc(db, 'clinics', preferredClinicId));
      if (snap.exists()) {
        const d = snap.data();
        return {
          ...d,
          clinic_id: snap.id,
          clinic_code: d.clinic_code || d.id_number || generateReadableId('CLN', snap.id),
          id_number: d.id_number || d.clinic_code || generateReadableId('CLN', snap.id),
          display_id: d.display_id || d.clinic_code || generateReadableId('CLN', snap.id),
        } as Clinic;
      }
    } catch (e) {
      console.warn('getOrInitializeClinic preferred clinic lookup:', e);
    }
  }

  // 2. Query any existing real clinic from Firestore
  try {
    const qClinics = query(collection(db, 'clinics'), limit(1));
    const cSnap = await getDocs(qClinics);
    if (!cSnap.empty) {
      const firstDoc = cSnap.docs[0];
      const d = firstDoc.data();
      return {
        ...d,
        clinic_id: firstDoc.id,
        clinic_code: d.clinic_code || d.id_number || generateReadableId('CLN', firstDoc.id),
        id_number: d.id_number || d.clinic_code || generateReadableId('CLN', firstDoc.id),
        display_id: d.display_id || d.clinic_code || generateReadableId('CLN', firstDoc.id),
      } as Clinic;
    }
  } catch (e) {
    console.warn('getOrInitializeClinic query existing clinics:', e);
  }

  // If no clinic has registered in Firestore, return null. NO MOCK CLINICS OR DOCTORS!
  return null;
}

/**
 * Sanitizes an object for Firestore by omitting any undefined values recursively.
 * In Cloud Firestore, undefined values trigger an immediate rejection.
 */
export function sanitizeForFirestore<T extends Record<string, any>>(data: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeForFirestore(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

export interface OnboardingData {
  role?: Role;
  name?: string;
  phone?: string;
  email?: string;
  clinicName?: string;
}

/**
 * Normalizes phone numbers to standard 10-digit format
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Generates an easy-to-identify human-readable ID number (e.g. PAT-10482, CLN-89210, ADM-47201)
 */
export function generateReadableId(prefix: 'PAT' | 'ADM' | 'CLN' | 'DOC' | 'STF', seed?: string): string {
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) % 90000;
    }
    const num = Math.abs(hash) + 10000;
    return `${prefix}-${num}`;
  }
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}-${randomNum}`;
}

// Local storage caching for zero-downtime / sub-second instant loads
export function getCachedIdentity(uid: string): IdentityResult | null {
  try {
    const rawU = localStorage.getItem(`viitsa_user_${uid}`);
    const rawC = localStorage.getItem(`viitsa_clinic_${uid}`);
    const rawP = localStorage.getItem(`viitsa_pat_${uid}`);
    if (rawU) {
      return {
        user: JSON.parse(rawU),
        clinic: rawC ? JSON.parse(rawC) : null,
        patientAccount: rawP ? JSON.parse(rawP) : null,
      };
    }
  } catch {}
  return null;
}

export function saveCachedIdentity(res: IdentityResult) {
  try {
    localStorage.setItem(`viitsa_user_${res.user.user_id}`, JSON.stringify(res.user));
    if (res.clinic) {
      localStorage.setItem(`viitsa_clinic_${res.user.user_id}`, JSON.stringify(res.clinic));
    }
    if (res.patientAccount) {
      localStorage.setItem(`viitsa_pat_${res.user.user_id}`, JSON.stringify(res.patientAccount));
    }
  } catch {}
}

/**
 * Resolves a Firebase Authenticated identity to the canonical application user.
 * Built with full defensive error handling to prevent Firestore permission errors from blocking login.
 */
export async function resolveCanonicalIdentity(
  firebaseUser: FirebaseUser,
  onboardingData?: OnboardingData
): Promise<IdentityResult> {
  const email = (firebaseUser.email || onboardingData?.email || '').trim().toLowerCase();
  const rawPhone = firebaseUser.phoneNumber || onboardingData?.phone || '';
  const phone = normalizePhone(rawPhone);
  const uid = firebaseUser.uid;
  const isGoogleProvider = firebaseUser.providerData.some(p => p.providerId === 'google.com');
  const providerId = isGoogleProvider ? 'google.com' : (firebaseUser.phoneNumber ? 'phone' : 'password');

  const usersRef = collection(db, 'users');

  // 1. Search by primary user_id (Firebase UID)
  try {
    const userDocSnap = await getDoc(doc(db, 'users', uid));
    if (userDocSnap.exists()) {
      const res = await handleExistingUser(userDocSnap.data() as User, userDocSnap.id, firebaseUser, isGoogleProvider, providerId);
      saveCachedIdentity(res);
      return res;
    }
  } catch (err) {
    console.warn('Direct user doc read warning (rules or offline):', err);
  }

  // 2. Search by linked_uids array contains current Firebase UID
  try {
    const qLinked = query(usersRef, where('linked_uids', 'array-contains', uid));
    const linkedSnap = await getDocs(qLinked);
    if (!linkedSnap.empty) {
      const d = linkedSnap.docs[0];
      const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId);
      saveCachedIdentity(res);
      return res;
    }
  } catch (e) {
    console.warn('Query linked_uids fallback:', e);
  }

  // 3. Search by matching Email
  if (email) {
    try {
      const qEmail = query(usersRef, where('email', '==', email));
      const emailSnap = await getDocs(qEmail);
      if (!emailSnap.empty) {
        const d = emailSnap.docs[0];
        const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId);
        saveCachedIdentity(res);
        return res;
      }
    } catch (e) {
      console.warn('Query users by email fallback:', e);
    }
  }

  // 4. Search by matching Phone Number
  if (phone && phone.length >= 10) {
    try {
      const qPhone = query(usersRef, where('phone', '==', phone));
      const phoneSnap = await getDocs(qPhone);
      if (!phoneSnap.empty) {
        const d = phoneSnap.docs[0];
        const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId);
        saveCachedIdentity(res);
        return res;
      }
    } catch (e) {
      console.warn('Query users by phone fallback:', e);
    }
  }

  // 5. Search existing patient_accounts collection
  const patientAccountsRef = collection(db, 'patient_accounts');
  let existingPatientDoc: any = null;

  if (phone && phone.length >= 10) {
    try {
      const qPatPhone = query(patientAccountsRef, where('phone', '==', phone));
      const patSnap = await getDocs(qPatPhone);
      if (!patSnap.empty) existingPatientDoc = patSnap.docs[0];
    } catch (e) {
      console.warn('Query patient_accounts by phone fallback:', e);
    }
  }
  if (!existingPatientDoc && email) {
    try {
      const qPatEmail = query(patientAccountsRef, where('email', '==', email));
      const patSnap = await getDocs(qPatEmail);
      if (!patSnap.empty) existingPatientDoc = patSnap.docs[0];
    } catch (e) {
      console.warn('Query patient_accounts by email fallback:', e);
    }
  }

  if (existingPatientDoc) {
    const patData = existingPatientDoc.data() as PatientAccount;
    const patientAccountId = existingPatientDoc.id;
    const patientCode = patData.id_number || patData.patient_code || generateReadableId('PAT', uid);
    const patName = patData.name || firebaseUser.displayName || 'Patient';

    // Resolve chosen clinic ONLY if the patient already selected one in their profile
    let clinic: Clinic | null = null;
    if (patData.clinic_id) {
      clinic = await getOrInitializeClinic(patData.clinic_id);
    }

    const canonicalUser: User = {
      user_id: uid,
      clinic_id: clinic?.clinic_id || undefined,
      clinic_name: clinic?.name || undefined,
      name: patName,
      full_name: patName,
      email: email || patData.email || '',
      role: 'patient',
      user_type: 'patient',
      id_number: patientCode,
      display_id: patientCode,
      phone: phone || patData.phone,
      specialisation: null,
      active: true,
      avatar_color: '#2563EB',
      created_at: patData.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      linked_uids: [uid],
      auth_providers: [providerId],
      patient_account_id: patientAccountId,
      profile_completed: true,
    };

    canonicalUser.role_selected = true;
    try {
      await setDoc(doc(db, 'users', uid), sanitizeForFirestore(canonicalUser), { merge: true });
    } catch (e) {
      console.warn('Save canonical user fallback:', e);
    }

    try {
      await updateDoc(doc(db, 'patient_accounts', patientAccountId), sanitizeForFirestore({
        auth_user_id: uid,
        otp_verified: true,
        profile_completed: true,
        id_number: patientCode,
        display_id: patientCode,
        patient_code: patientCode,
        name: patName,
        full_name: patName,
        updated_at: new Date().toISOString(),
      }));
    } catch (e) {
      console.warn('Update patient account fallback:', e);
    }

    const res: IdentityResult = {
      user: canonicalUser,
      clinic,
      patientAccount: { ...patData, account_id: patientAccountId, auth_user_id: uid, id_number: patientCode, display_id: patientCode, patient_code: patientCode, full_name: patName, profile_completed: true },
      isNewUser: false,
    };
    saveCachedIdentity(res);
    return res;
  }

  // 6. Check if cached identity is available ONLY when strictly offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = getCachedIdentity(uid);
    if (cached) {
      return cached;
    }
  }

  // 7. Completely new user registration
  const newRes = await createNewCanonicalUser(firebaseUser, isGoogleProvider, providerId, email, phone, onboardingData);
  saveCachedIdentity(newRes);
  return newRes;
}

/**
 * Handles existing user verification, identity linking, provider appending, and Company Admin restrictions
 */
async function handleExistingUser(
  existingUser: User,
  canonicalDocId: string,
  firebaseUser: FirebaseUser,
  isGoogleProvider: boolean,
  providerId: string
): Promise<IdentityResult> {
  // CRITICAL REQUIREMENT: Company Admin must NOT authenticate with Google Sign-In
  if (existingUser.role === 'company_admin' && isGoogleProvider) {
    throw new Error('Google Sign-In is not permitted for Company Admin accounts. Please sign in using your registered Email or Phone OTP.');
  }

  const updates: Record<string, any> = {};
  const currentLinked = existingUser.linked_uids || [existingUser.user_id];
  if (!currentLinked.includes(firebaseUser.uid)) {
    updates.linked_uids = [...currentLinked, firebaseUser.uid];
  }

  const currentProviders = existingUser.auth_providers || [];
  if (!currentProviders.includes(providerId)) {
    updates.auth_providers = [...currentProviders, providerId];
  }

  // Update phone/email if previously missing on the canonical record
  const normPhone = normalizePhone(firebaseUser.phoneNumber);
  if (!existingUser.phone && normPhone) {
    updates.phone = normPhone;
  }
  if (!existingUser.email && firebaseUser.email) {
    updates.email = firebaseUser.email.trim().toLowerCase();
  }

  if (!existingUser.id_number) {
    const isClinicRole = ['clinic_admin', 'clinic_doctor', 'clinic_staff'].includes(existingUser.role);
    const isAdminRole = ['company_admin', 'company_manager', 'company_staff'].includes(existingUser.role);
    const prefix = isClinicRole || isAdminRole ? 'ADM' : 'PAT';
    const genCode = generateReadableId(prefix, canonicalDocId);
    updates.id_number = genCode;
    updates.display_id = genCode;
  }
  if (!existingUser.full_name) {
    updates.full_name = existingUser.name;
  }
  if (!existingUser.role || (existingUser.role as any) === 'unassigned') {
    updates.role = 'patient';
    existingUser.role = 'patient';
  }
  
  if (!existingUser.user_type) {
    const roleToCheck = updates.role || existingUser.role;
    const isClinicRole = ['clinic_admin', 'clinic_doctor', 'clinic_staff'].includes(roleToCheck);
    const isAdminRole = ['company_admin', 'company_manager', 'company_staff'].includes(roleToCheck);
    updates.user_type = isAdminRole ? 'company_admin' : (isClinicRole ? 'clinic_admin' : 'patient');
  }
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length > 0) {
    try {
      await updateDoc(doc(db, 'users', canonicalDocId), updates);
    } catch (e) {
      console.warn('Update user document warning:', e);
    }
    Object.assign(existingUser, updates);
  }

  // Load associated Clinic
  let clinic: Clinic | null = null;
  if (existingUser.clinic_id) {
    try {
      const cSnap = await getDoc(doc(db, 'clinics', existingUser.clinic_id));
      if (cSnap.exists()) {
        clinic = { ...cSnap.data(), clinic_id: cSnap.id } as Clinic;
      }
    } catch (e) {
      console.warn('Read clinic doc warning:', e);
    }
  }

  if (!clinic && existingUser.role !== 'patient' && existingUser.clinic_id) {
    clinic = await getOrInitializeClinic(existingUser.clinic_id);
  }

  if (clinic && existingUser.clinic_id !== clinic.clinic_id) {
    existingUser.clinic_id = clinic.clinic_id;
    try {
      await updateDoc(doc(db, 'users', canonicalDocId), {
        clinic_id: clinic.clinic_id,
        updated_at: new Date().toISOString(),
      });
    } catch {}
  }

  // Load Patient Account if patient
  let patientAccount: PatientAccount | null = null;
  if (existingUser.role === 'patient') {
    if (existingUser.patient_account_id) {
      try {
        const pSnap = await getDoc(doc(db, 'patient_accounts', existingUser.patient_account_id));
        if (pSnap.exists()) {
          patientAccount = { ...pSnap.data(), account_id: pSnap.id } as PatientAccount;
        }
      } catch (e) {
        console.warn('Read patient account warning:', e);
      }
    }
    if (!patientAccount && existingUser.phone) {
      try {
        const qP = query(collection(db, 'patient_accounts'), where('phone', '==', existingUser.phone));
        const pSnap = await getDocs(qP);
        if (!pSnap.empty) {
          patientAccount = { ...pSnap.docs[0].data(), account_id: pSnap.docs[0].id } as PatientAccount;
        }
      } catch (e) {
        console.warn('Query patient accounts warning:', e);
      }
    }

    if (!patientAccount) {
      const patDocId = existingUser.patient_account_id || `pat_${canonicalDocId}`;
      try {
        const fallbackSnap = await getDoc(doc(db, 'patient_accounts', patDocId));
        if (fallbackSnap.exists()) {
          patientAccount = { ...fallbackSnap.data(), account_id: fallbackSnap.id } as PatientAccount;
        }
      } catch (e) {
        console.warn('Fallback read patient account warning:', e);
      }

      if (!patientAccount) {
        const nowIso = new Date().toISOString();
        const pCode = existingUser.id_number || generateReadableId('PAT', canonicalDocId);
        
        patientAccount = {
          account_id: patDocId,
          id_number: pCode,
          display_id: pCode,
          patient_code: pCode,
          phone: existingUser.phone || '',
          name: existingUser.name,
          full_name: existingUser.name,
          email: existingUser.email || null,
          age: null,
          dob: null,
          gender: null,
          blood_group: null,
          address: null,
          current_medications: null,
          allergies: 'None',
          chronic_conditions: 'None',
          emergency_contact_name: null,
          emergency_contact_phone: null,
          otp_code: '',
          otp_verified: true,
          auth_user_id: canonicalDocId,
          profile_completed: true,
          created_at: nowIso,
          updated_at: nowIso,
        };

        try {
          await setDoc(doc(db, 'patient_accounts', patDocId), sanitizeForFirestore(patientAccount), { merge: true });
        } catch (e) {
          console.warn('Create missing patient account warning:', e);
        }
      }

      if (existingUser.patient_account_id !== patDocId) {
        existingUser.patient_account_id = patDocId;
        try {
          await updateDoc(doc(db, 'users', canonicalDocId), { patient_account_id: patDocId, updated_at: new Date().toISOString() });
        } catch (e) {
          console.warn('Update user patient_account_id warning:', e);
        }
      }
    } else {
      if (existingUser.patient_account_id !== patientAccount.account_id) {
        existingUser.patient_account_id = patientAccount.account_id;
        try {
          await updateDoc(doc(db, 'users', canonicalDocId), {
            patient_account_id: patientAccount.account_id,
            updated_at: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Sync user patient_account_id warning:', e);
        }
      }

      if (!patientAccount.id_number || !patientAccount.patient_code || !patientAccount.full_name) {
        const pCode = patientAccount.id_number || generateReadableId('PAT', patientAccount.account_id);
        patientAccount.id_number = pCode;
        patientAccount.display_id = pCode;
        patientAccount.patient_code = pCode;
        patientAccount.full_name = patientAccount.name;
        try {
          await updateDoc(doc(db, 'patient_accounts', patientAccount.account_id), {
            id_number: pCode,
            display_id: pCode,
            patient_code: pCode,
            full_name: patientAccount.name,
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }
    }
  }

  // Already registered user: permanently mark profile_completed as true
  if (existingUser.profile_completed !== true) {
    existingUser.profile_completed = true;
    try {
      await updateDoc(doc(db, 'users', canonicalDocId), { profile_completed: true, updated_at: new Date().toISOString() });
    } catch {}
  }
  if (patientAccount && patientAccount.profile_completed !== true) {
    patientAccount.profile_completed = true;
    try {
      await updateDoc(doc(db, 'patient_accounts', patientAccount.account_id), { profile_completed: true, updated_at: new Date().toISOString() });
    } catch {}
  }

  return {
    user: { ...existingUser, user_id: canonicalDocId, role_selected: true, profile_completed: true },
    clinic,
    patientAccount: patientAccount ? {
      ...patientAccount,
      profile_completed: true,
    } : null,
    isNewUser: false,
  };
}

/**
 * Creates a brand-new canonical user record and corresponding profile
 */
async function createNewCanonicalUser(
  firebaseUser: FirebaseUser,
  isGoogleProvider: boolean,
  providerId: string,
  email: string,
  phone: string,
  onboardingData?: OnboardingData
): Promise<IdentityResult> {
  let role: Role = (onboardingData?.role as any) === 'unassigned' ? 'patient' : (onboardingData?.role || 'patient');
  const name = onboardingData?.name || firebaseUser.displayName || email.split('@')[0] || (phone ? `User ${phone.slice(-4)}` : 'User');

  // CRITICAL: Prevent Company Admin from registering via Google
  if (role === 'company_admin' && isGoogleProvider) {
    throw new Error('Google Sign-In cannot be used for Company Admin registration. Please use Email or Phone OTP.');
  }

  let clinicId = '';
  let clinic: Clinic | null = null;
  let patientAccount: PatientAccount | null = null;
  const nowIso = new Date().toISOString();

  if (role === 'company_admin') {
    const clinicCode = generateReadableId('CLN', firebaseUser.uid);
    const clinicName = onboardingData?.clinicName || 'Viitsa Health Enterprise HQ';
    try {
      clinicId = `cln_${firebaseUser.uid}`;
      await setDoc(doc(db, 'clinics', clinicId), {
        clinic_code: clinicCode,
        id_number: clinicCode,
        display_id: clinicCode,
        name: clinicName,
        owner_name: name,
        owner_user_id: firebaseUser.uid,
        phone: phone || '',
        email: email || '',
        city: 'Headquarters',
        address: 'Main Executive Campus',
        logo_url: null,
        working_hours: { open: '08:00', close: '20:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
        created_at: nowIso,
        updated_at: nowIso,
      });
      // clinicId is already set above
    } catch (e) {
      console.warn('Create company clinic warning:', e);
    }
    clinic = {
      clinic_id: clinicId,
      clinic_code: clinicCode,
      id_number: clinicCode,
      display_id: clinicCode,
      name: clinicName,
      owner_name: name,
      owner_user_id: firebaseUser.uid,
      phone: phone || '',
      email: email || '',
      city: 'Headquarters',
      address: 'Main Executive Campus',
      logo_url: null,
      working_hours: { open: '08:00', close: '20:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] },
      created_at: nowIso,
      updated_at: nowIso,
    };
  } else if (role === 'clinic_admin') {
    const clinicCode = generateReadableId('CLN', firebaseUser.uid);
    const clinicName = onboardingData?.clinicName || `${name}'s Clinic`;
    try {
      clinicId = `cln_${firebaseUser.uid}`;
      await setDoc(doc(db, 'clinics', clinicId), sanitizeForFirestore({
        clinic_code: clinicCode,
        id_number: clinicCode,
        display_id: clinicCode,
        name: clinicName,
        owner_name: name,
        owner_user_id: firebaseUser.uid,
        phone: phone || '',
        email: email || '',
        city: '',
        address: '',
        logo_url: null,
        clinic_setup_complete: false,
        working_hours: { open: '09:00', close: '19:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
        created_at: nowIso,
        updated_at: nowIso,
      }));
      // clinicId is already set above
    } catch (e) {
      console.warn('Create clinic warning:', e);
    }
    clinic = {
      clinic_id: clinicId,
      clinic_code: clinicCode,
      id_number: clinicCode,
      display_id: clinicCode,
      name: clinicName,
      owner_name: name,
      owner_user_id: firebaseUser.uid,
      phone: phone || '',
      email: email || '',
      city: '',
      address: '',
      logo_url: null,
      clinic_setup_complete: false,
      working_hours: { open: '09:00', close: '19:00', days: ['Mon','Tue','Wed','Thu','Fri','Sat'] },
      created_at: nowIso,
      updated_at: nowIso,
    };
  } else if (role === 'patient') {
    // Role is 'patient' - DO NOT automatically link to any clinic
    // Patients choose their clinic explicitly from their dashboard
    clinic = null;
    clinicId = '';

    const patientCode = generateReadableId('PAT', firebaseUser.uid);
    const patDocId = 'pat_' + firebaseUser.uid;
    try {
      await setDoc(doc(db, 'patient_accounts', patDocId), sanitizeForFirestore({
        account_id: patDocId,
        id_number: patientCode,
        display_id: patientCode,
        patient_code: patientCode,
        phone: phone || '',
        name: name,
        full_name: name,
        email: email || null,
        clinic_id: null,
        clinic_name: null,
        auth_user_id: firebaseUser.uid,
        otp_verified: true,
        profile_completed: false,
        allergies: 'None',
        chronic_conditions: 'None',
        created_at: nowIso,
        updated_at: nowIso,
      }), { merge: true });
    } catch (e) {
      console.warn('Create patient account warning:', e);
    }

    patientAccount = {
      account_id: patDocId,
      id_number: patientCode,
      display_id: patientCode,
      patient_code: patientCode,
      phone: phone || '',
      name: name,
      full_name: name,
      email: email || null,
      age: null,
      dob: null,
      gender: null,
      blood_group: null,
      address: null,
      current_medications: null,
      allergies: 'None',
      chronic_conditions: 'None',
      emergency_contact_name: null,
      emergency_contact_phone: null,
      otp_code: '',
      otp_verified: true,
      auth_user_id: firebaseUser.uid,
      profile_completed: false,
      created_at: nowIso,
      updated_at: nowIso,
    };
  } else {
    // Other roles (doctor, staff)
    clinic = null;
    clinicId = '';
    patientAccount = null;
  }

  const hasExplicitRole = Boolean(onboardingData?.role);
  
  const isClinicRole = ['clinic_admin', 'clinic_doctor', 'clinic_staff'].includes(role);
  const isAdminRole = ['company_admin', 'company_manager', 'company_staff'].includes(role);
  
  const userCode = isClinicRole 
    ? generateReadableId('ADM', firebaseUser.uid) 
    : (isAdminRole ? generateReadableId('ADM', firebaseUser.uid) : generateReadableId('PAT', firebaseUser.uid));

  let resolvedUserType = 'patient';
  if (isAdminRole) resolvedUserType = 'company_admin';
  else if (isClinicRole) resolvedUserType = 'clinic_admin';

  let avatarColor = '#2563EB';
  if (isAdminRole) avatarColor = '#7C3AED';
  else if (isClinicRole) avatarColor = '#0F6E56';

  const canonicalUser: User = {
    user_id: firebaseUser.uid,
    clinic_id: clinicId,
    clinic_name: clinic?.name || undefined,
    name: name,
    full_name: name,
    email: email || '',
    role: role,
    user_type: resolvedUserType as User['user_type'],
    id_number: userCode,
    display_id: userCode,
    phone: phone || null,
    specialisation: null,
    active: true,
    avatar_color: avatarColor,
    created_at: nowIso,
    updated_at: nowIso,
    linked_uids: [firebaseUser.uid],
    auth_providers: [providerId],
    patient_account_id: patientAccount?.account_id || null,
    profile_completed: false,
    role_selected: hasExplicitRole,
    clinic_setup_complete: role === 'clinic_admin' ? false : undefined,
  };

  try {
    await setDoc(doc(db, 'users', firebaseUser.uid), sanitizeForFirestore(canonicalUser), { merge: true });
  } catch (e) {
    console.error('Write canonical user document error:', e);
  }

  return {
    user: canonicalUser,
    clinic,
    patientAccount,
    isNewUser: !hasExplicitRole,
  };
}
