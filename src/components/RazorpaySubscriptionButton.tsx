import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { useToast } from '../lib/toast';

interface RazorpaySubscriptionButtonProps {
  clinicId: string;
  planId: string;
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentData: any) => void;
  onError?: (error: any) => void;
  skipTrial?: boolean;
}

export function RazorpaySubscriptionButton({
  clinicId,
  planId,
  buttonText = 'Start 30-Day Free Trial',
  className = 'btn-primary',
  onSuccess,
  onError,
  skipTrial = false,
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
      // 1. Create subscription on backend
      const createSubscription = httpsCallable(functions, 'createClinicSubscription');
      const subResult = await createSubscription({ clinicId, planId, skipTrial });
      const subscription = subResult.data as any;

      if (!subscription || !subscription.id) {
        throw new Error('Failed to create subscription');
      }

      // 2. Configure and open Razorpay modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, 
        subscription_id: subscription.id,
        name: 'VIITSA',
        description: 'Monthly subscription for Viitsa Clinic Pro after 30-day free trial',
        handler: async function (response: any) {
          toast('Subscription setup successful!', 'success');
          if (onSuccess) onSuccess(response);
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#0F6E56' 
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
