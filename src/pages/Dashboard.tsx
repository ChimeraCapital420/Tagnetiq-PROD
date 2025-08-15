// FILE: src/pages/Dashboard.tsx

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/constants';
import AnalysisResult from '@/components/AnalysisResult';
import MarketComps from '@/components/MarketComps';
import SubCategoryModal from '@/components/SubCategoryModal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    selectedCategory,
    setSelectedCategory,
    isScanning,
    setIsScanning,
    lastAnalysisResult,
    setLastAnalysisResult, // Ensure this is available from context if you plan to clear results
  } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = React.useState(false);

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    // Find the base category for display if a sub-category is selected
    const baseCategoryId = selectedCategory.split('-')[0];
    const category = CATEGORIES.find(c => c.id.startsWith(baseCategoryId));
    return category?.name || 'General';
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategory(categoryId);
      // Open the sub-category modal only if there are sub-categories
      setIsSubCategoryModalOpen(true);
      toast.success(`AI Mode set to ${category.name}`);
      // Clear previous analysis result when changing category
      setLastAnalysisResult(null);
    }
  };

  const renderContent = () => {
    if (lastAnalysisResult) {
      return <AnalysisResult />;
    }
    if (selectedCategory && selectedCategory.startsWith('real-estate')) {
      return <MarketComps />;
    }
    // Default view: The category selection grid
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Analysis Mode</CardTitle>
          <CardDescription>Choose an AI specialty to begin.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              disabled={cat.status !== 'Active'}
              className="text-left disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Card className="h-full group-hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <cat.icon className="h-6 w-6 text-primary shrink-0" />
                    <div>
                      <CardTitle className="text-base">{cat.name}</CardTitle>
                      <CardDescription className="mt-1 text-xs">{cat.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </button>
          ))}
        </CardContent>
      </Card>
    );
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
                <img src="/images/dashboard-welcome.jpg" alt="Futuristic asset analysis" className="h-full w-full object-cover"/>
              </div>
            </div>
          </Card>
          
          {renderContent()}

        </div>
      </div>
      
      {selectedCategory && (
        <SubCategoryModal
            isOpen={isSubCategoryModalOpen}
            onClose={() => setIsSubCategoryModalOpen(false)}
            categoryId={selectedCategory}
            categoryName={getCategoryDisplayName()}
        />
      )}
    </>
  );
};

export default Dashboard;