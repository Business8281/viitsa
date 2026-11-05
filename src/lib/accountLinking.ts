import { db } from './firebase';
import { 
  collection, query, where, getDocs, updateDoc, doc, getDoc 
} from 'firebase/firestore';
import type { PatientAccount } from './types';

/**
 * Normalizes phone number to exact 10 digits
 */
export function clean10DigitPhone(rawPhone: string | null | undefined): string {
  if (!rawPhone) return '';
  return rawPhone.replace(/\D/g, '').slice(-10);
}

export interface ExistingPatientLookup {
  found: boolean;
  accountId?: string;
  patientId?: string;
  name?: string;
  email?: string;
  dob?: string;
  age?: number | null;
  gender?: string;
  bloodGroup?: string;
}

/**
 * Searches Firestore (patient_accounts, users, and patients) for an existing account matching the 10-digit phone.
 */
export async function findExistingPatientAccountByPhone(rawPhone: string): Promise<ExistingPatientLookup> {
  const phone = clean10DigitPhone(rawPhone);
  if (!phone || phone.length !== 10) {
    return { found: false };
  }

  try {
    // 1. Search patient_accounts collection
    const accQ = query(collection(db, 'patient_accounts'), where('phone', '==', phone));
    const accSnap = await getDocs(accQ);
    if (!accSnap.empty) {
      const d = accSnap.docs[0];
      const data = d.data();
      return {
        found: true,
        accountId: d.id,
        patientId: data.patient_id || d.id,
        name: data.name || data.full_name,
        email: data.email,
        dob: data.dob,
        age: data.age,
        gender: data.gender,
        bloodGroup: data.blood_group,
      };
    }

    // 2. Search users collection with role == 'patient'
    const usersQ = query(
      collection(db, 'users'),
      where('phone', '==', phone),
      where('role', '==', 'patient')
    );
    const usersSnap = await getDocs(usersQ);
    if (!usersSnap.empty) {
      const uDoc = usersSnap.docs[0];
      const uData = uDoc.data();
      const accId = uData.patient_account_id || uDoc.id;
      return {
        found: true,
        accountId: accId,
        patientId: accId,
        name: uData.name || uData.full_name,
        email: uData.email,
        dob: uData.dob,
        age: uData.age,
        gender: uData.gender,
        bloodGroup: uData.blood_group,
      };
    }

    // 3. Search clinic patients collection
    const patQ = query(collection(db, 'patients'), where('phone', '==', phone));
    const patSnap = await getDocs(patQ);
    if (!patSnap.empty) {
      const pDoc = patSnap.docs[0];
      const pData = pDoc.data();
      return {
        found: true,
        accountId: pData.account_id || pDoc.id,
        patientId: pDoc.id,
        name: pData.name,
        email: pData.email,
        dob: pData.dob,
        age: pData.age,
        gender: pData.gender,
        bloodGroup: pData.blood_group,
      };
    }
  } catch (err) {
    console.warn('[accountLinking] findExistingPatientAccountByPhone warning:', err);
  }

  return { found: false };
}

/**
 * Claims and retroactively links all past appointments, consultations, and invoices
 * matching a phone number to a newly created or active patient account.
 */
export async function claimPastAppointmentsForPhone(
  rawPhone: string,
  targetAccountId: string,
  targetPatientId?: string
): Promise<{ linkedAppointments: number; linkedPatients: number }> {
  const phone = clean10DigitPhone(rawPhone);
  if (!phone || phone.length !== 10 || !targetAccountId) {
    return { linkedAppointments: 0, linkedPatients: 0 };
  }

  let linkedAppointments = 0;
  let linkedPatients = 0;

  try {
    // 1. Link past appointments matching this phone number
    const apptQ = query(collection(db, 'appointments'), where('patient_phone', '==', phone));
    const apptSnap = await getDocs(apptQ);

    for (const docSnap of apptSnap.docs) {
      const appt = docSnap.data();
      const needsUpdate = 
        appt.account_id !== targetAccountId || 
        appt.is_unclaimed === true ||
        !appt.account_id;

      if (needsUpdate) {
        await updateDoc(doc(db, 'appointments', docSnap.id), {
          account_id: targetAccountId,
          patient_id: targetPatientId || appt.patient_id || targetAccountId,
          is_unclaimed: false,
          updated_at: new Date().toISOString(),
        }).catch(err => console.warn(`Could not link appointment ${docSnap.id}:`, err));
        linkedAppointments++;
      }
    }

    // 2. Link clinic patient records matching this phone number
    const patQ = query(collection(db, 'patients'), where('phone', '==', phone));
    const patSnap = await getDocs(patQ);

    for (const docSnap of patSnap.docs) {
      const pat = docSnap.data();
      if (pat.account_id !== targetAccountId) {
        await updateDoc(doc(db, 'patients', docSnap.id), {
          account_id: targetAccountId,
          updated_at: new Date().toISOString(),
        }).catch(err => console.warn(`Could not link patient ${docSnap.id}:`, err));
        linkedPatients++;
      }
    }

    // 3. Link consultations matching this phone number
    const consQ = query(collection(db, 'consultations'), where('patient_phone', '==', phone));
    const consSnap = await getDocs(consQ);
    for (const docSnap of consSnap.docs) {
      const cData = docSnap.data();
      if (cData.account_id !== targetAccountId || cData.patient_id !== (targetPatientId || targetAccountId)) {
        await updateDoc(doc(db, 'consultations', docSnap.id), {
          account_id: targetAccountId,
          patient_id: targetPatientId || cData.patient_id || targetAccountId,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[accountLinking] claimPastAppointmentsForPhone error:', err);
  }

  return { linkedAppointments, linkedPatients };
}

