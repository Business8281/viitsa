import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function AboutUsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <ViitsaLogo size="sm" />
          <button onClick={() => navigate('/')} className="text-sm font-medium text-slate-600 hover:text-emerald-600 flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </header>
      <main className="flex-1 py-12 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">About Us</h1>
          <div className="prose prose-slate max-w-none prose-emerald">
            <p>At VIITSA, we are on a mission to transform healthcare delivery across India using artificial intelligence.</p>
            <h3>Our Vision</h3>
            <p>Our vision is to make healthcare intelligent, connected, accessible, and simple for everyone.</p>
            <h3>What We Do</h3>
            <p>We provide a comprehensive suite of AI-powered tools designed for modern healthcare professionals. From AI Health Navigators and smart triage to automated scheduling and digital billing, our platform connects patients, clinics, doctors, hospitals, diagnostic centers, and pharmacies.</p>
            <h3>Why VIITSA?</h3>
            <p>Traditional clinics face challenges with manual registrations, paper records, and language barriers. We bring modern, secure, and encrypted solutions to streamline operations and enhance patient care.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
