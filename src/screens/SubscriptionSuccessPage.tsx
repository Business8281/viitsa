import { useEffect, useState, useRef } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Calendar, CreditCard, ShieldCheck, ArrowRight, XCircle, AlertTriangle, RefreshCw, Zap } from 'lucide-react';
import { db, functions } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../lib/auth';
import { buildSubscriptionActivatedHtml } from '../lib/emailService';
import { sendWhatsAppClinicSubActivated, sendWhatsAppClinicTrialActivated } from '../lib/whatsappClientService';

export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clinic, user, loading: authLoading } = useAuth();
  
  const [saving, setSaving] = useState(true);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [resolvedTier, setResolvedTier] = useState<string>('clinic');
  const [resolvedCycle, setResolvedCycle] = useState<string>('monthly');
  const [resolvedIsTrial, setResolvedIsTrial] = useState<boolean>(false);
  const hasProcessed = useRef(false);

  // Extract payment reference information from query params
  const paymentId = searchParams.get('razorpay_payment_id') || searchParams.get('payment_id') || '';
  const paymentLinkId = searchParams.get('razorpay_payment_link_id') || searchParams.get('plink_id') || '';
  const rawStatus = (searchParams.get('razorpay_payment_link_status') || searchParams.get('status') || '').toLowerCase();
  const planParam = searchParams.get('plan') || searchParams.get('tier');
  const cycleParam = searchParams.get('cycle') || searchParams.get('billing_cycle');

  // Strict payment status determination
  const isExplicitlyFailed = rawStatus === 'failed' || rawStatus === 'cancelled' || rawStatus === 'expired';
  // Payment is considered valid ONLY if not explicitly failed AND (status is 'paid'/'success' OR genuine payment id exists)
  const isPaid = !isExplicitlyFailed && (rawStatus === 'paid' || rawStatus === 'success' || (Boolean(paymentId) && paymentId.startsWith('pay_')));

  const today = new Date();

  useEffect(() => {
    // Wait until Firebase Auth has finished resolving
    if (authLoading) return;

    // Prevent duplicate processing
    if (hasProcessed.current) return;

    // STRICT CHECK: If payment is NOT paid or failed, do NOT touch Firestore
    if (!isPaid) {
      setSaving(false);
      return;
    }

    // Determine target tier & cycle
    let pendingUpgrade: any = null;
    try {
      const saved = localStorage.getItem('viitsa_pending_upgrade');
      if (saved) pendingUpgrade = JSON.parse(saved);
    } catch (e) {
      console.warn('Could not parse pending upgrade', e);
    }

    let detectedTier = 'clinic';
    let detectedCycle = (cycleParam || pendingUpgrade?.cycle || 'monthly').toLowerCase();

    const currentUrlAndId = `${paymentLinkId} ${window.location.href}`;

    // Link detection for Razorpay
    // Annual links:
    if (currentUrlAndId.includes('xlfXiVqg')) {
      detectedTier = 'solo';
      detectedCycle = 'annual';
    } else if (currentUrlAndId.includes('9OYAB40N')) {
      detectedTier = 'clinic';
      detectedCycle = 'annual';
    } else if (currentUrlAndId.includes('0PqwSVE')) {
      detectedTier = 'multispecialty';
      detectedCycle = 'annual';
    }
    // Monthly links:
    else if (currentUrlAndId.includes('XDAYYlHQ')) {
      detectedTier = 'multispecialty';
      detectedCycle = 'monthly';
    } else if (currentUrlAndId.includes('OhKLJYzS')) {
      detectedTier = 'clinic';
      detectedCycle = 'monthly';
    } else if (planParam) {
      detectedTier = planParam.toLowerCase();
    } else if (pendingUpgrade?.tier) {
      detectedTier = pendingUpgrade.tier.toLowerCase();
    } else if (clinic?.subscription_plan) {
      detectedTier = clinic.subscription_plan.toLowerCase();
    }

    setResolvedTier(detectedTier);
    setResolvedCycle(detectedCycle);

    const targetClinicId = clinic?.clinic_id || pendingUpgrade?.clinic_id;
    if (!targetClinicId) {
      // Clinic not loaded yet
      setSaving(false);
      return;
    }

    hasProcessed.current = true;

    // REAL-TIME ACTIVATION IN FIRESTORE
    const activatePlanInRealTime = async () => {
      try {
        setSaving(true);

        // Guard 1: If subscription is currently cancelled or deactivated (e.g. user revoked UPI mandate), NEVER overwrite it back
        if (clinic?.subscription_status === 'cancelled' || clinic?.subscription_status === 'deactivated') {
          console.warn('[SubscriptionSuccess] Clinic subscription is already cancelled/deactivated. Suppressing re-activation.');
          setSaving(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        // Guard 2: If this payment ID was already processed and recorded on this clinic, skip duplicate activation & notifications
        if (paymentId && clinic?.last_payment_id === paymentId) {
          console.log('[SubscriptionSuccess] Payment ID already recorded on clinic doc. Suppressing duplicate activation.');
          setSaving(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
          return;
        }

        // Detect if this transaction corresponds to a 30-Day Free Trial mandate
        const isTrialParam = searchParams.get('is_trial') === 'true' || searchParams.get('trial') === 'true';
        const isTrialSession = typeof window !== 'undefined' && sessionStorage.getItem('viitsa_is_trial') === 'true';
        const isTrialClinic = (clinic?.subscription_status === 'trial' || (clinic as any)?.trial_status === 'active_trial') ||
          ((clinic as any)?.trial_completed !== true && detectedCycle === 'monthly' && clinic?.subscription_status !== 'active');
        const isTrial = Boolean(isTrialParam || isTrialSession || (pendingUpgrade?.is_trial === true) || isTrialClinic);
        const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        setResolvedIsTrial(isTrial);

        // 1. Calculate billing cycle period end date
        const durationDays = detectedCycle === 'annual' ? 365 : 30;
        const periodEndIso = isTrial ? trialEndsAt : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        // 2. Update Clinic document immediately
        const clinicUpdates: any = {
          subscription_status: isTrial ? 'trial' : 'active',
          subscription_plan: detectedTier,
          subscription_billing_cycle: detectedCycle,
          subscription_activated_at: new Date().toISOString(),
          subscription_period_end: periodEndIso,
          cancel_at_period_end: false,
          cancel_effective_date: null,
          change_scheduled: false,
          scheduled_plan: null,
          scheduled_billing_cycle: null,
          scheduled_effective_date: null,
          scheduled_change_type: null,
          subscription_auto_renew: true,
          subscription_updated_at: new Date().toISOString(),
          last_payment_id: paymentId || 'online_checkout',
          last_payment_link_id: paymentLinkId || null,
          last_payment_status: 'paid'
        };

        if (isTrial) {
          clinicUpdates.trial_used = true;
          clinicUpdates.has_used_trial = true;
          clinicUpdates.trial_activated = true;
          clinicUpdates.trial_completed = false;
          clinicUpdates.trial_status = 'active_trial';
          clinicUpdates.trial_started_at = new Date().toISOString();
          clinicUpdates.trial_ends_at = trialEndsAt;
        }

        await updateDoc(doc(db, 'clinics', targetClinicId), clinicUpdates);

        // 3. Update User document if user ID is known
        const targetUserId = user?.user_id || pendingUpgrade?.user_id;
        if (targetUserId) {
          const userUpdates: any = {
            clinic_subscription_status: isTrial ? 'trial' : 'active',
            subscription_plan: detectedTier,
            subscription_billing_cycle: detectedCycle
          };
          if (isTrial) {
            userUpdates.trial_used = true;
            userUpdates.has_used_trial = true;
            userUpdates.trial_completed = false;
            userUpdates.trial_ends_at = trialEndsAt;
          }
          await updateDoc(doc(db, 'users', targetUserId), userUpdates);
        }

        // 4. Log to subscriptions collection for billing record
        const logPaymentId = paymentId || `pay_link_${Date.now()}`;
        const q = query(collection(db, 'subscriptions'), where('payment_id', '==', logPaymentId));
        const snap = await getDocs(q);
        if (snap.empty) {
          await addDoc(collection(db, 'subscriptions'), {
            clinic_id: targetClinicId,
            clinic_name: clinic?.name || 'Clinic',
            tier: detectedTier,
            plan_name: isTrial ? `${detectedTier.toUpperCase()} Plan (30-Day Free Trial)` : `${detectedTier.toUpperCase()} Plan`,
            billing_cycle: detectedCycle,
            status: isTrial ? 'trial' : 'active',
            is_trial: isTrial,
            trial_ends_at: isTrial ? trialEndsAt : null,
            payment_id: paymentId || null,
            payment_link_id: paymentLinkId || null,
            payment_status: 'paid',
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }

        // 5. Send instant branded email confirmation to clinic admin
        const recipientEmail = user?.email || clinic?.email;
        if (recipientEmail) {
          try {
            const planPricing: Record<string, Record<string, number>> = {
              solo: { monthly: 2999, annual: 29990 },
              clinic: { monthly: 5999, annual: 59990 },
              multispecialty: { monthly: 11999, annual: 119990 },
            };
            const paidAmount = planPricing[detectedTier]?.[detectedCycle] || (detectedTier === 'multispecialty' ? 11999 : detectedTier === 'clinic' ? 5999 : 2999);
            const invNumber = `VIITSA-${isTrial ? 'TRL' : 'INV'}-${Date.now().toString().slice(-6)}`;

            const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
            await sendInstantEmail({
              to: recipientEmail,
              subject: isTrial
                ? `30-Day Free Trial Activated: ${detectedTier.toUpperCase()} Plan | Viitsa Healthcare`
                : `Payment Confirmed: ${detectedTier.toUpperCase()} Plan (${detectedCycle.toUpperCase()}) Activated | Viitsa Healthcare`,
              invoiceData: {
                invoiceNumber: invNumber,
                invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                status: isTrial ? 'TRIAL ACTIVE' : 'PAID',
                clinicName: clinic?.name || 'Clinic Partner',
                customerEmail: recipientEmail,
                customerPhone: (clinic as any)?.phone || (clinic as any)?.contact_phone || '',
                planName: `${detectedTier.toUpperCase()} Plan (${detectedCycle.toUpperCase()})`,
                tier: detectedTier,
                cycle: detectedCycle,
                amount: isTrial ? 0 : paidAmount,
                paymentId: paymentId || paymentLinkId || (isTrial ? 'Trial Mandate Registration' : 'Online Payment'),
                isTrial,
                notes: isTrial ? '30-Day Free Trial Activated. Auto-mandate registered.' : 'Subscription activated in real-time via Razorpay checkout.'
              },
              htmlContent: buildSubscriptionActivatedHtml({
                clinicName: clinic?.name || 'Doctor',
                planName: `${detectedTier.toUpperCase()} Plan`,
                cycle: detectedCycle,
                isTrial,
                trialEndsAt: isTrial ? new Date(trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
                paymentId: paymentId || paymentLinkId || (isTrial ? 'Trial Mandate Registration' : 'Online Checkout'),
                amount: isTrial ? 0 : paidAmount
              })
            });
          } catch (emailErr) {
            console.warn('Could not send instant payment confirmation email:', emailErr);
          }
        }

        // 6. Send instant WhatsApp confirmation to clinic admin with multi-tier phone fallback & 6-hour deduplication guard
        const targetPhone = (
          (clinic as any)?.phone || 
          (clinic as any)?.contact_phone || 
          user?.phone || 
          (user as any)?.phone_number ||
          (typeof window !== 'undefined' ? (sessionStorage.getItem('viitsa_reg_phone') || localStorage.getItem('viitsa_clinic_phone') || '') : '')
        ).replace(/\D/g, '').slice(-10);

        const nowMs = Date.now();
        const twentyFourHoursMs = 24 * 60 * 60 * 1000;
        const lastTrialWa = (clinic as any)?.last_trial_wa_sent_at ? new Date((clinic as any).last_trial_wa_sent_at).getTime() : 0;
        const lastSubWa = (clinic as any)?.last_sub_wa_sent_at ? new Date((clinic as any).last_sub_wa_sent_at).getTime() : 0;

        if (targetPhone && targetPhone.length === 10) {
          try {
            if (isTrial && (nowMs - lastTrialWa > twentyFourHoursMs)) {
              const waRes = await sendWhatsAppClinicTrialActivated({
                to: targetPhone,
                clinicId: targetClinicId,
                adminName: user?.name || (clinic as any)?.owner_name || 'Doctor',
                clinicName: clinic?.name || 'Clinic',
                planTier: `${detectedTier.toUpperCase()} Plan`,
                trialValidUntil: new Date(trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
              });
              if (waRes?.success) {
                await updateDoc(doc(db, 'clinics', targetClinicId), {
                  last_trial_wa_sent_at: new Date().toISOString()
                }).catch(() => {});
              }
            } else if (!isTrial && (nowMs - lastSubWa > twentyFourHoursMs)) {
              const planPricing: Record<string, Record<string, number>> = {
                solo: { monthly: 2999, annual: 29990 },
                clinic: { monthly: 5999, annual: 59990 },
                multispecialty: { monthly: 11999, annual: 119990 },
              };
              const paidAmount = planPricing[detectedTier]?.[detectedCycle] || (detectedTier === 'multispecialty' ? 11999 : detectedTier === 'clinic' ? 5999 : 2999);
              const durationDays = detectedCycle === 'annual' ? 365 : 30;

              const waRes = await sendWhatsAppClinicSubActivated({
                to: targetPhone,
                clinicId: targetClinicId,
                adminName: user?.name || (clinic as any)?.owner_name || 'Doctor',
                clinicName: clinic?.name || 'Clinic',
                planName: `${detectedTier.toUpperCase()} Plan`,
                billingCycle: detectedCycle.toUpperCase(),
                amountPaid: paidAmount,
                nextRenewalDate: new Date(Date.now() + durationDays * 86400000).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
                supportPhone: '+91 73961 11081',
              });
              if (waRes?.success) {
                await updateDoc(doc(db, 'clinics', targetClinicId), {
                  last_sub_wa_sent_at: new Date().toISOString()
                }).catch(() => {});
              }
            } else {
              console.log('[SubscriptionSuccess] Skipping WhatsApp dispatch: cooldown active (< 6 hours).');
            }
          } catch (waErr) {
            console.warn('Could not send WhatsApp subscription activation notification:', waErr);
          }
        }

        // Clean up stored pending upgrade and trial session
        try {
          localStorage.removeItem('viitsa_pending_upgrade');
          sessionStorage.removeItem('viitsa_is_trial');
        } catch (e) {}

        // Strip payment parameters from URL immediately to prevent re-execution on browser refresh
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

      } catch (err: any) {
        console.error('Real-time plan activation error:', err);
        setActivationError(err?.message || 'Could not update subscription in real-time');
      } finally {
        setSaving(false);
      }
    };

    activatePlanInRealTime();
  }, [authLoading, clinic, user, isPaid, paymentId, paymentLinkId, planParam, cycleParam]);

  // Loading state while verifying
  if (authLoading || saving) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <div className="relative mb-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin" />
          <Zap className="w-5 h-5 text-emerald-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-1">Verifying Payment...</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Confirming transaction with Razorpay and updating your clinic plan in real time.
        </p>
      </div>
    );
  }

  // PAYMENT FAILED / CANCELLED STATE: STRICTLY NO PLAN ACTIVATED
  if (!isPaid) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-fade-in">
        <div className="bg-white rounded-3xl shadow-sm border border-rose-100 p-8 md:p-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500" />
          
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-200">
            <XCircle className="w-10 h-10 text-rose-500" />
          </div>
          
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 mb-3">
            <AlertTriangle size={13} /> Payment Incomplete
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Payment Failed or Cancelled
          </h1>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            The payment transaction was not completed. <strong className="text-slate-800">No plan has been activated</strong> and your clinic's existing status remains unchanged.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-5 text-left space-y-3 mb-6 border border-slate-200">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Transaction Status</span>
              <span className="font-semibold text-rose-600 uppercase">
                {rawStatus || 'Unconfirmed / Incomplete'}
              </span>
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500">Subscription Status</span>
              <span className="font-semibold text-slate-700">
                {clinic?.subscription_status === 'active' ? `Active (${clinic.subscription_plan?.toUpperCase()})` : 'Inactive'}
              </span>
            </div>

            {paymentLinkId && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Reference ID</span>
                <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                  {paymentLinkId}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/clinic/settings?tab=billing"
              className="btn-primary w-full py-3 text-sm inline-flex justify-center items-center gap-2"
            >
              <RefreshCw size={16} /> Try Again / Select Plan
            </Link>
            <Link
              to="/clinic/dashboard"
              className="btn-ghost w-full py-3 text-sm inline-flex justify-center items-center gap-2 border border-slate-200"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // PAYMENT SUCCESS & PLAN ACTIVATED STATE
  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sm border border-emerald-100 p-8 md:p-10 text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
        
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-200 shadow-sm animate-bounce-short">
          <CheckCircle className="w-10 h-10 text-emerald-600" />
        </div>
        
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 mb-3">
          ✓ {resolvedIsTrial ? '30-Day Free Trial Active' : 'Real-time Active'}
        </span>

        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          {resolvedIsTrial ? '30-Day Free Trial Activated!' : 'Payment Successful & Plan Activated!'}
        </h1>
        <p className="text-slate-600 text-sm mb-8 leading-relaxed max-w-lg mx-auto">
          {resolvedIsTrial ? (
            <>Welcome to Viitsa Healthcare! Your 30-day free trial for the <strong className="text-emerald-700 capitalize">{resolvedTier} Plan</strong> is now active. You have full access to all doctor seats and features with ₹0 billed today.</>
          ) : (
            <>Thank you for your payment. Your <strong className="text-emerald-700 capitalize">{resolvedTier} Plan</strong> is now active in real time across your clinic.</>
          )}
        </p>

        {activationError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl mb-6 text-left">
            Notice: {activationError}. If your plan does not reflect within 1 minute, please contact support.
          </div>
        )}
        
        <div className="bg-slate-50 rounded-2xl p-6 text-left space-y-4 mb-8 border border-slate-200">
          <h2 className="font-bold text-slate-900 border-b border-slate-200 pb-3 mb-4 text-sm flex items-center justify-between">
            <span>Subscription Confirmation</span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Live & Synced
            </span>
          </h2>
          
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2.5 text-slate-600">
              <ShieldCheck size={18} className="text-emerald-600" />
              <span>Activated Plan</span>
            </div>
            <span className="font-bold text-emerald-700 uppercase tracking-wide bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
              {resolvedTier} Plan
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar size={18} className="text-emerald-600" />
              <span>Billing Cycle</span>
            </div>
            <span className="font-semibold text-slate-800 capitalize">
              {resolvedCycle}
            </span>
          </div>
          
          <div className="flex justify-between items-center text-sm">
            <div className="flex items-center gap-2.5 text-slate-600">
              <Calendar size={18} className="text-emerald-600" />
              <span>Activation Date</span>
            </div>
            <span className="font-semibold text-slate-800">
              {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          {paymentId && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-2.5 text-slate-600">
                <CreditCard size={18} className="text-emerald-600" />
                <span>Payment Reference</span>
              </div>
              <span className="font-mono text-slate-700 text-xs bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs">
                {paymentId}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/clinic/dashboard"
            className="btn-primary w-full py-3.5 text-base inline-flex justify-center items-center gap-2 shadow-sm font-semibold"
          >
            Go to Dashboard <ArrowRight size={18} />
          </Link>
          <Link
            to="/clinic/settings?tab=billing"
            className="btn-ghost w-full py-3.5 text-base inline-flex justify-center items-center gap-2 border border-slate-200 font-semibold"
          >
            View Usage & Limits
          </Link>
        </div>
      </div>
    </div>
  );
}

