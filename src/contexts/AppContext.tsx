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


interface CategoryColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
}

interface ListingDraft {
  title: string;
  description: string;
  suggestedPrice: number;
}

interface AppContextType {
  theme: Theme;
  themeMode: ThemeMode;
  setTheme: (theme: Theme) => void;
  setThemeMode: (mode: ThemeMode) => void;
  voiceRecognitionEnabled: boolean;
  toggleVoiceRecognition: () => void;
  listItAndWalkMode: boolean;
  toggleListItAndWalkMode: () => void;
  lastAnalysisResult: AnalysisResult | null;
  setLastAnalysisResult: (result: AnalysisResult | null) => void;
  isScanning: boolean;
  setIsScanning: (scanning: boolean) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (analyzing: boolean) => void;
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  listingDraft: ListingDraft | null;
  setListingDraft: (draft: ListingDraft | null) => void;
  isGeneratingListing: boolean;
  setIsGeneratingListing: (generating: boolean) => void;
  showListingModal: boolean;
  setShowListingModal: (show: boolean) => void;
  generateListingDraft: (itemName: string, estimatedValue: number) => Promise<void>;
}

const defaultAppContext: AppContextType = {
  theme: 'safari',
  themeMode: 'dark',
  setTheme: () => {},
  setThemeMode: () => {},
  voiceRecognitionEnabled: false,
  toggleVoiceRecognition: () => {},
  listItAndWalkMode: false,
  toggleListItAndWalkMode: () => {},
  lastAnalysisResult: null,
  setLastAnalysisResult: () => {},
  isScanning: false,
  setIsScanning: () => {},
  isAnalyzing: false,
  setIsAnalyzing: () => {},
  selectedCategory: null,
  setSelectedCategory: () => {},
  listingDraft: null,
  setListingDraft: () => {},
  isGeneratingListing: false,
  setIsGeneratingListing: () => {},
  showListingModal: false,
  setShowListingModal: () => {},
  generateListingDraft: async () => {},
};

const AppContext = createContext<AppContextType>(defaultAppContext);

export const useAppContext = () => useContext(AppContext);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>('safari');
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [voiceRecognitionEnabled, setVoiceRecognitionEnabled] = useState(false);
  const [listItAndWalkMode, setListItAndWalkMode] = useState(false);
  const [lastAnalysisResult, setLastAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);
  const [isGeneratingListing, setIsGeneratingListing] = useState(false);
  const [showListingModal, setShowListingModal] = useState(false);

  // Apply theme mode to document root for proper light/dark mode switching
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(themeMode);
  }, [themeMode]);

  const handleSetThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
  };
  const toggleVoiceRecognition = () => {
    setVoiceRecognitionEnabled(prev => {
      const newValue = !prev;
      toast({ 
        title: newValue ? "Voice Recognition Enabled" : "Voice Recognition Disabled",
        description: newValue ? "Listening for commands..." : ""
      });
      return newValue;
    });
  };

  const toggleListItAndWalkMode = () => {
    setListItAndWalkMode(prev => {
      const newValue = !prev;
      toast({ 
        title: newValue ? "List It & Walk Mode Enabled" : "List It & Walk Mode Disabled",
        description: newValue ? "Auto-listing will trigger after successful analysis" : ""
      });
      return newValue;
    });
  };

  const generateListingDraft = async (itemName: string, estimatedValue: number) => {
    setIsGeneratingListing(true);
    setShowListingModal(true);
    
    try {
      // Simulate API call to Orion AI copywriter
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Generate mock listing data
      const mockDraft: ListingDraft = {
        title: `${itemName} - Excellent Condition - Fast Shipping`,
        description: `This ${itemName} is in excellent condition and ready for a new home! 

Perfect for collectors or anyone looking for quality items. Item has been carefully inspected and shows minimal signs of wear.

Features:
• Authentic and genuine
• Well-maintained condition
• Fast and secure shipping
• Satisfaction guaranteed

Don't miss out on this great find! Buy with confidence from a trusted seller.`,
        suggestedPrice: Math.round(estimatedValue * 1.2 * 100) / 100 // 20% markup
      };
      
      setListingDraft(mockDraft);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate listing draft. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingListing(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        theme,
        themeMode,
        setTheme,
        setThemeMode: handleSetThemeMode,
        voiceRecognitionEnabled,
        toggleVoiceRecognition,
        listItAndWalkMode,
        toggleListItAndWalkMode,
        lastAnalysisResult,
        setLastAnalysisResult,
        isScanning,
        setIsScanning,
        isAnalyzing,
        setIsAnalyzing,
        selectedCategory,
        setSelectedCategory,
        listingDraft,
        setListingDraft,
        isGeneratingListing,
        setIsGeneratingListing,
        showListingModal,
        setShowListingModal,
        generateListingDraft,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};