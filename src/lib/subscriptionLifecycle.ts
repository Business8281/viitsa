import { doc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';
import type { Clinic } from './types';
import { parseDateArg } from './format';
import { buildSubscriptionPlanChangeScheduledHtml, buildSubscriptionCancelledHtml } from './emailService';
import {
  sendWhatsAppClinicPlanUpgraded,
  sendWhatsAppClinicPlanDowngraded,
} from './whatsappClientService';

export interface SubscriptionPeriodInfo {
  date: Date;
  iso: string;
  formatted: string;
  daysRemaining: number;
}

/**
 * Computes the exact expiration/renewal date of the current subscription period.
 * Fallbacks accurately to trial period or activated date + cycle duration (30 days for monthly, 365 days for annual).
 */
export function getSubscriptionPeriodEnd(clinic: Partial<Clinic> | null | undefined): SubscriptionPeriodInfo {
  const now = new Date();
  let endDate: Date | null = null;

  try {
    if (clinic?.subscription_period_end) {
      const parsed = parseDateArg(clinic.subscription_period_end);
      if (!isNaN(parsed.getTime())) endDate = parsed;
    }

    if (!endDate && clinic?.subscription_status === 'trial' && clinic?.trial_ends_at) {
      const parsed = parseDateArg(clinic.trial_ends_at);
      if (!isNaN(parsed.getTime())) endDate = parsed;
    }

    if (!endDate && clinic?.subscription_activated_at) {
      const actDate = parseDateArg(clinic.subscription_activated_at);
      if (!isNaN(actDate.getTime())) {
        const cycle = (clinic.subscription_billing_cycle || 'monthly').toLowerCase();
        const durationDays = cycle === 'annual' ? 365 : 30;
        const computed = new Date(actDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
        if (!isNaN(computed.getTime())) endDate = computed;
      }
    }
  } catch (err) {
    console.warn('Error computing subscription period end date:', err);
  }

  // Safe fallback to 30 days from now if missing or invalid
  if (!endDate || isNaN(endDate.getTime())) {
    endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // If the computed end date is in the past for an active plan, ensure it projects to the next cycle end
  if (endDate.getTime() < now.getTime() && clinic?.subscription_status === 'active') {
    const cycle = (clinic.subscription_billing_cycle || 'monthly').toLowerCase();
    const durationDays = cycle === 'annual' ? 365 : 30;
    endDate = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
  }

  const msRemaining = Math.max(0, endDate.getTime() - now.getTime());
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  let iso = '';
  try {
    iso = endDate.toISOString();
  } catch {
    iso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  let formatted = '';
  try {
    formatted = endDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    formatted = '—';
  }

  return {
    date: endDate,
    iso,
    formatted,
    daysRemaining
  };
}

/**
 * Checks if a subscription has reached the end of its active billing period and resolves
 * any pending scheduled cancellations or scheduled plan upgrades/downgrades.
 */
export async function checkAndResolveSubscriptionPeriod(clinic: Clinic, userId?: string | null): Promise<boolean> {
  if (!clinic?.clinic_id) return false;

  const now = new Date();
  const periodInfo = getSubscriptionPeriodEnd(clinic);
  const nowIso = now.toISOString();

  // 1. Resolve Scheduled Cancellation if period has ended
  if (clinic.cancel_at_period_end) {
    const cancelTarget = clinic.cancel_effective_date 
      ? parseDateArg(clinic.cancel_effective_date) 
      : periodInfo.date;

    if (!isNaN(cancelTarget.getTime()) && now.getTime() >= cancelTarget.getTime()) {
      try {
        await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
          subscription_status: 'cancelled',
          cancel_at_period_end: false,
          subscription_cancelled_at: nowIso,
          subscription_updated_at: nowIso
        });

        if (userId) {
          await updateDoc(doc(db, 'users', userId), {
            clinic_subscription_status: 'cancelled'
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        console.warn('Error resolving period-end cancellation:', err);
      }
    }
  }

  // 2. Resolve Scheduled Plan Change (Upgrade / Downgrade) if period has ended
  if (clinic.change_scheduled && clinic.scheduled_plan) {
    const changeTarget = clinic.scheduled_effective_date
      ? parseDateArg(clinic.scheduled_effective_date)
      : periodInfo.date;

    if (!isNaN(changeTarget.getTime()) && now.getTime() >= changeTarget.getTime()) {
      try {
        const targetTier = clinic.scheduled_plan.toLowerCase();
        const targetCycle = (clinic.scheduled_billing_cycle || 'monthly').toLowerCase();
        const durationDays = targetCycle === 'annual' ? 365 : 30;
        const newPeriodEndIso = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
          subscription_status: 'active',
          subscription_plan: targetTier,
          subscription_billing_cycle: targetCycle,
          subscription_period_end: newPeriodEndIso,
          subscription_activated_at: nowIso,
          subscription_updated_at: nowIso,
          previous_plan: clinic.subscription_plan,
          change_scheduled: false,
          scheduled_plan: null,
          scheduled_billing_cycle: null,
          scheduled_effective_date: null,
          scheduled_change_type: null
        });

        if (userId) {
          await updateDoc(doc(db, 'users', userId), {
            clinic_subscription_status: 'active',
            subscription_plan: targetTier,
            subscription_billing_cycle: targetCycle
          }).catch(() => {});
        }
        return true;
      } catch (err) {
        console.warn('Error resolving period-end plan change:', err);
      }
    }
  }

  return false;
}

/**
 * Schedules a plan upgrade or downgrade to take effect at the end of the current billing cycle.
 * Current plan remains active and accessible with full entitlements until that date.
 */
export async function scheduleSubscriptionPlanChange(
  clinic: Clinic,
  user: any,
  targetTier: string,
  targetCycle: string,
  type: 'upgrade' | 'downgrade'
): Promise<{ ok: boolean; effectiveDate: string; error?: string }> {
  try {
    const periodInfo = getSubscriptionPeriodEnd(clinic);
    const nowIso = new Date().toISOString();
    const currentTier = (clinic.subscription_plan || 'clinic').toLowerCase();

    // 1. Update clinic document with scheduled change (current plan remains active!)
    await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
      change_scheduled: true,
      scheduled_plan: targetTier.toLowerCase(),
      scheduled_billing_cycle: targetCycle.toLowerCase(),
      scheduled_change_type: type,
      scheduled_effective_date: periodInfo.iso,
      scheduled_at: nowIso,
      subscription_period_end: periodInfo.iso,
      subscription_updated_at: nowIso
    });

    // 2. Log record to subscriptions collection
    await addDoc(collection(db, 'subscriptions'), {
      clinic_id: clinic.clinic_id,
      clinic_name: clinic.name,
      plan_name: `${targetTier.toUpperCase()} Plan (${targetCycle.toUpperCase()})`,
      tier: targetTier.toLowerCase(),
      billing_cycle: targetCycle.toLowerCase(),
      status: 'scheduled_change',
      change_type: type,
      effective_date: periodInfo.iso,
      previous_plan: currentTier,
      created_at: serverTimestamp()
    }).catch(e => console.warn('Sub schedule log warning:', e));

    // 3. Dispatch branded email notification informing user that current plan stays active until period end
    const adminEmail = user?.email || clinic.email;
    if (adminEmail) {
      try {
        const planPricing: Record<string, Record<string, number>> = {
          solo: { monthly: 2999, annual: 29990 },
          clinic: { monthly: 5999, annual: 59990 },
          multispecialty: { monthly: 11999, annual: 119990 },
        };
        const planAmount = planPricing[targetTier.toLowerCase()]?.[targetCycle.toLowerCase()] || 5999;
        const invNumber = `VIITSA-SCHED-${Date.now().toString().slice(-6)}`;

        const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
        await sendInstantEmail({
          to: adminEmail,
          subject: `Plan Change Scheduled: Switching to ${targetTier.toUpperCase()} Plan on ${periodInfo.formatted} | Viitsa Healthcare`,
          invoiceData: {
            invoiceNumber: invNumber,
            invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: 'ACTIVE',
            clinicName: clinic.name,
            customerEmail: adminEmail,
            customerPhone: (clinic as any)?.phone || (clinic as any)?.contact_phone || '',
            planName: `${targetTier.toUpperCase()} Plan (${targetCycle.toUpperCase()})`,
            tier: targetTier.toLowerCase(),
            cycle: targetCycle.toLowerCase(),
            amount: planAmount,
            notes: `Scheduled ${type.toUpperCase()}. Takes effect on ${periodInfo.formatted} after active period ends.`
          },
          htmlContent: buildSubscriptionPlanChangeScheduledHtml({
            clinicName: clinic.name,
            currentPlan: `${currentTier.toUpperCase()} Plan`,
            newPlan: `${targetTier.toUpperCase()} Plan`,
            cycle: targetCycle,
            effectiveDate: periodInfo.formatted
          })
        });
      } catch (emErr) {
        console.warn('Could not dispatch plan change schedule email:', emErr);
      }
    }

    // 4. Dispatch WhatsApp notification (viitsa_clinic_plan_upgraded or viitsa_clinic_plan_downgraded)
    const clinicPhone = (clinic as any)?.phone || (clinic as any)?.contact_phone || user?.phone;
    if (clinicPhone) {
      try {
        const planPricing: Record<string, Record<string, number>> = {
          solo: { monthly: 2999, annual: 29990 },
          clinic: { monthly: 5999, annual: 59990 },
          multispecialty: { monthly: 11999, annual: 119990 },
        };
        const planAmount = planPricing[targetTier.toLowerCase()]?.[targetCycle.toLowerCase()] || 5999;
        if (type === 'upgrade') {
          await sendWhatsAppClinicPlanUpgraded({
            to: clinicPhone,
            clinicId: clinic.clinic_id,
            adminName: user?.name || clinic.owner_name || 'Doctor',
            clinicName: clinic.name,
            newPlan: `${targetTier.toUpperCase()} Plan`,
            previousPlan: `${currentTier.toUpperCase()} Plan`,
            effectiveDate: periodInfo.formatted,
            newAmount: planAmount,
            supportPhone: '+91 73961 11081',
          });
        } else {
          await sendWhatsAppClinicPlanDowngraded({
            to: clinicPhone,
            clinicId: clinic.clinic_id,
            adminName: user?.name || clinic.owner_name || 'Doctor',
            clinicName: clinic.name,
            currentPlan: `${currentTier.toUpperCase()} Plan`,
            downgradedPlan: `${targetTier.toUpperCase()} Plan`,
            effectiveDate: periodInfo.formatted,
            cycleEndDate: periodInfo.formatted,
            newAmount: planAmount,
            supportPhone: '+91 73961 11081',
          });
        }
      } catch (waErr) {
        console.warn('Could not dispatch WhatsApp plan change template:', waErr);
      }
    }

    return { ok: true, effectiveDate: periodInfo.formatted };
  } catch (err: any) {
    console.error('Error scheduling plan change:', err);
    return { ok: false, effectiveDate: '', error: err?.message || 'Failed to schedule plan change' };
  }
}

/**
 * Reverts / cancels a scheduled plan change, keeping the user on their current active plan.
 */
export async function cancelScheduledPlanChange(clinicId: string): Promise<boolean> {
  try {
    await updateDoc(doc(db, 'clinics', clinicId), {
      change_scheduled: false,
      scheduled_plan: null,
      scheduled_billing_cycle: null,
      scheduled_effective_date: null,
      scheduled_change_type: null,
      subscription_updated_at: new Date().toISOString()
    });
    return true;
  } catch (err) {
    console.error('Error cancelling scheduled plan change:', err);
    return false;
  }
}

/**
 * Schedules a subscription cancellation to take effect at the end of the paid billing period.
 * Does NOT cut off access immediately; plan remains active until the expiration date.
 */
export async function scheduleSubscriptionCancellation(
  clinic: Clinic,
  user: any,
  reasonText: string,
  feedback: string
): Promise<{ ok: boolean; effectiveDate: string; error?: string }> {
  try {
    const periodInfo = getSubscriptionPeriodEnd(clinic);
    const nowIso = new Date().toISOString();

    // 1. Update clinic document (subscription stays ACTIVE until periodEnd!)
    await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
      cancel_at_period_end: true,
      cancel_effective_date: periodInfo.iso,
      cancellation_reason: reasonText,
      cancellation_feedback: feedback.trim(),
      subscription_auto_renew: false,
      subscription_period_end: periodInfo.iso,
      subscription_updated_at: nowIso
    });

    // 2. Log to subscription_cancellations collection
    await addDoc(collection(db, 'subscription_cancellations'), {
      clinic_id: clinic.clinic_id,
      clinic_name: clinic.name,
      user_id: user?.user_id || null,
      cancelled_by_email: user?.email || clinic.email || '',
      plan: clinic.subscription_plan || 'clinic',
      billing_cycle: (clinic as any).subscription_billing_cycle || 'monthly',
      reason: reasonText,
      feedback: feedback.trim(),
      effective_date: periodInfo.iso,
      created_at: serverTimestamp()
    }).catch(e => console.warn('Cancellation log warning:', e));

    // 3. Inform Razorpay / Backend Cloud Function with cancel_at_cycle_end: true
    try {
      const cancelFn = httpsCallable(functions, 'cancelClinicSubscription');
      await cancelFn({
        clinicId: clinic.clinic_id,
        reason: reasonText,
        feedback: feedback.trim(),
        cancelAtPeriodEnd: true,
        effectiveDate: periodInfo.iso
      });
    } catch (cfErr) {
      console.warn('Backend cancelClinicSubscription note:', cfErr);
    }

    // 4. Send official cancellation schedule email confirming active status until period end
    const adminEmail = user?.email || clinic.email;
    if (adminEmail) {
      try {
        const planName = `${(clinic.subscription_plan || 'Clinic').toUpperCase()} Plan`;
        const invNum = `VIITSA-CNCL-${Date.now().toString().slice(-6)}`;

        const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
        await sendInstantEmail({
          to: adminEmail,
          subject: `Subscription Cancellation Scheduled: Active Until ${periodInfo.formatted} | Viitsa Healthcare`,
          invoiceData: {
            invoiceNumber: invNum,
            invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            status: 'CANCELLED',
            clinicName: clinic.name,
            customerEmail: adminEmail,
            customerPhone: (clinic as any)?.phone || (clinic as any)?.contact_phone || '',
            planName,
            tier: (clinic.subscription_plan || 'clinic').toLowerCase(),
            cycle: ((clinic as any).subscription_billing_cycle || 'monthly').toLowerCase(),
            amount: 0,
            notes: `Cancellation scheduled for ${periodInfo.formatted}. Reason: ${reasonText}`
          },
          htmlContent: buildSubscriptionCancelledHtml({
            clinicName: clinic.name,
            planName,
            effectiveDate: periodInfo.formatted,
            reason: reasonText
          })
        });
      } catch (emErr) {
        console.warn('Could not dispatch cancellation schedule email:', emErr);
      }
    }

    return { ok: true, effectiveDate: periodInfo.formatted };
  } catch (err: any) {
    console.error('Error scheduling cancellation:', err);
    return { ok: false, effectiveDate: '', error: err?.message || 'Failed to schedule cancellation' };
  }
}

/**
 * Reverts / undoes a scheduled cancellation, restoring auto-renewal and keeping the subscription active.
 */
export async function revertSubscriptionCancellation(clinicId: string): Promise<boolean> {
  try {
    const nowIso = new Date().toISOString();
    await updateDoc(doc(db, 'clinics', clinicId), {
      cancel_at_period_end: false,
      cancel_effective_date: null,
      cancellation_reason: null,
      cancellation_feedback: null,
      subscription_auto_renew: true,
      subscription_status: 'active',
      subscription_updated_at: nowIso
    });
    return true;
  } catch (err) {
    console.error('Error reverting cancellation:', err);
    return false;
  }
}
