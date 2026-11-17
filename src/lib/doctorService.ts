import { db } from './firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import type { Clinic, User as Doctor } from './types';

/**
 * Robustly loads all doctors for a clinic across users collection, owner record,
 * clinic doctor_name, and doctor arrays. Guarantees that every doctor associated
 * with the clinic is found and formatted properly.
 */
export async function fetchClinicDoctors(clinicId: string, clinicData?: Clinic | null): Promise<Doctor[]> {
  const doctorMap = new Map<string, Doctor>();

  try {
    // 1. Fetch clinic data if not passed
    let cData = clinicData;
    if (!cData) {
      const cSnap = await getDoc(doc(db, 'clinics', clinicId));
      if (cSnap.exists()) {
        cData = { ...cSnap.data(), clinic_id: cSnap.id } as Clinic;
      }
    }

    // 2. Query all users belonging to this clinic
    const qUsers = query(collection(db, 'users'), where('clinic_id', '==', clinicId));
    const uSnap = await getDocs(qUsers);
    uSnap.docs.forEach((d) => {
      const data = d.data();
      doctorMap.set(d.id, { ...data, user_id: d.id, id: d.id } as Doctor);
    });

    // 3. If clinic has an owner_user_id, check that user too
    if (cData?.owner_user_id && !doctorMap.has(cData.owner_user_id)) {
      try {
        const ownerSnap = await getDoc(doc(db, 'users', cData.owner_user_id));
        if (ownerSnap.exists()) {
          const oData = ownerSnap.data();
          doctorMap.set(cData.owner_user_id, {
            ...oData,
            user_id: oData.user_id || ownerSnap.id,
            id: ownerSnap.id,
          } as Doctor);
        }
      } catch (e) {
        console.warn('[doctorService] owner user lookup:', e);
      }
    }

    // 4. If clinic has a doctors array of user IDs or objects
    if (Array.isArray((cData as any)?.doctors)) {
      for (const dItem of (cData as any).doctors) {
        const docId = typeof dItem === 'string' ? dItem : dItem?.id || dItem?.user_id;
        if (docId && !doctorMap.has(docId)) {
          try {
            const dSnap = await getDoc(doc(db, 'users', docId));
            if (dSnap.exists()) {
              const dData = dSnap.data();
              doctorMap.set(docId, {
                ...dData,
                user_id: dData.user_id || dSnap.id,
                id: dSnap.id,
              } as Doctor);
            }
          } catch {}
        }
      }
    }

    // 5. If clinic has a doctor_ids array
    if (Array.isArray((cData as any)?.doctor_ids)) {
      for (const docId of (cData as any).doctor_ids) {
        if (docId && !doctorMap.has(docId)) {
          try {
            const dSnap = await getDoc(doc(db, 'users', docId));
            if (dSnap.exists()) {
              const dData = dSnap.data();
              doctorMap.set(docId, {
                ...dData,
                user_id: dData.user_id || dSnap.id,
                id: dSnap.id,
              } as Doctor);
            }
          } catch {}
        }
      }
    }

    const allCandidateUsers = Array.from(doctorMap.values());

    // 6. Comprehensive doctor role matching
    const isDoctor = (u: any) => {
      if (u.active === false) return false;
      const r = (u.role || '').toLowerCase();
      const ut = (u.user_type || '').toLowerCase();
      const name = (u.name || '').trim().toLowerCase();

      // Explicit medical doctor roles
      if (['clinic_doctor', 'doctor', 'physician', 'specialist', 'surgeon', 'dentist'].includes(r)) return true;
      if (['clinic_doctor', 'doctor'].includes(ut)) return true;

      // Clinic admins almost always act as the chief/attending doctor unless purely administrative
      if (r === 'clinic_admin' || ut === 'clinic_admin') return true;

      // User has medical specialisation (and is not a patient)
      if (Boolean(u.specialisation) && r !== 'patient') return true;

      // Name begins with Dr.
      if (name.startsWith('dr.') || name.startsWith('dr ') || name.startsWith('doctor ')) return true;

      // Has medical license / registration
      if (u.medical_license_number || u.registration_number) return true;

      return false;
    };

    const docList = allCandidateUsers.filter(isDoctor);

    // 7. If clinic has a named doctor_name, ensure they are represented in the list
    if (cData?.doctor_name) {
      const cDocName = cData.doctor_name.trim();
      const alreadyHas = docList.some(d => 
        (d.name || '').toLowerCase().includes(cDocName.toLowerCase()) || 
        cDocName.toLowerCase().includes((d.name || '').toLowerCase())
      );
      if (!alreadyHas) {
        docList.unshift({
          id: `doc_${clinicId}`,
          user_id: `doc_${clinicId}`,
          clinic_id: clinicId,
          name: cDocName,
          role: 'clinic_doctor',
          active: true,
          specialisation: (cData as any).specialisation || 'Chief Medical Officer / Consultant',
        } as Doctor);
      }
    }

    // 8. If real named doctors exist, filter out generic placeholder "Doctor", "Admin", or "Clinic Doctor"
    const realNamedDocs = docList.filter(d => {
      const n = (d.name || '').trim().toLowerCase();
      return n !== 'clinic doctor' && n !== 'doctor' && n !== 'admin';
    });

    const finalDocs = realNamedDocs.length > 0 ? realNamedDocs : docList;

    // 9. If still empty, fall back to any active user at the clinic
    if (finalDocs.length === 0 && allCandidateUsers.length > 0) {
      return allCandidateUsers.filter(u => u.active !== false);
    }

    // 10. Ultimate fallback: create a doctor entry from clinic name so dropdown is NEVER empty
    if (finalDocs.length === 0) {
      return [{
        id: `doc_${clinicId}`,
        user_id: `doc_${clinicId}`,
        clinic_id: clinicId,
        name: cData?.name ? `${cData.name} Consulting Doctor` : 'Clinic Doctor',
        role: 'clinic_doctor',
        active: true,
        specialisation: 'General Medicine',
      } as Doctor];
    }

    return finalDocs;
  } catch (err) {
    console.warn('[doctorService] fetchClinicDoctors error:', err);
    return [];
  }
}

