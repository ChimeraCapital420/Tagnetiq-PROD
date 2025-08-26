// FILE: api/dashboard/spotlight-items.ts (REVISED)

import { supaAdmin } from '../_lib/supaAdmin';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyUser } from '../_lib/security';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifyUser(req);

    // Simplified Logic: Fetch the 10 most recent active listings.
    // This removes the dependency on the 'profiles' table and 'interests',
    // making the query more robust against schema variations.
    const { data: recentItems, error: recentError } = await supaAdmin
        .from('marketplace_listings')
        .select('id, item_name, primary_photo_url, challenge_id')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(10);

    if (recentError) {
      console.error('Error fetching recent items for spotlight:', recentError);
      // Throwing the error will be caught by the catch block and return a 500
      throw recentError;
    }

    return res.status(200).json(recentItems || []);

  } catch (error: any) {
    const message = error.message || 'An unexpected error occurred.';
    if (message.includes('Authentication')) return res.status(401).json({ error: message });
    console.error('Error fetching spotlight items:', message);
    // Ensure a generic error is sent to the client
    return res.status(500).json({ error: 'Could not retrieve spotlight items.' });
  }
}
```typescript
// FILE: src/components/arena/AlertsDropdown.tsx (REVISED)

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Alert {
    id: number;
    listing_id: string; // We'll fetch the listing_id directly
    // The nested listing data is removed to simplify the query
}

// A new interface for the simplified data we will fetch
interface ListingInfo {
    item_name: string;
    challenge_id: string;
}

const AlertsDropdown: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [listingDetails, setListingDetails] = useState<Record<string, ListingInfo>>({});
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchAlertsAndDetails = async () => {
            if (!isOpen) return;

            // Step 1: Fetch the alerts, but without the complex join
            const { data, error } = await supabase
                .from('watchlist_alerts')
                .select(`id, listing_id`)
                .eq('is_read', false)
                .limit(5);

            if (error) {
                console.error("Error fetching alerts:", error);
                return;
            }
            
            setAlerts(data || []);

            // Step 2: If we have alerts, fetch the details for their listings
            if (data && data.length > 0) {
                const listingIds = data.map(a => a.listing_id);
                const { data: listingsData, error: listingsError } = await supabase
                    .from('marketplace_listings')
                    .select('id, item_name, challenge_id')
                    .in('id', listingIds);

                if (listingsError) {
                    console.error("Error fetching listing details for alerts:", listingsError);
                    return;
                }

                // Create a map for easy lookup
                const detailsMap = (listingsData || []).reduce((acc, listing) => {
                    acc[listing.id] = { item_name: listing.item_name, challenge_id: listing.challenge_id };
                    return acc;
                }, {} as Record<string, ListingInfo>);
                
                setListingDetails(detailsMap);
            }
        };

        fetchAlertsAndDetails();
    }, [isOpen]);

    const handleMarkAsRead = async () => {
        if (alerts.length === 0) return;
        const alertIds = alerts.map(a => a.id);
        await supabase.from('watchlist_alerts').update({ is_read: true }).in('id', alertIds);
        setAlerts([]);
        setListingDetails({});
    };

    return (
        <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    {alerts.length > 0 ? <BellRing className="h-5 w-5 text-primary" /> : <Bell className="h-5 w-5" />}
                    {alerts.length > 0 && (
                        <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end" onCloseAutoFocus={handleMarkAsRead}>
                <div className="p-4">
                    <h4 className="font-medium leading-none">Notifications</h4>
                    <p className="text-sm text-muted-foreground">New items matching your watchlist.</p>
                </div>
                <div className="grid gap-2 p-2">
                    {alerts.length > 0 ? alerts.map(alert => {
                        const details = listingDetails[alert.listing_id];
                        if (!details) return null; // Don't render if details haven't loaded yet
                        return (
                            <Link to={`/arena/challenge/${details.challenge_id}`} key={alert.id} className="block p-2 hover:bg-muted rounded-md text-sm">
                                New listing for: <span className="font-semibold">{details.item_name}</span>
                            </Link>
                        )
                    }) : (
                        <p className="text-sm text-center text-muted-foreground py-4">No new alerts.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default AlertsDropdown;
