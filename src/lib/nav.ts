import { LayoutDashboard, Users, Calendar, Receipt, Pill, BrainCircuit, BarChart3, Settings } from 'lucide-react';
import type { Role } from './types';

export type NavKey =
  | 'dashboard'
  | 'patients'
  | 'appointments'
  | 'billing'
  | 'inventory'
  | 'ai-navigator'
  | 'analytics'
  | 'settings';

export interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  roles: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['clinic_admin', 'clinic_doctor', 'clinic_staff'] },
  { key: 'patients', label: 'Patients', icon: Users, roles: ['clinic_admin', 'clinic_doctor', 'clinic_staff'] },
  { key: 'appointments', label: 'Appointments', icon: Calendar, roles: ['clinic_admin', 'clinic_doctor', 'clinic_staff'] },
  { key: 'billing', label: 'Billing', icon: Receipt, roles: ['clinic_admin', 'clinic_staff', 'clinic_doctor'] },
  { key: 'inventory', label: 'Inventory', icon: Pill, roles: ['clinic_admin', 'clinic_staff'] },
  { key: 'ai-navigator', label: 'AI Navigator', icon: BrainCircuit, roles: ['clinic_admin', 'clinic_doctor'] },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['clinic_admin'] },
  { key: 'settings', label: 'Settings', icon: Settings, roles: ['clinic_admin'] },
];
