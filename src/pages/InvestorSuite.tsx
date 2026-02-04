import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Ghost, TrendingUp, Brain, Map, Users } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

// Expanded Metrics interface to include Ghost Protocol data
interface GhostProtocolMetrics {
  enabled: boolean;
  darkInventory: { value: number; count: number };
  arbitrageSpread: { avgPercent: number; totalTransactions: number; totalRealizedProfit: number };
  hydraAccuracy: { percent: number; trend: number; totalPredictions: number };
  coverageVelocity: { storesMapped: number; weeklyDataPoints: number; regionsCovered: number; totalDataPoints: number };
  scoutEconomics: { avgMonthlyProfit: number; activeScouts: number };
  platformBreakdown: { platform: string; count: number }[];
}

interface Metrics {
  totalUsers: number;
  dau: number;
  totalScans: number;
  feedbackVolume: number;
  positiveAiEvaluations: number;
  growthData: { date: string; users: number; scans?: number }[];
  tam: { [key: string]: string };
  projections: { [key: string]: string };
  totalBetaInvites: number;
  totalBetaTesters: number;
  betaConversionRate: number;
  ghostProtocol?: GhostProtocolMetrics;
}

// Ghost Protocol Section Component
const GhostProtocolSection: React.FC<{ data: GhostProtocolMetrics | undefined }> = ({ data }) => {
  if (!data?.enabled) {
    return (
      <Card className="bg-purple-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-400" />
            Ghost Protocol
            <Badge variant="outline" className="ml-2 text-xs">Coming Soon</Badge>
          </CardTitle>
          <CardDescription>
            Pre-internet inventory discovery system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ghost Protocol enables scouts to create virtual listings for items they discover 
            but don't yet own. Run the database migration to enable.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasData = data.darkInventory.count > 0 || data.arbitrageSpread.totalTransactions > 0;

  if (!hasData) {
    return (
      <Card className="bg-purple-500/5 border-purple-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ghost className="h-5 w-5 text-purple-400" />
            Ghost Protocol
            <Badge className="ml-2 text-xs bg-purple-500">Active</Badge>
          </CardTitle>
          <CardDescription>
            Pre-internet inventory discovery system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ghost Protocol is enabled but no data yet. Scouts will start discovering dark inventory soon.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
    return value.toLocaleString();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Ghost className="h-6 w-6 text-purple-400" />
        <h2 className="text-xl font-bold">Ghost Protocol</h2>
        <Badge className="bg-purple-500">Live</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        The 5 investor metrics that prove the data moat
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Dark Inventory Index */}
        <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Ghost className="h-4 w-4 text-purple-400" />
              Dark Inventory Index™
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">
              {formatCurrency(data.darkInventory.value)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(data.darkInventory.count)} items not online yet
            </p>
          </CardContent>
        </Card>

        {/* Arbitrage Spread */}
        <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              Arbitrage Spread
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">
              {data.arbitrageSpread.avgPercent}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              avg markup • {formatNumber(data.arbitrageSpread.totalTransactions)} transactions
            </p>
          </CardContent>
        </Card>

        {/* HYDRA Accuracy */}
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Brain className="h-4 w-4 text-blue-400" />
              HYDRA Accuracy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-400">
              {data.hydraAccuracy.percent}%
            </div>
            <Progress value={data.hydraAccuracy.percent} className="h-1.5 mt-2 bg-zinc-800" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(data.hydraAccuracy.totalPredictions)} predictions
            </p>
          </CardContent>
        </Card>

        {/* Coverage Velocity */}
        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Map className="h-4 w-4 text-orange-400" />
              Coverage Velocity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-orange-400">
                {formatNumber(data.coverageVelocity.storesMapped)}
              </span>
              <span className="text-sm text-muted-foreground">stores</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(data.coverageVelocity.weeklyDataPoints)} pts/week • {data.coverageVelocity.regionsCovered} regions
            </p>
          </CardContent>
        </Card>

        {/* Scout Economics */}
        <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/20 md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-pink-400" />
              Scout Economics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <span className="text-2xl font-bold text-pink-400">
                  ${data.scoutEconomics.avgMonthlyProfit.toFixed(0)}
                </span>
                <p className="text-xs text-muted-foreground">avg profit</p>
              </div>
              <div>
                <span className="text-2xl font-bold text-pink-400">
                  {formatNumber(data.scoutEconomics.activeScouts)}
                </span>
                <p className="text-xs text-muted-foreground">active scouts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Distribution */}
      {data.platformBreakdown.length > 0 && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Platform Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.platformBreakdown.map((p) => (
                <Badge key={p.platform} variant="secondary">
                  {p.platform}: {p.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* The Moat */}
      <Card className="bg-zinc-900/30 border-zinc-800">
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">The Data Moat:</strong> Every ghost scan creates 
            a data point that doesn't exist anywhere else. We're building{' '}
            <strong>Waze for thrift stores</strong> meets{' '}
            <strong>Bloomberg for collectibles</strong>. Google can't crawl this.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const InvestorSuite: React.FC = () => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    const fetchMetrics = async () => {
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

                {/* NEW: Ghost Protocol Section */}
                <GhostProtocolSection data={metrics?.ghostProtocol} />
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