// FILE: src/components/dashboard/SpotlightCarousel.tsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Badge } from '@/components/ui/badge';
import Autoplay from "embla-carousel-autoplay";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SpotlightItem {
  id: string;
  item_name: string;
  primary_photo_url: string;
  isPlaceholder?: boolean;
}

// PERFORMANCE: Optimized image component with lazy loading
const LazyImage: React.FC<{ 
  src: string; 
  alt: string; 
  className?: string;
  loading?: 'lazy' | 'eager';
}> = ({ src, alt, className = '', loading = 'lazy' }) => {
  const [imageSrc, setImageSrc] = useState('/placeholder.svg');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setImageLoaded(false);
    setError(false);
    
    // Create an image element to preload
    const img = new Image();
    
    const handleLoad = () => {
      setImageSrc(src);
      setImageLoaded(true);
    };
    
    const handleError = () => {
      setError(true);
      setImageSrc('/placeholder.svg');
    };

    img.onload = handleLoad;
    img.onerror = handleError;
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Placeholder/Loading state */}
      {!imageLoaded && !error && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Actual image */}
      <img
        src={imageSrc}
        alt={alt}
        loading={loading}
        className={`${className} transition-opacity duration-500 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
        decoding="async"
      />
    </div>
  );
};

// PERFORMANCE: Use WebP format for placeholders
const placeholderItems: SpotlightItem[] = [
  { id: 'placeholder-1', item_name: 'Featured: Vintage Action Figure', primary_photo_url: '/images/welcome.webp', isPlaceholder: true },
  { id: 'placeholder-2', item_name: 'Spotlight: Rare Timepiece', primary_photo_url: '/images/auth-background.webp', isPlaceholder: true },
  { id: 'placeholder-3', item_name: 'Trending: Designer Handbag', primary_photo_url: '/placeholder.svg', isPlaceholder: true },
];

const SpotlightCarousel: React.FC = () => {
  const [items, setItems] = useState<SpotlightItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const fetchSpotlightItems = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const response = await fetch('/api/dashboard/spotlight-items', {
          headers: { 'Authorization': `Bearer ${session.access_token}` },
        });

        if (!response.ok) {
          console.error('Failed to fetch spotlight items, using placeholders.');
          setItems(placeholderItems);
          return;
        }

        const data = await response.json();
        
        if (data && data.length > 0) {
          setItems(data);
        } else {
          setItems(placeholderItems);
        }
      } catch (error) {
        toast.error("Could not load spotlight", { description: (error as Error).message });
        setItems(placeholderItems);
      } finally {
        setLoading(false);
      }
    };

    fetchSpotlightItems();
  }, []);

  if (loading) {
    return (
      <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm">
        <div className="h-48 md:h-64 w-full bg-muted animate-pulse" />
      </Card>
    );
  }

  return (
    <Carousel
      className="w-full"
      plugins={[Autoplay({ delay: 5000, stopOnInteraction: true })]}
      opts={{ loop: true }}
      onSelect={(api: any) => {
        if (api) {
          setCurrentIndex(api.selectedScrollSnap());
        }
      }}
    >
      <CarouselContent>
        {items.map((item, index) => {
          const WrapperComponent = item.isPlaceholder ? 'div' : Link;
          const wrapperProps = item.isPlaceholder ? {} : { to: `/arena/marketplace/${item.id}` };
          
          // PERFORMANCE: Only load images for current, previous, and next slides
          const shouldLoadEagerly = Math.abs(index - currentIndex) <= 1;

          return (
            <CarouselItem key={item.id}>
              <WrapperComponent {...wrapperProps}>
                <Card className="overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm group">
                  <div className="h-48 md:h-64 w-full relative">
                    {item.isPlaceholder && (
                      <Badge className="absolute top-2 right-2 z-10" variant="secondary">SAMPLE</Badge>
                    )}
                    
                    {/* PERFORMANCE: Lazy load images */}
                    <LazyImage
                      src={item.primary_photo_url}
                      alt={item.item_name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading={shouldLoadEagerly ? 'eager' : 'lazy'}
                    />
                    
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