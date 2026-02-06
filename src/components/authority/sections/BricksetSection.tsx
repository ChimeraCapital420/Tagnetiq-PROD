// FILE: src/components/authority/sections/BricksetSection.tsx
// Brickset (LEGO) authority data display
// v7.5 - Bulletproof with retirement detection - FULL VERSION

'use client';

import React from 'react';
import { ExternalLink, Blocks, Clock, TrendingUp, Users, Package, Calendar, Tag, DollarSign } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatPrice, formatDate } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

export const BricksetSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract LEGO-specific fields
  const thumbnail = getThumbnailUrl(data) || get<string>('image');
  const additionalImages = get<string[]>('additionalImages');
  
  // Set identification
  const setNumber = get<string>('setNumber') || get<string>('number');
  const name = get<string>('name') || get<string>('title');
  const setId = get<number>('setID') || get<number>('setId');
  
  // Theme hierarchy
  const theme = get<string>('theme');
  const themeGroup = get<string>('themeGroup');
  const subtheme = get<string>('subtheme');
  const category = get<string>('category');
  
  // Year and availability
  const year = get<number>('year');
  const released = get<string>('released');
  const availability = get<string>('availability');
  const isRetired = get<boolean>('isRetired') || get<boolean>('retired');
  const dateFirstAvailable = get<string>('dateFirstAvailable') || get<string>('launchDate');
  const dateLastAvailable = get<string>('dateLastAvailable') || get<string>('exitDate');
  
  // Set contents
  const pieces = get<number>('pieces');
  const minifigs = get<number>('minifigs');
  const minifigNames = get<string[]>('minifigNames');
  
  // Age range
  const ageMin = get<number>('ageMin') || get<number>('agesMin');
  const ageMax = get<number>('ageMax') || get<number>('agesMax');
  const ageRange = get<string>('ageRange') || get<string>('ages');
  
  // Packaging
  const packagingType = get<string>('packagingType');
  const dimensions = get<{ height?: number; width?: number; depth?: number }>('dimensions');
  const weight = get<number>('weight');
  
  // Instructions
  const instructionsCount = get<number>('instructionsCount');
  const hasInstructions = get<boolean>('hasInstructions');
  
  // Pricing
  const rrp = get<number>('rrp') || get<number>('retailPrice') || get<number>('LEGOCom')?.US?.retailPrice;
  const pricePerPiece = get<number>('pricePerPiece');
  const currentValue = get<number>('currentValue');
  
  // Price guide from secondary market
  const priceGuide = get<{
    minPrice?: number;
    maxPrice?: number;
    avgPrice?: number;
    qtyAvgPrice?: number;
    minPriceNew?: number;
    maxPriceNew?: number;
    avgPriceNew?: number;
  }>('priceGuide') || get<Record<string, number>>('LEGOCom')?.US?.priceGuide;
  
  // Brickset stats
  const rating = get<number>('rating');
  const reviewCount = get<number>('reviewCount');
  const ownedBy = get<number>('ownedBy') || get<number>('collection')?.ownedBy;
  const wantedBy = get<number>('wantedBy') || get<number>('collection')?.wantedBy;
  
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data) || get<string>('bricksetURL');
  
  // Calculate derived values
  const ageDisplay = ageRange || (ageMin && ageMax ? `${ageMin}-${ageMax}+` : ageMin ? `${ageMin}+` : undefined);
  const hasData = setNumber || pieces || year || theme;
  const hasPriceGuide = priceGuide && (priceGuide.minPrice || priceGuide.avgPrice);
  const hasCommunityStats = ownedBy || wantedBy || rating;
  
  // Smart retirement detection
  const currentYear = new Date().getFullYear();
  const isEffectivelyRetired = isRetired || 
    !!dateLastAvailable || 
    availability === 'Retired' ||
    (year !== undefined && year < currentYear - 3);
  
  // Calculate appreciation
  const appreciation = currentValue && rrp && currentValue > rrp
    ? Math.round(((currentValue - rrp) / rrp) * 100)
    : null;

  return (
    <div className="space-y-3">
      {/* Set Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={name || 'LEGO Set'}
            className="w-28 h-28 object-contain rounded"
          />
        </div>
      )}

      {/* Set Number & Name */}
      {setNumber && (
        <div className="text-center">
          <span className="text-xl font-bold font-mono text-primary">{setNumber}</span>
          {name && <p className="text-sm text-muted-foreground">{name}</p>}
        </div>
      )}

      {/* Theme Path */}
      {(theme || subtheme) && (
        <p className="text-xs text-center text-muted-foreground">
          {themeGroup && `${themeGroup} › `}
          {theme}
          {subtheme && ` › ${subtheme}`}
        </p>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {isEffectivelyRetired && (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-600 border-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Retired
          </Badge>
        )}
        {!isEffectivelyRetired && availability && (
          <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">
            {availability}
          </Badge>
        )}
        {appreciation && appreciation > 0 && (
          <Badge variant="secondary" className="bg-green-500/20 text-green-600 border-green-500/30">
            <TrendingUp className="h-3 w-3 mr-1" />
            +{appreciation}%
          </Badge>
        )}
        {minifigs && minifigs > 0 && (
          <Badge variant="outline" className="text-xs">
            <Users className="h-3 w-3 mr-1" />
            {minifigs} Minifig{minifigs > 1 ? 's' : ''}
          </Badge>
        )}
        {pieces && (
          <Badge variant="outline" className="text-xs">
            <Package className="h-3 w-3 mr-1" />
            {pieces.toLocaleString()} pcs
          </Badge>
        )}
      </div>

      {/* Minifig Names */}
      {minifigNames && minifigNames.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Minifigs: {minifigNames.slice(0, 4).join(', ')}
          {minifigNames.length > 4 && ` +${minifigNames.length - 4} more`}
        </p>
      )}

      {/* Price Guide - Show secondary market if retired, RRP if available */}
      {(hasPriceGuide || marketValue) && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            {isEffectivelyRetired ? 'Secondary Market Value' : 'Price Guide'}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">
                {marketValue?.low || (priceGuide?.minPrice ? formatPrice(priceGuide.minPrice) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg</div>
              <div className="font-semibold text-green-500">
                {marketValue?.mid || (priceGuide?.avgPrice ? formatPrice(priceGuide.avgPrice) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">
                {marketValue?.high || (priceGuide?.maxPrice ? formatPrice(priceGuide.maxPrice) : '-')}
              </div>
            </div>
          </div>
          {priceGuide?.avgPriceNew && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              New/Sealed Avg: {formatPrice(priceGuide.avgPriceNew)}
            </p>
          )}
        </div>
      )}

      {/* RRP vs Current Value Comparison */}
      {rrp && currentValue && currentValue !== rrp && (
        <div className="flex justify-between items-center px-3 py-2 rounded bg-muted/30">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">RRP</p>
            <p className="text-sm font-medium">{formatPrice(rrp)}</p>
          </div>
          <div className="text-xl text-muted-foreground">→</div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Current</p>
            <p className={`text-sm font-bold ${currentValue > rrp ? 'text-green-500' : 'text-red-500'}`}>
              {formatPrice(currentValue)}
            </p>
          </div>
        </div>
      )}

      {/* Community Stats */}
      {hasCommunityStats && (
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          {rating && <span>★ {rating.toFixed(1)}{reviewCount && ` (${reviewCount})`}</span>}
          {ownedBy && <span>{ownedBy.toLocaleString()} own</span>}
          {wantedBy && <span>{wantedBy.toLocaleString()} want</span>}
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Theme" value={theme} />
          <DataRow label="Subtheme" value={subtheme} />
          <DataRow label="Year" value={year} />
          <DataRow label="Pieces" value={pieces?.toLocaleString()} />
          <DataRow label="Minifigs" value={minifigs} />
          <DataRow label="Ages" value={ageDisplay} />
          {rrp && <DataRow label="RRP" value={formatPrice(rrp)} />}
          {pricePerPiece && <DataRow label="Per Piece" value={`${pricePerPiece.toFixed(1)}¢`} />}
          <DataRow label="Packaging" value={packagingType} />
          {instructionsCount && <DataRow label="Instructions" value={`${instructionsCount} booklet${instructionsCount > 1 ? 's' : ''}`} />}
        </div>
      )}

      {/* Availability Dates */}
      {(dateFirstAvailable || dateLastAvailable) && (
        <div className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
          <Calendar className="h-3 w-3" />
          {dateFirstAvailable && `Available: ${formatDate(dateFirstAvailable)}`}
          {dateFirstAvailable && dateLastAvailable && ' - '}
          {dateLastAvailable && `Retired: ${formatDate(dateLastAvailable)}`}
        </div>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Blocks className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            LEGO set verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link */}
      {externalUrl && (
        
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          View on Brickset <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default BricksetSection;