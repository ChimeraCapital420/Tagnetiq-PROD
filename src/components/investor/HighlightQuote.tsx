// FILE: src/components/investor/HighlightQuote.tsx (CREATE THIS NEW FILE)

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface QuoteData {
  quote: string;
  author: string;
  source: string;
}

export const HighlightQuote: React.FC = () => {
  const [data, setData] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const response = await fetch('/api/investor/highlight-quote');
        if (!response.ok) {
          // Don't throw an error for a 404, it just means no quote is set
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
  }, []);

  if (loading) {
    // Render a placeholder while loading to prevent layout shift
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
    // If no quote is active in the DB, render nothing
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