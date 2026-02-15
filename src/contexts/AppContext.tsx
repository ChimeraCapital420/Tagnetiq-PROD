// FILE: src/contexts/AppContext.tsx
// STATUS: Forged by Hephaestus v2.3 - Oracle Thinking Experience + Project Chronos
//
// v2.3 CHANGES:
//   - Added scanProgress state (real-time SSE progress from analyze-stream)
//   - Added oracleEngagement preference (ambient | guided | conversational)
//   - Both consumed by OracleThinkingOverlay during analysis wait

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext.js';
import { ArenaWelcomeAlert } from '@/components/arena/ArenaWelcomeAlert';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Theme = 'executive' | 'matrix' | 'safari' | 'darkKnight' | 'cyberpunk' | 'ocean' | 'forest' | 'sunset';
type ThemeMode = 'light' | 'dark';
type SeasonalMode = 'winter' | 'spring' | 'summer' | 'fall' | 'off';

// --- HEPHAESTUS FORGE: v2.2 DATA STRUCTURES ---
export interface DataSource {
  name: string;
  url: string;
  reason: string;
  api_available: boolean;
  affiliate_link_template?: string;
}

export interface AnalysisResult {
  id: string;
  decision: 'BUY' | 'PASS';
  itemName: string;
  estimatedValue: string;
  confidence: 'high' | 'medium' | 'low';
  summary_reasoning: string;
  valuation_factors: string[];
  analysisCount?: number;
  consensusRatio?: string;
  code?: string;
  imageUrls?: string[];
  category?: string;
  resale_toolkit?: {
    sales_copy: string;
    recommended_marketplaces: DataSource[];
  };
  hydraConsensus?: any;
  authorityData?: any;
}

export interface OracleResponseType {
  text: string;
  timestamp: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

// --- PROJECT CHRONOS: DATA STRUCTURES ---
export interface AnalysisHistoryItem {
  id: string;
  user_id: string;
  analysis_result: AnalysisResult;
  created_at: string;
  item_name: string;
  estimated_value: number;
  thumbnail_url: string | null;
  category: string;
  confidence: string;
  decision: string;
  consensus_data: any;
  authority_data: any;
}

export interface HistoryFilter {
  category?: string;
  timeRange?: 'today' | 'week' | 'month' | 'all';
  decision?: 'BUY' | 'PASS' | 'all';
}

// --- ORACLE THINKING: SCAN PROGRESS ---
export type OracleEngagement = 'ambient' | 'guided' | 'conversational';

export interface ScanProgressModel {
  name: string;
  icon: string;
  color: string;
  status: 'waiting' | 'thinking' | 'complete' | 'error';
  estimate?: number;
}

export interface ScanProgress {
  stage: 'preparing' | 'identifying' | 'ai_consensus' | 'market_data' | 'finalizing' | 'complete' | 'error';
  message: string;
  aiModels: ScanProgressModel[];
  modelsComplete: number;
  modelsTotal: number;
  currentEstimate: number;
  confidence: number;
  category: string | null;
  marketApis: string[];
  error?: string;
}
// --- END ORACLE THINKING ---

interface AppContextType {
  // Theme state
  theme: Theme;
  themeMode: ThemeMode;
  seasonalMode: SeasonalMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSeasonalMode: (mode: SeasonalMode) => void;

  // Analysis state
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isScannerOpen: boolean;
  setIsScannerOpen: (isOpen: boolean) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;

  // UI state
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  isArenaWelcomeOpen: boolean;
  setIsArenaWelcomeOpen: (isOpen: boolean) => void;
  searchArenaQuery: string;
  setSearchArenaQuery: (query: string) => void;
  startScanWithCategory: (categoryId: string, subcategoryId: string | null) => void;
  showArenaWelcome: (callback?: () => void) => void;

  // Oracle state
  oracleResponse: OracleResponseType | null;
  setOracleResponse: (response: string) => void;
  conversationHistory: ConversationTurn[];
  addConversationTurn: (turn: ConversationTurn) => void;

  // --- ORACLE THINKING: SCAN PROGRESS ---
  scanProgress: ScanProgress | null;
  setScanProgress: (progress: ScanProgress | null) => void;
  oracleEngagement: OracleEngagement;
  setOracleEngagement: (mode: OracleEngagement) => void;
  // --- END ORACLE THINKING ---

