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
                window.location.href = '/';
              }}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition"
            >
              Return to Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const LandingPage       = lazy(() => import('./screens/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthLoginPage     = lazy(() => import('./screens/AuthLoginPage').then(m => ({ default: m.AuthLoginPage })));
const AdminLoginPage    = lazy(() => import('./screens/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboard    = lazy(() => import('./screens/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ClinicLoginPage   = lazy(() => import('./screens/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })));
const ClinicSetupPage   = lazy(() => import('./screens/ClinicSetupPage').then(m => ({ default: m.ClinicSetupPage })));
const SetupWizardPage   = lazy(() => import('./screens/SetupWizardPage').then(m => ({ default: m.SetupWizardPage })));
const DashboardScreen   = lazy(() => import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const PatientsScreen    = lazy(() => import('./screens/PatientsScreen').then(m => ({ default: m.PatientsScreen })));
const AppointmentsScreen = lazy(() => import('./screens/AppointmentsScreen').then(m => ({ default: m.AppointmentsScreen })));
const BillingScreen     = lazy(() => import('./screens/BillingScreen').then(m => ({ default: m.BillingScreen })));
const InventoryScreen   = lazy(() => import('./screens/InventoryScreen').then(m => ({ default: m.InventoryScreen })));
const AINavigatorScreen = lazy(() => import('./screens/AINavigatorScreen').then(m => ({ default: m.AINavigatorScreen })));
const AnalyticsScreen   = lazy(() => import('./screens/AnalyticsScreen').then(m => ({ default: m.AnalyticsScreen })));
const SettingsScreen    = lazy(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const DoctorDashboard   = lazy(() => import('./screens/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const PatientApp        = lazy(() => import('./patient/PatientApp').then(m => ({ default: m.PatientApp })));
const EmergencyPage     = lazy(() => import('./screens/EmergencyPage').then(m => ({ default: m.EmergencyPage })));

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

/** Redirects unauthenticated clinic users to /clinic/login */
function ClinicProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
  if (user.role === 'company_admin') return <Navigate to="/admin/dashboard" replace />;
  return <>{children}</>;
}

/** Admin public route — redirect if already logged in */
function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) {
    if (user.role === 'company_admin') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/clinic/login" replace />;
  }
  return <>{children}</>;
}

/** Admin protected route — only company_admin */
function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role !== 'company_admin') {
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Guard for /clinic/setup: must be authenticated admin and setup not yet complete */
function ClinicSetupRoute() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
  // If already set up, skip to dashboard
  if (user.clinic_setup_complete === true) return <Navigate to="/clinic/dashboard" replace />;
  return (
    <Suspense fallback={<PageLoader />}>
      <ClinicSetupPage />
    </Suspense>
  );
}

/** Patient-only public route: redirect patients away if already logged in */
function PatientPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) {
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    if (user.role === 'company_admin') return <Navigate to="/admin/dashboard" replace />;
    // Clinic users visiting /login are sent to clinic login
    return <Navigate to="/clinic/login" replace />;
  }
  return <>{children}</>;
}

/** Clinic-only public route: redirect if already authenticated */
function ClinicPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) {
    if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
    if (user.clinic_setup_complete === false) return <Navigate to="/clinic/setup" replace />;
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return <>{children}</>;
}

function ClinicLayout() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (user.role === 'patient') return <Navigate to="/patient/dashboard" replace />;
  // First-time clinic users must complete setup
  if (user.clinic_setup_complete === false) return <Navigate to="/clinic/setup" replace />;

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
        {/* Public landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Patient-only login */}
        <Route
          path="/login"
          element={
            <PatientPublicRoute>
              <AuthLoginPage />
            </PatientPublicRoute>
          }
        />

        {/* Admin login */}
        <Route
          path="/admin/login"
          element={
            <AdminPublicRoute>
              <AdminLoginPage />
            </AdminPublicRoute>
          }
        />

        {/* Admin dashboard */}
        <Route
          path="/admin/dashboard"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        {/* Redirect /admin → /admin/login */}
        <Route path="/admin" element={<Navigate to="/admin/login" replace />} />

        {/* Clinic-only login */}
        <Route
          path="/clinic/login"
          element={
            <ClinicPublicRoute>
              <ClinicLoginPage />
            </ClinicPublicRoute>
          }
        />

        {/* Clinic onboarding (first-time setup) */}
        <Route path="/clinic/setup" element={<ClinicSetupRoute />} />

        {/* Legacy register redirect */}
        <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />

        {/* Protected clinic routes */}
        <Route
          path="/clinic"
          element={
            <ClinicProtectedRoute>
              <ClinicLayout />
            </ClinicProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/clinic/dashboard" replace />} />
          <Route path="dashboard"    element={<RoleBasedDashboard />} />
          <Route path="patients"     element={<PatientsScreen />} />
          <Route path="appointments" element={<AppointmentsScreen />} />
          <Route path="billing"      element={<BillingScreen />} />
          <Route path="inventory"    element={<InventoryScreen />} />
          <Route path="ai-navigator" element={<AINavigatorScreen />} />
          <Route path="analytics"    element={<AnalyticsScreen />} />
          <Route path="settings"     element={<SettingsScreen />} />
        </Route>

        {/* Legacy setup wizard */}
        <Route
          path="/setup"
          element={
            <ClinicProtectedRoute>
              <SetupWizardPage />
            </ClinicProtectedRoute>
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
