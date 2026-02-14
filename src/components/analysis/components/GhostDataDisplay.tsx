// FILE: src/components/analysis/components/GhostDataDisplay.tsx
// Displays Ghost Protocol data: store, shelf price, margin, velocity.
// The competitive moat — KPI data from the physical store.

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Ghost } from 'lucide-react';
import { safeString, safeNumber } from '../utils/safe-helpers.js';
import type { GhostData } from '@/hooks/useGhostMode';

interface GhostDataDisplayProps {
  ghostData: GhostData;
}

const GhostDataDisplay: React.FC<GhostDataDisplayProps> = ({ ghostData }) => {
  return (
    <div className="mt-4 p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
      <div className="flex items-center gap-2 mb-3">
        <Ghost className="h-5 w-5 text-purple-400" />
        <span className="font-medium text-purple-400">Ghost Protocol Data</span>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Store</p>
          <p className="font-medium">{safeString(ghostData.store?.name) || 'Unknown'}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Shelf Price</p>
          <p className="font-medium">${safeNumber(ghostData.pricing?.shelf_price).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Estimated Margin</p>
          <p className={`font-medium ${safeNumber(ghostData.kpis?.estimated_margin) > 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${safeNumber(ghostData.kpis?.estimated_margin).toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Velocity</p>
          <Badge variant="outline" className={
            ghostData.kpis?.velocity_score === 'high' ? 'text-green-400 border-green-400' :
            ghostData.kpis?.velocity_score === 'medium' ? 'text-yellow-400 border-yellow-400' :
            'text-red-400 border-red-400'
          }>
            {safeString(ghostData.kpis?.velocity_score) || 'unknown'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default GhostDataDisplay;