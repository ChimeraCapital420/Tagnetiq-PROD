// FILE: src/App.tsx (REPLACE THIS FILE'S CONTENT)

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './components/theme-provider';
import { Toaster } from './components/ui/toaster';
import GlobalThemeBackground from './components/GlobalThemeBackground';
import { WatermarkOverlay } from './components/WatermarkOverlay';
import ResponsiveNavigation from './components/ResponsiveNavigation';

// Page Imports
import Index from './pages/Index';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Feedback from './pages/Feedback';
import NotFound from './pages/NotFound';
import { BetaControlsPage } from './pages/admin/BetaControlsPage';
import { InvestorSuitePage } from './pages/admin/InvestorSuitePage';
import { AdminRoute } from './components/auth/AdminRoute';
import { MultiImageAnalyzerPage } from './pages/analyze/MultiImageAnalyzerPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Determine if the Navbar should be shown
  const showNavbar = user && !['/', '/login', '/signup'].includes(location.pathname);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">Loading Application...</div>;
  }

  return (
    <>
      {showNavbar && <ResponsiveNavigation />}
      <main className={showNavbar ? "pt-16" : ""}>
        <Routes>
          <Route path="/" element={!user ? <Index /> : <Navigate to="/dashboard" />} />
          <Route path="/login" element={!user ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/signup" element={!user ? <SignUp /> : <Navigate to="/dashboard" />} />

          {/* Protected Routes that require a user to be logged in */}
          <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/settings" element={user ? <Settings /> : <Navigate to="/login" />} />
          <Route path="/feedback" element={user ? <Feedback /> : <Navigate to="/login" />} />
          <Route path="/analyze/multi-image" element={user ? <MultiImageAnalyzerPage /> : <Navigate to="/login" />} />
          
          {/* Admin-Only Routes */}
          <Route
            path="/admin/beta-controls"
            element={<AdminRoute><BetaControlsPage /></AdminRoute>}
          />
          <Route
            path="/admin/investor-suite"
            element={<AdminRoute><InvestorSuitePage /></AdminRoute>}
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppProvider>
          <Router>
            <GlobalThemeBackground />
            <WatermarkOverlay />
            <AppContent />
            <Toaster />
          </Router>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;