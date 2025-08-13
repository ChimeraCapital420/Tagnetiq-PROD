import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { Edit, DollarSign, ExternalLink } from 'lucide-react';

interface ListingDraftModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: string;
  marketValue: string;
}

const ListingDraftModal: React.FC<ListingDraftModalProps> = ({
  isOpen,
  onClose,
  item,
  marketValue
}) => {
  const { theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);

  // Generate AI-optimized title
  const aiTitle = `Premium ${item} - Excellent Condition - Fast Shipping`;
  
  // Generate compelling description
  const aiDescription = `🌟 PREMIUM QUALITY ${item.toUpperCase()} 🌟

This exceptional ${item} is in excellent condition and ready for its new home! Perfect for collectors and enthusiasts alike.

✅ CONDITION: Excellent - carefully inspected and verified
✅ AUTHENTICITY: 100% genuine, backed by our guarantee
✅ SHIPPING: Fast and secure packaging with tracking
✅ CUSTOMER SERVICE: 5-star rated seller with 99%+ feedback

Don't miss this opportunity to own this fantastic ${item}! Questions? Feel free to message us anytime.

#Premium #Quality #FastShipping #ExcellentCondition`;

  const suggestedPrice = marketValue.replace('$', '').replace(',', '');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] overflow-y-auto backdrop-blur-sm border"
        style={{
          backgroundColor: `${themeConfig.colors.surface}95`,
          borderColor: `${themeConfig.colors.border}50`,
        }}
      >
        <DialogHeader>
          <DialogTitle 
            className="flex items-center text-2xl"
            style={{ 
              color: themeConfig.colors.text,
              fontFamily: themeConfig.fonts.heading
            }}
          >
            <Edit className="w-6 h-6 mr-2" />
            AI-Generated Listing Draft
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 p-2">
          {/* Title Section */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              SEO-Optimized Title:
            </label>
            <Input
              value={aiTitle}
              className="backdrop-blur-sm border"
              style={{
                backgroundColor: `${themeConfig.colors.background}80`,
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            />
          </div>

          {/* Description Section */}
          <div>
            <label 
              className="block text-sm font-medium mb-2"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              Compelling Sales Description:
            </label>
            <Textarea
              value={aiDescription}
              rows={12}
              className="backdrop-blur-sm border resize-none"
              style={{
                backgroundColor: `${themeConfig.colors.background}80`,
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            />
          </div>

          {/* Price Section */}
          <div>
            <label 
              className="block text-sm font-medium mb-2 flex items-center"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              <DollarSign className="w-4 h-4 mr-1" />
              Suggested Price (Based on Analysis):
            </label>
            <Input
              value={`$${suggestedPrice}`}
              className="backdrop-blur-sm border w-32"
              style={{
                backgroundColor: `${themeConfig.colors.background}80`,
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.text
              }}
            />
          </div>

          {/* Marketplace Buttons */}
          <div>
            <label 
              className="block text-sm font-medium mb-3"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              One-Click Posting:
            </label>
            <div className="flex flex-wrap gap-3">
              <Button 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Post to eBay
              </Button>
              <Button 
                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Post to Mercari
              </Button>
              <Button 
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              >
                <ExternalLink className="w-4 h-4" />
                Post to Poshmark
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: `${themeConfig.colors.border}30` }}>
            <Button 
              variant="outline" 
              onClick={onClose}
              style={{
                borderColor: `${themeConfig.colors.border}50`,
                color: themeConfig.colors.textSecondary
              }}
            >
              Cancel
            </Button>
            <Button 
              className="text-white"
              style={{ backgroundColor: themeConfig.colors.accent }}
            >
              Save Draft
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ListingDraftModal;