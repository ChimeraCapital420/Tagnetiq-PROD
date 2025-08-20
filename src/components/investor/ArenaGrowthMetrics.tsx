// FILE: src/components/investor/ArenaGrowthMetrics.tsx (CREATE THIS NEW FILE)

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Users, BarChart2, MessageCircle, ShieldCheck, Sword, Store, BellRing } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

// Define the structure of the data we expect from our new API endpoint
interface ArenaMetrics {
  userEngagement: { dau: number; mau: number };
  contentVelocity: { newChallengesToday: number; newListingsToday: number };
  socialInteraction: { newConversationsToday: number; alertsTriggeredToday: number };
  ecosystemHealth: { totalActiveChallenges: number };
}

// A reusable KPI card component for a consistent look
const KpiCard: React.FC<{ title: string; value: number; icon: React.ReactNode; description: string }> = ({ title, value, icon, description }) => (
  <div className="bg-muted/50 p-4 rounded-lg text-center">
    <div className="flex items-center justify-center gap-2">
      {icon}
      <p className="text-xs uppercase text-muted-foreground">{title}</p>
    </div>
    <p className="text-3xl font-bold text-primary mt-1">
      <AnimatedCounter value={value} />
    </p>
    <p className="text-xs text-muted-foreground">{description}</p>
  </div>
);

export const ArenaGrowthMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<ArenaMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArenaMetrics = async () => {
      try {
        const response = await fetch('/api/investor/arena-metrics');
        if (!response.ok) {
          throw new Error('Failed to fetch Arena metrics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        toast.error("Arena Metrics Error", { description: (error as Error).message });
      } finally {
        setLoading(false);
      }
    };

    fetchArenaMetrics();
    // Refresh the data every 30 seconds to keep it near real-time
    const interval = setInterval(fetchArenaMetrics, 30000); 

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  if (loading) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Arena Growth Metrics</CardTitle>
                <CardDescription>Real-time ecosystem health and user engagement.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-48 w-full animate-pulse bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground">Loading Mission Control...</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  if (!metrics) {
    return null; // Don't render the card if there was an error fetching data
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Arena Growth Metrics</CardTitle>
        <CardDescription>Real-time ecosystem health and user engagement.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-2 text-center text-sm uppercase tracking-wider text-muted-foreground">User Engagement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KpiCard title="Daily Active Users" value={metrics.userEngagement.dau} icon={<Users className="h-4 w-4" />} description="Users active in last 24h" />
            <KpiCard title="Monthly Active Users" value={metrics.userEngagement.mau} icon={<BarChart2 className="h-4 w-4" />} description="Users active in last 30d" />
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-2 text-center text-sm uppercase tracking-wider text-muted-foreground">Content & Social Velocity</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="New Challenges" value={metrics.contentVelocity.newChallengesToday} icon={<Sword className="h-4 w-4" />} description="Started Today" />
            <KpiCard title="New Listings" value={metrics.contentVelocity.newListingsToday} icon={<Store className="h-4 w-4" />} description="Created Today" />
            <KpiCard title="New Chats" value={metrics.socialInteraction.newConversationsToday} icon={<MessageCircle className="h-4 w-4" />} description="Started Today" />
            <KpiCard title="Alerts" value={metrics.socialInteraction.alertsTriggeredToday} icon={<BellRing className="h-4 w-4" />} description="Triggered Today" />
          </div>
        </div>
        
        <div>
            <h3 className="font-semibold mb-2 text-center text-sm uppercase tracking-wider text-muted-foreground">Ecosystem Health</h3>
            <div className="grid grid-cols-1">
                 <KpiCard title="Total Active Challenges" value={metrics.ecosystemHealth.totalActiveChallenges} icon={<ShieldCheck className="h-4 w-4" />} description="Ongoing community engagement" />
            </div>
        </div>

      </CardContent>
    </Card>
  );
};