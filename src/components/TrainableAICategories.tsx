import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { Car, Blocks, Zap, Palette, Book, Star, ShoppingCart, Trophy } from 'lucide-react';
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

const TrainableAICategories: React.FC = () => {
  const { selectedCategory, setSelectedCategory, theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategoryData, setSelectedCategoryData] = useState<{id: string, name: string} | null>(null);

  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    // Skip Amazon Arbitrage for now - no sub-categories defined
    if (categoryId === 'amazon') {
      setSelectedCategory(categoryId);
      return;
    }
    
    setSelectedCategory(categoryId);
    setSelectedCategoryData({ id: categoryId, name: categoryName });
    setModalOpen(true);
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
    <section 
      className="py-16"
      style={{ 
        background: getSectionBackground(),
        minHeight: '40vh'
      }}
    >
      <div className="max-w-6xl mx-auto px-4">
        <Card 
          className="backdrop-blur-sm border"
          style={{
            backgroundColor: `${themeConfig.colors.surface}90`,
            borderColor: `${themeConfig.colors.border}50`,
          }}
        >
          <CardHeader>
            <CardTitle 
              className="text-center text-2xl"
              style={{ 
                color: themeConfig.colors.text,
                fontFamily: themeConfig.fonts.heading
              }}
            >
              Trainable AI Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
          </CardContent>
        </Card>
        
        {selectedCategoryData && (
          <SubCategoryModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            categoryId={selectedCategoryData.id}
            categoryName={selectedCategoryData.name}
          />
        )}
      </div>
    </section>
  );
};

export default TrainableAICategories;