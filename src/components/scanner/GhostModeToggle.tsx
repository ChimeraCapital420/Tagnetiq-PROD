// FILE: src/components/scanner/GhostModeToggle.tsx
// Ghost Protocol - Virtual Listing Toggle
// Mobile-first design with visual feedback

import React from 'react';
import { Ghost, MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GhostLocation } from '@/hooks/useGhostMode';

interface GhostModeToggleProps {
  isEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  location: GhostLocation | null;
  isCapturing: boolean;
  error: string | null;
  className?: string;
}

export const GhostModeToggle: React.FC<GhostModeToggleProps> = ({
  isEnabled,
  onToggle,
  location,
  isCapturing,
  error,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-all duration-300',
        isEnabled
          ? 'border-purple-500/50 bg-purple-500/10'
          : 'border-zinc-800 bg-zinc-900/50',
        className
      )}
    >
      {/* Main Toggle Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'rounded-full p-2 transition-all duration-300',
              isEnabled
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-zinc-800 text-zinc-500'
            )}
          >
            <Ghost className={cn('h-5 w-5', isEnabled && 'animate-pulse')} />
          </div>
          
          <div>
            <Label
              htmlFor="ghost-mode"
              className={cn(
                'text-sm font-medium cursor-pointer',
                isEnabled ? 'text-purple-300' : 'text-zinc-300'
              )}
            >
              Ghost Mode
            </Label>
            <p className="text-[10px] text-zinc-500">
              {isEnabled
                ? 'Virtual listing - you don\'t own this yet'
                : 'List items you don\'t own yet'}
            </p>
          </div>
        </div>

        <Switch
          id="ghost-mode"
          checked={isEnabled}
          onCheckedChange={onToggle}
          disabled={isCapturing}
          className={cn(
            'data-[state=checked]:bg-purple-500',
            isCapturing && 'opacity-50'
          )}
        />
      </div>

      {/* Location Status - Only show when enabled */}
      {isEnabled && (
        <div className="mt-3 pt-3 border-t border-zinc-800/50">
          {isCapturing ? (
            <div className="flex items-center gap-2 text-zinc-400">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Capturing GPS location...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="h-3 w-3" />
              <span className="text-xs">{error}</span>
            </div>
          ) : location ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <MapPin className="h-3 w-3" />
              <span className="text-xs">
                📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                <span className="text-zinc-500 ml-1">
                  (±{Math.round(location.accuracy)}m)
                </span>
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Ghost Mode Warning Badge */}
      {isEnabled && (
        <div className="mt-2 flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
          <Ghost className="h-3 w-3 text-yellow-500" />
          <span className="text-[10px] text-yellow-400">
            48hr handling time will be auto-set on exports
          </span>
        </div>
      )}
    </div>
  );
};

export default GhostModeToggle;