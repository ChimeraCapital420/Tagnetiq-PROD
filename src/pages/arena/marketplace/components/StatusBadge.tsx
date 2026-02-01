// FILE: src/pages/arena/marketplace/components/StatusBadge.tsx
// Listing status badge component

import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (status === 'active') return null;
  
  if (status === 'sold') {
    return (
      <Badge className="bg-emerald-500/90 text-white border-0">
        <CheckCircle2 className="h-3 w-3 mr-1" />
        Sold
      </Badge>
    );
  }
  
  return (
    <Badge variant="secondary" className="bg-zinc-700">
      {status}
    </Badge>
  );
};