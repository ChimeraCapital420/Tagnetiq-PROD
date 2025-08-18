// FILE: src/components/investor/FunnelChart.tsx

import React from 'react';
import { ResponsiveContainer, FunnelChart as RechartsFunnelChart, Funnel, Tooltip, LabelList } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Define the shape of the data we expect
interface FunnelChartProps {
  data: {
    name: string;
    value: number;
    fill: string;
  }[];
}

export const FunnelChart: React.FC<FunnelChartProps> = ({ data }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Beta Conversion Funnel</CardTitle>
        <CardDescription>From invite to active tester.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsFunnelChart>
              <Tooltip />
              <Funnel
                dataKey="value"
                data={data}
                isAnimationActive
              >
                <LabelList position="right" fill="#fff" stroke="none" dataKey="name" />
              </Funnel>
            </RechartsFunnelChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};