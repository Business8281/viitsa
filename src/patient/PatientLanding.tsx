import { Calendar, Brain, Phone, ArrowRight, UserCheck } from 'lucide-react';
import type { Clinic } from '../lib/types';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { useNavigate } from 'react-router-dom';

interface Props {
  clinic: Clinic | null;
  onBook: () => void;
  onAI: () => void;
  onLogin: () => void;
  onGuest: () => void;
}

export function PatientLanding({ clinic, onBook, onAI, onLogin, onGuest }: Props) {
  const navigate = useNavigate();
  const clinicName = clinic?.name ?? 'VIITSA';

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0F2847 50%, #0A1628 100%)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0F6E56 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0F6E56 0%, transparent 70%)' }} />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <ViitsaLogo size="lg" light showText={false} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">VIITSA</h1>
          <p className="text-base font-semibold text-white/90">{clinicName}</p>
          <p className="text-sm text-white/60 mt-2">Smarter Healthcare. For Everyone.</p>
        </div>

        <div className="w-full max-w-sm space-y-3 mb-6">
          <button
            onClick={onBook}
            className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-semibold text-base transition-transform active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: '#0F6E56' }}
          >
            <Calendar size={22} className="text-white" />
            <span className="text-white">Book Appointment</span>
            <ArrowRight size={18} className="text-white/70 ml-auto" />
          </button>

          <button
            onClick={onAI}
            className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-semibold text-base transition-transform active:scale-[0.98] border-2"
            style={{ backgroundColor: 'rgba(15, 110, 86, 0.15)', borderColor: '#0F6E56' }}
          >
            <Brain size={22} style={{ color: '#4AE3C5' }} />
            <span style={{ color: '#E1F5EE' }}>Check Symptoms with AI</span>
            <ArrowRight size={18} className="text-white/40 ml-auto" />
          </button>

          <button
            onClick={onGuest}
            className="w-full rounded-2xl py-3 px-6 flex items-center justify-center gap-3 font-medium text-sm transition-transform active:scale-[0.98] border border-white/20"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <UserCheck size={18} className="text-white/60" />
            <span className="text-white/70">Continue as Guest</span>
            <span className="text-white/30 text-xs ml-auto">AI only</span>
          </button>
        </div>

        <button onClick={() => navigate('/')} className="text-white/70 text-sm font-medium mb-6 flex items-center justify-center gap-1.5">
          <span>← Home</span>
        </button>
      </div>

      <div className="relative px-6 pb-8 pt-4">
        <a
          href="tel:108"
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-3 font-bold text-base bg-red-600 text-white shadow-lg transition-transform active:scale-[0.98]"
        >
          <Phone size={22} />
          <span>Emergency: Call 108</span>
        </a>
        <p className="text-center text-white/40 text-xs mt-3">Powered by VIITSA — AI Healthcare Intelligence</p>
      </div>
    </div>
  );
}
