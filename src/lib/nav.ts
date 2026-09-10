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
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['company_admin', 'admin', 'doctor', 'staff'] },
  { key: 'patients', label: 'Patients', icon: Users, roles: ['company_admin', 'admin', 'doctor', 'staff'] },
  { key: 'appointments', label: 'Appointments', icon: Calendar, roles: ['company_admin', 'admin', 'doctor', 'staff'] },
  { key: 'billing', label: 'Billing', icon: Receipt, roles: ['company_admin', 'admin', 'staff'] },
  { key: 'inventory', label: 'Inventory', icon: Pill, roles: ['company_admin', 'admin', 'staff'] },
  { key: 'ai-navigator', label: 'AI Navigator', icon: BrainCircuit, roles: ['company_admin', 'admin', 'doctor'] },
  { key: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['company_admin', 'admin'] },
  { key: 'settings', label: 'Settings', icon: Settings, roles: ['company_admin', 'admin'] },
];
