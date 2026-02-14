// FILE: src/components/analysis/components/ValuationDetails.tsx
// Displays estimated value, key valuation factors, and the refine button.

import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, WandSparkles } from 'lucide-react';

interface ValuationDetailsProps {
  estimatedValue: number;
  valuationFactors: string[];
  summaryReasoning: string;
  isViewingHistory: boolean;
  onRefine: () => void;
}

const ValuationDetails: React.FC<ValuationDetailsProps> = ({
  estimatedValue,
  valuationFactors,
  summaryReasoning,
  isViewingHistory,
  onRefine,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <p className="text-sm text-muted-foreground">Estimated Value</p>
        <p className="text-5xl font-bold">${estimatedValue.toFixed(2)}</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <h3 className="text-lg font-semibold">Key Valuation Factors</h3>
          {!isViewingHistory && (
            <Button variant="outline" size="sm" onClick={onRefine}>
              <WandSparkles className="h-4 w-4 mr-2" />
              Refine Analysis
            </Button>
          )}
        </div>

        {valuationFactors.length > 0 ? (
          <ul className="space-y-2 text-sm text-muted-foreground">
            {valuationFactors.map((factor, index) => (
              <li key={index} className="flex items-start">
                <CheckCircle className="h-4 w-4 mr-2 mt-0.5 text-primary flex-shrink-0" />
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No specific factors identified.</p>
        )}

        {summaryReasoning && (
          <p className="mt-4 text-xs italic text-muted-foreground">{summaryReasoning}</p>
        )}
      </div>
    </div>
  );
};

export default ValuationDetails;