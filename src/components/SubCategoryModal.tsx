import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { toast } from '@/components/ui/use-toast';
import AdvancedSettingsModal from './AdvancedSettingsModal';

interface SubCategory {
  id: string;
  name: string;
}

interface SubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
}

const subCategories: Record<string, SubCategory[]> = {
  vehicles: [
    { id: 'vin-scan', name: 'VIN Scan' },
    { id: 'parts-partner', name: 'Parts Partner' },
    { id: 'market-comps', name: 'Market Comps' }
  ],
  lego: [
    { id: 'sealed-box', name: 'Sealed Box' },
    { id: 'bulk-bricks', name: 'Bulk Bricks' },
    { id: 'minifigures', name: 'Minifigures' }
  ],
  starwars: [
    { id: 'action-figures', name: 'Action Figures' },
    { id: 'vehicles-playsets', name: 'Vehicles & Playsets' },
    { id: 'props-ephemera', name: 'Props & Ephemera' }
  ],
  art: [
    { id: 'paintings-prints', name: 'Paintings & Prints' },
    { id: 'sculpture-decor', name: 'Sculpture & Decor' },
    { id: 'furniture', name: 'Furniture' }
  ],
  books: [
    { id: 'first-editions', name: 'First Editions' },
    { id: 'comic-books', name: 'Comic Books' },
    { id: 'magazines-ephemera', name: 'Magazines & Ephemera' }
  ],
  collectibles: [
    { id: 'coins-currency', name: 'Coins & Currency' },
    { id: 'stamps', name: 'Stamps' },
    { id: 'trading-cards', name: 'Trading Cards' }
  ],
  sports: [
    { id: 'trading-cards', name: 'Trading Cards' },
    { id: 'jerseys', name: 'Jerseys' },
    { id: 'autographs', name: 'Autographs' }
  ]
};

const SubCategoryModal: React.FC<SubCategoryModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  categoryName
}) => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const categoryColors = getCategoryColors(categoryId);
  const subs = subCategories[categoryId] || [];
  
  const [advancedModalOpen, setAdvancedModalOpen] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategory | null>(null);

  const handleSubCategorySelect = (subCategory: SubCategory) => {
    // Show detailed configuration options for the selected subcategory
    toast({
      title: "AI Specialized",
      description: `${categoryName} - ${subCategory.name} AI is now active. Configure advanced settings?`,
      action: (
        <Button 
          size="sm" 
          onClick={() => openAdvancedSettings(subCategory)}
          style={{ backgroundColor: categoryColors.primary }}
        >
          Configure
        </Button>
      ),
    });
    onClose();
  };

  const openAdvancedSettings = (subCategory: SubCategory) => {
    setSelectedSubCategory(subCategory);
    setAdvancedModalOpen(true);
  };
  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="sm:max-w-md"
          style={{
            backgroundColor: themeConfig.colors.surface,
            borderColor: themeConfig.colors.border,
            color: themeConfig.colors.text
          }}
        >
          <DialogHeader>
            <DialogTitle 
              style={{ 
                color: themeConfig.colors.text,
                fontFamily: themeConfig.fonts.heading
              }}
            >
              {categoryName} Specializations
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {subs.map((subCategory) => (
              <Button
                key={subCategory.id}
                variant="outline"
                className="h-12 justify-start transition-all duration-200"
                style={{
                  borderColor: `${categoryColors.primary}50`,
                  color: themeConfig.colors.text
                }}
                onClick={() => handleSubCategorySelect(subCategory)}
              >
                {subCategory.name}
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {selectedSubCategory && (
        <AdvancedSettingsModal
          isOpen={advancedModalOpen}
          onClose={() => setAdvancedModalOpen(false)}
          categoryId={categoryId}
          categoryName={categoryName}
          subCategoryName={selectedSubCategory.name}
        />
      )}
    </>
  );
};

export default SubCategoryModal;