import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { useToast } from '../lib/toast';

interface RazorpaySubscriptionButtonProps {
  clinicId: string;
  planId?: string;
  tier?: 'solo' | 'clinic' | 'multispecialty';
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
      const subResult = await createSubscription({ 
        clinicId, 
        planId, 
        skipTrial,
        tier,
        cycle
      });
      const subscription = subResult.data as any;

      if (!subscription || !subscription.id) {
        throw new Error('Failed to create subscription mandate');
      }

      const isTrial = subscription.is_trial;

      // 2. Configure and open Razorpay modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, 
        subscription_id: subscription.id,
        name: 'Viitsa Healthcare',
        description: isTrial 
          ? `30-Day Free Trial (₹0 today). Auto-renews via UPI/Card after 30 days.` 
          : `${tier.toUpperCase()} Plan (${cycle.toUpperCase()}) Subscription`,
        handler: async function (response: any) {
          toast(isTrial ? '30-Day Free Trial activated successfully!' : 'Subscription activated successfully!', 'success');
          if (onSuccess) onSuccess({ ...response, is_trial: isTrial });
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
