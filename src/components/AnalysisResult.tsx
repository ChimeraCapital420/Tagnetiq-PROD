import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { getThemeConfig } from '@/lib/themes';
import { CheckCircle, DollarSign, Package, FileText } from 'lucide-react';
import ListingDraftModal from './ListingDraftModal';
const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, theme, themeMode } = useAppContext();
  const themeConfig = getThemeConfig(theme, themeMode);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!lastAnalysisResult) return null;

  const { decision, item, marketValue, code } = lastAnalysisResult;
  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <Card 
        className="backdrop-blur-sm border"
        style={{
          backgroundColor: `${themeConfig.colors.surface}90`,
          borderColor: `${themeConfig.colors.border}50`,
        }}
      >
        <CardHeader>
          <CardTitle 
            className="flex items-center justify-center text-center"
            style={{ 
              color: themeConfig.colors.text,
              fontFamily: themeConfig.fonts.heading
            }}
          >
            <CheckCircle className="w-6 h-6 text-green-400 mr-2" />
            ANALYSIS COMPLETE
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          {/* Decision */}
          <div>
            <p 
              className="text-sm mb-2"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              Decision:
            </p>
            <div className="text-6xl font-bold text-green-400 font-mono">
              {decision}
            </div>
          </div>

          {/* Item */}
          <div>
            <p 
              className="text-sm mb-2 flex items-center justify-center"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              <Package className="w-4 h-4 mr-2" />
              Item Identified:
            </p>
            <p 
              className="text-xl font-medium"
              style={{ 
                color: themeConfig.colors.text,
                fontFamily: themeConfig.fonts.body
              }}
            >
              {item}
            </p>
          </div>

          {/* Market Value */}
          <div>
            <p 
              className="text-sm mb-2 flex items-center justify-center"
              style={{ color: themeConfig.colors.textSecondary }}
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Est. Market Value:
            </p>
            <div className="text-4xl font-bold text-green-400 font-mono">
              {marketValue}
            </div>
          </div>

          {/* Draft Listing Button */}
          <div className="pt-4">
            <Button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto px-8 py-3 text-lg font-semibold text-white flex items-center justify-center gap-2"
              style={{ backgroundColor: themeConfig.colors.accent }}
            >
              <FileText className="w-5 h-5" />
              Draft Listing
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Listing Draft Modal */}
      <ListingDraftModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={item}
        marketValue={marketValue}
      />
    </div>
  );
};

export default AnalysisResult;