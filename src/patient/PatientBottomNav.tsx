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
          const showBadge = key === 'ai' ? aiBadge : key === 'payments' && paymentBadge && paymentBadge > 0;
          const badgeCount = key === 'payments' ? paymentBadge : undefined;
          return (
            <Link
              key={key}
              to={`/patient/${key === 'home' ? 'dashboard' : key}`}
              className={`relative flex flex-col items-center pt-2 pb-safe pb-3 gap-0.5 transition-colors ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
              <div className="relative">
                <Icon size={22} className={isActive ? 'text-primary' : 'text-gray-400'} />
                {showBadge && !badgeCount && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-danger" />
                )}
                {badgeCount && badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 rounded-full bg-danger text-[10px] text-white font-bold flex items-center justify-center px-1">
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-primary' : 'text-gray-400'}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
