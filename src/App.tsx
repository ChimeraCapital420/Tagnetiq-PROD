// FILE: src/App.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from '@/contexts/AppContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/theme-provider'; // Corrected Path
import { Toaster } from '@/components/ui/toaster';
import GlobalThemeBackground from '@/components/GlobalThemeBackground';
import AppLayout from '@/components/AppLayout';
import { MobileOptimized } from '@/components/MobileOptimized';
import Index from '@/pages/Index';
import Login from '@/pages/Login';
import SignUp from '@/pages/SignUp';
import Dashboard from '@/pages/Dashboard';
import Settings from '@/pages/Settings';
import Feedback from '@/pages/Feedback';
import NotFound from '@/pages/NotFound';
import Demo from '@/pages/Demo';
import DemoDashboard from '@/pages/DemoDashboard';
import DemoSettings from '@/pages/DemoSettings';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={user ? <Dashboard /> : <Index />} />
        <Route path="/login" element={!user ? <Login /> : <Dashboard />} />
        <Route path="/signup" element={!user ? <SignUp /> : <Dashboard />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Login />} />
        <Route path="/settings" element={user ? <Settings /> : <Login />} />
        <Route path="/feedback" element={user ? <Feedback /> : <Login />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/demo-dashboard" element={<DemoDashboard />} />
        <Route path="/demo-settings" element={<DemoSettings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppLayout>
  );
};

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <AuthProvider>
        <AppProvider>
          <Router>
            <MobileOptimized>
              <GlobalThemeBackground />
              <AppContent />
              <Toaster />
            </MobileOptimized>
          </Router>
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;