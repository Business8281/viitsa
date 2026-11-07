import { db } from './firebase';
import { doc, getDoc, setDoc, updateDoc, increment, collection, getDocs } from 'firebase/firestore';
import type { 
  SubscriptionPlan, 
  ClinicSubscription, 
  UsageCounter, 
  PlanLimits, 
  SubscriptionTier,
  BillingCycle,
  ClinicSubscriptionState
} from './types';

// Default plans seeded as fallback or when initialized in Firestore
export const DEFAULT_PLANS: SubscriptionPlan[] = [
  {
    id: 'test',
    code: 'test',
    name: 'Test Plan',
    tier_rank: 0,
    monthly_price_paise: 100,
    annual_price_paise: 100,
    monthly_price_inr: 1,
    annual_price_inr: 1,
    description: 'Test plan for live invoice generation and WhatsApp delivery testing.',
    popular: false,
    is_active: true,
    limits: {
      doctors_included: 5,
      staff_seats_included: 10,
      locations_included: 1,
      ai_intakes_monthly: 1000,
      whatsapp_messages_monthly: 2500,
      storage_gb: 0,
    },
    features: {
      ai_triage: 'advanced',
      schedules_queues: 'multi_doc',
      whatsapp_automation: 'full',
      billing_suite: 'advanced',
      inventory: 'advanced',
      custom_roles: true,
      audit_log: true,
      custom_branding: true,
      multi_location: false,
      sla_support: 'priority',
    }
  },
  {
    id: 'solo',
    code: 'solo',
    name: 'Solo',
    tier_rank: 1,
    monthly_price_paise: 299900,
    annual_price_paise: 2999000,
    monthly_price_inr: 2999,
    annual_price_inr: 29990,
    description: 'Single-doctor practices, independent consultants, and new clinics getting started.',
    popular: false,
    is_active: true,
    limits: {
      doctors_included: 1,
      staff_seats_included: 3,
      locations_included: 1,
      ai_intakes_monthly: 300,
      whatsapp_messages_monthly: 800,
      storage_gb: 0, // 0 = Unlimited storage (no restrictions)
    },
    features: {
      ai_triage: 'basic',
      schedules_queues: 'single',
      whatsapp_automation: 'reminders_only',
      billing_suite: 'standard',
      inventory: 'basic',
      custom_roles: false,
      audit_log: false,
      custom_branding: false,
      multi_location: false,
      sla_support: 'standard',
    }
  },
  {
    id: 'clinic',
    code: 'clinic',
    name: 'Clinic',
    tier_rank: 2,
    monthly_price_paise: 599900,
    annual_price_paise: 5999000,
    monthly_price_inr: 5999,
    annual_price_inr: 59990,
    description: 'Growing clinics with multiple doctors needing streamlined queues and automated WhatsApp.',
    popular: true,
    is_active: true,
    limits: {
      doctors_included: 3,
      staff_seats_included: 6,
      locations_included: 1,
      ai_intakes_monthly: 1000,
      whatsapp_messages_monthly: 2500,
      storage_gb: 0, // 0 = Unlimited storage (no restrictions)
    },
    features: {
      ai_triage: 'standard',
      schedules_queues: 'multi_doc',
      whatsapp_automation: 'confirm_reschedule',
      billing_suite: 'full',
      inventory: 'purchase_orders',
      custom_roles: true,
      audit_log: true,
      custom_branding: true,
      multi_location: false,
      sla_support: 'priority',
    }
  },
  {
    id: 'multispecialty',
    code: 'multispecialty',
    name: 'Multi-Specialty',
    tier_rank: 3,
    monthly_price_paise: 1199900,
    annual_price_paise: 11999000,
    monthly_price_inr: 11999,
    annual_price_inr: 119990,
    description: 'Polyclinics and busy specialty centres running multiple departments and multiple branches.',
    popular: false,
    is_active: true,
    limits: {
      doctors_included: 8,
      staff_seats_included: 20,
      locations_included: 1,
      ai_intakes_monthly: 2000,
      whatsapp_messages_monthly: 5000,
      storage_gb: 0, // 0 = Unlimited storage (no restrictions)
    },
    features: {
      ai_triage: 'advanced',
      schedules_queues: 'advanced_multi',
      whatsapp_automation: 'full_crm',
      billing_suite: 'tpa_insurance',
      inventory: 'multi_store',
      custom_roles: true,
      audit_log: true,
      custom_branding: true,
      multi_location: false,
      sla_support: 'priority_dedicated',
    }
  },
  {
    id: 'hospital',
    code: 'hospital',
    name: 'Hospital',
    tier_rank: 4,
    monthly_price_paise: 2499900,
    annual_price_paise: 24999000,
    monthly_price_inr: 24999,
    annual_price_inr: 249990,
    description: 'Nursing homes and small hospitals requiring IPD, bed allocation, and multi-department flow.',
    popular: false,
    coming_soon: true,
    is_active: true,
    limits: {
      doctors_included: 25,
      staff_seats_included: 60,
      locations_included: 3,
      ai_intakes_monthly: 5000,
      whatsapp_messages_monthly: 12000,
      storage_gb: 0, // 0 = Unlimited storage (no restrictions)
    },
    features: {
      ai_triage: 'custom',
      schedules_queues: 'multi_department',
      whatsapp_automation: 'custom_flows',
      billing_suite: 'full_ipd',
      inventory: 'multi_store',
      custom_roles: true,
      audit_log: true,
      custom_branding: true,
      multi_location: true,
      sla_support: '24_7_dedicated',
    }
  }
];

