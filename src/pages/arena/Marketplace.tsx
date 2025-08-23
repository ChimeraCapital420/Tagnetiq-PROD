// FILE: src/pages/arena/Marketplace.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { AspectRatio } from '@/components/ui/aspect-ratio';
import { WatchlistManager } from '@/components/arena/WatchlistManager';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAppContext } from '@/contexts/AppContext'; // Import AppContext

interface MarketplaceItem {
  id: string;
  challenge_id: string;
  item_name: string;
  asking_price: number;
  primary_photo_url: string;
}

const Marketplace: React.FC = () => {
  const { searchArenaQuery, setSearchArenaQuery } = useAppContext(); // Get search context
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchArenaQuery); // Initialize with context

  const fetchMarketplaceData = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const url = `/api/arena/marketplace${query ? `?searchQuery=${encodeURIComponent(query)}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch marketplace data.');
      }
      const data = await response.json();
      setItems(data);
    } catch (error) {
      toast.error("Error Loading Marketplace", { description: (error as Error).message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // If there's a query from the context, fetch data immediately
    if (searchArenaQuery) {
      fetchMarketplaceData(searchArenaQuery);
      // Clear the context query after using it to prevent re-searching on navigation
      setSearchArenaQuery(''); 
    } else {
      // Otherwise, perform the initial fetch for all items
      fetchMarketplaceData('');
    }
  }, [searchArenaQuery, fetchMarketplaceData, setSearchArenaQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMarketplaceData(searchTerm);
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Marketplace</h1>
          <p className="text-muted-foreground">Discover assets from public ROI challenges.</p>
        </div>
        
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input 
                placeholder="Search the marketplace..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
              </Button>
            </form>

            {loading ? (
              <div className="text-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></div>
            ) : items.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-xl font-semibold">No Listings Found</h3>
                <p className="text-muted-foreground mt-2">Try adjusting your search or check back later for new items.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.map(item => (
                  <Link to={`/arena/challenge/${item.challenge_id}`} key={item.id}>
                    <Card className="h-full overflow-hidden hover:border-primary transition-all group">
                      <CardHeader className="p-0">
                        <AspectRatio ratio={1 / 1}>
                          <img 
                            src={item.primary_photo_url || '/placeholder.svg'} 
                            alt={item.item_name} 
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300" 
                          />
                        </AspectRatio>
                      </CardHeader>
                      <CardContent className="p-4">
                        <p className="font-semibold truncate">{item.item_name}</p>
                        <p className="text-lg font-bold text-primary">${item.asking_price.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-1">
            <WatchlistManager />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Marketplace;