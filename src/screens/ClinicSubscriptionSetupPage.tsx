import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CheckCircle2, Crown, CalendarClock, LogOut } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { db } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { RazorpaySubscriptionButton } from '../components/RazorpaySubscriptionButton';

export function ClinicSubscriptionSetupPage() {
  const { user, clinic } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const invoiceId = searchParams.get('invoice');
  const [success, setSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // If they have an invoice link or were previously active, they don't get a free trial.
  const isFirstTime = clinic?.subscription_status !== 'deactivated' && clinic?.subscription_status !== 'cancelled' && !invoiceId;

  const handleSuccess = async (paymentData?: any) => {
    if (!user || !clinic) return;
    setIsProcessing(true);
    
    try {
      // Update the user and clinic documents to mark subscription as active
      await updateDoc(doc(db, 'users', user.user_id), {
        clinic_subscription_status: 'active'
      });
      await updateDoc(doc(db, 'clinics', clinic.clinic_id), {
        subscription_status: 'active'
      });

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
          <span className="text-sm font-medium text-ink-subtle hidden sm:inline-block">Setup Step 4 of 4</span>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-ink-subtle hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>
      
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex h-12 w-12 bg-primary/10 text-primary rounded-full items-center justify-center mb-4">
            <Building2 size={24} />
          </div>
          <h1 className="text-3xl font-bold text-ink mb-3">
            Choose your subscription
          </h1>
          <p className="text-lg text-ink-subtle max-w-2xl mx-auto">
            {user?.role === 'clinic_admin' 
              ? isFirstTime 
                ? 'Your clinic is approved! Choose the Pro plan to access all VIITSA features. The first 30 days are completely free.'
                : 'Your free trial has ended or your plan is inactive. Pay the subscription amount to restore full access.'
              : 'Your clinic subscription is inactive. Please wait for your administrator to renew it.'}
          </p>
        </div>

        <div className="max-w-md mx-auto bg-white border border-black/5 rounded-2xl p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-primary to-accent"></div>
          
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-ink flex items-center gap-2">
                <Crown size={20} className="text-accent" />
                Clinic Pro Plan
              </h3>
              <p className="text-ink-subtle text-sm mt-1">Perfect for clinics exploring AI-powered operations.</p>
            </div>
          </div>
          
          <div className="mb-8">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-bold text-ink">{isFirstTime ? 'Free' : '₹2,999'}</span>
              <span className="text-ink-subtle mb-1">{isFirstTime ? '/ 30 days' : '/ month'}</span>
            </div>
            <div className="flex items-center gap-2 text-primary font-medium text-sm mt-3 bg-primary/5 p-2 rounded-lg inline-flex">
              <CalendarClock size={16} />
              {isFirstTime ? '₹2,999/month after trial' : 'Billed securely via Razorpay'}
            </div>
          </div>
          
          <ul className="space-y-4 mb-8">
            {[
              'Up to 3 staff accounts',
              'AI Health Navigator',
              'Appointment management',
              'Basic analytics',
              'WhatsApp reminders'
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                <span className="text-ink">{feature}</span>
              </li>
            ))}
          </ul>
          
          {user?.role === 'clinic_admin' ? (
            <>
              {isFirstTime ? (
                <>
                  <RazorpaySubscriptionButton 
                    clinicId={clinic?.clinic_id || ''}
                    planId={import.meta.env.VITE_RAZORPAY_PLAN_ID_PRO || 'plan_TkvpQ2LluCpPIu'}
                    buttonText="Start 30-Day Free Trial"
                    className="w-full btn-primary py-3 text-base justify-center"
                    onSuccess={handleSuccess}
                  />
                  <p className="text-xs text-ink-muted text-center mt-4">
                    You won't be charged until your trial ends. Cancel anytime.
                  </p>
                </>
              ) : (
                <>
                  <RazorpaySubscriptionButton 
                    clinicId={clinic?.clinic_id || ''}
                    planId={import.meta.env.VITE_RAZORPAY_PLAN_ID_PRO || 'plan_TkvpQ2LluCpPIu'}
                    buttonText="Pay ₹2,999 Securely"
                    className="w-full btn-primary py-3 text-base justify-center"
                    onSuccess={handleSuccess}
                    skipTrial={true}
                  />
                  <p className="text-xs text-ink-muted text-center mt-4">
                    Instant activation upon successful payment.
                  </p>
                </>
              )}
            </>
          ) : (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-medium border border-red-100">
              Your clinic's subscription is currently inactive. Please contact your clinic administrator to renew the subscription.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
