// FILE: src/components/investor/KpiCards.tsx

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Activity, ScanLine } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

interface KpiData {
  totalUsers: number;
  dau: number;
  totalScans: number;
}

interface KpiCardsProps {
  data: KpiData | null;
}

const KpiCard: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-white/80">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">
        <AnimatedCounter value={value} />
      </div>
    </CardContent>
  </Card>
);

export const KpiCards: React.FC<KpiCardsProps> = ({ data }) => {
  const kpiMetrics = [
    { title: 'Total Registered Users', value: data?.totalUsers ?? 0, icon: <Users className="h-4 w-4 text-white/60" /> },
    { title: 'Daily Active Users (DAU)', value: data?.dau ?? 0, icon: <Activity className="h-4 w-4 text-white/60" /> },
    { title: 'Total Scans Completed', value: data?.totalScans ?? 0, icon: <ScanLine className="h-4 w-4 text-white/60" /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {kpiMetrics.map(item => <KpiCard key={item.title} {...item} />)}
    </div>
  );
};