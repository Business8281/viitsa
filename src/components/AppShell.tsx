import { useState, useEffect } from 'react';
import { LogOut, Menu, X, Bell, ChevronDown, CalendarDays, Home } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useClinicData } from '../lib/useClinicData';
import { NAV_ITEMS, type NavKey } from '../lib/nav';
import { Avatar } from './ui';
import { ViitsaLogo } from './ViitsaLogo';
import { formatLongDate } from '../lib/format';
import type { Role } from '../lib/types';

interface AppShellProps {
  children: React.ReactNode;
}

const routeLoaders: Record<string, () => Promise<any>> = {
  dashboard: () => import('../screens/DashboardScreen'),
  appointments: () => import('../screens/AppointmentsScreen'),
  billing: () => import('../screens/BillingScreen'),
  patients: () => import('../screens/PatientsScreen'),
  inventory: () => import('../screens/InventoryScreen'),
  navigator: () => import('../screens/AINavigatorScreen'),
  analytics: () => import('../screens/AnalyticsScreen'),
  settings: () => import('../screens/SettingsScreen'),
};

function prefetchRoute(key: string) {
  try {
    if (routeLoaders[key]) {
      routeLoaders[key]().catch(() => {});
    }
  } catch {}
}

export function AppShell({ children }: AppShellProps) {
  const { user, clinic, logout } = useAuth();
  const { urgentQueue, pendingBills, criticalInventory } = useClinicData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname.split('/').pop();

  // Idle prefetch primary clinic pages for sub-second zero-wait navigation
  useEffect(() => {
    const idlePrefetch = () => {
      ['dashboard', 'appointments', 'billing', 'patients'].forEach((k) => prefetchRoute(k));
    };
    if ('requestIdleCallback' in window) {
      const handle = (window as any).requestIdleCallback(idlePrefetch, { timeout: 2000 });
      return () => (window as any).cancelIdleCallback?.(handle);
    } else {
      const timer = setTimeout(idlePrefetch, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!user) return null;

  const role = (user.role || 'patient') as Role;
  const isDoctor = role === 'clinic_doctor' || role === 'doctor' || location.pathname.startsWith('/doctor');
  const basePath = isDoctor ? '/doctor' : '/clinic';
  const clinicName = clinic?.name || user.clinic_name || 'VIITSA Health Clinic';
  const items = NAV_ITEMS.filter((n) => n.roles.includes(role));

  const badgeFor = (key: NavKey): number => {
    if (key === 'inventory') return criticalInventory.filter((i) => i.quantity <= 0).length;
    if (key === 'billing') return pendingBills.length;
    return 0;
  };
  const urgentToday = urgentQueue.length;

  const NavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const active = currentPath === item.key;
        const badge = badgeFor(item.key);
        return (
          <Link
            key={item.key}
            to={`${basePath}/${item.key}`}
            onMouseEnter={() => prefetchRoute(item.key)}
            onFocus={() => prefetchRoute(item.key)}
            onClick={() => setMobileOpen(false)}
            className={`nav-item w-full text-left ${active ? 'nav-item-active' : ''}`}
          >
            <Icon size={18} />
            <span className="flex-1">{item.label}</span>
            {badge > 0 && (
              <span className="badge bg-danger-bg text-danger text-[10px] px-1.5 py-0.5 min-w-[18px] justify-center">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-black/5 flex-col fixed inset-y-0">
        <div className="px-5 py-5 border-b border-black/5">
          <ViitsaLogo size="md" />
          <div className="mt-3 pl-1">
            <p className="text-[11px] text-ink-subtle uppercase tracking-wide">Clinic</p>
            <p className="text-sm font-semibold text-ink truncate">{clinicName}</p>
          </div>
        </div>
        <NavList />
        <div className="border-t border-black/5 p-3">
          <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
            <Avatar name={user.name || 'User'} color={user.avatar_color} size={36} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{user.name || 'User'}</p>
              <p className="text-xs text-ink-muted capitalize">{role}</p>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost w-full justify-start text-sm">
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-white flex flex-col animate-slide-up">
            <div className="px-5 py-4 border-b border-black/5 flex items-center justify-between">
              <ViitsaLogo size="sm" />
              <button onClick={() => setMobileOpen(false)} className="p-1.5 text-ink-subtle">
                <X size={18} />
              </button>
            </div>
            <NavList />
            <div className="border-t border-black/5 p-3">
              <button onClick={logout} className="btn-ghost w-full justify-start">
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-64 min-w-0 max-w-full">
        {/* Topbar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-black/5">
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-1.5 -ml-1 text-ink-muted"
                aria-label="Open menu"
              >
                <Menu size={20} />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{clinicName}</p>
                <p className="text-xs text-ink-muted hidden sm:flex items-center gap-1">
                  <CalendarDays size={12} />
                  {formatLongDate(new Date())}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="hidden sm:flex p-2 rounded-lg text-ink-muted hover:bg-primary-50 hover:text-primary transition" aria-label="Home">
                <Home size={18} />
              </button>
              {urgentToday > 0 && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-danger-bg px-3 py-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-danger" />
                  </span>
                  <span className="text-xs font-semibold text-danger">{urgentToday} urgent in queue</span>
                </div>
              )}
              <button className="relative p-2 rounded-lg text-ink-muted hover:bg-primary-50 hover:text-primary transition">
                <Bell size={18} />
                {urgentToday + pendingBills.length > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-danger" />
                )}
              </button>
              <div className="flex items-center gap-2">
                <Avatar name={user.name} color={user.avatar_color} size={32} />
                <div className="hidden md:block">
                  <p className="text-xs font-semibold text-ink">{user.name}</p>
                  <p className="text-[10px] text-ink-muted capitalize">{role}</p>
                </div>
                <ChevronDown size={14} className="text-ink-subtle hidden md:block" />
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="p-3 sm:p-6 max-w-[1600px] mx-auto min-w-0">{children}</main>
      </div>
    </div>
  );
}
