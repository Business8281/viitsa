import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, BarChart3, Building2, Calendar, CreditCard,
  FileText, Heart, LayoutDashboard, Lock, QrCode, Shield, Smartphone,
  Stethoscope, Users, Zap, Menu, X, Brain, Mic, Globe, CheckCircle,
  TrendingUp, ShieldCheck, Sparkles, BrainCircuit, HeartPulse, Linkedin,
  Instagram, Mail, Phone as PhoneIcon, Globe2, Check, Printer, Tablet, Home,
} from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const [ref, visible] = useInView();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
// Logo Component
// ────────────────────────────────────────────────────────────────────



// ────────────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: 'Home', href: 'home' },
  { label: 'Features', href: 'features' },
  { label: 'AI Navigator', href: 'ai' },
  { label: 'How It Works', href: 'how' },
  { label: 'Pricing', href: 'pricing' },
  { label: 'About', href: 'about' },
  { label: 'Contact', href: 'contact' },
];

export function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [workflowTab, setWorkflowTab] = useState<'clinic' | 'patient'>('clinic');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [floatOffset, setFloatOffset] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setFloatOffset(p => p + 1), 60);
    return () => clearInterval(t);
  }, []);

  // Forward any incoming auth action parameters (e.g. from Firebase email links landing on root)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    if (!mode && !oobCode) return;

    const continueUrl = searchParams.get('continueUrl');
    const returnUrl = searchParams.get('return');
    const isClinic = Boolean(continueUrl && continueUrl.includes('/clinic')) ||
      Boolean(returnUrl && returnUrl.includes('/clinic')) ||
      sessionStorage.getItem('viitsa_portal_intent') === 'clinic';

    if (mode === 'resetPassword' || (oobCode && mode !== 'verifyEmail')) {
      navigate(`/reset-password?${searchParams.toString()}`, { replace: true });
    } else if (mode === 'verifyEmail') {
      const target = isClinic ? '/clinic/login' : '/login';
      navigate(`${target}?${searchParams.toString()}`, { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
      const ids = NAV_LINKS.map(n => n.href);
      for (const id of [...ids].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) { setActiveSection(id); break; }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileOpen(false);
  };

  const goTo = (path: string) => { navigate(path); setMobileOpen(false); };

  // Floating card data
  const floatingCards = [
    { icon: Brain, label: 'AI Navigator', desc: 'Instant symptom triage & voice care', color: 'from-emerald-500 to-teal-500', badge: 'EN • HI • TE' },
    { icon: Calendar, label: 'Appointments', desc: 'Smart slots & conflict resolution', color: 'from-blue-500 to-cyan-500', badge: 'Automated' },
    { icon: FileText, label: 'Medical Records', desc: 'Encrypted EHR timeline & lab files', color: 'from-orange-500 to-amber-500', badge: 'HIPAA Safe' },
    { icon: BarChart3, label: 'Analytics', desc: 'Live clinic metrics & revenue flow', color: 'from-violet-500 to-purple-500', badge: 'Real-time' },
    { icon: CreditCard, label: 'Payments', desc: 'One-click UPI, claims & invoicing', color: 'from-rose-500 to-pink-500', badge: 'Instant UPI' },
    { icon: Heart, label: 'Patient Care', desc: 'Automated follow-ups & wellness', color: 'from-red-500 to-rose-500', badge: '24/7 Care' },
  ];

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ── NAVIGATION ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            <ViitsaLogo size="md" light={!scrolled} />

            {/* Desktop Nav */}
            <div className="hidden xl:flex items-center gap-1">
              {NAV_LINKS.map(item => (
                <button
                  key={item.label}
                  onClick={() => scrollTo(item.href)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeSection === item.href
                      ? scrolled
                        ? 'text-emerald-700 bg-emerald-50 font-semibold'
                        : 'text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 font-semibold backdrop-blur-sm'
                      : scrolled
                        ? 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50'
                        : 'text-white/85 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden lg:flex items-center gap-1.5">
                <button onClick={() => scrollTo('portals')} className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${scrolled ? 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                  For Clinics
                </button>
                <button onClick={() => goTo('/patient')} className={`px-3 py-2 text-sm font-medium transition-colors rounded-lg ${scrolled ? 'text-slate-600 hover:text-emerald-600 hover:bg-slate-50' : 'text-white/80 hover:text-white hover:bg-white/10'}`}>
                  For Patients
                </button>
              </div>
              <button onClick={() => goTo('/login')} className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-all ${scrolled ? 'text-slate-700 hover:text-emerald-600 hover:bg-slate-50 border border-slate-200' : 'text-white/90 hover:text-white bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur-sm'}`}>
                Login
              </button>
              <button onClick={() => goTo('/register')} className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all shrink-0">
                Register
                <ArrowRight size={14} />
              </button>
              {/* Mobile toggle */}
              <button onClick={() => setMobileOpen(v => !v)} className={`xl:hidden p-2 rounded-lg transition-colors ${scrolled ? 'text-slate-700 hover:bg-slate-100' : 'text-white hover:bg-white/10'}`} aria-label="Toggle navigation">
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="xl:hidden bg-white border-t border-slate-100 shadow-xl">
            <div className="w-[90%] max-w-[1600px] mx-auto py-4 space-y-1">
              {NAV_LINKS.map(item => (
                <button key={item.label} onClick={() => scrollTo(item.href)}
                  className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                  {item.label}
                </button>
              ))}
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 mt-2">
                <button onClick={() => goTo('/login')} className="px-4 py-3 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 text-center">Login</button>
                <button onClick={() => goTo('/register')} className="px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-center">Register</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { scrollTo('portals'); }} className="px-4 py-3 text-sm font-semibold text-emerald-700 bg-emerald-50 rounded-xl text-center">For Clinics</button>
                <button onClick={() => goTo('/patient')} className="px-4 py-3 text-sm font-semibold text-teal-700 bg-teal-50 rounded-xl text-center">For Patients</button>
              </div>
              <button onClick={() => goTo('/')} className="w-full px-4 py-3 text-sm font-semibold text-slate-500 rounded-xl hover:bg-slate-50 flex items-center justify-center gap-1.5">
                <Home size={14} /> Home
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ── */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden" style={{ background: 'linear-gradient(135deg, #0A1628 0%, #0F2847 40%, #0A3D2B 100%)' }}>
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        <div className="relative w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4 pt-28 sm:pt-32 pb-20 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-14 xl:gap-16 items-center">
            {/* Left: Content */}
            <div className="w-full">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-sm font-medium mb-6 backdrop-blur-sm">
                <Sparkles size={14} />
                AI Healthcare Intelligence Platform
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4 tracking-tight">
                Smarter Healthcare.
                <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
                  {' '}For Everyone.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-white/70 leading-relaxed mb-8 max-w-2xl">
                VIITSA connects Patients, Clinics, Doctors, Hospitals, Diagnostic Centers & Pharmacies with AI-powered healthcare automation — making healthcare intelligent, connected, accessible and simple.
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-10">
                <button onClick={() => goTo('/register')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">
                  <Building2 size={18} /> For Clinics
                </button>
                <button onClick={() => goTo('/patient')}
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-md text-white font-semibold rounded-xl border border-white/20 hover:bg-white/20 transition-all text-center">
                  <Calendar size={18} /> Book a Doctor
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-white/60">
                <div className="flex items-center gap-2"><Shield size={14} className="text-emerald-400 shrink-0" /> HIPAA Compliant</div>
                <div className="flex items-center gap-2"><Lock size={14} className="text-emerald-400 shrink-0" /> Encrypted</div>
                <div className="flex items-center gap-2"><Activity size={14} className="text-emerald-400 shrink-0" /> AI Powered</div>
              </div>
            </div>

            {/* Right: UI/UX Healthcare Intelligence Showcase */}
            <div className="w-full">
              <div className="relative rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-white/15 p-5 sm:p-7 shadow-2xl shadow-emerald-950/40 overflow-hidden">
                {/* Decorative ambient glows inside card */}
                <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
                <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

                {/* Top header bar of showcase */}
                <div className="relative flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
                      VIITSA Healthcare OS
                    </span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Real-time Active</span>
                  </div>
                </div>

                {/* 6 Core Modules Grid - Zero Overlap, Responsive & Balanced */}
                <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {floatingCards.map((card, idx) => {
                    const yShift = Math.sin((floatOffset + idx * 30) * Math.PI / 180) * 3;
                    return (
                      <div
                        key={card.label}
                        className="group relative bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-emerald-500/40 rounded-2xl p-3.5 transition-all duration-300 flex items-start gap-3 shadow-lg"
                        style={{ transform: `translateY(${yShift}px)` }}
                      >
                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                          <card.icon size={20} className="text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <h4 className="text-white text-sm font-semibold truncate group-hover:text-emerald-300 transition-colors">
                              {card.label}
                            </h4>
                            <span className="text-[10px] font-medium text-emerald-300/80 bg-emerald-500/15 px-1.5 py-0.5 rounded shrink-0">
                              {card.badge}
                            </span>
                          </div>
                          <p className="text-white/60 text-xs leading-snug line-clamp-1">
                            {card.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live AI Status & Verification Bar */}
                <div className="relative mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/70">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-emerald-400 shrink-0" />
                    <span className="truncate">Multilingual AI (EN / HI / TE) & Voice Assistance</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 text-white/50 text-[11px]">
                    <span className="flex items-center gap-1"><ShieldCheck size={13} className="text-emerald-400" /> HIPAA Safe</span>
                    <span className="flex items-center gap-1"><Zap size={13} className="text-teal-400" /> Cloud Sync</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60H1440V30C1200 60 960 0 720 20C480 40 240 0 0 30V60Z" fill="white" />
          </svg>
        </div>
      </section>

      {/* ── ENTRY SELECTION ── */}
      <section id="portals" className="py-20 bg-white">
        <div className="w-[90%] max-w-[1500px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center mb-14">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Choose Your Portal</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Who are you?</h2>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Clinic Card */}
            <FadeIn delay={100}>
              <div className="group relative rounded-3xl border-2 border-slate-100 bg-gradient-to-br from-slate-50 to-emerald-50/40 p-8 hover:border-emerald-200 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 to-emerald-500/5 group-hover:from-emerald-500/5 group-hover:to-emerald-500/10 transition-all duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-5">
                    <Building2 size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">For Clinics</h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">Manage your clinic with AI automation. Appointments, billing, records, and analytics in one place.</p>
                  <ul className="space-y-2.5 mb-8">
                    {['Smart appointment scheduling', 'AI-powered patient triage', 'Digital billing & invoicing', 'Analytics dashboard'].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <CheckCircle size={15} className="text-emerald-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative pt-4 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={() => goTo('/clinic/login')}
                      className="flex-1 py-3 px-4 rounded-xl border-2 border-emerald-200 text-emerald-700 font-semibold text-sm hover:bg-emerald-50 transition-all text-center">
                      Login
                    </button>
                    <button onClick={() => goTo('/clinic/login?mode=register')}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">
                      Register Clinic
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 mt-3">
                    <button onClick={() => goTo('/patient')}
                      className="flex-1 py-2.5 px-3 rounded-xl text-emerald-600 font-medium text-xs hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-1.5 border border-emerald-100">
                      <Smartphone size={14} /> AI Health Navigator
                    </button>
                    <button onClick={() => goTo('/patient')}
                      className="flex-1 py-2.5 px-3 rounded-xl text-teal-600 font-medium text-xs hover:bg-teal-50/50 transition-all flex items-center justify-center gap-1.5 border border-teal-100">
                      <Calendar size={14} /> Find Doctors
                    </button>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Patient Card */}
            <FadeIn delay={200}>
              <div className="group relative rounded-3xl border-2 border-slate-100 bg-gradient-to-br from-slate-50 to-teal-50/40 p-8 hover:border-teal-200 hover:shadow-2xl hover:shadow-teal-500/10 transition-all duration-300 overflow-hidden h-full flex flex-col justify-between">
                <div className="absolute inset-0 bg-gradient-to-br from-teal-500/0 to-teal-500/5 group-hover:from-teal-500/5 group-hover:to-teal-500/10 transition-all duration-300 pointer-events-none" />
                <div className="relative">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20 mb-5">
                    <Smartphone size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-slate-900 mb-2">For Patients</h3>
                  <p className="text-slate-600 mb-6 leading-relaxed">Book doctors instantly using AI. Access records, track health, and stay connected with your care team.</p>
                  <ul className="space-y-2.5 mb-8">
                    {['AI symptom checker (EN/HI/TE)', 'Book appointments online', 'View medical records & reports', 'Family health vault'].map(f => (
                      <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                        <CheckCircle size={15} className="text-teal-500 shrink-0" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative pt-4 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={() => goTo('/login')}
                      className="flex-1 py-3 px-4 rounded-xl border-2 border-teal-200 text-teal-700 font-semibold text-sm hover:bg-teal-50 transition-all text-center">
                      Patient Login
                    </button>
                    <button onClick={() => goTo('/login?mode=register')}
                      className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold text-sm shadow-lg shadow-teal-500/20 hover:shadow-xl hover:-translate-y-0.5 transition-all text-center">
                      Register
                    </button>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 mt-3">
                    <button onClick={() => goTo('/patient')}
                      className="flex-1 py-2.5 px-3 rounded-xl text-teal-600 font-medium text-xs hover:bg-teal-50/50 transition-all flex items-center justify-center gap-1.5 border border-teal-100">
                      <Brain size={14} /> AI Health Navigator
                    </button>
                    <button onClick={() => goTo('/patient')}
                      className="flex-1 py-2.5 px-3 rounded-xl text-emerald-600 font-medium text-xs hover:bg-emerald-50/50 transition-all flex items-center justify-center gap-1.5 border border-emerald-100">
                      <Calendar size={14} /> Book Appointment
                    </button>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-20 lg:py-28 bg-slate-50">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Platform Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Everything Your Clinic Needs</h2>
            <p className="text-lg text-slate-600">A comprehensive suite of AI-powered tools designed for modern healthcare professionals.</p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: BrainCircuit, title: 'AI Health Navigator', desc: 'Multi-language conversational AI (EN/HI/TE) for patient triage with voice support.', grad: 'from-emerald-500 to-teal-500' },
              { icon: Calendar, title: 'Appointment Automation', desc: 'Intelligent scheduling with conflict detection, slot management, and WhatsApp reminders.', grad: 'from-blue-500 to-cyan-500' },
              { icon: CreditCard, title: 'Smart Billing', desc: 'Automated invoicing, UPI integration, digital receipts, and revenue analytics.', grad: 'from-violet-500 to-purple-500' },
              { icon: FileText, title: 'Medical Records', desc: 'Digital patient histories, prescriptions, vitals, and AI-scanned report summaries.', grad: 'from-orange-500 to-amber-500' },
              { icon: Mic, title: 'Voice Assistant', desc: 'Speak symptoms in English, Hindi, or Telugu. AI understands and responds naturally.', grad: 'from-rose-500 to-pink-500' },
              { icon: Globe, title: 'Multi-language AI', desc: 'Auto-detects language from mixed conversations. Hinglish and Tenglish supported.', grad: 'from-teal-500 to-emerald-500' },
              { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Revenue trends, patient demographics, appointment heatmaps, and AI insights.', grad: 'from-blue-500 to-indigo-500' },
              { icon: QrCode, title: 'QR Check-in', desc: 'Patients scan a QR to check in, reducing reception workload by 60%.', grad: 'from-slate-600 to-slate-700' },
              { icon: Smartphone, title: 'Responsive Design', desc: 'Works perfectly on mobile, tablet, and desktop. No app install required.', grad: 'from-green-500 to-emerald-500' },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 60}>
                <div className="group p-6 rounded-2xl bg-white border border-slate-100 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1 transition-all duration-300 cursor-default h-full flex flex-col">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.grad} flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300 shrink-0`}>
                    <f.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-base font-bold text-slate-800 mb-2">{f.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed flex-1">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI SECTION ── */}
      <section id="ai" className="py-20 lg:py-28 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-full text-emerald-300 text-sm font-medium mb-6">
              <Zap size={14} /> AI-Powered Core
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Intelligence at Every Step</h2>
            <p className="text-lg text-slate-300">Groq-powered AI that understands your patients and prepares your doctors.</p>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Activity, title: 'AI Symptom Navigator', desc: 'Patients describe symptoms in any language before arrival. AI analyzes urgency and generates a detailed doctor brief.', grad: 'from-emerald-500 to-teal-500' },
              { icon: BarChart3, title: 'Predictive Analytics', desc: 'Forecast patient volume, identify peak hours, and optimize scheduling for maximum revenue and efficiency.', grad: 'from-blue-500 to-cyan-500' },
              { icon: Stethoscope, title: 'Smart Triage', desc: 'Automatically prioritizes patients by urgency. Generates structured SOAP notes for each consultation.', grad: 'from-violet-500 to-pink-500' },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={i * 100}>
                <div className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 border border-slate-700 hover:border-emerald-500/40 hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.grad} flex items-center justify-center shadow-lg mb-4 shrink-0`}>
                    <f.icon size={22} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed flex-1">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-20 lg:py-28 bg-white">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center max-w-3xl mx-auto mb-12">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Getting Started</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How It Works</h2>
            <p className="text-lg text-slate-600">Simple, fast, and intuitive — whether you're a clinic or a patient.</p>
          </FadeIn>

          {/* Tab Toggle */}
          <FadeIn className="flex justify-center mb-12">
            <div className="inline-flex bg-slate-100 rounded-2xl p-1.5 gap-1">
              {(['clinic', 'patient'] as const).map(t => (
                <button key={t} onClick={() => setWorkflowTab(t)}
                  className={`px-8 py-3 rounded-xl text-sm font-semibold transition-all ${workflowTab === t ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t === 'clinic' ? 'For Clinics' : 'For Patients'}
                </button>
              ))}
            </div>
          </FadeIn>

          {workflowTab === 'clinic' ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {[
                { step: 1, icon: Users, title: 'Register', desc: 'Create your clinic account with basic details in 2 minutes.', color: 'from-emerald-500 to-teal-500' },
                { step: 2, icon: LayoutDashboard, title: 'Setup', desc: 'Add doctors, departments, working hours, and billing config.', color: 'from-blue-500 to-cyan-500' },
                { step: 3, icon: Calendar, title: 'Manage', desc: 'Handle appointments, records, billing, and inventory in real-time.', color: 'from-violet-500 to-purple-500' },
                { step: 4, icon: TrendingUp, title: 'Grow', desc: 'Use AI insights to expand services and improve patient satisfaction.', color: 'from-orange-500 to-amber-500' },
              ].map((item) => (
                <FadeIn key={item.step} delay={item.step * 80}>
                  <div className="text-center p-5 rounded-2xl bg-slate-50/60 border border-slate-100 h-full flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4`}>
                      <span className="text-white text-xl font-bold">{item.step}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-2 text-lg">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {[
                { step: 1, icon: Smartphone, title: 'Register', desc: 'Enter mobile, verify OTP, complete your health profile.', color: 'from-emerald-500 to-teal-500' },
                { step: 2, icon: Brain, title: 'Talk to AI', desc: 'Describe symptoms to AI Navigator in your language.', color: 'from-blue-500 to-cyan-500' },
                { step: 3, icon: Stethoscope, title: 'Find Doctor', desc: 'AI recommends the right specialty and doctor for you.', color: 'from-violet-500 to-purple-500' },
                { step: 4, icon: Calendar, title: 'Book Appointment', desc: 'Pick a slot, confirm, and receive WhatsApp confirmation.', color: 'from-orange-500 to-amber-500' },
                { step: 5, icon: HeartPulse, title: 'Visit Clinic', desc: 'AI summary attached. Doctor is ready before you arrive.', color: 'from-rose-500 to-pink-500' },
              ].map((item) => (
                <FadeIn key={item.step} delay={item.step * 60}>
                  <div className="text-center p-5 rounded-2xl bg-slate-50/60 border border-slate-100 h-full flex flex-col items-center">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-lg mb-4`}>
                      <span className="text-white text-lg font-bold">{item.step}</span>
                    </div>
                    <h3 className="font-bold text-slate-800 mb-1.5">{item.title}</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── WHY VIITSA ── */}
      <section id="about" className="py-20 lg:py-28 bg-slate-50">
        <div className="w-[90%] max-w-[1500px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center mb-14">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Why VIITSA</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Traditional vs. Modern</h2>
            <p className="text-lg text-slate-600">See how VIITSA transforms every aspect of your clinic.</p>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-0 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            {/* Traditional column */}
            <div className="bg-slate-50 p-6 sm:p-8">
              <div className="text-center mb-6 pb-4 border-b border-slate-200">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 mb-2">
                  <Printer size={18} className="text-slate-500" />
                </div>
                <p className="font-bold text-slate-600">Traditional Clinic</p>
              </div>
              <ul className="space-y-3.5">
                {['Manual registration forms', 'Phone-only booking', 'Paper medical records', 'Walk-in patients only', 'Manual billing & receipts', 'No analytics', 'Language barriers'].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-500">
                    <X size={14} className="text-red-400 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* VS Column */}
            <div className="flex flex-col items-center justify-center py-10 px-4 bg-gradient-to-b from-emerald-600 to-teal-600 text-center">
              <div className="text-white/40 text-5xl font-black mb-3">VS</div>
              <div className="w-10 h-0.5 bg-white/20 mb-3" />
              <p className="text-xs text-emerald-200 font-medium uppercase tracking-widest">Upgrade to</p>
            </div>

            {/* VIITSA column */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 sm:p-8">
              <div className="text-center mb-6 pb-4 border-b border-emerald-100">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 mb-2">
                  <Activity size={18} className="text-white" />
                </div>
                <p className="font-bold text-emerald-700">VIITSA</p>
              </div>
              <ul className="space-y-3.5">
                {['AI-assisted digital registration', 'Online + app booking', 'Digital health timeline', 'AI-guided doctor discovery', 'Automated smart billing', 'Real-time AI analytics', 'EN / HI / TE multilingual AI'].map(item => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <Check size={14} className="text-emerald-500 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── TRUST SECTION ── */}
      <section className="py-16 bg-white border-y border-slate-100">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center mb-10">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">You Can Trust Us</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Built for India's Healthcare Future</h2>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: Lock, label: 'End-to-End Encryption', color: 'text-emerald-600 bg-emerald-50' },
              { icon: Brain, label: 'AI Assisted Healthcare', color: 'text-blue-600 bg-blue-50' },
              { icon: ShieldCheck, label: 'Secure Patient Records', color: 'text-violet-600 bg-violet-50' },
              { icon: Tablet, label: 'Modern Clinic Platform', color: 'text-orange-600 bg-orange-50' },
              { icon: HeartPulse, label: 'Built for India', color: 'text-rose-600 bg-rose-50' },
              { icon: Sparkles, label: 'Future Ready', color: 'text-teal-600 bg-teal-50' },
            ].map((item, i) => (
              <FadeIn key={item.label} delay={i * 60}>
                <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all group cursor-default">
                  <div className={`h-11 w-11 rounded-xl ${item.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <item.icon size={20} />
                  </div>
                  <p className="text-xs font-semibold text-slate-700 leading-tight">{item.label}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING SECTION (SPEC V1.0) ── */}
      <section id="pricing" className="py-20 lg:py-28 bg-slate-50">
        <div className="w-[90%] max-w-[1400px] mx-auto px-2 sm:px-4">
          <FadeIn className="text-center mb-10">
            <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-2">Transparent Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Start Free, Scale as You Grow</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              30-day free pilot for clinics in India with no credit card required. Upgrade or change anytime.
            </p>

            {/* Monthly / Annual Billing Toggle */}
            <div className="mt-8 inline-flex items-center gap-3 p-1.5 bg-slate-200/70 rounded-2xl">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all ${
                  billingCycle === 'monthly'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                className={`px-5 py-2 text-sm font-semibold rounded-xl transition-all flex items-center gap-2 ${
                  billingCycle === 'annual'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Annual</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  billingCycle === 'annual' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  2 Months Free
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              All plans include a <strong className="text-emerald-700">30-Day Free Trial</strong> with automated UPI / Card mandate renewal. Cancel anytime. Prices in INR. 18% GST applicable.
            </p>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                id: 'solo',
                name: 'Solo',
                price: billingCycle === 'annual' ? '₹29,990' : '₹2,999',
                period: billingCycle === 'annual' ? 'year' : 'month',
                desc: 'Single-doctor practices and independent consultants.',
                trialBadge: '30-Day Free Trial',
                autoDebitNote: billingCycle === 'annual' ? 'Auto-renews at ₹29,990/yr on Day 31' : 'Auto-renews at ₹2,999/mo on Day 31',
                features: [
                  '1 Doctor included',
                  'Up to 3 Staff seats',
                  '1 Location',
                  '300 AI Intakes / month',
                  '800 WhatsApp msgs / month',
                  'Unlimited Document Storage',
                  'Standard Billing & Queue',
                  'Priority Support'
                ],
                cta: 'Start 30-Day Free Trial',
                action: `/register?plan=solo&cycle=${billingCycle}`,
                directLink: billingCycle === 'annual' ? 'https://rzp.io/rzp/xlfXiVqg' : null,
                directPrice: '₹29,990',
                highlight: false,
                badge: null,
              },
              {
                id: 'clinic',
                name: 'Clinic',
                price: billingCycle === 'annual' ? '₹59,990' : '₹5,999',
                period: billingCycle === 'annual' ? 'year' : 'month',
                desc: 'Growing clinics with multiple doctors and high patient volume.',
                trialBadge: '30-Day Free Trial',
                autoDebitNote: billingCycle === 'annual' ? 'Auto-renews at ₹59,990/yr on Day 31' : 'Auto-renews at ₹5,999/mo on Day 31',
                features: [
                  'Up to 3 Doctors included',
                  'Up to 6 Staff seats',
                  '1 Location',
                  '1,000 AI Intakes / month',
                  '2,500 WhatsApp msgs / month',
                  'Unlimited Document Storage',
                  'Full Billing & Purchase Orders',
                  'Automated Rescheduling CRM',
                  'Audit Logs & Custom Roles'
                ],
                cta: 'Start 30-Day Free Trial',
                action: `/register?plan=clinic&cycle=${billingCycle}`,
                directLink: billingCycle === 'annual' ? 'https://rzp.io/rzp/9OYAB40N' : 'https://rzp.io/rzp/OhKLJYzS',
                directPrice: billingCycle === 'annual' ? '₹59,990' : '₹5,999',
                highlight: true,
                badge: 'Most Popular',
              },
              {
                id: 'multispecialty',
                name: 'Multi-Specialty',
                price: billingCycle === 'annual' ? '₹1,19,990' : '₹11,999',
                period: billingCycle === 'annual' ? 'year' : 'month',
                desc: 'Polyclinics and busy specialty centres running multiple departments.',
                trialBadge: '30-Day Free Trial',
                autoDebitNote: billingCycle === 'annual' ? 'Auto-renews at ₹1,19,990/yr on Day 31' : 'Auto-renews at ₹11,999/mo on Day 31',
                features: [
                  'Up to 8 Doctors included',
                  'Up to 20 Staff seats',
                  '1 Location',
                  '2,000 AI Intakes / month',
                  '5,000 WhatsApp msgs / month',
                  'Unlimited Document Storage',
                  'TPA & Insurance Billing',
                  'Multi-Store Inventory',
                  'Custom Branding on All Reports'
                ],
                cta: 'Start 30-Day Free Trial',
                action: `/register?plan=multispecialty&cycle=${billingCycle}`,
                directLink: billingCycle === 'annual' ? 'https://rzp.io/rzp/0PqwSVE' : 'https://rzp.io/rzp/XDAYYlHQ',
                directPrice: billingCycle === 'annual' ? '₹1,19,990' : '₹11,999',
                highlight: false,
                badge: 'Specialty Care',
              },
              {
                id: 'hospital',
                name: 'Hospital',
                price: billingCycle === 'annual' ? '₹2,49,990' : '₹24,999',
                period: billingCycle === 'annual' ? 'year' : 'month',
                desc: 'Small hospitals, nursing homes, and surgical care facilities.',
                trialBadge: 'Tailored Pilot',
                autoDebitNote: 'Dedicated On-Premise / Cloud SLA',
                features: [
                  'Up to 25 Doctors included',
                  'Up to 60 Staff seats',
                  '3 Locations included',
                  '5,000 AI Intakes / month',
                  '12,000 WhatsApp msgs / month',
                  'Unlimited Document Storage',
                  'Full IPD, Bed & OT Suite',
                  '24/7 Dedicated Support Lead'
                ],
                cta: 'Contact Sales / Inquire',
                action: '/contact',
                directLink: null,
                directPrice: null,
                highlight: false,
                badge: 'Enterprise',
              },
            ].map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 100}>
                <div
                  className={`rounded-3xl p-7 h-full flex flex-col justify-between relative ${
                    plan.highlight
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-600/20 ring-2 ring-emerald-500'
                      : 'bg-white border border-slate-200/80 shadow-md hover:shadow-lg transition-all'
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm ${
                          plan.highlight
                            ? 'bg-amber-400 text-amber-950 font-extrabold'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {plan.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="mb-5">
                      <p
                        className={`text-sm font-bold uppercase tracking-wider mb-1 ${
                          plan.highlight ? 'text-emerald-100' : 'text-emerald-600'
                        }`}
                      >
                        {plan.name}
                      </p>
                      <div className="flex items-baseline gap-1">
                        <span
                          className={`text-3xl font-extrabold tracking-tight ${
                            plan.highlight ? 'text-white' : 'text-slate-900'
                          }`}
                        >
                          {plan.price}
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            plan.highlight ? 'text-emerald-100' : 'text-slate-400'
                          }`}
                        >
                          /{plan.period}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          plan.highlight ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          ✓ {plan.trialBadge}
                        </span>
                        <span className={`text-[10px] ${plan.highlight ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {plan.autoDebitNote}
                        </span>
                      </div>

                      <p
                        className={`text-xs mt-3 leading-relaxed ${
                          plan.highlight ? 'text-emerald-50' : 'text-slate-500'
                        }`}
                      >
                        {plan.desc}
                      </p>
                    </div>

                    <div className={`h-[1px] my-5 ${plan.highlight ? 'bg-white/20' : 'bg-slate-100'}`} />

                    <ul className="space-y-2.5 mb-8">
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          className={`flex items-center gap-2 text-xs leading-normal ${
                            plan.highlight ? 'text-emerald-50' : 'text-slate-600'
                          }`}
                        >
                          <Check
                            size={14}
                            className={`shrink-0 ${plan.highlight ? 'text-emerald-200' : 'text-emerald-500'}`}
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <button
                      onClick={() => {
                        goTo(plan.action);
                      }}
                      className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all text-center ${
                        plan.highlight
                          ? 'bg-white text-emerald-700 hover:bg-emerald-50 shadow-md'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      {plan.cta}
                    </button>

                    {plan.directLink && (
                      <div className="mt-2.5 text-center">
                        <a
                          href={plan.directLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-[11px] font-semibold hover:underline inline-flex items-center gap-1 ${
                            plan.highlight ? 'text-emerald-100 hover:text-white' : 'text-emerald-600 hover:text-emerald-700'
                          }`}
                        >
                          Or pay directly ({plan.directPrice}) →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ── */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="w-[90%] max-w-[1400px] mx-auto px-2 sm:px-4 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
              Ready to Transform Your Healthcare Experience?
            </h2>
            <p className="text-xl text-emerald-100 mb-10 max-w-2xl mx-auto">
              Join clinics and patients who are already experiencing smarter, faster, AI-powered healthcare.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button onClick={() => goTo('/register')}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-emerald-700 font-bold rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-full sm:w-auto">
                <Building2 size={18} /> Register Your Clinic
              </button>
              <button onClick={() => goTo('/patient')}
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur text-white font-bold rounded-xl border-2 border-white/30 hover:bg-white/20 transition-all w-full sm:w-auto">
                <Calendar size={18} /> Book Your First Appointment
              </button>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" className="py-20 lg:py-28 bg-white">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
            <FadeIn>
              <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wider mb-3">Contact Us</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Get in Touch</h2>
              <p className="text-lg text-slate-600 mb-8">Have questions? Our team is ready to help you get started and transform your clinic's operations.</p>
              <div className="space-y-5">
                {[
                  { icon: Globe2, label: 'Website', value: 'viitsa.com' },
                  { icon: PhoneIcon, label: 'Sales', value: '+91 98765 43210' },
                  { icon: Mail, label: 'Support', value: 'support@viitsa.com' },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                      <item.icon size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 font-medium">{item.label}</p>
                      <p className="text-slate-700 font-semibold">{item.value}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-4 flex items-center gap-3">
                  {[
                    { icon: Linkedin, href: 'https://linkedin.com/company/viitsa', label: 'LinkedIn' },
                    { icon: Instagram, href: 'https://instagram.com/viitsa', label: 'Instagram' },
                    { icon: Mail, href: 'mailto:support@viitsa.com', label: 'Email' },
                  ].map(s => (
                    <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                      className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-emerald-100 hover:text-emerald-600 transition-colors">
                      <s.icon size={18} />
                    </a>
                  ))}
                </div>
              </div>
            </FadeIn>
            <FadeIn delay={150}>
              <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-5">Send a Message</h3>
                <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">First Name</label>
                      <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5">Last Name</label>
                      <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email</label>
                    <input type="email" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Clinic Name</label>
                    <input type="text" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">Message</label>
                    <textarea rows={4} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none" />
                  </div>
                  <button type="submit" className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl hover:shadow-lg hover:-translate-y-0.5 transition-all">
                    Send Message <ArrowRight size={16} />
                  </button>
                </form>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-900 pt-16 pb-8">
        <div className="w-[90%] max-w-[1600px] mx-auto px-2 sm:px-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <Activity size={18} className="text-white" />
                </div>
                <span className="text-xl font-bold text-white">VIITSA</span>
              </div>
              <p className="text-slate-400 text-sm mb-5 leading-relaxed max-w-xs">
                The AI Operating System for Modern Clinics. Transforming healthcare delivery across India.
              </p>
              <div className="flex items-center gap-3 mb-4">
                <a href="https://linkedin.com/company/viitsa" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-600 hover:text-white transition-all">
                  <Linkedin size={16} />
                </a>
                <a href="https://instagram.com/viitsa" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-600 hover:text-white transition-all">
                  <Instagram size={16} />
                </a>
                <a href="mailto:support@viitsa.com" className="h-9 w-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-emerald-600 hover:text-white transition-all">
                  <Mail size={16} />
                </a>
              </div>
              <p className="text-slate-500 text-xs">viitsa.com</p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                {[['Home', '#home'], ['Features', '#features'], ['AI Navigator', '#ai'], ['How It Works', '#how'], ['Pricing', '#pricing']].map(([label, href]) => (
                  <li key={label}>
                    <button onClick={() => scrollTo(href.slice(1))} className="text-slate-400 hover:text-emerald-400 transition-colors">{label}</button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Products</h4>
              <ul className="space-y-2.5 text-sm">
                {[['Clinic Dashboard', '/clinic/dashboard'], ['Patient Portal', '/patient'], ['AI Navigator', '#ai'], ['Analytics', '#features'], ['Mobile App', '#features']].map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith('/') ? (
                      <button onClick={() => goTo(href)} className="text-slate-400 hover:text-emerald-400 transition-colors">{label}</button>
                    ) : (
                      <button onClick={() => scrollTo(href.slice(1))} className="text-slate-400 hover:text-emerald-400 transition-colors">{label}</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => goTo('/about')} className="text-slate-400 hover:text-emerald-400 transition-colors">About Us</button></li>
                <li><button onClick={() => goTo('/careers')} className="text-slate-400 hover:text-emerald-400 transition-colors">Careers</button></li>
                <li><button onClick={() => goTo('/blog')} className="text-slate-400 hover:text-emerald-400 transition-colors">Blog</button></li>
                <li><button onClick={() => goTo('/press-kit')} className="text-slate-400 hover:text-emerald-400 transition-colors">Press Kit</button></li>
              </ul>
              <h4 className="text-white font-bold mb-3 mt-5 text-sm uppercase tracking-wider">Legal</h4>
              <ul className="space-y-2.5 text-sm">
                <li><button onClick={() => goTo('/privacy')} className="text-slate-400 hover:text-emerald-400 transition-colors">Privacy Policy</button></li>
                <li><button onClick={() => goTo('/terms')} className="text-slate-400 hover:text-emerald-400 transition-colors">Terms of Service</button></li>
                <li><button onClick={() => goTo('/refund')} className="text-slate-400 hover:text-emerald-400 transition-colors">Refund Policy</button></li>
                <li><button onClick={() => goTo('/hipaa')} className="text-slate-400 hover:text-emerald-400 transition-colors">HIPAA Compliance</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">&copy; {new Date().getFullYear()} VIITSA. All rights reserved.</p>
            <div className="flex items-center gap-4 text-sm">
              <button onClick={() => goTo('/privacy')} className="text-slate-500 hover:text-emerald-400 transition-colors">Privacy</button>
              <button onClick={() => goTo('/terms')} className="text-slate-500 hover:text-emerald-400 transition-colors">Terms</button>
              <button onClick={() => goTo('/login')} className="text-slate-500 hover:text-emerald-400 transition-colors">Login</button>
              <button onClick={() => goTo('/register')} className="text-slate-500 hover:text-emerald-400 transition-colors">Register</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
