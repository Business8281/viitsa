import { Link, useLocation } from 'react-router-dom';
import { Home, BrainCircuit, Calendar, FolderOpen, Receipt } from 'lucide-react';

export type PatientTab = 'home' | 'ai' | 'book' | 'records' | 'payments' | 'profile' | 'family' | 'timeline' | 'doctors';

interface PatientBottomNavProps {
  aiBadge?: boolean;
  paymentBadge?: number;
}

const TABS: { key: PatientTab; label: string; Icon: any }[] = [
  { key: 'home',     label: 'Home',     Icon: Home },
  { key: 'ai',       label: 'AI Check', Icon: BrainCircuit },
  { key: 'book',     label: 'Book',     Icon: Calendar },
  { key: 'records',  label: 'Records',  Icon: FolderOpen },
  { key: 'payments', label: 'Payments', Icon: Receipt },
];

export function PatientBottomNav({ aiBadge, paymentBadge }: PatientBottomNavProps) {
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop() || 'dashboard';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-bottom">
      <div className="grid grid-cols-5">
        {TABS.map(({ key, label, Icon }) => {
          // 'home' tab maps to 'dashboard' path
          const isActive = currentPath === (key === 'home' ? 'dashboard' : key);
          const hasNumericBadge = key === 'payments' && typeof paymentBadge === 'number' && paymentBadge > 0;
          const showDotBadge = key === 'ai' && Boolean(aiBadge);
          return (
            <Link
              key={key}
              to={`/patient/${key === 'home' ? 'dashboard' : key}`}
              className={`relative flex flex-col items-center pt-2 pb-safe pb-3 gap-0.5 transition-colors ${
                isActive ? 'text-[#106EBE]' : 'text-gray-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[#106EBE]" />
              )}
              <div className="relative">
                <Icon size={22} className={isActive ? 'text-[#106EBE]' : 'text-gray-400'} />
                {showDotBadge ? (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[#0FFCBE] border border-black/10" />
                ) : null}
                {hasNumericBadge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 rounded-full bg-[#106EBE] text-[10px] text-white font-bold flex items-center justify-center px-1 shadow-xs">
                    {(paymentBadge ?? 0) > 9 ? '9+' : paymentBadge}
                  </span>
                ) : null}
              </div>
              <span className={`text-[10px] font-bold ${isActive ? 'text-[#106EBE]' : 'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
