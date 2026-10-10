import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, FileText, CheckCircle2, Scale, Users, Bot, Building2 } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function TermsOfServicePage() {
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
                <Scale size={14} /> Legal & Terms Specification
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight mb-4">
                Terms of Use & Service
              </h1>
              <p className="text-slate-300 text-base sm:text-lg max-w-3xl leading-relaxed">
                VIITSA is a healthcare technology platform operated under the brand VIITSA by <strong>TIV Technologies Private Limited</strong>. These Terms govern your access to and use of our digital health infrastructure, clinics, portals, and AI-assisted tools.
              </p>
              <div className="flex flex-wrap items-center gap-6 mt-6 pt-6 border-t border-white/10 text-xs text-slate-400">
                <span><strong>Entity:</strong> TIV Technologies Private Limited</span>
                <span><strong>Brand:</strong> VIITSA</span>
                <span><strong>Status:</strong> Active Product & Compliance Specification</span>
                <span><strong>Effective Date:</strong> October 2026</span>
              </div>
            </div>
          </div>

          {/* Quick Notice Card */}
          <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-6 mb-10 flex items-start gap-4">
            <AlertTriangle className="text-amber-500 shrink-0 mt-1" size={24} />
            <div className="text-sm text-slate-800 leading-relaxed">
              <strong className="font-bold text-slate-900 block mb-1">Critical Medical & Emergency Notice</strong>
              VIITSA is a digital technology platform and <strong>is not an emergency response service</strong>. If you or someone you know is experiencing a medical emergency, acute chest pain, severe trauma, or breathing difficulty, please contact your local emergency response service immediately or visit the nearest hospital emergency room. VIITSA does not provide independent emergency medical care.
            </div>
          </div>

          {/* Content Document */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 sm:p-14 space-y-12 text-slate-700 leading-relaxed">

            {/* 1. Product & Legal Position */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">1</div>
                <h2 className="text-2xl font-bold text-slate-900">VIITSA Product and Legal Position</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600">
                <p>
                  <strong>VIITSA</strong> is a specialized healthcare technology platform operated under the brand VIITSA by <strong>TIV Technologies Private Limited</strong> ("Company", "we", "us"). VIITSA provides digital infrastructure designed to assist private clinics, registered medical practitioners, reception and administrative personnel, and patients in managing healthcare-related workflows. These workflows encompass clinic operations, smart appointment scheduling, patient demographic and record workflows, healthcare communication, and AI-assisted health navigation and summarisation.
                </p>
                <p>
                  <strong>VIITSA is fundamentally a technology platform provider.</strong> Unless a particular service is expressly activated, contractually agreed, and legally structured as a direct healthcare service, VIITSA itself is not a treating hospital, registered clinic, diagnostic laboratory, retail or wholesale pharmacy, health insurer, or emergency medical dispatch service.
                </p>
                <p>
                  All clinical decisions, medical consultations, diagnostic interpretations, prescriptions, treatment regimens, and patient care responsibilities remain solely and exclusively with appropriately qualified, legally authorized, and registered healthcare professionals and licensed clinical establishments.
                </p>
                <p>
                  The platform may support future technical integrations with accredited diagnostic laboratories, tertiary hospitals, licensed pharmacies, third-party insurance/TPA systems, payment gateway providers, and government digital health infrastructure (including India's Ayushman Bharat Digital Mission - ABDM). Each such integration is activated only following comprehensive technical, contractual, security, and statutory regulatory verification.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 2. Platform Terms of Use */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">2</div>
                <h2 className="text-2xl font-bold text-slate-900">Website & Platform Terms of Use</h2>
              </div>
              <div className="pl-13 space-y-4 text-slate-600">
                <h3 className="text-lg font-bold text-slate-900">2.1 Acceptance of Terms</h3>
                <p>
                  By accessing, browsing, registering an account on, or utilizing any portion of VIITSA (including our mobile interfaces, web dashboards, and public portals), you enter into a legally binding agreement and agree to comply unconditionally with these Terms of Use, our Privacy Policy, and any service-specific conditions presented at the point of interaction. If you do not agree to these terms, you must refrain from accessing or using the platform.
                </p>

                <h3 className="text-lg font-bold text-slate-900">2.2 User Categories</h3>
                <p>VIITSA provisions role-based access across five distinct user categories:</p>
                <div className="grid sm:grid-cols-2 gap-3.5 my-3">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Patient / User</strong>
                    <span className="text-xs text-slate-500">Individuals utilizing VIITSA to manage personal health records, book doctor appointments, explore healthcare providers, and interact with the AI Health Navigator.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Clinic Owner / Administrator</strong>
                    <span className="text-xs text-slate-500">Authorized representatives and healthcare establishment proprietors administering clinic profiles, staff credentials, billing settings, and operational configurations.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Doctor / Registered Medical Practitioner (RMP)</strong>
                    <span className="text-xs text-slate-500">Professionals holding recognized medical degrees whose credentials have been submitted and verified to conduct clinical consultations and author medical notes.</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <strong className="text-slate-900 block text-sm font-semibold mb-1">Receptionist / Clinic Staff</strong>
                    <span className="text-xs text-slate-500">Personnel delegated with least-privilege administrative access to manage queues, patient check-ins, physical walk-ins, and invoice generation.</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-slate-900">2.3 Account Responsibility & Security</h3>
                <ul className="list-disc pl-5 space-y-2 text-sm">
                  <li>Users must provide truthful, accurate, and current information during registration and profile completion. Impersonating another individual or medical organization is strictly prohibited.</li>
                  <li>Clinic Administrators bear full responsibility for ensuring that staff accounts created within their organization correspond to authorized personnel with minimum-necessary role privileges.</li>
                  <li>Authentication credentials, passwords, one-time passwords (OTPs), session tokens, and recovery keys must remain strictly confidential. Users must not share administrative credentials.</li>
                  <li>Users must immediately report any suspected unauthorized access, compromised credentials, fraudulent clinic activity, or unauthorized health information disclosure to <span className="font-mono text-emerald-600">support@viitsa.com</span>.</li>
                  <li>VIITSA reserves the unilateral right to suspend or restrict accounts exhibiting fraudulent behavior, credential compromise, security risks, or violation of applicable Indian laws.</li>
                </ul>

                <h3 className="text-lg font-bold text-slate-900">2.4 Prohibited Conduct</h3>
                <p className="text-sm">Users shall NOT engage in:</p>
                <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 text-xs space-y-2 text-rose-950">
                  <p>• Creating fabricated clinic listings, forged practitioner credentials, deceptive medical identities, or misleading promotional claims.</p>
                  <p>• Uploading forged medical registrations, altered prescriptions, unauthorized diagnostic reports, or fake medical certificates.</p>
                  <p>• Attempting to practice medicine or dispense pharmaceutical advice without holding an active, recognized registration with state medical councils or the National Medical Commission (NMC).</p>
                  <p>• Accessing, inspecting, copying, or exfiltrating any other patient's protected medical history without explicit, lawful consent.</p>
                  <p>• Injecting malicious code, vulnerability exploitation scripts, automated data scraping, rate-limit bypassing, or infrastructure disruption attacks.</p>
                  <p>• Misrepresenting AI-generated informational summaries as certified medical opinions or replacing required clinical assessments with automated text.</p>
                  <p>• Utilizing VIITSA for deceptive pharmaceutical sales, scheduled drug distribution, or unlawful medical promotions.</p>
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 3. Patient & Medical Disclaimer */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">3</div>
                <h2 className="text-2xl font-bold text-slate-900">Patient & Medical Disclaimer</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600">
                <p>
                  <strong>VIITSA does not substitute for a Registered Medical Practitioner (RMP), clinical emergency services, or in-person physician assessments.</strong>
                </p>
                <p>
                  Information rendered on VIITSA—including automated reminders, symptom categorizations, health knowledge articles, and digital timelines—does not constitute an autonomous medical diagnosis, clinical prescription, treatment guarantee, or outcome warranty.
                </p>
                <p>
                  Whenever VIITSA's <strong>AI Health Navigator</strong> facilitates symptom conversations, triage guidance, or clinical preparation summaries, all such outputs serve strictly as decision-support and workflow navigation assistance. Patients must always seek professional clinical evaluation from licensed doctors for any medical concerns or diagnostic evaluations.
                </p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <strong>Emergency Protocols:</strong> In the event of chest pains, difficulty breathing, stroke symptoms, loss of consciousness, poisoning, or severe injuries, do not await a digital response. Immediately dispatch emergency medical services or visit the nearest accredited hospital casualty department.
                </div>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 4. AI Navigator & AI Use Policy */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">4</div>
                <h2 className="text-2xl font-bold text-slate-900">AI Navigator & Artificial Intelligence Use Policy</h2>
              </div>
              <div className="pl-13 space-y-4 text-slate-600">
                <h3 className="text-lg font-bold text-slate-900">4.1 Permitted AI Functions</h3>
                <p className="text-sm">VIITSA deploys artificial intelligence exclusively for defined administrative and navigational tasks:</p>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li>Conversational collection of user-described symptoms and health concerns prior to consultations.</li>
                  <li>Multilingual interaction assistance in English, Hindi, and Telugu, including localized healthcare terminology.</li>
                  <li>Generation of structured clinical summaries (SOAP format) strictly for review by the appointed healthcare professional.</li>
                  <li>Intelligent navigation to appropriate medical specialties, available clinic appointment slots, and educational resources.</li>
                  <li>Administrative workflow summarisation and non-clinical practice analytics.</li>
                </ul>

                <h3 className="text-lg font-bold text-slate-900">4.2 Human-in-the-Loop Clinical Oversight</h3>
                <p className="text-sm">
                  Whenever an AI-generated symptom summary is transferred to an attending doctor, the system mandates that the doctor review, edit, reject, or disregard the AI output based on their independent clinical expertise. The platform permanently records an immutable audit event verifying whether clinical action was authorized by an authenticated practitioner.
                </p>

                <h3 className="text-lg font-bold text-slate-900">4.3 Strict Limitations and Safety Safeguards</h3>
                <ul className="list-disc pl-5 space-y-1.5 text-sm">
                  <li><strong>Zero Autonomous Prescriptions:</strong> The AI system is technically and legally prohibited from prescribing medications, calculating drug dosages, or executing treatment orders without doctor authorization.</li>
                  <li><strong>Visual Differentiation:</strong> AI-generated summaries are distinctly badged with automated system markers to prevent confusion with clinician-authored clinical notes.</li>
                  <li><strong>No Silent Alterations:</strong> AI algorithms cannot modify, overwrite, or sanitize original patient-submitted symptom statements or official medical records.</li>
                  <li><strong>Emergency Redirection:</strong> Whenever high-risk or emergency terminology is detected in patient statements, the system immediately displays safety alerts and emergency contact information.</li>
                </ul>

                <h3 className="text-lg font-bold text-slate-900">4.4 Zero Model-Training on Patient Health Data</h3>
                <p className="text-sm">
                  VIITSA enforces contractual and technical agreements with third-party enterprise AI providers prohibiting the use of identifiable patient health information for foundational model training or commercial repurposing. All data ingestion conforms to enterprise privacy standards.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 10. Clinic Responsibility */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">5</div>
                <h2 className="text-2xl font-bold text-slate-900">Clinic Responsibility & Healthcare Provider Obligations</h2>
              </div>
              <div className="pl-13 space-y-2 text-slate-600 text-sm">
                <p>Clinics partnering with and operating accounts on VIITSA acknowledge and agree:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li>Participating clinics maintain exclusive legal responsibility for the legality, competence, and professional quality of healthcare services rendered to patients.</li>
                  <li>Clinics must verify that all doctors, practitioners, and support personnel operating on their accounts maintain valid, unexpired licenses and registrations.</li>
                  <li>Clinics must ensure all patient records, test results, and billing items entered into the platform are accurate, authentic, and lawfully gathered.</li>
                  <li>Clinics are independently responsible for acquiring explicit patient consent for physical examinations, invasive procedures, and local clinical operations.</li>
                  <li>VIITSA operates strictly as a software and digital communication intermediary under Section 79 of the Information Technology Act, 2000, and does not assume clinical liabilities for participating medical establishments.</li>
                </ul>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 17. Intellectual Property & 18. Record Integrity */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">6</div>
                <h2 className="text-2xl font-bold text-slate-900">Intellectual Property & Record Integrity</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  The VIITSA platform, software code, UI/UX designs, trademarks, brand assets, proprietary AI prompt architectures, algorithms, and documentation are the exclusive intellectual property of <strong>TIV Technologies Private Limited</strong>.
                </p>
                <p>
                  Users and clinics retain lawful ownership over patient data and records submitted by them, granting VIITSA a limited, secure license strictly to process, store, encrypt, and render said records for service delivery.
                </p>
                <p>
                  <strong>Clinical Audit Trails:</strong> The platform maintains cryptographic and immutable audit logs of clinical entries, prescription updates, and record alterations to preserve legal and medical integrity.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* 23, 24, 25. Suspension, Liability & Jurisdiction */}
            <section className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">7</div>
                <h2 className="text-2xl font-bold text-slate-900">Suspension, Liability & Governing Law</h2>
              </div>
              <div className="pl-13 space-y-3 text-slate-600 text-sm">
                <p>
                  <strong>Suspension & Termination:</strong> VIITSA may immediately restrict or terminate account access in cases of suspected fraud, unlicensed medical practice, cyber attacks, or breach of these Terms. Termination does not extinguish the statutory retention requirements for clinical records maintained on behalf of clinics.
                </p>
                <p>
                  <strong>Limitation of Liability:</strong> To the maximum extent permitted by applicable Indian laws, TIV Technologies Private Limited shall not be liable for indirect, incidental, punitive, or consequential damages resulting from technical downtime, third-party internet disruptions, or clinical medical actions executed by independent practitioners.
                </p>
                <p>
                  <strong>Governing Law & Jurisdiction:</strong> These Terms of Use shall be governed by and construed in accordance with the laws of India. Any legal dispute, controversy, or claim arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts situated in <strong>Hyderabad, Telangana, India</strong>.
                </p>
              </div>
            </section>

            <hr className="border-slate-100" />

            {/* Contact & Support */}
            <section className="space-y-3 pt-2">
              <h3 className="text-lg font-bold text-slate-900">Official Inquiries & Support</h3>
              <p className="text-sm text-slate-600">
                For legal inquiries, terms clarifications, or account assistance, please contact:
              </p>
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-sm space-y-1">
                <p className="font-semibold text-slate-800">TIV Technologies Private Limited (VIITSA)</p>
                <p className="text-slate-600">Legal & Compliance Department</p>
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
