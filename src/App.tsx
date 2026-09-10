import { useState, useEffect, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AppShell } from './components/AppShell';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5FAFA] flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">
              !
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-6">
              We encountered an issue loading this page. Please return home or try refreshing.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = '/login';
              }}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition"
            >
              Return to Login
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
const EmergencyPage = lazy(() => import('./screens/EmergencyPage').then(m => ({ default: m.EmergencyPage })));

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

  if (user) {
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/clinic/dashboard" replace />;
  }

  return <>{children}</>;
}

function ClinicLayout() {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;

  return (
    <AppShell>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </AppShell>
  );
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'doctor') return <DoctorDashboard />;
  return <DashboardScreen />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthLoginPage />} />
        <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />

        {/* Protected clinic routes */}
        <Route
          path="/clinic"
          element={
            <ProtectedRoute>
              <ClinicLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/clinic/dashboard" replace />} />
          <Route path="dashboard" element={<RoleBasedDashboard />} />
          <Route path="patients" element={<PatientsScreen />} />
          <Route path="appointments" element={<AppointmentsScreen />} />
          <Route path="billing" element={<BillingScreen />} />
          <Route path="inventory" element={<InventoryScreen />} />
          <Route path="ai-navigator" element={<AINavigatorScreen />} />
          <Route path="analytics" element={<AnalyticsScreen />} />
          <Route path="settings" element={<SettingsScreen />} />
        </Route>
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

        {/* Emergency page */}
        <Route path="/emergency" element={<EmergencyPage />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
