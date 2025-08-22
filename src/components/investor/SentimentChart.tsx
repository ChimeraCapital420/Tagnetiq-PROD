// FILE: src/components/investor/SentimentChart.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export const SentimentChart: React.FC = () => {
    const [data, setData] = useState([]);
    useEffect(() => {
        const fetchSentiment = async () => {
            try {
                const response = await fetch('/api/investor/sentiment');
                if (!response.ok) throw new Error('Failed to fetch sentiment data');
                const sentimentData = await response.json();
                setData(sentimentData);
            } catch (error) {
                toast.error("Sentiment Data Error", { description: (error as Error).message });
            }
        };
        fetchSentiment();
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Beta Tester Sentiment</CardTitle>
                <CardDescription>Analysis of real-time user feedback.</CardDescription>
            </CardHeader>
            <CardContent>
                 <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                                {(data as any[]).map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};
