// FILE: src/components/investor/InvestorMetricsDashboard.tsx
// Investor Metrics Dashboard - Real Data + Ghost Protocol KPIs
// Integrates with existing investor suite

import React, { useEffect, useState } from 'react';
import {
  Ghost, TrendingUp, Target, Map, Users, Activity,
  DollarSign, ArrowUpRight, ArrowDownRight, Database,
  RefreshCw, Building2, Package, Brain, Sparkles,
  UserPlus, Scan, Archive, ShoppingBag, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// =============================================================================
// TYPES
// =============================================================================

interface InvestorMetrics {
  // Core platform metrics
  totalUsers: number;
  dau: number;
  totalScans: number;
  totalVaults: number;
  totalListings: number;
  totalAnalyses: number;
  feedbackVolume: number;
  
  // Beta metrics
  totalBetaInvites: number;
  totalBetaTesters: number;
  betaConversionRate: number;
  
  // Growth data
  growthData: { date: string; users: number }[];
  
  // Ghost Protocol (may not exist if not deployed)
  ghostProtocol?: {
    enabled: boolean;
    darkInventory: {
      value: number;
      count: number;
      label: string;
      trend: number | null;
    };
    arbitrageSpread: {
      avgPercent: number;
      totalTransactions: number;
      totalRealizedProfit: number;
      label: string;
    };
    hydraAccuracy: {
      percent: number;
      trend: number;
      totalPredictions: number;
      label: string;
    };
    coverageVelocity: {
      storesMapped: number;
      weeklyDataPoints: number;
      regionsCovered: number;
      totalDataPoints: number;
      label: string;
    };
    scoutEconomics: {
      avgMonthlyProfit: number;
      activeScouts: number;
      retention90d: number | null;
      ltvCacRatio: number | null;
      label: string;
    };
    platformBreakdown: { platform: string; count: number }[];
  };
  
  // Market data
  tam: {
    total: string;
    serviceable: string;
    obtainable: string;
    note: string;
  };
  projections: {
    note: string;
    q4_2025: string;
    q1_2026: string;
  };
  
  // Meta
  generatedAt: string;
  periodDays: number;
  dataSource: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface InvestorMetricsDashboardProps {
  className?: string;
}

export const InvestorMetricsDashboard: React.FC<InvestorMetricsDashboardProps> = ({
  className,
}) => {
  const { session } = useAuth();
  const [metrics, setMetrics] = useState<InvestorMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch metrics
  const fetchMetrics = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/investor/metrics?days=30', {
        headers: session?.access_token 
          ? { Authorization: `Bearer ${session.access_token}` }
          : {},
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch metrics');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to fetch investor metrics:', err);
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [session]);

  // Format helpers
  const formatCurrency = (value: number, compact = false) => {
    if (compact && value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    if (compact && value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toLocaleString()}`;
  };

  const formatNumber = (value: number, compact = false) => {
    if (compact && value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (compact && value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
    return value.toLocaleString();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-zinc-800 rounded animate-pulse" />
          <div className="h-8 w-24 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-zinc-800 rounded animate-pulse mb-2" />
                <div className="h-3 w-32 bg-zinc-800 rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={cn('p-8 text-center', className)}>
        <p className="text-red-400 mb-4">{error}</p>
        <Button onClick={fetchMetrics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!metrics) return null;

  const ghost = metrics.ghostProtocol;
  const hasGhostData = ghost?.enabled && (
    ghost.darkInventory.count > 0 ||
    ghost.arbitrageSpread.totalTransactions > 0 ||
    ghost.coverageVelocity.storesMapped > 0
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Investor Dashboard
          </h2>
          <p className="text-sm text-muted-foreground">
            Real-time platform metrics • {metrics.dataSource}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {new Date(metrics.generatedAt).toLocaleTimeString()}
          </Badge>
          <Button variant="outline" size="sm" onClick={fetchMetrics}>
            <RefreshCw className={cn('h-4 w-4 mr-1', isLoading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-zinc-900/50">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="ghost" disabled={!ghost?.enabled}>
            <Ghost className="h-4 w-4 mr-2" />
            Ghost Protocol
            {!ghost?.enabled && (
              <Badge variant="outline" className="ml-2 text-[10px]">Coming Soon</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="market">
            <TrendingUp className="h-4 w-4 mr-2" />
            Market
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* OVERVIEW TAB - Core Platform Metrics */}
        {/* ================================================================ */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Core Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-400" />
                  Total Users
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(metrics.totalUsers)}</div>
                <p className="text-xs text-muted-foreground">
                  {metrics.dau} active today
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Scan className="h-4 w-4 text-emerald-400" />
                  Total Scans
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(metrics.totalScans)}</div>
                <p className="text-xs text-muted-foreground">
                  Items analyzed
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Archive className="h-4 w-4 text-purple-400" />
                  Vaults Created
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(metrics.totalVaults)}</div>
                <p className="text-xs text-muted-foreground">
                  Collections organized
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4 text-orange-400" />
                  Arena Listings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatNumber(metrics.totalListings)}</div>
                <p className="text-xs text-muted-foreground">
                  Marketplace items
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4 text-pink-400" />
                  AI Analyses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(metrics.totalAnalyses)}</div>
                <p className="text-xs text-muted-foreground">
                  HYDRA consensus results
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-cyan-400" />
                  Beta Invites
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(metrics.totalBetaInvites)}</div>
                <p className="text-xs text-muted-foreground">
                  Invitations sent
                </p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Database className="h-4 w-4 text-yellow-400" />
                  Feedback Volume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(metrics.feedbackVolume)}</div>
                <p className="text-xs text-muted-foreground">
                  User submissions
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ================================================================ */}
        {/* GHOST PROTOCOL TAB - The 5 "Write the Check" Metrics */}
        {/* ================================================================ */}
        <TabsContent value="ghost" className="space-y-6 mt-6">
          {!ghost?.enabled ? (
            <Card className="bg-zinc-900/50 border-zinc-800 p-8 text-center">
              <Ghost className="h-12 w-12 mx-auto text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Ghost Protocol Coming Soon</h3>
              <p className="text-sm text-muted-foreground">
                Run the database migration to enable Ghost Protocol metrics.
              </p>
            </Card>
          ) : !hasGhostData ? (
            <Card className="bg-zinc-900/50 border-zinc-800 p-8 text-center">
              <Ghost className="h-12 w-12 mx-auto text-purple-400 mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">No Ghost Data Yet</h3>
              <p className="text-sm text-muted-foreground">
                Ghost Protocol is enabled but no scouts have completed ghost hunts yet.
              </p>
            </Card>
          ) : (
            <>
              {/* The 5 "Write the Check" Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                
                {/* 1. DARK INVENTORY INDEX */}
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/20 md:col-span-2 lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Ghost className="h-4 w-4 text-purple-400" />
                      Dark Inventory Index™
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ghost.darkInventory.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-4xl font-bold text-purple-400">
                      {formatCurrency(ghost.darkInventory.value, true)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatNumber(ghost.darkInventory.count)} items discovered
                    </p>
                    <div className="mt-4 p-2 rounded bg-purple-500/10 border border-purple-500/20">
                      <p className="text-[10px] text-purple-300">
                        💡 Assets that don't exist online yet
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* 2. ARBITRAGE SPREAD */}
                <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-400" />
                      Arbitrage Spread
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ghost.arbitrageSpread.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-emerald-400">
                        {ghost.arbitrageSpread.avgPercent}%
                      </span>
                      <span className="text-sm text-muted-foreground mb-1">avg</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatNumber(ghost.arbitrageSpread.totalTransactions)} transactions
                    </p>
                    <Separator className="my-3 bg-zinc-800" />
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Realized Profit</span>
                      <span className="font-mono text-emerald-400">
                        {formatCurrency(ghost.arbitrageSpread.totalRealizedProfit, true)}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* 3. HYDRA ACCURACY */}
                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-blue-400" />
                      HYDRA Accuracy
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ghost.hydraAccuracy.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-bold text-blue-400">
                        {ghost.hydraAccuracy.percent}%
                      </span>
                      {ghost.hydraAccuracy.trend !== 0 && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'mb-1',
                            ghost.hydraAccuracy.trend >= 0 
                              ? 'border-emerald-500/50 text-emerald-400'
                              : 'border-red-500/50 text-red-400'
                          )}
                        >
                          {ghost.hydraAccuracy.trend >= 0 ? (
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          )}
                          {Math.abs(ghost.hydraAccuracy.trend)}%
                        </Badge>
                      )}
                    </div>
                    <Progress 
                      value={ghost.hydraAccuracy.percent} 
                      className="h-1.5 mt-3 bg-zinc-800"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatNumber(ghost.hydraAccuracy.totalPredictions)} predictions
                    </p>
                  </CardContent>
                </Card>

                {/* 4. COVERAGE VELOCITY */}
                <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Map className="h-4 w-4 text-orange-400" />
                      Coverage Velocity
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ghost.coverageVelocity.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-2xl font-bold text-orange-400">
                          {formatNumber(ghost.coverageVelocity.storesMapped, true)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">stores</p>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-orange-400">
                          {formatNumber(ghost.coverageVelocity.weeklyDataPoints, true)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">pts/week</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {ghost.coverageVelocity.regionsCovered} regions covered
                    </p>
                  </CardContent>
                </Card>

                {/* 5. SCOUT ECONOMICS */}
                <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/10 border-pink-500/20 md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-pink-400" />
                      Scout Economics
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {ghost.scoutEconomics.label}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <span className="text-2xl font-bold text-pink-400">
                          ${ghost.scoutEconomics.avgMonthlyProfit.toFixed(0)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">avg profit</p>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-pink-400">
                          {formatNumber(ghost.scoutEconomics.activeScouts)}
                        </span>
                        <p className="text-[10px] text-muted-foreground">active scouts</p>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-pink-400">
                          {ghost.scoutEconomics.retention90d ?? '—'}%
                        </span>
                        <p className="text-[10px] text-muted-foreground">retention</p>
                      </div>
                    </div>
                    <div className="mt-4 p-3 rounded bg-pink-500/10 border border-pink-500/20">
                      <p className="text-xs text-pink-300">
                        🎯 Scouts earn real money. Every scan = proprietary data.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Platform Breakdown */}
              {ghost.platformBreakdown.length > 0 && (
                <Card className="bg-zinc-900/50 border-zinc-800">
                  <CardHeader>
                    <CardTitle className="text-sm">Platform Distribution</CardTitle>
                    <CardDescription className="text-xs">Where ghost items sold</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {ghost.platformBreakdown.map((p) => (
                        <Badge key={p.platform} variant="secondary">
                          {p.platform}: {p.count}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ================================================================ */}
        {/* MARKET TAB */}
        {/* ================================================================ */}
        <TabsContent value="market" className="space-y-6 mt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm">Total Addressable Market</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">TAM</span>
                  <span className="text-xl font-bold">{metrics.tam.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SAM</span>
                  <span className="text-lg font-semibold">{metrics.tam.serviceable}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SOM</span>
                  <span className="text-lg font-semibold text-primary">{metrics.tam.obtainable}</span>
                </div>
                <p className="text-xs text-muted-foreground">{metrics.tam.note}</p>
              </CardContent>
            </Card>

            <Card className="bg-zinc-900/50 border-zinc-800">
              <CardHeader>
                <CardTitle className="text-sm">Revenue Projections</CardTitle>
                <CardDescription className="text-xs">{metrics.projections.note}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Q4 2025</span>
                  <span className="text-lg font-semibold">{metrics.projections.q4_2025}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Q1 2026</span>
                  <span className="text-xl font-bold text-emerald-400">{metrics.projections.q1_2026}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* The Moat */}
          <Card className="bg-zinc-900/30 border-zinc-800">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">The Data Moat</h3>
                  <p className="text-sm text-muted-foreground">
                    Every ghost scan creates a data point that doesn't exist anywhere else. 
                    We're building the <strong>Waze for thrift stores</strong> meets{' '}
                    <strong>Bloomberg for collectibles</strong>. Google can't crawl this. 
                    Amazon doesn't have it. No one else is capturing this data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InvestorMetricsDashboard;