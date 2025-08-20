// FILE: src/App.tsx

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
import { MfaProvider } from '@/contexts/MfaContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// Pages and Components...
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import VaultPage from '@/pages/Vault';
import CertificatePage from '@/pages/Certificate';
import BetaControls from '@/pages/BetaControls';
import Investor from '@/pages/Investor';
import InvestorPortal from '@/pages/investor/Portal';
import BetaWelcome from '@/pages/beta/Welcome';
import BetaMissions from '@/pages/beta/Missions';
import BetaReferrals from '@/pages/beta/Referrals';
import BetaConsole from '@/pages/admin/BetaConsole';
import MapConsole from '@/pages/admin/MapConsole';
import Marketplace from '@/pages/arena/Marketplace';
import ChallengeDetail from '@/pages/arena/ChallengeDetail';
import Leaderboard from '@/pages/arena/Leaderboard';
import MessagesPage from '@/pages/arena/Messages';
import { FeedbackModal } from '@/components/beta/FeedbackModal';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert'; // Import the new alert

const AppRoutes: React.FC = () => {
    const { user, isAdmin } = useAuth();
    return (
        <Routes>
            {/* PUBLIC ROUTES */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" replace />} />
            <Route path="/certificate/:id" element={<CertificatePage />} />
            <Route path="/investor" element={<InvestorPortal />} /> 
            
            {/* AUTHENTICATED ROUTES */}
            <Route path="/dashboard" element={<ProtectedRoute isAllowed={!!user} to="/login"><Dashboard /></ProtectedRoute>} />
            <Route path="/vault" element={<ProtectedRoute isAllowed={!!user} to="/login"><VaultPage /></ProtectedRoute>} />
            <Route path="/beta/welcome" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaWelcome /></ProtectedRoute>} />
            <Route path="/beta/missions" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaMissions /></ProtectedRoute>} />
            <Route path="/beta/referrals" element={<ProtectedRoute isAllowed={!!user} to="/login"><BetaReferrals /></ProtectedRoute>} />

            {/* ARENA ROUTES */}
            <Route path="/arena/marketplace" element={<ProtectedRoute isAllowed={!!user} to="/login"><Marketplace /></ProtectedRoute>} />
            <Route path="/arena/challenge/:id" element={<ProtectedRoute isAllowed={!!user} to="/login"><ChallengeDetail /></ProtectedRoute>} />
            <Route path="/arena/leaderboard" element={<ProtectedRoute isAllowed={!!user} to="/login"><Leaderboard /></ProtectedRoute>} />
            <Route path="/arena/messages" element={<ProtectedRoute isAllowed={!!user} to="/login"><MessagesPage /></ProtectedRoute>} />
            
            {/* ADMIN ROUTES */}
            <Route path="/beta-controls" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaControls /></ProtectedRoute>} />
            <Route path="/admin/investors" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><Investor /></ProtectedRoute>} />
            <Route path="/admin/beta" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><BetaConsole /></ProtectedRoute>} />
            <Route path="/admin/map" element={<ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard"><MapConsole /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const AppContent: React.FC = () => {
  const { loading, profile, setProfile } = useAuth();
  const { isFeedbackModalOpen, setIsFeedbackModalOpen, isArenaWelcomeOpen, setIsArenaWelcomeOpen } = useAppContext();

  const handleDismissWelcome = async (dontShowAgain: boolean) => {
      setIsArenaWelcomeOpen(false);
      if (dontShowAgain && profile && !profile.has_seen_arena_intro) {
          try {
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) throw new Error("Not authenticated");

              await fetch('/api/arena/mark-intro-seen', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${session.access_token}` },
              });
              
              // Optimistically update the profile in the frontend
              setProfile(p => p ? { ...p, has_seen_arena_intro: true } : null);
          } catch (error) {
              toast.error("Could not save preference", { description: (error as Error).message });
          }
      }
  };

  if (loading) {
    return <div className="fixed inset-0 flex items-center justify-center bg-background"><p>Loading session...</p></div>;
  }

  return (
    <AppLayout>
      <AppRoutes />
      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
      <ArenaWelcomeAlert isOpen={isArenaWelcomeOpen} onDismiss={handleDismissWelcome} />
    </AppLayout>
  );
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppProvider>
          <BetaProvider>
            <MfaProvider>
              <Router>
                  <AppShell>
                      <AppContent />
                      <SonnerToaster />
                  </AppShell>
              </Router>
            </MfaProvider>
          </BetaProvider>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;