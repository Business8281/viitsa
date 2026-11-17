import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Lock, Server, FileCheck, AlertTriangle, Eye, CheckCircle2, Shield, Cpu, RefreshCw } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function HIPAAPage() {
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
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
                <ShieldCheck size={14} /> Security & Compliance Architecture
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                Security Architecture & Compliance Framework
              </h1>
              <p className="text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed">
                Operated by <strong>TIV Technologies Private Limited</strong> (Brand: <strong>VIITSA</strong>). This document details our technical security controls, data encryption architecture, incident response protocols, and alignment with national and international health data standards.
              </p>
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10 text-xs text-slate-400">
                <span><strong>Security Baseline:</strong> TLS 1.3 In-Transit • AES-256 At-Rest</span>
                <span><strong>Frameworks:</strong> DPDPA 2023 • ABDM HDMP Architecture • HIPAA Security Rule Alignment</span>
                <span><strong>Auditing:</strong> Immutable Append-Only Audit Logging</span>
                <span><strong>Last Updated:</strong> October 2026</span>
              </div>
            </div>
          </div>

          {/* Core Content Document */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-14 space-y-12 text-slate-700 leading-relaxed">

            {/* 1. Section 12 Security Requirements */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">1</div>
                <h2 className="text-2xl font-bold text-slate-900">Technical Security Policy & Controls</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  In accordance with <strong>Section 12 of the VIITSA Compliance Specification</strong>, our platform enforces comprehensive administrative, physical, and technical safeguards across our infrastructure:
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1 flex items-center gap-2">
                      <Lock size={15} className="text-emerald-500" /> End-to-End Cryptographic Protection
                    </strong>
                    <span className="text-xs text-slate-500">Enforced TLS/HTTPS (TLS 1.3) for 100% of production data in transit. AES-256 bit encryption at rest for all database volumes, file vaults, and backups.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1 flex items-center gap-2">
                      <Server size={15} className="text-blue-500" /> Multi-Tenant Isolation
                    </strong>
                    <span className="text-xs text-slate-500">Logical and cryptographic tenant isolation separating clinical data between organizations. Strict least-privilege role boundaries between reception, doctor, and admin accounts.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1 flex items-center gap-2">
                      <Eye size={15} className="text-purple-500" /> Immutable Audit Trails
                    </strong>
                    <span className="text-xs text-slate-500">Tamper-evident audit logging recording authentication, privileged administrative actions, clinical record access, exports, record deletions, and consent changes.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1 flex items-center gap-2">
                      <Shield size={15} className="text-teal-500" /> Secure Secrets & API Defenses
                    </strong>
                    <span className="text-xs text-slate-500">Zero database credentials or API secret keys in client-side bundles. Comprehensive input validation, parameterized queries, rate limiting, and automated bot mitigation.</span>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 2. Section 13 Incident Response */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">2</div>
                <h2 className="text-2xl font-bold text-slate-900">Security Incident & Breach Response Protocol</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  As mandated by <strong>Section 13 of the Compliance Specification</strong>, VIITSA operates a documented incident response lifecycle to handle suspected security anomalies, unauthorized access, or data corruption:
                </p>
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs text-slate-700 space-y-2.5">
                  <p>• <strong>Phase 1: Detection & Triage:</strong> Automated SIEM alerting and intrusion monitoring trigger immediate classification by our engineering security team.</p>
                  <p>• <strong>Phase 2: Containment & Evidence Preservation:</strong> Immediate credential revocation, network isolation of affected nodes, and preservation of cryptographic audit logs.</p>
                  <p>• <strong>Phase 3: Remediation & Recovery:</strong> Patch deployment, state verification, and safe restoration from verified immutable backups.</p>
                  <p>• <strong>Phase 4: Statutory Notification:</strong> Notification to affected data fiduciaries, regulatory bodies (e.g., CERT-In), and users in full adherence with applicable Indian notification laws.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 3. Section 8 Clinic & Doctor Verification */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">3</div>
                <h2 className="text-2xl font-bold text-slate-900">Clinic & Doctor Verification Policy</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  To ensure platform integrity and patient safety, VIITSA conducts formal verification before granting healthcare establishments and medical practitioners access to live clinical features:
                </p>
                <div className="grid sm:grid-cols-2 gap-4 my-2">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <strong className="text-slate-900 block font-semibold text-sm">Clinic Documentation Required:</strong>
                    <p>• Registered establishment legal business name and registered address.</p>
                    <p>• Clinical establishment licence / local municipal health permit where applicable.</p>
                    <p>• Authorized signatory identity proof and operational authorization.</p>
                    <p>• Business tax documentation (GSTIN / PAN) for verified billing.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <strong className="text-slate-900 block font-semibold text-sm">Doctor Documentation Required:</strong>
                    <p>• Full professional name and recognized medical qualification degrees.</p>
                    <p>• Medical council registration number (State Medical Council or NMC).</p>
                    <p>• Government photo identification (Aadhaar / Passport / Voter ID).</p>
                    <p>• Documented proof of association with the listed clinic.</p>
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900">
                  <strong>Verification Badge Clarification:</strong> A 'Verified' badge on VIITSA signifies solely that the provider has submitted required legal credentials and passed VIITSA's documentation check. It does not constitute a government endorsement or a guarantee of medical outcomes.
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 4. Section 28 Compliance Claims Matrix */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">4</div>
                <h2 className="text-2xl font-bold text-slate-900">Compliance & Regulatory Claims Matrix</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  In accordance with <strong>Section 28 of the Legal Handover Document</strong>, VIITSA publishes this transparent Claims Matrix outlining our exact positioning and regulatory commitments:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-900 font-bold">
                      <tr>
                        <th className="p-3 border-b border-slate-200">Framework / Topic</th>
                        <th className="p-3 border-b border-slate-200">Our Verified Architectural Status</th>
                        <th className="p-3 border-b border-slate-200">What We Strictly Do NOT Claim</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="p-3 font-semibold text-slate-800">ABDM Integration</td>
                        <td className="p-3 text-slate-600">Architected for future interoperability with Indian digital health standards and future ABDM milestones, subject to technical validation and onboarding.</td>
                        <td className="p-3 text-rose-700">Does NOT claim government-endorsed, ABDM-certified, or official government partner prior to completed formal sandbox audit.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-800">DPDPA 2023</td>
                        <td className="p-3 text-slate-600">Privacy and data processing architecture engineered in alignment with India's Digital Personal Data Protection Act, 2023 and DPDPA Rules 2025.</td>
                        <td className="p-3 text-rose-700">Does NOT claim statutory certification where no such government certificate exists.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-800">Security & Encryption</td>
                        <td className="p-3 text-slate-600">TLS 1.3 in-transit encryption, AES-256 at-rest database encryption, RBAC least privilege, and immutable audit logging.</td>
                        <td className="p-3 text-rose-700">Does NOT claim "100% immune from hacking" or unsubstantiated military claims.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-800">AI Capabilities</td>
                        <td className="p-3 text-slate-600">AI-assisted navigation and clinical brief generation with mandatory human clinical doctor review.</td>
                        <td className="p-3 text-rose-700">Does NOT claim autonomous AI doctor, guaranteed cures, or robotic medical prescriptions.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-800">HIPAA Security Alignment</td>
                        <td className="p-3 text-slate-600">Cloud database architecture aligns with HIPAA Security Rule safeguards regarding data encryption, audit controls, and access integrity.</td>
                        <td className="p-3 text-rose-700">Does NOT claim sovereign US healthcare authority jurisdiction in India without cross-border agreements.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 5. Responsible Disclosure */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">5</div>
                <h2 className="text-2xl font-bold text-slate-900">Responsible Security Disclosure</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  Security researchers and users who identify potential vulnerabilities are encouraged to report findings responsibly. We investigate all credible reports promptly and adhere to coordinated vulnerability disclosure principles.
                </p>
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-sm space-y-1">
                  <p className="font-semibold text-slate-800">TIV Technologies Private Limited (VIITSA)</p>
                  <p className="text-slate-600">Information Security & Vulnerability Operations</p>
                  <p className="text-slate-600">Security Email: <a href="mailto:security@viitsa.com" className="text-indigo-600 font-medium">security@viitsa.com</a> / <a href="mailto:support@viitsa.com" className="text-indigo-600 font-medium">support@viitsa.com</a></p>
                  <p className="text-slate-600">General Support: <a href="mailto:support@viitsa.com" className="text-indigo-600 font-medium">support@viitsa.com</a></p>
                  <p className="text-slate-600">Website: <a href="https://viitsa.com" className="text-indigo-600 font-medium">viitsa.com</a></p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