// Helper to seed plans if not present
export async function ensureDefaultPlansSeeded(): Promise<SubscriptionPlan[]> {
  try {
    const plansSnap = await getDocs(collection(db, 'subscription_plans'));
    if (!plansSnap.empty) {
      return plansSnap.docs.map(d => ({ ...d.data(), id: d.id } as SubscriptionPlan));
    }
    // Seed default plans
    for (const plan of DEFAULT_PLANS) {
      await setDoc(doc(db, 'subscription_plans', plan.id), plan);
    }
    return DEFAULT_PLANS;
  } catch (error) {
    console.warn('Failed to fetch/seed subscription_plans from Firestore, using in-memory defaults:', error);
    return DEFAULT_PLANS;
  }
}

// Fetch active subscription for a clinic
export async function getClinicSubscription(clinicId: string): Promise<ClinicSubscription | null> {
  try {
    const subDoc = await getDoc(doc(db, 'subscriptions', clinicId));
    if (subDoc.exists()) {
      return { subscription_id: subDoc.id, ...subDoc.data() } as ClinicSubscription;
    }
    
    // Check clinic doc fallback
    const clinicDoc = await getDoc(doc(db, 'clinics', clinicId));
    if (clinicDoc.exists()) {
      const data = clinicDoc.data();
      const status: ClinicSubscriptionState = 
        data.subscription_status === 'active' ? 'active' :
        data.subscription_status === 'free_plan' ? 'trialing' :
        data.subscription_status === 'deactivated' ? 'read_only' :
        data.subscription_status === 'cancelled' ? 'cancelled' : 'trialing';
      
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      return {
        clinic_id: clinicId,
        plan_id: (data.subscription_plan as SubscriptionTier) || 'solo',
        billing_cycle: 'monthly',
        status,
        current_period_start: data.subscription_activated_at || now.toISOString(),
        current_period_end: trialEnd,
        trial_end: trialEnd,
        created_at: data.created_at || now.toISOString(),
        updated_at: now.toISOString(),
      };
    }
    return null;
  } catch (err) {
    console.error('Error fetching clinic subscription:', err);
    return null;
  }
}

// Compute effective limits including add-ons and manual overrides
export function getEffectiveLimits(
  plan: SubscriptionPlan, 
  sub?: ClinicSubscription | null
): PlanLimits {
  const base = { ...plan.limits };
  if (!sub) return base;

  // Add overrides if present
  if (sub.doctor_seat_override !== undefined) base.doctors_included = sub.doctor_seat_override;
  if (sub.staff_seat_override !== undefined) base.staff_seats_included = sub.staff_seat_override;
  if (sub.location_override !== undefined) base.locations_included = sub.location_override;
  if (sub.ai_intake_override !== undefined) base.ai_intakes_monthly = sub.ai_intake_override;
  if (sub.whatsapp_override !== undefined) base.whatsapp_messages_monthly = sub.whatsapp_override;
  if (sub.storage_gb_override !== undefined) base.storage_gb = sub.storage_gb_override;

  // Add active add-ons
  if (sub.active_addons && sub.active_addons.length > 0) {
    for (const addon of sub.active_addons) {
      if (addon.addon_code === 'extra_doctor') {
        base.doctors_included += addon.quantity;
      } else if (addon.addon_code === 'extra_staff') {
        base.staff_seats_included += addon.quantity;
      } else if (addon.addon_code === 'extra_location') {
        base.locations_included += addon.quantity;
      } else if (addon.addon_code === 'ai_pack_500') {
        base.ai_intakes_monthly += addon.quantity * 500;
      } else if (addon.addon_code === 'whatsapp_pack_1000') {
        base.whatsapp_messages_monthly += addon.quantity * 1000;
      }
    }
  }

  return base;
}

