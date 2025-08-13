import React from 'react';
import NewMarketingNavigation from './NewMarketingNavigation';
import NewHeroSection from './NewHeroSection';
import FeaturesSection from './FeaturesSection';
import FinalCTASection from './FinalCTASection';

const NewMarketingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black">
      <NewMarketingNavigation />
      <NewHeroSection />
      <FeaturesSection />
      <FinalCTASection />
    </div>
  );
};

export default NewMarketingPage;