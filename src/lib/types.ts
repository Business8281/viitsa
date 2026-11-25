import type { TriageSummary } from './aiService';

export type Role = 
  | 'company_admin' | 'company_manager' | 'company_staff'
  | 'clinic_admin' | 'clinic_doctor' | 'clinic_staff'
  | 'patient' | 'patient_attendant'
  | 'admin' | 'doctor' | 'staff';

export const ADMIN_ROLES: Role[] = ['company_admin', 'company_manager', 'company_staff', 'admin'];
export const CLINIC_ROLES: Role[] = ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'];
export const PATIENT_ROLES: Role[] = ['patient', 'patient_attendant'];

export type TriageLevel = 'normal' | 'moderate' | 'urgent';
export type ApptStatus = 'waiting' | 'in-progress' | 'done' | 'cancelled';
export type PaymentStatus = 'paid' | 'pending' | 'partial';
export type PaymentMethod = 'cash' | 'upi' | 'card';
export type VisitType = 'walk-in' | 'scheduled';
export type AppointmentVisitType = 'new-visit' | 'follow-up' | 'report-discussion';

export interface Clinic {
  id?: string;
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
  gstin?: string;
  registration_number?: string;
  owner_name: string | null;
  owner_user_id?: string | null;
  departments?: string[];
  speciality?: string | null;
  rating?: number;
  consultation_fee?: number | null;
  working_hours: { open: string; close: string; days: string[] };
  clinic_setup_complete?: boolean;
  documents_uploaded?: boolean;
  verification_status?: 'unverified' | 'pending' | 'approved' | 'rejected' | 'verified' | 'docs_needed';
  rejection_reason?: string;
  onboarding_documents?: { name: string; url: string }[];
  subscription_status?: 'pending' | 'active' | 'deactivated' | 'free_plan' | 'cancelled' | 'trial' | 'suspended' | 'payment_failed' | 'past_due';
  subscription_updated_at?: string;
  subscription_activated_at?: string;
  subscription_period_end?: string;
  subscription_billing_cycle?: 'monthly' | 'annual';
  subscription_deactivated_at?: string;
  subscription_cancelled_at?: string;
  subscription_plan?: string;
  subscription_auto_renew?: boolean;
  cancel_at_period_end?: boolean;
  cancel_effective_date?: string;
  cancellation_reason?: string;
  cancellation_feedback?: string;
  change_scheduled?: boolean;
  scheduled_plan?: string;
  scheduled_billing_cycle?: 'monthly' | 'annual';
  scheduled_change_type?: 'upgrade' | 'downgrade';
  scheduled_effective_date?: string;
  scheduled_at?: string;
  trial_used?: boolean;
  has_used_trial?: boolean;
  trial_completed?: boolean;
  trial_activated?: boolean;
  trial_status?: string;
  trial_started_at?: string;
  trial_ends_at?: string;
  doctor_name?: string | null;
  last_payment_id?: string | null;
  last_payment_status?: string;
  last_renewal_at?: string;
  razorpay_subscription_id?: string;
  whatsapp_reminders_enabled?: boolean;
  documents?: any;
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
  user_type?: 'patient' | 'clinic_admin' | 'company_admin' | 'clinic_doctor' | 'clinic_staff' | 'company_manager' | 'company_staff' | 'patient_attendant';
  id_number?: string;
  display_id?: string;
  clinic_name?: string;
  phone: string | null;
  phone_verified?: boolean;
  specialisation: string | null;
  designation?: string | null;
  experience_years?: number | null;
  consultation_fee?: number | null;
  qualifications?: string | null;
  address?: string | null;
  blood_group?: string | null;
  certificates?: { name: string; url: string; type?: string; uploaded_at?: string }[];
  onboarding_documents?: { name: string; url: string; type?: string; uploaded_at?: string }[];
  documents?: { name: string; url: string; type?: string; uploaded_at?: string }[];
  active: boolean;
  avatar_color: string;
  uid?: string;
  registration_number?: string;
  created_at: string;
  updated_at?: string;
  linked_uids?: string[];
  auth_providers?: string[];
  patient_account_id?: string | null;
  profile_completed?: boolean;
  role_selected?: boolean;
  clinic_setup_complete?: boolean;
  clinic_documents_uploaded?: boolean;
  clinic_verification_status?: 'unverified' | 'pending' | 'approved' | 'rejected';
  clinic_subscription_status?: 'pending' | 'active' | 'trial' | 'free_plan' | 'cancelled' | 'deactivated';
  email_verified?: boolean;
  verification_status?: 'pending' | 'approved' | 'rejected' | 'under_review';
  attender_name?: string | null;
  attender_phone?: string | null;
  chronic_conditions?: string | null;
  allergies?: string | null;
  current_medications?: string | string[] | null;
  dob?: string | null;
  age?: number | string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  gender?: 'Male' | 'Female' | 'Other' | string | null;
}

