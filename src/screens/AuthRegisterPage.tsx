import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2, Mail, Lock, User, Phone, ArrowRight, Zap, Shield, CheckCircle,
  Home, AlertCircle, MailCheck, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../lib/toast';
import { ViitsaLogo } from '../components/ViitsaLogo';

type CheckState = 'idle' | 'checking' | 'exists' | 'available';

export function AuthRegisterPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailCheck, setEmailCheck] = useState<CheckState>('idle');
  const navigate = useNavigate();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    clinicName: '',
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    city: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-email`;
      const resp = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email }),
      });
      if (!resp.ok) return false;
      const data = await resp.json();
      return Boolean(data.exists);
    } catch {
      return false;
    }
  };

  const handleEmailBlur = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    setEmailCheck('checking');
    try {
      const exists = await checkEmailExists(email);
      setEmailCheck(exists ? 'exists' : 'available');
    } catch {
      setEmailCheck('idle');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (emailCheck === 'exists') {
      setError('An account with this email already exists. Please sign in instead.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      // Double-check email existence at submit time
      const exists = await checkEmailExists(formData.email.trim().toLowerCase());
      if (exists) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: {
          data: {
            clinic_name: formData.clinicName,
            owner_name: formData.ownerName,
            phone: formData.phone,
            city: formData.city,
            role: 'admin',
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already') || signUpError.message.toLowerCase().includes('exists')) {
          setError('An account with this email already exists. Please sign in instead.');
        } else {
          setError(signUpError.message);
        }
        setLoading(false);
        return;
      }

      if (data.session) {
        navigate('/dashboard');
      } else if (data.user) {
        setEmailSent(true);
        toast('Confirmation email sent! Check your inbox.', 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Registration failed: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 mb-6">
            <MailCheck size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-3">Check your email</h1>
          <p className="text-slate-600 mb-6">
            We sent a confirmation link to <strong>{formData.email}</strong>.
            Click the link to verify your email and activate your VIITSA account.
          </p>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-left mb-6">
            <p className="text-sm text-emerald-700 font-medium mb-1">What happens next?</p>
            <ul className="text-sm text-emerald-600 space-y-1">
              <li>1. Click the link in your email</li>
              <li>2. Your email gets verified</li>
              <li>3. You'll be redirected to set up your clinic</li>
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <Link to="/login" className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all">
              Continue to Login
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link to="/" className="text-slate-500 hover:text-slate-700 text-sm flex items-center justify-center gap-1.5">
              <Home size={14} /> Back to home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 flex">
      {/* Left Side - Registration Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-between mb-8">
            <ViitsaLogo size="md" />
            <Link to="/" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-emerald-600 transition">
              <Home size={14} /> Home
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Register Your Clinic</h1>
            <p className="text-slate-600">Create your VIITSA account with secure email verification</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-xl mb-5 flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {emailCheck === 'exists' && !error && (
            <div className="bg-amber-50 border border-amber-100 text-amber-700 text-sm px-4 py-3 rounded-xl mb-5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <AlertCircle size={16} /> This email is already registered.
              </span>
              <Link to="/login" className="font-semibold underline whitespace-nowrap">Sign in</Link>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Clinic Name *</label>
                <div className="relative">
                  <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="text" name="clinicName" value={formData.clinicName} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="Sunrise Clinic" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">City *</label>
                <input type="text" name="city" value={formData.city} onChange={handleChange}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Hyderabad" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Owner Name *</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="text" name="ownerName" value={formData.ownerName} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="Dr. Arun Sharma" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={(e) => { handleChange(e); setEmailCheck('idle'); }}
                  onBlur={handleEmailBlur}
                  className={`w-full pl-11 pr-10 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all ${
                    emailCheck === 'exists'
                      ? 'border-amber-400 focus:border-amber-500'
                      : emailCheck === 'available'
                      ? 'border-emerald-400 focus:border-emerald-500'
                      : 'border-slate-200 focus:border-emerald-500'
                  }`}
                  placeholder="admin@clinic.com"
                  required
                />
                {emailCheck === 'checking' && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                )}
                {emailCheck === 'available' && (
                  <CheckCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                )}
                {emailCheck === 'exists' && (
                  <AlertCircle size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500" />
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  placeholder="+91 98765 43210" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Password *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="password" name="password" value={formData.password} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="Min 8 characters" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm *</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                    placeholder="Confirm password" required />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading || emailCheck === 'exists'}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none">
              {loading ? (
                <>
                  <span className="w-5 h-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating account...
                </>
              ) : (
                <>
                  Register & Send Verification
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Branding */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 items-center justify-center p-12">
        <div className="max-w-lg text-white">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur rounded-full text-sm font-medium mb-6">
              <Zap className="w-4 h-4" />
              AI Healthcare Intelligence
            </div>
            <h2 className="text-4xl font-bold mb-4">Start Your Digital Transformation</h2>
            <p className="text-emerald-100 text-lg">
              Join the VIITSA network — connecting patients, clinics, and doctors with AI-powered healthcare intelligence.
            </p>
          </div>
          <div className="space-y-4">
            {['Secure email verification', 'AI-powered patient triage', 'Real-time analytics & insights', 'WhatsApp patient reminders'].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-4 h-4" />
                </div>
                <span>{feature}</span>
              </div>
            ))}
          </div>
          <div className="mt-12 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="text-sm">HIPAA Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              <span className="text-sm">End-to-End Encrypted</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
