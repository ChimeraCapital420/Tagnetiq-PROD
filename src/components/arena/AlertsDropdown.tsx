// FILE: src/components/arena/AlertsDropdown.tsx

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell, BellRing } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Alert {
    id: number;
    listing: {
        item_name: string;
        challenge_id: string;
    }
}

const AlertsDropdown: React.FC = () => {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const fetchAlerts = async () => {
            const { data, error } = await supabase
                .from('watchlist_alerts')
                .select(`id, listing:marketplace_listings(item_name, challenge_id)`)
                .eq('is_read', false)
                .limit(5);

            if (error) console.error("Error fetching alerts:", error);
            else setAlerts(data as any);
        };

        fetchAlerts();
    }, [isOpen]);

    const handleMarkAsRead = async () => {
        const alertIds = alerts.map(a => a.id);
        await supabase.from('watchlist_alerts').update({ is_read: true }).in('id', alertIds);
        setAlerts([]);
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
                    {alerts.length > 0 ? alerts.map(alert => (
                        <Link to={`/arena/challenge/${alert.listing.challenge_id}`} key={alert.id} className="block p-2 hover:bg-muted rounded-md text-sm">
                            New listing for: <span className="font-semibold">{alert.listing.item_name}</span>
                        </Link>
                    )) : (
                        <p className="text-sm text-center text-muted-foreground py-4">No new alerts.</p>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default AlertsDropdown;