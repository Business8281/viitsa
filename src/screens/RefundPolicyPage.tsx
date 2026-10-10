import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, RotateCcw, AlertCircle, CheckCircle2, FileText, HelpCircle, ShieldAlert } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function RefundPolicyPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-100 sticky top-0 z-50">
        <div className="w-[90%] max-w-[1400px] mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
          <ViitsaLogo size="md" />
          <button
            onClick={() => navigate('/')}
            className="text-sm font-semibold text-slate-700 hover:text-emerald-600 flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-slate-50 border border-slate-200 transition-all"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </header>

      <main className="flex-1 py-12 sm:py-16 px-4">
        <div className="w-[90%] max-w-[1200px] mx-auto">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-4">
                <CreditCard size={14} /> Section 16A Compliance Specification
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                Refund, Cancellation & Billing Policy
              </h1>
              <p className="text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed">
                This policy governs digital services, clinic software subscriptions, and transactions offered by <strong>VIITSA</strong> under <strong>TIV Technologies Private Limited</strong>. It defines transparent pricing, cancellation procedures, and refund eligibility under the Consumer Protection Act, 2019.
              </p>
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10 text-xs text-slate-400">
                <span><strong>Operator:</strong> TIV Technologies Private Limited</span>
                <span><strong>Brand:</strong> VIITSA</span>
                <span><strong>Framework:</strong> Consumer Protection (E-Commerce) Rules, 2020</span>
                <span><strong>Last Updated:</strong> October 2026</span>
              </div>
            </div>
          </div>

          {/* Core Content Document */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-14 space-y-12 text-slate-700 leading-relaxed">

            {/* 16A.1 Scope */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">1</div>
                <h2 className="text-2xl font-bold text-slate-900">Scope of Policy</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  This Refund, Cancellation and Payment Policy applies to all paid digital services offered directly by VIITSA under <strong>TIV Technologies Private Limited</strong>. This includes VIITSA SaaS clinic subscriptions, monthly/annual software plans, clinic multi-staff tiers, add-on automated WhatsApp/SMS packs, and technical digital infrastructure fees where VIITSA is the primary contracting service provider.
                </p>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <strong>Third-Party Healthcare Charges:</strong> This policy does not automatically govern independent consultation fees, physical diagnostic laboratory charges, hospital inpatient bills, pharmacy medicine purchases, or clinical treatments billed directly by autonomous healthcare establishments or doctors. Refunds for third-party medical care are governed by the respective provider's stated clinical terms.
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.2 Transparent Pricing */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">2</div>
                <h2 className="text-2xl font-bold text-slate-900">Transparent Pricing & Billing Terms</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  Prior to capturing payment, VIITSA clearly displays all commercial details during the subscription setup and checkout flow:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Specific plan tier (e.g. Starter Pilot 30-day trial, Pro Clinic ₹2,999/month, or Enterprise).</li>
                  <li>Billing frequency (Monthly, Quarterly, or Annually) and exact renewal dates.</li>
                  <li>Applicable Goods and Services Tax (GST) and statutory government levies.</li>
                  <li>Included platform features, doctor account quotas, storage capacity, and technical limits.</li>
                  <li>Clear instructions regarding cancellation mechanisms and refund eligibility windows.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.3 Subscription Cancellation */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">3</div>
                <h2 className="text-2xl font-bold text-slate-900">Subscription Cancellation</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  Clinic Administrators may initiate subscription cancellation at any time directly through the clinic billing settings dashboard or by notifying official VIITSA support via email at <span className="font-mono text-emerald-600">support@viitsa.com</span>.
                </p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2">
                  <p>• <strong>Halting Future Renewals:</strong> Cancellation stops recurring automatic renewals for all future billing cycles.</p>
                  <p>• <strong>Active Access Until Expiry:</strong> Unless a specific agreement dictates otherwise, cancellation does not prematurely terminate an active cycle. Full software access remains operational until the expiration of the already-paid billing period.</p>
                  <p>• <strong>No Automatic Mid-Cycle Pro-Rata Refunds:</strong> Cancellation of a subscription does not automatically generate a cash refund for days remaining in the active paid cycle.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.4 Refund Eligibility & 16A.5 Non-Refundable */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">4</div>
                <h2 className="text-2xl font-bold text-slate-900">Refund Eligibility & Non-Refundable Scenarios</h2>
              </div>
              <div className="pl-13 space-y-4 text-slate-600 text-sm">
                <div className="space-y-2">
                  <h3 className="font-bold text-slate-900 text-base">Eligible Refund Scenarios:</h3>
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
                      <strong className="text-emerald-950 block text-sm font-semibold">Duplicate / Erroneous Billing</strong>
                      <span className="text-emerald-800">You were charged twice for the same billing cycle or an erroneous billing amount occurred due to a gateway sync discrepancy.</span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
                      <strong className="text-emerald-950 block text-sm font-semibold">Technical Provisioning Failure</strong>
                      <span className="text-emerald-800">Payment was successfully debited but software features were not unlocked due to a VIITSA platform defect that could not be rectified.</span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
                      <strong className="text-emerald-950 block text-sm font-semibold">Prolonged Platform Outage</strong>
                      <span className="text-emerald-800">Verified prolonged platform unavailability caused by VIITSA server failures that substantially prevented normal clinic operations.</span>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-1">
                      <strong className="text-emerald-950 block text-sm font-semibold">Statutory Requirements</strong>
                      <span className="text-emerald-800">Where a refund is explicitly mandated by Indian consumer protection laws or regulatory directives.</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h3 className="font-bold text-slate-900 text-base">Non-Refundable Scenarios:</h3>
                  <ul className="list-disc pl-5 space-y-1 text-xs">
                    <li>Fees for billing cycles already substantially elapsed or fully utilized.</li>
                    <li>Voluntary lack of usage, clinic internal staffing changes, or subjective changes of business preference.</li>
                    <li>Dedicated setup, implementation, data migration, or custom branding charges once engineering delivery has commenced.</li>
                    <li>Account suspensions resulting from verified fraud, forged medical registrations, or violation of our Terms of Use.</li>
                  </ul>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.6 Failed & Duplicate Payments */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">5</div>
                <h2 className="text-2xl font-bold text-slate-900">Failed, Duplicate or Unauthorised Payments</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  If an amount is debited from your bank account, card, or UPI application but the VIITSA platform displays a pending or failed status, <strong>do not execute repeated payments immediately</strong>. Transaction states typically reconcile automatically with our payment gateway within 15–30 minutes.
                </p>
                <p>
                  Any verified duplicate charges captured by our payment aggregator will be reconciled and refunded automatically back to the original source without requiring penalty fees.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.7 Request Procedure & 16A.8 Processing Timelines */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">6</div>
                <h2 className="text-2xl font-bold text-slate-900">Refund Request Procedure & Processing Timeline</h2>
              </div>
              <div className="pl-13 space-y-4 text-slate-600 text-sm">
                <p>To submit an eligible refund request, please provide the following details:</p>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1 font-mono">
                  <p>1. Registered Clinic Name & Account ID</p>
                  <p>2. Registered Phone Number & Email Address</p>
                  <p>3. Transaction Reference ID / Payment Gateway Order ID</p>
                  <p>4. Payment Date and Exact Debited Amount (₹)</p>
                  <p>5. Comprehensive reason for the refund request</p>
                </div>
                <p>
                  Send this information directly to: <a href="mailto:support@viitsa.com" className="text-emerald-600 font-bold">support@viitsa.com</a>
                </p>
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950">
                  <strong>Processing SLA:</strong> Our billing team will review eligible submissions within <strong>2 business days</strong>. Once approved, the refund is initiated through the original payment gateway route. Funds typically credit back to your original source (Bank, UPI, or Credit Card) within <strong>5 to 7 business days</strong> depending on your issuing bank's settlement cycle.
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 16A.12 Consumer Protection Safeguards */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">7</div>
                <h2 className="text-2xl font-bold text-slate-900">Statutory Consumer Safeguards</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  Nothing in this Refund, Cancellation and Payment Policy is intended to restrict, exclude, or limit statutory consumer rights and remedies provided under the <strong>Consumer Protection Act, 2019</strong> and the <strong>Consumer Protection (E-Commerce) Rules, 2020</strong>.
                </p>
                <p>
                  VIITSA's billing systems maintain immutable cryptographic audit records of all invoices, authorization events, payment timestamps, and refund transactions for auditing and financial compliance.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Support Inquiries */}
            <section className="space-y-3 pt-2">
              <h3 className="text-lg font-bold text-slate-900">Billing & Refund Assistance</h3>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-sm space-y-1">
                <p className="font-semibold text-slate-800">TIV Technologies Private Limited (VIITSA)</p>
                <p className="text-slate-600">Billing & Customer Operations</p>
                <p className="text-slate-600">Email: <a href="mailto:support@viitsa.com" className="text-emerald-600 font-medium">support@viitsa.com</a></p>
                <p className="text-slate-600">Website: <a href="https://viitsa.com" className="text-emerald-600 font-medium">viitsa.com</a></p>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
