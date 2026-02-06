// FILE: src/components/authority/sections/GoogleBooksSection.tsx
// Google Books authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { Star, ExternalLink } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate, truncateText } from '../helpers';

export const GoogleBooksSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const thumbnail = details.imageLinks?.thumbnail;
  const title = details.title;
  const authors = details.authors;
  const publisher = details.publisher;
  const publishedDate = details.publishedDate;
  const pageCount = details.pageCount;
  const categories = details.categories;
  const description = details.description;
  const isbn13 = details.isbn13;
  const isbn10 = details.isbn10;
  const averageRating = details.averageRating;
  const ratingsCount = details.ratingsCount;
  const retailPrice = details.retailPrice;
  const externalUrl = details.externalUrl || data.externalUrl;

  return (
    <div className="space-y-3">
      {/* Thumbnail */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Book cover'}
            className="w-20 h-28 object-cover rounded shadow-md"
          />
        </div>
      )}

      {/* Rating */}
      {averageRating && (
        <div className="flex items-center justify-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="text-sm font-medium">{averageRating.toFixed(1)}</span>
          {ratingsCount && (
            <span className="text-xs text-muted-foreground">
              ({ratingsCount.toLocaleString()} ratings)
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground text-center">
          {truncateText(description, 120)}
        </p>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Authors" value={authors?.join(', ')} />
        <DataRow label="Publisher" value={publisher} />
        <DataRow label="Published" value={formatDate(publishedDate)} />
        <DataRow label="Pages" value={pageCount} />
        <DataRow label="ISBN-13" value={isbn13} />
        <DataRow label="ISBN-10" value={isbn10} />
        <DataRow label="Categories" value={categories?.slice(0, 2).join(', ')} />
        {retailPrice && <DataRow label="Retail" value={`$${retailPrice.toFixed(2)}`} />}
      </div>

      {/* External link */}
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Google Books <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default GoogleBooksSection;