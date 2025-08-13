// FILE: src/components/auth/AdminRoute.tsx (CREATE THIS NEW FILE)

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading User...</div>;
  }

  // NOTE: For demo purposes, we are checking a hardcoded email.
  // In a real app, this would check a role from the database: user?.user_metadata?.role === 'admin'
  if (!user || user.email !== "admin@tagnetiq.com") {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};