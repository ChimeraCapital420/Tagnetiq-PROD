// FILE: src/hooks/useFeatureFlags.ts (CREATE THIS NEW FILE)

import { useState } from 'react';

export interface FeatureFlags {
  isAttomApiEnabled: boolean;
  isMultiImageAnalysisEnabled: boolean;
  isSeasonalBrandingActive: boolean;
  isInvestorSuitePublic: boolean;
}

const initialFlags: FeatureFlags = {
  isAttomApiEnabled: true,
  isMultiImageAnalysisEnabled: false,
  isSeasonalBrandingActive: false,
  isInvestorSuitePublic: false,
};

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlags>(initialFlags);

  const setFlag = (flagName: keyof FeatureFlags, value: boolean) => {
    setFlags(prevFlags => ({
      ...prevFlags,
      [flagName]: value,
    }));
  };

  return { flags, setFlag };
};