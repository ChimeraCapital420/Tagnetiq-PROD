// FILE: src/components/AnalysisResult.tsx

import React, { useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTts } from '@/hooks/useTts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddToVaultButton } from './vault/AddToVaultButton';
import { CATEGORIES } from '@/lib/constants';
import { subCategories } from '@/lib/subcategories';
import { toast } from 'sonner';

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult, selectedCategory } = useAppContext();
  const { profile } = useAuth();
  const { speak } = useTts();

  useEffect(() => {
    if (lastAnalysisResult && profile?.settings?.tts_enabled) {
      const { itemName, estimatedValue, resale_toolkit } = lastAnalysisResult;
      
      let marketplaces = '';
      if (resale_toolkit?.recommended_marketplaces?.length > 0) {
        const marketNames = resale_toolkit.recommended_marketplaces.map(m => m.name).slice(0, 2);
        marketplaces = `Project Hermes recommends selling on ${marketNames.join(' and ')}.`;
      }

      const summary = `Analysis complete. Item identified as ${itemName}. Estimated value is around $${estimatedValue}. ${marketplaces}`;
      
      speak(summary, profile.settings.tts_voice_uri);
    }
  }, [lastAnalysisResult, profile, speak]);

  if (!lastAnalysisResult) {
    return null;
  }

  const {
    itemName,
    estimatedValue,
    confidence,
    reasoning,
    imageUrls,
    resale_toolkit,
  } = lastAnalysisResult;

  const handleClear = () => {
    setLastAnalysisResult(null);
  };

  const confidenceColor =
    confidence === 'high'
      ? 'bg-green-500'
      : confidence === 'medium'
      ? 'bg-yellow-500'
      : 'bg-red-500';

  const getCategoryDisplayName = () => {
    if (!selectedCategory) return 'General';
    for (const cat of CATEGORIES) {
      if (cat.id === selectedCategory) return cat.name;
      const sub = subCategories[cat.id]?.find(s => s.id === selectedCategory);
      if (sub) return `${cat.name}: ${sub.name}`;
    }
    const parentCategory = CATEGORIES.find(c => selectedCategory.startsWith(c.id));
    return parentCategory?.name || 'General';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl">{itemName}</CardTitle>
                <CardDescription>{getCategoryDisplayName()}</CardDescription>
            </div>
            <Badge className={`${confidenceColor} text-white`}>
                Confidence: {confidence.charAt(0).toUpperCase() + confidence.slice(1)}
            </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            <img
              src={imageUrls?.[0] || '/placeholder.svg'}
              alt={itemName}
              className="rounded-lg object-cover aspect-square w-full"
            />
            <p className="mt-4 text-sm text-muted-foreground">{reasoning}</p>
          </div>
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="text-4xl font-bold">${estimatedValue}</p>
            </div>
            {resale_toolkit && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">AI Sales Toolkit</h3>
                <div>
                  <h4 className="text-sm font-semibold mb-1">AI-Generated Sales Copy</h4>
                  <textarea
                    className="w-full h-32 p-2 text-xs border rounded-md bg-muted/50"
                    readOnly
                    value={resale_toolkit.sales_copy}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(resale_toolkit.sales_copy);
                      toast.success('Sales copy copied to clipboard!');
                    }}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
                <div>
                  <h4 className="text-sm font-semibold">Recommended Marketplaces</h4>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {resale_toolkit.recommended_marketplaces.map((marketplace) => (
                      <a
                        key={marketplace.name}
                        href={marketplace.affiliate_link_template?.replace('{query}', encodeURIComponent(itemName))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 border rounded-md hover:bg-accent transition-colors"
                      >
                        <img
                          src={`https://logo.clearbit.com/${marketplace.url.replace('https://', '').replace('www.','').split('/')[0]}`}
                          alt={marketplace.name}
                          className="w-4 h-4"
                        />
                        <span className="text-xs font-medium">{marketplace.name}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <AddToVaultButton analysisResult={lastAnalysisResult} onSuccess={handleClear} />
        <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
          Analyze Another Item
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AnalysisResult;