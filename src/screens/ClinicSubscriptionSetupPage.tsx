import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Crown, CalendarClock, LogOut, Sparkles, AlertTriangle, ArrowLeft, ArrowRight, CreditCard, ChevronDown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { RazorpaySubscriptionButton } from '../components/RazorpaySubscriptionButton';
import { buildSubscriptionActivatedHtml } from '../lib/emailService';
// WhatsApp subscription notifications are dispatched by the backend onClinicSubscriptionStatusChanged trigger.

export function ClinicSubscriptionSetupPage() {
  const { user, clinic } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const mode = searchParams.get('mode');
  const isRetry = mode === 'retry' || mode === 'payment-failed' || clinic?.subscription_status === 'payment_failed' || clinic?.subscription_status === 'past_due' || clinic?.subscription_status === 'deactivated';

  // Trial countdown info & validity (strict 30-day persistence)
  const trialEndsAtDate = clinic?.trial_ends_at ? new Date(clinic.trial_ends_at) : null;
  const isTrialPeriodStillRunning = Boolean(trialEndsAtDate && trialEndsAtDate.getTime() > Date.now());
  const trialDaysRemaining = trialEndsAtDate
    ? Math.max(0, Math.ceil((trialEndsAtDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30;
  const formattedTrialEnd = trialEndsAtDate
    ? trialEndsAtDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : '30 Days from activation';

  const hasActuallyCompletedTrial = Boolean(clinic?.trial_completed === true && !isTrialPeriodStillRunning);
  const isPaidActive = clinic?.subscription_status === 'active' || clinic?.subscription_status === 'free_plan';

  // A clinic has an active trial ONLY if they have authorized their subscription mandate (trial_activated === true)
  // Merely being on the onboarding setup page does NOT mean trial is active yet!
  const isTrialActive = Boolean(
    (clinic?.subscription_status === 'trial' || isTrialPeriodStillRunning) &&
    clinic?.trial_activated === true &&
    (clinic as any)?.razorpay_subscription_id &&
    !hasActuallyCompletedTrial &&
    !isPaidActive
  );
  const isAlreadySubscribed = isTrialActive || isPaidActive;

  // Eligible for 30-day free trial as long as not already a paid active subscriber, hasn't completed trial, and not paying an invoice
  const isTrialEligible = !isPaidActive && !hasActuallyCompletedTrial && !invoiceId;

  const [showSwitchPlans, setShowSwitchPlans] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedTier, setSelectedTier] = useState<'solo' | 'clinic' | 'multispecialty'>('clinic');
  const [selectedCycle, setSelectedCycle] = useState<'monthly' | 'annual'>('monthly');

  // Self-healing:
  // 1. If trial was activated and 30 days have not elapsed, guarantee status is 'trial' and trial_completed is false.
  // 2. If an aborted checkout previously left premature trial flags before payment was ever made,
  //    restore clean trial eligibility immediately.
  useEffect(() => {
    if (!clinic?.clinic_id) return;

    // Healing 1: Ensure active trial stays uncompleted throughout the 30 days (never revert paid active clinics!)
    if (!isPaidActive && clinic.subscription_status === 'trial' && isTrialPeriodStillRunning && clinic.trial_completed === true) {
      updateDoc(doc(db, 'clinics', clinic.clinic_id), {
        trial_completed: false,
        trial_status: 'active_trial'
      }).catch(() => { });
      if (user?.user_id) {
        updateDoc(doc(db, 'users', user.user_id), {
          trial_completed: false
        }).catch(() => { });
      }
    }

    // Healing 2: If aborted checkout before payment, clear premature trial flags
    const isSubscribedOrTrial = clinic.subscription_status === 'trial' || clinic.subscription_status === 'active';
    if (!isSubscribedOrTrial && !hasActuallyCompletedTrial) {
      if (clinic.trial_used || clinic.has_used_trial || clinic.trial_activated || clinic.trial_started_at) {
        updateDoc(doc(db, 'clinics', clinic.clinic_id), {
          trial_used: false,
          has_used_trial: false,
          trial_activated: false,
          trial_started_at: null,
          trial_ends_at: null
        }).catch(() => { });
      }
      if (user?.user_id && ((user as any).trial_used || (user as any).has_used_trial || (user as any).trial_activated)) {
        updateDoc(doc(db, 'users', user.user_id), {
          trial_used: false,
          has_used_trial: false,
          trial_activated: false,
          trial_ends_at: null
        }).catch(() => { });
      }
    }
  }, [clinic?.clinic_id, clinic?.subscription_status, clinic?.trial_completed, clinic?.trial_activated, clinic?.trial_used, clinic?.trial_ends_at, isTrialPeriodStillRunning, hasActuallyCompletedTrial, user?.user_id]);


  const handleSuccess = async (paymentData?: any, chosenTier?: 'solo' | 'clinic' | 'multispecialty') => {
    if (!user || !clinic) return;
    setIsProcessing(true);

    const activeTier = chosenTier || selectedTier;
    // Resilient trial detection: if payment response confirms trial, OR user was eligible for trial, OR monthly plan chosen while not already active
    const isTrial = Boolean(
      paymentData?.is_trial ||
      isTrialEligible ||
      (selectedCycle === 'monthly' && clinic?.subscription_status !== 'active' && clinic?.trial_completed !== true)
    );
    const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      // Update the user and clinic documents
      const userUpdates: any = {
        clinic_subscription_status: isTrial ? 'trial' : 'active',
        subscription_plan: activeTier,
        subscription_billing_cycle: selectedCycle,
      };
      const durationDays = selectedCycle === 'annual' ? 365 : 30;
      const periodEnd = isTrial ? trialEndsAt : new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
      const clinicUpdates: any = {
        subscription_status: isTrial ? 'trial' : 'active',
        subscription_plan: activeTier,
        subscription_billing_cycle: selectedCycle,
        subscription_activated_at: new Date().toISOString(),
        subscription_period_end: periodEnd,
        cancel_at_period_end: false,
        change_scheduled: false,
        subscription_auto_renew: true
      };

      if (paymentData?.razorpay_subscription_id) {
        clinicUpdates.razorpay_subscription_id = paymentData.razorpay_subscription_id;
      }
      if (paymentData?.razorpay_payment_id) {
        clinicUpdates.last_payment_id = paymentData.razorpay_payment_id;
        clinicUpdates.last_payment_status = 'paid';
      }

      if (isTrial) {
        userUpdates.trial_used = true;
        userUpdates.has_used_trial = true;
        userUpdates.trial_activated = true;
        userUpdates.trial_completed = false;
        userUpdates.trial_ends_at = trialEndsAt;

        clinicUpdates.trial_used = true;
        clinicUpdates.has_used_trial = true;
        clinicUpdates.trial_activated = true;
        clinicUpdates.trial_completed = false;
        clinicUpdates.trial_status = 'active_trial';
        clinicUpdates.trial_started_at = new Date().toISOString();
        clinicUpdates.trial_ends_at = trialEndsAt;
        // NOTE: Do not set last_trial_wa_sent_at here so backend trigger can act as reliable fallback if frontend is interrupted
      }

      await updateDoc(doc(db, 'users', user.user_id), userUpdates);
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), clinicUpdates);

      // If an invoice was paid, mark it as paid
      if (invoiceId) {
        try {
          await updateDoc(doc(db, 'invoices', invoiceId), {
            status: 'paid',
            payment_status: 'paid',
            updated_at: new Date().toISOString()
          });
        } catch (e) {
          console.error('Failed to update invoice status', e);
        }
      }

      // Send instant confirmation email with attached invoice / trial confirmation PDF
      const recipientEmail = user.email || clinic.email;
      const planPricing: Record<string, Record<string, number>> = {
        solo: { monthly: 2999, annual: 29990 },
        clinic: { monthly: 5999, annual: 59990 },
        multispecialty: { monthly: 11999, annual: 119990 },
      };
      const planAmount = planPricing[activeTier]?.[selectedCycle] || 5999;

      if (recipientEmail) {
        try {
          const functions = getFunctions(undefined, 'asia-south1');
          const sendInstantEmail = httpsCallable(functions, 'sendInstantEmail');
          const invNum = `VIITSA-${isTrial ? 'TRL' : 'SUB'}-${Date.now().toString().slice(-6)}`;

          await sendInstantEmail({
            to: recipientEmail,
            subject: isTrial
              ? `30-Day Free Trial Activated: ${activeTier.toUpperCase()} Plan | Viitsa Healthcare`
              : `Subscription Activated: ${activeTier.toUpperCase()} Plan (${selectedCycle.toUpperCase()}) | Viitsa Healthcare`,
            invoiceData: {
              invoiceNumber: invNum,
              invoiceDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
              status: isTrial ? 'TRIAL ACTIVE' : 'PAID',
              clinicName: clinic.name || 'Clinic Partner',
              customerEmail: recipientEmail,
              customerPhone: (clinic as any)?.phone || '',
              planName: `${activeTier.toUpperCase()} Plan (${selectedCycle.toUpperCase()})`,
              tier: activeTier,
              cycle: selectedCycle,
              amount: isTrial ? 0 : planAmount,
              paymentId: paymentData?.razorpay_payment_id || paymentData?.razorpay_subscription_id || 'Autopay Mandate',
              isTrial,
              notes: isTrial ? '30-Day Free Trial Activated. Auto-mandate registered.' : 'Subscription active in real-time.'
            },
            htmlContent: buildSubscriptionActivatedHtml({
              clinicName: clinic.name,
              planName: `${activeTier.toUpperCase()} Plan`,
              cycle: selectedCycle,
              isTrial,
              trialEndsAt: isTrial ? new Date(trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
              paymentId: paymentData?.razorpay_payment_id || paymentData?.razorpay_subscription_id || 'Autopay Mandate',
              amount: isTrial ? 0 : planAmount
            })
          });
        } catch (emailErr) {
          console.warn('Could not send setup confirmation email:', emailErr);
        }
      }

      // Note: WhatsApp activation notification is canonically dispatched by the backend
      // onClinicSubscriptionStatusChanged trigger when clinic document updates in Firestore.

      setSuccess(true);
      setTimeout(() => {
        navigate('/clinic/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Failed to update subscription status', error);
      setIsProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      navigate('/clinic/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-2xl font-bold text-ink mb-2 text-center">Payment Successful!</h1>
        <p className="text-ink-subtle text-center">Your clinic's subscription is now active. Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between">
        <ViitsaLogo size="md" />
        <div className="flex items-center gap-4">
          {clinic?.clinic_setup_complete ? (
            <>
              <button
                type="button"
                onClick={() => navigate('/clinic/dashboard')}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
              >
                <ArrowLeft size={14} /> Back to Dashboard
              </button>
              <button
                type="button"
                onClick={() => navigate('/clinic/settings?tab=billing')}
                className="text-xs font-bold text-ink hover:underline hidden sm:inline-block"
              >
                Settings & Billing
              </button>
            </>
          ) : (
            <span className="text-sm font-medium text-ink-subtle hidden sm:inline-block">Setup Step 4 of 4</span>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-ink-subtle hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        {isRetry && (
          <div className="mb-8 p-5 rounded-2xl bg-amber-50 border border-amber-200 text-left">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-amber-900">Subscription Payment Retry / Update Payment Method</h2>
                <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                  Your recent automated subscription payment was unsuccessful or is overdue. Select your plan below and authorize your payment method (UPI Autopay, Debit/Credit Card, or Netbanking) to restore and maintain uninterrupted service.
                </p>
              </div>
            </div>
          </div>
        )}

        {isTrialActive && !isRetry && (
          <div className="max-w-2xl mx-auto bg-white border border-emerald-500/30 rounded-3xl p-8 sm:p-10 shadow-xl text-center animate-fade-in mb-8">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-200 shadow-inner">
              <Sparkles size={38} className="text-emerald-600 animate-pulse" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <span>30-Day Free Trial Active</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 capitalize">
              {clinic?.subscription_plan || 'Clinic'} Plan Activated
            </h2>
            <p className="text-sm text-slate-600 max-w-lg mx-auto mb-6 leading-relaxed">
              Your clinic is completely set up! You have 100% unrestricted access to all doctor seats, AI intake workflows, and WhatsApp automation throughout your 30-day trial period.
            </p>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 mb-8 text-left grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">Trial Valid Until</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">
                  {formattedTrialEnd}
                </span>
                <span className="text-xs text-emerald-700 font-semibold block mt-0.5">
                  🌟 {trialDaysRemaining} days remaining (₹0 charged today)
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">First Auto-Debit (Day 31)</span>
                <span className="text-sm font-bold text-slate-800 block mt-0.5">
                  {clinic?.subscription_plan === 'solo' ? '₹2,999' : clinic?.subscription_plan === 'multispecialty' ? '₹11,999' : '₹5,999'} / month
                </span>
                <span className="text-xs text-slate-500 block mt-0.5">
                  UPI Autopay / Card mandate registered
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/clinic/dashboard')}
                className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>Enter Clinic Dashboard</span>
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/clinic/settings?tab=billing')}
                className="w-full sm:w-auto px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition"
              >
                Manage Mandate & Billing
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowSwitchPlans(!showSwitchPlans)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
              >
                <span>{showSwitchPlans ? 'Hide plan comparison' : 'Want to switch tier or change billing cycle? Click to view plans'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showSwitchPlans ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {isPaidActive && !isRetry && !isTrialActive && (
          <div className="max-w-2xl mx-auto bg-white border border-primary/20 rounded-3xl p-8 shadow-lg text-center animate-fade-in mb-8">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Crown size={32} />
            </div>
            <h2 className="text-2xl font-bold text-ink mb-1 capitalize">
              {clinic?.subscription_plan || 'Clinic'} Plan Active
            </h2>
            <p className="text-xs text-ink-muted mb-6">
              Your clinic subscription is running actively. You can enter your clinic dashboard below.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/clinic/dashboard')}
                className="btn-primary text-xs py-2.5 px-6 font-bold flex items-center gap-2 shadow-sm"
              >
                <span>Enter Clinic Dashboard</span>
                <ArrowRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => navigate('/clinic/settings?tab=billing')}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Settings & Billing
              </button>
            </div>
            <div className="mt-6 pt-4 border-t border-black/5">
              <button
                type="button"
                onClick={() => setShowSwitchPlans(!showSwitchPlans)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 transition"
              >
                <span>{showSwitchPlans ? 'Hide plan options' : 'Looking to upgrade or change plan? View options'}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${showSwitchPlans ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        )}

        {(!isAlreadySubscribed || isRetry || showSwitchPlans) && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex h-12 w-12 bg-primary/10 text-primary rounded-full items-center justify-center mb-4">
                <Building2 size={24} />
              </div>
              <h1 className="text-3xl font-bold text-ink mb-3">
                Choose your subscription tier
              </h1>
              <p className="text-base text-ink-subtle max-w-2xl mx-auto">
                {user?.role === 'clinic_admin'
                  ? isRetry
                    ? 'Select your tier below to update your payment method and complete your pending subscription renewal.'
                    : isTrialEligible
                      ? 'Your clinic is approved! Choose your preferred plan below. All plans include a 30-Day Free Trial with automatic renewal via UPI Autopay / Card. Cancel anytime before Day 30 at ₹0.'
                      : 'Select your subscription tier below to activate or manage your recurring subscription.'
                  : 'Your clinic subscription is inactive. Please wait for your administrator to renew it.'}
              </p>

              {/* Billing Cycle Selector */}
              <div className="mt-6 inline-flex items-center gap-2 p-1 bg-surface-subtle border border-black/5 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedCycle('monthly')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${selectedCycle === 'monthly'
                    ? 'bg-white text-ink shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                    }`}
                >
                  Monthly Billing
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCycle('annual')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${selectedCycle === 'annual'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-ink-subtle hover:text-ink'
                    }`}
                >
                  <span>Annual Billing</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${selectedCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
                    }`}>
                    2 Mo Free
                  </span>
                </button>
              </div>
            </div>

            {/* Tier Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                {
                  id: 'solo' as const,
                  name: 'Solo Plan',
                  desc: 'Single-doctor practices and consultants.',
                  priceMonthly: '₹2,999',
                  priceAnnual: '₹29,990',
                  limits: ['1 Doctor included', '3 Staff seats', '1 Location', '300 AI Intakes / mo', '800 WhatsApp / mo', 'Unlimited document storage'],
                  planId: import.meta.env.VITE_RAZORPAY_PLAN_ID_SOLO || 'plan_solo_default'
                },
                {
                  id: 'clinic' as const,
                  name: 'Clinic Plan',
                  desc: 'Growing multi-doctor clinics with high volume.',
                  priceMonthly: '₹5,999',
                  priceAnnual: '₹59,990',
                  popular: true,
                  limits: ['Up to 3 Doctors', '6 Staff seats', '1 Location', '1,000 AI Intakes / mo', '2,500 WhatsApp / mo', 'Unlimited document storage'],
                  planId: import.meta.env.VITE_RAZORPAY_PLAN_ID_CLINIC || import.meta.env.VITE_RAZORPAY_PLAN_ID_PRO || 'plan_TkvpQ2LluCpPIu'
                },
                {
                  id: 'multispecialty' as const,
                  name: 'Multi-Specialty',
                  desc: 'Polyclinics and busy specialty centres.',
                  priceMonthly: '₹11,999',
                  priceAnnual: '₹1,19,990',
                  limits: ['Up to 8 Doctors', '20 Staff seats', '1 Location', '2,000 AI Intakes / mo', '5,000 WhatsApp / mo', 'Unlimited document storage'],
                  planId: import.meta.env.VITE_RAZORPAY_PLAN_ID_MULTI || 'plan_multi_default'
                }
              ].map((tier) => {
                const isSelected = selectedTier === tier.id;

                return (
                  <div
                    key={tier.id}
                    onClick={() => setSelectedTier(tier.id)}
                    className={`bg-white border rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between transition-all ${isSelected
                      ? 'border-primary ring-2 ring-primary/20 shadow-md'
                      : 'border-black/5 hover:border-black/20'
                      }`}
                  >
                    {tier.popular && (
                      <div className="absolute top-0 right-0 bg-accent text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                        Most Popular
                      </div>
                    )}

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Crown size={18} className={tier.popular ? "text-accent" : "text-primary"} />
                        <h3 className="text-lg font-bold text-ink">{tier.name}</h3>
                      </div>
                      <p className="text-ink-subtle text-xs mb-4">{tier.desc}</p>

                      <div className="mb-4 pb-4 border-b border-black/5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-extrabold text-ink">
                            {selectedCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly}
                          </span>
                          <span className="text-ink-subtle text-xs font-semibold">
                            {selectedCycle === 'annual' ? '/ year' : '/ month'}
                          </span>
                        </div>
                        {isTrialEligible ? (
                          <div className="mt-2 space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                              <Sparkles size={12} className="text-emerald-600 shrink-0" />
                              <span>Includes 30-Day Free Trial</span>
                            </div>
                            <p className="text-[11px] text-emerald-700 font-medium">
                              ₹0 charged today • Auto-debit of {selectedCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly} starts on Day 31
                            </p>
                          </div>
                        ) : (
                          <div className="mt-2 space-y-1">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary-50 border border-primary/20 text-primary text-[11px] font-bold">
                              <CreditCard size={12} className="text-primary shrink-0" />
                              <span>Instant Activation via UPI / Card</span>
                            </div>
                            <p className="text-[11px] text-ink-muted font-medium">
                              Auto-debited {selectedCycle === 'annual' ? tier.priceAnnual : tier.priceMonthly} ({selectedCycle})
                            </p>
                          </div>
                        )}
                      </div>

                      <ul className="space-y-2.5 mb-6 text-xs">
                        {tier.limits.map((lim, idx) => (
                          <li key={idx} className="flex items-center gap-2 text-ink">
                            <CheckCircle2 size={14} className="text-primary shrink-0" />
                            <span>{lim}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2" onClick={(e) => { e.stopPropagation(); setSelectedTier(tier.id); }}>
                      {user?.role === 'clinic_admin' ? (
                        <RazorpaySubscriptionButton
                          clinicId={clinic?.clinic_id || ''}
                          tier={tier.id}
                          cycle={selectedCycle}
                          skipTrial={!isTrialEligible}
                          prefillEmail={clinic?.email || user?.email}
                          prefillName={clinic?.name || user?.name}
                          prefillContact={clinic?.phone || user?.phone}
                          buttonText={
                            isTrialEligible
                              ? "Start Free Trial of 30 Days"
                              : isRetry
                                ? "Update Payment Method & Retry"
                                : "Pay & Activate Subscription"
                          }
                          className={`w-full py-3 px-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center text-center cursor-pointer ${isSelected
                            ? 'btn-primary shadow-md'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          onSuccess={(paymentData) => handleSuccess(paymentData, tier.id)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 cursor-not-allowed"
                        >
                          Admin Access Required
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Security & Reassurance note below the 3 cards */}
            <p className="text-center text-xs text-ink-subtle">
              🔒 Secured by Razorpay Subscriptions • 30-Day Free Trial (₹0 charged today) • Auto-debits chosen plan on Day 31 • Cancel anytime before Day 30 at zero charge
            </p>
          </>
        )}

        {user?.role !== 'clinic_admin' && (
          <div className="max-w-md mx-auto mt-6 bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-medium border border-red-100">
            Your clinic subscription is currently inactive. Please contact your clinic administrator to renew the subscription.
          </div>
        )}
      </main>
    </div>
  );
}
