// FILE: src/components/investor/PartnershipFunnel.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Handshake, Target, Users, Percent } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

interface PartnershipKpis {
  total_opportunities: number;
  new_opportunities: number;
  monetized_partners: number;
  conversion_rate: number;
}

const KpiCard: React.FC<{ title: string; value: number; icon: React.ReactNode; suffix?: string }> = ({ title, value, icon, suffix = '' }) => (
  <div className="bg-muted/50 p-4 rounded-lg">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
    </div>
    <p className="text-2xl font-bold text-primary">
      <AnimatedCounter value={value} />{suffix}
    </p>
  </div>
);

export const PartnershipFunnel: React.FC = () => {
  const [kpis, setKpis] = useState<PartnershipKpis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const response = await fetch('/api/investor/partnership-kpis');
        if (!response.ok) throw new Error('Failed to fetch partnership KPIs');
        const data = await response.json();
        setKpis(data);
      } catch (error) {
        toast.error("Partnership KPI Error", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };
    fetchKpis();
  }, []);

  if (loading) {
    return <div className="h-48 w-full animate-pulse bg-muted rounded-lg" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partnership Funnel</CardTitle>
        <CardDescription>Metrics on our marketplace partnership ecosystem.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <KpiCard title="Total Opportunities" value={kpis?.total_opportunities ?? 0} icon={<Users className="h-4 w-4" />} />
        <KpiCard title="New (30d)" value={kpis?.new_opportunities ?? 0} icon={<Target className="h-4 w-4" />} />
        <KpiCard title="Monetized Partners" value={kpis?.monetized_partners ?? 0} icon={<Handshake className="h-4 w-4" />} />
        <KpiCard title="Conversion Rate" value={kpis?.conversion_rate ?? 0} icon={<Percent className="h-4 w-4" />} suffix="%" />
      </CardContent>
    </Card>
  );
};