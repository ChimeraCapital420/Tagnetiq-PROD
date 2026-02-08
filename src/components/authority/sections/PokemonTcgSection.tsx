// FILE: src/components/authority/sections/PokemonTcgSection.tsx
// Pokemon TCG authority data display
// v7.5 - Bulletproof data extraction

'use client';

import React from 'react';
import { ExternalLink, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage, formatPrice } from '../helpers';
import { createFieldExtractor, getExternalUrl, getThumbnailUrl } from '../helpers';

// Rarity color mapping
const RARITY_COLORS: Record<string, string> = {
  'Common': 'bg-gray-500/20 text-gray-400',
  'Uncommon': 'bg-green-500/20 text-green-400',
  'Rare': 'bg-blue-500/20 text-blue-400',
  'Rare Holo': 'bg-purple-500/20 text-purple-400',
  'Rare Holo EX': 'bg-yellow-500/20 text-yellow-400',
  'Rare Holo GX': 'bg-yellow-500/20 text-yellow-400',
  'Rare Holo V': 'bg-pink-500/20 text-pink-400',
  'Rare Holo VMAX': 'bg-pink-500/20 text-pink-400',
  'Rare Ultra': 'bg-pink-500/20 text-pink-400',
  'Rare Secret': 'bg-amber-500/20 text-amber-400',
  'Rare Rainbow': 'bg-gradient-to-r from-red-400 via-yellow-400 to-blue-400 text-white',
  'Rare Shiny': 'bg-cyan-500/20 text-cyan-400',
  'Illustration Rare': 'bg-cyan-500/20 text-cyan-400',
  'Special Art Rare': 'bg-rose-500/20 text-rose-400',
  'Hyper Rare': 'bg-amber-500/20 text-amber-400',
  'Promo': 'bg-indigo-500/20 text-indigo-400',
};

export const PokemonTcgSection: React.FC<SectionProps> = ({ data }) => {
  const get = createFieldExtractor(data);
  
  // Extract card fields
  const thumbnail = getThumbnailUrl(data);
  const name = get<string>('name') || get<string>('title');
  const setName = get<string>('setName') || get<string>('set');
  const setCode = get<string>('setCode');
  const number = get<string>('number');
  const rarity = get<string>('rarity');
  const artist = get<string>('artist');
  const hp = get<string>('hp');
  const types = get<string[]>('types');
  const supertype = get<string>('supertype');
  const subtypes = get<string[]>('subtypes');
  const evolvesFrom = get<string>('evolvesFrom');
  const evolvesTo = get<string[]>('evolvesTo');
  const regulationMark = get<string>('regulationMark');
  
  // TCGPlayer pricing
  const tcgplayer = get<{
    url?: string;
    updatedAt?: string;
    prices?: {
      normal?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
      holofoil?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
      reverseHolofoil?: { low?: number; mid?: number; high?: number; market?: number; directLow?: number };
      '1stEditionHolofoil'?: { low?: number; mid?: number; high?: number; market?: number };
      '1stEditionNormal'?: { low?: number; mid?: number; high?: number; market?: number };
    };
  }>('tcgplayer');
  
  const tcgPlayerUrl = get<string>('tcgPlayerUrl') || tcgplayer?.url;
  const marketValue = data.marketValue;
  const externalUrl = getExternalUrl(data) || tcgPlayerUrl;
  
  // Determine best price variant
  const prices = tcgplayer?.prices;
  const priceVariant = prices?.holofoil || prices?.reverseHolofoil || prices?.normal || 
                       prices?.['1stEditionHolofoil'] || prices?.['1stEditionNormal'];
  
  const hasData = setName || rarity || number || hp;
  const hasPricing = priceVariant || marketValue;
  
  // Get rarity color
  const rarityColor = rarity ? (RARITY_COLORS[rarity] || 'bg-primary/20 text-primary') : '';

  return (
    <div className="space-y-3">
      {/* Card Image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={name || 'Pokemon card'}
            className="w-28 h-40 object-contain rounded-lg shadow-lg"
          />
        </div>
      )}

      {/* Card Name & Set */}
      {(name || setName) && (
        <div className="text-center">
          {name && data.title !== name && (
            <p className="text-sm font-semibold">{name}</p>
          )}
          {setName && (
            <p className="text-xs text-muted-foreground">
              {setName} {setCode && `(${setCode})`} {number && `• #${number}`}
            </p>
          )}
        </div>
      )}

      {/* Badges Row */}
      <div className="flex justify-center gap-2 flex-wrap">
        {rarity && (
          <Badge className={rarityColor}>
            <Sparkles className="h-3 w-3 mr-1" />
            {rarity}
          </Badge>
        )}
        {hp && (
          <Badge variant="outline">
            <Zap className="h-3 w-3 mr-1" />
            {hp} HP
          </Badge>
        )}
        {types?.map((type, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {type}
          </Badge>
        ))}
        {regulationMark && (
          <Badge variant="outline" className="text-xs font-mono">
            {regulationMark}
          </Badge>
        )}
      </div>

      {/* Subtypes */}
      {subtypes && subtypes.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          {supertype} - {subtypes.join(' ')}
        </p>
      )}

      {/* Evolution Info */}
      {(evolvesFrom || evolvesTo) && (
        <div className="text-xs text-center text-muted-foreground">
          {evolvesFrom && <span>Evolves from {evolvesFrom}</span>}
          {evolvesFrom && evolvesTo && ' • '}
          {evolvesTo && <span>Evolves to {evolvesTo.join(', ')}</span>}
        </div>
      )}

      {/* TCGPlayer Pricing */}
      {hasPricing && (
        <div className="bg-muted/50 rounded-md p-3">
          <div className="text-xs text-muted-foreground text-center mb-2">
            TCGPlayer Market Price
            {tcgplayer?.updatedAt && (
              <span className="ml-1 opacity-60">
                (Updated {new Date(tcgplayer.updatedAt).toLocaleDateString()})
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-muted-foreground">Low</div>
              <div className="font-semibold text-red-500">
                {marketValue?.low || (priceVariant?.low ? formatPrice(priceVariant.low) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Market</div>
              <div className="font-semibold text-green-500">
                {marketValue?.mid || (priceVariant?.market ? formatPrice(priceVariant.market) : '-')}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">High</div>
              <div className="font-semibold text-blue-500">
                {marketValue?.high || (priceVariant?.high ? formatPrice(priceVariant.high) : '-')}
              </div>
            </div>
          </div>
          {priceVariant?.directLow && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              Direct Low: {formatPrice(priceVariant.directLow)}
            </p>
          )}
        </div>
      )}

      {/* Data Grid */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          <DataRow label="Set" value={setName} />
          <DataRow label="Number" value={number} />
          <DataRow label="Rarity" value={rarity} />
          <DataRow label="Artist" value={artist} />
          <DataRow label="HP" value={hp} />
          <DataRow label="Regulation" value={regulationMark} />
        </div>
      )}

      {/* No Data Fallback */}
      {!hasData && !thumbnail && (
        <div className="text-center py-4">
          <Sparkles className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">
            Pokemon card verified but detailed info unavailable
          </p>
        </div>
      )}

      {/* External Link - SINGLE LINE */}
      {externalUrl && <a href={externalUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2">View on TCGPlayer <ExternalLink className="h-3 w-3" /></a>}
    </div>
  );
};

export default PokemonTcgSection;