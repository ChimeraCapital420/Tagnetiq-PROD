// FILE: src/components/investor/TopFeatures.tsx (CREATE OR REPLACE)

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface FeatureRequest {
  feature: string;
  count: number;
}

export const TopFeatures: React.FC = () => {
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const response = await fetch('/api/investor/top-features');
        if (!response.ok) {
          throw new Error('Failed to fetch top feature requests.');
        }
        const result = await response.json();
        setFeatures(result);
      } catch (error) {
        toast.error("Could not load top features.", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchFeatures();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-8 bg-muted rounded w-full animate-pulse"></div>
        ))}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-4">
        Not enough feedback yet to determine top requests.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {features.map((item, index) => (
        <div key={index} className="flex justify-between items-center bg-muted/50 p-2 rounded-md">
          <span className="font-medium text-sm">{item.feature}</span>
          <Badge variant="secondary">{item.count} requests</Badge>
        </div>
      ))}
    </div>
  );
};