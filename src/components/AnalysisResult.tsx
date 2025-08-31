// FILE: src/components/AnalysisResult.tsx
// STATUS: Repaired and reforged by Hephaestus. All backend impurities purged. UI upgraded to v2.1 standard.

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddToVaultButton } from './vault/AddToVaultButton';
import { CATEGORIES } from '@/lib/constants';
import { subCategories } from '@/lib/subcategories';
import { toast } from 'sonner';
import { CheckCircle } from 'lucide-react';

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult, selectedCategory } = useAppContext();

  if (!lastAnalysisResult) {
    return null;
  }

  // NOTE: This component now correctly consumes the v2.1 data structure from AppContext.
  const {
    itemName,
    estimatedValue,
    confidence,
    summary_reasoning,
    valuation_factors,
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
    <Card className="w-full max-w-4xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm animate-fade-in">
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
          </div>
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="text-5xl font-bold">${estimatedValue}</p>
            </div>

            {/* HEPHAESTUS UPGRADE: Displaying the new structured data */}
            <div>
                <h3 className="text-lg font-semibold mb-2">Key Valuation Factors</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    {valuation_factors.map((factor, index) => (
                        <li key={index} className="flex items-start">
                            <CheckCircle className="h-4 w-4 mr-2 mt-1 text-primary flex-shrink-0" />
                            <span>{factor}</span>
                        </li>
                    ))}
                </ul>
                <p className="mt-4 text-xs italic">{summary_reasoning}</p>
            </div>
            {/* END UPGRADE */}

            {resale_toolkit && (
              <div className="space-y-4 pt-4 border-t">
                <h3 className="text-lg font-semibold">AI Sales Toolkit (Project Hermes)</h3>
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

