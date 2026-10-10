import { useEffect, useState, useCallback, useMemo } from 'react';
import { db, DEFAULT_CLINIC_ID } from './firebase';
import { useAuth } from './auth';
import { localDateISO, parseDateArg } from './format';
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import type { Appointment, Bill, InventoryItem, Patient, User } from './types';

export interface ClinicData {
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

interface SharedStore {
  activeClinicId: string | null;
  appointments: Appointment[];
  patients: Patient[];
  inventory: InventoryItem[];
  bills: Bill[];
  loading: boolean;
  currentPatients: Patient[];
  currentUsers: User[];
  rawAppts: any[];
  rawBills: any[];
  rawInvoices: any[];
  rawAccounts: any[];
  unsubs: Unsubscribe[];
  subscribers: Set<() => void>;
  teardownTimeout: ReturnType<typeof setTimeout> | null;
}

const store: SharedStore = {
  activeClinicId: null,
  appointments: [],
  patients: [],
  inventory: [],
  bills: [],
  loading: true,
  currentPatients: [],
  currentUsers: [],
  rawAppts: [],
  rawBills: [],
  rawInvoices: [],
  rawAccounts: [],
  unsubs: [],
  subscribers: new Set(),
  teardownTimeout: null,
};

function notifySubscribers() {
  store.subscribers.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.error('Error notifying clinic store subscriber:', e);
    }
  });
}

function recomputePatients(targetClinicId: string) {
  const accountMapById = new Map<string, any>();
  const accountMapByPhone = new Map<string, any>();
  const accountMapByEmail = new Map<string, any>();

  store.rawAccounts.forEach((acc) => {
    if (acc.account_id) accountMapById.set(acc.account_id, acc);
    if (acc.auth_user_id) accountMapById.set(acc.auth_user_id, acc);
    if (acc.phone) {
      const p = acc.phone.replace(/\D/g, '');
      if (p) accountMapByPhone.set(p, acc);
    }
    if (acc.email) accountMapByEmail.set(acc.email.toLowerCase().trim(), acc);
  });

  const enriched = store.currentPatients.map((p) => {
    const cleanPhone = (p.phone || '').replace(/\D/g, '');
    const cleanEmail = (p.email || '').toLowerCase().trim();
    const acc =
      accountMapById.get(p.patient_id) ||
      (cleanPhone ? accountMapByPhone.get(cleanPhone) : null) ||
      (cleanEmail ? accountMapByEmail.get(cleanEmail) : null);

    const usr = store.currentUsers.find(
      (u) =>
        u.user_id === p.patient_id ||
        (cleanPhone && (u.phone || '').replace(/\D/g, '') === cleanPhone) ||
        (cleanEmail && (u.email || '').toLowerCase().trim() === cleanEmail)
    );

    return {
      ...p,
      address: p.address || acc?.address || usr?.address || null,
      blood_group: p.blood_group || acc?.blood_group || (usr as any)?.blood_group || null,
      dob: (p as any).dob || acc?.dob || (usr as any)?.dob || null,
      age: p.age ?? acc?.age ?? (usr as any)?.age ?? null,
      gender: p.gender || acc?.gender || (usr as any)?.gender || null,
      allergies: (p.allergies && p.allergies !== 'None') ? p.allergies : (acc?.allergies || (usr as any)?.allergies || 'None'),
      chronic_conditions: (p.chronic_conditions && p.chronic_conditions !== 'None') ? p.chronic_conditions : (acc?.chronic_conditions || (usr as any)?.chronic_conditions || 'None'),
      emergency_contact_name: p.emergency_contact_name || acc?.emergency_contact_name || (usr as any)?.emergency_contact_name || null,
      emergency_contact_phone: p.emergency_contact_phone || acc?.emergency_contact_phone || (usr as any)?.emergency_contact_phone || null,
      current_medications: (p as any).current_medications || acc?.current_medications || (usr as any)?.current_medications || [],
      display_id: p.display_id || p.patient_code || acc?.display_id || acc?.patient_code || (usr as any)?.display_id || null,
      patient_code: p.patient_code || acc?.patient_code || (usr as any)?.patient_code || null,
      created_at: (typeof p.created_at === 'string' && p.created_at) ? p.created_at : (acc?.created_at || (usr as any)?.created_at || new Date().toISOString()),
    } as Patient;
  });

  // Also include any patient accounts linked to this clinic that aren't yet in currentPatients
  store.rawAccounts.forEach((acc) => {
    const accClinicId = acc.clinic_id;
    if (accClinicId && accClinicId !== targetClinicId && targetClinicId !== DEFAULT_CLINIC_ID) {
      return;
    }
    const cleanPhone = (acc.phone || '').replace(/\D/g, '');
    const cleanEmail = (acc.email || '').toLowerCase().trim();
    const alreadyExists = enriched.some(
      (p) =>
        p.patient_id === acc.account_id ||
        (cleanPhone && (p.phone || '').replace(/\D/g, '') === cleanPhone) ||
        (cleanEmail && (p.email || '').toLowerCase().trim() === cleanEmail)
    );
    if (!alreadyExists) {
      enriched.push({
        patient_id: acc.account_id,
        clinic_id: acc.clinic_id || targetClinicId,
        name: acc.name || acc.full_name || 'Patient',
        full_name: acc.full_name || acc.name,
        age: acc.age ?? null,
        gender: acc.gender ?? null,
        phone: acc.phone ?? null,
        email: acc.email ?? null,
        blood_group: acc.blood_group ?? null,
        address: acc.address ?? null,
        allergies: acc.allergies || 'None',
        chronic_conditions: acc.chronic_conditions || 'None',
        emergency_contact_name: acc.emergency_contact_name ?? null,
        emergency_contact_phone: acc.emergency_contact_phone ?? null,
        display_id: acc.display_id || acc.patient_code || null,
        patient_code: acc.patient_code || null,
        created_at: acc.created_at || new Date().toISOString(),
        token_number: null,
      } as Patient);
    }
  });

  enriched.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  store.patients = enriched;
}

