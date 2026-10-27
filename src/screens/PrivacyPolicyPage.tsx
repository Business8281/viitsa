import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Lock, FileText, CheckCircle2, UserCheck, Database, Scale, Mail, AlertCircle } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function PrivacyPolicyPage() {
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
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/20 border border-teal-500/30 text-teal-300 text-xs font-semibold uppercase tracking-wider mb-4">
                <Shield size={14} /> Data Protection & Privacy Framework
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                Privacy Policy & Health Data Governance
              </h1>
              <p className="text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed">
                Operated by <strong>TIV Technologies Private Limited</strong> under the brand <strong>VIITSA</strong>. This Privacy Policy details our technical architecture, data handling safeguards, user rights, and compliance with the <strong>Digital Personal Data Protection Act (DPDPA), 2023</strong> and national digital health frameworks.
              </p>
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10 text-xs text-slate-400">
                <span><strong>Data Fiduciary:</strong> TIV Technologies Private Limited</span>
                <span><strong>Platform:</strong> VIITSA</span>
                <span><strong>Regulatory Scope:</strong> DPDPA 2023 • DPDPA Rules 2025 • IT Act 2000 • ABDM HDMP</span>
                <span><strong>Last Updated:</strong> October 2026</span>
              </div>
            </div>
          </div>

          {/* Core Privacy Document */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-14 space-y-12 text-slate-700 leading-relaxed">

            {/* 1. Scope & Categories of Data */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">1</div>
                <h2 className="text-2xl font-bold text-slate-900">Categories of Information Processed</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600">
                <p>
                  VIITSA processes various categories of personal and digital data depending on whether you interact as a Patient, Clinic Administrator, Healthcare Practitioner, or Receptionist. <strong>All patient health information is classified and treated as High-Sensitivity Data within VIITSA's security architecture.</strong>
                </p>
                <div className="grid sm:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Identity & Contact Data</strong>
                    <span className="text-xs text-slate-500">Full legal name, phone number, email address, date of birth, gender, and emergency contact details.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Health & Clinical Data (High Sensitivity)</strong>
                    <span className="text-xs text-slate-500">Patient-described symptoms, clinical summaries, consultation history, digital prescriptions, vitals, diagnostic laboratory reports, and AI triage summaries.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Clinic & Professional Credentials</strong>
                    <span className="text-xs text-slate-500">Clinical establishment licences, medical registration numbers, State Medical Council records, doctor qualifications, and clinic billing setup.</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Technical, Security & Device Logs</strong>
                    <span className="text-xs text-slate-500">IP addresses, browser type, device identifiers, session timestamps, OTP verification events, and immutable system audit logs.</span>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 2. Purposes of Processing */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">2</div>
                <h2 className="text-2xl font-bold text-slate-900">Purposes of Data Processing</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>We process personal and health data strictly for the following defined, lawful purposes:</p>
                <ul className="grid sm:grid-cols-2 gap-2.5 list-disc pl-5">
                  <li>Creating, authenticating, and maintaining user and clinic accounts.</li>
                  <li>Scheduling, modifying, and tracking clinic and doctor appointments.</li>
                  <li>Delivering end-to-end clinic management and patient-facing workflows.</li>
                  <li>Storing, structuring, and displaying clinical records submitted by users or authorized clinics.</li>
                  <li>Operating the AI Health Navigator for symptom triage and doctor brief generation.</li>
                  <li>Two-factor authentication, cryptographic fraud prevention, and session security.</li>
                  <li>Transmitting appointment confirmations, reminders, and critical customer service alerts.</li>
                  <li>Executing billing, digital invoices, and accounting compliance where enabled.</li>
                  <li>Fulfilling statutory, regulatory, dispute-resolution, and legal obligations.</li>
                  <li>Generating aggregated, de-identified platform analytics where legally permissible.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 3. Consent & Transparency Framework */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">3</div>
                <h2 className="text-2xl font-bold text-slate-900">Consent & Transparency Architecture</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  In accordance with the <strong>Digital Personal Data Protection Act, 2023</strong>, consent must be free, specific, informed, unconditional, and unambiguous. VIITSA adheres to strict consent principles:
                </p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Unbundled Consent:</strong> Consent is never bundled with unrelated purposes merely to enable baseline functionality. Account registration, privacy notice acknowledgement, clinical data sharing, AI symptom assistance, and marketing notifications each require distinct, granular acknowledgement.</li>
                  <li><strong>Immutable Audit Trails:</strong> Consent records capture the authenticated user identifier, exact timestamp, policy version, and specific purpose. These consent logs are maintained as immutable audit events rather than editable database fields.</li>
                  <li><strong>Easy Consent Withdrawal:</strong> Users may withdraw optional consent at any time via account settings or by emailing our Grievance Officer, without affecting the lawfulness of processing carried out prior to withdrawal.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 4. Multi-Tenant Access Controls & Security */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">4</div>
                <h2 className="text-2xl font-bold text-slate-900">Tenant Isolation & Role-Based Access Controls</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  VIITSA enforces rigorous multi-tenant data architecture and Role-Based Access Control (RBAC) following the principle of least privilege:
                </p>
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-2 text-xs text-slate-700">
                  <p>• <strong>Strict Tenant Isolation:</strong> Patient records belonging to one clinic or medical organization are cryptographically and logically isolated from all other organizations on the platform.</p>
                  <p>• <strong>Role-Restricted Views:</strong> Receptionists and billing personnel do not possess default doctor-level access to clinical notes, medical histories, or SOAP summaries. Doctors only access records of patients under their care or scheduled at their clinic.</p>
                  <p>• <strong>Privileged Access Restrictions:</strong> Technical platform administrators do not possess open access to patient health data. Privileged operational access is restricted to verified maintenance routines, protected by multi-factor authentication, and subjected to audit logging.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 5. User Rights Under Indian Law */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">5</div>
                <h2 className="text-2xl font-bold text-slate-900">User Rights Under Indian Data Protection Law</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  Under the <strong>DPDPA, 2023</strong> and applicable regulations, you possess the following statutory rights regarding your personal data:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Right to Access & Summary:</strong> Request a summary of your personal data processed by VIITSA and the identities of any data processors with whom it has been shared.</li>
                  <li><strong>Right to Correction & Updating:</strong> Request the correction of misleading or inaccurate personal data and the completion of incomplete information.</li>
                  <li><strong>Right to Erasure:</strong> Request the erasure of personal data that is no longer necessary for the purpose for which it was gathered, subject to statutory medical retention obligations.</li>
                  <li><strong>Right to Grievance Redressal:</strong> Avail of an accessible grievance redressal mechanism provided by TIV Technologies Private Limited.</li>
                  <li><strong>Right to Nominate:</strong> Nominate another individual to exercise your data rights in the event of death or incapacity.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 6. Retention & Deletion Architecture */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">6</div>
                <h2 className="text-2xl font-bold text-slate-900">Data Retention & Deletion Architecture</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  VIITSA distinguishes between personal account data deletion and statutory medical record preservation:
                </p>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                  <p><strong>Clinical Records Retention:</strong> Medical records and clinical documentation managed on behalf of licensed healthcare establishments are not automatically deleted upon user account deactivation where applicable medical council guidelines, statutory laws, or clinical establishment regulations mandate minimum retention periods (e.g. 3 years from consultation).</p>
                  <p><strong>Account Deletion:</strong> Upon receiving an authenticated personal data erasure request, VIITSA anonymizes or deletes user credentials, marketing profiles, and non-statutory personal identifiers in accordance with applicable legal schedules.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 7. Third-Party Services & AI Processors */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">7</div>
                <h2 className="text-2xl font-bold text-slate-900">Third-Party Processors & AI Architecture</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  VIITSA utilizes reputable enterprise cloud, messaging, and AI providers under strict Data Processing Agreements (DPAs):
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Cloud & Database Hosting:</strong> Enterprise cloud infrastructure supporting TLS 1.3 encryption in transit and AES-256 encryption at rest.</li>
                  <li><strong>AI Processing (Groq / Enterprise LLMs):</strong> Symptom navigation prompts are routed through enterprise API endpoints protected by zero-retention and zero-training policies. <strong>Identifiable patient records are never utilized to train third-party artificial intelligence models.</strong></li>
                  <li><strong>Messaging & SMS:</strong> Transactional OTPs and appointment updates are delivered via authorized telecom aggregators under TRAI DLT regulations.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 8. Compliance & Regulatory Roadmap */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">8</div>
                <h2 className="text-2xl font-bold text-slate-900">Indian Compliance Framework & ABDM Roadmap</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  VIITSA's technical architecture is engineered in alignment with India's evolving digital health framework:
                </p>
                <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                  <p>• <strong>DPDPA, 2023 & DPDPA Rules, 2025:</strong> System architecture engineered with data fiduciary obligations, consent managers, and grievance mechanisms.</p>
                  <p>• <strong>Ayushman Bharat Digital Mission (ABDM):</strong> VIITSA is architected for future interoperability with Indian digital health standards and future ABDM milestone integrations, subject to technical sandbox validation, security assessments, and formal approvals.</p>
                  <p>• <strong>Information Technology Act, 2000 & SPDI Rules:</strong> Reasonable security practices and procedures maintained under Section 43A and Section 79.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 9. Grievance Officer & Contact Details */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold">9</div>
                <h2 className="text-2xl font-bold text-slate-900">Grievance Redressal Officer</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  In compliance with the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000, users may submit privacy inquiries, consent withdrawals, or data complaints to our designated Grievance Officer:
                </p>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-900 text-base">Grievance Redressal Officer</p>
                  <p className="text-slate-700"><strong>Company:</strong> TIV Technologies Private Limited (VIITSA)</p>
                  <p className="text-slate-700"><strong>Email:</strong> <a href="mailto:grievance@viitsa.com" className="text-emerald-600 font-semibold">grievance@viitsa.com</a> / <a href="mailto:support@viitsa.com" className="text-emerald-600 font-semibold">support@viitsa.com</a></p>
                  <p className="text-slate-700"><strong>Jurisdiction:</strong> Hyderabad, Telangana, India</p>
                  <p className="text-xs text-slate-500 pt-2 border-t border-slate-200">
                    Acknowledgment of grievances is issued within 48 hours, and resolutions are communicated within the statutory timeframe mandated by applicable rules.
                  </p>
                </div>
              </div>
            </section>

          </div>
        </div>
      </main>
    </div>
  );
}
