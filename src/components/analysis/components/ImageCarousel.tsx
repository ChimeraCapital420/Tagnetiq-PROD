// FILE: src/components/analysis/components/ImageCarousel.tsx
// Image carousel for analysis result photos.
// Handles 0, 1, or many images gracefully.

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

interface ImageCarouselProps {
  imageUrls: string[];
  itemName: string;
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ imageUrls, itemName }) => {
  if (imageUrls.length === 0) {
    return (
      <Card>
        <CardContent className="flex aspect-square items-center justify-center">
          <span className="text-muted-foreground">No images available</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <Carousel className="w-full">
        <CarouselContent>
          {imageUrls.map((url, index) => (
            <CarouselItem key={index}>
              <div className="p-1">
                <Card className="overflow-hidden">
                  <CardContent className="flex aspect-square items-center justify-center p-0">
                    <img
                      src={url}
                      alt={`${itemName} view ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </CardContent>
                </Card>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {imageUrls.length > 1 && (
          <>
            <CarouselPrevious />
            <CarouselNext />
          </>
        )}
      </Carousel>

      {imageUrls.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1">
          <span className="text-xs text-muted-foreground">{imageUrls.length} images</span>
        </div>
      )}
    </div>
  );
};

export default ImageCarousel;