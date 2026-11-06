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
  addDoc,
  deleteDoc,
  deleteField
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import { db } from './firebase';
import type { User, Clinic, PatientAccount, Role } from './types';
import { claimPastAppointmentsForPhone } from './accountLinking';

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
  // If preferredClinicId is provided, fetch it directly from Firestore
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

  // Never auto-assign a random clinic. Patients and users connect to clinics only by explicit choice.
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
  phone_verified?: boolean;
  email?: string;
  email_verified?: boolean;
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
  // STRICT PORTAL ISOLATION: URL pathname is the definitive source of truth
  let portalIntent: 'clinic' | 'patient' | 'admin' | null = null;
  if (typeof window !== 'undefined') {
    if (window.location.pathname.startsWith('/clinic')) {
      portalIntent = 'clinic';
    } else if (window.location.pathname.startsWith('/admin')) {
      portalIntent = 'admin';
    } else if (window.location.pathname.startsWith('/patient') || window.location.pathname === '/login') {
      portalIntent = 'patient';
    } else {
      const stored = sessionStorage.getItem('viitsa_portal_intent');
      if (stored === 'clinic' || stored === 'patient' || stored === 'admin') {
        portalIntent = stored;
      }
    }
  }

  if (!portalIntent && onboardingData?.role) {
    if (['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'].includes(onboardingData.role)) {
      portalIntent = 'clinic';
    } else if (['company_admin', 'company_manager', 'company_staff'].includes(onboardingData.role)) {
      portalIntent = 'admin';
    } else if (['patient', 'patient_attendant'].includes(onboardingData.role)) {
      portalIntent = 'patient';
    }
  }

  const isClinicPortal = portalIntent === 'clinic';
  const isAdminPortal = portalIntent === 'admin';
  const isPatientPortal = portalIntent === 'patient' || (onboardingData?.role === 'patient' && !isAdminPortal && !isClinicPortal);

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
      const res = await handleExistingUser(userDocSnap.data() as User, userDocSnap.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, onboardingData);
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
      const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, onboardingData);
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
        const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, onboardingData);
        saveCachedIdentity(res);
        return res;
      }
    } catch (e) {
      console.warn('Query users by email fallback:', e);
    }
  }

  // 4. Search by matching Phone Number (patient phone or attendant phone)
  if (phone && phone.length >= 10) {
    try {
      const qPhone = query(usersRef, where('phone', '==', phone));
      const phoneSnap = await getDocs(qPhone);
      if (!phoneSnap.empty) {
        const d = phoneSnap.docs[0];
        const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, onboardingData);
        saveCachedIdentity(res);
        return res;
      }
    } catch (e) {
      console.warn('Query users by phone fallback:', e);
    }

    // 4b. Search users by attender_phone / emergency_contact_phone (Attendant Login)
    if (!isAdminPortal && !isClinicPortal) {
      try {
        const qAtt = query(usersRef, where('attender_phone', '==', phone));
        const attSnap = await getDocs(qAtt);
        if (!attSnap.empty) {
          const d = attSnap.docs[0];
          const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, { ...onboardingData, role: 'patient_attendant' });
          saveCachedIdentity(res);
          return res;
        }
      } catch (e) {
        console.warn('Query users by attender_phone fallback:', e);
      }

      try {
        const qEm = query(usersRef, where('emergency_contact_phone', '==', phone));
        const emSnap = await getDocs(qEm);
        if (!emSnap.empty) {
          const d = emSnap.docs[0];
          const res = await handleExistingUser(d.data() as User, d.id, firebaseUser, isGoogleProvider, providerId, isClinicPortal, isPatientPortal, isAdminPortal, { ...onboardingData, role: 'patient_attendant' });
          saveCachedIdentity(res);
          return res;
        }
      } catch (e) {
        console.warn('Query users by emergency_contact_phone fallback:', e);
      }
    }
  }

  // 5. Search existing patient_accounts collection ONLY for patient portal (STRICT ISOLATION)
  let existingPatientDoc: any = null;
  let isAttenderMatch = false;
  if (!isClinicPortal && !isAdminPortal) {
    const patientAccountsRef = collection(db, 'patient_accounts');

    if (phone && phone.length >= 10) {
      // 5a. Primary patient phone
      try {
        const qPatPhone = query(patientAccountsRef, where('phone', '==', phone));
        const patSnap = await getDocs(qPatPhone);
        if (!patSnap.empty) existingPatientDoc = patSnap.docs[0];
      } catch (e) {
        console.warn('Query patient_accounts by phone fallback:', e);
      }

      // 5b. Attendant / Friend phone
      if (!existingPatientDoc) {
        try {
          const qAttPhone = query(patientAccountsRef, where('attender_phone', '==', phone));
          const attSnap = await getDocs(qAttPhone);
          if (!attSnap.empty) {
            existingPatientDoc = attSnap.docs[0];
            isAttenderMatch = true;
          }
        } catch (e) {
          console.warn('Query patient_accounts by attender_phone fallback:', e);
        }
      }

      // 5c. Emergency contact phone
      if (!existingPatientDoc) {
        try {
          const qEmPhone = query(patientAccountsRef, where('emergency_contact_phone', '==', phone));
          const emSnap = await getDocs(qEmPhone);
          if (!emSnap.empty) {
            existingPatientDoc = emSnap.docs[0];
            isAttenderMatch = true;
          }
        } catch (e) {
          console.warn('Query patient_accounts by emergency_contact_phone fallback:', e);
        }
      }
    }

    // 5d. Search by matching Google email
    if (!existingPatientDoc && email) {
      try {
        const qPatEmail = query(patientAccountsRef, where('email', '==', email));
        const patSnap = await getDocs(qPatEmail);
        if (!patSnap.empty) existingPatientDoc = patSnap.docs[0];
      } catch (e) {
        console.warn('Query patient_accounts by email fallback:', e);
      }
    }
  }

  if (existingPatientDoc) {
    const patData = existingPatientDoc.data() as PatientAccount;
    const patientAccountId = existingPatientDoc.id;
    const patientCode = patData.id_number || patData.patient_code || generateReadableId('PAT', uid);
    const patName = isAttenderMatch
      ? ((patData as any).attender_name || patData.emergency_contact_name || 'Patient Attendant')
      : (patData.name || firebaseUser.displayName || 'Patient');
    const effectiveRole: Role = isAttenderMatch ? 'patient_attendant' : 'patient';

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
      role: effectiveRole,
      user_type: effectiveRole,
      id_number: patientCode,
      display_id: patientCode,
      phone: phone || patData.phone,
      specialisation: null,
      active: true,
      avatar_color: isAttenderMatch ? '#0D9488' : '#2563EB',
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
      const patUpdates: Record<string, any> = {
        otp_verified: true,
        profile_completed: true,
        id_number: patientCode,
        display_id: patientCode,
        patient_code: patientCode,
        updated_at: new Date().toISOString(),
      };
      if (!isAttenderMatch) {
        patUpdates.auth_user_id = uid;
        if (!patData.name && patName) patUpdates.name = patName;
        if (!patData.full_name && patName) patUpdates.full_name = patName;
        if (!patData.email && email) patUpdates.email = email;
        if (!patData.phone && phone) patUpdates.phone = phone;
      }
      await updateDoc(doc(db, 'patient_accounts', patientAccountId), sanitizeForFirestore(patUpdates));
    } catch (e) {
      console.warn('Update patient account fallback:', e);
    }

    const res: IdentityResult = {
      user: canonicalUser,
      clinic,
      patientAccount: { ...patData, account_id: patientAccountId, id_number: patientCode, display_id: patientCode, patient_code: patientCode, profile_completed: true },
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
  const newRes = await createNewCanonicalUser(firebaseUser, isGoogleProvider, providerId, email, phone, onboardingData, isClinicPortal, isAdminPortal);
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
  providerId: string,
  isClinicPortal: boolean = false,
  isPatientPortal: boolean = false,
  isAdminPortal: boolean = false,
  onboardingData?: OnboardingData
): Promise<IdentityResult> {
  // CRITICAL REQUIREMENT: Google Sign-In is EXCLUSIVELY for Patient accounts
  if (isGoogleProvider && existingUser.role !== 'patient' && (existingUser.role as any) !== 'patient_attendant') {
    throw new Error('Google Sign-In is only enabled for Patient accounts. Clinic Staff and Administrators must sign in via Email and Password.');
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
  const candidatePhone = normalizePhone(onboardingData?.phone || firebaseUser.phoneNumber);
  if ((!existingUser.phone || existingUser.phone.length < 10) && candidatePhone) {
    updates.phone = candidatePhone;
    existingUser.phone = candidatePhone;
  }
  const candidateEmail = (onboardingData?.email || firebaseUser.email || '').trim().toLowerCase();
  if (!existingUser.email && candidateEmail) {
    updates.email = candidateEmail;
    existingUser.email = candidateEmail;
  }
  if (onboardingData?.phone_verified && !existingUser.phone_verified) {
    updates.phone_verified = true;
    existingUser.phone_verified = true;
  }
  if (onboardingData?.email_verified && !existingUser.email_verified) {
    updates.email_verified = true;
    existingUser.email_verified = true;
  }

  // STRICT PORTAL ISOLATION & CANONICAL ROLE PRESERVATION:
  // Recover patients ONLY if they have a real patient account and strictly NO clinic affiliation and NOT an admin role.
  const isSystemAdminRole = ['company_admin', 'company_manager', 'company_staff', 'super_admin'].includes(existingUser.role);
  if (!isSystemAdminRole && (isPatientPortal || onboardingData?.role === 'patient')) {
    const hasPatientAccount = Boolean(existingUser.patient_account_id);
    const hasNoClinicAtAll = !existingUser.clinic_id;
    
    // Only recover if strictly a corrupted patient record with zero clinic associations
    if (existingUser.role !== 'patient' && hasPatientAccount && hasNoClinicAtAll) {
      existingUser.role = 'patient';
      updates.role = 'patient';
      existingUser.user_type = 'patient';
      updates.user_type = 'patient';
      const genCode = generateReadableId('PAT', canonicalDocId);
      existingUser.id_number = genCode;
      existingUser.display_id = genCode;
      updates.id_number = genCode;
      updates.display_id = genCode;
    }
  }

  // 2. Unassigned roles get proper default according to portal
  if (!existingUser.role || (existingUser.role as any) === 'unassigned') {
    const defaultRole: Role = isAdminPortal ? 'company_admin' : (isClinicPortal ? 'clinic_admin' : 'patient');
    updates.role = defaultRole;
    existingUser.role = defaultRole;
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
  
  if (!existingUser.user_type) {
    const roleToCheck = updates.role || existingUser.role;
    const isClinicRole = ['clinic_admin', 'clinic_doctor', 'clinic_staff'].includes(roleToCheck);
    const isAdminRole = ['company_admin', 'company_manager', 'company_staff'].includes(roleToCheck);
    updates.user_type = isAdminRole ? 'company_admin' : (isClinicRole ? 'clinic_admin' : 'patient');
  }
  const currentEffectiveRole = updates.role || existingUser.role;
  const isFinalAdminRole = ['company_admin', 'company_manager', 'company_staff', 'super_admin'].includes(currentEffectiveRole);
  if (isFinalAdminRole) {
    if (existingUser.patient_account_id) {
      delete existingUser.patient_account_id;
      updates.patient_account_id = deleteField();
    }
    // Delete any patient_accounts document for this admin in Firestore
    deleteDoc(doc(db, 'patient_accounts', `pat_${canonicalDocId}`)).catch(() => {});
    if (firebaseUser.uid && firebaseUser.uid !== canonicalDocId) {
      deleteDoc(doc(db, 'patient_accounts', `pat_${firebaseUser.uid}`)).catch(() => {});
    }
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

  // Load associated Clinic (For clinic_admin, doctor, staff)
  let clinic: Clinic | null = null;
  if (existingUser.role !== 'patient' && existingUser.clinic_id) {
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

  if (clinic && existingUser.role !== 'patient') {
    const candidateClinicPhone = existingUser.phone || candidatePhone || clinic.phone;
    const candidateClinicEmail = existingUser.email || candidateEmail || clinic.email;
    const clinicUpdates: Record<string, any> = {};
    if (!clinic.phone && candidateClinicPhone) {
      clinic.phone = candidateClinicPhone;
      clinicUpdates.phone = candidateClinicPhone;
    }
    if (!clinic.email && candidateClinicEmail) {
      clinic.email = candidateClinicEmail;
      clinicUpdates.email = candidateClinicEmail;
    }
    if (Object.keys(clinicUpdates).length > 0) {
      clinicUpdates.updated_at = new Date().toISOString();
      updateDoc(doc(db, 'clinics', clinic.clinic_id), sanitizeForFirestore(clinicUpdates)).catch(() => {});
    }

    if (existingUser.clinic_id !== clinic.clinic_id) {
      existingUser.clinic_id = clinic.clinic_id;
      try {
        await updateDoc(doc(db, 'users', canonicalDocId), {
          clinic_id: clinic.clinic_id,
          updated_at: new Date().toISOString(),
        });
      } catch {}
    }
  }

  // Load Patient Account if patient or patient attendant
  let patientAccount: PatientAccount | null = null;
  if (existingUser.role === 'patient' || (existingUser.role as any) === 'patient_attendant') {
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

    // Fallback 1: Query by primary phone
    if (!patientAccount && existingUser.phone) {
      try {
        const qP = query(collection(db, 'patient_accounts'), where('phone', '==', existingUser.phone));
        const pSnap = await getDocs(qP);
        if (!pSnap.empty) {
          patientAccount = { ...pSnap.docs[0].data(), account_id: pSnap.docs[0].id } as PatientAccount;
        }
      } catch (e) {
        console.warn('Query patient accounts by phone warning:', e);
      }
    }

    // Fallback 2: Query by email (e.g. Google Sign-In)
    if (!patientAccount && existingUser.email) {
      try {
        const qE = query(collection(db, 'patient_accounts'), where('email', '==', existingUser.email.toLowerCase()));
        const eSnap = await getDocs(qE);
        if (!eSnap.empty) {
          patientAccount = { ...eSnap.docs[0].data(), account_id: eSnap.docs[0].id } as PatientAccount;
        }
      } catch (e) {
        console.warn('Query patient accounts by email warning:', e);
      }
    }

    // Fallback 3: Query by attendant / emergency contact phone
    const attPhone = existingUser.attender_phone || (existingUser as any).emergency_contact_phone;
    if (!patientAccount && attPhone) {
      try {
        const qAtt = query(collection(db, 'patient_accounts'), where('attender_phone', '==', attPhone));
        const aSnap = await getDocs(qAtt);
        if (!aSnap.empty) {
          patientAccount = { ...aSnap.docs[0].data(), account_id: aSnap.docs[0].id } as PatientAccount;
        } else {
          const qEm = query(collection(db, 'patient_accounts'), where('emergency_contact_phone', '==', attPhone));
          const emSnap = await getDocs(qEm);
          if (!emSnap.empty) {
            patientAccount = { ...emSnap.docs[0].data(), account_id: emSnap.docs[0].id } as PatientAccount;
          }
        }
      } catch (e) {
        console.warn('Query patient accounts by attender phone warning:', e);
      }
    }

    // Cross-sync missing identifiers between existingUser and patientAccount
    if (patientAccount) {
      const patSyncUpdates: Record<string, any> = {};
      const userSyncUpdates: Record<string, any> = {};

      if (existingUser.phone && !patientAccount.phone) {
        patSyncUpdates.phone = existingUser.phone;
        patientAccount.phone = existingUser.phone;
      }
      if (existingUser.email && !patientAccount.email) {
        patSyncUpdates.email = existingUser.email.toLowerCase();
        patientAccount.email = existingUser.email.toLowerCase();
      }
      if (patientAccount.phone && !existingUser.phone) {
        userSyncUpdates.phone = patientAccount.phone;
        existingUser.phone = patientAccount.phone;
      }
      if (patientAccount.email && !existingUser.email) {
        userSyncUpdates.email = patientAccount.email.toLowerCase();
        existingUser.email = patientAccount.email.toLowerCase();
      }
      if ((patientAccount as any).attender_phone && !existingUser.attender_phone) {
        userSyncUpdates.attender_phone = (patientAccount as any).attender_phone;
        userSyncUpdates.emergency_contact_phone = (patientAccount as any).attender_phone;
        existingUser.attender_phone = (patientAccount as any).attender_phone;
      }

      if (Object.keys(patSyncUpdates).length > 0) {
        patSyncUpdates.updated_at = new Date().toISOString();
        updateDoc(doc(db, 'patient_accounts', patientAccount.account_id), patSyncUpdates).catch(() => {});
      }
      if (Object.keys(userSyncUpdates).length > 0) {
        userSyncUpdates.updated_at = new Date().toISOString();
        updateDoc(doc(db, 'users', canonicalDocId), userSyncUpdates).catch(() => {});
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

      // Retroactively link any past appointments booked with this mobile number
      const patPhone = patientAccount?.phone || existingUser.phone;
      if (patPhone && patientAccount?.account_id) {
        claimPastAppointmentsForPhone(patPhone, patientAccount.account_id).catch(() => {});
      }
    }

    // Patients only connect to clinics if their patient account explicitly has a chosen clinic_id
    if (patientAccount?.clinic_id) {
      try {
        const cSnap = await getDoc(doc(db, 'clinics', patientAccount.clinic_id));
        if (cSnap.exists()) {
          clinic = { ...cSnap.data(), clinic_id: cSnap.id } as Clinic;
        }
      } catch (e) {
        console.warn('Read patient clinic warning:', e);
      }
    } else {
      clinic = null;
      if (existingUser.clinic_id) {
        existingUser.clinic_id = '';
      }
    }
  }

  // For existing patients/clinics, verify whether onboarding was genuinely completed
  // Avoid forcing returning Google or email users through redundant onboarding
  const isProfileActuallyComplete = existingUser.role === 'clinic_admin'
    ? Boolean(existingUser.clinic_setup_complete === true)
    : existingUser.role !== 'patient' 
      ? Boolean(existingUser.clinic_id || existingUser.clinic_setup_complete !== false)
      : (
          Boolean(
            (existingUser.profile_completed === true || patientAccount?.profile_completed === true) &&
            (existingUser.phone || patientAccount?.phone)
          ) ||
          Boolean(
            (patientAccount?.dob || patientAccount?.gender || patientAccount?.blood_group) &&
            (existingUser.phone || patientAccount?.phone)
          )
        );

  if (existingUser.role !== 'patient') {
    if (existingUser.profile_completed !== true) {
      existingUser.profile_completed = isProfileActuallyComplete;
      try {
        await updateDoc(doc(db, 'users', canonicalDocId), { profile_completed: isProfileActuallyComplete, updated_at: new Date().toISOString() });
      } catch {}
    }
  } else {
    existingUser.profile_completed = isProfileActuallyComplete;
    if (patientAccount) {
      patientAccount.profile_completed = isProfileActuallyComplete;
    }
  }

  return {
    user: { ...existingUser, user_id: canonicalDocId, role_selected: true, profile_completed: isProfileActuallyComplete },
    clinic,
    patientAccount: patientAccount ? {
      ...patientAccount,
      profile_completed: isProfileActuallyComplete,
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
  onboardingData?: OnboardingData,
  isClinicPortal: boolean = false,
  isAdminPortal: boolean = false
): Promise<IdentityResult> {
  let role: Role = onboardingData?.role === 'patient'
    ? 'patient'
    : (onboardingData?.role as any) === 'unassigned'
      ? (isAdminPortal ? 'company_admin' : (isClinicPortal ? 'clinic_admin' : 'patient'))
      : (onboardingData?.role || (isAdminPortal ? 'company_admin' : (isClinicPortal ? 'clinic_admin' : 'patient')));
  const name = onboardingData?.name || firebaseUser.displayName || email.split('@')[0] || (phone ? `User ${phone.slice(-4)}` : 'User');

  // CRITICAL: Google Sign-In is EXCLUSIVELY for Patient accounts
  if (isGoogleProvider && role !== 'patient') {
    throw new Error('Google Sign-In is only permitted for Patient accounts. Clinic Staff and Administrators must register and sign in using Email and Password.');
  }

  // PORTAL ROLE CHECKS ON REGISTRATION:
  if (isClinicPortal && email) {
    try {
      const qPatEmail = query(collection(db, 'patient_accounts'), where('email', '==', email));
      const patSnap = await getDocs(qPatEmail);
      if (!patSnap.empty) {
        throw new Error('This Google account is already registered as a Patient. The Clinic Portal requires a Clinic Staff or Clinic Admin account. Please sign in via the Patient Portal (/login), or use a registered Clinic account.');
      }
    } catch (e: any) {
      if (e.message?.includes('already registered as a Patient')) throw e;
    }
  }

  if (!isClinicPortal && email) {
    try {
      const qClinicEmail = query(collection(db, 'users'), where('email', '==', email));
      const clinicSnap = await getDocs(qClinicEmail);
      if (!clinicSnap.empty) {
        const d = clinicSnap.docs[0].data() as User;
        if (['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff', 'company_admin'].includes(d.role)) {
          throw new Error('This Google account is already registered as a Clinic account. The Patient Portal only accepts Patient accounts. Please sign in via the Clinic Portal (/clinic/login).');
        }
      }
    } catch (e: any) {
      if (e.message?.includes('already registered as a Clinic')) throw e;
    }
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
        documents_uploaded: false,
        verification_status: 'unverified',
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
      documents_uploaded: false,
      verification_status: 'unverified',
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

  const hasExplicitRole = Boolean(onboardingData?.role) || isClinicPortal;
  
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
    phone_verified: onboardingData?.phone_verified ?? Boolean(phone),
    email_verified: onboardingData?.email_verified ?? Boolean(firebaseUser.emailVerified),
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
    clinic_documents_uploaded: role === 'clinic_admin' ? false : undefined,
    clinic_verification_status: role === 'clinic_admin' ? 'unverified' : undefined,
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
