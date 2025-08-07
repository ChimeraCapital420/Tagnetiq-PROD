import React, { useState } from 'react';
import MarketingNavigation from './MarketingNavigation';
import AppNavigation from './AppNavigation';
import NewMarketingPage from './NewMarketingPage';
import Dashboard from './Dashboard';
import DualScanner from './DualScanner';
import ListingDraftModal from './ListingDraftModal';
import DeviceConnectionModal from './DeviceConnectionModal';
import CleanRoomModal from './CleanRoomModal';
import MatrixBackground from './MatrixBackground';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';

const AppLayout: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { 
    theme, 
    themeMode,
    showListingModal, 
    setShowListingModal, 
    listingDraft, 
    isGeneratingListing, 
    lastAnalysisResult 
    isScanning, 
    setIsScanning
  } = useAppContext();
  
  const { user } = useAuth();

  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [showCleanRoomModal, setShowCleanRoomModal] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<any>(null);

  const themeConfig = getThemeConfig(theme, themeMode);
  
  const getThemeStyles = () => {
    const baseStyle = {
      backgroundColor: 'transparent',
      color: themeConfig.colors.text,
      fontFamily: themeConfig.fonts.body
    };

    if (theme === 'safari') {
      return {
        ...baseStyle,
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23CD853F" fill-opacity="0.05"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        backgroundSize: '60px 60px'
      };
    }

    if (theme === 'executive') {
      return {
        ...baseStyle,
        boxShadow: 'inset 0 0 100px rgba(192, 192, 192, 0.05)'
      };
    }

    return baseStyle;
  };

  // If children are provided (from routing), render them regardless of auth status
  // This allows login/signup pages to render properly
  if (children) {
    return (
      <div className="min-h-screen relative" style={getThemeStyles()}>
        {theme === 'matrix' && themeMode === 'dark' && <MatrixBackground />}
        <div className="relative" style={{ zIndex: 2 }}>
          {children}
        </div>
      </div>
    );
  }

  // For logged-out users on the root route, show the marketing page
  if (!user) {
    return <NewMarketingPage />;
  }
  // For logged-in users, show the full app layout
  return (
    <div className="min-h-screen relative" style={getThemeStyles()}>
      {theme === 'matrix' && themeMode === 'dark' && <MatrixBackground />}
      
      <div className="relative" style={{ zIndex: 2 }}>
        <AppNavigation />
        <main className="pt-16">
          {children ? children : <Dashboard />}
        </main>
        <DualScanner 
  isOpen={isScanning} 
  onClose={() => setIsScanning(false)} 
/>
        
        <ListingDraftModal
          isOpen={showListingModal}
          onClose={() => setShowListingModal(false)}
          itemName={lastAnalysisResult?.itemName || ''}
          estimatedValue={typeof lastAnalysisResult?.estimatedValue === 'number' 
            ? lastAnalysisResult.estimatedValue 
            : parseFloat(lastAnalysisResult?.estimatedValue?.toString().replace(/[^0-9.]/g, '') || '0')
          }
          listingDraft={listingDraft}
          isGenerating={isGeneratingListing}
        />
        
        <DeviceConnectionModal
          open={showDeviceModal}
          onOpenChange={setShowDeviceModal}
          onDeviceConnected={setConnectedDevice}
        />
        
        <CleanRoomModal
          open={showCleanRoomModal}
          onOpenChange={setShowCleanRoomModal}
          imageUrl={lastAnalysisResult ? 'https://d64gsuwffb70l.cloudfront.net/6888fea97902e5e5fd801df3_1754076744833_6f192829.png' : undefined}
        />
      </div>
    </div>
  );
};

export default AppLayout;