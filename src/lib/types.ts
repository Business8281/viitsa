import type { TriageSummary } from './aiService';

export type Role = 'company_admin' | 'admin' | 'doctor' | 'staff' | 'patient';
export type TriageLevel = 'normal' | 'moderate' | 'urgent';
export type ApptStatus = 'waiting' | 'in-progress' | 'done' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'partial';
export type PaymentMethod = 'cash' | 'upi' | 'card';
export type VisitType = 'walk-in' | 'scheduled';
export type AppointmentVisitType = 'new-visit' | 'follow-up' | 'report-discussion';

export interface Clinic {
  clinic_id: string;
  name: string;
  clinic_code?: string;
  id_number?: string;
  display_id?: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  logo_url: string | null;
  owner_name: string | null;
  owner_user_id?: string | null;
  departments?: string[];
  rating?: number;
  working_hours: { open: string; close: string; days: string[] };
  created_at: string;
  updated_at?: string;
}

export interface User {
  id?: string;
  user_id: string;
  clinic_id?: string | null;
  name: string;
  full_name?: string;
  email: string;
  password_hash?: string;
  role: Role;
  user_type?: 'patient' | 'clinic_admin' | 'company_admin' | 'doctor' | 'staff';
  id_number?: string;
  display_id?: string;
  clinic_name?: string;
  phone: string | null;
  specialisation: string | null;
  active: boolean;
  avatar_color: string;
  created_at: string;
  updated_at?: string;
  linked_uids?: string[];
  auth_providers?: string[];
  patient_account_id?: string | null;
  profile_completed?: boolean;
  role_selected?: boolean;
}

export interface Patient {
  patient_id: string;
  id_number?: string;
  display_id?: string;
  patient_code?: string;
  clinic_id: string;
  name: string;
  full_name?: string;
  age: number | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  phone: string | null;
  email: string | null;
  blood_group: string | null;
  address: string | null;
  allergies: string;
  chronic_conditions: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  token_number: number | null;
  created_at: string;
  updated_at?: string;
}

export interface PatientAccount {
  account_id: string;
  id_number?: string;
  display_id?: string;
  patient_code?: string;
  phone: string;
  name: string;
  full_name?: string;
  email: string | null;
  age: number | null;
  dob: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  blood_group: string | null;
  address: string | null;
  current_medications: string[] | null;
  allergies: string;
  chronic_conditions: string;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  otp_code: string;
  otp_verified: boolean;
  auth_user_id: string | null;
  clinic_id?: string | null;
  clinic_name?: string | null;
  profile_completed?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Appointment {
  appt_id: string;
  appointment_id?: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  date: string;
  time_slot: string;
  type: VisitType;
  status: ApptStatus;
  reason: string | null;
  triage_level: TriageLevel;
  notes: string | null;
  token_number: number | null;
  booked_via?: string;
  visit_type?: AppointmentVisitType;
  online_booking?: boolean;
  ai_summary?: TriageSummary | null;
  created_at: string;
  patient?: Patient;
  doctor?: User | null;
}

export interface Consultation {
  consult_id: string;
  appt_id: string;
  patient_id: string;
  doctor_id: string | null;
  symptoms: string;
  diagnosis: string;
  prescription: string;
  follow_up_date: string | null;
  notes: string;
  created_at: string;
}

export interface BillLineItem {
  description: string;
  amount: number;
}

export interface Bill {
  bill_id: string;
  clinic_id: string;
  patient_id: string;
  appt_id: string | null;
  appointment_id?: string | null;
  amount: number;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  doctor_id?: string | null;
  discount_amount?: number;
  discount_percent?: number;
  upi_ref?: string | null;
  expected_payment_date?: string | null;
  invoice_number?: string | null;
  consultation_fee?: number;
  visit_type?: string;
  notes?: string | null;
  created_at: string;
  patient?: Patient;
  doctor?: User | null;
}

export interface Invoice {
  invoice_id: string;
  invoice_number: string;
  bill_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  appt_id?: string | null;
  appointment_id?: string | null;
  subtotal: number;
  discount_amount: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: string;
  upi_ref: string | null;
  line_items: BillLineItem[];
  visit_date: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  patient?: Patient;
  doctor?: User | null;
  clinic?: Clinic | null;
}

export interface InventoryItem {
  item_id: string;
  clinic_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  supplier: string | null;
  cost_per_unit: number;
  created_at: string;
}

export interface AISession {
  session_id: string;
  patient_id: string;
  clinic_id: string;
  appt_id: string | null;
  symptoms_entered: string | null;
  ai_response: string | null;
  triage_level: TriageLevel;
  doctor_notified: boolean;
  conversation: { role: 'ai' | 'patient'; text: string }[];
  recommendations: { level: 'urgent' | 'caution' | 'informational'; text: string }[];
  created_at: string;
}

export interface Vital {
  vital_id: string;
  patient_id: string;
  clinic_id: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
  weight: number | null;
  recorded_at: string;
  created_at: string;
}

export interface ClinicSettings {
  setting_id: string;
  clinic_id: string;
  slot_duration_minutes: number;
  whatsapp_reminders_enabled: boolean;
  sms_reminders_enabled: boolean;
  upi_id?: string | null;
  upi_qr_url?: string | null;
  consultation_fee?: number;
}

export interface HealthReport {
  report_id: string;
  patient_id: string;
  account_id: string | null;
  clinic_id: string | null;
  report_type: string;
  report_date: string | null;
  hospital_or_doctor: string | null;
  key_findings: HealthFinding[];
  diagnosis: string | null;
  medications: { name: string; dosage: string; frequency: string }[];
  doctor_notes: string | null;
  summary: string | null;
  urgent_flags: string[];
  original_file_url: string | null;
  original_file_type: string | null;
  ai_processed: boolean;
  created_at: string;
}

export interface HealthFinding {
  name: string;
  value: string;
  unit: string;
  normal_range: string;
  is_abnormal: boolean;
}

export interface PatientNotification {
  notification_id: string;
  account_id: string;
  patient_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  action_url: string | null;
  created_at: string;
}
