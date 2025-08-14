import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// A simple, visual representation of the user acquisition funnel.
export const FunnelChart: React.FC = () => {
    // In a real app, this data would come from the API
    const funnelData = [
        { stage: 'Portal Visits', value: 100, color: 'bg-blue-500' },
        { stage: 'Sign-ups', value: 45, color: 'bg-purple-500' },
        { stage: 'Activated Users', value: 32, color: 'bg-green-500' },
        { stage: 'D7 Retained', value: 25, color: 'bg-yellow-500' },
    ];

    return (
        <Card className="bg-white/5 border-white/10 text-white backdrop-blur-sm">
            <CardHeader>
                <CardTitle>Acquisition Funnel</CardTitle>
                <CardDescription className="text-white/70">From initial visit to 7-day retention.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {funnelData.map(item => (
                        <div key={item.stage}>
                            <div className="flex justify-between text-sm mb-1">
                                <span>{item.stage}</span>
                                <span>{item.value}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2.5">
                                <div className={`${item.color} h-2.5 rounded-full`} style={{ width: `${item.value}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};