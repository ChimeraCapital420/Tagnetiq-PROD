// FILE: src/contexts/AppContext.tsx
// STATUS: Forged by Hephaestus to support Hydra v2.1, Nexus, and Oracle symbiosis.

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Theme = 'executive' | 'matrix' | 'safari' | 'darkKnight' | 'cyberpunk' | 'ocean' | 'forest' | 'sunset';
type ThemeMode = 'light' | 'dark';
type SeasonalMode = 'winter' | 'spring' | 'summer' | 'fall' | 'off';

// --- HEPHAESTUS FORGE: v2.1 DATA STRUCTURE ---
// This defines the structure for marketplace data, ensuring type safety for the resale_toolkit.
export interface DataSource {
  name: string;
  url: string;
  reason: string;
  api_available: boolean;
  affiliate_link_template?: string;
}

// This is the upgraded data contract for Hydra Engine v2.1.
// It replaces the simple 'reasoning' string with a structured, actionable output for Nexus and Oracle.
export interface AnalysisResult {
  id: string;
  decision: 'BUY' | 'PASS';
  itemName: string;
  estimatedValue: string;
  confidence: 'high' | 'medium' | 'low';
  summary_reasoning: string;       // A brief, top-level summary.
  valuation_factors: string[];     // A detailed list of the top 5 value drivers.
  analysisCount?: number;
  consensusRatio?: string;
  code?: string;
  imageUrls?: string[];
  resale_toolkit?: {
    sales_copy: string;
    recommended_marketplaces: DataSource[];
  };
}

// Data structures for the Oracle conversational AI remain untouched.
export interface OracleResponseType {
    text: string;
    timestamp: number;
}

export interface ConversationTurn {
    role: 'user' | 'assistant';
    content: string;
}
// --- END FORGE ---


interface AppContextType {
  theme: Theme;
  themeMode: ThemeMode;
  seasonalMode: SeasonalMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSeasonalMode: (mode: SeasonalMode) => void;
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isScannerOpen: boolean; 
  setIsScannerOpen: (isOpen: boolean) => void; 
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  isArenaWelcomeOpen: boolean; 
  setIsArenaWelcomeOpen: (isOpen: boolean) => void;
  searchArenaQuery: string;
  setSearchArenaQuery: (query: string) => void;
  startScanWithCategory: (categoryId: string, subcategoryId: string | null) => void;
  showArenaWelcome: (callback?: () => void) => void;
  oracleResponse: OracleResponseType | null;
  setOracleResponse: (response: string) => void;
  conversationHistory: ConversationTurn[];
  addConversationTurn: (turn: ConversationTurn) => void;
}

const defaultAppContext: AppContextType = {
  theme: 'darkKnight',
  themeMode: 'dark',
  seasonalMode: 'off',
  setTheme: () => {},
  setThemeMode: () => {},
  setSeasonalMode: () => {},
  lastAnalysisResult: null,
  setLastAnalysisResult: () => {},
  isScannerOpen: false, 
  setIsScannerOpen: () => {}, 
  isAnalyzing: false,
  setIsAnalyzing: () => {}, 
  selectedCategory: null,
  setSelectedCategory: () => {},
  isFeedbackModalOpen: false,
  setIsFeedbackModalOpen: () => {},
  isArenaWelcomeOpen: false,
  setIsArenaWelcomeOpen: () => {},
  searchArenaQuery: '',
  setSearchArenaQuery: () => {},
  startScanWithCategory: () => {},
  showArenaWelcome: () => {},
  oracleResponse: null,
  setOracleResponse: () => {},
  conversationHistory: [],
  addConversationTurn: () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);
export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tagnetiq-theme') as Theme) || 'darkKnight');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('tagnetiq-theme-mode') as ThemeMode) || 'dark');
  const [seasonalMode, setSeasonalModeState] = useState<SeasonalMode>(() => (localStorage.getItem('tagnetiq-seasonal-mode') as SeasonalMode) || 'off');
  
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isArenaWelcomeOpen, setIsArenaWelcomeOpen] = useState(false);
  
  const [searchArenaQuery, setSearchArenaQuery] = useState('');
  
  const [oracleResponse, _setOracleResponse] = useState<OracleResponseType | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);

  const [postWelcomeCallback, setPostWelcomeCallback] = useState<(() => void) | null>(null);
  const { profile, setProfile } = useAuth();

  const showArenaWelcome = (callback?: () => void) => {
    if (profile && !profile.has_seen_arena_intro) {
      if (callback) {
        setPostWelcomeCallback(() => callback);
      }
      setIsArenaWelcomeOpen(true);
    } else if (callback) {
      callback();
    }
  };

  const handleDismissWelcome = async (dontShowAgain: boolean) => {
    setIsArenaWelcomeOpen(false);
    if (postWelcomeCallback) {
      postWelcomeCallback();
      setPostWelcomeCallback(null);
    }
    if (dontShowAgain && profile && !profile.has_seen_arena_intro) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Not authenticated");
            await fetch('/api/arena/mark-intro-seen', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            setProfile(p => p ? { ...p, has_seen_arena_intro: true } : null);
        } catch (error) {
            toast.error("Could not save preference", { description: (error as Error).message });
        }
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
    localStorage.setItem('tagnetiq-theme-mode', themeMode);
  }, [themeMode]);

  const handleSetTheme = (newTheme: Theme) => {
      setTheme(newTheme);
      localStorage.setItem('tagnetiq-theme', newTheme);
  }

  const setSeasonalMode = (mode: SeasonalMode) => {
      setSeasonalModeState(mode);
      localStorage.setItem('tagnetiq-seasonal-mode', mode);
  }
  
  const startScanWithCategory = (categoryId: string, subcategoryId: string | null) => {
    const categoryToSet = subcategoryId || categoryId;
    setSelectedCategory(categoryToSet);
    setIsScannerOpen(true);
  };

  const setOracleResponse = (text: string) => {
    _setOracleResponse({ text, timestamp: Date.now() });
  };

  const addConversationTurn = (turn: ConversationTurn) => {
    setConversationHistory(prev => {
        const newHistory = [...prev, turn];
        // Keep the history from getting too long (e.g., last 10 turns / 5 exchanges)
        if (newHistory.length > 10) {
            return newHistory.slice(-10);
        }
        return newHistory;
    });
  };

  const value = {
    theme, themeMode, seasonalMode,
    setTheme: handleSetTheme,
    setThemeMode, setSeasonalMode,
    lastAnalysisResult, setLastAnalysisResult,
    isScannerOpen, setIsScannerOpen,
    isAnalyzing, setIsAnalyzing,
    selectedCategory, setSelectedCategory,
    isFeedbackModalOpen, setIsFeedbackModalOpen,
    isArenaWelcomeOpen, setIsArenaWelcomeOpen,
    searchArenaQuery, setSearchArenaQuery,
    startScanWithCategory,
    showArenaWelcome,
    oracleResponse,
    setOracleResponse,
    conversationHistory,
    addConversationTurn,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <ArenaWelcomeAlert isOpen={isArenaWelcomeOpen} onDismiss={handleDismissWelcome} />
    </AppContext.Provider>
  );
};

