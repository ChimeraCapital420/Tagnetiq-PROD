// FILE: src/pages/arena/ActiveHunts.tsx
// Ghost Protocol - Active Hunts Dashboard
// Track ghost listings that need fulfillment

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Ghost, MapPin, Clock, DollarSign, AlertTriangle, CheckCircle2,
  ExternalLink, RefreshCw, Filter, TrendingUp, Package, Store,
  ChevronRight, Timer, Flame
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, differenceInHours, isPast } from 'date-fns';

// =============================================================================
// TYPES
// =============================================================================

interface GhostListing {
  id: string;
  title: string;
  price: number;
  images: string[];
  status: 'active' | 'sold' | 'fulfilled' | 'expired';
  created_at: string;
  expires_at: string;
  sold_at?: string;
  metadata: {
    ghost_data?: {
      is_ghost: true;
      location: {
        lat: number;
        lng: number;
        accuracy: number;
        captured_at: string;
      };
      store: {
        type: string;
        name: string;
        aisle?: string;
        shelf_price: number;
        notes?: string;
        hours?: string;
      };
      timer: {
        created_at: string;
        expires_at: string;
        handling_hours: number;
      };
      kpis: {
        scan_to_toggle_ms: number;
        estimated_margin: number;
        velocity_score: 'low' | 'medium' | 'high';
      };
    };
  };
}

