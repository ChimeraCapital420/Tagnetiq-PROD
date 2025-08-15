// FILE: src/components/investor/LiveFeed.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rss } from 'lucide-react';

const sampleEvents = [
  "New user signed up from: San Francisco, CA",
  "Scan [Real Estate] completed in: Miami, FL",
  "Scan [Collectibles] completed in: Tokyo, JP",
  "Positive AI evaluation [BUY] on: Vintage Toy",
  "Feedback submission [UI/UX] received.",
  "New user signed up from: London, UK",
  "Scan [Vehicles] completed in: Dallas, TX",
  "Positive AI evaluation [BUY] on: Sports Memorabilia",
];

export const LiveFeed: React.FC = () => {
    const [eventIndex, setEventIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setEventIndex(prevIndex => (prevIndex + 1) % sampleEvents.length);
        }, 3500); // Change event every 3.5 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>Live Activity Feed</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <Rss className="h-6 w-6 text-primary" />
                    <div className="overflow-hidden">
                        <p className="whitespace-nowrap animate-fade-in">
                            {sampleEvents[eventIndex]}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};