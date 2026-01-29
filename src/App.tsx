// FILE: src/App.tsx

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { BetaProvider } from '@/contexts/BetaContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import AppLayout from '@/components/AppLayout';
import AppShell from '@/components/AppShell';
import ProtectedRoute from '@/routes/ProtectedRoute';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// --- COMBINED IMPORTS ---
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import Dashboard from '@/pages/Dashboard';
import NotFound from '@/pages/NotFound';
import VaultPage from '@/pages/Vault';
import CertificatePage from '@/pages/Certificate';
import BetaWelcome from '@/pages/beta/Welcome';
import BetaMissions from '@/pages/beta/Missions';
import BetaReferrals from '@/pages/beta/Referrals';
import Marketplace from '@/pages/arena/Marketplace';
import ChallengeDetail from '@/pages/arena/ChallengeDetail';
import Leaderboard from '@/pages/arena/Leaderboard';
import MessagesPage from '@/pages/arena/Messages';
import BetaControls from '@/pages/BetaControls';
import Investor from '@/pages/Investor';
import InvestorSuite from '@/pages/InvestorSuite';
import BetaConsole from '@/pages/admin/BetaConsole';
import MapConsole from '@/pages/admin/MapConsole';
import InvestorPortal from '@/pages/investor/Portal';
import ProfilePage from '@/pages/Profile';
import UserProfilePage from '@/pages/UserProfilePage';
import Onboarding from '@/pages/Onboarding';
import { FeedbackModal } from '@/components/beta/FeedbackModal';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';
import DualScanner from '@/components/DualScanner';

// NEW: Component to handle onboarding redirect logic
const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading } = useAuth();
    
    // Still loading - show nothing to prevent flash
    if (loading) {
        return null;
    }
    
    // Not logged in - let ProtectedRoute handle it
    if (!user) {
        return <>{children}</>;
    }
    
    // Profile loaded and onboarding not complete - redirect to onboarding
    if (profile && !profile.onboarding_complete) {
        return <Navigate to="/onboarding" replace />;
    }
    
    // Onboarding complete or profile still loading - show content
    return <>{children}</>;
};

const AppRoutes: React.FC = () => {
    const { user, profile, isAdmin } = useAuth();
    
    // Determine if user needs onboarding (for the onboarding route itself)
    const needsOnboarding = user && profile && !profile.onboarding_complete;
    
    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" replace />} />
            <Route path="/certificate/:id" element={<CertificatePage />} />
            <Route path="/investor" element={<InvestorPortal />} />

            {/* NEW: Onboarding route - accessible only if user hasn't completed onboarding */}
            <Route 
                path="/onboarding" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        {needsOnboarding ? <Onboarding /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                } 
            />

            {/* Protected routes - wrapped with OnboardingGuard */}
            <Route 
                path="/dashboard" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <Dashboard />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/vault" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <VaultPage />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/beta/welcome" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <BetaWelcome />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/beta/missions" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <BetaMissions />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/beta/referrals" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <BetaReferrals />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/profile" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <ProfilePage />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />

            {/* User Profile route (view other users) */}
            <Route 
                path="/user/:userId" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <UserProfilePage />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />

            {/* Arena routes */}
            <Route 
                path="/arena/marketplace" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <Marketplace />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/arena/challenge/:id" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <ChallengeDetail />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/arena/leaderboard" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <Leaderboard />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/arena/messages" 
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        <OnboardingGuard>
                            <MessagesPage />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />

            {/* Admin routes */}
            <Route 
                path="/beta-controls" 
                element={
                    <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                        <OnboardingGuard>
                            <BetaControls />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/admin/investors" 
                element={
                    <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                        <OnboardingGuard>
                            <InvestorSuite />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/admin/investors/manage" 
                element={
                    <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                        <OnboardingGuard>
                            <Investor />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/admin/beta" 
                element={
                    <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                        <OnboardingGuard>
                            <BetaConsole />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />
            <Route 
                path="/admin/map" 
                element={
                    <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                        <OnboardingGuard>
                            <MapConsole />
                        </OnboardingGuard>
                    </ProtectedRoute>
                } 
            />

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

const AppContent: React.FC = () => {
  const { loading, profile, setProfile } = useAuth();
  const { isFeedbackModalOpen, setIsFeedbackModalOpen, isArenaWelcomeOpen, setIsArenaWelcomeOpen, isScannerOpen, setIsScannerOpen } = useAppContext();

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
      <DualScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
    </AppLayout>
  );
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
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
    </ThemeProvider>
  );
}

export default App;