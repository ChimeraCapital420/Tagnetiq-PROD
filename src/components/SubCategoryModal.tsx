import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { subCategories } from '@/lib/subcategories';
import { toast } from 'sonner';

interface SubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

const SubCategoryModal: React.FC<SubCategoryModalProps> = ({ isOpen, onClose, categoryId, categoryName }) => {
  const { setSelectedCategory } = useAppContext();
  const availableSubCategories = subCategories[categoryId] || [];

  const handleSelect = (subCategory: { id: string; name: string; comingSoon?: boolean }) => {
    if (subCategory.comingSoon) {
      toast.info(`${subCategory.name} feature is coming soon!`);
      return;
    }
    setSelectedCategory(subCategory.id);
    toast.success(`AI refined for ${subCategory.name}.`);
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  // If there are no sub-categories defined, close the modal immediately.
  if (availableSubCategories.length === 0) {
    onClose();
    return null;
  }

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Select a Specialty for {categoryName}</CardTitle>
              <CardDescription>Refine the AI's focus for better results.</CardDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {availableSubCategories.map((sub) => (
              <button key={sub.id} onClick={() => handleSelect(sub)} disabled={sub.comingSoon} className="text-left disabled:opacity-50 disabled:cursor-not-allowed">
                <Card className="h-full hover:bg-accent hover:border-primary transition-colors">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{sub.name}</CardTitle>
                        <CardDescription className="mt-1">{sub.description}</CardDescription>
                      </div>
                      {sub.comingSoon && <Badge variant="outline">Coming Soon</Badge>}
                    </div>
                  </CardHeader>
                </Card>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubCategoryModal;