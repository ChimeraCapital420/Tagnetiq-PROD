// FILE: src/pages/Dashboard.tsx (CORRECTED)

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // CardDescription removed as it's not used
import { CATEGORIES } from '@/lib/constants';
import { subCategories } from '@/lib/subcategories'; // IMPORTED SUBCATEGORIES
import AnalysisResult from '@/components/AnalysisResult';
import SubCategoryModal from '@/components/SubCategoryModal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ScanLine } from 'lucide-react';
import DualScanner from '@/components/DualScanner';

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
    // Find in main categories first
    let cat = CATEGORIES.find(c => c.id === selectedCategory);
    if (cat) return cat.name;

    // If not found, it might be a subcategory, so we find its parent
    for (const parentId in subCategories) {
        const subCat = subCategories[parentId].find(sc => sc.id === selectedCategory);
        if (subCat) return subCat.name;
    }

    return 'General';
  };

  const handleCategorySelect = (categoryId: string) => {
    const category = CATEGORIES.find(c => c.id === categoryId);
    if (category) {
      setSelectedCategory(categoryId);
      // ** THIS IS THE CORRECTED LOGIC **
      // It now checks the imported subCategories object for entries matching the categoryId
      const relatedSubCats = subCategories[categoryId] || [];
      
      if (relatedSubCats.length > 0) {
        setIsSubCategoryModalOpen(true); // Open sub-category modal
      } else {
        setIsScanning(true); // Directly open scanner if no sub-categories
      }
      toast.success(`AI Mode set to ${category.name}`);
    }
  };

  return (
    <>
      <div className="relative z-10 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-8">

          <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
            <div className="p-8">
              <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.email || 'Tester'}!</h1>
              <p className="mt-2 text-muted-foreground">
                Current Mode: <span className="font-semibold text-primary">{getCategoryDisplayName()}</span>
              </p>
            </div>
          </Card>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map((cat) => (
              <Card
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className="cursor-pointer hover:bg-primary/10 transition-colors flex flex-col justify-between"
              >
                <CardHeader>
                  <cat.icon className="h-6 w-6 mb-2 text-primary" />
                  <CardTitle>{cat.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {lastAnalysisResult && <AnalysisResult />}
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <Button size="lg" className="rounded-full h-16 w-16 shadow-lg" onClick={() => setIsScanning(true)}>
          <ScanLine className="h-8 w-8" />
        </Button>
      </div>

      {selectedCategory && (
        <SubCategoryModal
            isOpen={isSubCategoryModalOpen}
            onClose={() => setIsSubCategoryModalOpen(false)}
            categoryId={selectedCategory}
            categoryName={CATEGORIES.find(c => c.id === selectedCategory)?.name || 'Specialty'}
        />
      )}

      <DualScanner isOpen={isScanning} onClose={() => setIsScanning(false)} />
    </>
  );
};

export default Dashboard;