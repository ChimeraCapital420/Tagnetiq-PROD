// FILE: src/components/investor/MarketOpportunity.tsx (REPLACE ENTIRE FILE)

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MarketSizeChart } from './MarketSizeChart'; // Import the new chart component

interface MarketOpportunityProps {
  data: {
    tam: { [key: string]: string };
    projections: { [key: string]: string };
  } | null;
}

export const MarketOpportunity: React.FC<MarketOpportunityProps> = ({ data }) => {
  // Define the data for the TAM/SAM/SOM chart. This could also come from an API.
  const marketData = {
    tam: { label: 'Total Addressable Market', value: '$1.3T' },
    sam: { label: 'Serviceable Addressable Market', value: '$125B' },
    som: { label: 'Serviceable Obtainable Market', value: '$1B' },
  };

  const projections = data?.projections ?? { q4_2025: 'N/A', q1_2026: 'N/A' };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Opportunity (TAM/SAM/SOM)</CardTitle>
        <CardDescription>
          Defining the scale of the asset valuation market and our strategic focus.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <MarketSizeChart data={marketData} />
        </div>
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-lg">Financial Projections</h3>
            <p className="text-sm text-muted-foreground">
              Based on current traction and market penetration strategy.
            </p>
            <div className="grid grid-cols-2 gap-4 mt-4 text-center">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs uppercase text-muted-foreground">Q4 2025</p>
                <p className="text-2xl font-bold text-primary">{projections.q4_2025}</p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-xs uppercase text-muted-foreground">Q1 2026</p>
                <p className="text-2xl font-bold text-primary">{projections.q1_2026}</p>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg">Key Segments</h3>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mt-2">
              <li>High-Value Collectibles (Cards, Comics, Art)</li>
              <li>Used Vehicles & Heavy Machinery</li>
              <li>Real Estate Flipping & Insurance Assessment</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};