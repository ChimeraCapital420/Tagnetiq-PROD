// FILE: src/components/authority/sections/NumistaSection.tsx
// Numista (Coins) authority data display
// v7.5 - Bulletproof data extraction - FULL VERSION

'use client';

import React from 'react';
import { ExternalLink, Coins, Calendar, Scale, Ruler, Circle, Hash, Globe, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatNumber } from '../helpers';
import { createFieldExtractor, getExternalUrl } from '../helpers';

// Coin type display names
const COIN_TYPES: Record<string, string> = {
  'coin': 'Coin',
  'token': 'Token',
  'pattern': 'Pattern',
  'medal': 'Medal',
  'exonumia': 'Exonumia',
};

export const NumistaSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract coin-specific fields
  const obverseThumb = get<string>('obverseThumb') || get<string>('obverseThumbnail');
  const reverseThumb = get<string>('reverseThumb') || get<string>('reverseThumbnail');
  const obversePicture = get<string>('obversePicture');
  const reversePicture = get<string>('reversePicture');
  const edgePicture = get<string>('edgePicture');
  
  const title = get<string>('title') || get<string>('name');
  const issuer = get<string>('issuer');
  const issuerType = get<string>('issuerType');
  const ruler = get<string>('ruler');
  const type = get<string>('type');
  
  // Date range
  const minYear = get<number>('minYear');
  const maxYear = get<number>('maxYear');
  const yearRange = get<string>('yearRange');
  
  // Denomination
  const denomination = get<string>('value') || get<string>('denomination');
  const denominationValue = get<number>('denominationValue');
  const currency = get<string>('currency');
  
  // Physical properties
  const composition = get<string>('composition');
  const weight = get<number>('weight');
  const size = get<number>('size') || get<number>('diameter');
  const thickness = get<number>('thickness');
  const shape = get<string>('shape');
  const orientation = get<string>('orientation');
  const technique = get<string>('technique');
  const edge = get<string>('edge');
  const edgeLettering = get<string>('edgeLettering');
  
  // References
  const catalogNumber = get<string>('catalogNumber') || data.catalogNumber;
  const numistaId = get<string>('numistaId') || get<number>('id');
  const kmNumber = get<string>('kmNumber') || get<string>('km');
  const references = get<Array<{ catalog: string; number: string }>>('references');
  
  // Rarity and mintage
  const mintage = get<number>('mintage');
  const rarity = get<string>('rarity');
  const commemorative = get<boolean>('commemorative');
  const demonetized = get<boolean>('demonetized');
  
  // Numista community
  const numOwners = get<number>('numOwners');
  const numWishlist = get<number>('numWishlist');
  const score = get<number>('score');
  
  const externalUrl = getExternalUrl(data);
  const marketValue = data.marketValue;
  
  // Format year display
  const yearDisplay = yearRange || (
    minYear && maxYear && minYear !== maxYear
      ? `${minYear} - ${maxYear}`
      : minYear || maxYear
  );

  const hasData = issuer || denomination || composition || weight;
  const hasImages = obverseThumb || reverseThumb;
  const hasCommunityStats = numOwners || numWishlist || score;

  return (
    <div className="space-y-3">
      {/* Coin Images - Obverse and Reverse */}
      {hasImages && (
        <div className="flex justify-center gap-3">
          {obverseThumb && (
            <div className="text-center">
              <ThumbnailImage
                src={obverseThumb}
                alt="Obverse"
                className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/30 shadow-md"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Obverse</p>
            </div>
          )}
          {reverseThumb && (
            <div className="text-center">
              <ThumbnailImage
                src={reverseThumb}
                alt="Reverse"
                className="w-20 h-20 rounded-full object-cover border-2 border-amber-500/30 shadow-md"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Reverse</p>
            </div>
          )}
        </div>
      )}

      {/* Title */}
      {title && data.title !== title && (
        <p className="text-sm font-semibold text-center">{title}</p>
      )}

      {/* Denomination Display */}
      {denomination && (
        <div className="text-center">
          <p className="text-lg font-bold text-primary">{denomination}</p>
          {currency && currency !== denomination && (
            <p className="text-xs text-muted-foreground">{currency}</p>
          )}
        </div>
      )}

      {/* Catalog Number */}
      {(catalogNumber || kmNumber) && (
        <p className="text-xs text-center text-muted-foreground font-mono">
          <Hash className="h-3 w-3 inline mr-1" />
          {catalogNumber || `KM# ${kmNumber}`}
        </p>
      )}

      {/* Status Badges */}
      <div className="flex justify-center gap-2 flex-wrap">
        {type && (
          <Badge variant="outline" className="text-xs">
            <Coins className="h-3 w-3 mr-1" />
            {COIN_TYPES[type] || type}
          </Badge>
        )}
        {commemorative && (
          <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30 text-xs">
            <Award className="h-3 w-3 mr-1" />
            Commemorative
          </Badge>
        )}
        {demonetized && (
          <Badge variant="secondary" className="text-xs">
            Demonetized
          </Badge>
        )}
        {rarity && (
          <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs">
            {rarity}
          </Badge>
        )}
      </div>

      {/* Physical Properties */}
      {(weight || size || thickness) && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Physical Properties</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {weight && (
              <div>
                <Scale className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Weight</p>
                <p className="font-semibold text-sm">{weight}g</p>
              </div>
            )}
            {size && (
              <div>
                <Ruler className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Diameter</p>
                <p className="font-semibold text-sm">{size}mm</p>
              </div>
            )}
            {thickness && (
              <div>
                <Circle className="h-3 w-3 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Thickness</p>
                <p className="font-semibold text-sm">{thickness}mm</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Value */}
      {marketValue && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">Market Value Range</div>
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

      {/* Numista Community Stats */}
      {hasCommunityStats && (
        <div className="flex justify-center gap-4 text-xs text-muted-foreground">
          {numOwners && <span>{numOwners.toLocaleString()} owners</span>}
          {numWishlist && <span>{numWishlist.toLocaleString()} want</span>}
          {score && <span>Score: {score}</span>}
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Issuer" value={issuer} />
          <DataRow label="Ruler" value={ruler} />
          <DataRow label="Year" value={yearDisplay} />
          <DataRow label="Denomination" value={denomination} />
          <DataRow label="Composition" value={composition} />
          <DataRow label="Shape" value={shape} />
          <DataRow label="Orientation" value={orientation} />
          <DataRow label="Edge" value={edge} />
          {mintage && <DataRow label="Mintage" value={formatNumber(mintage)} />}
          <DataRow label="Technique" value={technique} />
        </div>
      )}

      {/* Edge Lettering */}
      {edgeLettering && (
        <p className="text-xs text-center text-muted-foreground italic">
          Edge: "{edgeLettering}"
        </p>
      )}

      {/* References */}
      {references && references.length > 0 && (
        <div className="text-xs text-center text-muted-foreground">
          <span className="font-medium">Refs: </span>
          {references.slice(0, 3).map((ref, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {ref.catalog}#{ref.number}
            </span>
          ))}
        </div>
      )}

      {/* Numista ID */}
      {numistaId && (
        <p className="text-xs text-center text-muted-foreground">
          Numista ID: {numistaId}
        </p>
      )}

      {/* No Data Fallback */}
      {!hasData && !hasImages && (
        <div className="text-center py-4">
          <Coins className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Coin verified but detailed info unavailable
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
          View on Numista <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default NumistaSection;