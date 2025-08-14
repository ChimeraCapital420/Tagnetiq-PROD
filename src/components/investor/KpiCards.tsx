import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUpRight, Users, Activity, Target } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, change, icon }) => (
  <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-white/80">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-green-400 flex items-center">
        <ArrowUpRight className="h-4 w-4 mr-1" />
        {change}
      </p>
    </CardContent>
  </Card>
);

// This component will display the main KPIs.
export const KpiCards: React.FC = () => {
  // In a real app, this data would come from the /api/investor/kpis endpoint
  const kpiData = [
    { title: 'Monthly Active Users', value: '1,234', change: '+12% this month', icon: <Users className="h-4 w-4 text-white/60" /> },
    { title: 'Daily Analyses', value: '5,678', change: '+5.2% today', icon: <Activity className="h-4 w-4 text-white/60" /> },
    { title: 'Activation Rate', value: '72.5%', change: '+1.8% this week', icon: <Target className="h-4 w-4 text-white/60" /> },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {kpiData.map(item => <KpiCard key={item.title} {...item} />)}
    </div>
  );
};