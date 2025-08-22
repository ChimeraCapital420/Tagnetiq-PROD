// FILE: src/components/investor/TopFeatures.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export const TopFeatures: React.FC = () => {
    const [features, setFeatures] = useState<{ feature: string, votes: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const response = await fetch('/api/investor/top-features');
                if (!response.ok) throw new Error('Failed to fetch top features');
                setFeatures(await response.json());
            } catch (error) {
                toast.error("Top Features Error", { description: (error as Error).message });
            } finally {
                setLoading(false);
            }
        };
        fetchFeatures();
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Top Feature Requests</CardTitle>
                    <CardDescription>Direct feedback from our beta user base.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
                            <div className="h-2.5 bg-muted rounded-full w-full animate-pulse"></div>
                        </div>
                    ))}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Top Feature Requests</CardTitle>
                <CardDescription>Direct feedback from our beta user base.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {features.map((item, index) => (
                        <div key={index}>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="font-medium">{item.feature}</span>
                                <span className="text-muted-foreground">{item.votes} votes</span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2.5">
                                <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(item.votes / (features[0]?.votes || 1)) * 100}%` }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
