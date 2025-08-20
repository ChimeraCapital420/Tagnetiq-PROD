// FILE: src/components/AnalysisResult.tsx

import React from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MarketComps from './MarketComps';
import { AddToVaultButton } from './vault/AddToVaultButton'; // Import the new button

const AnalysisResult: React.FC = () => {
  const { lastAnalysisResult, setLastAnalysisResult } = useAppContext();

  if (!lastAnalysisResult) {
    return null;
  }

  const {
    itemName,
    description,
    category,
    estimatedValue,
    confidenceScore,
    marketComps,
    imageUrls,
  } = lastAnalysisResult;

  const handleClear = () => {
    setLastAnalysisResult(null);
  };

  const confidenceColor =
    confidenceScore > 85
      ? 'bg-green-500'
      : confidenceScore > 60
      ? 'bg-yellow-500'
      : 'bg-red-500';

  return (
    <Card className="w-full max-w-2xl mx-auto border-border/50 bg-background/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-2xl">{itemName}</CardTitle>
                <CardDescription>{category}</CardDescription>
            </div>
            <Badge className={`${confidenceColor} text-white`}>
                Confidence: {confidenceScore}%
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
            <p className="mt-4 text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="space-y-6">
            <div className="text-center md:text-left">
              <p className="text-sm text-muted-foreground">Estimated Value</p>
              <p className="text-4xl font-bold">${estimatedValue}</p>
            </div>
            {marketComps && marketComps.length > 0 && (
              <MarketComps comps={marketComps} />
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        {/* --- NEW BUTTON INTEGRATION --- */}
        <AddToVaultButton analysisResult={lastAnalysisResult} onSuccess={handleClear} />
        <Button variant="outline" onClick={handleClear} className="w-full sm:w-auto">
          Analyze Another Item
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AnalysisResult;
