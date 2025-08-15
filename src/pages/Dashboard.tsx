// FILE: src/pages/Dashboard.tsx

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CATEGORIES } from '@/lib/constants';
import AnalysisResult from '@/components/AnalysisResult';
import MarketComps from '@/components/MarketComps';
import SubCategoryModal from '@/components/SubCategoryModal';
import DualScanner from '@/components/DualScanner';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScanLine, X } from 'lucide-react'; // Import necessary icons

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    selectedCategory,
    setSelectedCategory,
    isScanning,
    setIsScanning,
    lastAnalysisResult,
    setLastAnalysisResult,
  } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [activeCategoryForModal, setActiveCategoryForModal] = useState('');

  const handleCategorySelect = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setLastAnalysisResult(null); 
      setSelectedCategory(categoryId);
      setActiveCategoryForModal(categoryId);
      setIsSubCategoryModalOpen(true);
      toast.info(`AI Mode set to ${category.name}. You can scan now or refine your search.`);
    }
  };

  const clearCategory = () => {
    setSelectedCategory(null);
    setLastAnalysisResult(null);
    toast.success("AI Mode reset to General Search.");
  };

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    const baseCategoryId = selectedCategory.split('-')[0];
    const category = CATEGORIES.find(c => c.id === baseCategoryId);
    const subCategory = subCategories[baseCategoryId]?.find(sc => sc.id === selectedCategory);
    return subCategory ? `${category?.name} / ${subCategory.name}` : category?.name || 'General';
  };
  
  const renderContent = () => {
    if (lastAnalysisResult) return <AnalysisResult />;
    if (selectedCategory === 'real-estate-comps') return <MarketComps />;

    // Default View: The category selection grid for specialty selection.
    return (
      <Card>
        <CardHeader>
          <CardTitle>Select Analysis Mode</CardTitle>
          <CardDescription>Choose an AI specialty to refine your search, or use the scan button for a general analysis.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategorySelect(cat.id)}
              disabled={cat.status !== 'Active'}
              className="text-left disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Card className={`h-full transition-colors ${selectedCategory?.startsWith(cat.id) ? 'border-primary' : 'group-hover:border-primary'}`}>
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <cat.icon className={`h-6 w-6 shrink-0 mt-1 ${selectedCategory?.startsWith(cat.id) ? 'text-primary' : 'text-muted-foreground'}`} />
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
      <div className="relative z-10 p-4 sm:p-8 pb-24"> {/* Added padding-bottom for FAB */}
        <div className="max-w-4xl mx-auto space-y-8">
          <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 items-center">
              <div className="p-8">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.email || 'Tester'}!</h1>
                <div className="mt-2 text-muted-foreground flex items-center gap-2">
                  <span>Current Mode:</span>
                  <span className="font-semibold text-primary">{getCategoryDisplayName()}</span>
                  {selectedCategory && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearCategory}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="h-48 md:h-full w-full">
                <img src="/images/dashboard-welcome.jpg" alt="Futuristic asset analysis" className="h-full w-full object-cover"/>
              </div>
            </div>
          </Card>
          
          {renderContent()}
        </div>
      </div>

      {/* RESTORED: Floating Action Button for Scanning */}
      <div className="fixed bottom-8 right-8 z-50">
        <Button size="lg" className="rounded-full h-16 w-16 shadow-lg" onClick={() => setIsScanning(true)}>
          <ScanLine className="h-8 w-8" />
        </Button>
      </div>
      
      <DualScanner 
        isOpen={isScanning} 
        onClose={() => setIsScanning(false)} 
      />

      {activeCategoryForModal && (
        <SubCategoryModal
            isOpen={isSubCategoryModalOpen}
            onClose={() => setIsSubCategoryModalOpen(false)}
            categoryId={activeCategoryForModal}
            categoryName={CATEGORIES.find(c => c.id === activeCategoryForModal)?.name || ''}
        />
      )}
    </>
  );
};

// You need to import subCategories to use it in getCategoryDisplayName
import { subCategories } from '@/lib/subcategories'; 

export default Dashboard;