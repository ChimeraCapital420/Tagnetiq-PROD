// FILE: src/contexts/MfaContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

interface MfaContextType {
  isUnlocked: boolean;
  isLoading: boolean;
  isTrustedDevice: boolean;
  trustedUntil: Date | null;
  unlockVault: (rememberDevice?: boolean) => void;
  lockVault: (forgetDevice?: boolean) => void;
  forgetThisDevice: () => void;
}

const MfaContext = createContext<MfaContextType | undefined>(undefined);

// Simple device fingerprint based on browser characteristics
const generateDeviceFingerprint = (): string => {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    // @ts-ignore
    navigator.deviceMemory || 'unknown',
  ];
  
  // Simple hash function
  const str = components.join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

const TRUST_DURATION_DAYS = 30;
const STORAGE_KEY = 'mfa_trusted_device';

export const MfaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrustedDevice, setIsTrustedDevice] = useState(false);
  const [trustedUntil, setTrustedUntil] = useState<Date | null>(null);

  // Check for trusted device on mount
  useEffect(() => {
    const checkTrustedDevice = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
          setIsLoading(false);
          return;
        }

        const { fingerprint, expiresAt, userId } = JSON.parse(stored);
        const currentFingerprint = generateDeviceFingerprint();
        const expiry = new Date(expiresAt);
        
        // Validate: fingerprint matches, not expired, and same user
        if (
          fingerprint === currentFingerprint &&
          expiry > new Date() &&
          userId === session?.user?.id
        ) {
          console.log('[MFA] Trusted device detected, auto-unlocking vault');
          setIsUnlocked(true);
          setIsTrustedDevice(true);
          setTrustedUntil(expiry);
        } else {
          // Clear invalid/expired trust
          if (expiry <= new Date()) {
            console.log('[MFA] Trust expired, clearing');
          } else if (userId !== session?.user?.id) {
            console.log('[MFA] Different user, clearing trust');
          }
          localStorage.removeItem(STORAGE_KEY);
          setIsTrustedDevice(false);
          setTrustedUntil(null);
        }
      } catch (e) {
        console.warn('[MFA] Error checking trusted device:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
      setIsLoading(false);
    };

    if (session?.user?.id) {
      checkTrustedDevice();
    } else {
      setIsLoading(false);
    }
  }, [session?.user?.id]);

  // Unlock vault (called after successful TOTP verification)
  const unlockVault = useCallback((rememberDevice: boolean = false) => {
    console.log('[MFA] Unlocking vault, remember device:', rememberDevice);
    setIsUnlocked(true);

    if (rememberDevice && session?.user?.id) {
      const fingerprint = generateDeviceFingerprint();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + TRUST_DURATION_DAYS);

      const trustData = {
        fingerprint,
        expiresAt: expiresAt.toISOString(),
        userId: session.user.id,
        createdAt: new Date().toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(trustData));
      setIsTrustedDevice(true);
      setTrustedUntil(expiresAt);
      console.log('[MFA] Device trusted until:', expiresAt);
    }
  }, [session?.user?.id]);

  // Lock vault - optionally forget the device too
  const lockVault = useCallback((forgetDevice: boolean = false) => {
    console.log('[MFA] Locking vault, forget device:', forgetDevice);
    setIsUnlocked(false);

    if (forgetDevice) {
      localStorage.removeItem(STORAGE_KEY);
      setIsTrustedDevice(false);
      setTrustedUntil(null);
      console.log('[MFA] Device trust removed');
    }
  }, []);

  // Forget this device (remove trust but don't lock if currently unlocked)
  const forgetThisDevice = useCallback(() => {
    console.log('[MFA] Forgetting this device');
    localStorage.removeItem(STORAGE_KEY);
    setIsTrustedDevice(false);
    setTrustedUntil(null);
  }, []);

  // Lock vault when user logs out
  useEffect(() => {
    if (!session) {
      setIsUnlocked(false);
      // Don't clear trust on logout - they may want to stay trusted
      // They can manually "forget device" if needed
    }
  }, [session]);

  return (
    <MfaContext.Provider
      value={{
        isUnlocked,
        isLoading,
        isTrustedDevice,
        trustedUntil,
        unlockVault,
        lockVault,
        forgetThisDevice,
      }}
    >
      {children}
    </MfaContext.Provider>
  );
};

export const useMfa = (): MfaContextType => {
  const context = useContext(MfaContext);
  if (context === undefined) {
    throw new Error('useMfa must be used within a MfaProvider');
  }
  return context;
};