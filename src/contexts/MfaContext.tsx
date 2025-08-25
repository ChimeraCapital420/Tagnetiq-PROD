// FILE: src/contexts/MfaContext.tsx

import React, { createContext, useContext, useState } from 'react';

interface MfaContextType {
  isUnlocked: boolean;
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
  const [isUnlocked, setIsUnlocked] = useState(false);

  const unlockVault = () => {
    sessionStorage.setItem('vault_unlocked', 'true');
    setIsUnlocked(true);
  };

  const lockVault = () => {
    sessionStorage.removeItem('vault_unlocked');
    setIsUnlocked(false);
  };

  const value = {
    isUnlocked,
    unlockVault,
    lockVault,
  };

  return <MfaContext.Provider value={value}>{children}</MfaContext.Provider>;
};