  // --- PROJECT CHRONOS ---
  analysisHistory: AnalysisHistoryItem[];
  setAnalysisHistory: (history: AnalysisHistoryItem[]) => void;
  currentAnalysisIndex: number | null;
  setCurrentAnalysisIndex: (index: number | null) => void;
  isLoadingHistory: boolean;
  historyFilter: HistoryFilter;
  setHistoryFilter: (filter: HistoryFilter) => void;
  totalHistoryCount: number;
  hasMoreHistory: boolean;
  addAnalysisToHistory: (result: AnalysisResult) => Promise<void>;
  loadAnalysisHistory: (append?: boolean) => Promise<void>;
  deleteFromHistory: (id: string) => Promise<void>;
  navigateHistory: (direction: 'prev' | 'next') => void;
  viewHistoryItem: (index: number) => void;
  returnToLiveAnalysis: () => void;
  // --- END CHRONOS ---
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

  // --- ORACLE THINKING DEFAULTS ---
  scanProgress: null,
  setScanProgress: () => {},
  oracleEngagement: 'guided',
  setOracleEngagement: () => {},
  // --- END ORACLE THINKING ---

  // --- PROJECT CHRONOS DEFAULTS ---
  analysisHistory: [],
  setAnalysisHistory: () => {},
  currentAnalysisIndex: null,
  setCurrentAnalysisIndex: () => {},
  isLoadingHistory: false,
  historyFilter: {},
  setHistoryFilter: () => {},
  totalHistoryCount: 0,
  hasMoreHistory: false,
  addAnalysisToHistory: async () => {},
  loadAnalysisHistory: async () => {},
  deleteFromHistory: async () => {},
  navigateHistory: () => {},
  viewHistoryItem: () => {},
  returnToLiveAnalysis: () => {},
  // --- END CHRONOS ---
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
  // Theme state
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tagnetiq-theme') as Theme) || 'darkKnight');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('tagnetiq-theme-mode') as ThemeMode) || 'dark');
  const [seasonalMode, setSeasonalModeState] = useState<SeasonalMode>(() => (localStorage.getItem('tagnetiq-seasonal-mode') as SeasonalMode) || 'off');

  // Analysis state
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // UI state
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isArenaWelcomeOpen, setIsArenaWelcomeOpen] = useState(false);
  const [searchArenaQuery, setSearchArenaQuery] = useState('');
  const [oracleResponse, _setOracleResponse] = useState<OracleResponseType | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationTurn[]>([]);
  const [postWelcomeCallback, setPostWelcomeCallback] = useState<(() => void) | null>(null);

  // --- ORACLE THINKING STATE ---
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [oracleEngagement, setOracleEngagementState] = useState<OracleEngagement>(() =>
    (localStorage.getItem('tagnetiq-oracle-engagement') as OracleEngagement) || 'guided'
  );
  // --- END ORACLE THINKING ---

