import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface KpiData {
  totalTesters: number;
  invitesSent: number;
  activationRate: string;
}

export const AdminAnalytics: React.FC = () => {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const response = await fetch('/api/beta/kpis');
        if (!response.ok) {
          throw new Error('Failed to fetch KPI data from the server.');
        }
        const data = await response.json();
        setKpis(data);
      } catch (error) {
        toast.error('Could not load analytics', { description: (error as Error).message });
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
                <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Loading...</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 w-1/2 bg-muted rounded animate-pulse"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Testers</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis?.totalTesters ?? 'N/A'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Invites Sent</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis?.invitesSent ?? 'N/A'}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Activation Rate</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis?.activationRate ?? 'N/A'}</div>
        </CardContent>
      </Card>
    </div>
  );
};