import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { useToast } from '../lib/toast';

interface RazorpaySubscriptionButtonProps {
  clinicId: string;
  planId?: string;
  tier?: 'solo' | 'clinic' | 'multispecialty' | 'test';
  cycle?: 'monthly' | 'annual';
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentData: any) => void;
  onError?: (error: any) => void;
  skipTrial?: boolean;
  prefillEmail?: string;
  prefillName?: string;
  prefillContact?: string;
}

export function RazorpaySubscriptionButton({
  clinicId,
  planId,
  tier = 'clinic',
  cycle = 'monthly',
  buttonText = 'Start 30-Day Free Trial',
  className = 'btn-primary',
  onSuccess,
  onError,
  skipTrial = false,
  prefillEmail,
  prefillName,
  prefillContact,
}: RazorpaySubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const scriptId = 'razorpay-checkout-js';
    if (document.getElementById(scriptId)) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      console.error('Razorpay SDK failed to load');
    };
    document.body.appendChild(script);
  }, []);

  const handleSubscription = async () => {
    if (!scriptLoaded || !(window as any).Razorpay) {
      toast('Payment system is not ready. Please try again.', 'error');
      return;
    }

    setLoading(true);
    const functions = getFunctions(app, "asia-south1");

    try {
      // 1. Create subscription on backend with tier & cycle
      const createSubscription = httpsCallable(functions, 'createClinicSubscription');
      const isTestTier = tier === 'test';
      const subResult = await createSubscription({ 
        clinicId, 
        planId: planId || (isTestTier ? 'plan_To68mK4uUYtaWP' : undefined), 
        skipTrial: isTestTier ? true : skipTrial,
        tier,
        cycle,
        phone: prefillContact,
        email: prefillEmail
      });
      const subscription = subResult.data as any;

      if (!subscription || !subscription.id) {
        throw new Error('Failed to create subscription mandate');
      }

      if (subscription.is_payment_link && subscription.short_url) {
        window.location.href = subscription.short_url;
        return;
      }

      const isTrial = Boolean(subscription.is_trial);
      const isOrder = Boolean(subscription.is_order || subscription.order_id);

      // Persist trial state in sessionStorage so redirect flow (UPI Autopay / Netbanking / 3DS) on SubscriptionSuccessPage detects trial
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('viitsa_is_trial', isTrial ? 'true' : 'false');
        sessionStorage.setItem('viitsa_target_clinic_id', clinicId);
        sessionStorage.setItem('viitsa_sub_tier', tier);
        sessionStorage.setItem('viitsa_sub_cycle', cycle);
        if (prefillContact) sessionStorage.setItem('viitsa_clinic_phone', prefillContact);
      }

      // 2. Configure and open Razorpay modal
      const options: any = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, 
        name: 'Viitsa Healthcare',
        description: isTestTier
          ? 'Test Plan (₹1) - Live Invoice & WhatsApp Verification'
          : isTrial 
            ? `30-Day Free Trial (₹0 today). Auto-renews via UPI/Card after 30 days.` 
            : `${tier.toUpperCase()} Plan (${cycle.toUpperCase()}) Subscription`,
        handler: async function (response: any) {
          toast(isTestTier ? 'Test Plan payment successful! Generating invoice...' : isTrial ? '30-Day Free Trial activated successfully!' : 'Subscription activated successfully!', 'success');
          if (onSuccess) onSuccess({ ...response, is_trial: isTrial, is_order: isOrder, contact: prefillContact });
        },
        prefill: {
          name: prefillName || '',
          email: prefillEmail || '',
          contact: prefillContact || ''
        },
        theme: {
          color: '#05C994' 
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          }
        }
      };

      if (isOrder) {
        options.order_id = subscription.order_id;
        options.amount = subscription.amount || 100;
        options.currency = 'INR';
      } else {
        options.subscription_id = subscription.id;
      }

      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast('Payment failed: ' + response.error.description, 'error');
        if (onError) onError(response.error);
      });
      
      rzp.open();
    } catch (error: any) {
      console.error('Error in subscription flow:', error);
      toast(error.message || 'Subscription initiation failed.', 'error');
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSubscription}
      disabled={loading || !scriptLoaded}
      className={className}
    >
      {loading ? 'Processing...' : buttonText}
    </button>
  );
}
