// FILE: src/components/investor/MarketSizeChart.tsx (CREATE OR REPLACE)

import React from 'react';

interface MarketSizeChartProps {
  data: {
    tam: { label: string; value: string };
    sam: { label: string; value: string };
    som: { label: string; value: string };
  };
}

export const MarketSizeChart: React.FC<MarketSizeChartProps> = ({ data }) => {
  return (
    <div className="relative flex flex-col items-center justify-center w-full max-w-md mx-auto h-80 text-center">
      {/* TAM - Outer Circle */}
      <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
        <div className="w-80 h-80 rounded-full border-2 border-primary/20 flex items-center justify-center">
          <div className="absolute -top-4 bg-background px-2 text-xs uppercase tracking-widest text-primary">
            {data.tam.label}
          </div>
          <div className="text-3xl font-bold text-primary">{data.tam.value}</div>
        </div>
      </div>

      {/* SAM - Middle Circle */}
      <div className="absolute w-56 h-56 rounded-full border-2 border-primary/40 flex items-center justify-center">
        <div className="absolute -top-3 bg-background px-2 text-xs uppercase tracking-widest text-primary/80">
          {data.sam.label}
        </div>
        <div className="text-2xl font-bold text-primary/80">{data.sam.value}</div>
      </div>

      {/* SOM - Inner Circle */}
      <div className="absolute w-32 h-32 bg-primary/10 rounded-full border-2 border-primary flex items-center justify-center">
        <div className="absolute -top-3 bg-background px-2 text-xs uppercase tracking-widest font-semibold text-foreground">
          {data.som.label}
        </div>
        <div className="text-xl font-bold text-foreground">{data.som.value}</div>
      </div>
    </div>
  );
};