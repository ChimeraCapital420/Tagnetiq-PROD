// FILE: src/contexts/MfaContext.tsx
// FIXED: Added security level support (basic/enhanced) for optional MFA
// Users can now access vault without MFA when security is set to 'basic'
// Enhanced security requires MFA verification

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

// Security level type - basic allows vault access without MFA
type SecurityLevel = 'basic' | 'enhanced';

interface MfaContextType {
  isUnlocked: boolean;
  isLoading: boolean;
  isTrustedDevice: boolean;
  trustedUntil: Date | null;
  securityLevel: SecurityLevel;
  unlockVault: (rememberDevice?: boolean) => void;
  lockVault: (forgetDevice?: boolean) => void;
  forgetThisDevice: () => void;
  setSecurityLevel: (level: SecurityLevel) => void;
  bypassMfa: () => void; // For when switching to basic security
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
const SECURITY_LEVEL_KEY = 'vault_security_level';

export const MfaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTrustedDevice, setIsTrustedDevice] = useState(false);
  const [trustedUntil, setTrustedUntil] = useState<Date | null>(null);
  const [securityLevel, setSecurityLevelState] = useState<SecurityLevel>('basic');

  // Load security level preference from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SECURITY_LEVEL_KEY);
      if (stored === 'enhanced' || stored === 'basic') {
        setSecurityLevelState(stored);
      } else {
        // Default to basic for new users
        setSecurityLevelState('basic');
      }
    } catch (e) {
      console.warn('[MFA] Error loading security level:', e);
      setSecurityLevelState('basic');
    }
  }, []);

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

  // FIXED: Auto-unlock when security level is 'basic'
  useEffect(() => {
    if (securityLevel === 'basic' && session?.user?.id) {
      console.log('[MFA] Basic security - auto-unlocking vault');
      setIsUnlocked(true);
    }
  }, [securityLevel, session?.user?.id]);

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
    // Don't lock if security level is basic
    if (securityLevel === 'basic') {
      console.log('[MFA] Cannot lock vault in basic security mode');
      return;
    }

    console.log('[MFA] Locking vault, forget device:', forgetDevice);
    setIsUnlocked(false);

    if (forgetDevice) {
      localStorage.removeItem(STORAGE_KEY);
      setIsTrustedDevice(false);
      setTrustedUntil(null);
      console.log('[MFA] Device trust removed');
    }
  }, [securityLevel]);

  // Forget this device (remove trust but don't lock if currently unlocked)
  const forgetThisDevice = useCallback(() => {
    console.log('[MFA] Forgetting this device');
    localStorage.removeItem(STORAGE_KEY);
    setIsTrustedDevice(false);
    setTrustedUntil(null);
  }, []);

  // Set security level preference
  const setSecurityLevel = useCallback((level: SecurityLevel) => {
    console.log('[MFA] Setting security level to:', level);
    setSecurityLevelState(level);
    
    try {
      localStorage.setItem(SECURITY_LEVEL_KEY, level);
    } catch (e) {
      console.warn('[MFA] Error saving security level:', e);
    }

    // If switching to basic, auto-unlock
    if (level === 'basic') {
      setIsUnlocked(true);
    }
  }, []);

  // Bypass MFA (for when switching to basic security)
  const bypassMfa = useCallback(() => {
    console.log('[MFA] Bypassing MFA - setting unlocked');
    setIsUnlocked(true);
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
        securityLevel,
        unlockVault,
        lockVault,
        forgetThisDevice,
        setSecurityLevel,
        bypassMfa,
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