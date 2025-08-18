// FILE: src/App.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
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
import InvestorSuite from './pages/InvestorSuite';
import OnboardingPage from './pages/Onboarding'; // Import the new Onboarding page

const AppRoutes: React.FC = () => {
    const { user, profile, isAdmin } = useAuth();
    const hasCompletedOnboarding = profile?.onboarding_complete === true;

    return (
        <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" replace />} />
            
            {/* New Onboarding Route */}
            <Route path="/onboarding" element={<ProtectedRoute isAllowed={!!user && !hasCompletedOnboarding} to="/dashboard"><OnboardingPage /></ProtectedRoute>} />

            {/* Core Dashboard Route - Now requires onboarding to be complete */}
            <Route path="/dashboard" element={<ProtectedRoute isAllowed={!!user && hasCompletedOnboarding} to={user ? "/onboarding" : "/login"}><Dashboard /></ProtectedRoute>} />
            
            <Route path="/beta/welcome" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaWelcome /></ProtectedRoute>} />
            <Route path="/beta/missions" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaMissions /></ProtectedRoute>} />
            <Route path="/beta/referrals" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaReferrals /></ProtectedRoute>} />
            
            {/* Admin Routes */}
            <Route path="/investor-suite" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><InvestorSuite /></ProtectedRoute>} />
            <Route path="/beta-controls" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaControls /></ProtectedRoute>} />
            <Route path="/admin/investors" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><Investor /></ProtectedRoute>} />
            <Route path="/admin/beta" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaConsole /></ProtectedRoute>} />
            <Route path="/admin/map" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><MapConsole /></ProtectedRoute>} />
            
            {/* Public Investor Portal */}
            <Route path="/investor" element={<InvestorPortal />} /> 

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const AppContent: React.FC = () => {
  const { loading, user } = useAuth(); // Add user here to prevent flash of content
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
  );
}

export default App;