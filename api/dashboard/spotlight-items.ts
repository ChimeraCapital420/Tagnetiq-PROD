// FILE: src/components/dashboard/SpotlightCarousel.tsx
// VULCAN FORGE: Hardened with explicit loading and error states for anti-fragility.

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import Autoplay from "embla-carousel-autoplay";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, AlertTriangle } from 'lucide-react'; // VULCAN: Added icons for new states

interface SpotlightItem {
  id: string;
  item_name: string;
  primary_photo_url: string;
  isPlaceholder?: boolean;
}

const placeholderItems: SpotlightItem[] = [
  { id: 'placeholder-1', item_name: 'Featured: Vintage Action Figure', primary_photo_url: '/images/welcome.jpg', isPlaceholder: true },
  { id: 'placeholder-2', item_name: 'Spotlight: Rare Timepiece', primary_photo_url: '/images/auth-background.jpg', isPlaceholder: true },
  { id: 'placeholder-3', item_name: 'Trending: Designer Handbag', primary_photo_url: '/placeholder.svg', isPlaceholder: true },
];


const SpotlightCarousel: React.FC = () => {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // VULCAN: Added error state

  useEffect(() => {
    const fetchSpotlightItems = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // VULCAN NOTE: This fetch will now succeed when `vercel dev` is running.
        const response = await fetch('/api/dashboard/spotlight-items', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch spotlight items');
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
            setItems(data);
        } else {
            setItems(placeholderItems);
        }
      } catch (err) {
        setError((err as Error).message); // VULCAN: Set error message
        setItems(placeholderItems); // Fallback on any error
      } finally {
        setLoading(false);
      }
    };

    fetchSpotlightItems();
  }, []);

  // VULCAN FORGE: Enhanced rendering logic for clear state indication.
  if (loading) {
    return (
      <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="h-48 md:h-full w-full bg-muted animate-pulse flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading Spotlight...</span>
        </div>
      </Card>
    );
  }
  
  if (error) {
     return (
      <Card className="overflow-hidden border-destructive/50 bg-destructive/10 backdrop-blur-sm">
        <div className="h-48 md:h-full w-full flex flex-col items-center justify-center gap-2 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            <span className="font-semibold">Could not load Spotlight</span>
            <p className="text-xs">{error}</p>
        </div>
      </Card>
    );
  }

  return (
    <Carousel
      className="w-full"
      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
      opts={{ loop: true }}
    >
      <CarouselContent>
        {items.map((item) => {
          const WrapperComponent = item.isPlaceholder ? 'div' : Link;
          const wrapperProps = item.isPlaceholder ? {} : { to: `/arena/marketplace/${item.id}` };

          return (
            <CarouselItem key={item.id}>
               <WrapperComponent {...wrapperProps}>
                <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm group">
                  <div className="h-48 md:h-full w-full relative">
                    {item.isPlaceholder && (
                       <Badge className="absolute top-2 right-2 z-10" variant="secondary">SAMPLE</Badge>
                    )}
                    <img src={item.primary_photo_url} alt={item.item_name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 text-white p-2">
                      <h3 className="font-bold text-lg" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                        {item.item_name}
                      </h3>
                    </div>
                  </div>
                </Card>
              </WrapperComponent>
            </CarouselItem>
          );
        })}
      </CarouselContent>
      <CarouselPrevious className="absolute left-4" />
      <CarouselNext className="absolute right-4" />
    </Carousel>
  );
};

export default SpotlightCarousel;
