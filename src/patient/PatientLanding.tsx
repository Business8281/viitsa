import { useState } from 'react';
import { Calendar, Brain, Phone, ArrowRight, Smartphone, X, CheckCircle, Shield } from 'lucide-react';
import type { Clinic } from '../lib/types';
import { ViitsaLogo } from '../components/ViitsaLogo';
import { useNavigate } from 'react-router-dom';

interface Props {
  clinic?: Clinic | null;
  onBook?: () => void;
  onAI?: () => void;
  onLogin?: () => void;
  onGuest?: () => void;
}

function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function PatientLanding({ clinic, onBook, onAI }: Props) {
  const navigate = useNavigate();
  const clinicName = clinic?.name ?? 'VIITSA Healthcare';

  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleBook = onBook || (() => navigate('/patient/book'));
  const handleAI = onAI || (() => navigate('/patient/ai'));

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setTimeout(() => {
      setGoogleLoading(false);
      navigate('/patient/dashboard');
    }, 800);
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneNumber.replace(/\D/g, '').length < 10) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setOtpSent(true);
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 4) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setShowPhoneModal(false);
      navigate('/patient/dashboard');
    }, 600);
  };

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'linear-gradient(180deg, #0A1628 0%, #0F2847 50%, #0A1628 100%)' }}>
      {/* Background radial effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0F6E56 0%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #0F6E56 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <ViitsaLogo size="lg" light showText={false} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">VIITSA</h1>
          <p className="text-base font-semibold text-white/90">{clinicName}</p>
          <p className="text-sm text-white/60 mt-2">Smarter Healthcare. For Everyone.</p>
        </div>

        <div className="w-full max-w-sm space-y-3 mb-6">
          {/* Book Appointment */}
          <button
            onClick={handleBook}
            className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-semibold text-base transition-all hover:brightness-110 active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: '#0F6E56' }}
          >
            <Calendar size={22} className="text-white" />
            <span className="text-white">Book Appointment</span>
            <ArrowRight size={18} className="text-white/70 ml-auto" />
          </button>

          {/* Check Symptoms with AI */}
          <button
            onClick={handleAI}
            className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 font-semibold text-base transition-all hover:bg-teal-950/40 active:scale-[0.98] border-2"
            style={{ backgroundColor: 'rgba(15, 110, 86, 0.15)', borderColor: '#0F6E56' }}
          >
            <Brain size={22} style={{ color: '#4AE3C5' }} />
            <span style={{ color: '#E1F5EE' }}>Check Symptoms with AI</span>
            <ArrowRight size={18} className="text-white/40 ml-auto" />
          </button>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full rounded-2xl py-3.5 px-6 flex items-center justify-center gap-3 font-medium text-sm transition-all hover:bg-white/10 active:scale-[0.98] border border-white/20 bg-white/5 backdrop-blur-sm shadow-md"
          >
            <GoogleIcon className="w-5 h-5 shrink-0" />
            <span className="text-white font-medium">
              {googleLoading ? 'Signing in...' : 'Sign in with Google'}
            </span>
          </button>

          {/* Phone OTP Login Button */}
          <button
            onClick={() => {
              setOtpSent(false);
              setPhoneNumber('');
              setOtpCode('');
              setShowPhoneModal(true);
            }}
            className="w-full rounded-2xl py-3.5 px-6 flex items-center justify-center gap-3 font-medium text-sm transition-all hover:bg-white/10 active:scale-[0.98] border border-white/20 bg-white/5 backdrop-blur-sm shadow-md"
          >
            <Smartphone size={20} className="text-teal-400 shrink-0" />
            <span className="text-white font-medium">Sign in with Phone OTP</span>
          </button>
        </div>

        {/* Back to Home */}
        <button
          onClick={() => navigate('/')}
          className="text-white/70 hover:text-white transition-colors text-sm font-medium mb-6 flex items-center justify-center gap-1.5"
        >
          <span>← Home</span>
        </button>
      </div>

      {/* Emergency Footer */}
      <div className="relative px-6 pb-8 pt-4">
        <a
          href="tel:108"
          className="w-full rounded-2xl py-4 flex items-center justify-center gap-3 font-bold text-base bg-red-600 hover:bg-red-700 text-white shadow-lg transition-transform active:scale-[0.98]"
        >
          <Phone size={22} />
          <span>Emergency: Call 108</span>
        </a>
        <p className="text-center text-white/40 text-xs mt-3">
          Powered by VIITSA — AI Healthcare Intelligence
        </p>
      </div>

      {/* Phone OTP Modal */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-white relative">
            <button
              onClick={() => setShowPhoneModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto mb-3">
                <Smartphone size={24} />
              </div>
              <h3 className="text-lg font-bold">Phone OTP Sign In</h3>
              <p className="text-xs text-slate-400 mt-1">
                {otpSent ? `Enter the 4-digit code sent to +91 ${phoneNumber}` : 'Enter your mobile number to receive OTP'}
              </p>
            </div>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                    Mobile Number <span className="text-slate-500 font-normal normal-case">(10 digits only)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-3 rounded-xl bg-slate-800 border border-slate-700 text-sm font-medium text-slate-300">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{10}"
                      value={phoneNumber}
                      onKeyDown={(e) => {
                        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                        if (e.ctrlKey || e.metaKey) return;
                        if (!/^\d$/.test(e.key)) e.preventDefault();
                      }}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 font-mono"
                      autoFocus
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">Must be exactly 10 digits, numbers only.</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || phoneNumber.replace(/\D/g, '').length !== 10}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/40 text-sm"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 text-center">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    maxLength={4}
                    className="w-full text-center text-2xl font-bold tracking-[0.4em] py-3 rounded-xl bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 4}
                  className="w-full py-3.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/40 text-sm"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>

                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="w-full text-center text-xs text-teal-400 hover:underline pt-1"
                >
                  Change phone number
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
