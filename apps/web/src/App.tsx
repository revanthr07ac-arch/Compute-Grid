import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { Layout } from './components/Layout.js';

// Pages
import { LandingPage } from './pages/LandingPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { JobsPage } from './pages/JobsPage.js';
import { JobWizardPage } from './pages/JobWizardPage.js';
import { JobDetailPage } from './pages/JobDetailPage.js';
import { WorkersPage } from './pages/WorkersPage.js';
import { WorkerOnboardingPage } from './pages/WorkerOnboardingPage.js';
import { TaskExplorerPage } from './pages/TaskExplorerPage.js';
import { ArtifactsPage } from './pages/ArtifactsPage.js';
import { ActivityLogsPage } from './pages/ActivityLogsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AdminPage } from './pages/AdminPage.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5000,
    },
  },
});

const ProtectedRoute: React.FC<{ children: React.ReactNode; adminOnly?: boolean }> = ({
  children,
  adminOnly = false,
}) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0d14] flex items-center justify-center text-slate-400 text-xs font-mono">
        Authenticating ComputeGrid Session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Pages */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Authenticated Dashboard Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/new" element={<JobWizardPage />} />
              <Route path="/jobs/:jobId" element={<JobDetailPage />} />
              <Route path="/workers" element={<WorkersPage />} />
              <Route path="/workers/onboarding" element={<WorkerOnboardingPage />} />
              <Route path="/tasks" element={<TaskExplorerPage />} />
              <Route path="/artifacts" element={<ArtifactsPage />} />
              <Route path="/logs" element={<ActivityLogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
