import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'executive' | 'matrix' | 'safari' | 'darkKnight' | 'cyberpunk' | 'ocean' | 'forest' | 'sunset';
type ThemeMode = 'light' | 'dark';
type SeasonalMode = 'winter' | 'spring' | 'summer' | 'fall' | 'off';

export interface AnalysisResult {
  id: string; decision: 'BUY' | 'PASS'; itemName: string; estimatedValue: string;
  confidence: 'high' | 'medium' | 'low'; reasoning: string;
  analysisCount?: number; consensusRatio?: string; code?: string; imageUrls?: string[];
}

interface AppContextType {
  theme: Theme;
  themeMode: ThemeMode;
  seasonalMode: SeasonalMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setSeasonalMode: (mode: SeasonalMode) => void;
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  isFeedbackModalOpen: boolean;
  setIsFeedbackModalOpen: (isOpen: boolean) => void;
  isArenaWelcomeOpen: boolean; 
  setIsArenaWelcomeOpen: (isOpen: boolean) => void;
  isScannerOpen: boolean; 
  setIsScannerOpen: (isOpen: boolean) => void; 
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
  isScanning: false,
  setIsScanning: () => {},
  isAnalyzing: false,
  setIsAnalyzing: () => {},
  selectedCategory: null,
  setSelectedCategory: () => {},
  isFeedbackModalOpen: false,
  setIsFeedbackModalOpen: () => {},
  isArenaWelcomeOpen: false,
  setIsArenaWelcomeOpen: () => {},
  isScannerOpen: false, 
  setIsScannerOpen: () => {}, 
};

const AppContext = createContext<AppContextType>(defaultAppContext);
export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tagnetiq-theme') as Theme) || 'darkKnight');
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => (localStorage.getItem('tagnetiq-theme-mode') as ThemeMode) || 'dark');
  const [seasonalMode, setSeasonalModeState] = useState<SeasonalMode>(() => (localStorage.getItem('tagnetiq-seasonal-mode') as SeasonalMode) || 'off');
  
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);
  const [isArenaWelcomeOpen, setIsArenaWelcomeOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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

  const value = {
    theme, themeMode, seasonalMode,
    setTheme: handleSetTheme,
    setThemeMode, setSeasonalMode,
    lastAnalysisResult, setLastAnalysisResult,
    isScanning, setIsScanning,
    isAnalyzing, setIsAnalyzing,
    selectedCategory, setSelectedCategory,
    isFeedbackModalOpen, setIsFeedbackModalOpen,
    isArenaWelcomeOpen, setIsArenaWelcomeOpen,
    isScannerOpen, setIsScannerOpen,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};