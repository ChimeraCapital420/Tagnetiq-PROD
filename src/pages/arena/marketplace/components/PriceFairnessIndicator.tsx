// FILE: src/pages/arena/marketplace/components/PriceFairnessIndicator.tsx
// Price fairness visual indicator

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { calculatePriceRatio } from '../utils/helpers';

interface PriceFairnessIndicatorProps {
  askingPrice: number;
  estimatedValue?: number;
}

export const PriceFairnessIndicator: React.FC<PriceFairnessIndicatorProps> = ({ 
  askingPrice, 
  estimatedValue 
}) => {
  const ratio = calculatePriceRatio(askingPrice, estimatedValue);
  
  if (ratio === null) return null;
  
  let Icon: React.ComponentType<{ className?: string }>;
  let colorClass: string;
  let label: string;
  
  if (ratio <= 0.85) {
    Icon = TrendingDown;
    colorClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    label = 'Great Deal';
  } else if (ratio <= 1.15) {
    Icon = Minus;
    colorClass = 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    label = 'Fair Price';
  } else {
    Icon = TrendingUp;
    colorClass = 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    label = 'Above Market';
  }
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border',
            colorClass
          )}>
            <Icon className="h-3 w-3" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">
            Est. Value: ${estimatedValue?.toLocaleString()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};