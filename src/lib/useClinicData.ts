import { useEffect, useState, useCallback } from 'react';
import { db, DEMO_CLINIC_ID } from './firebase';
import { useAuth } from './auth';
import { localDateISO } from './format';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import type { Appointment, Bill, InventoryItem, Patient, User } from './types';

interface ClinicData {
  appointments: Appointment[];
  patients: Patient[];
  inventory: InventoryItem[];
  bills: Bill[];
  loading: boolean;
  refresh: () => Promise<void>;
  todayAppointments: Appointment[];
  urgentQueue: Appointment[];
  pendingBills: Bill[];
  criticalInventory: InventoryItem[];
}

export function useClinicData(): ClinicData {
  const { clinic } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!clinic) return;
    setLoading(true);
    try {
      const clinicId = clinic.clinic_id;

      const [apptsSnap, patsSnap, invSnap, bilsSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))),
        getDocs(query(collection(db, 'patients'), where('clinic_id', '==', clinicId))),
        getDocs(query(collection(db, 'inventory'), where('clinic_id', '==', clinicId))),
        getDocs(query(collection(db, 'billing'), where('clinic_id', '==', clinicId))),
        getDocs(query(collection(db, 'users'), where('clinic_id', '==', clinicId))),
      ]);

      const pats = patsSnap.docs.map(doc => ({ ...doc.data(), patient_id: doc.id } as Patient));
      const users = usersSnap.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
      const inv = invSnap.docs.map(doc => ({ ...doc.data(), item_id: doc.id } as InventoryItem));
      
      const appts = apptsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          appointment_id: doc.id,
          patient: pats.find(p => p.patient_id === data.patient_id) || null,
          doctor: users.find(u => u.id === data.doctor_id) || null,
        } as Appointment;
      }).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.token_number || 0) - (b.token_number || 0);
      });

      const bils = bilsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          bill_id: doc.id,
          patient: pats.find(p => p.patient_id === data.patient_id) || null,
        } as Bill;
      }).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      setPatients(pats.sort((a, b) => a.name.localeCompare(b.name)));
      setInventory(inv.sort((a, b) => a.name.localeCompare(b.name)));
      setAppointments(appts);
      setBills(bils);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [clinic]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const todayISO = localDateISO();
  const todayAppointments = appointments.filter((a) => a.date === todayISO);
  const urgentQueue = todayAppointments.filter((a) => a.triage_level === 'urgent' && a.status !== 'done' && a.status !== 'cancelled');
  const pendingBills = bills.filter((b) => b.payment_status !== 'paid');
  const criticalInventory = inventory.filter((i) => i.quantity <= 0 || i.quantity <= i.reorder_level * 0.5);

  return {
    appointments,
    patients,
    inventory,
    bills,
    loading,
    refresh,
    todayAppointments,
    urgentQueue,
    pendingBills,
    criticalInventory,
  };
}

export { DEMO_CLINIC_ID };
