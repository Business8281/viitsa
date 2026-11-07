import { useState, useEffect, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { ToastProvider } from './lib/toast';
import { AppShell } from './components/AppShell';
import { SectionErrorBoundary } from './components/SectionErrorBoundary';
import type { Role } from './lib/types';
import { clearAllViitsaCaches } from './lib/cacheCleaner';
import { auth } from './lib/firebase';

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
    // Automatically reload on chunk loading errors (deployments invalidate old chunks)
    if (
      error.name === 'ChunkLoadError' || 
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('dynamically imported module') ||
      error.message.includes('Importing a module script failed')
    ) {
      window.location.reload();
    }
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
            <p className="text-sm text-gray-600 mb-6" id="error-message">
              {this.state.error?.message || "Unknown error"}
            </p>
            <div className="space-y-2">
              <button
                onClick={async () => {
                  this.setState({ hasError: false, error: null });
                  await clearAllViitsaCaches({ reload: true });
                }}
                className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-xl transition shadow-sm"
              >
                Clear Cache & Reload App
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition"
              >
                Return to Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const lazyWithRetry = (componentImport: () => Promise<any>) =>
  lazy(async () => {
    try {
      const m = await componentImport();
      window.sessionStorage.removeItem('chunk_retry');
      return m;
    } catch (error: any) {
      const hasRetried = window.sessionStorage.getItem('chunk_retry');
      if (!hasRetried) {
        window.sessionStorage.setItem('chunk_retry', 'true');
        window.location.href = `${window.location.pathname}?_cb=${Date.now()}`;
      }
      throw error;
    }
  });

import { AuthActionDispatcher } from './components/AuthActionDispatcher';

const LandingPage       = lazyWithRetry(() => import('./screens/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthLoginPage     = lazyWithRetry(() => import('./screens/AuthLoginPage').then(m => ({ default: m.AuthLoginPage })));
const AdminLoginPage    = lazyWithRetry(() => import('./screens/AdminLoginPage').then(m => ({ default: m.AdminLoginPage })));
const AdminDashboard    = lazyWithRetry(() => import('./screens/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const ClinicLoginPage   = lazyWithRetry(() => import('./screens/ClinicLoginPage').then(m => ({ default: m.ClinicLoginPage })));
const ClinicSetupPage   = lazyWithRetry(() => import('./screens/ClinicSetupPage').then(m => ({ default: m.ClinicSetupPage })));
const DashboardScreen   = lazyWithRetry(() => import('./screens/DashboardScreen').then(m => ({ default: m.DashboardScreen })));
const PatientsScreen    = lazyWithRetry(() => import('./screens/PatientsScreen').then(m => ({ default: m.PatientsScreen })));
const AppointmentsScreen = lazyWithRetry(() => import('./screens/AppointmentsScreen').then(m => ({ default: m.AppointmentsScreen })));
const BillingScreen     = lazyWithRetry(() => import('./screens/BillingScreen').then(m => ({ default: m.BillingScreen })));
const InventoryScreen   = lazyWithRetry(() => import('./screens/InventoryScreen').then(m => ({ default: m.InventoryScreen })));
const AINavigatorScreen = lazyWithRetry(() => import('./screens/AINavigatorScreen').then(m => ({ default: m.AINavigatorScreen })));
const AnalyticsScreen   = lazyWithRetry(() => import('./screens/AnalyticsScreen').then(m => ({ default: m.AnalyticsScreen })));
const SettingsScreen    = lazyWithRetry(() => import('./screens/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const SubscriptionSuccessPage = lazyWithRetry(() => import('./screens/SubscriptionSuccessPage').then(m => ({ default: m.SubscriptionSuccessPage })));
const DoctorDashboard   = lazyWithRetry(() => import('./screens/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const PatientApp        = lazyWithRetry(() => import('./patient/PatientApp').then(m => ({ default: m.PatientApp })));
const EmergencyPage     = lazyWithRetry(() => import('./screens/EmergencyPage').then(m => ({ default: m.EmergencyPage })));
const ForgotPasswordPage = lazyWithRetry(() => import('./screens/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage  = lazyWithRetry(() => import('./screens/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const ClinicDocumentUploadPage = lazyWithRetry(() => import('./screens/ClinicDocumentUploadPage').then(m => ({ default: m.ClinicDocumentUploadPage })));
const ClinicPendingApprovalPage = lazyWithRetry(() => import('./screens/ClinicPendingApprovalPage').then(m => ({ default: m.ClinicPendingApprovalPage })));
const ClinicSubscriptionSetupPage = lazyWithRetry(() => import('./screens/ClinicSubscriptionSetupPage').then(m => ({ default: m.ClinicSubscriptionSetupPage })));
const QRWalkinPage = lazyWithRetry(() => import('./screens/QRWalkinPage').then(m => ({ default: m.QRWalkinPage })));
const AppointmentManagePage = lazyWithRetry(() => import('./screens/AppointmentManagePage').then(m => ({ default: m.AppointmentManagePage })));
const PrivacyPolicyPage = lazyWithRetry(() => import('./screens/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const TermsOfServicePage = lazyWithRetry(() => import('./screens/TermsOfServicePage').then(m => ({ default: m.TermsOfServicePage })));
const RefundPolicyPage = lazyWithRetry(() => import('./screens/RefundPolicyPage').then(m => ({ default: m.RefundPolicyPage })));
const AboutUsPage = lazyWithRetry(() => import('./screens/AboutUsPage').then(m => ({ default: m.AboutUsPage })));
const ContactUsPage = lazyWithRetry(() => import('./screens/ContactUsPage').then(m => ({ default: m.ContactUsPage })));
const CareersPage = lazyWithRetry(() => import('./screens/CareersPage').then(m => ({ default: m.CareersPage })));
const BlogPage = lazyWithRetry(() => import('./screens/BlogPage').then(m => ({ default: m.BlogPage })));
const PressKitPage = lazyWithRetry(() => import('./screens/PressKitPage').then(m => ({ default: m.PressKitPage })));
const HIPAAPage = lazyWithRetry(() => import('./screens/HIPAAPage').then(m => ({ default: m.HIPAAPage })));
const PrescriptionPreviewPage = lazyWithRetry(() => import('./screens/PrescriptionPreviewPage').then(m => ({ default: m.PrescriptionPreviewPage })));
const EmailTemplatePreviewPage = lazyWithRetry(() => import('./screens/EmailTemplatePreviewPage').then(m => ({ default: m.EmailTemplatePreviewPage })));

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

const ADMIN_ROLES = ['company_admin', 'company_manager', 'company_staff', 'admin'];
const CLINIC_ROLES = ['clinic_admin', 'clinic_doctor', 'clinic_staff', 'doctor', 'staff'];
const PATIENT_ROLES = ['patient', 'patient_attendant'];

/** Redirects unauthenticated or unapproved clinic users */
function ClinicProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, clinic, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/clinic/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  if (ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'clinic_doctor' || user.role === 'doctor') {
    const subPath = location.pathname.replace(/^\/clinic/, '');
    if (subPath === '/appointments' || subPath === '/patients' || subPath === '/billing' || subPath === '/ai-navigator') {
      return <Navigate to={`/doctor${subPath}`} replace />;
    }
    // Doctors must NEVER access clinic administrative routes (e.g. /clinic/settings, /clinic/inventory, /clinic/analytics, etc.)
    return <Navigate to="/doctor/dashboard" replace />;
  }

  // Clinic admin setup & approval progression
  if (user.role === 'clinic_admin') {
    if (user.clinic_setup_complete !== true) {
      return <Navigate to="/clinic/setup" replace />;
    }
    if (user.clinic_documents_uploaded !== true) {
      return <Navigate to="/clinic/upload-documents" replace />;
    }
    const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'unverified';
    if (verificationStatus !== 'approved') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
    if (clinic && (clinic.subscription_status === 'deactivated' || clinic.subscription_status === 'cancelled')) {
      return <Navigate to="/clinic/subscription-setup" replace />;
    }
  } else if (CLINIC_ROLES.includes(user.role)) {
    // Doctors and staff
    const verificationStatus = clinic?.verification_status;
    if (verificationStatus && verificationStatus !== 'approved') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
  }

  return <>{children}</>;
}

/** Admin public route — redirect if already logged in */
function AdminPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('mode') === 'resetPassword' || searchParams.get('oobCode') || searchParams.get('mode') === 'verifyEmail') {
      return <>{children}</>;
    }
    if (ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
    // If user has a patient or clinic role, allow AdminLoginPage to render so they can see the account switch prompt
    return <>{children}</>;
  }
  return <>{children}</>;
}

/** Admin protected route — only company_admin, company_manager, company_staff */
function AdminProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!ADMIN_ROLES.includes(user.role)) {
    if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Guard for /clinic/setup: must be authenticated admin and setup not yet complete */
function ClinicSetupRoute() {
  const { user, clinic, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  if (user.role !== 'clinic_admin') return <Navigate to="/clinic/dashboard" replace />;

  // If already completed setup, proceed to next step in onboarding progression
  if (user.clinic_setup_complete === true) {
    if (user.clinic_documents_uploaded !== true) {
      return <Navigate to="/clinic/upload-documents" replace />;
    }
    const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'unverified';
    if (verificationStatus !== 'approved') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
    if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') {
      return <Navigate to="/clinic/subscription-setup" replace />;
    }
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <ClinicSetupPage />
    </Suspense>
  );
}

function ClinicDocumentUploadRoute() {
  const { user, clinic, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  if (user.role !== 'clinic_admin') return <Navigate to="/clinic/dashboard" replace />;

  // Must complete setup form first before uploading documents
  if (user.clinic_setup_complete !== true) return <Navigate to="/clinic/setup" replace />;
  
  // If already uploaded documents, proceed to pending approval or dashboard
  if (user.clinic_documents_uploaded === true) {
    const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'unverified';
    if (verificationStatus !== 'approved') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
    if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') {
      return <Navigate to="/clinic/subscription-setup" replace />;
    }
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <ClinicDocumentUploadPage />
    </Suspense>
  );
}

function ClinicPendingApprovalRoute() {
  const { user, clinic, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;

  if (user.role === 'clinic_admin') {
    // Basic clinic info form must be completed first
    if (user.clinic_setup_complete !== true) return <Navigate to="/clinic/setup" replace />;
    // Documents must be uploaded before showing pending approval
    if (user.clinic_documents_uploaded !== true) return <Navigate to="/clinic/upload-documents" replace />;
  }

  const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'pending';
  if (verificationStatus === 'approved') {
    if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') return <Navigate to="/clinic/subscription-setup" replace />;
    return <Navigate to="/clinic/dashboard" replace />;
  }
  
  return (
    <Suspense fallback={<PageLoader />}>
      <ClinicPendingApprovalPage />
    </Suspense>
  );
}

function ClinicSubscriptionRoute() {
  const { user, clinic, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/clinic/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  
  if (user.role === 'clinic_admin') {
    if (user.clinic_setup_complete !== true) return <Navigate to="/clinic/setup" replace />;
    if (user.clinic_documents_uploaded !== true) return <Navigate to="/clinic/upload-documents" replace />;
  }
  
  const isPayingInvoice = new URLSearchParams(location.search).has('invoice');
  const isRetryOrSetup = new URLSearchParams(location.search).has('mode') || new URLSearchParams(location.search).has('renew');
  if (!isPayingInvoice && !isRetryOrSetup && clinic?.subscription_status !== 'deactivated' && clinic?.subscription_status !== 'cancelled' && clinic?.subscription_status !== 'payment_failed') {
    if (clinic?.verification_status !== 'approved' && clinic?.verification_status !== 'verified') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
  }
  
  return (
    <Suspense fallback={<PageLoader />}>
      <ClinicSubscriptionSetupPage />
    </Suspense>
  );
}


/** Patient-only public route: redirect patients away if already logged in */
function PatientPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) {
    // If incoming request contains verification or action codes, allow AuthLoginPage to render and process it
    const searchParams = new URLSearchParams(location.search);
    if (
      searchParams.get('mode') === 'verifyEmail' ||
      searchParams.get('mode') === 'resetPassword' ||
      searchParams.get('oobCode') ||
      searchParams.get('verified') === 'true' ||
      searchParams.get('unverified') === 'true'
    ) {
      return <>{children}</>;
    }

    if (auth.currentUser && !auth.currentUser.emailVerified && auth.currentUser.providerData.some(p => p.providerId === 'password')) {
      return <>{children}</>;
    }
    // If user has a clinic or admin role, allow AuthLoginPage to render so they can see the account switch prompt
    if (CLINIC_ROLES.includes(user.role as Role) || ADMIN_ROLES.includes(user.role as Role)) {
      return <>{children}</>;
    }
    return <Navigate to="/patient/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Protected route for patients */
function PatientProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (ADMIN_ROLES.includes(user.role as Role)) return <Navigate to="/admin/dashboard" replace />;
  if (CLINIC_ROLES.includes(user.role as Role)) return <Navigate to="/clinic/dashboard" replace />;
  return <>{children}</>;
}

/** Clinic-only public route: redirect if already authenticated */
function ClinicPublicRoute({ children }: { children: React.ReactNode }) {
  const { user, clinic, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (user) {
    // If incoming request contains verification or action codes, allow ClinicLoginPage to render and process it
    const searchParams = new URLSearchParams(location.search);
    if (
      searchParams.get('mode') === 'verifyEmail' ||
      searchParams.get('mode') === 'resetPassword' ||
      searchParams.get('oobCode') ||
      searchParams.get('verified') === 'true' ||
      searchParams.get('unverified') === 'true'
    ) {
      return <>{children}</>;
    }

    // If user has patient role, allow ClinicLoginPage to render so they can see the account switch prompt
    if (PATIENT_ROLES.includes(user.role)) {
      return <>{children}</>;
    }
    if (ADMIN_ROLES.includes(user.role as Role)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
    
    // For clinic admin:
    if (user.role === 'clinic_admin') {
      if (user.clinic_setup_complete !== true) {
        return <Navigate to="/clinic/setup" replace />;
      }
      if (user.clinic_documents_uploaded !== true) {
        return <Navigate to="/clinic/upload-documents" replace />;
      }
      const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'unverified';
      if (verificationStatus !== 'approved') {
        return <Navigate to="/clinic/pending-approval" replace />;
      }
      if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') {
        return <Navigate to="/clinic/subscription-setup" replace />;
      }
      return <Navigate to="/clinic/dashboard" replace />;
    }

    // Doctors
    if (user.role === 'clinic_doctor' || user.role === 'doctor') {
      if (clinic && clinic.verification_status !== 'approved') {
        return <Navigate to="/clinic/pending-approval" replace />;
      }
      return <Navigate to="/doctor/dashboard" replace />;
    }

    // Staff
    if (user.role === 'clinic_staff' || user.role === 'staff') {
      if (clinic && clinic.verification_status !== 'approved') {
        return <Navigate to="/clinic/pending-approval" replace />;
      }
      return <Navigate to="/clinic/dashboard" replace />;
    }
    
    return <Navigate to="/clinic/dashboard" replace />;
  }
  return <>{children}</>;
}

/** Protected route for doctors */
function DoctorProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, clinic, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/clinic/login?returnUrl=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  if (ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'clinic_admin') return <Navigate to="/clinic/dashboard" replace />;

  const verificationStatus = clinic?.verification_status || user.clinic_verification_status;
  if (verificationStatus && verificationStatus !== 'approved') {
    return <Navigate to="/clinic/pending-approval" replace />;
  }

  return <>{children}</>;
}

function DoctorLayout() {
  const { user, clinic, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (PATIENT_ROLES.includes(user.role)) return <Navigate to="/patient/dashboard" replace />;
  if (ADMIN_ROLES.includes(user.role)) return <Navigate to="/admin/dashboard" replace />;
  if (user.role === 'clinic_admin') return <Navigate to="/clinic/dashboard" replace />;

  const verificationStatus = clinic?.verification_status || user.clinic_verification_status;
  if (verificationStatus && verificationStatus !== 'approved') {
    return <Navigate to="/clinic/pending-approval" replace />;
  }

  return (
    <AppShell>
      <SectionErrorBoundary sectionName="Doctor Portal" fallbackUrl="/doctor/dashboard">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </SectionErrorBoundary>
    </AppShell>
  );
}

function ClinicLayout() {
  const { user, clinic, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/clinic/login" replace />;
  if (PATIENT_ROLES.includes(user.role)) {
    return <Navigate to="/patient/dashboard" replace />;
  }
  // Doctor roles should always be in /doctor/dashboard, never rendering ClinicLayout
  if (user.role === 'clinic_doctor' || user.role === 'doctor') {
    return <Navigate to="/doctor/dashboard" replace />;
  }
  if (!CLINIC_ROLES.includes(user.role as Role) && !ADMIN_ROLES.includes(user.role as Role)) {
    return <Navigate to="/clinic/login" replace />;
  }
  
  // Clinic admin setup guard
  if (user.role === 'clinic_admin') {
    if (user.clinic_setup_complete !== true) return <Navigate to="/clinic/setup" replace />;
    if (user.clinic_documents_uploaded !== true) return <Navigate to="/clinic/upload-documents" replace />;
    const verificationStatus = clinic?.verification_status || user.clinic_verification_status || 'unverified';
    if (verificationStatus !== 'approved') return <Navigate to="/clinic/pending-approval" replace />;
    if (clinic?.subscription_status !== 'active' && clinic?.subscription_status !== 'free_plan' && clinic?.subscription_status !== 'trial') {
      return <Navigate to="/clinic/subscription-setup" replace />;
    }
  } else if (user.role === 'clinic_doctor' || user.role === 'clinic_staff' || user.role === 'doctor' || user.role === 'staff') {
    if (clinic && clinic.verification_status !== 'approved') {
      return <Navigate to="/clinic/pending-approval" replace />;
    }
  }

  return (
    <AppShell>
      <SectionErrorBoundary sectionName="Clinic Portal" fallbackUrl="/clinic/dashboard">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </SectionErrorBoundary>
    </AppShell>
  );
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (user?.role === 'clinic_doctor' || user?.role === 'doctor') return <DoctorDashboard />;
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

        {/* Admin dashboard and sub-routes */}
        <Route
          path="/admin/*"
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />

        {/* Redirect /admin → /admin/dashboard */}
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

        {/* Protected doctor routes */}
        <Route
          path="/doctor"
          element={
            <DoctorProtectedRoute>
              <DoctorLayout />
            </DoctorProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/doctor/dashboard" replace />} />
          <Route path="dashboard"    element={<DoctorDashboard />} />
          <Route path="patients"     element={<PatientsScreen />} />
          <Route path="appointments" element={<AppointmentsScreen />} />
          <Route path="billing"      element={<BillingScreen />} />
          <Route path="ai-navigator" element={<AINavigatorScreen />} />
          <Route path="prescription" element={<PrescriptionPreviewPage />} />
        </Route>

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
        <Route path="/clinic/upload-documents" element={<ClinicDocumentUploadRoute />} />
        <Route path="/clinic/pending-approval" element={<ClinicPendingApprovalRoute />} />
        <Route path="/clinic/subscription-setup" element={<ClinicSubscriptionRoute />} />

        {/* Authentication & Portal Aliases */}
        <Route path="/register" element={<Navigate to="/login?mode=register" replace />} />
        <Route path="/signin" element={<Navigate to="/login" replace />} />
        <Route path="/patient/login" element={<Navigate to="/login" replace />} />
        <Route path="/patient/signin" element={<Navigate to="/login" replace />} />
        <Route path="/patient/register" element={<Navigate to="/login?mode=register" replace />} />
        <Route path="/patient/forgot-password" element={<Navigate to="/forgot-password?return=/login" replace />} />

        <Route path="/clinic/register" element={<Navigate to="/clinic/login?mode=register" replace />} />
        <Route path="/clinic/signin" element={<Navigate to="/clinic/login" replace />} />
        <Route path="/clinic/forgot-password" element={<Navigate to="/forgot-password?return=/clinic/login" replace />} />

        <Route path="/admin/register" element={<Navigate to="/admin/login?mode=register" replace />} />
        <Route path="/admin/signin" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/forgot-password" element={<Navigate to="/forgot-password?return=/admin/login" replace />} />

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
          <Route path="dashboard"    element={<DashboardScreen />} />
          <Route path="patients"     element={<PatientsScreen />} />
          <Route path="appointments" element={<AppointmentsScreen />} />
          <Route path="billing"      element={<BillingScreen />} />
          <Route path="inventory"    element={<InventoryScreen />} />
          <Route path="ai-navigator" element={<AINavigatorScreen />} />
          <Route path="analytics"    element={<AnalyticsScreen />} />
          <Route path="settings"     element={<SettingsScreen />} />
          <Route path="subscription-success" element={<SubscriptionSuccessPage />} />
        </Route>

        {/* Universal Subscription Confirmation & Success (direct Razorpay redirect) */}
        <Route path="/subscription-success" element={<Suspense fallback={<PageLoader />}><SubscriptionSuccessPage /></Suspense>} />

        {/* Legacy setup redirect */}
        <Route path="/setup" element={<Navigate to="/clinic/dashboard" replace />} />

        {/* Public Reset Password */}
        <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />

        {/* Patient portal */}
        <Route path="/patient/*" element={<PatientApp />} />

        {/* Emergency page */}
        <Route path="/emergency" element={<EmergencyPage />} />

        {/* QR Walkin Page */}
        <Route path="/qr-walkin" element={<Suspense fallback={<PageLoader />}><QRWalkinPage /></Suspense>} />
        <Route path="/walkin" element={<Suspense fallback={<PageLoader />}><QRWalkinPage /></Suspense>} />

        {/* Public Appointment Management — no login required */}
        <Route path="/appointment/manage" element={<Suspense fallback={<PageLoader />}><AppointmentManagePage /></Suspense>} />

        {/* Company and Legal Static Pages */}
        <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense>} />
        <Route path="/terms" element={<Suspense fallback={<PageLoader />}><TermsOfServicePage /></Suspense>} />
        <Route path="/refund" element={<Suspense fallback={<PageLoader />}><RefundPolicyPage /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<PageLoader />}><AboutUsPage /></Suspense>} />
        <Route path="/contact" element={<Suspense fallback={<PageLoader />}><ContactUsPage /></Suspense>} />
        <Route path="/careers" element={<Suspense fallback={<PageLoader />}><CareersPage /></Suspense>} />
        <Route path="/blog" element={<Suspense fallback={<PageLoader />}><BlogPage /></Suspense>} />
        <Route path="/press-kit" element={<Suspense fallback={<PageLoader />}><PressKitPage /></Suspense>} />
        <Route path="/hipaa" element={<Suspense fallback={<PageLoader />}><HIPAAPage /></Suspense>} />

        {/* Doctor Prescription Preview & Digital Rx Route */}
        <Route path="/prescription-preview" element={<Suspense fallback={<PageLoader />}><PrescriptionPreviewPage /></Suspense>} />
        <Route path="/prescription" element={<Suspense fallback={<PageLoader />}><PrescriptionPreviewPage /></Suspense>} />

        {/* Interactive Email Template Preview & Inspection */}
        <Route path="/email-preview" element={<Suspense fallback={<PageLoader />}><EmailTemplatePreviewPage /></Suspense>} />
        <Route path="/email-template" element={<Navigate to="/email-preview" replace />} />
        <Route path="/email-templates" element={<Navigate to="/email-preview" replace />} />

        {/* Forgot Password — universal, all user types */}
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        {/* Firebase Authentication Action Dispatcher (custom domain handler) */}
        <Route path="/__/auth/action" element={<AuthActionDispatcher />} />
        <Route path="/auth/action" element={<AuthActionDispatcher />} />

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
