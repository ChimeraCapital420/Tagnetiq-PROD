// FILE: src/pages/InvestorSuite.tsx (REPLACE ENTIRE FILE)

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
import { HighlightQuote } from '@/components/investor/HighlightQuote';
import { ArenaGrowthMetrics } from '@/components/investor/ArenaGrowthMetrics';
import { Separator } from '@/components/ui/separator';

// Expanded Metrics interface to include all necessary data points
interface Metrics {
  totalUsers: number;
  dau: number;
  totalScans: number;
  feedbackVolume: number;
  positiveAiEvaluations: number;
  growthData: { date: string; users: number; scans: number; }[];
  tam: { [key: string]: string };
  projections: { [key: string]: string };
  totalBetaInvites: number;
  totalBetaTesters: number;
  betaConversionRate: number;
}

const InvestorSuite: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    const fetchMetrics = async () => {
      // Don't set loading to true on refetch for a smoother UX
      if (!metrics) setLoading(true); 
      try {
        const response = await fetch(`/api/investor/metrics?days=${days}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to load investor metrics.');
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
  }, [days]);

  const funnelData = metrics ? [
    { name: 'Invited', value: metrics.totalBetaInvites, fill: '#8884d8' },
    { name: 'Activated', value: metrics.totalBetaTesters, fill: '#82ca9d' },
  ] : [];

  const growthChartActions = (
    <div className="flex gap-1">
        {[7, 30, 90].map(d => (
            <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
                {d}D
            </Button>
        ))}
    </div>
  );

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
            <p className="text-muted-foreground">Live metrics and documentation for TagnetIQ.</p>
          </div>
          <div className="flex items-center gap-2 no-print">
            <Button onClick={() => window.print()} variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Export One-Pager
            </Button>
          </div>
        </div>

        <HighlightQuote />

        {loading ? (
            <div className="text-center p-8 text-muted-foreground">Loading Core Metrics...</div>
        ) : (
            <>
                <KpiCards data={metrics} />
                <Separator className="my-8" />
                <ArenaGrowthMetrics />
                <Separator className="my-8" />

                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        <InvestorMap />
                        {metrics?.growthData && <GrowthChart data={metrics.growthData} actions={growthChartActions} />}
                        <LiveFeed />
                    </div>
                    <div className="space-y-8">
                        <BetaInsights data={metrics} />
                        <FunnelChart data={funnelData} />
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