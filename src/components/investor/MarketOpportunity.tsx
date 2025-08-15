// FILE: src/components/investor/MarketOpportunity.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

interface MarketOpportunityProps {
  data: {
    tam: { [key: string]: string };
    projections: { [key: string]: string };
  } | null;
}

export const MarketOpportunity: React.FC<MarketOpportunityProps> = ({ data }) => {
  if (!data) return null;

  return (
    <Card>
        <CardHeader>
            <CardTitle>Market Opportunity</CardTitle>
            <CardDescription>Total Addressable Market (TAM) and growth projections.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
                <h3 className="font-semibold mb-2">Total Addressable Market</h3>
                <div className="space-y-4">
                    {Object.entries(data.tam).map(([key, value]) => (
                        <div key={key}>
                            <p className="text-2xl font-bold">${value}</p>
                            <p className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                        </div>
                    ))}
                </div>
            </div>
             <div>
                <h3 className="font-semibold mb-2">Growth Projections (MAU)</h3>
                <div className="space-y-4">
                     {Object.entries(data.projections).map(([key, value]) => (
                        <div key={key}>
                            <p className="text-2xl font-bold">{value}</p>
                            <p className="text-sm text-muted-foreground uppercase">{key.replace(/_/g, ' ')}</p>
                        </div>
                    ))}
                </div>
            </div>
        </CardContent>
    </Card>
  );
};