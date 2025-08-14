import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { BetaProvider } from '@/contexts/BetaContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import AppLayout from '@/components/AppLayout';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/routes/ProtectedRoute';

// Pages and Components
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

const AppRoutes: React.FC = () => {
    return (
        <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/beta/welcome" element={<BetaWelcome />} />
            <Route path="/beta/missions" element={<BetaMissions />} />
            <Route path="/beta/referrals" element={<BetaReferrals />} />
            <Route path="/beta-controls" element={<BetaControls />} />
            <Route path="/admin/investors" element={<Investor />} />
            <Route path="/admin/beta" element={<BetaConsole />} />
            <Route path="/admin/map" element={<MapConsole />} />
            <Route path="/investor" element={<InvestorPortal />} /> 
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const AppContent: React.FC = () => {
  const { loading } = useAuth();
  const { isFeedbackModalOpen, setIsFeedbackModalOpen } = useAppContext();

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <AppLayout>
      <AppRoutes />
      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
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