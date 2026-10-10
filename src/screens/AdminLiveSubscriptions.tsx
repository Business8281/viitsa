import React, { useState, useMemo } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Clinic } from '../lib/types';
import { DataTable, StatusBadge } from '../components/ui';
import { Play, Pause, Gift, XCircle, Wallet, Activity, CreditCard, History, Send, Copy } from 'lucide-react';

interface AdminLiveSubscriptionsProps {
  clinics: Clinic[];
  subscriptions?: any[];
  invoices?: any[];
}

export default function AdminLiveSubscriptions({ clinics, subscriptions = [], invoices = [] }: AdminLiveSubscriptionsProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'free_plan' | 'inactive'>('all');

  // Metrics Calculation
  const metrics = useMemo(() => {
    const active = clinics.filter(c => c.subscription_status === 'active');
    const free = clinics.filter(c => c.subscription_status === 'free_plan');
    const inactive = clinics.filter(c => !['active', 'free_plan'].includes(c.subscription_status || ''));
    
    // Calculate actual revenue from paid subscription invoices
    const subInvoicesList = invoices.filter(i => 
      (i.type === 'subscription' || !!i.plan_name)
    );
    const paidInvoices = subInvoicesList.filter(i => i.status === 'paid' || i.payment_status === 'paid');
    const totalRev = paidInvoices.reduce((sum, i) => sum + Number(i.amount || i.total_amount || 0), 0);

    return {
      activeCount: active.length,
      freeCount: free.length,
      inactiveCount: inactive.length,
      revenue: totalRev,
      subInvoicesList
    };
  }, [clinics, invoices]);

  const filteredClinics = useMemo(() => {
    if (filter === 'all') return clinics;
    if (filter === 'active') return clinics.filter(c => c.subscription_status === 'active');
    if (filter === 'free_plan') return clinics.filter(c => c.subscription_status === 'free_plan');
    return clinics.filter(c => !['active', 'free_plan'].includes(c.subscription_status || ''));
  }, [clinics, filter]);

  const handleUpdateStatus = async (clinic: Clinic, newStatus: string) => {
    if (!window.confirm(`Are you sure you want to change the subscription status to ${newStatus}?`)) return;
    
    setUpdatingId(clinic.clinic_id);
    try {
      const now = serverTimestamp();
      const updates: any = {
        subscription_status: newStatus,
        subscription_updated_at: now,
      };
      
      if (newStatus === 'active') updates.subscription_activated_at = now;
      if (newStatus === 'deactivated') updates.subscription_deactivated_at = now;
      if (newStatus === 'cancelled') updates.subscription_cancelled_at = now;
      if (newStatus === 'free_plan') {
        updates.subscription_activated_at = now;
        updates.subscription_plan = 'Free Tier';
      }

      await updateDoc(doc(db, 'clinics', clinic.clinic_id), updates);
      
      const userQ = query(collection(db, 'users'), where('clinic_id', '==', clinic.clinic_id));
      const userSnaps = await getDocs(userQ);
      const userUpdatePromises = userSnaps.docs.map(userDoc => {
        return updateDoc(doc(db, 'users', userDoc.id), {
          clinic_subscription_status: newStatus === 'free_plan' ? 'active' : newStatus
        });
      });
      await Promise.all(userUpdatePromises);
      
      if (clinic.owner_user_id && !userSnaps.docs.some(d => d.id === clinic.owner_user_id)) {
        await updateDoc(doc(db, 'users', clinic.owner_user_id), {
          clinic_subscription_status: newStatus === 'free_plan' ? 'active' : newStatus
        });
      }
      
    } catch (error) {
      console.error('Error updating subscription status:', error);
      alert('Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSendPaymentRequest = async (clinic: Clinic) => {
    if (!window.confirm(`Are you sure you want to send a subscription payment request to ${clinic.name}?`)) return;
    
    setUpdatingId(clinic.clinic_id);
    try {
      // Create a pending subscription invoice for the clinic
      const invoiceRef = doc(collection(db, 'invoices'));
      await updateDoc(invoiceRef, {
        id: invoiceRef.id, // For fallback creation if setting newly, but we should use setDoc.
      }).catch(async () => {
        // If updateDoc fails (document doesn't exist), use setDoc. Since we generated the ref it won't exist.
        const { setDoc } = await import('firebase/firestore');
        await setDoc(invoiceRef, {
          id: invoiceRef.id,
          clinic_id: clinic.clinic_id,
          clinic_name: clinic.name,
          type: 'subscription',
          status: 'pending',
          amount: 1999, // default plan price
          total_amount: 1999,
          plan_name: 'Pro Plan',
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
          description: 'Platform Subscription Payment Request',
        });
      });
      const paymentLink = `${window.location.origin}/clinic/subscription-setup?invoice=${invoiceRef.id}`;
      
      try {
        await navigator.clipboard.writeText(paymentLink);
        alert(`Payment request sent! Payment link copied to clipboard:\n\n${paymentLink}`);
      } catch (err) {
        alert(`Payment request sent! Here is the link to share with the clinic:\n\n${paymentLink}`);
      }
    } catch (error) {
      console.error('Error sending payment request:', error);
      alert('Failed to send payment request');
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  };

  const formatRupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink">Live Subscriptions & Revenue</h1>
          <p className="text-sm text-ink-muted">Manage active plans, track lifetime revenue, and review subscriber history.</p>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-primary text-white border-none shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider">Total Paid Revenue</p>
            <Wallet size={16} className="text-white/70" />
          </div>
          <p className="text-2xl font-bold mt-1">{formatRupees(metrics.revenue)}</p>
          <p className="text-xs text-white/70 mt-1">Live subscription payments</p>
        </div>
        <div className="card border border-primary/20 bg-primary/5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-primary text-xs font-semibold uppercase tracking-wider">Active Plans</p>
            <Activity size={16} className="text-primary" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{metrics.activeCount}</p>
          <p className="text-xs text-ink-subtle mt-1">Paying clinics</p>
        </div>
        <div className="card border border-black/5 bg-surface shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-ink-muted text-xs font-semibold uppercase tracking-wider">Free / Trial Plans</p>
            <Gift size={16} className="text-ink-subtle" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{metrics.freeCount}</p>
          <p className="text-xs text-ink-subtle mt-1">Promotional access</p>
        </div>
        <div className="card border border-orange-500/20 bg-orange-50 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-orange-700 text-xs font-semibold uppercase tracking-wider">Inactive / Cancelled</p>
            <Pause size={16} className="text-orange-500" />
          </div>
          <p className="text-2xl font-bold text-ink mt-1">{metrics.inactiveCount}</p>
          <p className="text-xs text-ink-subtle mt-1">Require follow-up</p>
        </div>
      </div>

      {/* Main Clinic Subscriptions Table */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'all' ? 'bg-ink text-white' : 'bg-surface-elevated text-ink-muted hover:bg-black/5'}`}>
            All Clinics ({clinics.length})
          </button>
          <button onClick={() => setFilter('active')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'active' ? 'bg-primary text-white' : 'bg-surface-elevated text-ink-muted hover:bg-primary-50 hover:text-primary'}`}>
            Active
          </button>
          <button onClick={() => setFilter('free_plan')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'free_plan' ? 'bg-blue-600 text-white' : 'bg-surface-elevated text-ink-muted hover:bg-blue-50 hover:text-blue-600'}`}>
            Free Tier
          </button>
          <button onClick={() => setFilter('inactive')} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${filter === 'inactive' ? 'bg-orange-500 text-white' : 'bg-surface-elevated text-ink-muted hover:bg-orange-50 hover:text-orange-600'}`}>
            Inactive / Cancelled
          </button>
        </div>

        <DataTable
          headers={['Clinic Name', 'Current Status', 'Activated At', 'Stopped At', 'Quick Actions']}
          empty={filteredClinics.length === 0}
          emptyLabel="No clinics match this filter."
          hiddenFrom={[null, null, 'sm', 'md', null]}
        >
          {filteredClinics.map(clinic => (
            <tr key={clinic.clinic_id} className="hover:bg-surface/60 transition-colors">
              <td className="px-4 py-3">
                <p className="font-semibold text-ink text-sm truncate max-w-[200px]">{clinic.name}</p>
                <p className="text-xs text-ink-subtle truncate max-w-[200px] font-mono">{clinic.clinic_id}</p>
              </td>
              <td className="px-4 py-3">
                <StatusBadge text={clinic.subscription_status || 'pending'} />
              </td>
              <td className="px-4 py-3 text-ink-muted text-xs hidden sm:table-cell">
                {formatDate(clinic.subscription_activated_at)}
              </td>
              <td className="px-4 py-3 text-ink-muted text-xs hidden md:table-cell">
                {clinic.subscription_status === 'deactivated' 
                  ? formatDate(clinic.subscription_deactivated_at) 
                  : clinic.subscription_status === 'cancelled' 
                    ? formatDate(clinic.subscription_cancelled_at) 
                    : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleSendPaymentRequest(clinic)} disabled={updatingId === clinic.clinic_id} title="Send Payment Request" className="p-1.5 hover:bg-purple-100 hover:text-purple-700 text-ink-subtle rounded-md transition-colors disabled:opacity-50">
                    <Send size={16} />
                  </button>
                  <button onClick={() => handleUpdateStatus(clinic, 'active')} disabled={updatingId === clinic.clinic_id || clinic.subscription_status === 'active'} title="Activate Pro Plan" className="p-1.5 hover:bg-green-100 hover:text-green-700 text-ink-subtle rounded-md transition-colors disabled:opacity-50">
                    <Play size={16} />
                  </button>
                  <button onClick={() => handleUpdateStatus(clinic, 'free_plan')} disabled={updatingId === clinic.clinic_id || clinic.subscription_status === 'free_plan'} title="Grant Free Plan" className="p-1.5 hover:bg-blue-100 hover:text-blue-700 text-ink-subtle rounded-md transition-colors disabled:opacity-50">
                    <Gift size={16} />
                  </button>
                  <button onClick={() => handleUpdateStatus(clinic, 'deactivated')} disabled={updatingId === clinic.clinic_id || clinic.subscription_status === 'deactivated'} title="Deactivate" className="p-1.5 hover:bg-orange-100 hover:text-orange-700 text-ink-subtle rounded-md transition-colors disabled:opacity-50">
                    <Pause size={16} />
                  </button>
                  <button onClick={() => handleUpdateStatus(clinic, 'cancelled')} disabled={updatingId === clinic.clinic_id || clinic.subscription_status === 'cancelled'} title="Cancel" className="p-1.5 hover:bg-red-100 hover:text-red-700 text-ink-subtle rounded-md transition-colors disabled:opacity-50">
                    <XCircle size={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* Subscription History Logs */}
      <div className="pt-6 border-t border-divider">
        <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <History className="text-ink-muted" size={20} /> Subscription Event History
        </h2>
        <DataTable
          headers={['Record ID', 'Clinic Context', 'Plan / Action', 'Date']}
          empty={subscriptions.length === 0}
          emptyLabel="No deep subscription history logs available."
          hiddenFrom={[null, null, null, null]}
        >
          {subscriptions.map((sub: any) => (
            <tr key={sub.id} className="hover:bg-surface/60 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">{sub.id}</td>
              <td className="px-4 py-3 text-sm font-semibold text-ink">{sub.clinic_name || sub.clinic_id || '—'}</td>
              <td className="px-4 py-3">
                <StatusBadge text={sub.status || sub.plan_name || 'historical'} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(sub.created_at || sub.updated_at)}</td>
            </tr>
          ))}
        </DataTable>
      </div>

      {/* Subscription Invoices */}
      <div className="pt-6 border-t border-divider">
        <h2 className="text-lg font-bold text-ink mb-4 flex items-center gap-2">
          <CreditCard className="text-ink-muted" size={20} /> Live Subscription Invoices
        </h2>
        <DataTable
          headers={['Invoice ID', 'Clinic', 'Amount', 'Status', 'Date', 'Action']}
          empty={metrics.subInvoicesList.length === 0}
          emptyLabel="No subscription invoices found."
          hiddenFrom={[null, null, null, null, null]}
        >
          {metrics.subInvoicesList.map((inv: any) => (
            <tr key={inv.id} className="hover:bg-surface/60 transition-colors">
              <td className="px-4 py-3 font-mono text-xs text-ink-muted">{inv.invoice_number || inv.id}</td>
              <td className="px-4 py-3 text-sm font-semibold text-ink">{inv.clinic_name || inv.clinic_id || '—'}</td>
              <td className="px-4 py-3 text-sm font-bold text-ink">{formatRupees(inv.amount || inv.total_amount || 0)}</td>
              <td className="px-4 py-3">
                <StatusBadge text={inv.status || inv.payment_status || 'pending'} />
              </td>
              <td className="px-4 py-3 text-xs text-ink-muted">{formatDate(inv.created_at)}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => {
                    const paymentLink = `${window.location.origin}/clinic/subscription-setup?invoice=${inv.id}`;
                    navigator.clipboard.writeText(paymentLink).then(() => alert('Link copied!')).catch(() => alert(`Here is the link: ${paymentLink}`));
                  }}
                  title="Copy Payment Link"
                  className="p-1.5 hover:bg-surface-elevated text-ink-muted hover:text-ink rounded-md transition-colors"
                >
                  <Copy size={16} />
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </div>
    </div>
  );
}
