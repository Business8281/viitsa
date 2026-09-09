import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AppShell } from './components/AppShell';
import { NAV_ITEMS, type NavKey } from './lib/nav';
import type { Role } from './lib/types';

const LandingPage = lazy(() => import('./screens/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthLoginPage = lazy(() => import('./screens/AuthLoginPage').then(m => ({ default: m.AuthLoginPage })));
const AuthRegisterPage = lazy(() => import('./screens/AuthRegisterPage').then(m => ({ default: m.AuthRegisterPage })));
const SetupWizardPage = lazy(() => import('./screens/SetupWizardPage').then(m => ({ default: m.SetupWizardPage })));
const DashboardScreen = lazy(() => import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const PatientsScreen = lazy(() => import('./screens/PatientsScreen').then(m => ({ default: m.PatientsScreen })));
const AppointmentsScreen = lazy(() => import('./screens/AppointmentsScreen').then(m => ({ default: m.AppointmentsScreen })));
const BillingScreen = lazy(() => import('./screens/BillingScreen').then(m => ({ default: m.BillingScreen })));
const InventoryScreen = lazy(() => import('./screens/InventoryScreen').then(m => ({ default: m.InventoryScreen })));
const AINavigatorScreen = lazy(() => import('./screens/AINavigatorScreen').then(m => ({ default: m.AINavigatorScreen })));
const AnalyticsScreen = lazy(() => import('./screens/AnalyticsScreen').then(m => ({ default: m.AnalyticsScreen })));
const SettingsScreen = lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const DoctorDashboard = lazy(() => import('./screens/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const PatientApp = lazy(() => import('./patient/PatientApp').then(m => ({ default: m.PatientApp })));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#F5FAFA] flex items-center justify-center">
      <div className="inline-flex items-center gap-2 text-gray-500 text-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        Loading...
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

function ClinicDashboard() {
  const { user, loading } = useAuth();
  const [active, setActive] = useState<NavKey>('dashboard');

  useEffect(() => { if (user) setActive('dashboard'); }, [user]);

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  const allowed = NAV_ITEMS.find(n => n.key === active)?.roles.includes(user.role as Role);
  const effectiveKey: NavKey = allowed ? active : 'dashboard';

  const renderScreen = (key: NavKey) => {
    if (key === 'dashboard' && user.role === 'doctor') return <DoctorDashboard />;
    switch (key) {
      case 'dashboard':     return <DashboardScreen />;
      case 'patients':      return <PatientsScreen />;
      case 'appointments':  return <AppointmentsScreen />;
      case 'billing':       return <BillingScreen />;
      case 'inventory':     return <InventoryScreen />;
      case 'ai-navigator':  return <AINavigatorScreen />;
      case 'analytics':     return <AnalyticsScreen />;
      case 'settings':      return <SettingsScreen />;
      default:              return <DashboardScreen />;
    }
  };

  return (
    <AppShell activeKey={effectiveKey} onNavigate={setActive}>
      <Suspense fallback={<PageLoader />}>
        {renderScreen(effectiveKey)}
      </Suspense>
    </AppShell>
  );
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<PublicOnlyRoute><AuthLoginPage /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><AuthRegisterPage /></PublicOnlyRoute>} />

        {/* Protected clinic routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <ClinicDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/setup"
          element={
            <ProtectedRoute>
              <SetupWizardPage />
            </ProtectedRoute>
          }
        />

        {/* Patient portal */}
        <Route path="/patient/*" element={<PatientApp />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
