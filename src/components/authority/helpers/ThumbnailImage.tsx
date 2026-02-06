// FILE: src/components/authority/helpers/ThumbnailImage.tsx
// Safe image display with error handling
// v7.5

'use client';

import React, { useState } from 'react';

interface ThumbnailImageProps {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

/**
 * Thumbnail image with graceful error handling
 * Hides itself if image fails to load
 */
export const ThumbnailImage: React.FC<ThumbnailImageProps> = ({
  src,
  alt,
  className = '',
  fallbackClassName = '',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  if (!src || hasError) {
    return null;
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!isLoaded && (
        <div className={`absolute inset-0 bg-muted animate-pulse ${fallbackClassName}`} />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
      />
    </div>
  );
};

export default ThumbnailImage;