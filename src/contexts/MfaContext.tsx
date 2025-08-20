// FILE: src/contexts/MfaContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

interface MfaContextType {
  isMfaEnrolled: boolean;
  isVaultUnlocked: boolean;
  isLoading: boolean;
  checkMfaStatus: () => Promise<void>;
  unlockVault: () => void;
  lockVault: () => void;
}

const MfaContext = createContext<MfaContextType | undefined>(undefined);

export const useMfa = () => {
  const context = useContext(MfaContext);
  if (!context) {
    throw new Error('useMfa must be used within an MfaProvider');
  }
  return context;
};

export const MfaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isMfaEnrolled, setIsMfaEnrolled] = useState(false);
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkMfaStatus = useCallback(async () => {
    if (!user) {
      setIsMfaEnrolled(false);
      setIsVaultUnlocked(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const isEnrolled = data.totp.some(factor => factor.status === 'verified');
      setIsMfaEnrolled(isEnrolled);

      // Keep vault locked on status check
      const sessionUnlocked = sessionStorage.getItem('vault_unlocked');
      setIsVaultUnlocked(sessionUnlocked === 'true');

    } catch (error) {
      console.error("Error checking MFA status:", error);
      setIsMfaEnrolled(false);
      setIsVaultUnlocked(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  const unlockVault = () => {
    sessionStorage.setItem('vault_unlocked', 'true');
    setIsVaultUnlocked(true);
  };

  const lockVault = () => {
    sessionStorage.removeItem('vault_unlocked');
    setIsVaultUnlocked(false);
  };

  const value = {
    isMfaEnrolled,
    isVaultUnlocked,
    isLoading,
    checkMfaStatus,
    unlockVault,
    lockVault,
  };

  return <MfaContext.Provider value={value}>{children}</MfaContext.Provider>;
};
