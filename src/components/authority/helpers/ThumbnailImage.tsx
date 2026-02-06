// FILE: src/components/authority/helpers/ThumbnailImage.tsx
// Thumbnail image component with fallback
// Refactored from monolith v7.3

'use client';

import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';

interface ThumbnailImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Image component with loading state and error fallback
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  src,
  alt,
  className = 'w-24 h-24 object-contain rounded-md',
  fallbackClassName = 'w-24 h-24 bg-muted rounded-md flex items-center justify-center',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src || hasError) {
    return (
      <div className={fallbackClassName}>
        <ImageOff className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`${fallbackClassName} absolute inset-0 animate-pulse`} />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />
    </div>
  );
};

export default ThumbnailImage;