function recomputeApptsAndBills() {
  const mergedAppts = store.rawAppts
    .map((appt) => {
      const pId = appt.patient_id;
      return {
        ...appt,
        patient:
          store.patients.find((p) => p.patient_id === pId) ||
          store.currentPatients.find((p) => p.patient_id === pId) ||
          store.currentUsers.find(
            (u) =>
              u.id === pId ||
              u.user_id === pId ||
              `pat_${u.id}` === pId ||
              `pat_${u.user_id}` === pId ||
              u.patient_account_id === pId
          ) ||
          appt.patient ||
          null,
        doctor:
          store.currentUsers.find((u) => u.id === appt.doctor_id || u.user_id === appt.doctor_id) ||
          appt.doctor ||
          null,
      } as Appointment;
    })
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
      return (a.token_number || 0) - (b.token_number || 0);
    });

  // Combine billing docs with invoices docs so nothing is lost
  const processedBillIds = new Set<string>();
  const combinedBills: any[] = [];

  store.rawBills.forEach((b) => {
    const matchingInv = store.rawInvoices.find(
      (inv) =>
        (inv.bill_id && inv.bill_id === b.bill_id) ||
        (inv.appointment_id && b.appointment_id && inv.appointment_id === b.appointment_id) ||
        inv.invoice_id === b.bill_id
    );

    if (matchingInv) {
      processedBillIds.add(matchingInv.invoice_id);
      if (matchingInv.bill_id) processedBillIds.add(matchingInv.bill_id);
    }
    processedBillIds.add(b.bill_id);

    combinedBills.push({
      ...b,
      doctor_id: b.doctor_id || matchingInv?.doctor_id || null,
      invoice_number: b.invoice_number || matchingInv?.invoice_number || null,
      consultation_fee: b.consultation_fee || matchingInv?.consultation_fee,
      line_items: b.line_items || matchingInv?.line_items,
      visit_type: b.visit_type || matchingInv?.visit_type,
      invoice: matchingInv || null,
    });
  });

  // Include invoices that don't have a matching billing document
  store.rawInvoices.forEach((inv) => {
    if (!processedBillIds.has(inv.invoice_id) && (!inv.bill_id || !processedBillIds.has(inv.bill_id))) {
      processedBillIds.add(inv.invoice_id);
      combinedBills.push({
        bill_id: inv.invoice_id,
        clinic_id: inv.clinic_id,
        patient_id: inv.patient_id,
        appointment_id: inv.appointment_id || null,
        appt_id: inv.appointment_id || null,
        doctor_id: inv.doctor_id || null,
        amount: inv.amount || inv.total || inv.consultation_fee || 0,
        payment_status: inv.payment_status || 'paid',
        payment_method: inv.payment_method || 'cash',
        created_at: inv.created_at,
        invoice_number: inv.invoice_number,
        consultation_fee: inv.consultation_fee,
        line_items: inv.line_items,
        visit_type: inv.visit_type,
        invoice: inv,
      });
    }
  });

  const mergedBills = combinedBills
    .map((bill) => {
      const pId = bill.patient_id;
      const dId = bill.doctor_id;
      return {
        ...bill,
        patient:
          store.currentPatients.find((p) => p.patient_id === pId) ||
          store.currentUsers.find(
            (u) =>
              u.id === pId ||
              u.user_id === pId ||
              `pat_${u.id}` === pId ||
              `pat_${u.user_id}` === pId ||
              u.patient_account_id === pId
          ) ||
          bill.patient ||
          null,
        doctor: store.currentUsers.find((u) => u.id === dId || u.user_id === dId) || bill.doctor || null,
      } as Bill;
    })
    .sort((a, b) => (parseDateArg(b.created_at).getTime() || 0) - (parseDateArg(a.created_at).getTime() || 0));

  store.appointments = mergedAppts;
  store.bills = mergedBills;
  notifySubscribers();
}

