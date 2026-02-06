// FILE: src/components/authority/sections/PokemonTcgSection.tsx
// Pokemon TCG authority data display
// Refactored from monolith v7.3

'use client';

import React from 'react';
import { ExternalLink, Sparkles } from 'lucide-react';
import type { SectionProps } from '../types';
import { DataRow, ThumbnailImage } from '../helpers';

export const PokemonTcgSection: React.FC<SectionProps> = ({ data }) => {
  const details = (data.itemDetails || data) as typeof data;
  
  const thumbnail = details.imageLinks?.thumbnail;
  const title = details.title;
  const setName = details.setName;
  const setCode = details.setCode;
  const rarity = details.rarity;
  const cardNumber = details.cardNumber;
  const artist = details.artist;
  const hp = details.hp;
  const types = details.types;
  const pokemonTcgId = details.pokemonTcgId;
  const externalUrl = details.externalUrl || data.externalUrl;

  // Rarity color mapping
  const rarityColors: Record<string, string> = {
    'Common': 'bg-gray-200 text-gray-700',
    'Uncommon': 'bg-green-200 text-green-700',
    'Rare': 'bg-blue-200 text-blue-700',
    'Rare Holo': 'bg-purple-200 text-purple-700',
    'Rare Ultra': 'bg-yellow-200 text-yellow-700',
    'Rare Secret': 'bg-pink-200 text-pink-700',
  };

  const rarityClass = rarity ? rarityColors[rarity] || 'bg-gray-200 text-gray-700' : '';

  return (
    <div className="space-y-3">
      {/* Card image */}
      {thumbnail && (
        <div className="flex justify-center">
          <ThumbnailImage
            src={thumbnail}
            alt={title || 'Pokemon card'}
            className="w-28 h-40 object-contain rounded-lg shadow-md"
          />
        </div>
      )}

      {/* Rarity badge */}
      {rarity && (
        <div className="flex justify-center">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${rarityClass}`}>
            <Sparkles className="h-3 w-3" />
            {rarity}
          </span>
        </div>
      )}

      {/* Data grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataRow label="Set" value={setName} />
        <DataRow label="Set Code" value={setCode} />
        <DataRow label="Card #" value={cardNumber} />
        <DataRow label="HP" value={hp} />
        <DataRow label="Types" value={types?.join(', ')} />
        <DataRow label="Artist" value={artist} />
        <DataRow label="TCG ID" value={pokemonTcgId} />
      </div>

      {/* Market value if available */}
      {data.marketValue && (
        <div className="bg-muted/50 rounded-md p-2">
          <div className="text-xs text-muted-foreground text-center mb-1">TCGplayer Prices</div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="text-muted-foreground text-xs">Low</div>
              <div className="font-medium">{data.marketValue.low}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">Market</div>
              <div className="font-medium">{data.marketValue.mid}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs">High</div>
              <div className="font-medium">{data.marketValue.high}</div>
            </div>
          </div>
        </div>
      )}

      {/* External link */}
      {externalUrl && (
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on TCGplayer <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
};

export default PokemonTcgSection;