  // --- PROJECT CHRONOS STATE ---
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisHistoryItem[]>([]);
  const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState<number | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>({});
  const [totalHistoryCount, setTotalHistoryCount] = useState(0);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyOffset, setHistoryOffset] = useState(0);
  const [liveAnalysisResult, setLiveAnalysisResult] = useState<AnalysisResult | null>(null);
  // --- END CHRONOS ---

  const { profile, setProfile } = useAuth();
  const { data: session } = supabase.auth.getSession();

  // --- ORACLE THINKING: Persist engagement preference ---
  const setOracleEngagement = (mode: OracleEngagement) => {
    setOracleEngagementState(mode);
    localStorage.setItem('tagnetiq-oracle-engagement', mode);
  };

  // Clear scanProgress when analysis ends
  useEffect(() => {
    if (!isAnalyzing) {
      // Small delay so the overlay can show "complete" state briefly
      const timer = setTimeout(() => setScanProgress(null), 600);
      return () => clearTimeout(timer);
    }
  }, [isAnalyzing]);
  // --- END ORACLE THINKING ---

  // --- PROJECT CHRONOS: ACTIONS ---
  const addAnalysisToHistory = async (result: AnalysisResult) => {
    if (!session) return;

    try {
      const response = await fetch('/api/analysis/history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ analysis_result: result })
      });

      if (!response.ok) throw new Error('Failed to save analysis.');

      const newHistoryItem: AnalysisHistoryItem = await response.json();

      setAnalysisHistory(prev => [newHistoryItem, ...prev]);
      setTotalHistoryCount(prev => prev + 1);
      setLiveAnalysisResult(result);

      toast.success("Analysis saved to history", {
        description: "You can review it anytime from your history"
      });
    } catch (error) {
      console.error("Failed to save analysis:", error);
      toast.error("Could not save analysis to history");
    }
  };

  const loadAnalysisHistory = async (append = false) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    setIsLoadingHistory(true);

    try {
      const params = new URLSearchParams({
        limit: '10',
        offset: append ? historyOffset.toString() : '0',
        ...(historyFilter.category && { category: historyFilter.category })
      });

      const response = await fetch(`/api/analysis/history?${params}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to load history');

      const data = await response.json();

      if (append) {
        setAnalysisHistory(prev => [...prev, ...data.items]);
        setHistoryOffset(prev => prev + data.items.length);
      } else {
        setAnalysisHistory(data.items);
        setHistoryOffset(data.items.length);
      }

      setTotalHistoryCount(data.total || 0);
      setHasMoreHistory(data.hasMore || false);
    } catch (error) {
      console.error("Failed to load history:", error);
      toast.error("Could not load analysis history");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const deleteFromHistory = async (id: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) return;

    try {
      const response = await fetch(`/api/analysis/history?id=${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });

      if (!response.ok) throw new Error('Failed to delete');

      setAnalysisHistory(prev => prev.filter(item => item.id !== id));
      setTotalHistoryCount(prev => Math.max(0, prev - 1));

      const deletedIndex = analysisHistory.findIndex(item => item.id === id);
      if (currentAnalysisIndex === deletedIndex) {
        returnToLiveAnalysis();
      }

      toast.success("Removed from history");
    } catch (error) {
      toast.error("Could not delete from history");
    }
  };

  const navigateHistory = (direction: 'prev' | 'next') => {
    if (analysisHistory.length === 0) return;

    let newIndex: number;

    if (currentAnalysisIndex === null) {
      newIndex = direction === 'prev' ? 0 : -1;
    } else {
      newIndex = direction === 'prev'
        ? currentAnalysisIndex - 1
        : currentAnalysisIndex + 1;
    }

    if (newIndex >= 0 && newIndex < analysisHistory.length) {
      setCurrentAnalysisIndex(newIndex);
      setLastAnalysisResult(analysisHistory[newIndex].analysis_result);
    } else if (newIndex === -1 || newIndex === analysisHistory.length) {
      returnToLiveAnalysis();
    }
  };

  const viewHistoryItem = (index: number) => {
    if (index >= 0 && index < analysisHistory.length) {
      setCurrentAnalysisIndex(index);
      setLastAnalysisResult(analysisHistory[index].analysis_result);
    }
  };

  const returnToLiveAnalysis = () => {
    setCurrentAnalysisIndex(null);
    setLastAnalysisResult(liveAnalysisResult);
  };
  // --- END CHRONOS ACTIONS ---

  // Load initial history on mount
  useEffect(() => {
    if (session) {
      loadAnalysisHistory();
    }
  }, [session, historyFilter]);

  // When a new analysis is completed, add it to history
  useEffect(() => {
    if (lastAnalysisResult && currentAnalysisIndex === null && lastAnalysisResult !== liveAnalysisResult) {
      addAnalysisToHistory(lastAnalysisResult);
    }
  }, [lastAnalysisResult]);

  // Arena welcome
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

  // Theme mode sync
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
    localStorage.setItem('tagnetiq-theme-mode', themeMode);
  }, [themeMode]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem('tagnetiq-theme', newTheme);
  };

  const setSeasonalMode = (mode: SeasonalMode) => {
    setSeasonalModeState(mode);
    localStorage.setItem('tagnetiq-seasonal-mode', mode);
  };

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
      if (newHistory.length > 10) {
        return newHistory.slice(-10);
      }
      return newHistory;
    });
  };

  const value = {
    // Theme
    theme, themeMode, seasonalMode,
    setTheme: handleSetTheme,
    setThemeMode, setSeasonalMode,

    // Analysis
    lastAnalysisResult, setLastAnalysisResult,
    isScannerOpen, setIsScannerOpen,
    isAnalyzing, setIsAnalyzing,
    selectedCategory, setSelectedCategory,

    // UI
    isFeedbackModalOpen, setIsFeedbackModalOpen,
    isArenaWelcomeOpen, setIsArenaWelcomeOpen,
    searchArenaQuery, setSearchArenaQuery,
    startScanWithCategory,
    showArenaWelcome,
    oracleResponse,
    setOracleResponse,
    conversationHistory,
    addConversationTurn,

    // --- ORACLE THINKING ---
    scanProgress,
    setScanProgress,
    oracleEngagement,
    setOracleEngagement,
    // --- END ORACLE THINKING ---

    // --- PROJECT CHRONOS ---
    analysisHistory,
    setAnalysisHistory,
    currentAnalysisIndex,
    setCurrentAnalysisIndex,
    isLoadingHistory,
    historyFilter,
    setHistoryFilter,
    totalHistoryCount,
    hasMoreHistory,
    addAnalysisToHistory,
    loadAnalysisHistory,
    deleteFromHistory,
    navigateHistory,
    viewHistoryItem,
    returnToLiveAnalysis,
    // --- END CHRONOS ---
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <ArenaWelcomeAlert isOpen={isArenaWelcomeOpen} onDismiss={handleDismissWelcome} />
    </AppContext.Provider>
  );
};