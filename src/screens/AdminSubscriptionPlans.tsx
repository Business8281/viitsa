import React, { useState, useEffect } from 'react';
import { Crown, CheckCircle2, CalendarClock, Building2, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { DEFAULT_PLANS, ensureDefaultPlansSeeded } from '../lib/entitlementsService';
import type { SubscriptionPlan } from '../lib/types';

export default function AdminSubscriptionPlans() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    ensureDefaultPlansSeeded().then((res) => {
      if (res && res.length > 0) setPlans(res);
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
            <span>Subscription Tier Catalog (Spec v1.0)</span>
          </h1>
          <p className="text-sm text-ink-muted">
            Config-driven plans, limits, and allowances for Viitsa Clinics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Config-Driven Firestore
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl">
        {plans.map((plan) => (
          <div 
            key={plan.id}
            className={`bg-white border rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-between ${
              plan.popular ? 'border-primary ring-2 ring-primary/20' : 'border-black/5'
            }`}
          >
            {plan.popular && (
              <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Most Popular
              </div>
            )}
            {(plan.is_custom_quote || plan.code === 'hospital') ? (
              <div className="absolute top-0 right-0 bg-teal-700 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl shadow-xs">
                Custom Quote
              </div>
            ) : plan.coming_soon ? (
              <div className="absolute top-0 right-0 bg-slate-500 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                Coming Soon
              </div>
            ) : null}
            
            <div>
              <div className="mb-4">
                <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                  <Crown size={18} className={plan.popular ? 'text-accent' : (plan.is_custom_quote || plan.code === 'hospital') ? 'text-teal-700' : 'text-primary'} />
                  {plan.name}
                </h3>
                <p className="text-ink-subtle text-xs mt-1 leading-relaxed">{plan.description}</p>
              </div>
              
              <div className="mb-6 pb-6 border-b border-black/5">
                {(plan.is_custom_quote || plan.code === 'hospital') ? (
                  <div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-bold text-ink">Custom Quote</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-teal-800 font-medium text-xs mt-1 bg-teal-50 px-2 py-1 rounded-lg inline-flex border border-teal-100">
                      <CalendarClock size={12} className="text-teal-600" />
                      Tailored SLA & Deployment
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span className="text-2xl font-bold text-ink">₹{plan.monthly_price_inr.toLocaleString('en-IN')}</span>
                      <span className="text-ink-subtle text-xs mb-1">/ month</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-primary font-medium text-xs mt-1 bg-primary/5 px-2 py-1 rounded-lg inline-flex">
                      <CalendarClock size={12} />
                      Annual: ₹{plan.annual_price_inr.toLocaleString('en-IN')}/yr
                    </div>
                  </>
                )}
              </div>
              
              <div className="space-y-2 mb-6 text-xs">
                <div className="font-semibold text-ink-subtle uppercase text-[10px] tracking-wider mb-2">Entitlements</div>
                <div className="flex justify-between py-1 border-b border-black/5">
                  <span className="text-ink-subtle">Doctors</span>
                  <span className="font-bold text-ink">{plan.limits.doctors_included} included</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/5">
                  <span className="text-ink-subtle">Staff Seats</span>
                  <span className="font-bold text-ink">{plan.limits.staff_seats_included} included</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/5">
                  <span className="text-ink-subtle">AI Intakes</span>
                  <span className="font-bold text-ink">{plan.limits.ai_intakes_monthly.toLocaleString()} / mo</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/5">
                  <span className="text-ink-subtle">WhatsApp</span>
                  <span className="font-bold text-ink">{plan.limits.whatsapp_messages_monthly.toLocaleString()} / mo</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-ink-subtle">Storage</span>
                  <span className="font-bold text-emerald-600">Unlimited</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-black/5">
              <span className="text-[11px] text-ink-muted block text-center font-medium">
                SLA: {plan.features.sla_support.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
