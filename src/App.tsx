// FILE: src/App.tsx (REVISED WITH AUTHENTICATION GATE)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BetaProvider } from '@/contexts/BetaContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import AppLayout from '@/components/AppLayout';
import AppShell from '@/components/AppShell';

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
import ApiHealthCheck from '@/pages/admin/ApiHealthCheck';
import VaultPage from '@/pages/Vault';

const queryClient = new QueryClient();

/**
 * AuthGate is a new component that handles all authentication-based routing.
 * It ensures the user's session and profile are loaded before rendering any protected content.
 */
const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><p>Loading Session...</p></div>;
  }

  if (!user) {
    // If the user is not logged in, redirect them to the login page.
    // We also store the page they were trying to access to redirect back after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!profile?.onboarding_complete) {
    // If the user is logged in but hasn't completed onboarding,
    // force them to the onboarding page.
    if (location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  } else {
    // If the user is logged in and has completed onboarding,
    // but they are somehow on the onboarding page, send them to the dashboard.
     if (location.pathname === '/onboarding') {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return <>{children}</>;
};


const App: React.FC = () => {
  const { isFeedbackModalOpen, setIsFeedbackModalOpen } = useAppContext();
  const { user } = useAuth();

  return (
    <AppLayout>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Index />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/investor" element={<InvestorPortal />} />

        {/* Onboarding Route - requires a user but not a completed profile */}
        <Route path="/onboarding" element={<AuthGate><OnboardingPage /></AuthGate>} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<AuthGate><Dashboard /></AuthGate>} />
        <Route path="/vault" element={<AuthGate><VaultPage /></AuthGate>} />
        <Route path="/beta/welcome" element={<AuthGate><BetaWelcome /></AuthGate>} />
        <Route path="/beta/missions" element={<AuthGate><BetaMissions /></AuthGate>} />
        <Route path="/beta/referrals" element={<AuthGate><BetaReferrals /></AuthGate>} />
        
        {/* Admin Routes - The AuthGate already ensures the user is logged in. */}
        <Route path="/investor-suite" element={<AuthGate><InvestorSuite /></AuthGate>} />
        <Route path="/beta-controls" element={<AuthGate><BetaControls /></AuthGate>} />
        <Route path="/admin/investors" element={<AuthGate><Investor /></AuthGate>} />
        <Route path="/admin/beta" element={<AuthGate><BetaConsole /></AuthGate>} />
        <Route path="/admin/map" element={<AuthGate><MapConsole /></AuthGate>} />
        <Route path="/admin/health" element={<AuthGate><ApiHealthCheck /></AuthGate>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {user && <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />}
    </AppLayout>
  );
};

// Main App Wrapper
function AppWrapper() {
  return (
    <Router>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <AuthProvider>
              <AppProvider>
                <BetaProvider>
                  <AppShell>
                    <App />
                    <SonnerToaster />
                  </AppShell>
                </BetaProvider>
              </AppProvider>
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
    </Router>
  );
}

export default AppWrapper;