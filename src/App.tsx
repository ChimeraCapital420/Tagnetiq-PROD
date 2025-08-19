// FILE: src/App.tsx (FINAL CORRECTION)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BetaProvider } from '@/contexts/BetaContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import AppLayout from '@/components/AppLayout';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/routes/ProtectedRoute';

// Pages and Components...
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import BetaControls from '@/pages/BetaControls';
import Investor from '@/pages/Investor';
import InvestorPortal from '@/pages/investor/Portal';
import BetaWelcome from '@/pages/beta/Welcome';
import BetaMissions from '@/pages/beta/Missions';
import BetaReferrals from '@/pages/beta/Referrals';
import BetaConsole from '@/pages/admin/BetaConsole';
import MapConsole from '@/pages/admin/MapConsole';
import { FeedbackModal } from '@/components/beta/FeedbackModal';
import InvestorSuite from '@/pages/InvestorSuite';
import OnboardingPage from '@/pages/Onboarding';
import ApiHealthCheck from '@/pages/admin/ApiHealthCheck'; // Corrected import
import VaultPage from '@/pages/Vault';

// Create a client
const queryClient = new QueryClient();

const AppRoutes: React.FC = () => {
    const { user, profile, isAdmin } = useAuth();
    const hasCompletedOnboarding = profile?.onboarding_complete === true;

    return (
        <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" replace />} />
            
            <Route path="/onboarding" element={<ProtectedRoute isAllowed={!!user && !hasCompletedOnboarding} to="/dashboard"><OnboardingPage /></ProtectedRoute>} />

            <Route path="/dashboard" element={<ProtectedRoute isAllowed={!!user && hasCompletedOnboarding} to={user ? "/onboarding" : "/login"}><Dashboard /></ProtectedRoute>} />
            <Route path="/vault" element={<ProtectedRoute isAllowed={!!user && hasCompletedOnboarding} to={user ? "/onboarding" : "/login"}><VaultPage /></ProtectedRoute>} />
            
            <Route path="/beta/welcome" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaWelcome /></ProtectedRoute>} />
            <Route path="/beta/missions" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaMissions /></ProtectedRoute>} />
            <Route path="/beta/referrals" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaReferrals /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/investor-suite" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><InvestorSuite /></ProtectedRoute>} />
            <Route path="/beta-controls" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaControls /></ProtectedRoute>} />
            <Route path="/admin/investors" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><Investor /></ProtectedRoute>} />
            <Route path="/admin/beta" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaConsole /></ProtectedRoute>} />
            <Route path="/admin/map" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><MapConsole /></ProtectedRoute>} />
            
            {/* CORRECTED: The route for ApiHealthCheck was missing */}
            <Route path="/admin/health" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><ApiHealthCheck /></ProtectedRoute>} />
            
            <Route path="/investor" element={<InvestorPortal />} /> 

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const AppContent: React.FC = () => {
  const { loading, user } = useAuth();
  const { isFeedbackModalOpen, setIsFeedbackModalOpen } = useAppContext();

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><p>Loading session...</p></div>;
  }

  return (
    <AppLayout>
      <AppRoutes />
      {user && <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />}
    </AppLayout>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <AppProvider>
            <BetaProvider>
              <Router>
                  <AppShell>
                      <AppContent />
                      <SonnerToaster />
                  </AppShell>
              </Router>
            </BetaProvider>
          </AppProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;