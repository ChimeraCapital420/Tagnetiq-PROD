// FILE: src/components/authority/sections/ComicVineSection.tsx
// Comic Vine authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, Star, Users } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate, truncateText, formatArray } from '../helpers';

export const ComicVineSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const coverImage = details.coverImage || details.imageLinks?.thumbnail;
  const volumeName = details.volumeName;
  const issueNumber = details.issueNumber;
  const issueName = details.issueName;
  const coverDate = details.coverDate;
  const storeDate = details.storeDate;
  const deck = details.deck || details.description;
  const writers = details.writers;
  const artists = details.artists;
  const coverArtists = details.coverArtists;
  const characterCount = details.characterCount;
  const firstAppearances = details.firstAppearances;
  const isKeyIssue = details.isKeyIssue;
  const hasFirstAppearances = details.hasFirstAppearances;
  const comicVineId = details.comicVineId;
  const externalUrl = details.comicVineUrl || details.externalUrl || data.externalUrl;

  return (
    <div className="space-y-3">
      {/* Cover image */}
      {coverImage && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={coverImage}
            alt={`${volumeName} #${issueNumber}`}
            className="w-24 h-36 object-cover rounded shadow-md"
          />
        </div>
      )}

      {/* Key Issue Badge */}
      {(isKeyIssue || hasFirstAppearances) && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-md p-2 flex items-center justify-center gap-2">
          <Star className="h-4 w-4 text-yellow-600 fill-yellow-600" />
          <span className="text-yellow-700 dark:text-yellow-400 font-semibold text-sm">
            Key Issue
            {hasFirstAppearances && ' • First Appearances'}
          </span>
        </div>
      )}

      {/* First appearances list */}
      {firstAppearances && firstAppearances.length > 0 && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-md p-2">
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1 flex items-center gap-1">
            <Users className="h-3 w-3" />
            First Appearances
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-300">
            {formatArray(firstAppearances, 5)}
          </div>
        </div>
      )}

      {/* Description/deck */}
      {deck && (
        <p className="text-xs text-muted-foreground text-center">
          {truncateText(deck, 150)}
        </p>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Volume" value={volumeName} />
        <DataRow label="Issue #" value={issueNumber} />
        {issueName && <DataRow label="Issue Name" value={issueName} />}
        <DataRow label="Cover Date" value={formatDate(coverDate)} />
        <DataRow label="Store Date" value={formatDate(storeDate)} />
        <DataRow label="Writers" value={formatArray(writers, 3)} />
        <DataRow label="Artists" value={formatArray(artists, 3)} />
        <DataRow label="Cover Artists" value={formatArray(coverArtists, 2)} />
        {characterCount && characterCount > 0 && (
          <DataRow label="Characters" value={`${characterCount} appearances`} />
        )}
        <DataRow label="Comic Vine ID" value={comicVineId} />
      </div>

      {/* External link */}
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Comic Vine <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground text-center">
        Data provided by Comic Vine
      </p>
    </div>
  );
};

export default ComicVineSection;