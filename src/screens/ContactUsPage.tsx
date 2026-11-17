import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Globe, MapPin, Building2 } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function ContactUsPage() {
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
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Contact Us</h1>
          <p className="text-slate-600 mb-8">We're here to help and answer any question you might have. We look forward to hearing from you.</p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 rounded-xl border border-teal-200 bg-teal-50/70">
              <div className="w-12 h-12 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Building2 size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-teal-950">Hospital & Enterprise Custom Quotes</h3>
                <p className="text-sm text-teal-800">For multi-specialty hospitals, IPD nursing homes, and custom enterprise quotes, email <strong className="text-teal-950 font-bold">support@viitsa.com</strong> or call our dedicated hospital solutions desk.</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <MapPin size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Registered Address</h3>
                <p className="text-sm text-slate-600">VIITSA Headquarters, Hyderabad, Telangana, India</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Phone size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Phone</h3>
                <p className="text-sm text-slate-600">+91 98765 43210</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Email</h3>
                <p className="text-sm text-slate-600">support@viitsa.com</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 bg-slate-50">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <Globe size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Website</h3>
                <p className="text-sm text-slate-600">viitsa.com</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
