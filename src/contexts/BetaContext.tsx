// FILE: src/contexts/BetaContext.tsx (CREATE THIS NEW FILE)
import React, { createContext, useContext, useState, useEffect } from 'react';

export interface FeatureFlags {
  isAttomApiEnabled: boolean;
  isMultiImageAnalysisEnabled: boolean;
  isSeasonalBrandingActive: boolean;
  isInvestorSuitePublic: boolean;
  isWatermarkVisible: boolean;
}

interface BetaContextType {
  flags: FeatureFlags;
  setFlag: (flagName: keyof FeatureFlags, value: boolean) => void;
  loading: boolean;
}

const defaultFlags: FeatureFlags = {
  isAttomApiEnabled: true,
  isMultiImageAnalysisEnabled: false,
  isSeasonalBrandingActive: false,
  isInvestorSuitePublic: false,
  isWatermarkVisible: true,
};

const BetaContext = createContext<BetaContextType>({
  flags: defaultFlags,
  setFlag: () => {},
  loading: true,
});

export const useBeta = () => useContext(BetaContext);

export const BetaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [flags, setFlags] = useState<FeatureFlags>(defaultFlags);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedFlags = localStorage.getItem('tagnetiq-beta-flags');
      if (storedFlags) {
        setFlags(JSON.parse(storedFlags));
      }
    } catch (error) {
      console.error("Failed to parse beta flags from localStorage", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const setFlag = (flagName: keyof FeatureFlags, value: boolean) => {
    const newFlags = { ...flags, [flagName]: value };
    setFlags(newFlags);
    localStorage.setItem('tagnetiq-beta-flags', JSON.stringify(newFlags));
  };

  return (
    <BetaContext.Provider value={{ flags, setFlag, loading }}>
      {children}
    </BetaContext.Provider>
  );
};