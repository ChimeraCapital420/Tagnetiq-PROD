// FILE: src/pages/Dashboard.tsx

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORIES } from '@/lib/constants';
import AnalysisResult from '@/components/AnalysisResult';
import SubCategoryModal from '@/components/SubCategoryModal';
import OracleVisualizer from '@/components/OracleVisualizer';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { subCategories } from '@/lib/subcategories';
import SpotlightCarousel from '@/components/dashboard/SpotlightCarousel';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { useWelcomeMessage } from '@/hooks/useWelcomeMessage';

const Dashboard: React.FC = () => {
  // Send welcome message to new users (runs once after onboarding)
  useWelcomeMessage();

  const { lastAnalysisResult, selectedCategory, setSelectedCategory } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<{ id: string; name: string } | null>(null);
  const [isCategoryPanelOpen, setIsCategoryPanelOpen] = useState(false);
  const { user, profile } = useAuth();

  const handleCategorySelect = (category: { id: string; name: string; }) => {
    setSelectedCategory(category.id);
    toast.info(`AI mode set to ${category.name}.`);

    const availableSubCategories = subCategories[category.id] || [];
    
    if (availableSubCategories.length > 0) {
        setCurrentCategory(category);
        setIsSubCategoryModalOpen(true);
    } else {
      // Close the panel after selection if no subcategories
      setIsCategoryPanelOpen(false);
    }
  };
  
  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    
    for (const cat of CATEGORIES) {
      if (cat.id === selectedCategory) return cat.name;
      const sub = subCategories[cat.id]?.find(s => s.id === selectedCategory);
      if (sub) return `${cat.name}: ${sub.name}`;
    }

    const parentCategory = CATEGORIES.find(c => selectedCategory.startsWith(c.id));
    return parentCategory?.name || 'General';
  };

  // Get display name with fallback chain: screen_name -> full_name -> email -> 'Tester'
  const displayName = profile?.screen_name || profile?.full_name || user?.email || 'Tester';

  return (
    <>
      <div className="relative z-10 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          
          {/* Welcome Card with Spotlight */}
          <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="p-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {displayName}!</h1>
                <p className="mt-2 text-muted-foreground">
                  Current Mode: <span className="font-semibold text-primary">{getCategoryDisplayName()}</span>
                </p>
              </div>
              <div className="h-48 md:h-full w-full">
                <SpotlightCarousel />
              </div>
            </div>
          </Card>

          {/* Analysis Result */}
          {lastAnalysisResult && (
            <div className="flex justify-center">
              <AnalysisResult />
            </div>
          )}

          {/* Collapsible Category Refinement Panel */}
          <div className="space-y-3">
            <button
              onClick={() => setIsCategoryPanelOpen(!isCategoryPanelOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Refine Category</span>
                <span className="text-xs text-muted-foreground">(optional)</span>
              </div>
              {isCategoryPanelOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {/* Expandable Category Grid */}
            <div
              className={`grid grid-cols-3 sm:grid-cols-3 gap-3 overflow-hidden transition-all duration-300 ease-in-out ${
                isCategoryPanelOpen 
                  ? 'max-h-[600px] opacity-100' 
                  : 'max-h-0 opacity-0'
              }`}
            >
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.id || 
                  selectedCategory?.startsWith(category.id);
                
                return (
                  <Card 
                    key={category.id} 
                    className={`overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary transition-all group cursor-pointer text-center ${
                      isSelected ? 'border-primary ring-1 ring-primary/20' : ''
                    }`}
                    onClick={() => handleCategorySelect(category)}
                  >
                    <CardHeader className="p-3 flex-col items-center">
                      <category.icon className={`h-6 w-6 mb-1 ${isSelected ? 'text-primary' : ''}`} />
                      <CardTitle className="text-sm">{category.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

        </div>
      </div>
      
      {currentCategory && (
        <SubCategoryModal
          isOpen={isSubCategoryModalOpen}
          onClose={() => {
            setIsSubCategoryModalOpen(false);
            setIsCategoryPanelOpen(false); // Close panel after subcategory selection
          }}
          categoryId={currentCategory.id}
          categoryName={currentCategory.name}
        />
      )}
      
      <OracleVisualizer />
    </>
  );
};

export default Dashboard;