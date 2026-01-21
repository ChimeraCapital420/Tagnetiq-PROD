// FILE: src/contexts/MfaContext.tsx

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface MfaContextType {
  isUnlocked: boolean;
  unlockVault: (rememberDevice?: boolean) => void;
  lockVault: () => void;
  isDeviceTrusted: boolean;
}

const MfaContext = createContext<MfaContextType | undefined>(undefined);

const TRUSTED_DEVICE_KEY = 'tagnetiq_trusted_device';
const TRUST_DURATION_DAYS = 30;

export const useMfa = (): MfaContextType => {
  const context = useContext(MfaContext);
  if (!context) {
    throw new Error('useMfa must be used within a MfaProvider');
  }
  return context;
};

interface MfaProviderProps {
  children: ReactNode;
}

// Generate a device fingerprint (simple version)
const getDeviceFingerprint = (): string => {
  const nav = window.navigator;
  const screen = window.screen;
  const fingerprint = [
    nav.userAgent,
    nav.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join('|');
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
};

export const MfaProvider = ({ children }: MfaProviderProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isDeviceTrusted, setIsDeviceTrusted] = useState(false);

  // Check for trusted device on mount
  useEffect(() => {
    const checkTrustedDevice = async () => {
      try {
        const stored = localStorage.getItem(TRUSTED_DEVICE_KEY);
        if (!stored) return;

        const { token, expires, fingerprint } = JSON.parse(stored);
        
        // Verify not expired
        if (new Date(expires) < new Date()) {
          localStorage.removeItem(TRUSTED_DEVICE_KEY);
          return;
        }

        // Verify fingerprint matches
        if (fingerprint !== getDeviceFingerprint()) {
          localStorage.removeItem(TRUSTED_DEVICE_KEY);
          return;
        }

        // Verify token with user session
        const { data: { user } } = await supabase.auth.getUser();
        if (user && token.includes(user.id.substring(0, 8))) {
          setIsDeviceTrusted(true);
          setIsUnlocked(true);
        }
      } catch (e) {
        localStorage.removeItem(TRUSTED_DEVICE_KEY);
      }
    };

    checkTrustedDevice();
  }, []);

  const unlockVault = async (rememberDevice = false) => {
    setIsUnlocked(true);

    if (rememberDevice) {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const expires = new Date();
          expires.setDate(expires.getDate() + TRUST_DURATION_DAYS);
          
          const trustData = {
            token: `${user.id.substring(0, 8)}_${Date.now()}_${Math.random().toString(36)}`,
            expires: expires.toISOString(),
            fingerprint: getDeviceFingerprint(),
          };
          
          localStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(trustData));
          setIsDeviceTrusted(true);
        }
      } catch (e) {
        console.warn('Could not save trusted device');
      }
    }
  };

  const lockVault = () => {
    setIsUnlocked(false);
    // Note: We don't remove trusted device on lock
    // User can still re-open without MFA if device is trusted
  };

  return (
    <MfaContext.Provider value={{ isUnlocked, unlockVault, lockVault, isDeviceTrusted }}>
      {children}
    </MfaContext.Provider>
  );
};