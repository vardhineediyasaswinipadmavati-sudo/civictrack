import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { StaffDashboard } from './pages/StaffDashboard';
import { ReportIssuePage } from './pages/ReportIssuePage';
import { IssueDetailPage } from './pages/IssueDetailPage';
import { InfrastructureListPage } from './pages/InfrastructureListPage';
import { InfrastructureDetailPage } from './pages/InfrastructureDetailPage';
import { HealthMapPage } from './pages/HealthMapPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

// Protected Route wrapper with strict role check
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-xs text-slate-500">
        Authenticating municipal session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Graceful redirection to the user's authorized role dashboard
    const redirectPath = user.role === 'admin' ? '/admin' : user.role === 'department_staff' ? '/staff' : '/citizen';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/map" element={<HealthMapPage />} />
              <Route path="/infrastructure" element={<InfrastructureListPage />} />
              <Route path="/infrastructure/:id" element={<InfrastructureDetailPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/issues/:id" element={<IssueDetailPage />} />

              {/* Citizen Reporting & Dashboard */}
              <Route
                path="/citizen"
                element={
                  <ProtectedRoute allowedRoles={['citizen', 'admin']}>
                    <CitizenDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/report"
                element={
                  <ProtectedRoute allowedRoles={['citizen', 'admin', 'department_staff']}>
                    <ReportIssuePage />
                  </ProtectedRoute>
                }
              />

              {/* Administrator Dashboard */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Department Staff Dashboard */}
              <Route
                path="/staff"
                element={
                  <ProtectedRoute allowedRoles={['department_staff', 'admin']}>
                    <StaffDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App;
