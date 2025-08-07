import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { getCategoryColors } from '@/lib/categoryColors';
import { toast } from '@/components/ui/use-toast';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string;
  categoryName: string;
  subCategoryName: string;
}

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
  categoryId,
  categoryName,
  subCategoryName
}) => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const categoryColors = getCategoryColors(categoryId);
  
  const [settings, setSettings] = useState({
    priceRange: { min: '', max: '' },
    condition: 'any',
    marketSource: 'ebay',
    autoList: false,
    profitMargin: '20',
    vinDecoding: false,
    conditionGrading: false,
    gradingService: 'psa'
  });

  const getSpecializedSettings = () => {
    // VIN Decoding for Vehicles
    if (categoryId === 'vehicles' && subCategoryName === 'VIN Scan') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Enable VIN Decoding</Label>
            <Switch 
              checked={settings.vinDecoding}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, vinDecoding: checked }))}
            />
          </div>
          <div>
            <Label>Vehicle History Sources</Label>
            <Select value={settings.marketSource} onValueChange={(v) => setSettings(s => ({ ...s, marketSource: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="carfax">Carfax Integration</SelectItem>
                <SelectItem value="autocheck">AutoCheck</SelectItem>
                <SelectItem value="kbb">KBB Valuation</SelectItem>
                <SelectItem value="edmunds">Edmunds Pricing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      );
    }

    // Condition Grading for Collectibles & Sports Cards
    if ((categoryId === 'collectibles' || categoryId === 'sports') && 
        (subCategoryName === 'Trading Cards' || subCategoryName.includes('Cards'))) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>AI Condition Grading</Label>
            <Switch 
              checked={settings.conditionGrading}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, conditionGrading: checked }))}
            />
          </div>
          <div>
            <Label>Grading Service Standard</Label>
            <Select value={settings.gradingService} onValueChange={(v) => setSettings(s => ({ ...s, gradingService: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="psa">PSA (10-Point Scale)</SelectItem>
                <SelectItem value="bgs">BGS (10-Point Scale)</SelectItem>
                <SelectItem value="sgc">SGC (10-Point Scale)</SelectItem>
                <SelectItem value="custom">Custom Grading</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Card Condition Notes</Label>
            <Textarea 
              placeholder="AI will analyze centering, corners, edges, surface..."
              className="h-20"
            />
          </div>
        </div>
      );
    }

    return null;
  };

  const handleSave = () => {
    toast({
      title: "Settings Saved",
      description: `${categoryName} - ${subCategoryName} AI configured with specialized features`,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-lg max-h-[80vh] overflow-y-auto"
        style={{
          backgroundColor: themeConfig.colors.surface,
          borderColor: themeConfig.colors.border,
          color: themeConfig.colors.text
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: themeConfig.colors.text }}>
            Configure {subCategoryName} Analysis
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Min Price ($)</Label>
              <Input 
                value={settings.priceRange.min}
                onChange={(e) => setSettings(s => ({
                  ...s, 
                  priceRange: { ...s.priceRange, min: e.target.value }
                }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Max Price ($)</Label>
              <Input 
                value={settings.priceRange.max}
                onChange={(e) => setSettings(s => ({
                  ...s, 
                  priceRange: { ...s.priceRange, max: e.target.value }
                }))}
                placeholder="1000"
              />
            </div>
          </div>

          <div>
            <Label>Condition Filter</Label>
            <Select value={settings.condition} onValueChange={(v) => setSettings(s => ({ ...s, condition: v }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any Condition</SelectItem>
                <SelectItem value="mint">Mint/Near Mint</SelectItem>
                <SelectItem value="excellent">Excellent</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair/Poor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {getSpecializedSettings()}

          <div className="flex items-center justify-between">
            <Label>Auto-List Profitable Items</Label>
            <Switch 
              checked={settings.autoList}
              onCheckedChange={(checked) => setSettings(s => ({ ...s, autoList: checked }))}
            />
          </div>

          <Button 
            onClick={handleSave}
            className="w-full"
            style={{ backgroundColor: categoryColors.primary }}
          >
            Save Configuration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedSettingsModal;