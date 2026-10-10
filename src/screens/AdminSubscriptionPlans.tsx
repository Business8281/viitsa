import React from 'react';
import { Crown, CheckCircle2, CalendarClock, Building2 } from 'lucide-react';

export default function AdminSubscriptionPlans() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
          <span>Subscription Plans</span>
        </h1>
        <p className="text-sm text-ink-muted">Manage available pricing plans for clinics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl">
        {/* Clinic Pro Plan */}
        <div className="bg-white border border-black/5 rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col h-full">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary to-accent"></div>
          
          <div className="mb-4">
            <h3 className="text-lg font-bold text-ink flex items-center gap-2">
              <Crown size={18} className="text-accent" />
              Clinic Pro Plan
            </h3>
            <p className="text-ink-subtle text-xs mt-1">Perfect for clinics exploring AI-powered operations.</p>
          </div>
          
          <div className="mb-6 pb-6 border-b border-black/5">
            <div className="flex items-end gap-1 mb-1">
              <span className="text-3xl font-bold text-ink">Free</span>
              <span className="text-ink-subtle text-sm mb-1">/ 30 days</span>
            </div>
            <div className="flex items-center gap-1.5 text-primary font-medium text-xs mt-2 bg-primary/5 px-2 py-1.5 rounded-lg inline-flex">
              <CalendarClock size={14} />
              ₹2,999/month after trial
            </div>
          </div>
          
          <ul className="space-y-3 mb-8 flex-1">
            {[
              'Up to 3 staff accounts',
              'AI Health Navigator',
              'Appointment management',
              'Basic analytics',
              'WhatsApp reminders'
            ].map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                <span className="text-sm text-ink leading-tight">{feature}</span>
              </li>
            ))}
          </ul>
          
          <button className="w-full btn-ghost border border-black/10 text-sm py-2 pointer-events-none opacity-80">
            Current Default Plan
          </button>
        </div>
        
        {/* Placeholder for future plans */}
        <div className="border-2 border-dashed border-black/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center opacity-60">
          <Building2 size={32} className="text-ink-subtle mb-3" />
          <h3 className="text-base font-semibold text-ink">Add Custom Plan</h3>
          <p className="text-xs text-ink-subtle mt-1 mb-4">Create Enterprise or specific usage-based plans.</p>
          <button className="btn-primary text-xs py-1.5 px-4 shadow-sm" onClick={() => alert('Custom plan builder coming soon')}>
            Create New Plan
          </button>
        </div>
      </div>
    </div>
  );
}