// Get current billing period usage counter (e.g., "2026-10")
export function getCurrentBillingPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Fetch usage counter for clinic
export async function getUsageCounter(clinicId: string): Promise<UsageCounter> {
  const period = getCurrentBillingPeriod();
  const docId = `${clinicId}_${period}`;
  try {
    const snap = await getDoc(doc(db, 'usage_counters', docId));
    if (snap.exists()) {
      return snap.data() as UsageCounter;
    }
    return {
      clinic_id: clinicId,
      billing_period: period,
      ai_intakes_used: 0,
      whatsapp_messages_used: 0,
      storage_bytes_used: 0,
      updated_at: new Date().toISOString()
    };
  } catch (err) {
    console.error('Error fetching usage counter:', err);
    return {
      clinic_id: clinicId,
      billing_period: period,
      ai_intakes_used: 0,
      whatsapp_messages_used: 0,
      storage_bytes_used: 0,
      updated_at: new Date().toISOString()
    };
  }
}

// Increment usage counters (AI intake, WhatsApp, Storage)
export async function recordUsageEvent(
  clinicId: string, 
  type: 'ai_intake' | 'whatsapp' | 'storage_bytes',
  amount = 1
): Promise<void> {
  if (!clinicId) return;
  const period = getCurrentBillingPeriod();
  const docId = `${clinicId}_${period}`;
  const docRef = doc(db, 'usage_counters', docId);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, {
        clinic_id: clinicId,
        billing_period: period,
        ai_intakes_used: type === 'ai_intake' ? amount : 0,
        whatsapp_messages_used: type === 'whatsapp' ? amount : 0,
        storage_bytes_used: type === 'storage_bytes' ? amount : 0,
        updated_at: new Date().toISOString()
      });
    } else {
      const field = 
        type === 'ai_intake' ? 'ai_intakes_used' : 
        type === 'whatsapp' ? 'whatsapp_messages_used' : 'storage_bytes_used';
      await updateDoc(docRef, {
        [field]: increment(amount),
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.error(`Failed to record ${type} usage event for ${clinicId}:`, err);
  }
}

// Entitlement check for Doctor seat cap
export function checkDoctorSeatLimit(
  currentDoctorCount: number,
  limits: PlanLimits
): { allowed: boolean; remaining: number; max: number } {
  const max = limits.doctors_included;
  const allowed = currentDoctorCount < max;
  return {
    allowed,
    remaining: Math.max(0, max - currentDoctorCount),
    max
  };
}

// Entitlement check for Staff seat cap
export function checkStaffSeatLimit(
  currentStaffCount: number,
  limits: PlanLimits
): { allowed: boolean; remaining: number; max: number } {
  const max = limits.staff_seats_included;
  const allowed = currentStaffCount < max;
  return {
    allowed,
    remaining: Math.max(0, max - currentStaffCount),
    max
  };
}

// Entitlement check for AI Intake (with 20% soft grace period)
export function checkAIIntakeAllowance(
  used: number,
  monthlyAllowance: number
): { status: 'within_limit' | 'in_grace' | 'exceeded'; percentage: number; graceLimit: number } {
  const graceLimit = Math.floor(monthlyAllowance * 1.20);
  const percentage = Math.round((used / monthlyAllowance) * 100);

  if (used < monthlyAllowance) {
    return { status: 'within_limit', percentage, graceLimit };
  } else if (used < graceLimit) {
    return { status: 'in_grace', percentage, graceLimit };
  } else {
    return { status: 'exceeded', percentage, graceLimit };
  }
}
