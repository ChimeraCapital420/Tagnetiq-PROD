import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';

interface Metrics {
  totalUsers: number;
  tam: { [key: string]: string };
  projections: { [key: string]: string };
}

const InvestorSuite: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/metrics');
        if (!response.ok) throw new Error('Failed to load metrics.');
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        toast.error('Failed to load investor metrics', { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto p-4 md:p-8 investor-suite-page">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-area, .printable-area * {
            visibility: visible;
          }
          .printable-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none;
          }
        }
      `}</style>
      <div className="printable-area space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Investor Suite Dashboard</h1>
            <p className="text-muted-foreground">Key metrics and growth projections for TagnetIQ.</p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="no-print">
            <Printer className="mr-2 h-4 w-4" />
            Export One-Pager
          </Button>
        </div>
        
        {loading ? <p>Loading metrics...</p> : (
            <div className="grid gap-8 md:grid-cols-2">
                <Card>
                    <CardHeader><CardTitle>Total Addressable Market (TAM)</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold space-y-2">
                        {metrics?.tam && Object.entries(metrics.tam).map(([key, value]) => (
                            <div key={key}>
                                <p>${value}</p>
                                <p className="text-sm font-normal text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Growth Projections</CardTitle></CardHeader>
                    <CardContent className="text-2xl font-bold space-y-2">
                        {metrics?.projections && Object.entries(metrics.projections).map(([key, value]) => (
                            <div key={key}>
                                <p>{value}</p>
                                <p className="text-sm font-normal text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        )}
      </div>
    </div>
  );
};

export default InvestorSuite;