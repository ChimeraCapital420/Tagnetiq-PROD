// FILE: src/components/investor/LiveFeed.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Zap, UserPlus, MessageSquare, ScanLine } from 'lucide-react';

interface FeedEvent {
  type: 'signup' | 'scan' | 'feedback';
  description: string;
  timeAgo: string;
}

// Helper to get an icon based on the event type
const getEventIcon = (type: FeedEvent['type']) => {
  switch (type) {
    case 'signup':
      return <UserPlus className="h-5 w-5 text-blue-500" />;
    case 'scan':
      return <ScanLine className="h-5 w-5 text-green-500" />;
    case 'feedback':
      return <MessageSquare className="h-5 w-5 text-purple-500" />;
    default:
      return <Zap className="h-5 w-5 text-gray-500" />;
  }
};

export const LiveFeed: React.FC = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const response = await fetch('/api/investor/live-feed');
        if (!response.ok) {
          // Don't show an error for this, as it's a non-critical component
          console.error('Failed to fetch live feed data.');
          return;
        }
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        // Silently fail is okay for this component
        console.error((error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed(); // Fetch immediately on mount
    const interval = setInterval(fetchFeed, 15000); // And then every 15 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Activity Feed</CardTitle>
        <CardDescription>A real-time ticker of recent platform events.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-sm text-muted-foreground py-4">Loading Feed...</div>
        ) : events.length > 0 ? (
          <div className="space-y-3 h-64 overflow-y-auto pr-2">
            {events.map((event, index) => (
              <div key={index} className="flex items-center gap-3 animate-fade-in">
                <div>{getEventIcon(event.type)}</div>
                <div className="flex-grow">
                  <p className="text-sm font-medium">{event.description}</p>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">{event.timeAgo}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-4">
            No recent activity in the last 24 hours.
          </div>
        )}
      </CardContent>
    </Card>
  );
};