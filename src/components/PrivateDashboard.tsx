import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { useToast } from '@/hooks/use-toast';
import { Car, Blocks, Zap, Palette, Book, Star, ShoppingCart, Trophy } from 'lucide-react';
import AnalysisResult from './AnalysisResult';
import ContinuousScanner from './ContinuousScanner';
import SubCategoryModal from './SubCategoryModal';

const categories = [
  { id: 'vehicles', name: 'Vehicles', icon: Car },
  { id: 'lego', name: 'LEGO Sets', icon: Blocks },
  { id: 'starwars', name: 'Star Wars', icon: Zap },
  { id: 'art', name: 'Art & Antiques', icon: Palette },
  { id: 'books', name: 'Vintage Books', icon: Book },
  { id: 'collectibles', name: 'Rare Collectibles', icon: Star },
  { id: 'amazon', name: 'Amazon Arbitrage', icon: ShoppingCart },
  { id: 'sports', name: 'Sports Memorabilia', icon: Trophy }
];

const PrivateDashboard: React.FC = () => {
  const { 
    selectedCategory, 
    setSelectedCategory, 
    theme, 
    themeMode, 
    lastAnalysisResult,
    isScanning,
    setIsScanning
  } = useAppContext();
  const { toast } = useToast();
  const themeConfig = getThemeConfig(theme, themeMode);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategoryData, setSelectedCategoryData] = useState<{id: string, name: string} | null>(null);

  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    // Skip Amazon Arbitrage for now - no sub-categories defined
    if (categoryId === 'amazon') {
      setSelectedCategory(categoryId);
      toast({
        title: "AI Category Selected",
        description: `AI primed for ${categoryName} analysis.`,
        duration: 3000,
      });
      return;
    }
    
    setSelectedCategory(categoryId);
    setSelectedCategoryData({ id: categoryId, name: categoryName });
    setModalOpen(true);
  };

  const handleStartScanning = () => {
    setIsScanning(true);
  };

  const getSectionBackground = () => {
    if (theme === 'matrix' && themeMode === 'dark') {
      return 'linear-gradient(135deg, rgba(0, 255, 65, 0.05) 0%, rgba(0, 0, 0, 0.8) 100%)';
    }
    if (theme === 'executive') {
      return themeMode === 'dark' 
        ? 'linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(42, 42, 42, 0.7) 100%)'
        : 'linear-gradient(135deg, rgba(248, 248, 248, 0.9) 0%, rgba(240, 240, 240, 0.7) 100%)';
    }
    return `linear-gradient(135deg, ${themeConfig.colors.surface}90 0%, ${themeConfig.colors.background}80 100%)`;
  };

  return (
    <>
      <div className="pt-20 min-h-screen" style={{ background: getSectionBackground() }}>
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Control Panel */}
            <div className="lg:col-span-2 space-y-6">
              <Card 
                className="backdrop-blur-sm border"
                style={{
                  backgroundColor: `${themeConfig.colors.surface}90`,
                  borderColor: `${themeConfig.colors.border}50`,
                }}
              >
                <CardHeader>
                  <CardTitle 
                    className="text-2xl"
                    style={{ 
                      color: themeConfig.colors.text,
                      fontFamily: themeConfig.fonts.heading
                    }}
                  >
                    Trainable AI Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                    {categories.map((category) => {
                      const isSelected = selectedCategory === category.id;
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
                          <span className="text-sm font-medium text-center">
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
                </CardContent>
              </Card>
            </div>

            {/* Analysis Result Display Area */}
            <div className="lg:col-span-1 space-y-6">
              {lastAnalysisResult ? (
                <AnalysisResult />
              ) : (
                <Card 
                  className="backdrop-blur-sm border h-64"
                  style={{
                    backgroundColor: `${themeConfig.colors.surface}90`,
                    borderColor: `${themeConfig.colors.border}50`,
                  }}
                >
                  <CardContent className="flex items-center justify-center h-full">
                    <p 
                      className="text-center"
                      style={{ color: themeConfig.colors.textSecondary }}
                    >
                      Analysis results will appear here
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
      <ContinuousScanner
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

export default PrivateDashboard;