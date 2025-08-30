// FILE: src/contexts/AppContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';

interface AppContextType {
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  isArenaWelcomeOpen: boolean;
  setIsArenaWelcomeOpen: (isOpen: boolean) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (isOpen: boolean) => void;
  showArenaWelcome: (callback?: () => void) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isArenaWelcomeOpen, setIsArenaWelcomeOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [postWelcomeCallback, setPostWelcomeCallback] = useState<(() => void) | null>(null);

  const { profile } = useAuth();
  const { flags } = useFeatureFlags();
  
  // HEPHAESTUS NOTE: This is the core logic modification.
  // It now accepts an optional 'callback' function.
  // This function will be executed AFTER the welcome alert is dismissed.
  const showArenaWelcome = (callback?: () => void) => {
    if (profile && !profile.has_seen_arena_intro && flags.isArenaLive) {
      if (callback) {
        setPostWelcomeCallback(() => callback);
      }
      setIsArenaWelcomeOpen(true);
    } else if (callback) {
      // If the user has already seen the intro, execute the callback immediately.
      callback();
    }
  };
  
  // Expose a new function to be called from the alert itself
  const handleWelcomeDismiss = (dontShowAgain: boolean) => {
    setIsArenaWelcomeOpen(false);
    if (postWelcomeCallback) {
        postWelcomeCallback();
        setPostWelcomeCallback(null);
    }
  }


  return (
    <AppContext.Provider value={{ 
        isFeedbackModalOpen, 
        setIsFeedbackModalOpen,
        isArenaWelcomeOpen,
        setIsArenaWelcomeOpen,
        isScannerOpen,
        setIsScannerOpen,
        showArenaWelcome
    }}>
      {children}
       {/* Pass the new handler to the component */}
       <ArenaWelcomeAlert isOpen={isArenaWelcomeOpen} onDismiss={handleWelcomeDismiss} />
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// We need to export ArenaWelcomeAlert from here now since it's used inside the provider
// And remove it from App.tsx to avoid duplication
export { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';