// FILE: src/components/investor/GrowthChart.tsx

import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface GrowthChartProps {
  data: {
    date: string;
    users: number;
    scans: number;
  }[];
  // Add an optional 'actions' prop to accept our filter buttons
  actions?: React.ReactNode; 
}

const GrowthChart: React.FC<GrowthChartProps> = ({ data, actions }) => {
  return (
    <Card>
        {/* Update the CardHeader to conditionally render the actions */}
        <CardHeader className="flex flex-row justify-between items-center">
            <div>
                <CardTitle>Growth Timeline</CardTitle>
                <CardDescription>User acquisition and scan activity.</CardDescription>
            </div>
            {actions && <div className="no-print">{actions}</div>}
        </CardHeader>
        <CardContent>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))'
                            }}
                        />
                        <Area type="monotone" dataKey="users" stroke="#8884d8" fillOpacity={1} fill="url(#colorUsers)" />
                        <Area type="monotone" dataKey="scans" stroke="#82ca9d" fillOpacity={1} fill="url(#colorScans)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </CardContent>
    </Card>
  );
};

export default GrowthChart;