import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export function AuthActionDispatcher() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const continueUrl = searchParams.get('continueUrl');
    const returnUrl = searchParams.get('return');

    const isClinic =
      Boolean(continueUrl && continueUrl.includes('/clinic')) ||
      Boolean(returnUrl && returnUrl.includes('/clinic')) ||
      (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'clinic');

    const isAdmin =
      Boolean(continueUrl && continueUrl.includes('/admin')) ||
      Boolean(returnUrl && returnUrl.includes('/admin')) ||
      (typeof window !== 'undefined' && sessionStorage.getItem('viitsa_portal_intent') === 'admin');

    if (mode === 'resetPassword') {
      const params = new URLSearchParams(searchParams);
      let extractedReturn: string | null = null;
      if (continueUrl) {
        try {
          const parsed = new URL(continueUrl, window.location.origin);
          extractedReturn = parsed.searchParams.get('return');
        } catch {
          // Ignore invalid continueUrl
        }
      }
      if (!params.has('return')) {
        params.set('return', extractedReturn || (isAdmin ? '/admin/login' : isClinic ? '/clinic/login' : '/login'));
      }
      navigate(`/reset-password?${params.toString()}`, { replace: true });
      return;
    }

    if (mode === 'verifyEmail') {
      const targetPortal = isAdmin ? '/admin/login' : isClinic ? '/clinic/login' : '/login';
      const params = new URLSearchParams(searchParams);
      navigate(`${targetPortal}?${params.toString()}`, { replace: true });
      return;
    }

    // Default fallback
    navigate('/', { replace: true });
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center p-6 text-center">
      <div className="inline-flex items-center gap-2.5 text-slate-600 text-sm font-semibold">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
        <span>Redirecting securely to your portal...</span>
      </div>
    </div>
  );
}
