// FILE: src/pages/Dashboard.tsx

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAppContext } from '@/contexts/AppContext';
import { CATEGORIES } from '@/lib/constants';
import AnalysisResult from '@/components/AnalysisResult';
import SubCategoryModal from '@/components/SubCategoryModal';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';


const Dashboard: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult, selectedCategory, setSelectedCategory } = useAppContext();
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<any>(null);
  const { user } = useAuth();


  const handleCategorySelect = (category: any) => {
    // Logic to open sub-category modal if needed
    if (category.id !== 'continuous-scan' && category.id !== 'multi-image') {
        setCurrentCategory(category);
        setIsSubCategoryModalOpen(true);
    } else {
        setSelectedCategory(category.id);
        toast.info(`Switched to ${category.name} mode.`);
    }
  };
  
  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    // Find category or subcategory name
    for (const cat of CATEGORIES) {
        if (cat.id === selectedCategory) return cat.name;
        if (cat.subcategories) {
            const sub = cat.subcategories.find(s => s.id === selectedCategory);
            if (sub) return sub.name;
        }
    }
    return 'General';
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

          {/* --- AEGIS ENTRY POINT CARD --- */}
          <Link to="/vault">
            <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary transition-all group cursor-pointer">
              <div className="p-6">
                  <div className="flex items-center gap-4">
                      <ShieldCheck className="h-10 w-10 text-primary" />
                      <div>
                          <h2 className="text-xl font-bold">Aegis Digital Vault</h2>
                          <p className="text-muted-foreground">
                              Secure, manage, and export your high-value assets for insurance, estate planning, and peace of mind.
                          </p>
                      </div>
                  </div>
              </div>
            </Card>
          </Link>
          
          {lastAnalysisResult && (
            <div className="flex justify-center">
              <AnalysisResult />
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => (
              <Card 
                key={category.id} 
                className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm hover:border-primary transition-all group cursor-pointer text-center"
                onClick={() => handleCategorySelect(category)}
              >
                <CardHeader className="p-4 flex-col items-center">
                  <category.icon className="h-8 w-8 mb-2" />
                  <CardTitle className="text-base">{category.name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-xs text-muted-foreground">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      {currentCategory && (
        <SubCategoryModal
          isOpen={isSubCategoryModalOpen}
          onClose={() => setIsSubCategoryModalOpen(false)}
          categoryId={currentCategory.id}
          categoryName={currentCategory.name}
        />
      )}
    </>
  );
};

export default Dashboard;
