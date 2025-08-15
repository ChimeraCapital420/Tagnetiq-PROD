// FILE: src/pages/InvestorSuite.tsx

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { toast } from 'sonner';
import { KpiCards } from '@/components/investor/KpiCards';
import { FunnelChart } from '@/components/investor/FunnelChart';
import { DocsShelf } from '@/components/investor/DocsShelf';
import InvestorMap from '@/components/investor/InvestorMap';
import GrowthChart from '@/components/investor/GrowthChart';
import { BetaInsights } from '@/components/investor/BetaInsights';
import { MarketOpportunity } from '@/components/investor/MarketOpportunity';
import { KeyDifferentiators } from '@/components/investor/KeyDifferentiators';
import { ProductDemos } from '@/components/investor/ProductDemos';
import { LiveFeed } from '@/components/investor/LiveFeed';
import { CallToAction } from '@/components/investor/CallToAction';

interface Metrics {
  totalUsers: number;
  dau: number;
  totalScans: number;
  feedbackVolume: number;
  positiveAiEvaluations: number;
  growthData: { date: string; users: number; scans: number; }[];
  tam: { [key: string]: string };
  projections: { [key: string]: string };
}

const InvestorSuite: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/investor/metrics');
        if (!response.ok) {
          throw new Error('Failed to load investor metrics.');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        toast.error('Failed to load dashboard data', { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 investor-suite-page">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .printable-area, .printable-area * { visibility: visible; }
          .printable-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>
      <div className="printable-area max-w-7xl mx-auto space-y-8">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Investor Suite</h1>
            <p className="text-muted-foreground">Live metrics and documentation for TagnetIQ V9.0.2 Beta.</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button onClick={() => window.print()} variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Export One-Pager
            </Button>
          </div>
        </div>

        {loading ? (
            <div className="text-center p-8 text-muted-foreground">Loading Metrics...</div>
        ) : (
            <>
                <KpiCards data={metrics} />

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <InvestorMap />
                        {metrics?.growthData && <GrowthChart data={metrics.growthData} />}
                        <LiveFeed />
                    </div>
                    <div className="space-y-8">
                        <BetaInsights data={metrics} />
                        <FunnelChart />
                        <DocsShelf />
                    </div>
                </div>

                <MarketOpportunity data={metrics} />
                <KeyDifferentiators />
                <ProductDemos />
                <CallToAction />
            </>
        )}
      </div>
    </div>
  );
};

export default InvestorSuite;