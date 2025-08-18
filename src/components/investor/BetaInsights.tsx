// FILE: src/components/investor/BetaInsights.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Mail, CheckCircle } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter'; // Corrected: Import without curly braces for a default export
import { SentimentChart } from './SentimentChart';
import { Separator } from '@/components/ui/separator';
import { TopFeatures } from './TopFeatures';

interface BetaInsightsProps {
  data: {
    totalBetaTesters: number;
    feedbackVolume: number;
    betaConversionRate: number;
    totalBetaInvites: number;
  } | null;
}

export const BetaInsights: React.FC<BetaInsightsProps> = ({ data }) => {
  const testers = data?.totalBetaTesters ?? 0;
  const feedback = data?.feedbackVolume ?? 0;
  const conversionRate = data?.betaConversionRate ?? 0;
  const engagementRate = testers > 0 ? (feedback / testers) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Beta Program Insights</CardTitle>
        <CardDescription>Key metrics & insights from the ongoing beta test.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <Users className="mx-auto h-6 w-6 text-primary" />
            <p className="text-2xl font-bold"><AnimatedCounter value={testers} /></p>
            <p className="text-xs text-muted-foreground">Active Testers</p>
          </div>
          <div>
            <Mail className="mx-auto h-6 w-6 text-primary" />
            <p className="text-2xl font-bold"><AnimatedCounter value={data?.totalBetaInvites ?? 0} /></p>
            <p className="text-xs text-muted-foreground">Invites Sent</p>
          </div>
          <div>
            <CheckCircle className="mx-auto h-6 w-6 text-green-500" />
            <p className="text-2xl font-bold"><AnimatedCounter value={parseFloat(conversionRate.toFixed(1))} />%</p>
            <p className="text-xs text-muted-foreground">Conversion Rate</p>
          </div>
          <div>
            <CheckCircle className="mx-auto h-6 w-6 text-green-500" />
            <p className="text-2xl font-bold"><AnimatedCounter value={parseFloat(engagementRate.toFixed(1))} />%</p>
            <p className="text-xs text-muted-foreground">Engagement Rate</p>
          </div>
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-medium text-center mb-2">Feedback Sentiment</h4>
          <SentimentChart />
        </div>

        <Separator />
        <div>
          <h4 className="text-sm font-medium text-center mb-2">Top Requested Features</h4>
          <TopFeatures />
        </div>

      </CardContent>
    </Card>
  );
};