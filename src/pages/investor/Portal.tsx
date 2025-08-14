import React, { useEffect, useState } from 'react';
import { getInvestorToken } from '@/lib/investorAuth';
import { trackEvent } from '@/lib/analytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, Users, Activity, Target } from 'lucide-react';
import { themes } from '@/lib/themes';

interface KpiData {
    totalUsers: number;
    monthlyAnalyses: number;
    simulatedARR: number;
    wowUserGrowth: number;
}

const InvestorPortal: React.FC = () => {
  const [token, setToken] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const foundToken = getInvestorToken();
    setToken(foundToken);
    
    if (foundToken) {
      trackEvent('portal_view');
      
      const fetchKpis = async () => {
        try {
          const response = await fetch(`/api/investor/kpis?token=${foundToken}`);
          if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to load data.');
          }
          const data = await response.json();
          setKpis(data);
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchKpis();

    } else {
      setIsLoading(false);
      setError('Access Denied. This page is accessible only via a valid invitation link.');
    }
  }, []);

  const pageStyle: React.CSSProperties = {
    backgroundColor: themes.executive.dark.colors.background,
    minHeight: '100vh',
  };

  if (isLoading) {
    return <div style={pageStyle} className="flex items-center justify-center"><p className="text-white">Loading Secure Investor Portal...</p></div>;
  }

  if (error) {
    return (
      <div style={pageStyle} className="flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold">Access Error</h1>
          <p className="mt-2 text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <header className="p-4 border-b border-white/10">
        <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
                <img src="/logo.jpg" alt="TagnetIQ Logo" className="h-8 w-8 rounded-full" />
                <span className="text-lg font-bold text-white">TagnetIQ Investor Suite</span>
            </div>
            <Badge variant="outline" className="text-white border-white/50">v9.0.2 Beta</Badge>
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8 space-y-8">
        <Card className="bg-transparent border-none text-white">
          <CardHeader>
            <CardTitle className="text-3xl">Key Performance Indicators</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
             <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/80">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpis?.totalUsers.toLocaleString() ?? 'N/A'}</div>
                    <p className="text-xs text-green-400 flex items-center"><ArrowUpRight className="h-4 w-4 mr-1" />{kpis?.wowUserGrowth}% this week</p>
                </CardContent>
            </Card>
             <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/80">Analyses (30d)</CardTitle>
                    <Activity className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{kpis?.monthlyAnalyses.toLocaleString() ?? 'N/A'}</div>
                </CardContent>
            </Card>
             <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-white/80">Simulated ARR</CardTitle>
                    <Target className="h-4 w-4 text-white/60" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${kpis?.simulatedARR.toLocaleString() ?? 'N/A'}</div>
                </CardContent>
            </Card>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default InvestorPortal;