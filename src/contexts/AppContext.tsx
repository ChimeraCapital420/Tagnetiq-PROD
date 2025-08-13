// FILE: src/contexts/AppContext.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';

type Theme = 'executive' | 'matrix' | 'safari' | 'darkKnight' | 'cyberpunk' | 'ocean' | 'forest' | 'sunset';
type ThemeMode = 'light' | 'dark';

interface AnalysisResult {
  decision: string;
  item: string;
  marketValue: string;
  code: string;
}

interface AppContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  isWatermarkVisible: boolean;
  toggleWatermark: () => void;
}

const defaultAppContext: AppContextType = {
  theme: 'darkKnight',
  themeMode: 'dark',
  setTheme: () => {},
  setThemeMode: () => {},
  lastAnalysisResult: null,
  setLastAnalysisResult: () => {},
  isScanning: false,
  setIsScanning: () => {},
  isAnalyzing: false,
  setIsAnalyzing: () => {},
  selectedCategory: null,
  setSelectedCategory: () => {},
  isWatermarkVisible: true,
  toggleWatermark: () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);
export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('darkKnight');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isWatermarkVisible, setWatermarkVisible] = useState(true);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
  }, [themeMode]);

  const toggleWatermark = () => {
    setWatermarkVisible(prev => !prev);
  };

  const value = {
    theme,
    themeMode,
    setTheme,
    setThemeMode,
    lastAnalysisResult,
    setLastAnalysisResult,
    isScanning,
    setIsScanning,
    isAnalyzing,
    setIsAnalyzing,
    selectedCategory,
    setSelectedCategory,
    isWatermarkVisible,
    toggleWatermark,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};