function startListeners(targetClinicId: string) {
  // Clear any pending teardown
  if (store.teardownTimeout) {
    clearTimeout(store.teardownTimeout);
    store.teardownTimeout = null;
  }

  // Already listening to this clinic
  if (store.activeClinicId === targetClinicId && store.unsubs.length > 0) {
    return;
  }

  // If changing clinic, clean up existing listeners
  stopListenersImmediate();
  store.activeClinicId = targetClinicId;
  store.loading = true;

  // 1. Live Patients listener
  const unsubPatients = onSnapshot(
    collection(db, 'patients'),
    (snap) => {
      const docs = snap.docs.map(
        (doc) =>
          ({
            ...doc.data(),
            patient_id: doc.id,
          } as Patient)
      );
      store.currentPatients = docs
        .filter((p) => !p.clinic_id || p.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      recomputePatients(targetClinicId);
      store.loading = false;
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live patients snapshot warning:', err);
      store.loading = false;
      notifySubscribers();
    }
  );

  // 2. Live Users / Staff listener
  const unsubUsers = onSnapshot(
    collection(db, 'users'),
    (snap) => {
      const docs = snap.docs.map(
        (doc) =>
          ({
            ...doc.data(),
            id: doc.id,
            user_id: doc.id,
          } as User)
      );
      store.currentUsers = docs.filter(
        (u) => !u.clinic_id || u.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID
      );
      recomputePatients(targetClinicId);
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live users snapshot warning:', err);
    }
  );

  // 3. Live Inventory listener
  const unsubInventory = onSnapshot(
    collection(db, 'inventory'),
    (snap) => {
      const docs = snap.docs.map(
        (doc) =>
          ({
            ...doc.data(),
            item_id: doc.id,
          } as InventoryItem)
      );
      store.inventory = docs
        .filter((i) => !i.clinic_id || i.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      notifySubscribers();
    },
    (err) => {
      console.warn('Live inventory snapshot warning:', err);
    }
  );

  // 4. Live Appointments listener
  const unsubAppointments = onSnapshot(
    collection(db, 'appointments'),
    (snap) => {
      const docs = snap.docs.map((doc) => ({
        ...doc.data(),
        appointment_id: doc.id,
        appt_id: doc.id,
      }));
      store.rawAppts = (docs as any[]).filter(
        (a) => !a.clinic_id || a.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID
      );
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live appointments snapshot warning:', err);
    }
  );

  // 5. Live Billing listener
  const unsubBilling = onSnapshot(
    collection(db, 'billing'),
    (snap) => {
      const docs = snap.docs.map((doc) => ({
        ...doc.data(),
        bill_id: doc.id,
      }));
      store.rawBills = (docs as any[]).filter(
        (b) => !b.clinic_id || b.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID
      );
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live billing snapshot warning:', err);
    }
  );

  // 6. Live Invoices listener
  const unsubInvoices = onSnapshot(
    collection(db, 'invoices'),
    (snap) => {
      const docs = snap.docs.map((doc) => ({
        ...doc.data(),
        invoice_id: doc.id,
      }));
      store.rawInvoices = (docs as any[]).filter(
        (inv) => !inv.clinic_id || inv.clinic_id === targetClinicId || targetClinicId === DEFAULT_CLINIC_ID
      );
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live invoices snapshot warning:', err);
    }
  );

  // 7. Live Patient Accounts listener
  const unsubPatientAccounts = onSnapshot(
    collection(db, 'patient_accounts'),
    (snap) => {
      const docs = snap.docs.map((doc) => ({
        ...doc.data(),
        account_id: doc.id,
      }));
      store.rawAccounts = docs;
      recomputePatients(targetClinicId);
      recomputeApptsAndBills();
    },
    (err) => {
      console.warn('Live patient_accounts snapshot warning:', err);
    }
  );

  store.unsubs = [
    unsubPatients,
    unsubUsers,
    unsubInventory,
    unsubAppointments,
    unsubBilling,
    unsubInvoices,
    unsubPatientAccounts,
  ];
}

function stopListenersImmediate() {
  store.unsubs.forEach((u) => {
    try {
      u();
    } catch {}
  });
  store.unsubs = [];
  store.activeClinicId = null;
}

function scheduleTeardown() {
  if (store.teardownTimeout) clearTimeout(store.teardownTimeout);
  // Keep subscriptions active for 60 seconds across tab switches for instant 0ms transitions
  store.teardownTimeout = setTimeout(() => {
    if (store.subscribers.size === 0) {
      stopListenersImmediate();
    }
  }, 60000);
}

export function useClinicData(): ClinicData {
  const { clinic, user } = useAuth();
  const activeClinicId = clinic?.clinic_id || user?.clinic_id || DEFAULT_CLINIC_ID;

  // Local state initialized instantly from shared cache
  const [, setTick] = useState(0);

  useEffect(() => {
    startListeners(activeClinicId);

    const onUpdate = () => setTick((t) => t + 1);
    store.subscribers.add(onUpdate);

    return () => {
      store.subscribers.delete(onUpdate);
      if (store.subscribers.size === 0) {
        scheduleTeardown();
      }
    };
  }, [activeClinicId]);

  const refresh = useCallback(async () => {
    // Realtime listeners continuously keep data 100% synchronized
  }, []);

  const todayISO = localDateISO();
  const todayAppointments = useMemo(
    () => store.appointments.filter((a) => a.date === todayISO),
    [store.appointments, todayISO]
  );
  const urgentQueue = useMemo(
    () => todayAppointments.filter((a) => a.triage_level === 'urgent' && a.status !== 'done' && a.status !== 'cancelled'),
    [todayAppointments]
  );
  const pendingBills = useMemo(
    () => store.bills.filter((b) => b.payment_status !== 'paid'),
    [store.bills]
  );
  const criticalInventory = useMemo(
    () => store.inventory.filter((i) => i.quantity <= 0 || i.quantity <= i.reorder_level * 0.5),
    [store.inventory]
  );

  return {
    appointments: store.appointments,
    patients: store.patients,
    inventory: store.inventory,
    bills: store.bills,
    loading: store.loading && store.appointments.length === 0 && store.patients.length === 0,
    refresh,
    todayAppointments,
    urgentQueue,
    pendingBills,
    criticalInventory,
  };
}

export { DEFAULT_CLINIC_ID, DEFAULT_CLINIC_ID as DEMO_CLINIC_ID };
