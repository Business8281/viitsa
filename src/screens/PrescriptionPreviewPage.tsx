import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { PrescriptionView, type PrescriptionData } from '../components/PrescriptionView';
import { ArrowLeft, Loader2 } from 'lucide-react';

export function PrescriptionPreviewPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const consultId = searchParams.get('id') || searchParams.get('consultationId');
  const patientId = searchParams.get('patientId');

  const [loading, setLoading] = useState(Boolean(consultId || patientId));
  const [consultation, setConsultation] = useState<any | null>(null);
  const [patient, setPatient] = useState<any | null>(null);
  const [clinic, setClinic] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!consultId && !patientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        if (consultId) {
          const docSnap = await getDoc(doc(db, 'consultations', consultId));
          if (docSnap.exists() && isMounted) {
            const cData = { id: docSnap.id, ...docSnap.data() };
            setConsultation(cData);

            // Also load patient if patient_id exists
            const pId = (cData as any).patient_id;
            if (pId) {
              const pSnap = await getDoc(doc(db, 'patients', pId));
              if (pSnap.exists() && isMounted) {
                const patData: any = { id: pSnap.id, ...pSnap.data() };
                if ((!patData.age || !patData.dob) && patData.account_id) {
                  try {
                    const accSnap = await getDoc(doc(db, 'patient_accounts', patData.account_id));
                    if (accSnap.exists()) {
                      const accData: any = accSnap.data();
                      if (!patData.age && accData.age) patData.age = accData.age;
                      if (!patData.dob && accData.dob) patData.dob = accData.dob;
                    }
                  } catch (e) {
                    console.warn('Error fetching patient account details:', e);
                  }
                }
                setPatient(patData);
              }
            }

            // Also load clinic if clinic_id exists
            const clnId = (cData as any).clinic_id;
            if (clnId) {
              const clnSnap = await getDoc(doc(db, 'clinics', clnId));
              if (clnSnap.exists() && isMounted) {
                setClinic({ id: clnSnap.id, ...clnSnap.data() });
              }
            }
          }
        } else if (patientId) {
          const pSnap = await getDoc(doc(db, 'patients', patientId));
          if (pSnap.exists() && isMounted) {
            const patData: any = { id: pSnap.id, ...pSnap.data() };
            if ((!patData.age || !patData.dob) && patData.account_id) {
              try {
                const accSnap = await getDoc(doc(db, 'patient_accounts', patData.account_id));
                if (accSnap.exists()) {
                  const accData: any = accSnap.data();
                  if (!patData.age && accData.age) patData.age = accData.age;
                  if (!patData.dob && accData.dob) patData.dob = accData.dob;
                }
              } catch (e) {
                console.warn('Error fetching patient account details:', e);
              }
            }
            setPatient(patData);
          }

          // Fetch latest consultation for this patient
          const q = query(collection(db, 'consultations'), where('patient_id', '==', patientId), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty && isMounted) {
            setConsultation({ id: snap.docs[0].id, ...snap.docs[0].data() });
          }
        }
      } catch (err) {
        console.error('Failed to load prescription data for preview:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [consultId, patientId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-slate-600">
        <Loader2 className="w-8 h-8 animate-spin text-[#0F6E56] mb-3" />
        <p className="text-sm font-semibold">Loading Doctor Prescription...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/90 py-6">
      {/* Return button for screen view */}
      <div className="no-print max-w-[210mm] mx-auto mb-3 px-2 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <span className="text-xs text-slate-500 font-medium">
          A4 Standard Doctor Prescription Document
        </span>
      </div>

      <PrescriptionView
        consultation={consultation}
        patient={patient}
        clinic={clinic}
        standalone={true}
        onClose={() => navigate(-1)}
      />
    </div>
  );
}
export default PrescriptionPreviewPage;
