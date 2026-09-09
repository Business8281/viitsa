import { useEffect, useState, useCallback } from 'react';
import { supabase, DEMO_CLINIC_ID } from './supabase';
import { useAuth } from './auth';
import { localDateISO } from './format';
import type { Appointment, Bill, InventoryItem, Patient } from './types';

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
      const [appts, pats, inv, bils] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, patient:patients(*), doctor:users(*)')
          .eq('clinic_id', clinic.clinic_id)
          .order('date', { ascending: true })
          .order('token_number', { ascending: true }),
        supabase.from('patients').select('*').eq('clinic_id', clinic.clinic_id).order('name'),
        supabase.from('inventory').select('*').eq('clinic_id', clinic.clinic_id).order('name'),
        supabase
          .from('billing')
          .select('*, patient:patients(*)')
          .eq('clinic_id', clinic.clinic_id)
          .order('created_at', { ascending: false }),
      ]);
      setAppointments((appts.data as Appointment[] | null) ?? []);
      setPatients((pats.data as Patient[] | null) ?? []);
      setInventory((inv.data as InventoryItem[] | null) ?? []);
      setBills((bils.data as Bill[] | null) ?? []);
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
