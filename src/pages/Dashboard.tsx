// src/pages/Dashboard.tsx
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = React.useState(false);

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    const category = CATEGORIES.find(c => c.id === selectedCategory) 
      || { name: selectedCategory.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') };
    return category?.name || 'General';
  };
  
  const handleCategorySelect = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategory(categoryId);
      setIsSubCategoryModalOpen(true);
      toast.success(`AI Mode set to ${category.name}`);
    }
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
          
          {lastAnalysisResult ? <AnalysisResult /> : <MarketComps />}

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