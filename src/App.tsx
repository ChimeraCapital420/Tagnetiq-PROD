// FILE: src/App.tsx
//
// v2.1 CHANGES:
//   - Added OracleThinkingOverlay — renders during analysis wait
//   - Replaces the dead 15-second screen with live progress visualization

import React, { useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import BoardroomPage from '@/pages/Boardroom';
import { FeedbackModal } from '@/components/beta/FeedbackModal';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';

// UPDATED: Import from refactored scanner module
import DualScanner from '@/components/scanner';

// UPDATED: Import from refactored oracle module
import { OraclePage } from '@/components/oracle';

// NEW: Oracle Thinking Overlay — replaces the dead screen during analysis
import OracleThinkingOverlay from '@/components/analysis/OracleThinkingOverlay';

// v2.0: Tour overlay — event-driven, choice steps, chained tours
import TourOverlay from '@/components/onboarding/TourOverlay';

// Sprint E+: Analytics
import { useAnalytics } from '@/hooks/useAnalytics';

// =============================================================================
// ONBOARDING GUARD — redirects to /onboarding if profile incomplete
// =============================================================================

const OnboardingGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, profile, loading } = useAuth();

    if (loading) return null;
    if (!user) return <>{children}</>;
    if (profile && !profile.onboarding_complete) {
        return <Navigate to="/onboarding" replace />;
    }
    return <>{children}</>;
};

// =============================================================================
// APP ROUTES
// =============================================================================

const AppRoutes: React.FC = () => {
    const { user, profile, isAdmin } = useAuth();
    const needsOnboarding = user && profile && !profile.onboarding_complete;

    return (
        <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" replace />} />
            <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" replace />} />
            <Route path="/certificate/:id" element={<CertificatePage />} />
            <Route path="/investor" element={<InvestorPortal />} />

            {/* Onboarding route */}
            <Route
                path="/onboarding"
                element={
                    <ProtectedRoute isAllowed={!!user} to="/login">
                        {needsOnboarding ? <Onboarding /> : <Navigate to="/dashboard" replace />}
                    </ProtectedRoute>
                }
            />

            {/* Protected routes — wrapped with OnboardingGuard */}
            <Route path="/dashboard" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><Dashboard /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/vault" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><VaultPage /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/oracle" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><OraclePage /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/beta/welcome" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><BetaWelcome /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/beta/missions" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><BetaMissions /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/beta/referrals" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><BetaReferrals /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/profile" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><ProfilePage /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/user/:userId" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><UserProfilePage /></OnboardingGuard>
                </ProtectedRoute>
            } />

            {/* Arena routes */}
            <Route path="/arena/marketplace" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><Marketplace /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/arena/challenge/:id" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><ChallengeDetail /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/arena/leaderboard" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><Leaderboard /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/arena/messages" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><MessagesPage /></OnboardingGuard>
                </ProtectedRoute>
            } />

            {/* Admin routes */}
            <Route path="/boardroom" element={
                <ProtectedRoute isAllowed={!!user} to="/login">
                    <OnboardingGuard><BoardroomPage /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/beta-controls" element={
                <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                    <OnboardingGuard><BetaControls /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/admin/investors" element={
                <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                    <OnboardingGuard><InvestorSuite /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/admin/investors/manage" element={
                <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                    <OnboardingGuard><Investor /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/admin/beta" element={
                <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                    <OnboardingGuard><BetaConsole /></OnboardingGuard>
                </ProtectedRoute>
            } />
            <Route path="/admin/map" element={
                <ProtectedRoute isAllowed={!!user && isAdmin} to="/dashboard">
                    <OnboardingGuard><MapConsole /></OnboardingGuard>
                </ProtectedRoute>
            } />

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
};

// =============================================================================
// APP CONTENT — modals, scanner, tour overlay, thinking overlay
// =============================================================================

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const { loading, user, profile, setProfile } = useAuth();
  const {
    isFeedbackModalOpen, setIsFeedbackModalOpen,
    isArenaWelcomeOpen, setIsArenaWelcomeOpen,
    isScannerOpen, setIsScannerOpen,
    isAnalyzing,
  } = useAppContext();
  const { trackEvent } = useAnalytics();

  // Track whether scanner has been opened this session (for tour event)
  const scannerOpenedRef = useRef(false);

  // ── Track session start ───────────────────────────────
  useEffect(() => {
    if (user) trackEvent('session_start', 'engagement');
  }, [user, trackEvent]);

  // ── Auth token for tour API calls ─────────────────────
  const [authToken, setAuthToken] = React.useState<string | undefined>();
  useEffect(() => {
    if (user) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setAuthToken(session?.access_token);
      });
    }
  }, [user]);

  // ── Dispatch scanner-opened event ─────────────────────
  useEffect(() => {
    if (isScannerOpen && !scannerOpenedRef.current) {
      scannerOpenedRef.current = true;
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('tagnetiq:scanner-opened'));
      }, 300);
    }
  }, [isScannerOpen]);

  // ── Tour action handler ───────────────────────────────
  const handleTourAction = useCallback((
    action: string,
    payload?: { navigateTo?: string; triggersTour?: string }
  ) => {
    switch (action) {
      case 'open_scanner':
        setIsScannerOpen(true);
        break;
      case 'navigate':
        if (payload?.navigateTo) {
          navigate(payload.navigateTo);
        }
        break;
      default:
        break;
    }
  }, [navigate, setIsScannerOpen]);

  const handleTourComplete = useCallback((tourId: string) => {
    trackEvent('onboard_complete', 'onboarding', { tourId });
  }, [trackEvent]);

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
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <p>Loading session...</p>
      </div>
    );
  }

  const screenName = profile?.screen_name || profile?.full_name || user?.email?.split('@')[0] || 'friend';

  return (
    <AppLayout>
      <AppRoutes />

      {/* Existing modals */}
      <FeedbackModal isOpen={isFeedbackModalOpen} onClose={() => setIsFeedbackModalOpen(false)} />
      <ArenaWelcomeAlert isOpen={isArenaWelcomeOpen} onDismiss={handleDismissWelcome} />
      <DualScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />

      {/* NEW: Oracle Thinking Overlay — replaces the dead screen during analysis
          Renders when isAnalyzing is true (set by DualScanner on submit).
          Reads real-time SSE progress from AppContext.scanProgress.
          Auto-hides when isAnalyzing flips to false (analysis complete or error). */}
      <OracleThinkingOverlay />

      {/* v2.0: Tour overlay */}
      {user && profile?.onboarding_complete && (
        <TourOverlay
          screenName={screenName}
          authToken={authToken}
          onTourComplete={handleTourComplete}
          onAction={handleTourAction}
        />
      )}
    </AppLayout>
  );
};

// =============================================================================
// APP ROOT
// =============================================================================

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