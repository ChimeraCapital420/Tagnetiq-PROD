import React from 'react';
import { Car, Building2, Sword, Palette, BookOpen, Gem, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';

const TrainableCategories: React.FC = () => {
  const { toast } = useToast();
  const { theme, themeMode, selectedCategory, setSelectedCategory } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  const categories = [
    {
      id: 'vehicles',
      title: 'Vehicles',
      icon: Car,
      tags: ['Cars', 'Motorcycles', 'Parts']
    },
    {
      id: 'lego',
      title: 'LEGO Sets',
      icon: Building2,
      tags: ['Sets', 'Minifigs', 'Rare']
    },
    {
      id: 'starwars',
      title: 'Star Wars',
      icon: Sword,
      tags: ['Figures', 'Vintage', 'Props']
    },
    {
      id: 'art',
      title: 'Art & Antiques',
      icon: Palette,
      tags: ['Paintings', 'Sculptures', 'Antiques']
    },
    {
      id: 'books',
      title: 'Vintage Books',
      icon: BookOpen,
      tags: ['First Editions', 'Comics', 'Manuscripts']
    },
    {
      id: 'collectibles',
      title: 'Rare Collectibles',
      icon: Gem,
      tags: ['Coins', 'Stamps', 'Trading Cards']
    },
    {
      id: 'amazon-arbitrage',
      title: 'Amazon Arbitrage',
      icon: ShoppingCart,
      tags: ['Retail', 'Price Compare', 'Profit Margin']
    }
  ];

  const handleCategorySelect = (category: typeof categories[0]) => {
    setSelectedCategory(category.id);
    toast({
      title: `AI primed for ${category.title} analysis`,
      duration: 3000,
    });
  };

  const handleTagSelect = (categoryId: string, tag: string) => {
    setSelectedCategory(`${categoryId}-${tag.toLowerCase()}`);
    toast({
      title: `AI refined for ${tag} analysis`,
      duration: 3000,
    });
  };

  return (
    <section className="py-16 px-4" style={{ backgroundColor: themeConfig.colors.background }}>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4" 
              style={{ 
                color: themeConfig.colors.text,
                fontFamily: themeConfig.fonts.heading 
              }}>
            Trainable AI Categories
          </h2>
          <p className="text-xl" style={{ color: themeConfig.colors.textSecondary }}>
            Focus the AI on your niche for unparalleled precision
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((category) => {
            const IconComponent = category.icon;
            const isSelected = selectedCategory?.startsWith(category.id);
            
            return (
              <div
                key={category.id}
                className={`group p-6 rounded-xl border-2 transition-all duration-300 ${
                  isSelected ? 'scale-105 shadow-xl' : 'hover:scale-105 hover:shadow-xl'
                }`}
                style={{
                  backgroundColor: themeConfig.colors.cardBackground,
                  borderColor: isSelected ? themeConfig.colors.primary : themeConfig.colors.border,
                  color: themeConfig.colors.text
                }}
              >
                <button
                  onClick={() => handleCategorySelect(category)}
                  className="w-full flex flex-col items-center text-center space-y-4"
                >
                  <div className="p-4 rounded-full transition-colors duration-300"
                       style={{ 
                         backgroundColor: isSelected 
                           ? themeConfig.colors.primary 
                           : `${themeConfig.colors.primary}20`,
                         color: isSelected ? 'white' : themeConfig.colors.primary 
                       }}>
                    <IconComponent size={32} />
                  </div>
                  
                  <h3 className="text-xl font-bold" style={{ fontFamily: themeConfig.fonts.heading }}>
                    {category.title}
                  </h3>
                </button>
                
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  {category.tags.map((tag) => {
                    const tagSelected = selectedCategory === `${category.id}-${tag.toLowerCase()}`;
                    return (
                      <button
                        key={tag}
                        onClick={() => handleTagSelect(category.id, tag)}
                        className={`px-3 py-1 text-sm rounded-full transition-all duration-200 ${
                          tagSelected ? 'scale-110' : 'hover:scale-105'
                        }`}
                        style={{
                          backgroundColor: tagSelected 
                            ? themeConfig.colors.accent 
                            : `${themeConfig.colors.accent}20`,
                          color: tagSelected ? 'white' : themeConfig.colors.accent
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default TrainableCategories;