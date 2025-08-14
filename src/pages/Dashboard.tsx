import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { toast } from 'sonner';
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
  const { user } = useAuth();
  const themeConfig = getThemeConfig(theme, themeMode);
  
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<{id: string, name: string} | null>(null);

  const handleCategorySelect = (categoryId: string, categoryName: string) => {
    setSelectedCategory(categoryId);
    toast.success(`AI Primed for ${categoryName} analysis.`);
    setSelectedMainCategory({ id: categoryId, name: categoryName });
    setModalOpen(true);
  };

  const handleClearCategory = () => {
    setSelectedCategory(null);
    toast.info("Switched to General Scanning Mode.");
  };

  const handleStartScanning = () => {
    setIsScanning(true);
  };

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return "General Scanning";
    const mainId = selectedCategory.split('-')[0];
    const mainCat = categories.find(c => c.id === mainId);
    const subId = selectedCategory.split('-').slice(1).join(' ');
    if (subId) {
        return `${mainCat?.name} / ${subId.charAt(0).toUpperCase() + subId.slice(1)}`;
    }
    return mainCat?.name || "General Scanning";
  };

  return (
    <>
      <div className="relative z-10 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="p-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.email || 'Tester'}!</h1>
                <p className="mt-2 text-muted-foreground">
                  Current Mode: <span className="font-semibold text-primary">{getCategoryDisplayName()}</span>
                </p>
              </div>
              <div className="h-48 md:h-full w-full">
                <img src="/dashboard-welcome.jpg" alt="Futuristic asset analysis" className="h-full w-full object-cover"/>
              </div>
            </div>
          </Card>

          <Card className="backdrop-blur-sm border-border/50 bg-background/50">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold" style={{color: themeConfig.colors.text, fontFamily: themeConfig.fonts.heading}}>
                Trainable AI Categories
              </CardTitle>
              {selectedCategory && (
                <Button variant="ghost" size="sm" className="mt-2 text-xs mx-auto" style={{color: themeConfig.colors.textSecondary}} onClick={handleClearCategory}>
                    <XCircle className="w-4 h-4 mr-2"/>
                    Switch to General Scanning Mode
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 mb-8">
                  {categories.map((category) => {
                    const isSelected = selectedCategory?.startsWith(category.id);
                    const categoryColors = getCategoryColors(category.id);
                    const IconComponent = category.icon;
                    
                    return (
                      <Button
                        key={category.id}
                        variant={isSelected ? "default" : "outline"}
                        className="h-24 flex flex-col items-center justify-center space-y-2 transition-all duration-200 p-2"
                        style={{
                          backgroundColor: isSelected ? categoryColors.primary : 'transparent',
                          borderColor: isSelected ? categoryColors.primary : `${themeConfig.colors.border}50`,
                          color: isSelected ? 'white' : themeConfig.colors.text
                        }}
                        onClick={() => handleCategorySelect(category.id, category.name)}
                      >
                        <IconComponent className="w-6 h-6" />
                        <span className="text-xs font-medium text-center leading-tight">
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
                  className="bg-gradient-to-r from-purple-600 to-green-500 hover:from-purple-700 hover:to-green-600 text-white font-semibold px-8 py-3 rounded-full text-lg"
                >
                  Start Scanning
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8">
            {lastAnalysisResult ? <AnalysisResult /> : (
              <p className="text-center text-muted-foreground">Scan results will appear here.</p>
            )}
          </div>
        </div>
      </div>
      <DualScanner
        isOpen={isScanning}
        onClose={() => setIsScanning(false)}
      />
      
      {selectedMainCategory && (
        <SubCategoryModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          categoryId={selectedMainCategory.id}
          categoryName={selectedMainCategory.name}
        />
      )}
    </>
  );
};

export default Dashboard;