// FILE: src/components/investor/LiveFeed.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AnimatePresence, motion } from 'framer-motion';
import { UserPlus, ShieldCheck, Trophy, Landmark, DollarSign } from 'lucide-react';

const eventIcons = {
    USER_SIGNUP: <UserPlus className="h-4 w-4 text-blue-400" />,
    ASSET_VAULTED: <ShieldCheck className="h-4 w-4 text-green-400" />,
    CHALLENGE_COMPLETED: <Trophy className="h-4 w-4 text-yellow-400" />,
    HIGH_VALUE_SCAN: <Landmark className="h-4 w-4 text-purple-400" />,
    ARENA_SALE: <DollarSign className="h-4 w-4 text-pink-400" />,
};

const formatEvent = (event: any) => {
    switch (event.type) {
        case 'USER_SIGNUP': return `New user joined from ${event.location}`;
        case 'ASSET_VAULTED': return `Asset Vaulted: ${event.asset}`;
        case 'CHALLENGE_COMPLETED': return `Challenge Completed: ${event.challenge}`;
        case 'HIGH_VALUE_SCAN': return `High-value scan in ${event.location}`;
        case 'ARENA_SALE': return `Arena Sale Completed: ${event.value}`;
        default: return 'New platform event';
    }
};

export const LiveFeed: React.FC = () => {
    const [feed, setFeed] = useState<any[]>([]);
    useEffect(() => {
        const fetchEvent = async () => {
            try {
                const response = await fetch('/api/investor/live-feed');
                if (!response.ok) return;
                const newEvent = await response.json();
                setFeed(prevFeed => [newEvent, ...prevFeed.slice(0, 4)]);
            } catch (error) {}
        };
        fetchEvent();
        const interval = setInterval(fetchEvent, 4000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Platform Live Feed</CardTitle>
                <CardDescription>Real-time stream of key platform events.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3 h-48 overflow-hidden">
                    <AnimatePresence>
                        {feed.map((event) => (
                            <motion.div
                                key={event.timestamp}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center gap-3"
                            >
                                <div className="p-2 bg-muted/50 rounded-full">
                                    {eventIcons[event.type as keyof typeof eventIcons]}
                                </div>
                                <p className="text-sm text-muted-foreground">{formatEvent(event)}</p>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </CardContent>
        </Card>
    );
};