interface HuntStats {
  total: number;
  active: number;
  sold: number;
  fulfilled: number;
  expired: number;
  totalPotentialProfit: number;
  totalRealizedProfit: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

const ActiveHunts: React.FC = () => {
  const { session } = useAuth();
  const [listings, setListings] = useState<GhostListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'sold' | 'all'>('active');

  // Fetch ghost listings
  const fetchListings = async () => {
    if (!session?.user?.id) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('arena_listings')
        .select('*')
        .eq('seller_id', session.user.id)
        .not('metadata->ghost_data', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListings(data || []);
    } catch (error) {
      console.error('Error fetching ghost listings:', error);
      toast.error('Failed to load hunts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [session?.user?.id]);

  // Calculate stats
  const stats = useMemo<HuntStats>(() => {
    const active = listings.filter(l => l.status === 'active');
    const sold = listings.filter(l => l.status === 'sold');
    const fulfilled = listings.filter(l => l.status === 'fulfilled');
    const expired = listings.filter(l => l.status === 'expired');

    const totalPotentialProfit = active.reduce((sum, l) => {
      const margin = l.metadata.ghost_data?.kpis.estimated_margin || 0;
      return sum + margin;
    }, 0);

    const totalRealizedProfit = fulfilled.reduce((sum, l) => {
      const margin = l.metadata.ghost_data?.kpis.estimated_margin || 0;
      return sum + margin;
    }, 0);

    return {
      total: listings.length,
      active: active.length,
      sold: sold.length,
      fulfilled: fulfilled.length,
      expired: expired.length,
      totalPotentialProfit,
      totalRealizedProfit,
    };
  }, [listings]);

  // Filter listings by tab
  const filteredListings = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return listings.filter(l => l.status === 'active');
      case 'sold':
        return listings.filter(l => l.status === 'sold' || l.status === 'fulfilled');
      default:
        return listings;
    }
  }, [listings, activeTab]);

  // Mark as fulfilled
  const handleMarkFulfilled = async (listingId: string) => {
    try {
      const { error } = await supabase
        .from('arena_listings')
        .update({ status: 'fulfilled' })
        .eq('id', listingId);

      if (error) throw error;
      
      toast.success('Hunt fulfilled! 🎉');
      fetchListings();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Ghost className="h-6 w-6 text-purple-400" />
            Active Hunts
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your ghost listings and fulfillment status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchListings} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-purple-500/20">
                <Ghost className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active Hunts</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-red-500/20">
                <Flame className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.sold}</p>
                <p className="text-xs text-muted-foreground">Pending Retrieval</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-emerald-500/20">
                <DollarSign className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalPotentialProfit.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Potential Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full p-2 bg-green-500/20">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.totalRealizedProfit.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Realized Profit</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Listings */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="w-full">
          <TabsTrigger value="active" className="flex-1">
            <Ghost className="h-4 w-4 mr-2" />
            Active ({stats.active})
          </TabsTrigger>
          <TabsTrigger value="sold" className="flex-1">
            <Flame className="h-4 w-4 mr-2" />
            Sold ({stats.sold + stats.fulfilled})
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1">
            All ({stats.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-3">
          {isLoading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Loading hunts...</p>
              </CardContent>
            </Card>
          ) : filteredListings.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Ghost className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-3 font-medium">No hunts found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Enable Ghost Mode in the scanner to create virtual listings
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredListings.map((listing) => (
              <HuntCard
                key={listing.id}
                listing={listing}
                onMarkFulfilled={handleMarkFulfilled}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

// =============================================================================
// HUNT CARD COMPONENT
// =============================================================================

interface HuntCardProps {
  listing: GhostListing;
  onMarkFulfilled: (id: string) => void;
}

const HuntCard: React.FC<HuntCardProps> = ({ listing, onMarkFulfilled }) => {
  const ghostData = listing.metadata.ghost_data;
  if (!ghostData) return null;

  const isSold = listing.status === 'sold';
  const isFulfilled = listing.status === 'fulfilled';
  const isExpired = listing.status === 'expired' || isPast(new Date(listing.expires_at));
  
  const hoursRemaining = differenceInHours(new Date(listing.expires_at), new Date());
  const progressPercent = Math.max(0, Math.min(100, (hoursRemaining / ghostData.timer.handling_hours) * 100));

  const velocityColors = {
    low: 'text-yellow-500 bg-yellow-500/20',
    medium: 'text-orange-500 bg-orange-500/20',
    high: 'text-red-500 bg-red-500/20',
  };

  return (
    <Card className={cn(
      'transition-all',
      isSold && 'border-red-500/50 bg-red-500/5',
      isFulfilled && 'border-green-500/50 bg-green-500/5',
      isExpired && !isFulfilled && 'border-zinc-700 opacity-60'
    )}>
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Image */}
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0">
            {listing.images?.[0] ? (
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Ghost className="h-8 w-8 text-zinc-600" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-sm truncate">{listing.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={cn('text-[10px]', velocityColors[ghostData.kpis.velocity_score])}
                  >
                    {ghostData.kpis.velocity_score.toUpperCase()}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    ${listing.price} list • ${ghostData.store.shelf_price} cost
                  </span>
                </div>
              </div>
              <span className={cn(
                'text-sm font-bold',
                ghostData.kpis.estimated_margin > 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                +${ghostData.kpis.estimated_margin.toFixed(2)}
              </span>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <Store className="h-3 w-3" />
              <span className="truncate">
                {ghostData.store.name}
                {ghostData.store.aisle && ` • ${ghostData.store.aisle}`}
              </span>
            </div>

            {/* Timer / Status */}
            <div className="mt-3">
              {isSold && !isFulfilled ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">BOUNTY ACTIVE - Retrieve Now!</span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onMarkFulfilled(listing.id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Mark as Fulfilled
                  </Button>
                </div>
              ) : isFulfilled ? (
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Fulfilled</span>
                </div>
              ) : isExpired ? (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Expired</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Timer className="h-3 w-3" />
                      Time remaining
                    </span>
                    <span className={cn(
                      'font-mono',
                      hoursRemaining < 12 ? 'text-red-400' : 'text-zinc-400'
                    )}>
                      {hoursRemaining}h left
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-1.5" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        {isSold && !isFulfilled && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const { lat, lng } = ghostData.location;
                window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
              }}
            >
              <MapPin className="h-3 w-3 mr-1.5" />
              Navigate
            </Button>
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={`/arena/challenge/${listing.id}`}>
                <ExternalLink className="h-3 w-3 mr-1.5" />
                View Listing
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ActiveHunts;