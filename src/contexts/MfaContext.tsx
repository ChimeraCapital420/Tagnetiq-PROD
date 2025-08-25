// FILE: src/contexts/MfaContext.tsx

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MfaContextType {
  isUnlocked: boolean;
  unlockVault: () => void;
  lockVault: () => void;
}

const MfaContext = createContext<MfaContextType | undefined>(undefined);

export const MfaProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const unlockVault = () => {
    setIsUnlocked(true);
  };

  const lockVault = () => {
    setIsUnlocked(false);
  };
  
  const value = {
    isUnlocked,
    unlockVault,
    lockVault,
  };

  return (
    <MfaContext.Provider value={value}>
      {children}
    </MfaContext.Provider>
  );
};

export const useMfa = (): MfaContextType => {
  const context = useContext(MfaContext);
  if (!context) {
    throw new Error('useMfa must be used within an MfaProvider');
  }
  return context;
};