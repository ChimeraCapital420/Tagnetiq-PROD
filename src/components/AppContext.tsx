// FILE: src/contexts/AppContext.tsx

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useAuth } from './AuthContext.js';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';

// --- SURGICAL RE-INTEGRATION START ---
// Define a simplified DataSource type here to avoid invalid cross-directory imports.
export interface DataSource {
  name: string;
  url: string;
  reason: string;
  api_available: boolean;
  affiliate_link_template?: string;
}

// Re-integrate the AnalysisResult interface. This is the contract for Hydra's output.
export interface AnalysisResult {
  id: string;
  decision: 'BUY' | 'PASS';
  itemName: string;
  estimatedValue: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  analysisCount?: number;
  consensusRatio?: string;
  code?: string;
  imageUrls?: string[];
  resale_toolkit?: {
    sales_copy: string;
    recommended_marketplaces: DataSource[];
  };
}
// --- SURGICAL RE-INTEGRATION END ---

interface AppContextType {
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  isArenaWelcomeOpen: boolean;
  setIsArenaWelcomeOpen: (isOpen: boolean) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (isOpen: boolean) => void;
  showArenaWelcome: (callback?: () => void) => void;
  // --- SURGICAL RE-INTEGRATION START ---
  // Re-integrate the state properties required for analysis.
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  // --- SURGICAL RE-INTEGRATION END ---
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isArenaWelcomeOpen, setIsArenaWelcomeOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [postWelcomeCallback, setPostWelcomeCallback] = useState<(() => void) | null>(null);

  // --- SURGICAL RE-INTEGRATION START ---
  // Re-integrate the state variables required for analysis.
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // --- SURGICAL RE-INTEGRATION END ---

  const { profile } = useAuth();
  const { flags } = useFeatureFlags();

  const showArenaWelcome = (callback?: () => void) => {
    if (profile && !profile.has_seen_arena_intro && flags.isArenaLive) {
      if (callback) {
        setPostWelcomeCallback(() => callback);
      }
      setIsArenaWelcomeOpen(true);
    } else if (callback) {
      callback();
    }
  };

  const handleWelcomeDismiss = (dontShowAgain: boolean) => {
    setIsArenaWelcomeOpen(false);
    if (postWelcomeCallback) {
      postWelcomeCallback();
      setPostWelcomeCallback(null);
    }
    // Note: The logic to update the profile (`has_seen_arena_intro`) should be handled
    // within the ArenaWelcomeAlert component itself to keep concerns separate.
  };

  return (
    <AppContext.Provider value={{
      isFeedbackModalOpen,
      setIsFeedbackModalOpen,
      isArenaWelcomeOpen,
      setIsArenaWelcomeOpen,
      isScannerOpen,
      setIsScannerOpen,
      showArenaWelcome,
      // --- SURGICAL RE-INTEGRATION START ---
      // Expose the re-integrated state and setters through the context provider.
      lastAnalysisResult,
      setLastAnalysisResult,
      isAnalyzing,
      setIsAnalyzing,
      selectedCategory,
      setSelectedCategory
      // --- SURGICAL RE-INTEGRATION END ---
    }}>
      {children}
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