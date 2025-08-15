// FILE: src/components/investor/BetaInsights.tsx

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, MessageSquare, Users } from 'lucide-react';
import AnimatedCounter from './AnimatedCounter';

interface BetaInsightsProps {
  data: {
    totalUsers: number;
    feedbackVolume: number;
    positiveAiEvaluations: number;
  } | null;
}

const InsightItem: React.FC<{ title: string; value: number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="flex items-start gap-4">
        <div className="bg-muted rounded-lg p-3">
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold">
                <AnimatedCounter value={value} />
            </p>
            <p className="text-sm text-muted-foreground">{title}</p>
        </div>
    </div>
);


export const BetaInsights: React.FC<BetaInsightsProps> = ({ data }) => {
  return (
    <Card>
        <CardHeader>
            <CardTitle>Beta Program Insights</CardTitle>
            <CardDescription>Key metrics demonstrating tester engagement and product validation.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
           <InsightItem
                title="Active Beta Testers"
                value={data?.totalUsers ?? 0}
                icon={<Users className="h-6 w-6 text-primary" />}
            />
            <InsightItem
                title="Feedback Submissions"
                value={data?.feedbackVolume ?? 0}
                icon={<MessageSquare className="h-6 w-6 text-primary" />}
            />
            <InsightItem
                title="Positive AI Evaluations"
                value={data?.positiveAiEvaluations ?? 0}
                icon={<CheckCircle className="h-6 w-6 text-primary" />}
            />
        </CardContent>
    </Card>
  );
};