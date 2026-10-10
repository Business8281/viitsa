import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, Calendar, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../lib/auth';

export function SubscriptionSuccessPage() {
  const [searchParams] = useSearchParams();
  const { clinic, user } = useAuth();
  const [saving, setSaving] = useState(true);

  const paymentId = searchParams.get('razorpay_payment_id') || 'Unknown';
  const paymentLinkId = searchParams.get('razorpay_payment_link_id') || 'Unknown';
  const status = searchParams.get('razorpay_payment_link_status') || 'paid';
  
  const today = new Date();
  
  useEffect(() => {
    if (!clinic || status !== 'paid') {
      setSaving(false);
      return;
    }
    
    // Save to subscriptions collection
    const saveSubscription = async () => {
      try {
        // Check if we already recorded this payment
        const q = query(collection(db, 'subscriptions'), where('payment_id', '==', paymentId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          setSaving(false);
          return;
        }

        await addDoc(collection(db, 'subscriptions'), {
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.name,
          plan_name: 'Pro Plan',
          status: 'active',
          payment_id: paymentId,
          payment_link_id: paymentLinkId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
      } catch (e) {
        console.error('Error saving subscription', e);
      } finally {
        setSaving(false);
      }
    };
    
    saveSubscription();
  }, [clinic, paymentId, status]);

  if (saving) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
        <p className="text-ink-muted">Verifying payment...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-10 px-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-10 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-ink mb-2">Payment Successful!</h1>
        <p className="text-ink-muted mb-8">Thank you for upgrading to the VIITSA Pro Plan.</p>
        
        <div className="bg-gray-50 rounded-2xl p-6 text-left space-y-4 mb-8">
          <h2 className="font-bold text-ink border-b border-gray-200 pb-3 mb-4">Subscription Details</h2>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-ink-muted">
              <ShieldCheck size={18} className="text-primary" />
              <span>Plan Name</span>
            </div>
            <span className="font-semibold text-ink">Pro Plan</span>
          </div>
          
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-ink-muted">
              <Calendar size={18} className="text-primary" />
              <span>Activation Date</span>
            </div>
            <span className="font-semibold text-ink">
              {today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3 text-ink-muted">
              <CreditCard size={18} className="text-primary" />
              <span>Payment ID</span>
            </div>
            <span className="font-medium text-ink text-sm bg-white px-2 py-1 rounded border border-gray-200">
              {paymentId}
            </span>
          </div>
        </div>
        
        <Link to="/clinic/dashboard" className="btn-primary w-full py-4 text-lg inline-flex justify-center items-center gap-2">
          Return to Dashboard <ArrowRight size={20} />
        </Link>
      </div>
    </div>
  );
}
