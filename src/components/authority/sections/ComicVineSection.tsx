// FILE: src/components/authority/sections/ComicVineSection.tsx
// Comic Vine authority data display
// v7.5 - Bulletproof data extraction with key issue detection

'use client';

import React from 'react';
import { ExternalLink, BookOpen, Star, AlertCircle, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatDate, truncateText } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const ComicVineSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract comic-specific fields
  const coverImage = getThumbnailUrl(data) || get<string>('coverImage') || get<string>('coverImageThumb') || get<string>('coverImageLarge');
  const title = get<string>('title') || get<string>('issueName');
  const volumeName = get<string>('volumeName');
  const volumeId = get<string>('volumeId');
  const issueNumber = get<string>('issueNumber') || get<string>('number');
  const coverDate = get<string>('coverDate');
  const storeDate = get<string>('storeDate');
  const publisher = get<string>('publisher');
  const description = get<string>('description') || get<string>('deck');
  
  // Creators
  const writers = get<string[]>('writers');
  const artists = get<string[]>('artists');
  const pencilers = get<string[]>('pencilers');
  const inkers = get<string[]>('inkers');
  const colorists = get<string[]>('colorists');
  const letterers = get<string[]>('letterers');
  const coverArtists = get<string[]>('coverArtists');
  const editors = get<string[]>('editors');
  
  // Key issue detection
  const isKeyIssue = get<boolean>('isKeyIssue');
  const hasFirstAppearances = get<boolean>('hasFirstAppearances');
  const firstAppearances = get<string[]>('firstAppearances');
  const deaths = get<string[]>('deaths');
  const characterAppearances = get<string[]>('characterAppearances');
  const characterCount = get<number>('characterCount');
  const teamAppearances = get<string[]>('teamAppearances');
  const storyArcs = get<string[]>('storyArcs');
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data) || get<string>('comicVineUrl');

  const hasData = volumeName || issueNumber || writers || artists || coverDate;
  const hasCreators = writers || artists || pencilers || inkers;

  return (
    <div className="space-y-3">
      {/* Cover Image */}
      {coverImage && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={coverImage}
            alt={title || 'Comic cover'}
            className="w-24 h-36 object-cover rounded shadow-lg"
          />
        </div>
      )}

      {/* Title & Issue */}
      {(volumeName || issueNumber) && (
        <div className="text-center">
          {volumeName && <p className="text-sm font-semibold">{volumeName}</p>}
          {issueNumber && (
            <p className="text-lg font-bold text-primary">Issue #{issueNumber}</p>
          )}
          {publisher && (
            <p className="text-xs text-muted-foreground">{publisher}</p>
          )}
        </div>
      )}

      {/* Key Issue Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {isKeyIssue && (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">
            <Star className="h-3 w-3 mr-1 fill-amber-500" />
            Key Issue
          </Badge>
        )}
        {hasFirstAppearances && (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <AlertCircle className="h-3 w-3 mr-1" />
            First Appearance
          </Badge>
        )}
        {deaths && deaths.length > 0 && (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            Notable Death
          </Badge>
        )}
      </div>

      {/* First Appearances List */}
      {firstAppearances && firstAppearances.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-md p-2">
          <p className="text-xs text-red-400 font-semibold mb-1">First Appearances:</p>
          <p className="text-xs text-red-300">
            {firstAppearances.slice(0, 5).join(', ')}
            {firstAppearances.length > 5 && ` +${firstAppearances.length - 5} more`}
          </p>
        </div>
      )}

      {/* Deaths */}
      {deaths && deaths.length > 0 && (
        <div className="bg-gray-500/10 border border-gray-500/20 rounded-md p-2">
          <p className="text-xs text-gray-400 font-semibold mb-1">Deaths:</p>
          <p className="text-xs text-gray-300">
            {deaths.slice(0, 3).join(', ')}
            {deaths.length > 3 && ` +${deaths.length - 3} more`}
          </p>
        </div>
      )}

      {/* Story Arcs */}
      {storyArcs && storyArcs.length > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          <span className="font-medium">Story Arc:</span> {storyArcs.slice(0, 2).join(', ')}
        </div>
      )}

      {/* Market Value */}
      {marketValue && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Estimated Value</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">{marketValue.low}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Mid</div>
              <div className="font-semibold text-green-500">{marketValue.mid}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">{marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Publisher" value={publisher} />
          <DataRow label="Cover Date" value={formatDate(coverDate)} />
          <DataRow label="Store Date" value={formatDate(storeDate)} />
          <DataRow label="Writers" value={writers?.slice(0, 2).join(', ')} />
          <DataRow label="Artists" value={artists?.slice(0, 2).join(', ')} />
          <DataRow label="Pencilers" value={pencilers?.slice(0, 2).join(', ')} />
          <DataRow label="Cover Artists" value={coverArtists?.slice(0, 2).join(', ')} />
          {characterCount && <DataRow label="Characters" value={characterCount} />}
        </div>
      )}

      {/* Character Appearances */}
      {characterAppearances && characterAppearances.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <div className="flex items-center gap-1 mb-1">
            <Users className="h-3 w-3" />
            <span className="font-medium">Featured Characters:</span>
          </div>
          <p>{characterAppearances.slice(0, 8).join(', ')}{characterAppearances.length > 8 && ` +${characterAppearances.length - 8} more`}</p>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground text-center">
          {truncateText(description.replace(/<[^>]*>/g, ''), 200)}
        </p>
      )}

      {/* No Data Fallback */}
      {!hasData && !coverImage && (
        <div className="text-center py-4">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Comic verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link - SINGLE LINE */}
      {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">View on Comic Vine <ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
};

export default ComicVineSection;