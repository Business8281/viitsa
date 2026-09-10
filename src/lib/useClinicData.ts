import { useEffect, useState, useCallback } from 'react';
import { db, DEFAULT_CLINIC_ID } from './firebase';
import { useAuth } from './auth';
import { localDateISO } from './format';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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

  // Real-time Firestore onSnapshot listeners for 100% live clinic data
  useEffect(() => {
    if (!clinic?.clinic_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const clinicId = clinic.clinic_id;

    let currentPatients: Patient[] = [];
    let currentUsers: User[] = [];
    let rawAppts: any[] = [];
    let rawBills: any[] = [];

    const recomputeApptsAndBills = () => {
      const mergedAppts = rawAppts.map((appt) => ({
        ...appt,
        patient: currentPatients.find((p) => p.patient_id === appt.patient_id) || null,
        doctor: currentUsers.find((u) => u.id === appt.doctor_id || u.user_id === appt.doctor_id) || null,
      } as Appointment)).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.token_number || 0) - (b.token_number || 0);
      });

      const mergedBills = rawBills.map((bill) => ({
        ...bill,
        patient: currentPatients.find((p) => p.patient_id === bill.patient_id) || null,
      } as Bill)).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      setAppointments(mergedAppts);
      setBills(mergedBills);
    };

    // 1. Live Patients listener
    const qPatients = query(collection(db, 'patients'), where('clinic_id', '==', clinicId));
    const unsubPatients = onSnapshot(qPatients, (snap) => {
      currentPatients = snap.docs.map((doc) => ({
        ...doc.data(),
        patient_id: doc.id,
      } as Patient)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setPatients(currentPatients);
      recomputeApptsAndBills();
      setLoading(false);
    }, (err) => {
      console.warn('Live patients snapshot error:', err);
      setLoading(false);
    });

    // 2. Live Users / Staff listener
    const qUsers = query(collection(db, 'users'), where('clinic_id', '==', clinicId));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      currentUsers = snap.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
        user_id: doc.id,
      } as User));
      recomputeApptsAndBills();
    }, (err) => {
      console.warn('Live users snapshot error:', err);
    });

    // 3. Live Inventory listener
    const qInventory = query(collection(db, 'inventory'), where('clinic_id', '==', clinicId));
    const unsubInventory = onSnapshot(qInventory, (snap) => {
      const inv = snap.docs.map((doc) => ({
        ...doc.data(),
        item_id: doc.id,
      } as InventoryItem)).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setInventory(inv);
    }, (err) => {
      console.warn('Live inventory snapshot error:', err);
    });

    // 4. Live Appointments listener
    const qAppointments = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId));
    const unsubAppointments = onSnapshot(qAppointments, (snap) => {
      rawAppts = snap.docs.map((doc) => ({
        ...doc.data(),
        appointment_id: doc.id,
      }));
      recomputeApptsAndBills();
    }, (err) => {
      console.warn('Live appointments snapshot error:', err);
    });

    // 5. Live Billing listener
    const qBilling = query(collection(db, 'billing'), where('clinic_id', '==', clinicId));
    const unsubBilling = onSnapshot(qBilling, (snap) => {
      rawBills = snap.docs.map((doc) => ({
        ...doc.data(),
        bill_id: doc.id,
      }));
      recomputeApptsAndBills();
    }, (err) => {
      console.warn('Live billing snapshot error:', err);
    });

    return () => {
      unsubPatients();
      unsubUsers();
      unsubInventory();
      unsubAppointments();
      unsubBilling();
    };
  }, [clinic?.clinic_id]);

  const refresh = useCallback(async () => {
    // onSnapshot automatically keeps data 100% fresh in real-time
  }, []);

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

export { DEFAULT_CLINIC_ID, DEFAULT_CLINIC_ID as DEMO_CLINIC_ID };

