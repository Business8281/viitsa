import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
import { useToast } from '../lib/toast';

interface RazorpayCheckoutButtonProps {
  amount: number; // Amount in paise
  currency?: string;
  receipt?: string;
  buttonText?: string;
  className?: string;
  onSuccess?: (paymentData: any) => void;
  onError?: (error: any) => void;
}

export function RazorpayCheckoutButton({
  amount,
  currency = 'INR',
  receipt,
  buttonText = 'Pay Now',
  className = 'btn-primary',
  onSuccess,
  onError,
}: RazorpayCheckoutButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

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

  const handlePayment = async () => {
    if (!scriptLoaded || !(window as any).Razorpay) {
      toast('Payment system is not ready. Please try again.', 'error');
      return;
    }

    if (amount < 100) {
      toast('Amount must be at least ₹1.00', 'error');
      return;
    }

    setLoading(true);
    const functions = getFunctions(app, "asia-south1");

    try {
      // 1. Create order on backend
      const createOrder = httpsCallable(functions, 'createRazorpayOrder');
      const orderResult = await createOrder({ amount, currency, receipt });
      const order = orderResult.data as any;

      if (!order || !order.id) {
        throw new Error('Failed to create order');
      }

      // 2. Configure and open Razorpay modal
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID, // Use environment variable
        amount: order.amount,
        currency: order.currency,
        name: 'VIITSA',
        description: receipt || 'Payment for services',
        order_id: order.id,
        handler: async function (response: any) {
          // 3. Verify payment on backend
          try {
            const verifyPayment = httpsCallable(functions, 'verifyRazorpayPayment');
            const verifyResult = await verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            const result = verifyResult.data as any;
            if (result.success) {
              toast('Payment successful!', 'success');
              if (onSuccess) onSuccess(response);
            } else {
              throw new Error('Verification failed');
            }
          } catch (err) {
            console.error('Verification error:', err);
            toast('Payment verification failed.', 'error');
            if (onError) onError(err);
          }
        },
        prefill: {
          name: '',
          email: '',
          contact: ''
        },
        theme: {
          color: '#0F6E56' // VIITSA Primary Color
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
      console.error('Error in payment flow:', error);
      toast(error.message || 'Payment initiation failed.', 'error');
      if (onError) onError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading || !scriptLoaded}
      className={className}
    >
      {loading ? 'Processing...' : buttonText}
    </button>
  );
}
