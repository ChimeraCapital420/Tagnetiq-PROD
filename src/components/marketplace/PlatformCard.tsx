// FILE: src/components/marketplace/PlatformCard.tsx
// Individual platform card component for export tab

import React, { useState } from 'react';
import { Check, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { PlatformConfig, FormattedListing } from './platforms/types';

interface PlatformCardProps {
  platform: PlatformConfig;
  selected: boolean;
  onToggle: () => void;
  copied: boolean;
  onCopy: () => void;
  onOpenPlatform: () => void;
  listing: FormattedListing;
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  selected,
  onToggle,
  copied,
  onCopy,
  onOpenPlatform,
  listing,
}) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-200 overflow-hidden',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-zinc-800/50 hover:border-zinc-700 bg-zinc-900/30'
      )}
    >
      {/* Header */}
      <div
        className="p-3 flex items-center gap-3 cursor-pointer"
        onClick={onToggle}
      >
        <div className={cn('p-1.5 rounded', platform.bgColor)}>
          <platform.icon className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-white text-sm">{platform.name}</h4>
          <p className="text-[10px] text-zinc-500 truncate">
            {platform.bestFor.join(' • ')}
          </p>
        </div>
        <Checkbox checked={selected} className="h-4 w-4" />
      </div>

      {/* Expanded Preview */}
      {selected && (
        <div className="px-3 pb-3 space-y-2">
          {/* Quick Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs border-zinc-700"
              onClick={(e) => {
                e.stopPropagation();
                onCopy();
              }}
            >
              {copied ? (
                <><Check className="h-3 w-3 mr-1 text-green-500" /> Copied!</>
              ) : (
                <><Copy className="h-3 w-3 mr-1" /> Copy</>
              )}
            </Button>
            <Button
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onOpenPlatform();
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" /> Open
            </Button>
          </div>

          {/* Preview Toggle */}
          <button
            className="w-full flex items-center justify-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors py-1"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            <ChevronDown
              className={cn(
                'h-3 w-3 transition-transform',
                expanded && 'rotate-180'
              )}
            />
            {expanded ? 'Hide' : 'Show'} preview
          </button>

          {/* Listing Preview */}
          {expanded && listing && (
            <div className="bg-zinc-950 rounded p-2 text-[10px] space-y-1 max-h-32 overflow-y-auto">
              <div>
                <span className="text-zinc-500">Title: </span>
                <span className="text-zinc-300">{listing.title}</span>
              </div>
              <div>
                <span className="text-zinc-500">Price: </span>
                <span className="text-green-400">${listing.price}</span>
              </div>
              {listing.condition && (
                <div>
                  <span className="text-zinc-500">Condition: </span>
                  <span className="text-zinc-300">{listing.condition}</span>
                </div>
              )}
              <div className="pt-1 border-t border-zinc-800 mt-1">
                <span className="text-zinc-500">Description:</span>
                <p className="text-zinc-400 whitespace-pre-wrap mt-1">
                  {listing.description.slice(0, 200)}
                  {listing.description.length > 200 && '...'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PlatformCard;