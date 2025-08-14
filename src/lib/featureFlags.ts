import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  updated_at: string;
}

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    try {
      const response = await fetch('/api/flags');
      if (!response.ok) throw new Error('Failed to fetch flags.');
      const data = await response.json();
      setFlags(data);
    } catch (error) {
      toast.error('Could not load feature flags', { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  const updateFlag = async (key: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      });
      if (!response.ok) throw new Error('Failed to update flag.');
      
      // Update local state for immediate UI feedback
      setFlags(currentFlags => 
        currentFlags.map(flag => flag.key === key ? { ...flag, enabled } : flag)
      );
      toast.success(`Flag '${key}' has been ${enabled ? 'enabled' : 'disabled'}.`);
    } catch (error) {
      toast.error('Failed to update flag', { description: (error as Error).message });
    }
  };

  return { flags, loading, refresh: fetchFlags, updateFlag };
}