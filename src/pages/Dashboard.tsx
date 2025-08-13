// FILE: src/pages/Dashboard.tsx (REPLACE THE ENTIRE FILE WITH THIS)

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { toast } from '@/components/ui/use-toast';
import { Car, Blocks, Zap, Palette, Book, Star, ShoppingCart, Trophy, Home, XCircle } from 'lucide-react';
import AnalysisResult from '@/components/AnalysisResult';
import SubCategoryModal from '@/components/SubCategoryModal';
import DualScanner from '@/components/DualScanner';

const categories = [
  { id: 'real-estate', name: 'Real Estate', icon: Home },
  { id: 'vehicles', name: 'Vehicles', icon: Car },
  { id: 'lego', name: 'LEGO Sets', icon: Blocks },
  { id: 'starwars', name: 'Star Wars', icon: Zap },
  { id: 'art', name: 'Art & Antiques', icon: Palette },
  { id: 'books', name: 'Vintage Books', icon: Book },
  { id: 'collectibles', name: 'Rare Collectibles', icon: Star },
  { id: 'amazon', name: 'Amazon Arbitrage', icon: ShoppingCart },
  { id: 'sports', name: 'Sports Memorabilia', icon: Trophy }
];

const Dashboard: React.FC = () => {
  const { 
    selectedCategory, 
    setSelectedCategory, 
    theme, 
    themeMode, 
    lastAnalysisResult,
    isScanning,
    setIsScanning
  } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategoryData, setSelectedCategoryData] = useState<{id: string, name: string} | null>(null);

  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    setSelectedCategory(categoryId);
    setSelectedCategoryData({ id: categoryId, name: categoryName });
    setModalOpen(true);
  };

  const handleStartScanning = () => {
    setIsScanning(true);
  };

  return (
    <>
      <div className="relative z-10 py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div 
            className="backdrop-blur-sm border rounded-xl"
            style={{
              backgroundColor: `${themeConfig.colors.surface}90`,
              borderColor: `${themeConfig.colors.border}50`,
            }}
          >
            <div className="p-6 text-center">
              <h2 className="text-2xl font-bold" style={{color: themeConfig.colors.text, fontFamily: themeConfig.fonts.heading}}>
                Trainable AI Categories
              </h2>
              {selectedCategory && (
                <Button variant="ghost" size="sm" className="mt-2 text-xs" style={{color: themeConfig.colors.textSecondary}} onClick={() => setSelectedCategory(null)}>
                    <XCircle className="w-4 h-4 mr-2"/>
                    Switch to General Scanning
                </Button>
              )}
            </div>
            <div className="p-6">
              <div className="grid grid-cols-3 md:grid-cols-3 gap-4 mb-8">
                  {categories.map((category) => {
                    const isSelected = selectedCategory?.startsWith(category.id);
                    const categoryColors = getCategoryColors(category.id);
                    const IconComponent = category.icon;
                    
                    return (
                      <Button
                        key={category.id}
                        variant={isSelected ? "default" : "outline"}
                        className="h-24 flex flex-col items-center justify-center space-y-2 transition-all duration-200"
                        style={{
                          backgroundColor: isSelected ? categoryColors.primary : 'transparent',
                          borderColor: isSelected ? categoryColors.primary : `${themeConfig.colors.border}50`,
                          color: isSelected ? 'white' : themeConfig.colors.text
                        }}
                        onClick={() => handleCategorySelect(category.id, category.name)}
                      >
                        <IconComponent className="w-6 h-6" />
                        <span className="text-xs font-medium text-center">
                          {category.name}
                        </span>
                      </Button>
                    );
                  })}
              </div>
              
              <div className="text-center">
                <Button
                  onClick={handleStartScanning}
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold px-8 py-3"
                >
                  Start Scanning
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-8 text-center" style={{color: themeConfig.colors.textSecondary}}>
            {lastAnalysisResult ? <AnalysisResult /> : "Analysis results will appear here"}
          </div>
        </div>
      </div>
      <DualScanner
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
      />
      
      {selectedCategoryData && (
        <SubCategoryModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          categoryId={selectedCategoryData.id}
          categoryName={selectedCategoryData.name}
        />
      )}
    </>
  );
};

export default Dashboard;