export interface Patient {
  patient_id: string;
  id_number?: string;
  display_id?: string;
  patient_code?: string;
  clinic_id: string;
  name: string;
  full_name?: string;
  status?: 'active' | 'left' | 'inactive';
  age: number | null;
  dob?: string | null;
  gender: 'Male' | 'Female' | 'Other' | null;
  phone: string | null;
  phone_verified?: boolean;
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
  id?: string;
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
  attender_name?: string | null;
  attender_phone?: string | null;
  otp_code: string;
  otp_verified: boolean;
  auth_user_id: string | null;
  clinic_id?: string | null;
  clinic_name?: string | null;
  profile_completed?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PatientClinicLink {
  link_id: string; // `${account_id}_${clinic_id}`
  account_id: string;
  patient_id?: string;
  clinic_id: string;
  clinic_name: string;
  clinic_address?: string;
  clinic_phone?: string;
  status: 'active' | 'authorized' | 'connected' | 'revoked';
  is_current_active: boolean;
  consent_share_history: boolean;
  created_at: string;
  updated_at: string;
  last_switched_at?: string;
}

export interface AuditEvent {
  log_id?: string;
  id?: string;
  event_id?: string;
  event_type?: string;
  action?: 'CLINIC_SWITCHED' | 'CLINIC_LINK_CREATED' | 'CONSENT_UPDATED' | 'CONSULTATION_CREATED' | 'PRESCRIPTION_CREATED' | 'RECORD_ACCESSED' | 'CROSS_CLINIC_ACCESS_BLOCKED' | 'CLINICAL_RECORD_CREATED' | string;
  actor_id: string;
  actor_name?: string;
  actor_role: string;
  patient_id?: string;
  patient_name?: string;
  clinic_id?: string;
  clinic_name?: string;
  target_clinic_id?: string;
  target_clinic_name?: string;
  target_resource_id?: string;
  target_resource_type?: string;
  resource_type?: string;
  resource_id?: string;
  details?: string;
  status: 'success' | 'denied' | 'warning' | 'blocked' | 'failure';
  metadata?: any;
  timestamp: string;
}

export interface Appointment {
  appt_id: string;
  appointment_id?: string;
  display_token?: string;
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
  chief_complaint?: string;
  ai_summary?: TriageSummary | null;
  created_at: string;
  patient?: Patient;
  doctor?: User | null;
  clinic?: Clinic | null;
}

export interface Consultation {
  consult_id: string;
  id?: string;
  appt_id?: string;
  appointment_id?: string;
  clinic_id?: string;
  clinic_name?: string;
  clinic?: Clinic | null;
  patient_id: string;
  patient_name?: string;
  patient_phone?: string;
  patient_age?: number | string | null;
  patient_dob?: string | null;
  doctor_id: string | null;
  doctor_name?: string;
  doctor?: User | null;
  symptoms: string;
  diagnosis: string;
  prescription: string;
  prescriptions?: any[];
  medicines?: any[];
  advice?: string | string[];
  recommended_tests?: string[];
  vitals?: any;
  follow_up_date: string | null;
  notes: string;
  created_at: string;
}

export interface BillLineItem {
  description: string;
  amount: number;
  category?: string;
  quantity?: number;
  unit_price?: number;
  rate?: number;
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
  id?: string;
  invoice_id: string;
  invoice_number: string;
  receipt_number?: string;
  bill_id: string;
  clinic_id: string;
  patient_id: string;
  doctor_id: string | null;
  appt_id?: string | null;
  appointment_id?: string | null;
  subtotal: number;
  discount_amount: number;
  amount?: number;
  total: number;
  payment_status: PaymentStatus;
  payment_method: string;
  upi_ref: string | null;
  line_items: BillLineItem[];
  visit_date: string | null;
  visit_type?: string;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
  total_amount?: number;
  category?: string;
  description?: string;
  discount?: number;
  tax?: number;
  tax_amount?: number;
  status?: string;
  amount_paid?: number;
  balance_due?: number;
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
  id?: string;
  patient_id: string;
  clinic_id: string;
  systolic_bp: number | null;
  diastolic_bp: number | null;
  bp_sys?: number | string | null;
  bp_dia?: number | string | null;
  blood_pressure?: string | null;
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
  holidays?: string[];
}

export interface HealthReport {
  report_id: string;
  patient_id: string;
  account_id: string | null;
  clinic_id: string | null;
  doctor_id?: string | null;
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

// ── Subscription & Entitlements Models (Spec v1.0) ──

export type SubscriptionTier = 'solo' | 'clinic' | 'multispecialty' | 'hospital' | 'enterprise' | 'test';
export type BillingCycle = 'monthly' | 'annual';
export type ClinicSubscriptionState = 'trialing' | 'active' | 'past_due' | 'read_only' | 'cancelled' | 'pending';

export interface PlanLimits {
  doctors_included: number;
  staff_seats_included: number;
  locations_included: number;
  ai_intakes_monthly: number;
  whatsapp_messages_monthly: number;
  storage_gb: number;
}

export interface PlanFeatures {
  ai_triage: 'basic' | 'standard' | 'advanced' | 'custom';
  schedules_queues: 'single' | 'multi_doc' | 'advanced_multi' | 'multi_department';
  whatsapp_automation: 'reminders_only' | 'confirm_reschedule' | 'full' | 'full_crm' | 'custom_flows';
  billing_suite: 'standard' | 'advanced' | 'full' | 'tpa_insurance' | 'full_ipd';
  inventory: 'none' | 'basic' | 'advanced' | 'purchase_orders' | 'multi_store';
  custom_roles: boolean;
  audit_log: boolean;
  custom_branding: boolean;
  multi_location: boolean;
  sla_support: string;
}

export interface SubscriptionPlan {
  id: string; // 'solo' | 'clinic' | 'multispecialty' | 'hospital' | 'enterprise'
  name: string;
  code: SubscriptionTier;
  tier_rank: number;
  monthly_price_paise: number;
  annual_price_paise: number;
  monthly_price_inr: number;
  annual_price_inr: number;
  description: string;
  popular?: boolean;
  coming_soon?: boolean;
  is_custom_quote?: boolean;
  is_active: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  razorpay_plan_id_monthly?: string;
  razorpay_plan_id_annual?: string;
}

export interface AddonDefinition {
  id: string;
  code: 'extra_doctor' | 'extra_staff' | 'extra_location' | 'ai_pack_500' | 'whatsapp_pack_1000';
  name: string;
  price_paise: number;
  price_inr: number;
  billing_type: 'recurring_monthly' | 'one_time';
  description: string;
  unit_quantity: number;
}

export interface ClinicSubscription {
  subscription_id?: string;
  clinic_id: string;
  plan_id: SubscriptionTier;
  billing_cycle: BillingCycle;
  status: ClinicSubscriptionState;
  current_period_start: string;
  current_period_end: string;
  trial_start?: string;
  trial_end?: string;
  cancel_at_period_end?: boolean;
  razorpay_subscription_id?: string;
  razorpay_customer_id?: string;
  doctor_seat_override?: number;
  staff_seat_override?: number;
  location_override?: number;
  ai_intake_override?: number;
  whatsapp_override?: number;
  storage_gb_override?: number;
  active_addons?: {
    addon_code: string;
    quantity: number;
    purchased_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface UsageCounter {
  clinic_id: string;
  billing_period: string; // YYYY-MM
  ai_intakes_used: number;
  whatsapp_messages_used: number;
  storage_bytes_used: number;
  updated_at: string;
}
