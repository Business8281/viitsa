import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ViitsaLogo } from '../components/ViitsaLogo';

export function CareersPage() {
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
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-100 p-8 sm:p-12 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Careers at VIITSA</h1>
          <p className="text-slate-600 mb-8">We are always looking for talented individuals to join our team in revolutionizing healthcare.</p>
          <div className="p-8 bg-emerald-50 rounded-xl text-emerald-800">
            <p>Currently, there are no open positions. Please check back later or send your resume to <strong>careers@viitsa.com</strong>.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
