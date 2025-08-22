// FILE: src/components/investor/KpiCards.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, ScanLine } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';
import { toast } from 'sonner';

interface KpiData {
  totalUsers: number;
  dau: number;
  totalScans: number;
}

const KpiCard: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <Card className="bg-background/50 border-border/50 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        <AnimatedCounter value={value} />
      </div>
    </CardContent>
  </Card>
);

export const KpiCards: React.FC = () => {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const response = await fetch('/api/investor/kpis');
        if (!response.ok) {
          throw new Error('Failed to fetch core KPIs');
        }
        const kpiData = await response.json();
        setData(kpiData);
      } catch (error) {
        toast.error("Core KPI Error", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  if (loading) {
    return (
        <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
                <Card key={i} className="bg-background/50 border-border/50 backdrop-blur-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 bg-muted rounded w-1/2 animate-pulse"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }

  const kpiMetrics = [
    { title: 'Total Registered Users', value: data?.totalUsers ?? 0, icon: <Users className="h-4 w-4 text-muted-foreground" /> },
    { title: 'Daily Active Users (DAU)', value: data?.dau ?? 0, icon: <Activity className="h-4 w-4 text-muted-foreground" /> },
    { title: 'Total Scans Completed', value: data?.totalScans ?? 0, icon: <ScanLine className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {kpiMetrics.map(item => <KpiCard key={item.title} {...item} />)}
    </div>
  );
};
