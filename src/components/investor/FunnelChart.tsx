// FILE: src/components/investor/FunnelChart.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface FunnelData {
  name: string;
  value: number;
  fill: string;
}

export const FunnelChart: React.FC = () => {
  const [data, setData] = useState<FunnelData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFunnelData = async () => {
      setLoading(true);
      try {
        // This is a placeholder for a future API endpoint.
        // In a real scenario, you would fetch this data.
        await new Promise(resolve => setTimeout(resolve, 1500));
        const mockData = [
          { name: 'App Installs', value: 10000, fill: 'hsl(var(--chart-1))' },
          { name: 'Sign Ups', value: 7500, fill: 'hsl(var(--chart-2))' },
          { name: 'First Scan', value: 6000, fill: 'hsl(var(--chart-3))' },
          { name: 'Vault Entry', value: 2500, fill: 'hsl(var(--chart-4))' },
          { name: 'Arena Engagement', value: 1500, fill: 'hsl(var(--chart-5))' },
        ];
        setData(mockData);
      } catch (error) {
        toast.error("Could not load funnel data.");
      } finally {
        setLoading(false);
      }
    };
    fetchFunnelData();
  }, []);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>User Acquisition Funnel</CardTitle>
                <CardDescription>From initial install to core feature engagement.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="h-80 w-full animate-pulse bg-muted rounded-lg" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Acquisition Funnel</CardTitle>
        <CardDescription>From initial install to core feature engagement.</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <BarChart
              layout="vertical"
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'hsla(var(--muted) / 0.5)' }} contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }} />
              <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                <LabelList dataKey="value" position="right" style={{ fill: 'hsl(var(--foreground))' }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
