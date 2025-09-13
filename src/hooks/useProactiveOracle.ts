// FILE: src/hooks/useProactiveOracle.ts
// Hook for integrating proactive Oracle intelligence into the app

import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SweepResult {
  categories: string[];
}

interface TriageResult {
  analysis: {
    identification: string;
    estimated_value: string;
    key_features?: string[];
    condition?: string;
  };
  nudge: {
    should_alert: boolean;
    reasons: string[];
    priority: 'low' | 'medium' | 'high';
    personal_matches: number;
    market_matches: number;
  };
}

export const useProactiveOracle = () => {
  const { session } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const sweep = useCallback(async (imageBase64: string): Promise<SweepResult | null> => {
    if (!session) return null;

    try {
      const response = await fetch('/api/oracle/proactive/sweep', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ image: imageBase64 })
      });

      if (!response.ok) throw new Error('Sweep failed');
      
      return await response.json();
    } catch (error) {
      console.error('Sweep error:', error);
      return null;
    }
  }, [session]);

  const triage = useCallback(async (imageBase64: string, category: string): Promise<TriageResult | null> => {
    if (!session) return null;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/oracle/proactive/triage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ image: imageBase64, category })
      });

      if (!response.ok) throw new Error('Triage failed');
      
      const result: TriageResult = await response.json();
      
      // Show notification if nudge is warranted
      if (result.nudge.should_alert) {
        const message = result.nudge.reasons.join(' • ');
        
        switch (result.nudge.priority) {
          case 'high':
            toast.success(`🎯 ${result.analysis.identification}`, {
              description: message,
              duration: 10000
            });
            break;
          case 'medium':
            toast.info(`👀 ${result.analysis.identification}`, {
              description: message,
              duration: 7000
            });
            break;
          default:
            toast(`💡 ${result.analysis.identification}`, {
              description: message,
              duration: 5000
            });
        }
      }
      
      return result;
    } catch (error) {
      console.error('Triage error:', error);
      toast.error('Failed to analyze item');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [session]);

  // Process an image through the full cascade
  const processImage = useCallback(async (imageBase64: string) => {
    // First, perform sweep to detect objects
    const sweepResult = await sweep(imageBase64);
    if (!sweepResult || sweepResult.categories.length === 0) return null;

    // Check if any detected categories might be interesting
    const interestingCategories = sweepResult.categories.filter(cat => {
      // You can expand this logic based on your app's focus
      const valuable = ['watch', 'jewelry', 'art', 'collectible', 'antique', 'electronics'];
      return valuable.some(v => cat.toLowerCase().includes(v));
    });

    if (interestingCategories.length === 0) return null;

    // Perform triage on the most interesting category
    return await triage(imageBase64, interestingCategories[0]);
  }, [sweep, triage]);

  return {
    sweep,
    triage,
    processImage,
    isProcessing
  };
};