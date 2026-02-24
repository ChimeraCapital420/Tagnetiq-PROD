// FILE: src/components/investor/HighlightQuote.tsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { investorFetch } from '@/lib/investorFetch';

interface QuoteData {
  quote: string;
  author: string;
  source: string;
}

export const HighlightQuote: React.FC = () => {
  const { session } = useAuth();
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await investorFetch('/api/investor/highlight-quote', session);
        if (!response.ok) {
          if (response.status === 404) {
            setData(null);
            return;
          }
          throw new Error('Failed to fetch highlight quote.');
        }
        const result = await response.json();
        setData(result);
      } catch (error) {
        toast.error("Could not load highlight quote.", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [session]);

  if (loading) {
    return (
        <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-3/4 animate-pulse"></div>
                <div className="h-4 bg-muted rounded w-1/4 mt-4 animate-pulse"></div>
            </CardContent>
        </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card className="bg-primary/10 border-primary/20">
        <CardContent className="p-6">
            <blockquote className="text-xl font-semibold italic text-foreground">
                "{data.quote}"
            </blockquote>
            <p className="text-right mt-4 text-sm text-muted-foreground">— {data.author}, <span className="font-medium">{data.source}</span></p>
        </CardContent>
    </Card>
  );
};