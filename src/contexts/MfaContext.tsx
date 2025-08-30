import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MfaContextType {
  isUnlocked: boolean;
  unlockVault: () => void;
  lockVault: () => void;
}

const MfaContext = createContext<MfaContextType | undefined>(undefined);

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

export const MfaProvider = ({ children }: MfaProviderProps) => {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const unlockVault = () => {
    setIsUnlocked(true);
  };

  const lockVault = () => {
    setIsUnlocked(false);
  };

  return (
    <MfaContext.Provider value={{ isUnlocked, unlockVault, lockVault }}>
      {children}
    </MfaContext.Provider>
  );
};